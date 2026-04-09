import { useState, useCallback } from "react";
import { Box, useApp, useInput } from "ink";
import { ChatHistory } from "./components/ChatHistory.js";
import { StreamingText } from "./components/StreamingText.js";
import { InputPrompt } from "./components/InputPrompt.js";
import { ToolCallDisplay } from "./components/ToolCallDisplay.js";
import { ConfirmPrompt } from "./components/ConfirmPrompt.js";
import { SetupFlow } from "./setup.js";
import { useAgent } from "./hooks/useAgent.js";
import type { AppConfig } from "../core/config/types.js";

type AppState = "setup" | "idle" | "processing";

interface Props {
  initialConfig: AppConfig | null;
  model: string;
}

export function App({ initialConfig, model }: Props) {
  const { exit } = useApp();
  const [config, setConfig] = useState<AppConfig | null>(initialConfig);
  const [appState, setAppState] = useState<AppState>(
    initialConfig ? "idle" : "setup"
  );

  // useAgent needs a config — we use a placeholder until setup completes
  const agent = useAgent({
    config: config ?? {
      fivetranApiKey: "",
      fivetranApiSecret: "",
      anthropicApiKey: "",
    },
    model,
  });

  const handleSetupComplete = useCallback((newConfig: AppConfig) => {
    setConfig(newConfig);
    setAppState("idle");
  }, []);

  // Escape key cancels the current request during processing
  useInput((_input, key) => {
    if (key.escape && appState === "processing") {
      agent.cancelRequest();
      setAppState("idle");
    }
  });

  const handleSubmit = useCallback(
    async (input: string) => {
      // Handle slash commands locally
      if (input === "/exit" || input === "/quit") {
        exit();
        return;
      }
      if (input === "/clear") {
        agent.clearHistory();
        return;
      }
      if (input === "/help") {
        agent.clearHistory();
        setAppState("processing");
        await agent.sendMessage(
          "Show me what you can do. List your capabilities and the slash commands available."
        );
        setAppState("idle");
        return;
      }
      if (input.startsWith("/apikey")) {
        const profiles = agent.apiKeyProfiles;
        if (profiles.length < 2) {
          agent.clearHistory();
          setAppState("processing");
          await agent.sendMessage(
            "Tell the user: No API key profiles configured. Add an `anthropicApiKeys` array to ~/.fivetran-code/config.json with objects like { \"label\": \"Personal\", \"key\": \"sk-ant-...\" }."
          );
          setAppState("idle");
          return;
        }
        const arg = input.slice("/apikey".length).trim();
        if (arg) {
          // Switch to named profile
          const success = agent.switchApiKey(arg);
          agent.clearHistory();
          setAppState("processing");
          await agent.sendMessage(
            success
              ? `Tell the user: Switched Claude API key to **${arg}**.`
              : `Tell the user: API key profile "${arg}" not found. Available: ${profiles.map((p) => p.label).join(", ")}`
          );
          setAppState("idle");
        } else {
          // Cycle to next profile
          const currentIdx = profiles.findIndex((p) => p.label === agent.activeApiKeyLabel);
          const nextIdx = (currentIdx + 1) % profiles.length;
          agent.switchApiKey(profiles[nextIdx].label);
          agent.clearHistory();
          setAppState("processing");
          await agent.sendMessage(
            `Tell the user: Switched Claude API key to **${profiles[nextIdx].label}**.`
          );
          setAppState("idle");
        }
        return;
      }

      if (!config) return;

      setAppState("processing");
      await agent.sendMessage(input);
      setAppState("idle");
    },
    [config, agent, exit]
  );

  return (
    <Box flexDirection="column">
      {appState === "setup" && (
        <SetupFlow onComplete={handleSetupComplete} />
      )}

      {appState !== "setup" && (
        <>
          {/* Static renders completed messages to scrollback — they persist
              and won't be cleared by Ink's dynamic area redraws.
              The welcome banner is printed to stdout before Ink starts,
              so it's NOT in this tree and won't re-render. */}
          <ChatHistory messages={agent.messages} />

          {agent.activeToolCall && (
            <ToolCallDisplay toolCall={agent.activeToolCall} />
          )}

          {agent.streamingText && (
            <StreamingText text={agent.streamingText} />
          )}

          {agent.pendingConfirmation && (
            <ConfirmPrompt
              toolName={agent.pendingConfirmation.name}
              input={agent.pendingConfirmation.input}
              onRespond={agent.respondToConfirmation}
            />
          )}

          {appState === "idle" && !agent.pendingConfirmation && (
            <InputPrompt onSubmit={handleSubmit} />
          )}
        </>
      )}
    </Box>
  );
}
