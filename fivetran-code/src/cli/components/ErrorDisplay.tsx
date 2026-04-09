import React from "react";
import { Box, Text } from "ink";

export function ErrorDisplay({ message }: { message: string }) {
  return (
    <Box marginLeft={1}>
      <Text color="red" bold>
        {"Error: "}
      </Text>
      <Text color="red">{message}</Text>
    </Box>
  );
}
