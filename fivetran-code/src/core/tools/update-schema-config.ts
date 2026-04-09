import { z } from "zod";
import type { FivetranTool, ToolResult } from "./types.js";
import { getFivetranApi } from "../api/client.js";

const inputSchema = z.object({
  connection_id: z.string().describe("The connection ID to update schema config for"),
  schema_change_handling: z
    .enum(["ALLOW_ALL", "ALLOW_COLUMNS", "BLOCK_ALL"])
    .optional()
    .describe("How to handle new schemas/tables/columns"),
  schemas: z
    .record(z.unknown())
    .optional()
    .describe("Schema-level config: enable/disable schemas, tables, columns, set sync modes, hashing"),
});

export const updateSchemaConfigTool: FivetranTool = {
  name: "update_schema_config",
  permission: "write",
  definition: {
    name: "update_schema_config",
    description:
      "Update the schema configuration for a connection. Can enable/disable schemas, " +
      "tables, and columns, set sync modes (SOFT_DELETE, HISTORY, LIVE), " +
      "apply column hashing, and control schema change handling. Requires user confirmation. " +
      'Example schemas format: {"my_schema": {"enabled": true, "tables": {"my_table": {"enabled": true}}}, "other_schema": {"enabled": false}}',
    input_schema: {
      type: "object" as const,
      properties: {
        connection_id: { type: "string", description: "The connection to update" },
        schema_change_handling: {
          type: "string",
          enum: ["ALLOW_ALL", "ALLOW_COLUMNS", "BLOCK_ALL"],
          description: "How to handle new schemas/tables/columns",
        },
        schemas: {
          type: "object",
          description:
            'Nested schema config. Structure: {"schema_name": {"enabled": true/false, "tables": {"table_name": {"enabled": true/false}}}}. ' +
            "Each key is a schema name. Set enabled to true/false. Nest tables the same way.",
        },
      },
      required: ["connection_id"],
    },
  },
  inputSchema,
  async execute(input: Record<string, unknown>): Promise<ToolResult> {
    const parsed = inputSchema.parse(input);
    try {
      const body: Record<string, unknown> = {};
      if (parsed.schema_change_handling) body.schema_change_handling = parsed.schema_change_handling;
      if (parsed.schemas) body.schemas = parsed.schemas;

      const response = await getFivetranApi().patch(
        `/connections/${parsed.connection_id}/schemas`,
        body
      );
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  },
};
