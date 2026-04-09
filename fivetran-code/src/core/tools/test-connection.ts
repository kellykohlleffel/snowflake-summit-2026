import { z } from "zod";
import type { FivetranTool, ToolResult } from "./types.js";
import { getFivetranApi } from "../api/client.js";

const inputSchema = z.object({
  connection_id: z.string().describe("The connection ID to test"),
});

export const testConnectionTool: FivetranTool = {
  name: "test_connection",
  permission: "read",
  definition: {
    name: "test_connection",
    description:
      "Test a connection's configuration and authentication. " +
      "Returns the setup test results showing which checks passed or failed " +
      "(e.g., API connectivity, credentials, permissions). " +
      "Use after creating a connection or completing OAuth to verify it's ready to sync.",
    input_schema: {
      type: "object" as const,
      properties: {
        connection_id: { type: "string", description: "The connection to test" },
      },
      required: ["connection_id"],
    },
  },
  inputSchema,
  async execute(input: Record<string, unknown>): Promise<ToolResult> {
    const parsed = inputSchema.parse(input);
    try {
      const response = await getFivetranApi().post(`/connections/${parsed.connection_id}/test`);
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  },
};
