import { z } from "zod";
import type { FivetranTool, ToolResult } from "./types.js";
import { getFivetranApi } from "../api/client.js";
import type { Group } from "../api/types.js";

const inputSchema = z.object({
  group_id: z.string().describe("The unique identifier for the group"),
});

export const getGroupDetailsTool: FivetranTool = {
  name: "get_group_details",
  permission: "read",
  definition: {
    name: "get_group_details",
    description:
      "Get detailed information about a specific group, including its name and creation date.",
    input_schema: {
      type: "object" as const,
      properties: {
        group_id: { type: "string", description: "The unique group identifier" },
      },
      required: ["group_id"],
    },
  },
  inputSchema,
  async execute(input: Record<string, unknown>): Promise<ToolResult> {
    const parsed = inputSchema.parse(input);
    try {
      const response = await getFivetranApi().get<Group>(`/groups/${parsed.group_id}`);
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  },
};
