import { z } from "zod";
import type { FivetranTool, ToolResult } from "./types.js";
import { getFivetranApi } from "../api/client.js";
import type { Destination } from "../api/types.js";

const inputSchema = z.object({
  destination_id: z.string().describe("The destination identifier"),
});

export const getDestinationTool: FivetranTool = {
  name: "get_destination_details",
  permission: "read",
  definition: {
    name: "get_destination_details",
    description:
      "Get detailed information about a specific destination, " +
      "including its type (Snowflake, BigQuery, etc.), region, and setup status.",
    input_schema: {
      type: "object" as const,
      properties: {
        destination_id: { type: "string", description: "The destination identifier" },
      },
      required: ["destination_id"],
    },
  },
  inputSchema,
  async execute(input: Record<string, unknown>): Promise<ToolResult> {
    const parsed = inputSchema.parse(input);
    try {
      const response = await getFivetranApi().get<Destination>(
        `/destinations/${parsed.destination_id}`
      );
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  },
};
