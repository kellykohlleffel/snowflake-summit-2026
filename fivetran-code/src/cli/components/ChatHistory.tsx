import React from "react";
import { Static, Box } from "ink";
import { ChatMessage, type Message } from "./ChatMessage.js";

interface Props {
  messages: Message[];
}

/**
 * Renders completed messages using Ink's <Static> component.
 * Static items are rendered once and never re-rendered, preventing
 * terminal flicker as new messages stream in.
 */
export function ChatHistory({ messages }: Props) {
  return (
    <Static items={messages}>
      {(message, index) => (
        <Box key={index} marginBottom={0}>
          <ChatMessage message={message} />
        </Box>
      )}
    </Static>
  );
}
