import { z } from "zod";
import type { FivetranTool, ToolResult } from "./types.js";
import { getFivetranApi } from "../api/client.js";

const inputSchema = z.object({
  connection_id: z.string().describe("The connection ID to reload schema for"),
});

export const reloadSchemaTool: FivetranTool = {
  name: "reload_schema",
  permission: "write",
  definition: {
    name: "reload_schema",
    description:
      "Reload (discover) the schema for a connection from the source. " +
      "This fetches all available schemas, tables, and columns from the data source " +
      "without starting a full data sync. Essential for new connectors that haven't " +
      "synced yet — call this BEFORE get_schema_config to ensure tables are available " +
      "for selection. Equivalent to clicking 'Fetch Schema' in the Fivetran UI.",
    input_schema: {
      type: "object" as const,
      properties: {
        connection_id: {
          type: "string",
          description: "The connection to reload schema for",
        },
      },
      required: ["connection_id"],
    },
  },
  inputSchema,
  async execute(input: Record<string, unknown>): Promise<ToolResult> {
    const parsed = inputSchema.parse(input);
    try {
      const response = await getFivetranApi().post(
        `/connections/${parsed.connection_id}/schemas/reload`
      );
      return { success: true, data: response.data };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  },
};
