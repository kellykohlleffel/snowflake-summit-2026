import { z } from "zod";
import type { FivetranTool, ToolResult } from "./types.js";
import { getFivetranApi } from "../api/client.js";

const inputSchema = z.object({
  connection_id: z.string().describe("The connection ID to pause"),
});

export const pauseConnectionTool: FivetranTool = {
  name: "pause_connection",
  permission: "write",
  definition: {
    name: "pause_connection",
    description:
      "Pause a connection so it stops syncing data. " +
      "The connection will remain paused until explicitly resumed. " +
      "Requires user confirmation before executing.",
    input_schema: {
      type: "object" as const,
      properties: {
        connection_id: { type: "string", description: "The connection to pause" },
      },
      required: ["connection_id"],
    },
  },
  inputSchema,
  async execute(input: Record<string, unknown>): Promise<ToolResult> {
    const parsed = inputSchema.parse(input);
    try {
      const response = await getFivetranApi().patch(
        `/connections/${parsed.connection_id}`,
        { paused: true }
      );
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  },
};
