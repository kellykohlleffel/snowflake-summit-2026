/**
 * Typed message protocol for the Cortex Code for VSCode extension.
 *
 * Two directions:
 *   - HostToWebview: extension host → webview (renders in the UI)
 *   - WebviewToHost: webview → extension host (user input, UI actions)
 *
 * Every message type documented below corresponds to an event the parser
 * emits (for HostToWebview) or a UI action the user takes (for WebviewToHost).
 */

// ============================================================================
// Host → Webview
// ============================================================================

/** Session started — the PTY is running and Cortex Code is ready. */
export interface ReadyMessage {
  type: "ready";
  /** Cortex Code binary version string (from `cortex code --version`) */
  version: string;
}

/** Incremental assistant text — append to the current assistant bubble. */
export interface StreamTextMessage {
  type: "streamText";
  text: string;
}

/** Mark the end of a streaming assistant message. */
export interface StreamEndMessage {
  type: "streamEnd";
}

/** A user message detected in the PTY output (echoed input). */
export interface UserBubbleMessage {
  type: "user";
  text: string;
}

/** Start of a tool call card. */
export interface ToolCallStartMessage {
  type: "toolCallStart";
  /** Tool name (e.g., "MCP__FIVETRAN-CODE__LIST_GROUPS") */
  name: string;
  /** Tool arguments if visible on the same line as the tool name */
  input?: string;
}

/** End of a tool call card — with final status and body text. */
export interface ToolCallEndMessage {
  type: "toolCallEnd";
  name: string;
  success: boolean;
  /** Accumulated body text (tool result) */
  body: string;
}

/** Cortex Code is asking the user for confirmation. */
export interface ConfirmationRequiredMessage {
  type: "confirmationRequired";
  prompt: string;
  /** Suggested response options, if any */
  options: string[];
}

/**
 * Unrecognized terminal output — the graceful degradation fallback.
 * Renders in a monospace "raw output" bubble so no content is ever lost.
 */
export interface RawOutputMessage {
  type: "rawOutput";
  text: string;
}

/**
 * Cortex is thinking/processing — show an inline indicator in the chat.
 * Sent by the host when the user submits a message. The indicator should
 * be dismissed when the first assistant text or tool call arrives (via
 * ThinkingEndMessage) or when the turn finishes.
 */
export interface ThinkingStartMessage {
  type: "thinkingStart";
}

/** Dismiss the thinking indicator (first content has arrived). */
export interface ThinkingEndMessage {
  type: "thinkingEnd";
}


/** PTY session was restarted. */
export interface SessionClearedMessage {
  type: "sessionCleared";
}

/** Chat was cleared (PTY still running). */
export interface ChatClearedMessage {
  type: "chatCleared";
}

/** PTY subprocess exited. */
export interface SessionExitedMessage {
  type: "sessionExited";
  code: number | null;
  signal: string | null;
}

/** Files were picked by the native file picker. */
export interface FilesSelectedMessage {
  type: "filesSelected";
  files: Array<{
    name: string;
    mimeType: string;
    sizeBytes: number;
    /** File content as base64 for binary, or raw text otherwise */
    data: string;
  }>;
}

/** Footer status tick. */
export interface FooterUpdateMessage {
  type: "footerUpdate";
  elapsedSeconds: number;
  status: "starting" | "running" | "idle" | "exited";
}

/**
 * Skill category as reported by `cortex skill list`.
 *
 *   - "project": personal skills in ~/.claude/skills/
 *   - "bundled": skills that ship with cortex itself
 *   - "plugin":  skills provided by installed cortex plugins
 *   - "remote":  skills pulled from a remote git repo
 *   - "stage":   skills stored in a Snowflake stage
 */
export type SkillCategory = "project" | "bundled" | "plugin" | "remote" | "stage";

/**
 * Metadata about the current session — populated from cortex's init event
 * plus `cortex skill list` output. Sent once per session start.
 */
export interface MetadataMessage {
  type: "metadata";
  /** Model name from cortex init event */
  model: string;
  /** Cortex binary version */
  version: string;
  /** All skills cortex has access to — project, bundled, plugin, remote, stage */
  skills: Array<{
    name: string;
    description: string;
    category: SkillCategory;
  }>;
  /** MCP server names available to cortex (from init event) */
  mcpServers: string[];
  /** Current pricing model (for cost estimate in the footer). */
  pricingModel?: string;
  /** Whether compact-response mode is on. */
  compactMode?: boolean;
  /** Snowflake connection info (from ~/.snowflake/connections.toml). */
  snowflakeConnection?: {
    connectionName: string;
    account: string;
    user: string;
    warehouse: string;
    database: string;
  };
  /** Instruction files loaded (e.g., ~/.claude/CLAUDE.md). */
  instructionFiles?: string[];
}

