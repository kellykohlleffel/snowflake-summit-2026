import { useState, useCallback, useRef, useEffect } from "react";
import { createClaudeClient } from "../../core/agent/claude-client.js";
import { Conversation } from "../../core/agent/conversation.js";
import { runAgentLoop, type AgentCallbacks } from "../../core/agent/loop.js";
import type { SystemPromptOptions } from "../../core/agent/system-prompt.js";
import { SessionTracker } from "../../core/agent/usage-tracker.js";
import { initFivetranApi } from "../../core/api/client.js";
import { initSnowflakeConfig } from "../../core/tools/query-cortex-agent.js";
import { mcpManager } from "../../core/mcp/index.js";
import { toolRegistry } from "../../core/tools/index.js";
import { discoverSkills, getAllSkills, loadSkillContent } from "../../core/skills/index.js";
import { loadPreferences } from "../../core/preferences/loader.js";
import type { Message } from "../components/ChatMessage.js";
import type { ToolCall } from "../components/ToolCallDisplay.js";
import type { AppConfig, ApiKeyProfile } from "../../core/config/types.js";
import { MAX_TOOL_ROUNDS } from "../../core/utils/constants.js";

interface ConfirmationRequest {
  name: string;
  input: Record<string, unknown>;
  resolve: (confirmed: boolean) => void;
}

export function useAgent({
  config,
  model,
}: {
  config: AppConfig;
  model: string;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [streamingText, setStreamingText] = useState<string | null>(null);
  const [activeToolCall, setActiveToolCall] = useState<ToolCall | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [pendingConfirmation, setPendingConfirmation] =
    useState<ConfirmationRequest | null>(null);
  const [toolStreamText, setToolStreamText] = useState<string | null>(null);

  const conversationRef = useRef(new Conversation());
  const clientRef = useRef(createClaudeClient(config.anthropicApiKey, config.anthropicAuthToken));
  const initializedRef = useRef(false);
  const promptOptionsRef = useRef<SystemPromptOptions>({});
  const abortControllerRef = useRef<AbortController | null>(null);
  const sessionTrackerRef = useRef(new SessionTracker(model));

  // API key profile tracking
  const apiKeyProfilesRef = useRef<ApiKeyProfile[]>(config.anthropicApiKeys ?? []);
  const [activeApiKeyLabel, setActiveApiKeyLabel] = useState<string>(() => {
    const profiles = config.anthropicApiKeys ?? [];
    if (profiles.length === 0) return "";
    const match = profiles.find((p) => p.key === config.anthropicApiKey);
    return match?.label ?? profiles[0].label;
  });

  // Initialize Fivetran API, MCP servers, skills, and preferences
  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    initFivetranApi(config.fivetranApiKey, config.fivetranApiSecret);
    if (config.snowflakeAccount && config.snowflakePatToken) {
      initSnowflakeConfig(config.snowflakeAccount, config.snowflakePatToken);
    }

    // Initialize MCP, skills, and preferences in background
    (async () => {
      const [, , preferences] = await Promise.all([
        mcpManager.initialize().then(() => {
          toolRegistry.registerDynamicTools(mcpManager.getTools());
        }),
        discoverSkills(),
        loadPreferences(process.cwd()),
      ]);

      promptOptionsRef.current = {
        mcpServers: mcpManager.getConnectedServerNames(),
        skills: getAllSkills(),
        preferences,
      };
    })().catch(() => {
      // Non-blocking — MCP/skills/preferences failures don't prevent usage
    });
  }, [config]);

  const sendMessage = useCallback(
    async (userInput: string) => {
      // Check for skill slash commands (e.g., /dbt-project-builder ...)
      let processedInput = userInput;
      if (userInput.startsWith("/")) {
        const spaceIdx = userInput.indexOf(" ");
        const skillName = spaceIdx > 0
          ? userInput.slice(1, spaceIdx)
          : userInput.slice(1);
        const skillContent = await loadSkillContent(skillName);
        if (skillContent) {
          const userRequest = spaceIdx > 0 ? userInput.slice(spaceIdx + 1) : "";
          const effectiveRequest = userRequest || "Start. Show the roadmap and ask which option to use.";
          processedInput = `[Skill: ${skillName}]\n\n${skillContent}\n\nUser request: ${effectiveRequest}`;
        }
      }

      // Add user message to display
      setMessages((prev) => [...prev, { role: "user", content: userInput }]);
      setIsProcessing(true);
      setStreamingText("");

      // Create a new AbortController for this request
      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      const callbacks: AgentCallbacks = {
        onStreamText: (text) => {
          setStreamingText((prev) => (prev ?? "") + text);
        },
        onStreamEnd: () => {
          // Move streaming text into committed messages (rendered via <Static>)
          setStreamingText((currentStreaming) => {
            if (currentStreaming) {
              setMessages((msgs) => [
                ...msgs,
                { role: "assistant", content: currentStreaming },
              ]);
            }
            return null;
          });
        },
        onToolCallStart: (name, input) => {
          setActiveToolCall({ name, input });
          setToolStreamText(null);
        },
        onToolProgress: (name, text) => {
          setToolStreamText((prev) => (prev ?? "") + text);
        },
        onToolCallEnd: (name, result) => {
          setActiveToolCall(null);
          setToolStreamText(null);
          setMessages((prev) => [
            ...prev,
            {
              role: "tool",
              toolName: name,
              content: result.success
                ? "Completed successfully"
                : `Error: ${result.error}`,
            },
          ]);
        },
        onConfirmationRequired: (name, input) => {
          return new Promise<boolean>((resolve) => {
            setPendingConfirmation({ name, input, resolve });
          });
        },
        onComplete: () => {
          setIsProcessing(false);
          setStreamingText(null);
        },
        onError: (error) => {
          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: `Error: ${error.message}` },
          ]);
          setIsProcessing(false);
          setStreamingText(null);
        },
      };

      sessionTrackerRef.current.setModel(model);

      await runAgentLoop(
        clientRef.current,
        conversationRef.current,
        processedInput,
        callbacks,
        {
          model,
          maxToolRounds: MAX_TOOL_ROUNDS,
          promptOptions: promptOptionsRef.current,
          signal: abortController.signal,
          sessionTracker: sessionTrackerRef.current,
        }
      );

      abortControllerRef.current = null;
    },
    [config, model]
  );

  const respondToConfirmation = useCallback((confirmed: boolean) => {
    if (pendingConfirmation) {
      pendingConfirmation.resolve(confirmed);
      setPendingConfirmation(null);
    }
  }, [pendingConfirmation]);

  const cancelRequest = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsProcessing(false);
      setStreamingText(null);
      setActiveToolCall(null);
      setPendingConfirmation(null);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "(Cancelled by user)" },
      ]);
    }
  }, []);

  const clearHistory = useCallback(() => {
    setMessages([]);
    conversationRef.current.clear();
    sessionTrackerRef.current.reset();
  }, []);

  const switchApiKey = useCallback((label: string): boolean => {
    const profile = apiKeyProfilesRef.current.find((p) => p.label === label);
    if (!profile) return false;
    clientRef.current = createClaudeClient(profile.key, config.anthropicAuthToken);
    setActiveApiKeyLabel(label);
    return true;
  }, [config.anthropicAuthToken]);

  return {
    messages,
    streamingText,
    activeToolCall,
    isProcessing,
    pendingConfirmation,
    sendMessage,
    respondToConfirmation,
    cancelRequest,
    clearHistory,
    switchApiKey,
    apiKeyProfiles: apiKeyProfilesRef.current,
    activeApiKeyLabel,
    toolStreamText,
  };
}
