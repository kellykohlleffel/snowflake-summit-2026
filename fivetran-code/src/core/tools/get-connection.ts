import { z } from "zod";
import type { FivetranTool, ToolResult } from "./types.js";
import { getFivetranApi } from "../api/client.js";
import type { Connection } from "../api/types.js";

const inputSchema = z.object({
  connection_id: z.string().describe("The unique connection (connector) identifier"),
});

export const getConnectionTool: FivetranTool = {
  name: "get_connection_details",
  permission: "read",

  definition: {
    name: "get_connection_details",
    description:
      "Get comprehensive details about a specific Fivetran connection (connector), " +
      "including its service type, schema, sync schedule, status, last sync timestamps, " +
      "and any active tasks or warnings. Use this to diagnose issues with a specific connector.",
    input_schema: {
      type: "object" as const,
      properties: {
        connection_id: {
          type: "string",
          description: "The unique connection identifier",
        },
      },
      required: ["connection_id"],
    },
  },

  inputSchema,

  async execute(input: Record<string, unknown>): Promise<ToolResult> {
    const parsed = inputSchema.parse(input);
    try {
      const response = await getFivetranApi().get<Connection>(
        `/connections/${parsed.connection_id}`
      );

      return {
        success: true,
        data: response.data,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  },
};
