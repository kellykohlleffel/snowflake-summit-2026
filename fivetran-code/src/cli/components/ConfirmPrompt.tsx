import React, { useState } from "react";
import { Box, Text } from "ink";
import TextInput from "ink-text-input";

interface Props {
  toolName: string;
  input: Record<string, unknown>;
  onRespond: (confirmed: boolean) => void;
}

export function ConfirmPrompt({ toolName, input, onRespond }: Props) {
  const [value, setValue] = useState("");

  const handleSubmit = (text: string) => {
    const answer = text.trim().toLowerCase();
    if (answer === "y" || answer === "yes" || answer === "") {
      onRespond(true);
    } else {
      onRespond(false);
    }
  };

  const inputPreview = JSON.stringify(input, null, 0);
  const truncated =
    inputPreview.length > 60
      ? inputPreview.substring(0, 57) + "..."
      : inputPreview;

  return (
    <Box flexDirection="column" marginLeft={1}>
      <Box gap={1}>
        <Text color="yellow" bold>
          {"Confirm:"}
        </Text>
        <Text>
          {toolName}
        </Text>
        <Text dimColor>{truncated}</Text>
      </Box>
      <Box>
        <Text color="yellow">{"  [Y/n] "}</Text>
        <TextInput value={value} onChange={setValue} onSubmit={handleSubmit} />
      </Box>
    </Box>
  );
}
