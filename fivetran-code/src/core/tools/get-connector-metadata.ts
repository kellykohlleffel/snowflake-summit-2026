import { z } from "zod";
import type { FivetranTool, ToolResult } from "./types.js";
import { getFivetranApi } from "../api/client.js";

const inputSchema = z.object({
  service: z
    .string()
    .optional()
    .describe(
      "The connector service type (e.g., 'salesforce', 'google_cloud_postgresql'). " +
      "If omitted, returns a list of all available connector types."
    ),
});

export const getConnectorMetadataTool: FivetranTool = {
  name: "get_connector_metadata",
  permission: "read",
  definition: {
    name: "get_connector_metadata",
    description:
      "Get metadata about Fivetran connector types. " +
      "When called with a specific service (e.g., 'salesforce'), returns the connector's " +
      "config schema including required fields, auth method, and setup parameters. " +
      "When called without a service, returns a list of all available connector types. " +
      "Use this BEFORE creating a connector to learn what config fields are needed.",
    input_schema: {
      type: "object" as const,
      properties: {
        service: {
          type: "string",
          description:
            "Connector service type (e.g., 'salesforce', 'google_cloud_postgresql'). Omit to list all types.",
        },
      },
      required: [],
    },
  },
  inputSchema,
  async execute(input: Record<string, unknown>): Promise<ToolResult> {
    const parsed = inputSchema.parse(input);
    try {
      const path = parsed.service
        ? `/metadata/connector-types/${parsed.service}`
        : "/metadata/connector-types";
      const response = await getFivetranApi().get(path);
      return { success: true, data: response.data };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  },
};