/** Compact-mode toggle broadcast. */
export interface CompactModeChangedMessage {
  type: "compactModeChanged";
  enabled: boolean;
}

/** Pricing-model switch broadcast. */
export interface PricingModelChangedMessage {
  type: "pricingModelChanged";
  model: string;
}

/**
 * Session usage metrics — accumulated from cortex's result events.
 * Drives the footer display (token count, context %, session cost, etc.)
 */
export interface UsageUpdateMessage {
  type: "usageUpdate";
  metrics: {
    totalInputTokens: number;
    totalOutputTokens: number;
    totalCacheCreationTokens: number;
    totalCacheReadTokens: number;
    totalTurns: number;
    totalDurationMs: number;
    contextUsagePercent: number;
    cacheHitRate: number;
    estimatedCostUsd: number;
  };
  model?: string;
}

export type HostToWebview =
  | ReadyMessage
  | StreamTextMessage
  | StreamEndMessage
  | UserBubbleMessage
  | ToolCallStartMessage
  | ToolCallEndMessage
  | ConfirmationRequiredMessage
  | RawOutputMessage
  | ThinkingStartMessage
  | ThinkingEndMessage
  | SessionClearedMessage
  | ChatClearedMessage
  | SessionExitedMessage
  | FilesSelectedMessage
  | FooterUpdateMessage
  | MetadataMessage
  | UsageUpdateMessage
  | CompactModeChangedMessage
  | PricingModelChangedMessage;

// ============================================================================
// Webview → Host
// ============================================================================

/** Webview signals it is ready for messages. */
export interface WebviewReadyMessage {
  type: "webviewReady";
}

/** User typed a message and hit Enter / Send. */
export interface UserInputMessage {
  type: "userInput";
  text: string;
  /** Execution mode — "confirm" (default), "auto", or "plan". */
  mode?: "confirm" | "auto" | "plan";
  /** File attachments to prepend or include with the message */
  attachments?: Array<{
    name: string;
    mimeType: string;
    sizeBytes: number;
    data: string;
  }>;
}

/** User clicked Allow or Deny on a confirmation card. */
export interface ConfirmationResponseMessage {
  type: "confirmationResponse";
  confirmed: boolean;
}

/** User clicked the Restart button. */
export interface RestartSessionMessage {
  type: "restartSession";
}

/** User clicked the Clear button. */
export interface ClearChatMessage {
  type: "clearChat";
}

/** User clicked the attachment button. */
export interface OpenFilePickerMessage {
  type: "openFilePicker";
}

/** User hit Escape or clicked Stop during a running command. */
export interface CancelRequestMessage {
  type: "cancelRequest";
}

/** Local webview commands that map to extension-host actions. */
export interface OpenDocsMessage {
  type: "openDocs";
}
export interface OpenSettingsMessage {
  type: "openSettings";
}
export interface OpenMemoryMessage {
  type: "openMemory";
}
export interface OpenTerminalMessage {
  type: "openTerminal";
}
export interface ToggleVoiceMessage {
  type: "toggleVoice";
}
export interface ToggleCompactMessage {
  type: "toggleCompact";
}
export interface ShowAccountMessage {
  type: "showAccount";
}
export interface SwitchPricingModelMessage {
  type: "switchPricingModel";
  model: string;
}
export interface ShowMcpMessage {
  type: "showMcp";
}
export interface UpgradeCortexMessage {
  type: "upgradeCortex";
}

export type WebviewToHost =
  | WebviewReadyMessage
  | UserInputMessage
  | ConfirmationResponseMessage
  | RestartSessionMessage
  | ClearChatMessage
  | OpenFilePickerMessage
  | CancelRequestMessage
  | OpenDocsMessage
  | OpenSettingsMessage
  | OpenMemoryMessage
  | OpenTerminalMessage
  | ToggleVoiceMessage
  | ToggleCompactMessage
  | ShowAccountMessage
  | SwitchPricingModelMessage
  | ShowMcpMessage
  | UpgradeCortexMessage;
