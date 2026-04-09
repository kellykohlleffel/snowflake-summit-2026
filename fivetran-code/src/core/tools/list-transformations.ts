import { z } from "zod";
import type { FivetranTool, ToolResult } from "./types.js";
import { getFivetranApi } from "../api/client.js";

const inputSchema = z.object({
  group_id: z.string().optional().describe("Filter by group ID"),
  type: z.enum(["DBT_CORE", "QUICKSTART"]).optional().describe("Filter by transformation type"),
  limit: z.number().optional().describe("Max results per page (default: 100)"),
  cursor: z.string().optional().describe("Pagination cursor from previous response"),
});

export const listTransformationsTool: FivetranTool = {
  name: "list_transformations",
  permission: "read",
  definition: {
    name: "list_transformations",
    description:
      "List all dbt transformations in the Fivetran account. " +
      "Can filter by group ID or transformation type (DBT_CORE or QUICKSTART).",
    input_schema: {
      type: "object" as const,
      properties: {
        group_id: { type: "string", description: "Filter by group ID" },
        type: { type: "string", enum: ["DBT_CORE", "QUICKSTART"], description: "Filter by type" },
        limit: { type: "number", description: "Max results per page" },
        cursor: { type: "string", description: "Pagination cursor" },
      },
      required: [],
    },
  },
  inputSchema,
  async execute(input: Record<string, unknown>): Promise<ToolResult> {
    const parsed = inputSchema.parse(input);
    try {
      const params = new URLSearchParams();
      if (parsed.group_id) params.set("group_id", parsed.group_id);
      if (parsed.type) params.set("type", parsed.type);
      if (parsed.limit) params.set("limit", String(parsed.limit));
      if (parsed.cursor) params.set("cursor", parsed.cursor);

      const query = params.toString();
      const path = query ? `/transformations?${query}` : "/transformations";
      const response = await getFivetranApi().get(path);
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  },
};
