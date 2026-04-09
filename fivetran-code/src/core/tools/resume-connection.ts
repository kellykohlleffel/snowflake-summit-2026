import { z } from "zod";
import type { FivetranTool, ToolResult } from "./types.js";
import { getFivetranApi } from "../api/client.js";

const inputSchema = z.object({
  connection_id: z.string().describe("The connection ID to resume"),
});

export const resumeConnectionTool: FivetranTool = {
  name: "resume_connection",
  permission: "write",
  definition: {
    name: "resume_connection",
    description:
      "Resume a paused connection so it starts syncing data again according to its schedule. " +
      "Requires user confirmation before executing.",
    input_schema: {
      type: "object" as const,
      properties: {
        connection_id: { type: "string", description: "The connection to resume" },
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
        { paused: false }
      );
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  },
};
