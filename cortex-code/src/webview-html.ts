import type * as vscode from "vscode";
import { BRAND } from "./utils/brand.js";

export interface WebviewHtmlOptions {
  webview: vscode.Webview;
}

/**
 * Generate the full HTML for the Cortex Code for VSCode webview.
 *
 * Ports the visual design patterns from Fivetran Code's
 * src/vscode/webview-html.ts (chat bubbles, tool call cards, confirmation
 * cards, footer, slash menu chrome) into a fresh implementation here.
 *
 * The content area renders parsed events from the Cortex Code PTY subprocess
 * as Fivetran Code-style chat messages. Unrecognized output falls through
 * to a monospace "raw output" bubble (.raw-output class) so nothing is lost.
 */
export function getWebviewHtml(_options: WebviewHtmlOptions): string {
  const nonce = getNonce();

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}'; img-src data:;">
  <title>${escapeHtml(BRAND.headerLabel)}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      color: var(--vscode-foreground);
      background: var(--vscode-sideBar-background);
      display: flex;
      flex-direction: column;
      height: 100vh;
      overflow: hidden;
    }

    .header {
      padding: 12px 16px;
      border-bottom: 1px solid var(--vscode-panel-border);
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .header h2 {
      font-size: 13px;
      font-weight: 600;
      color: var(--vscode-foreground);
    }
    .header .brand-accent {
      display: inline-block;
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: ${BRAND.primaryColor};
    }
    .header .badge {
      font-size: 10px;
      padding: 2px 6px;
      border-radius: 10px;
      background: var(--vscode-badge-background);
      color: var(--vscode-badge-foreground);
    }
    .header .spacer { flex: 1; }
    .mcp-status {
      display: flex;
      align-items: center;
      gap: 4px;
      font-size: 11px;
      color: var(--vscode-descriptionForeground);
      cursor: pointer;
      position: relative;
    }
    .mcp-status .mcp-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: var(--vscode-charts-green);
    }
    .mcp-tooltip {
      display: none;
      position: absolute;
      top: 100%;
      right: 0;
      margin-top: 6px;
      padding: 8px 12px;
      background: var(--vscode-editorWidget-background, var(--vscode-editor-background));
      border: 1px solid var(--vscode-editorWidget-border, var(--vscode-panel-border));
      border-radius: 6px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      z-index: 100;
      white-space: nowrap;
      font-size: 11px;
    }
    .mcp-tooltip.visible { display: block; }
    .mcp-tooltip .mcp-server-item {
      padding: 2px 0;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .mcp-tooltip .mcp-server-dot {
      width: 5px;
      height: 5px;
      border-radius: 50%;
      background: var(--vscode-charts-green);
    }
    .messages {
      flex: 1;
      overflow-y: auto;
      padding: 12px 16px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .message {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .message .role {
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .message.user .role { color: var(--vscode-charts-green); }
    .message.assistant .role { color: ${BRAND.primaryColor}; }
    .message .content {
      padding: 8px 12px;
      border-radius: 6px;
      line-height: 1.5;
      white-space: pre-wrap;
      word-wrap: break-word;
    }
    .message.user .content {
      background: var(--vscode-input-background);
      border: 1px solid var(--vscode-input-border);
    }
    .message.assistant .content {
      background: var(--vscode-editor-background);
    }

    /* Tool call cards — ported from Fivetran Code's .tool-card style */
    .tool-card {
      margin: 4px 0;
      padding: 8px 12px;
      border-radius: 4px;
      border-left: 3px solid var(--vscode-charts-yellow);
      background: var(--vscode-editor-background);
      font-size: 12px;
    }
    .tool-card .tool-name {
      font-weight: 600;
      color: var(--vscode-charts-yellow);
    }
    .tool-card .tool-input {
      color: var(--vscode-descriptionForeground);
      font-family: var(--vscode-editor-font-family);
      font-size: 11px;
      margin-top: 4px;
    }
    .tool-card.success {
      border-left-color: var(--vscode-charts-green);
    }
    .tool-card.success .tool-name {
      color: var(--vscode-charts-green);
    }
    .tool-card.error {
      border-left-color: var(--vscode-errorForeground);
    }
    .tool-card.error .tool-name {
      color: var(--vscode-errorForeground);
    }
    .tool-card .spinner {
      display: inline-block;
      animation: spin 1s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    /* Confirmation cards — ported from Fivetran Code */
    .confirm-card {
      margin: 4px 0;
      padding: 12px;
      border-radius: 4px;
      border: 1px solid var(--vscode-charts-yellow);
      background: var(--vscode-editor-background);
    }
    .confirm-card .title {
      font-weight: 600;
      color: var(--vscode-charts-yellow);
      margin-bottom: 8px;
    }
    .confirm-card .prompt {
      font-size: 12px;
      white-space: pre-wrap;
      line-height: 1.5;
      font-family: var(--vscode-editor-font-family);
      background: var(--vscode-textCodeBlock-background);
      padding: 6px 8px;
      border-radius: 3px;
      max-height: 300px;
      overflow-y: auto;
    }
    .confirm-card .actions {
      display: flex;
      gap: 8px;
      margin-top: 12px;
    }
    .confirm-card button {
      padding: 4px 14px;
      border-radius: 4px;
      border: 1px solid var(--vscode-button-border, transparent);
      cursor: pointer;
      font-size: 12px;
      font-family: var(--vscode-font-family);
    }
    .confirm-card .btn-allow {
      background: ${BRAND.primaryColor};
      color: #fff;
      border-color: ${BRAND.primaryColor};
    }
    .confirm-card .btn-deny {
      background: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
    }

    /* Thinking indicator — shown after user sends a message, dismissed
       when the first content arrives from cortex (stream delta, tool call,
       or full assistant message). Pulses gently to signal "working". */
    .thinking-indicator {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      margin: 2px 0;
      color: var(--vscode-descriptionForeground);
      font-size: 12px;
      font-style: italic;
    }
    .thinking-indicator .thinking-dot {
      display: inline-block;
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: ${BRAND.primaryColor};
      animation: thinking-pulse 1.2s ease-in-out infinite;
    }
    .thinking-indicator .thinking-dot:nth-child(2) {
      animation-delay: 0.15s;
    }
    .thinking-indicator .thinking-dot:nth-child(3) {
      animation-delay: 0.3s;
    }
    @keyframes thinking-pulse {
      0%, 60%, 100% { opacity: 0.25; }
      30% { opacity: 1; }
    }

    /* Raw output bubble — the graceful degradation fallback.
       Styled after Fivetran Code's .tool-stream element (dark, monospace,
       scrollable). Any content the parser can't classify lands here. */
    .raw-output {
      margin: 2px 0;
      padding: 8px 12px;
      background: var(--vscode-textCodeBlock-background);
      border-left: 2px solid var(--vscode-descriptionForeground);
      border-radius: 3px;
      font-family: var(--vscode-editor-font-family);
      font-size: 11px;
      line-height: 1.5;
      white-space: pre;
      color: var(--vscode-editor-foreground);
      opacity: 0.85;
      max-height: 400px;
      overflow-y: auto;
    }


    /* Attachment chips */
    .attachment-chips {
      display: none;
      padding: 4px 16px;
      gap: 6px;
      flex-wrap: wrap;
    }
    .attachment-chips.visible { display: flex; }
    .attachment-chip {
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 3px 8px;
      border-radius: 12px;
      background: var(--vscode-badge-background);
      color: var(--vscode-badge-foreground);
      font-size: 11px;
      max-width: 200px;
    }
    .attachment-chip .chip-name {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .attachment-chip .chip-size {
      font-size: 9px;
      opacity: 0.7;
      flex-shrink: 0;
    }
    .attachment-chip .chip-remove {
      cursor: pointer;
      opacity: 0.6;
      font-size: 13px;
      line-height: 1;
      flex-shrink: 0;
    }
    .attachment-chip .chip-remove:hover { opacity: 1; }

    /* Footer status bar */
    .status-footer {
      display: flex;
      align-items: center;
      padding: 3px 16px;
      font-size: 10px;
      color: var(--vscode-descriptionForeground);
      border-top: 1px solid var(--vscode-panel-border);
      gap: 12px;
      min-height: 18px;
    }
    .status-footer .status-item {
      display: flex;
      align-items: center;
      gap: 4px;
    }
    .status-footer .status-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: var(--vscode-charts-green);
    }
    .status-footer .status-dot.exited {
      background: var(--vscode-errorForeground);
    }
    .status-footer .status-dot.starting {
      background: var(--vscode-charts-yellow);
    }
    .status-footer .spacer { flex: 1; }

    /* Input area */
    .input-area {
      border-top: 1px solid var(--vscode-panel-border);
      display: flex;
      flex-direction: column;
    }
    .input-row {
      display: flex;
      align-items: flex-end;
      gap: 6px;
      padding: 10px 12px;
    }
    .input-area textarea {
      width: 100%;
      padding: 8px 12px;
      border-radius: 8px;
      border: 1px solid var(--vscode-input-border);
      background: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      line-height: 1.4;
      outline: none;
      resize: none;
      min-height: 36px;
      max-height: 200px;
      overflow-y: hidden;
    }
    .input-area textarea:focus {
      border-color: ${BRAND.primaryColor};
    }
    .input-area textarea:disabled {
      opacity: 0.5;
    }
    .input-wrapper {
      position: relative;
      flex: 1;
    }
    .attach-btn, .send-btn {
      width: 32px;
      height: 32px;
      border-radius: 6px;
      border: none;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0;
      flex-shrink: 0;
    }
    .attach-btn {
      background: transparent;
      color: var(--vscode-descriptionForeground);
    }
    .attach-btn:hover {
      color: var(--vscode-foreground);
      background: var(--vscode-list-hoverBackground);
    }
    .send-btn {
      background: ${BRAND.primaryColor};
      color: #fff;
    }
    .send-btn:hover {
      background: ${BRAND.accentColor};
    }
    .send-btn:disabled {
      opacity: 0.4;
      cursor: default;
    }

    /* Mode selector */
    .input-toolbar {
      display: flex;
      padding: 4px 12px 0;
    }
    .mode-selector {
      display: flex;
      gap: 2px;
    }
    .mode-btn {
      padding: 2px 8px;
      border-radius: 10px;
      border: none;
      background: transparent;
      color: var(--vscode-descriptionForeground);
      font-size: 11px;
      cursor: pointer;
      font-family: var(--vscode-font-family);
    }
    .mode-btn:hover {
      background: var(--vscode-list-hoverBackground);
    }
    .mode-btn.active {
      color: var(--vscode-textLink-foreground);
      background: color-mix(in srgb, var(--vscode-textLink-foreground) 15%, transparent);
    }

    /* Mic / voice button */
    .mic-btn {
      width: 28px;
      height: 28px;
      border-radius: 4px;
      border: none;
      background: transparent;
      color: var(--vscode-descriptionForeground);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0;
      flex-shrink: 0;
      margin-bottom: 2px;
      transition: color 0.15s, background 0.15s;
    }
    .mic-btn:hover {
      color: var(--vscode-foreground);
      background: var(--vscode-list-hoverBackground);
    }
    .mic-btn.recording {
      color: var(--vscode-errorForeground);
      background: color-mix(in srgb, var(--vscode-errorForeground) 12%, transparent);
      animation: mic-pulse 1.5s ease-in-out infinite;
    }
    @keyframes mic-pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }

    /* Voice status text */
    .voice-status {
      display: none;
      padding: 2px 12px;
      font-size: 10px;
      color: var(--vscode-errorForeground);
    }
    .voice-status.visible { display: block; }

    /* Welcome state */
    .welcome {
      text-align: center;
      padding: 24px 16px;
      color: var(--vscode-descriptionForeground);
    }
    .welcome h3 {
      color: var(--vscode-foreground);
      margin-bottom: 8px;
    }
    .welcome p {
      font-size: 12px;
      line-height: 1.6;
    }
    .welcome .welcome-hint {
      margin-top: 8px;
      font-size: 11px;
      opacity: 0.7;
    }
    .connection-info {
      margin: 10px auto;
      padding: 10px 16px;
      background: var(--vscode-editorWidget-background, var(--vscode-editor-background));
      border: 1px solid var(--vscode-panel-border);
      border-radius: 6px;
      font-size: 11px;
      text-align: left;
      display: inline-block;
    }
    .connection-info .conn-row {
      display: flex;
      gap: 8px;
      padding: 1px 0;
    }
    .connection-info .conn-label {
      color: var(--vscode-descriptionForeground);
      min-width: 100px;
      text-align: right;
    }
    .connection-info .conn-value {
      color: var(--vscode-foreground);
    }
    .connection-info .conn-section {
      font-size: 10px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: var(--vscode-descriptionForeground);
      margin-top: 6px;
      margin-bottom: 2px;
    }
    .connection-info .conn-section:first-child {
      margin-top: 0;
    }

    /* Markdown-ish table styling for tool body content */
    .tool-body table, .message .content table {
      border-collapse: collapse;
      width: 100%;
      margin: 8px 0;
      font-size: 11px;
    }
    .tool-body th, .tool-body td,
    .message .content th, .message .content td {
      padding: 4px 8px;
      border: 1px solid var(--vscode-panel-border);
      text-align: left;
    }
    .message .content thead th {
      background: var(--vscode-textCodeBlock-background);
      font-weight: 600;
    }
    .message .content h3, .message .content h4 {
      margin: 12px 0 6px;
      font-weight: 600;
    }
    .message .content h3 { font-size: 14px; }
    .message .content h4 { font-size: 12px; }
    .message .content ul, .message .content ol {
      margin: 6px 0;
      padding-left: 24px;
    }
    .message .content li {
      margin: 2px 0;
    }
    .message .content p {
      margin: 0 0 10px 0;
    }
    .message .content p:last-child {
      margin-bottom: 0;
    }

    code {
      font-family: var(--vscode-editor-font-family);
      background: var(--vscode-textCodeBlock-background);
      padding: 1px 4px;
      border-radius: 3px;
      font-size: 12px;
    }

    /* Slash command menu — ported from fivetran-code webview */
    .skill-dropdown {
      display: none;
      position: absolute;
      bottom: 100%;
      left: 0;
      right: 0;
      max-height: 400px;
      overflow-y: auto;
      background: var(--vscode-editorWidget-background, var(--vscode-editor-background));
      border: 1px solid var(--vscode-editorWidget-border, var(--vscode-panel-border));
      border-radius: 6px;
      margin-bottom: 4px;
      box-shadow: 0 -4px 12px rgba(0,0,0,0.3);
      z-index: 100;
    }
    .skill-dropdown.visible { display: block; }
    .skill-item {
      padding: 6px 12px;
      cursor: pointer;
      display: flex;
      flex-direction: column;
      gap: 1px;
      border-bottom: 1px solid var(--vscode-panel-border);
    }
    .skill-item:last-child { border-bottom: none; }
    .skill-item:hover,
    .skill-item.selected {
      background: var(--vscode-list-hoverBackground);
    }
    .skill-item .skill-name {
      font-size: 12px;
      font-weight: 600;
      color: ${BRAND.primaryColor};
    }
    .skill-item .skill-desc {
      font-size: 10px;
      color: var(--vscode-descriptionForeground);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .menu-section-header {
      padding: 6px 12px 2px;
      font-size: 10px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: var(--vscode-descriptionForeground);
      pointer-events: none;
    }
    .menu-section-header:not(:first-child) {
      border-top: 1px solid var(--vscode-panel-border);
      margin-top: 2px;
      padding-top: 8px;
    }
    .skill-item .menu-item-badge {
      margin-left: auto;
      font-size: 10px;
      font-weight: 400;
      color: var(--vscode-descriptionForeground);
      flex-shrink: 0;
    }
    .skill-item.has-badge {
      flex-direction: row;
      align-items: center;
      gap: 8px;
    }
    .skill-item.has-badge .skill-name {
      flex: 1;
    }
    .menu-item-radio {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      border: 2px solid var(--vscode-descriptionForeground);
      flex-shrink: 0;
    }
    .menu-item-radio.active {
      border-color: var(--vscode-textLink-foreground);
      background: var(--vscode-textLink-foreground);
    }
    .skill-item .model-id {
      font-size: 10px;
      color: var(--vscode-descriptionForeground);
      opacity: 0.8;
    }
    .menu-back-btn {
      padding: 6px 12px;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 11px;
      color: var(--vscode-descriptionForeground);
      border-bottom: 1px solid var(--vscode-panel-border);
    }
    .menu-back-btn:hover {
      background: var(--vscode-list-hoverBackground);
      color: var(--vscode-foreground);
    }

    /* Footer metric styling — ported from fivetran-code */
    .status-footer .context-bar {
      width: 50px;
      height: 4px;
      background: var(--vscode-progressBar-background, #333);
      border-radius: 2px;
      overflow: hidden;
    }
    .status-footer .context-fill {
      height: 100%;
      background: ${BRAND.primaryColor};
      border-radius: 2px;
      transition: width 0.3s ease;
    }
    .status-footer .context-fill.warning {
      background: var(--vscode-editorWarning-foreground, #cca700);
    }
    .status-footer .context-fill.danger {
      background: var(--vscode-errorForeground, #f44);
    }
  </style>
</head>
<body>
  <div class="header">
    <span class="brand-accent"></span>
    <h2>${escapeHtml(BRAND.headerLabel)}</h2>
    <span class="badge" id="versionBadge">—</span>
    <span class="spacer"></span>
    <div class="mcp-status" id="mcpStatus" style="display:none;">
      <span class="mcp-dot"></span>
      <span id="mcpLabel">0 MCP</span>
      <div class="mcp-tooltip" id="mcpTooltip"></div>
    </div>
  </div>

  <div class="messages" id="messages">
    <div class="welcome" id="welcomeCard">
      <h3>${escapeHtml(BRAND.headerLabel)}</h3>
      <p>Starting a Cortex Code session...</p>
      <div class="connection-info" id="connectionInfo" style="display:none;"></div>
      <p class="welcome-hint">Type a question below and hit Enter. Use / for commands.</p>
    </div>
  </div>

  <div class="status-footer" id="statusFooter">
    <div class="status-item">
      <span id="footerModel">—</span>
    </div>
    <div class="status-item">
      <span id="footerApiKey">Snowflake Cortex</span>
    </div>
    <div class="status-item">
      <span>Context:</span>
      <div class="context-bar"><div class="context-fill" id="contextFill" style="width:0%"></div></div>
      <span id="contextPct">0%</span>
    </div>
    <div class="status-item">
      <span id="tokenCount">0 tokens</span>
    </div>
    <div class="status-item">
      <span>Cache:</span>
      <span id="cacheRate">—</span>
    </div>
    <div class="status-item">
      <span id="sessionCost">$0.0000</span>
    </div>
    <div class="status-item">
      <span id="sessionTimer">0:00</span>
    </div>
    <span class="spacer"></span>
    <div class="status-item">
      <span class="status-dot starting" id="statusDot"></span>
      <span id="statusText">Starting</span>
    </div>
    <div class="status-item">
      <span id="footerVersion">—</span>
    </div>
  </div>

  <div class="input-area">
    <div class="input-toolbar">
      <div class="mode-selector" id="modeSelector">
        <span class="mode-btn active" data-mode="confirm">Confirm actions</span>
        <span class="mode-btn" data-mode="auto">Auto-execute</span>
        <span class="mode-btn" data-mode="plan">Plan mode</span>
      </div>
    </div>
    <div class="voice-status" id="voiceStatus"></div>
    <div class="attachment-chips" id="attachmentChips"></div>
    <div class="input-row">
      <button class="attach-btn" id="attachBtn" title="Attach file" aria-label="Attach file">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/></svg>
      </button>
      <button class="mic-btn" id="micBtn" aria-label="Voice input" title="Voice input (/voice)">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
      </button>
      <div class="input-wrapper">
        <div class="skill-dropdown" id="skillDropdown"></div>
        <textarea id="input" rows="1" placeholder="Type a message for Cortex Code... (/ for commands)" autofocus></textarea>
      </div>
      <button class="send-btn" id="send" aria-label="Send">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M4 12V4l8 4-8 4z" fill="currentColor"/></svg>
      </button>
    </div>
  </div>

  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    const messagesEl = document.getElementById('messages');
    const inputEl = document.getElementById('input');
    const sendBtn = document.getElementById('send');
    const attachBtn = document.getElementById('attachBtn');
    const micBtn = document.getElementById('micBtn');
    const modeSelector = document.getElementById('modeSelector');
    const voiceStatusEl = document.getElementById('voiceStatus');
    const mcpStatusEl = document.getElementById('mcpStatus');
    const mcpLabelEl = document.getElementById('mcpLabel');
    const mcpTooltipEl = document.getElementById('mcpTooltip');
    const versionBadge = document.getElementById('versionBadge');
    const footerVersion = document.getElementById('footerVersion');
    const footerModel = document.getElementById('footerModel');
    const sessionTimer = document.getElementById('sessionTimer');
    const contextFill = document.getElementById('contextFill');
    const contextPct = document.getElementById('contextPct');
    const tokenCount = document.getElementById('tokenCount');
    const cacheRate = document.getElementById('cacheRate');
    const sessionCost = document.getElementById('sessionCost');
    const statusDot = document.getElementById('statusDot');
    const statusText = document.getElementById('statusText');
    const attachmentChipsEl = document.getElementById('attachmentChips');

    let currentStreamEl = null;
    let pendingAttachments = [];
    let welcomeCleared = false;
    let pendingToolCard = null;
    const pendingToolCardQueues = {};
    // Inline "Cortex is thinking..." indicator. Created when the user
    // submits a message, removed when the first content arrives.
    let thinkingEl = null;
    // Slash menu state
    const skillDropdown = document.getElementById('skillDropdown');
    let skills = [];
    let selectedItemIdx = -1;
    let compactMode = false;
    let currentMode = 'confirm';
    let voiceActive = false;
    // Tool cards we hide from the chat UI. These are cortex's internal
    // "plumbing" tools used during skill loading and file scanning — they
    // add visual noise (full SKILL.md dumps, long file lists) without
    // adding value for the user watching the conversation. The actual
    // answer still flows through as assistant text.
    const SUPPRESSED_TOOLS = new Set([
      'skill', 'Skill',
      'glob', 'Glob',
      'read', 'Read',
      'bash', 'Bash',
      'task', 'Task',
    ]);
    function isSuppressedTool(name) {
      if (!name) return false;
      return SUPPRESSED_TOOLS.has(name);
    }
    let suppressedToolActive = false;
    let currentPricingModel = 'claude-sonnet-4-6';
    const PRICING_MODELS = [
      { id: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6', short: 'Sonnet 4.6' },
      { id: 'claude-opus-4-6', label: 'Claude Opus 4.6', short: 'Opus 4.6' },
      { id: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5', short: 'Haiku 4.5' },
    ];
    function getPricingShortName(id) {
      const m = PRICING_MODELS.find(function(x) { return x.id === id; });
      return m ? m.short : id;
    }
    let sessionStartTime = Date.now();
    let footerSessionTimer = null;

    function clearWelcome() {
      if (!welcomeCleared) {
        messagesEl.innerHTML = '';
        welcomeCleared = true;
      }
    }

    function scrollToBottom() {
      messagesEl.scrollTop = messagesEl.scrollHeight;
    }

    function escapeHtml(s) {
      return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    }

    function endStreamingIfActive() {
      currentStreamEl = null;
    }

    function startAssistantBubble() {
      clearWelcome();
      hideThinking();
      endStreamingIfActive();
      const msgEl = document.createElement('div');
      msgEl.className = 'message assistant';
      const roleEl = document.createElement('div');
      roleEl.className = 'role';
      roleEl.textContent = 'Cortex Code';
      const contentEl = document.createElement('div');
      contentEl.className = 'content';
      msgEl.appendChild(roleEl);
      msgEl.appendChild(contentEl);
      messagesEl.appendChild(msgEl);
      currentStreamEl = contentEl;
      scrollToBottom();
    }

    function appendStreamText(text) {
      if (!currentStreamEl) {
        startAssistantBubble();
      }
      // Accumulate raw text on the element; re-render as markdown every
      // delta so bold, italics, code, and links appear as they stream in.
      const raw = (currentStreamEl.dataset.raw || '') + text;
      currentStreamEl.dataset.raw = raw;
      currentStreamEl.innerHTML = renderMarkdown(raw);
      scrollToBottom();
    }

    /**
     * Minimal inline markdown renderer. Supports bold (**text**), italic
     * (*text*), inline code (\`code\`), links [text](url), unordered lists
     * (- item), ordered lists (1. item), paragraphs, and line breaks.
     * Escapes HTML first so untrusted model output can't inject tags.
     */
    function renderMarkdown(md) {
      if (!md) return '';
      let html = escapeHtml(md);
      // Fenced code blocks first so their contents don't get further
      // markdown-processed by the inline rules below.
      html = html.replace(/\`\`\`([\\s\\S]*?)\`\`\`/g, function(_m, code) {
        return '<pre><code>' + code + '</code></pre>';
      });
      // Inline code
      html = html.replace(/\`([^\`\\n]+)\`/g, '<code>$1</code>');
      // Bold (** or __)
      html = html.replace(/\\*\\*([^*\\n]+)\\*\\*/g, '<strong>$1</strong>');
      html = html.replace(/__([^_\\n]+)__/g, '<strong>$1</strong>');
      // Italic (single *)
      html = html.replace(/(^|[^*])\\*([^*\\n]+)\\*(?!\\*)/g, '$1<em>$2</em>');
      // Links [text](url)
      html = html.replace(/\\[([^\\]]+)\\]\\(([^)\\s]+)\\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
      // Bare URLs (https://... not already inside an href)
      html = html.replace(/(^|[^"=])(https?:\\/\\/[^\\s<]+)/g, '$1<a href="$2" target="_blank" rel="noopener">$2</a>');
      // Headers — use new RegExp to avoid template escaping. Order matters: longest first.
      html = html.replace(new RegExp('^#{4} (.+)$', 'gm'), '<h5>$1</h5>');
      html = html.replace(new RegExp('^#{3} (.+)$', 'gm'), '<h4>$1</h4>');
      html = html.replace(new RegExp('^#{2} (.+)$', 'gm'), '<h3>$1</h3>');
      html = html.replace(new RegExp('^# (.+)$', 'gm'), '<h2>$1</h2>');
      // Tables: two-pass approach. First find table blocks, then convert.
      var tableLines = html.split('\\n');
      var tableOut = [];
      var tbl = null;
      for (var ti = 0; ti < tableLines.length; ti++) {
        var tline = tableLines[ti].trim();
        var isTableRow = tline.length > 2 && tline.charAt(0) === '|' && tline.charAt(tline.length - 1) === '|';
        if (isTableRow) {
          if (!tbl) tbl = [];
          tbl.push(tline);
        } else {
          if (tbl) { tableOut.push(buildTable(tbl)); tbl = null; }
          tableOut.push(tableLines[ti]);
        }
      }
      if (tbl) tableOut.push(buildTable(tbl));
      function buildTable(rows) {
        function parseCells(r) { return r.split('|').slice(1, -1).map(function(c) { return c.trim(); }); }
        var isSep = function(r) { return r.replace(/[|\\s:-]/g, '').length === 0; };
        var hasHeader = rows.length >= 2 && isSep(rows[1]);
        var t = '<table>';
        if (hasHeader) {
          t += '<thead><tr>' + parseCells(rows[0]).map(function(c) { return '<th>' + c + '</th>'; }).join('') + '</tr></thead>';
          t += '<tbody>';
          for (var ri = 2; ri < rows.length; ri++) {
            t += '<tr>' + parseCells(rows[ri]).map(function(c) { return '<td>' + c + '</td>'; }).join('') + '</tr>';
          }
        } else {
          t += '<tbody>';
          for (var ri2 = 0; ri2 < rows.length; ri2++) {
            t += '<tr>' + parseCells(rows[ri2]).map(function(c) { return '<td>' + c + '</td>'; }).join('') + '</tr>';
          }
        }
        t += '</tbody></table>';
        return t;
      }
      html = tableOut.join('\\n');
      // Lists: wrap consecutive list lines in <ul>/<ol>.
      // Skip blank lines between items so the list stays together.
      const lines = html.split('\\n');
      const out = [];
      let inUl = false;
      let inOl = false;
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();
        const ulMatch = line.match(/^\\s*[-*] (.*)$/);
        const olMatch = line.match(/^\\s*\\d+\\. (.*)$/);
        // Skip blank lines inside a list — peek ahead to see if list continues
        if ((inUl || inOl) && trimmed === '') {
          let j = i + 1;
          while (j < lines.length && lines[j].trim() === '') j++;
          if (j < lines.length) {
            const next = lines[j];
            if ((inUl && next.match(/^\\s*[-*] /)) || (inOl && next.match(/^\\s*\\d+\\. /))) continue;
          }
          if (inUl) { out.push('</ul>'); inUl = false; }
          if (inOl) { out.push('</ol>'); inOl = false; }
          out.push(line);
          continue;
        }
        if (ulMatch) {
          if (!inUl) { if (inOl) { out.push('</ol>'); inOl = false; } out.push('<ul>'); inUl = true; }
          out.push('<li>' + ulMatch[1] + '</li>');
        } else if (olMatch) {
          if (!inOl) { if (inUl) { out.push('</ul>'); inUl = false; } out.push('<ol>'); inOl = true; }
          out.push('<li>' + olMatch[1] + '</li>');
        } else {
          if (inUl) { out.push('</ul>'); inUl = false; }
          if (inOl) { out.push('</ol>'); inOl = false; }
          out.push(line);
        }
      }
      if (inUl) out.push('</ul>');
      if (inOl) out.push('</ol>');
      html = out.join('\\n');
      // Paragraphs and line breaks — but don't add <br> between HTML block tags
      html = html.replace(/\\n\\n+/g, '</p><p>');
      // Remove newlines between block-level tags (li, ul, ol, table, tr, thead, tbody)
      html = html.replace(new RegExp('(</(?:li|ul|ol|tr|thead|tbody|table|h[2-5])>)\\\\n(<(?:li|ul|ol|tr|thead|tbody|table|/tbody|/table|h[2-5]))', 'g'), '$1$2');
      html = html.replace(/\\n/g, '<br>');
      html = '<p>' + html + '</p>';
      return html;
    }

    function addUserBubble(text) {
      clearWelcome();
      endStreamingIfActive();
      const msgEl = document.createElement('div');
      msgEl.className = 'message user';
      const roleEl = document.createElement('div');
      roleEl.className = 'role';
      roleEl.textContent = 'You';
      const contentEl = document.createElement('div');
      contentEl.className = 'content';
      contentEl.textContent = text;
      msgEl.appendChild(roleEl);
      msgEl.appendChild(contentEl);
      messagesEl.appendChild(msgEl);
      scrollToBottom();
    }

    // Display-only transform: strip MCP prefixes and rename "demo" tools
    // so lab participants never see "se-demo" or "demo" in tool cards.
    // Tool routing is unaffected — uses the raw name internally.
    var TOOL_DISPLAY_RENAMES = {
      'create_demo_cortex_agent': 'create_cortex_agent',
      'cleanup_demo': 'cleanup_environment'
    };
    function formatToolName(raw) {
      var display = raw;
      if (display.startsWith('mcp__')) {
        var parts = display.split('__');
        if (parts.length >= 3) {
          display = parts.slice(2).join('__');
        }
      }
      return TOOL_DISPLAY_RENAMES[display] || display;
    }

    function addToolCardStart(name, input) {
      clearWelcome();
      hideThinking();
      endStreamingIfActive();
      const cardEl = document.createElement('div');
      cardEl.className = 'tool-card';
      cardEl.dataset.toolName = name;
      // Truncate input to ~100 chars like Fivetran Code
      let truncated = '';
      if (input) {
        truncated = input.length > 100 ? input.substring(0, 97) + '...' : input;
      }
      cardEl.innerHTML = '<span class="spinner">&#9696;</span> ' +
        '<span class="tool-name">' + escapeHtml(formatToolName(name)) + '</span>' +
        (truncated ? '<div class="tool-input">' + escapeHtml(truncated) + '</div>' : '');
      messagesEl.appendChild(cardEl);
      pendingToolCard = cardEl;
      if (!pendingToolCardQueues[name]) pendingToolCardQueues[name] = [];
      pendingToolCardQueues[name].push(cardEl);
      scrollToBottom();
    }

    function finalizeToolCard(name, success, body) {
      // Pop the oldest pending card for this tool name (FIFO handles parallel calls)
      let cardEl = null;
      if (pendingToolCardQueues[name] && pendingToolCardQueues[name].length > 0) {
        cardEl = pendingToolCardQueues[name].shift();
      }
      if (!cardEl) cardEl = pendingToolCard;
      if (cardEl === pendingToolCard) pendingToolCard = null;
      if (!cardEl) {
        addToolCardStart(name);
        cardEl = pendingToolCards[name] || pendingToolCard;
        delete pendingToolCards[name];
        pendingToolCard = null;
      }
      if (!cardEl) return;
      cardEl.classList.add(success ? 'success' : 'error');
      // Replace spinner with check/x icon
      const icon = success ? '&#10003;' : '&#10007;';
      cardEl.innerHTML = cardEl.innerHTML.replace(/<span class="spinner">.*?<\\/span>/, icon);
      // Append truncated body as tool-input (matching Fivetran Code)
      if (body && body.length > 0) {
        let inputEl = cardEl.querySelector('.tool-input');
        if (!inputEl) {
          inputEl = document.createElement('div');
          inputEl.className = 'tool-input';
          cardEl.appendChild(inputEl);
        }
        const truncated = body.length > 100 ? body.substring(0, 97) + '...' : body;
        inputEl.textContent = truncated;
      }
      scrollToBottom();
    }

    function addConfirmationCard(prompt) {
      clearWelcome();
      endStreamingIfActive();
      const cardEl = document.createElement('div');
      cardEl.className = 'confirm-card';
      const titleEl = document.createElement('div');
      titleEl.className = 'title';
      titleEl.textContent = 'Cortex Code needs your approval';
      const promptEl = document.createElement('div');
      promptEl.className = 'prompt';
      promptEl.textContent = prompt;
      const actionsEl = document.createElement('div');
      actionsEl.className = 'actions';
      const allowBtn = document.createElement('button');
      allowBtn.className = 'btn-allow';
      allowBtn.textContent = 'Approve';
      allowBtn.addEventListener('click', () => {
        actionsEl.remove();
        promptEl.style.opacity = '0.6';
        vscode.postMessage({ type: 'confirmationResponse', confirmed: true });
      });
      const denyBtn = document.createElement('button');
      denyBtn.className = 'btn-deny';
      denyBtn.textContent = 'Deny';
      denyBtn.addEventListener('click', () => {
        actionsEl.remove();
        promptEl.style.opacity = '0.6';
        vscode.postMessage({ type: 'confirmationResponse', confirmed: false });
      });
      actionsEl.appendChild(allowBtn);
      actionsEl.appendChild(denyBtn);
      cardEl.appendChild(titleEl);
      cardEl.appendChild(promptEl);
      cardEl.appendChild(actionsEl);
      messagesEl.appendChild(cardEl);
      scrollToBottom();
    }

    function showThinking() {
      clearWelcome();
      hideThinking(); // remove any existing one first
      thinkingEl = document.createElement('div');
      thinkingEl.className = 'thinking-indicator';
      thinkingEl.innerHTML =
        '<span class="thinking-dot"></span>' +
        '<span class="thinking-dot"></span>' +
        '<span class="thinking-dot"></span>' +
        '<span>Cortex Code is thinking\u2026</span>';
      messagesEl.appendChild(thinkingEl);
      scrollToBottom();
    }

    function hideThinking() {
      if (thinkingEl) {
        thinkingEl.remove();
        thinkingEl = null;
      }
    }

    function addRawOutputBubble(text) {
      clearWelcome();
      // Don't end streaming for raw output — it's low-priority content
      // that often interleaves with real messages. Batch adjacent raw lines
      // into a single bubble for cleanliness.
      const last = messagesEl.lastElementChild;
      if (last && last.classList.contains('raw-output')) {
        last.textContent += '\\n' + text;
      } else {
        endStreamingIfActive();
        const bubbleEl = document.createElement('div');
        bubbleEl.className = 'raw-output';
        bubbleEl.textContent = text;
        messagesEl.appendChild(bubbleEl);
      }
      scrollToBottom();
    }

    function setSessionStatus(status) {
      statusDot.classList.remove('exited', 'starting');
      if (status === 'exited') {
        statusDot.classList.add('exited');
        statusText.textContent = 'Exited';
      } else if (status === 'starting') {
        statusDot.classList.add('starting');
        statusText.textContent = 'Starting';
      } else {
        statusText.textContent = 'Running';
      }
    }

    function formatElapsed(seconds) {
      const m = Math.floor(seconds / 60);
      const s = seconds % 60;
      return m + ':' + String(s).padStart(2, '0');
    }

    function formatModelLabel(modelId) {
      if (!modelId || modelId === 'unknown') return '—';
      // Snowflake Cortex Complete reports model=auto without specifying the
      // actual Claude variant. Display the friendly name of the configured
      // pricing model instead so the footer is never stuck on "auto".
      if (modelId === 'auto') return getPricingShortName(currentPricingModel);
      // Strip common prefixes, replace dashes with spaces, Title Case first letter
      let label = modelId
        .replace(/^claude-/i, '')
        .replace('-4-6', ' 4.6')
        .replace('-4-5', ' 4.5')
        .replace('-20251001', '')
        .replace(/-/g, ' ');
      return label.charAt(0).toUpperCase() + label.slice(1);
    }

    function startFooterSessionTimer() {
      if (footerSessionTimer) return;
      sessionStartTime = Date.now();
      footerSessionTimer = setInterval(function() {
        const elapsed = Math.floor((Date.now() - sessionStartTime) / 1000);
        sessionTimer.textContent = formatElapsed(elapsed);
      }, 1000);
    }

    function renderAttachmentChips() {
      if (pendingAttachments.length === 0) {
        attachmentChipsEl.classList.remove('visible');
        attachmentChipsEl.innerHTML = '';
        return;
      }
      attachmentChipsEl.classList.add('visible');
      attachmentChipsEl.innerHTML = pendingAttachments.map((att, idx) => {
        const sizeTxt = att.sizeBytes < 1024 ? att.sizeBytes + ' B'
          : att.sizeBytes < 1048576 ? (att.sizeBytes / 1024).toFixed(0) + ' KB'
          : (att.sizeBytes / 1048576).toFixed(1) + ' MB';
        return '<span class="attachment-chip">' +
          '<span class="chip-name">' + escapeHtml(att.name) + '</span>' +
          '<span class="chip-size">' + sizeTxt + '</span>' +
          '<span class="chip-remove" data-idx="' + idx + '">&times;</span>' +
          '</span>';
      }).join('');
      attachmentChipsEl.querySelectorAll('.chip-remove').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const i = parseInt(e.target.dataset.idx);
          pendingAttachments.splice(i, 1);
          renderAttachmentChips();
        });
      });
    }

    // ------------------------------------------------------------------------
    // Input handling
    // ------------------------------------------------------------------------
    function sendMessage() {
      // Allow empty input — pressing Enter on an empty textarea sends just
      // a raw carriage return. This is critical for Ink-based CLIs like
      // cortex code whose @inquirer/select menus accept Enter (no text)
      // to confirm the currently-highlighted option (arrow-key navigation).
      const text = inputEl.value;
      vscode.postMessage({
        type: 'userInput',
        text,
        mode: currentMode,
        attachments: pendingAttachments.length > 0 ? pendingAttachments : undefined,
      });
      inputEl.value = '';
      pendingAttachments = [];
      renderAttachmentChips();
      autoResize();
    }

    function autoResize() {
      inputEl.style.height = 'auto';
      const maxH = 200;
      if (inputEl.scrollHeight > maxH) {
        inputEl.style.height = maxH + 'px';
        inputEl.style.overflowY = 'auto';
      } else {
        inputEl.style.height = inputEl.scrollHeight + 'px';
        inputEl.style.overflowY = 'hidden';
      }
    }

    // ========================================================================
    // Slash command menu (ported from fivetran-code, adapted for cortex)
    // ========================================================================

    function showCommandMenu(filter) {
      const query = filter.toLowerCase();

      const contextItems = [
        { type: 'command', id: 'clear', name: '/clear', desc: 'Clear the chat display (session stays alive)' },
        { type: 'command', id: 'restart', name: '/restart', desc: 'Restart the cortex session (full reset)' },
        { type: 'command', id: 'help', name: '/help', desc: 'Ask cortex what it can do' },
        { type: 'command', id: 'memory', name: '/memory', desc: 'Open ~/.claude/CLAUDE.md' },
        { type: 'command', id: 'docs', name: '/docs', desc: 'Open the extension README' },
        { type: 'command', id: 'terminal', name: '/terminal', desc: 'Open cortex in a native VSCode terminal' },
        { type: 'command', id: 'voice', name: '/voice', desc: 'Voice input via macOS Dictation' },
        { type: 'command', id: 'compact', name: '/compact', desc: compactMode ? 'Switch to normal responses' : 'Switch to terse, data-only responses', badge: compactMode ? 'ON' : '' },
      ];
      const modelItems = [
        { type: 'model-menu', id: 'switch-pricing-model', name: 'Switch pricing model...', badge: getPricingShortName(currentPricingModel) },
      ];
      const accountItems = [
        { type: 'command', id: 'account', name: '/account', desc: 'View session info and usage' },
        { type: 'command', id: 'mcp', name: '/mcp', desc: 'View MCP servers and toggle via MCP Cloud' },
        { type: 'command', id: 'upgrade', name: '/upgrade', desc: 'Update cortex to the latest version' },
        { type: 'command', id: 'settings', name: '/settings', desc: 'Open Cortex Code for VSCode settings' },
      ];

      // Group skills by category — project first, then plugin, then bundled,
      // then remote, then stage. Each group becomes a separate section in
      // the dropdown so users can quickly see what's theirs vs what comes
      // from cortex itself vs plugins.
      const skillsByCategory = {
        project: [],
        plugin: [],
        bundled: [],
        remote: [],
        stage: [],
      };
      skills.forEach(function(s) {
        const cat = s.category || 'project';
        if (skillsByCategory[cat]) {
          skillsByCategory[cat].push({
            type: 'skill',
            id: s.name,
            name: s.name,
            desc: s.description,
          });
        }
      });

      const filterItem = function(item) {
        if (!query) return true;
        return item.name.toLowerCase().includes(query) ||
          (item.desc || '').toLowerCase().includes(query);
      };

      const filteredContext = contextItems.filter(filterItem);
      const filteredModel = modelItems.filter(filterItem);
      const filteredAccount = accountItems.filter(filterItem);
      const filteredProject = skillsByCategory.project.filter(filterItem);
      const filteredPlugin = skillsByCategory.plugin.filter(filterItem);
      const filteredBundled = skillsByCategory.bundled.filter(filterItem);
      const filteredRemote = skillsByCategory.remote.filter(filterItem);
      const filteredStage = skillsByCategory.stage.filter(filterItem);

      const totalFiltered =
        filteredContext.length +
        filteredModel.length +
        filteredAccount.length +
        filteredProject.length +
        filteredPlugin.length +
        filteredBundled.length +
        filteredRemote.length +
        filteredStage.length;

      if (totalFiltered === 0) {
        hideCommandMenu();
        return;
      }

      let html = '';
      let itemIdx = 0;

      if (filteredContext.length > 0) {
        html += '<div class="menu-section-header">Context</div>';
        filteredContext.forEach(function(item) {
          if (item.badge) {
            html += '<div class="skill-item has-badge' + (itemIdx === 0 ? ' selected' : '') + '" data-action="' + item.id + '" data-type="command" data-idx="' + itemIdx + '">' +
              '<span class="skill-name">' + escapeHtml(item.name) + '</span>' +
              '<span class="menu-item-badge">' + escapeHtml(item.badge) + '</span></div>';
          } else {
            html += '<div class="skill-item' + (itemIdx === 0 ? ' selected' : '') + '" data-action="' + item.id + '" data-type="command" data-idx="' + itemIdx + '">' +
              '<span class="skill-name">' + escapeHtml(item.name) + '</span>' +
              '<span class="skill-desc">' + escapeHtml(item.desc) + '</span></div>';
          }
          itemIdx++;
        });
      }

      if (filteredModel.length > 0) {
        html += '<div class="menu-section-header">Model</div>';
        filteredModel.forEach(function(item) {
          html += '<div class="skill-item has-badge' + (itemIdx === 0 ? ' selected' : '') + '" data-action="' + item.id + '" data-type="model-menu" data-idx="' + itemIdx + '">' +
            '<span class="skill-name">' + escapeHtml(item.name) + '</span>' +
            '<span class="menu-item-badge">' + escapeHtml(item.badge) + '</span></div>';
          itemIdx++;
        });
      }

      if (filteredAccount.length > 0) {
        html += '<div class="menu-section-header">Account</div>';
        filteredAccount.forEach(function(item) {
          html += '<div class="skill-item' + (itemIdx === 0 ? ' selected' : '') + '" data-action="' + item.id + '" data-type="command" data-idx="' + itemIdx + '">' +
            '<span class="skill-name">' + escapeHtml(item.name) + '</span>' +
            '<span class="skill-desc">' + escapeHtml(item.desc) + '</span></div>';
          itemIdx++;
        });
      }

      const renderSkillSection = function(label, items) {
        if (items.length === 0) return;
        html += '<div class="menu-section-header">' + label + ' (' + items.length + ')</div>';
        items.forEach(function(item) {
          html += '<div class="skill-item' + (itemIdx === 0 ? ' selected' : '') + '" data-action="' + escapeHtml(item.id) + '" data-type="skill" data-idx="' + itemIdx + '">' +
            '<span class="skill-name">' + escapeHtml(item.name) + '</span>' +
            '<span class="skill-desc">' + escapeHtml(item.desc || '') + '</span></div>';
          itemIdx++;
        });
      };

      renderSkillSection('Project Skills', filteredProject);
      renderSkillSection('Plugin Skills', filteredPlugin);
      renderSkillSection('Bundled Skills', filteredBundled);
      renderSkillSection('Remote Skills', filteredRemote);
      renderSkillSection('Stage Skills', filteredStage);

      selectedItemIdx = 0;
      skillDropdown.innerHTML = html;
      skillDropdown.classList.add('visible');
      bindMenuClicks();
    }

    function hideCommandMenu() {
      skillDropdown.classList.remove('visible');
      selectedItemIdx = -1;
    }

    function showPricingSubmenu() {
      let html = '<div class="menu-back-btn" id="menuBack">&larr; Back</div>';
      html += '<div class="menu-section-header">Select Pricing Model</div>';
      PRICING_MODELS.forEach(function(m, i) {
        const isActive = m.id === currentPricingModel;
        html += '<div class="skill-item' + (i === 0 ? ' selected' : '') + '" data-action="' + m.id + '" data-type="select-pricing-model" data-idx="' + i + '">' +
          '<div style="display:flex;align-items:center;gap:8px;">' +
          '<span class="menu-item-radio' + (isActive ? ' active' : '') + '"></span>' +
          '<div><span class="skill-name">' + escapeHtml(m.label) + '</span>' +
          '<div class="model-id">' + escapeHtml(m.id) + '</div></div></div></div>';
      });
      selectedItemIdx = 0;
      skillDropdown.innerHTML = html;
      skillDropdown.classList.add('visible');
      bindMenuClicks();
      const back = document.getElementById('menuBack');
      if (back) {
        back.addEventListener('click', function() {
          showCommandMenu('');
          inputEl.focus();
        });
      }
    }

    function bindMenuClicks() {
      skillDropdown.querySelectorAll('.skill-item').forEach(function(item) {
        item.addEventListener('click', function() { handleMenuSelect(item); });
      });
    }

    function handleMenuSelect(item) {
      const action = item.dataset.action;
      const type = item.dataset.type;

      if (type === 'command') {
        hideCommandMenu();
        inputEl.value = '';
        autoResize();
        if (action === 'clear') {
          messagesEl.innerHTML = '';
          welcomeCleared = true;
          currentStreamEl = null;
          pendingToolCard = null;
          thinkingEl = null;
          currentMode = 'confirm';
          modeSelector.querySelectorAll('.mode-btn').forEach(function(b) { b.classList.remove('active'); });
          modeSelector.querySelector('[data-mode="confirm"]').classList.add('active');
        } else if (action === 'restart') {
          vscode.postMessage({ type: 'restartSession' });
        } else if (action === 'help') {
          inputEl.value = 'what can you do and what skills do you have available?';
          autoResize();
          inputEl.focus();
        } else if (action === 'docs') {
          vscode.postMessage({ type: 'openDocs' });
        } else if (action === 'settings') {
          vscode.postMessage({ type: 'openSettings' });
        } else if (action === 'memory') {
          vscode.postMessage({ type: 'openMemory' });
        } else if (action === 'terminal') {
          vscode.postMessage({ type: 'openTerminal' });
        } else if (action === 'voice') {
          toggleVoice();
        } else if (action === 'compact') {
          vscode.postMessage({ type: 'toggleCompact' });
        } else if (action === 'account') {
          vscode.postMessage({ type: 'showAccount' });
        } else if (action === 'mcp') {
          vscode.postMessage({ type: 'showMcp' });
        } else if (action === 'upgrade') {
          vscode.postMessage({ type: 'upgradeCortex' });
        }
      } else if (type === 'model-menu') {
        showPricingSubmenu();
      } else if (type === 'select-pricing-model') {
        currentPricingModel = action;
        vscode.postMessage({ type: 'switchPricingModel', model: action });
        hideCommandMenu();
        inputEl.value = '';
        autoResize();
        inputEl.focus();
      } else if (type === 'skill') {
        // Display the skill invocation with a / prefix (matches Fivetran
        // Code's UX). The host translates /<skill> to $<skill> before
        // forwarding to cortex, which is the actual trigger prefix.
        inputEl.value = '/' + action + ' ';
        hideCommandMenu();
        inputEl.focus();
        autoResize();
      }
    }

    function navigateMenu(direction) {
      const items = skillDropdown.querySelectorAll('.skill-item');
      if (items.length === 0) return;
      if (items[selectedItemIdx]) {
        items[selectedItemIdx].classList.remove('selected');
      }
      selectedItemIdx = Math.max(0, Math.min(items.length - 1, selectedItemIdx + direction));
      if (items[selectedItemIdx]) {
        items[selectedItemIdx].classList.add('selected');
        items[selectedItemIdx].scrollIntoView({ block: 'nearest' });
      }
    }

    skillDropdown.addEventListener('click', function(e) { e.stopPropagation(); });

    // MCP tooltip — click to toggle, click outside to close
    mcpStatusEl.addEventListener('click', function(e) {
      e.stopPropagation();
      mcpTooltipEl.classList.toggle('visible');
    });

    document.addEventListener('click', function(e) {
      mcpTooltipEl.classList.remove('visible');
      if (!skillDropdown.contains(e.target) && e.target !== inputEl) {
        hideCommandMenu();
      }
    });

    // ========================================================================
    // Input event handlers
    // ========================================================================
    inputEl.addEventListener('input', function() {
      autoResize();
      const val = inputEl.value;
      if (val.startsWith('/')) {
        const filter = val.slice(1).split(' ')[0];
        if (!val.includes(' ')) {
          showCommandMenu(filter);
          return;
        }
      }
      hideCommandMenu();
    });

    inputEl.addEventListener('keydown', (e) => {
      const dropdownVisible = skillDropdown.classList.contains('visible');

      if (dropdownVisible) {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          navigateMenu(1);
          return;
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          navigateMenu(-1);
          return;
        }
        if (e.key === 'Tab' || (e.key === 'Enter' && selectedItemIdx >= 0)) {
          e.preventDefault();
          const items = skillDropdown.querySelectorAll('.skill-item');
          if (items[selectedItemIdx]) {
            handleMenuSelect(items[selectedItemIdx]);
          }
          return;
        }
        if (e.key === 'Escape') {
          e.preventDefault();
          hideCommandMenu();
          return;
        }
      }

      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
      // ESC is a no-op in v1. Stream-json mode doesn't have a documented
      // interrupt event, and disposing the session on ESC surprised users.
      if (e.key === 'Escape') {
        e.preventDefault();
      }
    });
    sendBtn.addEventListener('click', sendMessage);
    attachBtn.addEventListener('click', () => {
      vscode.postMessage({ type: 'openFilePicker' });
    });

    // Mode selector — Confirm / Auto-execute / Plan
    modeSelector.addEventListener('click', function(e) {
      const btn = e.target.closest('.mode-btn');
      if (!btn) return;
      modeSelector.querySelectorAll('.mode-btn').forEach(function(b) { b.classList.remove('active'); });
      btn.classList.add('active');
      currentMode = btn.dataset.mode;
    });

    // Mic / voice toggle — shows macOS Dictation helper
    function toggleVoice() {
      if (voiceActive) {
        voiceStatusEl.classList.remove('visible');
        micBtn.classList.remove('recording');
        voiceActive = false;
      } else {
        voiceStatusEl.innerHTML = 'Click in the text box, then press <strong>Fn</strong> twice (or the globe key) to start macOS Dictation. Speak your message, then press <strong>Fn</strong> again to stop.';
        voiceStatusEl.classList.add('visible');
        micBtn.classList.add('recording');
        voiceActive = true;
        inputEl.focus();
      }
    }
    micBtn.addEventListener('click', function() { toggleVoice(); });

    // ------------------------------------------------------------------------
    // Incoming messages from the extension host
    // ------------------------------------------------------------------------
    window.addEventListener('message', (event) => {
      const msg = event.data;
      switch (msg.type) {
        case 'ready':
          setSessionStatus('running');
          if (msg.version) {
            versionBadge.textContent = msg.version;
            footerVersion.textContent = msg.version;
          }
          break;
        case 'streamText':
          appendStreamText(msg.text);
          break;
        case 'streamEnd':
          endStreamingIfActive();
          break;
        case 'user':
          addUserBubble(msg.text);
          break;
        case 'toolCallStart':
          if (isSuppressedTool(msg.name)) {
            suppressedToolActive = true;
            break;
          }
          addToolCardStart(msg.name, msg.input);
          break;
        case 'toolCallEnd':
          if (isSuppressedTool(msg.name) || suppressedToolActive) {
            suppressedToolActive = false;
            break;
          }
          finalizeToolCard(msg.name, msg.success, msg.body);
          break;
        case 'confirmationRequired':
          addConfirmationCard(msg.prompt);
          break;
        case 'rawOutput':
          addRawOutputBubble(msg.text);
          break;
        case 'thinkingStart':
          showThinking();
          break;
        case 'thinkingEnd':
          hideThinking();
          break;
        case 'sessionCleared':
          messagesEl.innerHTML = '';
          welcomeCleared = true;
          currentStreamEl = null;
          pendingToolCard = null;
          thinkingEl = null;
          setSessionStatus('starting');
          break;
        case 'chatCleared':
          messagesEl.innerHTML = '';
          welcomeCleared = true;
          currentStreamEl = null;
          pendingToolCard = null;
          thinkingEl = null;
          break;
        case 'sessionExited':
          setSessionStatus('exited');
          addRawOutputBubble('[Cortex Code session exited' + (msg.code !== null ? ' (code ' + msg.code + ')' : '') + ']');
          break;
        case 'footerUpdate':
          sessionTimer.textContent = formatElapsed(msg.elapsedSeconds);
          if (msg.status === 'running') setSessionStatus('running');
          else if (msg.status === 'exited') setSessionStatus('exited');
          else if (msg.status === 'starting') setSessionStatus('starting');
          break;
        case 'metadata':
          // Session metadata from cortex init event + locally-scanned skills
          skills = Array.isArray(msg.skills) ? msg.skills : [];
          if (msg.model) {
            footerModel.textContent = formatModelLabel(msg.model);
          }
          if (msg.version) {
            versionBadge.textContent = msg.version;
            footerVersion.textContent = msg.version;
          }
          if (msg.pricingModel) {
            currentPricingModel = msg.pricingModel;
          }
          if (typeof msg.compactMode === 'boolean') {
            compactMode = msg.compactMode;
          }
          // MCP server indicator
          if (msg.mcpServers && msg.mcpServers.length > 0) {
            mcpStatusEl.style.display = 'flex';
            const count = msg.mcpServers.length;
            mcpLabelEl.textContent = count + ' MCP server' + (count > 1 ? 's' : '');
            mcpTooltipEl.innerHTML = msg.mcpServers.map(function(s) {
              return '<div class="mcp-server-item"><span class="mcp-server-dot"></span>' + escapeHtml(s) + '</div>';
            }).join('');
          }
          // Populate the welcome card connection info (if still visible)
          {
            const connEl = document.getElementById('connectionInfo');
            if (connEl && !welcomeCleared) {
              let html = '';
              const conn = msg.snowflakeConnection;
              if (conn) {
                html += '<div class="conn-row"><span class="conn-label">Connection:</span><span class="conn-value">' + escapeHtml(conn.connectionName) + '</span></div>';
                html += '<div class="conn-row"><span class="conn-label">Warehouse:</span><span class="conn-value">' + escapeHtml(conn.warehouse) + '</span></div>';
                html += '<div class="conn-row"><span class="conn-label">Database:</span><span class="conn-value">' + escapeHtml(conn.database) + '</span></div>';
                html += '<div class="conn-row"><span class="conn-label">Model:</span><span class="conn-value">' + escapeHtml(formatModelLabel(msg.model || 'auto')) + '</span></div>';
              }
              if (msg.instructionFiles && msg.instructionFiles.length > 0) {
                html += '<div class="conn-row"><span class="conn-label">Instructions:</span><span class="conn-value">' + msg.instructionFiles.length + ' file' + (msg.instructionFiles.length > 1 ? 's' : '') + ' (' + msg.instructionFiles.map(function(f) { return escapeHtml(f); }).join(', ') + ')</span></div>';
              }
              if (html) {
                connEl.innerHTML = html;
                connEl.style.display = 'inline-block';
              }
            }
          }
          // Start the session timer now that we know the session is alive
          startFooterSessionTimer();
          break;
        case 'compactModeChanged':
          compactMode = !!msg.enabled;
          break;
        case 'pricingModelChanged':
          currentPricingModel = msg.model;
          // Re-render the footer model label so it reflects the new choice
          // whenever cortex is still reporting "auto".
          footerModel.textContent = getPricingShortName(currentPricingModel);
          break;
        case 'usageUpdate': {
          const m = msg.metrics;
          const pct = Math.min(100, m.contextUsagePercent).toFixed(0);
          contextPct.textContent = pct + '%';
          contextFill.style.width = pct + '%';
          contextFill.className =
            'context-fill' +
            (m.contextUsagePercent > 80 ? ' danger' : m.contextUsagePercent > 50 ? ' warning' : '');
          const totalTokens = m.totalInputTokens + m.totalOutputTokens;
          tokenCount.textContent =
            totalTokens > 1000
              ? (totalTokens / 1000).toFixed(1) + 'K tokens'
              : totalTokens + ' tokens';
          cacheRate.textContent =
            m.cacheHitRate > 0 ? (m.cacheHitRate * 100).toFixed(0) + '%' : '—';
          sessionCost.textContent = '$' + m.estimatedCostUsd.toFixed(4);
          if (msg.model) {
            footerModel.textContent = formatModelLabel(msg.model);
          }
          startFooterSessionTimer();
          break;
        }
        case 'filesSelected':
          for (const file of msg.files) {
            pendingAttachments.push(file);
          }
          renderAttachmentChips();
          break;
      }
    });

    // Tell the extension host we're ready
    vscode.postMessage({ type: 'webviewReady' });
  </script>
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getNonce(): string {
  let text = "";
  const possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}
