import React, { useState } from "react";
import { Box, Text } from "ink";
import TextInput from "ink-text-input";

interface Props {
  onSubmit: (text: string) => void;
}

export function InputPrompt({ onSubmit }: Props) {
  const [value, setValue] = useState("");

  const handleSubmit = (text: string) => {
    if (text.trim()) {
      onSubmit(text.trim());
      setValue("");
    }
  };

  return (
    <Box marginTop={1}>
      <Text bold color="cyan">
        {"fivetran > "}
      </Text>
      <TextInput value={value} onChange={setValue} onSubmit={handleSubmit} />
    </Box>
  );
}
