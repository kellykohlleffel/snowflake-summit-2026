import { z } from "zod";
import type { FivetranTool, ToolResult } from "./types.js";
import { getFivetranApi } from "../api/client.js";
import type { PaginatedData, Group } from "../api/types.js";

const inputSchema = z.object({
  cursor: z
    .string()
    .optional()
    .describe("Pagination cursor from a previous request"),
  limit: z
    .number()
    .min(1)
    .max(1000)
    .optional()
    .describe("Number of results to return (1-1000, default 100)"),
});

export const listGroupsTool: FivetranTool = {
  name: "list_groups",
  permission: "read",

  definition: {
    name: "list_groups",
    description:
      "List all groups (workspaces) in the Fivetran account. " +
      "Groups contain connectors and map 1:1 to destinations. " +
      "Use this to discover what workspaces exist before drilling into connections.",
    input_schema: {
      type: "object" as const,
      properties: {
        cursor: {
          type: "string",
          description: "Pagination cursor from a previous request",
        },
        limit: {
          type: "number",
          description: "Number of results to return (1-1000, default 100)",
        },
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
      const path = `/groups${query ? "?" + query : ""}`;
      const response = await getFivetranApi().get<PaginatedData<Group>>(path);

      return {
        success: true,
        data: {
          groups: response.data.items,
          next_cursor: response.data.next_cursor ?? null,
          count: response.data.items.length,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  },
};
