import { z } from "zod";
import type { FivetranTool, ToolResult } from "./types.js";
import { getFivetranApi } from "../api/client.js";

const inputSchema = z.object({
  connection_id: z.string().describe("The connection ID to delete"),
});

export const deleteConnectionTool: FivetranTool = {
  name: "delete_connection",
  permission: "write",
  definition: {
    name: "delete_connection",
    description:
      "Permanently delete a Fivetran connection (connector). " +
      "This cannot be undone. Requires user confirmation.",
    input_schema: {
      type: "object" as const,
      properties: {
        connection_id: { type: "string", description: "The connection to delete" },
      },
      required: ["connection_id"],
    },
  },
  inputSchema,
  async execute(input: Record<string, unknown>): Promise<ToolResult> {
    const parsed = inputSchema.parse(input);
    try {
      const response = await getFivetranApi().delete(`/connections/${parsed.connection_id}`);
      return { success: true, data: response.data ?? { message: `Connection ${parsed.connection_id} deleted` } };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  },
};
