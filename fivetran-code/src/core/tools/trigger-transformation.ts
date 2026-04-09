import { z } from "zod";
import type { FivetranTool, ToolResult } from "./types.js";
import { getFivetranApi } from "../api/client.js";

const inputSchema = z.object({
  transformation_id: z.string().describe("The transformation ID to run"),
  full_refresh: z.boolean().optional().describe("Whether to do a full refresh (default: false)"),
});

export const triggerTransformationTool: FivetranTool = {
  name: "trigger_transformation",
  permission: "write",
  definition: {
    name: "trigger_transformation",
    description:
      "Trigger an immediate run of a dbt transformation. " +
      "Optionally specify full_refresh for a complete rebuild. " +
      "Requires user confirmation.",
    input_schema: {
      type: "object" as const,
      properties: {
        transformation_id: { type: "string", description: "The transformation to run" },
        full_refresh: { type: "boolean", description: "Full refresh rebuild (default: false)" },
      },
      required: ["transformation_id"],
    },
  },
  inputSchema,
  async execute(input: Record<string, unknown>): Promise<ToolResult> {
    const parsed = inputSchema.parse(input);
    try {
      const body: Record<string, unknown> = {};
      if (parsed.full_refresh !== undefined) body.full_refresh = parsed.full_refresh;

      const response = await getFivetranApi().post(
        `/transformations/${parsed.transformation_id}/run`,
        body
      );
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  },
};
