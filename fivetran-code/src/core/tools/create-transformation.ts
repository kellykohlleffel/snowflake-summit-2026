import { z } from "zod";
import type { FivetranTool, ToolResult } from "./types.js";
import { getFivetranApi } from "../api/client.js";

const inputSchema = z.object({
  dbt_project_id: z.string().describe("The dbt Core project ID for this transformation"),
  paused: z.boolean().optional().describe("Whether the transformation starts paused (default: false)"),
  trigger_type: z
    .enum(["ON_DEMAND", "SCHEDULED", "ON_CONNECTOR_SUCCESS"])
    .optional()
    .describe("When to trigger the transformation"),
  trigger_connector_ids: z
    .array(z.string())
    .optional()
    .describe("Connection IDs that trigger this transformation (for ON_CONNECTOR_SUCCESS)"),
  trigger_schedule: z.string().optional().describe("Cron schedule for SCHEDULED triggers"),
});

export const createTransformationTool: FivetranTool = {
  name: "create_transformation",
  permission: "write",
  definition: {
    name: "create_transformation",
    description:
      "Create a new dbt transformation linked to a dbt Core project. " +
      "Can be triggered on-demand, on a schedule, or after connector syncs. " +
      "Requires user confirmation.",
    input_schema: {
      type: "object" as const,
      properties: {
        dbt_project_id: { type: "string", description: "dbt Core project ID" },
        paused: { type: "boolean", description: "Start paused (default: false)" },
        trigger_type: {
          type: "string",
          enum: ["ON_DEMAND", "SCHEDULED", "ON_CONNECTOR_SUCCESS"],
          description: "Trigger type",
        },
        trigger_connector_ids: {
          type: "array",
          items: { type: "string" },
          description: "Connector IDs for ON_CONNECTOR_SUCCESS trigger",
        },
        trigger_schedule: { type: "string", description: "Cron schedule for SCHEDULED trigger" },
      },
      required: ["dbt_project_id"],
    },
  },
  inputSchema,
  async execute(input: Record<string, unknown>): Promise<ToolResult> {
    const parsed = inputSchema.parse(input);
    try {
      const body: Record<string, unknown> = {
        dbt_project_id: parsed.dbt_project_id,
        paused: parsed.paused ?? false,
      };
      if (parsed.trigger_type) {
        const trigger: Record<string, unknown> = { trigger_type: parsed.trigger_type };
        if (parsed.trigger_connector_ids) trigger.trigger_connector_ids = parsed.trigger_connector_ids;
        if (parsed.trigger_schedule) trigger.trigger_schedule = parsed.trigger_schedule;
        body.trigger = trigger;
      }

      const response = await getFivetranApi().post("/transformations", body);
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  },
};
