import { z } from "zod";
import type { FivetranTool, ToolResult } from "./types.js";
import { getFivetranApi } from "../api/client.js";
import type { PaginatedData, Connection } from "../api/types.js";

const inputSchema = z.object({
  group_id: z.string().describe("The group ID to list connections for"),
  cursor: z.string().optional().describe("Pagination cursor from a previous request"),
  limit: z.number().min(1).max(1000).optional().describe("Number of results (1-1000, default 100)"),
});

export const listConnectionsTool: FivetranTool = {
  name: "list_connections_in_group",
  permission: "read",
  definition: {
    name: "list_connections_in_group",
    description:
      "List all connections (connectors) within a specific Fivetran group. " +
      "Returns connection IDs, service types, schemas, paused state, and sync status. " +
      "Use this to see what connectors exist in a workspace and their health.",
    input_schema: {
      type: "object" as const,
      properties: {
        group_id: { type: "string", description: "The group ID" },
        cursor: { type: "string", description: "Pagination cursor" },
        limit: { type: "number", description: "Number of results (1-1000)" },
      },
      required: ["group_id"],
    },
  },
  inputSchema,
  async execute(input: Record<string, unknown>): Promise<ToolResult> {
    const parsed = inputSchema.parse(input);
    try {
      const params = new URLSearchParams();
      if (parsed.cursor) params.set("cursor", parsed.cursor);
      if (parsed.limit) params.set("limit", String(parsed.limit));
      const query = params.toString();
      const path = `/groups/${parsed.group_id}/connections${query ? "?" + query : ""}`;
      const response = await getFivetranApi().get<PaginatedData<Connection>>(path);
      return {
        success: true,
        data: {
          connections: response.data.items,
          next_cursor: response.data.next_cursor ?? null,
          count: response.data.items.length,
        },
      };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  },
};
