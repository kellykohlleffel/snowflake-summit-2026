import { z } from "zod";
import type { FivetranTool, ToolResult } from "./types.js";
import { getFivetranApi } from "../api/client.js";

const inputSchema = z.object({
  connection_id: z.string().describe("The connection ID to authorize"),
});

export const openConnectorSetupTool: FivetranTool = {
  name: "open_connector_setup",
  permission: "read",
  definition: {
    name: "open_connector_setup",
    description:
      "Open a connector's authorization page in the browser using Fivetran's Connect Card. " +
      "This shows ONLY the authorization step — no setup wizard, no schema selection, no dbt setup. " +
      "Use after creating an OAuth connector (e.g., Salesforce, HubSpot) so the user can click Authorize. " +
      "After authorization, the user returns to the CLI for all remaining setup steps.",
    input_schema: {
      type: "object" as const,
      properties: {
        connection_id: { type: "string", description: "The connection ID to authorize" },
      },
      required: ["connection_id"],
    },
  },
  inputSchema,
  async execute(input: Record<string, unknown>): Promise<ToolResult> {
    const parsed = inputSchema.parse(input);

    try {
      // Try the Connect Card token API for a minimal auth-only experience
      const response = await getFivetranApi().post<{ token?: string }>(
        `/connectors/${parsed.connection_id}/connect-card-token`
      );
      const token = response.data?.token;
      if (token) {
        const url = `https://fivetran.com/connect-card/setup?auth=${token}`;
        return {
          success: true,
          data: {
            url,
            message: "Opening Connect Card authorization page. Click Authorize, then return to the CLI.",
          },
        };
      }
    } catch {
      // Connect Card API may not be available — fall back to dashboard URL
    }

    // Fallback: open the dashboard setup page
    const url = `https://fivetran.com/dashboard/connectors/${parsed.connection_id}/setup`;
    return {
      success: true,
      data: {
        url,
        message: "Opening connector setup page. Click Authorize ONLY, then return to the CLI for remaining setup.",
      },
    };
  },
};
