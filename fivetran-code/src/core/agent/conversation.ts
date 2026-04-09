import type {
  MessageParam,
  ContentBlock,
  ContentBlockParam,
  ToolResultBlockParam,
} from "@anthropic-ai/sdk/resources/messages";

/**
 * Manages the full message array sent to Claude on each turn.
 * Handles the correct structure for multi-turn tool use conversations.
 */
export class Conversation {
  private messages: MessageParam[] = [];

  /** Accept plain text or multimodal content blocks (images, documents, text). */
  addUserMessage(content: string | ContentBlockParam[]): void {
    this.messages.push({ role: "user", content });
  }

  addAssistantMessage(content: ContentBlock[]): void {
    this.messages.push({ role: "assistant", content });
  }

  addToolResults(results: ToolResultBlockParam[]): void {
    this.messages.push({ role: "user", content: results });
  }

  getMessages(): MessageParam[] {
    return [...this.messages];
  }

  clear(): void {
    this.messages = [];
  }

  get length(): number {
    return this.messages.length;
  }
}
