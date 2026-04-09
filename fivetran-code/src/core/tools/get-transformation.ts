import { z } from "zod";
import type { FivetranTool, ToolResult } from "./types.js";
import { getFivetranApi } from "../api/client.js";

const inputSchema = z.object({
  transformation_id: z.string().describe("The transformation ID to get details for"),
});

export const getTransformationTool: FivetranTool = {
  name: "get_transformation_details",
  permission: "read",
  definition: {
    name: "get_transformation_details",
    description:
      "Get detailed information about a specific dbt transformation, " +
      "including its dbt project, trigger settings, schedule, and status.",
    input_schema: {
      type: "object" as const,
      properties: {
        transformation_id: { type: "string", description: "The transformation to inspect" },
      },
      required: ["transformation_id"],
    },
  },
  inputSchema,
  async execute(input: Record<string, unknown>): Promise<ToolResult> {
    const parsed = inputSchema.parse(input);
    try {
      const response = await getFivetranApi().get(`/transformations/${parsed.transformation_id}`);
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  },
};
