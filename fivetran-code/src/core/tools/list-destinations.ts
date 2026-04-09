import { z } from "zod";
import type { FivetranTool, ToolResult } from "./types.js";
import { getFivetranApi } from "../api/client.js";
import type { PaginatedData, Destination } from "../api/types.js";

const inputSchema = z.object({
  cursor: z.string().optional().describe("Pagination cursor"),
  limit: z.number().min(1).max(1000).optional().describe("Number of results (1-1000)"),
});

export const listDestinationsTool: FivetranTool = {
  name: "list_destinations",
  permission: "read",
  definition: {
    name: "list_destinations",
    description:
      "List all destinations in the Fivetran account. " +
      "Destinations are the data warehouses or databases that Fivetran loads data into (Snowflake, BigQuery, etc.).",
    input_schema: {
      type: "object" as const,
      properties: {
        cursor: { type: "string", description: "Pagination cursor" },
        limit: { type: "number", description: "Number of results (1-1000)" },
      },
      required: [],
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
      const path = `/destinations${query ? "?" + query : ""}`;
      const response = await getFivetranApi().get<PaginatedData<Destination>>(path);
      return {
        success: true,
        data: {
          destinations: response.data.items,
          next_cursor: response.data.next_cursor ?? null,
          count: response.data.items.length,
        },
      };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  },
};
