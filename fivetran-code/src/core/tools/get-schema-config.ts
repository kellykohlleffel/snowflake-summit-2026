import { z } from "zod";
import type { FivetranTool, ToolResult } from "./types.js";
import { getFivetranApi } from "../api/client.js";

const inputSchema = z.object({
  connection_id: z.string().describe("The connection ID to get schema config for"),
});

export const getSchemaConfigTool: FivetranTool = {
  name: "get_schema_config",
  permission: "read",
  definition: {
    name: "get_schema_config",
    description:
      "Get the schema configuration for a connection, including which schemas, " +
      "tables, and columns are enabled or disabled, sync modes, and hashing settings.",
    input_schema: {
      type: "object" as const,
      properties: {
        connection_id: { type: "string", description: "The connection to inspect" },
      },
      required: ["connection_id"],
    },
  },
  inputSchema,
  async execute(input: Record<string, unknown>): Promise<ToolResult> {
    const parsed = inputSchema.parse(input);
    try {
      const response = await getFivetranApi().get(`/connections/${parsed.connection_id}/schemas`);
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  },
};
