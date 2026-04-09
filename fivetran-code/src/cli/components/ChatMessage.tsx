import { Box, Text } from "ink";

export interface Message {
  role: "user" | "assistant" | "tool";
  content: string;
  toolName?: string;
}

export function ChatMessage({ message }: { message: Message }) {
  if (message.role === "user") {
    return (
      <Box>
        <Text bold color="cyan">{"You > "}</Text>
        <Text>{message.content}</Text>
      </Box>
    );
  }

  if (message.role === "tool") {
    return (
      <Box flexDirection="column">
        <Text dimColor italic>
          {"  [" + message.toolName + "]"}
        </Text>
      </Box>
    );
  }

  // assistant
  return (
    <Box flexDirection="column">
      <Text bold color="green">{"Fivetran Code"}</Text>
      <Box marginLeft={1}>
        <Text color="green">{message.content}</Text>
      </Box>
    </Box>
  );
}
