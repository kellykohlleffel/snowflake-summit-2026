import type { Tool as AnthropicTool } from "@anthropic-ai/sdk/resources/messages";
import type { z } from "zod";

/** Result returned by every tool execution. */
export interface ToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

/** Callback for tools that stream progressive output during execution. */
export type ToolProgressCallback = (text: string) => void;

/**
 * Every Fivetran tool implements this interface.
 *
 * - `permission`: "read" tools auto-execute; "write" tools require user confirmation.
 * - `definition`: The JSON Schema sent to Claude as a tool definition.
 * - `inputSchema`: Zod schema for runtime validation of tool inputs.
 * - `execute`: Performs the actual Fivetran API call. Optional `onProgress` callback
 *   allows tools to stream progressive output to the UI during execution.
 */
export interface FivetranTool {
  name: string;
  permission: "read" | "write";
  definition: AnthropicTool;
  inputSchema: z.ZodSchema;
  execute(input: Record<string, unknown>, onProgress?: ToolProgressCallback): Promise<ToolResult>;
}
