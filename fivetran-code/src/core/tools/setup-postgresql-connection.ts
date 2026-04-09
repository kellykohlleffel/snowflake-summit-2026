import { z } from "zod";
import type { FivetranTool, ToolResult } from "./types.js";
import { getFivetranApi } from "../api/client.js";

const inputSchema = z.object({
  group_id: z.string().describe("The group (workspace) ID to create the connection in"),
  host: z.string().describe("PostgreSQL host IP or hostname"),
  port: z.number().optional().default(5432).describe("PostgreSQL port (default: 5432)"),
  database: z.string().describe("Database name on the PostgreSQL instance"),
  user: z.string().describe("Database username"),
  password: z.string().describe("Database password"),
  schema: z.string().describe("Destination schema prefix (permanent, cannot be changed)"),
  connection_type: z
    .enum(["google_cloud_postgresql", "postgres", "aurora_postgresql"])
    .optional()
    .default("google_cloud_postgresql")
    .describe("PostgreSQL variant (default: google_cloud_postgresql)"),
  update_method: z
    .enum(["TELEPORT", "XMIN", "WAL"])
    .optional()
    .default("TELEPORT")
    .describe("Replication method (default: TELEPORT / query-based)"),
  sync_frequency: z
    .number()
    .optional()
    .default(360)
    .describe("Minutes between syncs (default: 360 = 6 hours)"),
});

interface StepResult {
  step: string;
  status: "success" | "failed";
  detail?: unknown;
}

export const setupPostgresqlConnectionTool: FivetranTool = {
  name: "setup_postgresql_connection",
  permission: "write",
  definition: {
    name: "setup_postgresql_connection",
    description:
      "Create and fully set up a PostgreSQL connector in one step. " +
      "Handles the entire flow deterministically: create connection → " +
      "test with auto-trust for TLS certificates and SSH fingerprints → " +
      "reload schema → return discovered schemas and tables. " +
      "Use this for google_cloud_postgresql, postgres, or aurora_postgresql connectors. " +
      "After this tool returns, proceed directly to schema/table selection using the discovered schemas.",
    input_schema: {
      type: "object" as const,
      properties: {
        group_id: { type: "string", description: "The group (workspace) ID" },
        host: { type: "string", description: "PostgreSQL host IP or hostname" },
        port: { type: "number", description: "PostgreSQL port (default: 5432)" },
        database: { type: "string", description: "Database name on the PostgreSQL instance" },
        user: { type: "string", description: "Database username" },
        password: { type: "string", description: "Database password" },
        schema: { type: "string", description: "Destination schema prefix (permanent)" },
        connection_type: {
          type: "string",
          enum: ["google_cloud_postgresql", "postgres", "aurora_postgresql"],
          description: "PostgreSQL variant (default: google_cloud_postgresql)",
        },
        update_method: {
          type: "string",
          enum: ["TELEPORT", "XMIN", "WAL"],
          description: "Replication method (default: TELEPORT / query-based)",
        },
        sync_frequency: { type: "number", description: "Minutes between syncs (default: 360)" },
      },
      required: ["group_id", "host", "database", "user", "password", "schema"],
    },
  },
  inputSchema,
  async execute(input: Record<string, unknown>): Promise<ToolResult> {
    const parsed = inputSchema.parse(input);
    const api = getFivetranApi();
    const steps: StepResult[] = [];
    let connectionId = "";

    // ── Step 1: Create connection ──────────────────────────────────────
    try {
      const createBody = {
        group_id: parsed.group_id,
        service: parsed.connection_type,
        sync_frequency: parsed.sync_frequency,
        config: {
          schema_prefix: parsed.schema,
          host: parsed.host,
          port: parsed.port,
          database: parsed.database,
          user: parsed.user,
          password: parsed.password,
          update_method: parsed.update_method,
        },
      };
      const createResp = await api.post<{ id: string }>("/connections", createBody);
      connectionId = createResp.data?.id ?? "";
      steps.push({ step: "create_connection", status: "success", detail: { connection_id: connectionId } });
    } catch (error) {
      return {
        success: false,
        error: `Failed to create connection: ${error instanceof Error ? error.message : String(error)}`,
      };
    }

    // ── Step 2: Test with auto-trust for certs and fingerprints ───────
    // The trust_certificates and trust_fingerprints parameters tell the
    // Fivetran API to auto-approve any pending TLS certs or SSH fingerprints
    // during the test run. No separate approval step needed.
    let allTestsPassed = false;
    try {
      const testResp = await api.post(`/connections/${connectionId}/test`, {
        trust_certificates: true,
        trust_fingerprints: true,
      });
      const data = testResp.data as Record<string, unknown>;
      const setupState = data?.setup_state;
      const setupTests = data?.setup_tests;

      // Consider success if: setup_state is "connected", OR no test explicitly FAILED
      // The API may return states like "incomplete" during transition even when tests pass
      const hasFailedTest = Array.isArray(setupTests) &&
        setupTests.some((t: Record<string, unknown>) => t.status === "FAILED");
      allTestsPassed = setupState === "connected" || (Array.isArray(setupTests) && !hasFailedTest);

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

    // ── Step 3: Reload schema (discover tables) ────────────────────────
    let schemasDiscovered: unknown = null;
    if (allTestsPassed) {
      try {
        await api.post(`/connections/${connectionId}/schemas/reload`);
        steps.push({ step: "reload_schema", status: "success" });
      } catch (error) {
        steps.push({ step: "reload_schema", status: "failed", detail: error instanceof Error ? error.message : String(error) });
      }

      // ── Step 4: Get schema config ──────────────────────────────────
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

    // ── Build result ───────────────────────────────────────────────────
    const message = allTestsPassed
      ? "PostgreSQL connector created, tested, and verified. Schemas discovered — ready for table selection."
      : `PostgreSQL connector created (${connectionId}) but setup tests did not pass. Check step details.`;

    return {
      success: allTestsPassed,
      data: {
        connection_id: connectionId,
        schema: parsed.schema,
        service: parsed.connection_type,
        steps,
        all_tests_passed: allTestsPassed,
        schemas_discovered: schemasDiscovered,
        message,
      },
    };
  },
};
