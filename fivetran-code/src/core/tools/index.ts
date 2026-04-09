import type { Tool as AnthropicTool } from "@anthropic-ai/sdk/resources/messages";
import type { FivetranTool } from "./types.js";
import { listGroupsTool } from "./list-groups.js";
import { getGroupDetailsTool } from "./get-group-details.js";
import { listConnectionsTool } from "./list-connections.js";
import { getConnectionTool } from "./get-connection.js";
import { syncConnectionTool } from "./sync-connection.js";
import { pauseConnectionTool } from "./pause-connection.js";
import { resumeConnectionTool } from "./resume-connection.js";
import { listDestinationsTool } from "./list-destinations.js";
import { getDestinationTool } from "./get-destination.js";
import { listUsersTool } from "./list-users.js";
import { createConnectionTool } from "./create-connection.js";
import { deleteConnectionTool } from "./delete-connection.js";
import { getSchemaConfigTool } from "./get-schema-config.js";
import { updateSchemaConfigTool } from "./update-schema-config.js";
import { listTransformationsTool } from "./list-transformations.js";
import { getTransformationTool } from "./get-transformation.js";
import { createTransformationTool } from "./create-transformation.js";
import { triggerTransformationTool } from "./trigger-transformation.js";
import { testConnectionTool } from "./test-connection.js";
import { openConnectorSetupTool } from "./open-connector-setup.js";
import { getConnectorMetadataTool } from "./get-connector-metadata.js";
import { reloadSchemaTool } from "./reload-schema.js";
import { approveCertificateTool } from "./approve-certificate.js";
import { approveFingerprintTool } from "./approve-fingerprint.js";
import { setupPostgresqlConnectionTool } from "./setup-postgresql-connection.js";
import { queryCortexAgentTool } from "./query-cortex-agent.js";

/**
 * All registered Fivetran tools.
 * Both frontends (CLI + VSCode) pick up tools automatically from here.
 */
const fivetranTools: FivetranTool[] = [
  // Read tools (auto-execute)
  listGroupsTool,
  getGroupDetailsTool,
  listConnectionsTool,
  getConnectionTool,
  testConnectionTool,
  openConnectorSetupTool,
  getConnectorMetadataTool,
  reloadSchemaTool,
  listDestinationsTool,
  getDestinationTool,
  listUsersTool,
  getSchemaConfigTool,
  listTransformationsTool,
  getTransformationTool,
  // Write tools (require user confirmation)
  syncConnectionTool,
  pauseConnectionTool,
  resumeConnectionTool,
  createConnectionTool,
  deleteConnectionTool,
  updateSchemaConfigTool,
  createTransformationTool,
  triggerTransformationTool,
  approveCertificateTool,
  approveFingerprintTool,
  setupPostgresqlConnectionTool,
  // Snowflake Cortex Agent (streaming — auto-execute)
  queryCortexAgentTool,
];

/** Dynamic tools added at runtime (e.g., from MCP servers). */
let dynamicTools: FivetranTool[] = [];

export const toolRegistry = {
  /** Get tool definitions formatted for the Claude API. */
  getToolDefinitions(): AnthropicTool[] {
    return [...fivetranTools, ...dynamicTools].map((t) => t.definition);
  },

  /** Look up a tool by name. */
  getTool(name: string): FivetranTool | undefined {
    return [...fivetranTools, ...dynamicTools].find((t) => t.name === name);
  },

  /** Get all registered tools. */
  getAllTools(): FivetranTool[] {
    return [...fivetranTools, ...dynamicTools];
  },

  /** Register dynamic tools (e.g., from MCP servers) at runtime. */
  registerDynamicTools(tools: FivetranTool[]): void {
    dynamicTools = tools;
  },
};
