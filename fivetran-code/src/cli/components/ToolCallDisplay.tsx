import React from "react";
import { Box, Text } from "ink";
import { Spinner } from "@inkjs/ui";

export interface ToolCall {
  name: string;
  input: Record<string, unknown>;
}

export function ToolCallDisplay({ toolCall }: { toolCall: ToolCall }) {
  const inputPreview = JSON.stringify(toolCall.input, null, 0);
  const truncated =
    inputPreview.length > 80
      ? inputPreview.substring(0, 77) + "..."
      : inputPreview;

  return (
    <Box gap={1} marginLeft={1}>
      <Spinner label="" />
      <Text color="yellow" bold>
        {toolCall.name}
      </Text>
      <Text dimColor>{truncated}</Text>
    </Box>
  );
}
