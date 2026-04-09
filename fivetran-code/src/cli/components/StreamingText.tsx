import React from "react";
import { Box, Text } from "ink";

export function StreamingText({ text }: { text: string }) {
  return (
    <Box marginLeft={1}>
      <Text color="green">{text}</Text>
      <Text color="gray">{"_"}</Text>
    </Box>
  );
}
