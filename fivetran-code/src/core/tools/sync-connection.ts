import { z } from "zod";
import type { FivetranTool, ToolResult } from "./types.js";
import { getFivetranApi } from "../api/client.js";

const inputSchema = z.object({
  connection_id: z.string().describe("The connection ID to sync"),
});

export const syncConnectionTool: FivetranTool = {
  name: "trigger_sync",
  permission: "write",
  definition: {
    name: "trigger_sync",
    description:
      "Trigger a data sync for a connection. " +
      "Works for both new connectors (initial sync) and existing connectors (incremental sync). " +
      "Uses force mode to ensure the sync starts. Requires user confirmation.",
    input_schema: {
      type: "object" as const,
      properties: {
        connection_id: { type: "string", description: "The connection to sync" },
      },
      required: ["connection_id"],
    },
  },
  inputSchema,
  async execute(input: Record<string, unknown>): Promise<ToolResult> {
    const parsed = inputSchema.parse(input);
    const api = getFivetranApi();
    try {
      // Unpause the connection first — new connectors are paused by default
      // and a sync triggered while paused sits in the scheduler queue until unpaused.
      await api.patch(`/connections/${parsed.connection_id}`, { paused: false });

      // POST /sync with force: true triggers the sync immediately.
      const response = await api.post(
        `/connections/${parsed.connection_id}/sync`,
        { force: true }
      );

      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  },
};
