import { z } from "zod";
import type { FivetranTool, ToolResult } from "./types.js";
import { getFivetranApi } from "../api/client.js";

const inputSchema = z.object({
  group_id: z.string().describe("The group (workspace) ID to create the connection in"),
  service: z.string().describe("The connector service type (e.g., 'google_ads', 'stripe', 'postgres', 'salesforce')"),
  schema: z.string().describe("Destination schema name (permanent, cannot be changed after creation)"),
  paused: z.boolean().optional().describe("Whether to start the connection paused (default: false)"),
  sync_frequency: z.number().optional().describe("Minutes between syncs: 5, 15, 30, 60, 120, 360, 720, or 1440"),
  config: z.record(z.unknown()).optional().describe("Service-specific configuration parameters"),
});

/** PostgreSQL service types that need automatic cert/fingerprint trust after creation. */
const POSTGRES_SERVICES = ["google_cloud_postgresql", "postgres", "aurora_postgresql"];

interface StepResult {
  step: string;
  status: "success" | "failed";
  detail?: unknown;
}

/**
 * After creating a PostgreSQL connection, run the deterministic setup flow:
 *
 * 1. POST /connections/{id}/test with trust_certificates + trust_fingerprints
 *    — runs setup tests AND auto-approves certs/fingerprints in one call
 * 2. POST /connections/{id}/schemas/reload — discover schemas/tables
 * 3. GET  /connections/{id}/schemas — return discovered schema config
 *
 * This replaces the old multi-step flow (test → detect certs → approve → re-test)
 * which was unreliable due to Fivetran API propagation delays.
 */
async function runPostgresSetup(connectionId: string): Promise<{
  steps: StepResult[];
  allTestsPassed: boolean;
  schemasDiscovered: unknown;
}> {
  const api = getFivetranApi();
  const steps: StepResult[] = [];
  let allTestsPassed = false;

  // ── Step 1: Test with auto-trust for certs and fingerprints ────────
  // The trust_certificates and trust_fingerprints parameters tell the
  // Fivetran API to automatically approve any pending TLS certificates
  // or SSH fingerprints during the test run. No separate approval needed.
  try {
    const testResp = await api.post(`/connections/${connectionId}/test`, {
      trust_certificates: true,
      trust_fingerprints: true,
    });
    const data = testResp.data as Record<string, unknown>;
    const setupState = data?.setup_state;
    const setupTests = data?.setup_tests;

    // Consider connected OR all tests passed/warned (WARNING is non-blocking)
    allTestsPassed = setupState === "connected" || (
      Array.isArray(setupTests) &&
      setupTests.every((t: Record<string, unknown>) => t.status === "PASSED" || t.status === "WARNING")
    );

    steps.push({
      step: "test_with_trust",
      status: allTestsPassed ? "success" : "failed",
      detail: { setup_state: setupState, setup_tests: setupTests },
    });
  } catch (error) {
    steps.push({
      step: "test_with_trust",
      status: "failed",
      detail: error instanceof Error ? error.message : String(error),
    });
  }

  // ── Step 2: Reload schema (discover tables) ────────────────────────
  let schemasDiscovered: unknown = null;
  if (allTestsPassed) {
    try {
      await api.post(`/connections/${connectionId}/schemas/reload`);
      steps.push({ step: "reload_schema", status: "success" });
    } catch (error) {
      steps.push({ step: "reload_schema", status: "failed", detail: error instanceof Error ? error.message : String(error) });
    }

    // ── Step 3: Get schema config ──────────────────────────────────
    try {
      const schemaResp = await api.get(`/connections/${connectionId}/schemas`);
      schemasDiscovered = schemaResp.data;
      steps.push({ step: "get_schema_config", status: "success" });
    } catch (error) {
      steps.push({ step: "get_schema_config", status: "failed", detail: error instanceof Error ? error.message : String(error) });
    }
  } else {
    steps.push({ step: "reload_schema", status: "failed", detail: "Cannot discover schemas — setup tests did not pass" });
  }

  return { steps, allTestsPassed, schemasDiscovered };
}

export const createConnectionTool: FivetranTool = {
  name: "create_connection",
  permission: "write",
  definition: {
    name: "create_connection",
    description:
      "Create a new Fivetran connection (connector) in a group. " +
      "Requires the group ID, service type (e.g., 'salesforce', 'postgres'), " +
      "and a destination schema name. Requires user confirmation. " +
      "For PostgreSQL connectors, automatically handles TLS certificate approval, " +
      "connection testing, and schema discovery — no browser needed.",
    input_schema: {
      type: "object" as const,
      properties: {
        group_id: { type: "string", description: "The group (workspace) ID" },
        service: { type: "string", description: "Connector service type (e.g., 'salesforce', 'postgres')" },
        schema: { type: "string", description: "Destination schema name (permanent)" },
        paused: { type: "boolean", description: "Start paused (default: false)" },
        sync_frequency: { type: "number", description: "Minutes between syncs" },
        config: { type: "object", description: "Service-specific config parameters" },
      },
      required: ["group_id", "service", "schema"],
    },
  },
  inputSchema,
  async execute(input: Record<string, unknown>): Promise<ToolResult> {
    const parsed = inputSchema.parse(input);
    try {
      const body: Record<string, unknown> = {
        group_id: parsed.group_id,
        service: parsed.service,
        config: { schema_prefix: parsed.schema, ...(parsed.config ?? {}) },
      };
      if (parsed.paused !== undefined) body.paused = parsed.paused;
      if (parsed.sync_frequency !== undefined) body.sync_frequency = parsed.sync_frequency;

      const response = await getFivetranApi().post<{ id: string }>("/connections", body);
      const connectionId = response.data?.id;

      // For PostgreSQL connectors: test with auto-trust → reload schema
      if (connectionId && POSTGRES_SERVICES.includes(parsed.service)) {
        const pgSetup = await runPostgresSetup(connectionId);
        const message = pgSetup.allTestsPassed
          ? "PostgreSQL connector created, tested, and verified. Schemas discovered — ready for table selection."
          : `PostgreSQL connector created (${connectionId}) but setup tests did not pass. Check step details.`;

        return {
          success: true,
          data: {
            ...response.data,
            connection_id: connectionId,
            postgresql_setup: {
              steps: pgSetup.steps,
              all_tests_passed: pgSetup.allTestsPassed,
              schemas_discovered: pgSetup.schemasDiscovered,
              message,
            },
          },
        };
      }

      // For all other connectors: return as before
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  },
};
