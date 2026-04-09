import React from "react";
import { Box, Text } from "ink";
import { VERSION } from "../../core/utils/constants.js";

export function WelcomeBanner() {
  return (
    <Box flexDirection="column" marginBottom={1}>
      <Text bold color="blue">
        {"  ___ _         _                    ___         _     "}
      </Text>
      <Text bold color="blue">
        {" | __(_)_ _____| |_ _ _ __ _ _ _   / __|___  __| |___ "}
      </Text>
      <Text bold color="blue">
        {" | _|| \\ V / -_)  _| '_/ _` | ' \\ | (__/ _ \\/ _` / -_)"}
      </Text>
      <Text bold color="blue">
        {" |_| |_|\\_/\\___|\\__|_| \\__,_|_||_| \\___\\___/\\__,_\\___|"}
      </Text>
      <Text dimColor>
        {"  v" + VERSION + " — Conversational Fivetran management"}
      </Text>
      <Text dimColor>
        {'  Powered by Claude. Type a question or /help. /exit to quit.'}
      </Text>
    </Box>
  );
}
