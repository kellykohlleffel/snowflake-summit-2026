import type * as vscode from "vscode";

export interface WebviewHtmlOptions {
  webview: vscode.Webview;
  /** "sidebar" uses sideBar-background; "editor" uses editor-background */
  context: "sidebar" | "editor";
}

/**
 * Generate the full HTML for the Fivetran Code webview.
 * Shared by both the sidebar panel and the editor tab.
 */
export function getWebviewHtml(options: WebviewHtmlOptions): string {
  const { context } = options;
  const nonce = getNonce();

  const bodyBackground =
    context === "sidebar"
      ? "var(--vscode-sideBar-background)"
      : "var(--vscode-editor-background)";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}'; img-src data:;">
  <title>Fivetran Agent</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      color: var(--vscode-foreground);
      background: ${bodyBackground};
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
    .header .badge {
      font-size: 10px;
      padding: 2px 6px;
      border-radius: 10px;
      background: var(--vscode-badge-background);
      color: var(--vscode-badge-foreground);
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
    .message.assistant .role { color: var(--vscode-textLink-foreground); }
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
    .message.assistant .content p {
      margin: 0 0 10px 0;
      white-space: normal;
    }
    .message.assistant .content p:last-child {
      margin-bottom: 0;
    }
    .message.assistant .content pre {
      white-space: pre-wrap;
      margin: 8px 0;
    }
    .message.assistant .content table {
      margin: 8px 0;
    }

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
    .tool-card.success { border-left-color: var(--vscode-charts-green); }
    .tool-card.success .tool-name { color: var(--vscode-charts-green); }
    .tool-card.error { border-left-color: var(--vscode-errorForeground); }
    .tool-card.error .tool-name { color: var(--vscode-errorForeground); }
    .tool-card .tool-stream {
      margin-top: 6px;
      padding: 8px 10px;
      background: var(--vscode-textCodeBlock-background);
      border-radius: 3px;
      font-size: 12px;
      line-height: 1.5;
      max-height: 300px;
      overflow-y: auto;
      white-space: pre-wrap;
      color: var(--vscode-editor-foreground);
      opacity: 0.9;
    }
    .tool-card.success .tool-stream { max-height: 600px; }
    .tool-card .spinner {
      display: inline-block;
      animation: spin 1s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

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
    .confirm-card .actions {
      display: flex;
      gap: 8px;
      margin-top: 8px;
    }
    .confirm-card button {
      padding: 4px 12px;
      border-radius: 4px;
      border: 1px solid var(--vscode-button-border, transparent);
      cursor: pointer;
      font-size: 12px;
    }
    .confirm-card .btn-allow {
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
    }
    .confirm-card .btn-deny {
      background: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
    }

    .status-badge {
      display: inline-block;
      padding: 1px 6px;
      border-radius: 10px;
      font-size: 11px;
      font-weight: 600;
    }
    .status-connected { background: var(--vscode-charts-green); color: #fff; }
    .status-broken { background: var(--vscode-errorForeground); color: #fff; }
    .status-paused { background: var(--vscode-charts-yellow); color: #000; }

    .mcp-status {
      display: flex;
      align-items: center;
      gap: 4px;
      margin-left: auto;
      font-size: 10px;
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

    .input-wrapper {
      position: relative;
      flex: 1;
    }

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
      color: var(--vscode-textLink-foreground);
    }
    .skill-item .skill-desc {
      font-size: 10px;
      color: var(--vscode-descriptionForeground);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    /* Command menu section headers */
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
    /* Badge on right side of menu item (e.g., current model name) */
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
    /* Model sub-menu radio indicators */
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
      font-family: var(--vscode-editor-font-family);
    }
    /* Back button in sub-menu */
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

    .status-footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
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
    .status-footer .context-bar {
      width: 50px;
      height: 4px;
      background: var(--vscode-progressBar-background, #333);
      border-radius: 2px;
      overflow: hidden;
    }
    .status-footer .context-fill {
      height: 100%;
      background: var(--vscode-textLink-foreground);
      border-radius: 2px;
      transition: width 0.3s ease;
    }
    .status-footer .context-fill.warning {
      background: var(--vscode-editorWarning-foreground, #cca700);
    }
    .status-footer .context-fill.danger {
      background: var(--vscode-errorForeground, #f44);
    }
    .input-area {
      border-top: 1px solid var(--vscode-panel-border);
      display: flex;
      flex-direction: column;
    }
    .input-toolbar {
      display: flex;
      align-items: center;
      padding: 6px 16px 2px;
      gap: 4px;
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
      background: var(--vscode-textLink-foreground);
      background: color-mix(in srgb, var(--vscode-textLink-foreground) 15%, transparent);
    }
    .input-row {
      display: flex;
      align-items: flex-end;
      gap: 6px;
      padding: 4px 12px 12px;
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
      border-color: var(--vscode-focusBorder);
    }
    .input-area textarea:disabled {
      opacity: 0.5;
    }
    .send-btn {
      width: 32px;
      height: 32px;
      border-radius: 6px;
      border: none;
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0;
      flex-shrink: 0;
    }
    .send-btn:disabled {
      opacity: 0.3;
      cursor: default;
    }
    .attach-btn {
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
    }
    .attach-btn:hover {
      color: var(--vscode-foreground);
      background: var(--vscode-list-hoverBackground);
    }

    /* Voice / mic button */
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
    .mic-btn.unavailable { display: none; }

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
    .attachment-chip .chip-preview {
      width: 20px;
      height: 20px;
      border-radius: 3px;
      object-fit: cover;
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

    .voice-status {
      font-size: 10px;
      color: var(--vscode-errorForeground);
      padding: 0 16px 2px;
      display: none;
    }
    .voice-status.visible { display: block; }

    .streaming-cursor {
      display: inline-block;
      width: 8px;
      height: 14px;
      background: var(--vscode-foreground);
      animation: blink 1s step-end infinite;
      vertical-align: text-bottom;
    }
    @keyframes blink { 50% { opacity: 0; } }

    .welcome {
      text-align: center;
      padding: 24px 16px;
      color: var(--vscode-descriptionForeground);
    }
    .welcome h3 { color: var(--vscode-foreground); margin-bottom: 8px; }
    .welcome p { font-size: 12px; line-height: 1.6; }

    /* Markdown table styling */
    table { border-collapse: collapse; width: 100%; margin: 8px 0; font-size: 12px; }
    th, td { padding: 4px 8px; border: 1px solid var(--vscode-panel-border); text-align: left; }
    th { font-weight: 600; background: var(--vscode-editor-background); }

    code {
      font-family: var(--vscode-editor-font-family);
      background: var(--vscode-textCodeBlock-background);
      padding: 1px 4px;
      border-radius: 3px;
      font-size: 12px;
    }
    pre code { display: block; padding: 8px; overflow-x: auto; }
  </style>
</head>
<body>
  <div class="header">
    <h2>Fivetran Code</h2>
    <span class="badge">v0.2</span>
    <div class="mcp-status" id="mcpStatus" style="display:none;">
      <span class="mcp-dot"></span>
      <span id="mcpLabel">0 MCP</span>
      <div class="mcp-tooltip" id="mcpTooltip"></div>
    </div>
  </div>

  <div class="messages" id="messages">
    <div class="welcome">
      <h3>Fivetran Code</h3>
      <p>Ask me about your Fivetran connectors, destinations, and groups.<br>
      Try: "Which connectors are active?" or "List my groups"</p>
    </div>
  </div>

  <div class="status-footer" id="statusFooter" style="display:none;">
    <div class="status-item">
      <span id="footerModel">-</span>
    </div>
    <div class="status-item">
      <span id="footerApiKey">-</span>
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
      <span id="cacheRate">-</span>
    </div>
    <div class="status-item">
      <span id="sessionCost">$0.0000</span>
    </div>
    <div class="status-item">
      <span id="sessionTimer">0:00</span>
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
    <div class="voice-status" id="voiceStatus">Listening...</div>
    <div class="attachment-chips" id="attachmentChips"></div>
    <div class="input-row">
      <button class="attach-btn" id="attachBtn" aria-label="Attach file">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/></svg>
      </button>
      <button class="mic-btn" id="micBtn" aria-label="Voice input" title="Voice input (/voice)">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
      </button>
      <div class="input-wrapper">
        <div class="skill-dropdown" id="skillDropdown"></div>
        <textarea id="input" rows="1" placeholder="Ask about your Fivetran environment... (/ for commands)" autofocus></textarea>
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
    const skillDropdown = document.getElementById('skillDropdown');
    const mcpStatusEl = document.getElementById('mcpStatus');
    const mcpLabelEl = document.getElementById('mcpLabel');
    const mcpTooltipEl = document.getElementById('mcpTooltip');
    const modeSelector = document.getElementById('modeSelector');
    const micBtn = document.getElementById('micBtn');
    const voiceStatusEl = document.getElementById('voiceStatus');
    const attachmentChipsEl = document.getElementById('attachmentChips');
    let pendingAttachments = [];
    let isProcessing = false;
    let currentStreamEl = null;
    let skills = [];
    let selectedItemIdx = -1;
    let currentMode = 'confirm';
    let currentModel = '';
    let menuView = 'main'; // 'main', 'model', 'account', or 'apikey'
    const sessionStats = { messages: 0, toolCalls: 0, startTime: Date.now() };
    let accounts = [];
    let currentAccount = '';
    let apiKeyProfiles = [];
    let currentApiKey = '';
    let voiceActive = false;
    let compactMode = false;
    const MODELS = [
      { id: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6', short: 'Sonnet 4.6' },
      { id: 'claude-opus-4-6', label: 'Claude Opus 4.6', short: 'Opus 4.6' },
      { id: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5', short: 'Haiku 4.5' },
    ];

    // MCP tooltip — click to toggle, click outside to close
    mcpStatusEl.addEventListener('click', (e) => {
      e.stopPropagation();
      mcpTooltipEl.classList.toggle('visible');
    });
    document.addEventListener('click', (e) => {
      mcpTooltipEl.classList.remove('visible');
      // Close command menu when clicking outside
      if (!skillDropdown.contains(e.target) && e.target !== inputEl) {
        hideCommandMenu();
      }
    });

    // Mode selector
    modeSelector.addEventListener('click', (e) => {
      const btn = e.target.closest('.mode-btn');
      if (!btn) return;
      modeSelector.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentMode = btn.dataset.mode;
    });

    // Attach button — open native file picker via extension host
    document.getElementById('attachBtn').addEventListener('click', () => {
      vscode.postMessage({ type: 'openFilePicker' });
    });

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
        const preview = att.mimeType.startsWith('image/')
          ? '<img class="chip-preview" src="data:' + att.mimeType + ';base64,' + att.data + '">'
          : '';
        return '<span class="attachment-chip">' +
          preview +
          '<span class="chip-name">' + escapeHtml(att.name) + '</span>' +
          '<span class="chip-size">' + sizeTxt + '</span>' +
          '<span class="chip-remove" data-idx="' + idx + '">&times;</span>' +
          '</span>';
      }).join('');
      // Bind remove buttons
      attachmentChipsEl.querySelectorAll('.chip-remove').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const i = parseInt(e.target.dataset.idx);
          pendingAttachments.splice(i, 1);
          renderAttachmentChips();
        });
      });
    }

    // Send button
    sendBtn.addEventListener('click', () => sendMessage());

    // Auto-resize textarea
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
    inputEl.addEventListener('input', autoResize);

    // Tell the extension we're ready
    vscode.postMessage({ type: 'ready' });

    function sendMessage() {
      const text = inputEl.value.trim();
      if (!text || isProcessing) return;

      // Handle /clear locally — clear UI and tell extension to clear conversation
      if (text === '/clear') {
        inputEl.value = '';
        autoResize();
        messagesEl.innerHTML = '<div class="welcome"><h3>Fivetran Code</h3><p>Ask me about your Fivetran connectors, destinations, and groups.<br>Try: "Which connectors are active?" or "List my groups"</p></div>';
        // Reset mode to confirm
        currentMode = 'confirm';
        modeSelector.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
        modeSelector.querySelector('[data-mode="confirm"]').classList.add('active');
        vscode.postMessage({ type: 'clearHistory' });
        return;
      }

      // Handle VS Code-native commands locally
      if (text === '/memory') { inputEl.value = ''; autoResize(); vscode.postMessage({ type: 'openMemory' }); return; }
      if (text === '/terminal') { inputEl.value = ''; autoResize(); vscode.postMessage({ type: 'openTerminal' }); return; }
      if (text === '/settings') { inputEl.value = ''; autoResize(); vscode.postMessage({ type: 'openSettings' }); return; }
      if (text === '/docs') { inputEl.value = ''; autoResize(); vscode.postMessage({ type: 'openDocs' }); return; }
      if (text === '/voice') { inputEl.value = ''; autoResize(); toggleVoice(); return; }
      if (text === '/compact') { inputEl.value = ''; autoResize(); vscode.postMessage({ type: 'userMessage', text: '/compact', mode: currentMode }); return; }

      // Clear welcome on first message
      const welcome = messagesEl.querySelector('.welcome');
      if (welcome) welcome.remove();

      sessionStats.messages++;
      // Show attachment names in the user message bubble if any
      const attNames = pendingAttachments.map(a => a.name);
      const displayText = attNames.length > 0
        ? text + '\\n[Attached: ' + attNames.join(', ') + ']'
        : text;
      addMessage('user', displayText);
      inputEl.value = '';
      autoResize();
      setProcessing(true);
      const msg = { type: 'userMessage', text, mode: currentMode, attachments: pendingAttachments.length > 0 ? pendingAttachments : undefined };
      pendingAttachments = [];
      renderAttachmentChips();
      vscode.postMessage(msg);
    }

    // Command menu logic — slash menu with sections
    function getModelShortName(modelId) {
      const m = MODELS.find(m => m.id === modelId);
      return m ? m.short : modelId.split('-').slice(1, -1).join(' ');
    }

    function showCommandMenu(filter) {
      menuView = 'main';
      const query = filter.toLowerCase();

      // Build menu items grouped by section
      const contextItems = [
        { type: 'command', id: 'clear', name: 'Clear conversation', desc: 'Reset chat history' },
        { type: 'command', id: 'help', name: 'Help', desc: 'Show available commands' },
        { type: 'command', id: 'memory', name: 'Memory', desc: 'Open CLAUDE.md preference files' },
        { type: 'command', id: 'docs', name: 'Docs', desc: 'Open project README' },
        { type: 'command', id: 'terminal', name: 'Open in Terminal', desc: 'Launch Fivetran CLI in terminal' },
        { type: 'command', id: 'voice', name: 'Voice', desc: voiceActive ? 'Stop voice input' : 'Start voice input', badge: voiceActive ? 'ON' : '' },
        { type: 'command', id: 'compact', name: 'Compact', desc: compactMode ? 'Switch to normal responses' : 'Switch to concise responses', badge: compactMode ? 'ON' : '' },
      ];
      const modelItems = [
        { type: 'model', id: 'switch-model', name: 'Switch model...', badge: getModelShortName(currentModel) },
      ];
      const accountItems = [
        { type: 'command', id: 'account', name: 'Account & usage', desc: 'View session info and config' },
        { type: 'account-menu', id: 'switch-account', name: 'Switch account...', badge: currentAccount || 'default' },
        ...(apiKeyProfiles.length > 1 ? [{ type: 'apikey-menu', id: 'switch-apikey', name: 'Switch Claude API key...', badge: currentApiKey || 'default' }] : []),
        { type: 'command', id: 'settings', name: 'Settings', desc: 'Open Fivetran extension settings' },
      ];
      const skillItems = skills.map(s => ({ type: 'skill', id: s.name, name: '/' + s.name, desc: s.description }));

      // Filter all items
      const filterItem = (item) => {
        if (!query) return true;
        return item.name.toLowerCase().includes(query) ||
          (item.desc || '').toLowerCase().includes(query) ||
          (item.badge || '').toLowerCase().includes(query);
      };

      const filteredContext = contextItems.filter(filterItem);
      const filteredModel = modelItems.filter(filterItem);
      const filteredAccount = accountItems.filter(filterItem);
      const filteredSkills = skillItems.filter(filterItem);

      if (filteredContext.length + filteredModel.length + filteredAccount.length + filteredSkills.length === 0) {
        hideCommandMenu();
        return;
      }

      let html = '';
      let itemIdx = 0;

      if (filteredContext.length > 0) {
        html += '<div class="menu-section-header">Context</div>';
        filteredContext.forEach(item => {
          html += '<div class="skill-item' + (itemIdx === 0 ? ' selected' : '') + '" data-action="' + item.id + '" data-type="command" data-idx="' + itemIdx + '">' +
            '<span class="skill-name">' + escapeHtml(item.name) + '</span>' +
            '<span class="skill-desc">' + escapeHtml(item.desc) + '</span></div>';
          itemIdx++;
        });
      }

      if (filteredModel.length > 0) {
        html += '<div class="menu-section-header">Model</div>';
        filteredModel.forEach(item => {
          html += '<div class="skill-item has-badge' + (itemIdx === 0 ? ' selected' : '') + '" data-action="' + item.id + '" data-type="model" data-idx="' + itemIdx + '">' +
            '<span class="skill-name">' + escapeHtml(item.name) + '</span>' +
            '<span class="menu-item-badge">' + escapeHtml(item.badge) + '</span></div>';
          itemIdx++;
        });
      }

      if (filteredAccount.length > 0) {
        html += '<div class="menu-section-header">Account</div>';
        filteredAccount.forEach(item => {
          if (item.badge) {
            html += '<div class="skill-item has-badge' + (itemIdx === 0 ? ' selected' : '') + '" data-action="' + item.id + '" data-type="' + item.type + '" data-idx="' + itemIdx + '">' +
              '<span class="skill-name">' + escapeHtml(item.name) + '</span>' +
              '<span class="menu-item-badge">' + escapeHtml(item.badge) + '</span></div>';
          } else {
            html += '<div class="skill-item' + (itemIdx === 0 ? ' selected' : '') + '" data-action="' + item.id + '" data-type="' + item.type + '" data-idx="' + itemIdx + '">' +
              '<span class="skill-name">' + escapeHtml(item.name) + '</span>' +
              '<span class="skill-desc">' + escapeHtml(item.desc || '') + '</span></div>';
          }
          itemIdx++;
        });
      }

      if (filteredSkills.length > 0) {
        html += '<div class="menu-section-header">Skills</div>';
        filteredSkills.forEach(item => {
          html += '<div class="skill-item' + (itemIdx === 0 ? ' selected' : '') + '" data-action="' + item.id + '" data-type="skill" data-idx="' + itemIdx + '">' +
            '<span class="skill-name">' + escapeHtml(item.name) + '</span>' +
            '<span class="skill-desc">' + escapeHtml(item.desc) + '</span></div>';
          itemIdx++;
        });
      }

      selectedItemIdx = 0;
      skillDropdown.innerHTML = html;
      skillDropdown.classList.add('visible');
      bindMenuClicks();
    }

    function showModelSubmenu() {
      menuView = 'model';
      let html = '<div class="menu-back-btn" id="menuBack">&larr; Back</div>';
      html += '<div class="menu-section-header">Select Model</div>';

      MODELS.forEach((m, i) => {
        const isActive = m.id === currentModel;
        html += '<div class="skill-item' + (i === 0 ? ' selected' : '') + '" data-action="' + m.id + '" data-type="select-model" data-idx="' + i + '">' +
          '<div style="display:flex;align-items:center;gap:8px;">' +
          '<span class="menu-item-radio' + (isActive ? ' active' : '') + '"></span>' +
          '<div><span class="skill-name">' + escapeHtml(m.label) + '</span>' +
          '<div class="model-id">' + m.id + '</div></div></div></div>';
      });

      selectedItemIdx = 0;
      skillDropdown.innerHTML = html;
      skillDropdown.classList.add('visible');
      bindMenuClicks();

      // Back button
      document.getElementById('menuBack').addEventListener('click', () => {
        showCommandMenu('');
        inputEl.focus();
      });
    }

    function showAccountSubmenu() {
      menuView = 'account';
      let html = '<div class="menu-back-btn" id="menuBack">&larr; Back</div>';
      html += '<div class="menu-section-header">Select Account</div>';

      if (accounts.length === 0) {
        html += '<div class="skill-item"><span class="skill-desc">No accounts found from MCP server</span></div>';
      } else {
        accounts.forEach((a, i) => {
          const isActive = a.name === currentAccount;
          html += '<div class="skill-item' + (i === 0 ? ' selected' : '') + '" data-action="' + escapeHtml(a.name) + '" data-type="select-account" data-idx="' + i + '">' +
            '<div style="display:flex;align-items:center;gap:8px;">' +
            '<span class="menu-item-radio' + (isActive ? ' active' : '') + '"></span>' +
            '<span class="skill-name">' + escapeHtml(a.name) + '</span></div></div>';
        });
      }

      selectedItemIdx = 0;
      skillDropdown.innerHTML = html;
      skillDropdown.classList.add('visible');
      bindMenuClicks();

      document.getElementById('menuBack').addEventListener('click', () => {
        showCommandMenu('');
        inputEl.focus();
      });
    }

    function showApiKeySubmenu() {
      menuView = 'apikey';
      let html = '<div class="menu-back-btn" id="menuBack">&larr; Back</div>';
      html += '<div class="menu-section-header">Select Claude API Key</div>';

      if (apiKeyProfiles.length === 0) {
        html += '<div class="skill-item"><span class="skill-desc">No API key profiles configured</span></div>';
      } else {
        apiKeyProfiles.forEach((p, i) => {
          const isActive = p.label === currentApiKey;
          html += '<div class="skill-item' + (i === 0 ? ' selected' : '') + '" data-action="' + escapeHtml(p.label) + '" data-type="select-apikey" data-idx="' + i + '">' +
            '<div style="display:flex;align-items:center;gap:8px;">' +
            '<span class="menu-item-radio' + (isActive ? ' active' : '') + '"></span>' +
            '<span class="skill-name">' + escapeHtml(p.label) + '</span></div></div>';
        });
      }

      selectedItemIdx = 0;
      skillDropdown.innerHTML = html;
      skillDropdown.classList.add('visible');
      bindMenuClicks();

      document.getElementById('menuBack').addEventListener('click', () => {
        showCommandMenu('');
        inputEl.focus();
      });
    }

    // Prevent clicks inside the dropdown from bubbling to the document handler
    skillDropdown.addEventListener('click', (e) => e.stopPropagation());

    function bindMenuClicks() {
      skillDropdown.querySelectorAll('.skill-item').forEach(item => {
        item.addEventListener('click', () => handleMenuSelect(item));
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
          messagesEl.innerHTML = '<div class="welcome"><h3>Fivetran Code</h3><p>Ask me about your Fivetran connectors, destinations, and groups.<br>Try: "Which connectors are active?" or "List my groups"</p></div>';
          currentMode = 'confirm';
          modeSelector.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
          modeSelector.querySelector('[data-mode="confirm"]').classList.add('active');
          vscode.postMessage({ type: 'clearHistory' });
        } else if (action === 'help') {
          vscode.postMessage({ type: 'userMessage', text: '/help', mode: currentMode });
        } else if (action === 'account') {
          setProcessing(true);
          const welcome = messagesEl.querySelector('.welcome');
          if (welcome) welcome.remove();
          vscode.postMessage({ type: 'userMessage', text: '/account', mode: currentMode });
        } else if (action === 'memory') {
          vscode.postMessage({ type: 'openMemory' });
        } else if (action === 'terminal') {
          vscode.postMessage({ type: 'openTerminal' });
        } else if (action === 'settings') {
          vscode.postMessage({ type: 'openSettings' });
        } else if (action === 'docs') {
          vscode.postMessage({ type: 'openDocs' });
        } else if (action === 'voice') {
          toggleVoice();
        } else if (action === 'compact') {
          vscode.postMessage({ type: 'userMessage', text: '/compact', mode: currentMode });
        }
      } else if (type === 'model') {
        showModelSubmenu();
      } else if (type === 'select-model') {
        currentModel = action;
        vscode.postMessage({ type: 'switchModel', model: action });
        hideCommandMenu();
        inputEl.value = '';
        autoResize();
        inputEl.focus();
      } else if (type === 'account-menu') {
        showAccountSubmenu();
      } else if (type === 'apikey-menu') {
        showApiKeySubmenu();
      } else if (type === 'select-apikey') {
        currentApiKey = action;
        vscode.postMessage({ type: 'switchApiKey', label: action });
        hideCommandMenu();
        inputEl.value = '';
        autoResize();
        inputEl.focus();
      } else if (type === 'select-account') {
        currentAccount = action;
        vscode.postMessage({ type: 'switchAccount', name: action });
        hideCommandMenu();
        inputEl.value = '';
        autoResize();
        inputEl.focus();
      } else if (type === 'skill') {
        inputEl.value = '/' + action + ' ';
        hideCommandMenu();
        inputEl.focus();
        autoResize();
      }
    }

    function hideCommandMenu() {
      skillDropdown.classList.remove('visible');
      selectedItemIdx = -1;
      menuView = 'main';
    }

    function navigateMenu(direction) {
      const items = skillDropdown.querySelectorAll('.skill-item');
      if (items.length === 0) return;

      items[selectedItemIdx]?.classList.remove('selected');
      selectedItemIdx = Math.max(0, Math.min(items.length - 1, selectedItemIdx + direction));
      items[selectedItemIdx]?.classList.add('selected');
      items[selectedItemIdx]?.scrollIntoView({ block: 'nearest' });
    }

    inputEl.addEventListener('input', () => {
      const val = inputEl.value;
      if (val.startsWith('/') && !isProcessing) {
        const filter = val.slice(1).split(' ')[0]; // text after / before space
        if (!val.includes(' ')) {
          showCommandMenu(filter);
        } else {
          hideCommandMenu();
        }
      } else {
        hideCommandMenu();
      }
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
          if (menuView === 'model' || menuView === 'account') {
            showCommandMenu('');
          } else {
            hideCommandMenu();
          }
          return;
        }
      }

      if (e.key === 'Escape' && isProcessing) {
        e.preventDefault();
        vscode.postMessage({ type: 'cancelRequest' });
        return;
      }

      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });

    // Document-level Escape key handler — works even when input doesn't have focus
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && isProcessing) {
        e.preventDefault();
        vscode.postMessage({ type: 'cancelRequest' });
      }
    });

    function setProcessing(processing) {
      isProcessing = processing;
      inputEl.disabled = processing;
      sendBtn.disabled = processing;
      if (!processing) inputEl.focus();
    }

    const roleLabels = { user: 'You', assistant: 'Fivetran Code' };

    function addMessage(role, content) {
      const div = document.createElement('div');
      div.className = 'message ' + role;
      div.innerHTML = '<div class="role">' + (roleLabels[role] || role) + '</div><div class="content">' + escapeHtml(content) + '</div>';
      messagesEl.appendChild(div);
      scrollToBottom();
      return div;
    }

    function addAssistantMessage(content) {
      const div = document.createElement('div');
      div.className = 'message assistant';
      div.innerHTML = '<div class="role">Fivetran Code</div><div class="content">' + renderMarkdown(content) + '</div>';
      messagesEl.appendChild(div);
      scrollToBottom();
      return div;
    }

    function startStreaming() {
      const div = document.createElement('div');
      div.className = 'message assistant';
      div.innerHTML = '<div class="role">Fivetran Code</div><div class="content"></div>';
      messagesEl.appendChild(div);
      currentStreamEl = div.querySelector('.content');
      return currentStreamEl;
    }

    function appendStreamText(text) {
      if (!currentStreamEl) startStreaming();
      currentStreamEl.textContent += text;
      scrollToBottom();
    }

    function endStreaming() {
      if (currentStreamEl) {
        // Re-render with markdown
        const raw = currentStreamEl.textContent;
        currentStreamEl.innerHTML = renderMarkdown(raw);
        currentStreamEl = null;
        scrollToBottom();
      }
    }

    function addToolCard(name, input, status) {
      const div = document.createElement('div');
      div.className = 'tool-card ' + (status || '');
      div.id = 'tool-' + Date.now();
      const inputStr = JSON.stringify(input, null, 0);
      const truncated = inputStr.length > 100 ? inputStr.substring(0, 97) + '...' : inputStr;

      let statusIcon = '<span class="spinner">&#9696;</span>';
      if (status === 'success') statusIcon = '&#10003;';
      if (status === 'error') statusIcon = '&#10007;';

      div.innerHTML = statusIcon + ' <span class="tool-name">' + escapeHtml(name) + '</span>' +
        '<div class="tool-input">' + escapeHtml(truncated) + '</div>';
      messagesEl.appendChild(div);
      scrollToBottom();
      return div.id;
    }

    function updateToolCard(cardId, status) {
      // Tool cards are ephemeral — the completion updates the last one
    }

    function addConfirmCard(name, input) {
      const div = document.createElement('div');
      div.className = 'confirm-card';
      div.id = 'confirm-card';
      const inputStr = JSON.stringify(input, null, 2);
      div.innerHTML =
        '<div class="title">Confirm action: ' + escapeHtml(name) + '</div>' +
        '<pre><code>' + escapeHtml(inputStr) + '</code></pre>' +
        '<div class="actions">' +
        '<button class="btn-allow">Allow</button>' +
        '<button class="btn-deny">Deny</button>' +
        '</div>';
      div.querySelector('.btn-allow').addEventListener('click', () => respondConfirm(true));
      div.querySelector('.btn-deny').addEventListener('click', () => respondConfirm(false));
      messagesEl.appendChild(div);
      scrollToBottom();
    }

    function respondConfirm(confirmed) {
      const card = document.getElementById('confirm-card');
      if (card) card.remove();
      vscode.postMessage({ type: 'confirmResponse', confirmed });
    }

    function scrollToBottom() {
      messagesEl.scrollTop = messagesEl.scrollHeight;
    }

    function escapeHtml(str) {
      const div = document.createElement('div');
      div.textContent = str;
      return div.innerHTML;
    }

    function renderMarkdown(text) {
      // Simple markdown: bold, code, tables, lists, headers
      let html = escapeHtml(text);

      // Headers
      html = html.replace(/^### (.+)$/gm, '<h4>$1</h4>');
      html = html.replace(/^## (.+)$/gm, '<h3>$1</h3>');
      html = html.replace(/^# (.+)$/gm, '<h2>$1</h2>');

      // Markdown links [text](url)
      html = html.replace(/\\[([^\\]]+)\\]\\(([^)]+)\\)/g, '<a href="$2" target="_blank">$1</a>');

      // Auto-link bare URLs that aren't already in an <a> tag
      html = html.replace(/(?<!href="|">)(https?:\\/\\/[^\\s<]+)/g, '<a href="$1" target="_blank">$1</a>');

      // Bold
      html = html.replace(/\\*\\*(.+?)\\*\\*/g, '<strong>$1</strong>');

      // Inline code
      html = html.replace(/\`([^\`]+)\`/g, '<code>$1</code>');

      // Code blocks
      html = html.replace(/\`\`\`[\\w]*\\n([\\s\\S]*?)\`\`\`/g, '<pre><code>$1</code></pre>');

      // Lists
      html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
      html = html.replace(/(<li>.*<\\/li>)/s, '<ul>$1</ul>');

      // Simple table detection
      const lines = html.split('\\n');
      let inTable = false;
      const processed = [];
      for (const line of lines) {
        if (line.startsWith('|') && line.endsWith('|')) {
          if (line.match(/^[\\|\\s-]+$/)) continue; // separator
          const cells = line.split('|').filter(c => c.trim());
          const tag = !inTable ? 'th' : 'td';
          if (!inTable) { processed.push('<table>'); inTable = true; }
          processed.push('<tr>' + cells.map(c => '<' + tag + '>' + c.trim() + '</' + tag + '>').join('') + '</tr>');
        } else {
          if (inTable) { processed.push('</table>'); inTable = false; }
          processed.push(line);
        }
      }
      if (inTable) processed.push('</table>');
      html = processed.join('\\n');

      // Paragraphs: split on double newline, then convert single newlines
      // to <br> within each paragraph (but not inside <pre> or <table>)
      const paragraphs = html.split(/\\n\\n+/);
      html = paragraphs.map(function(p) {
        const trimmed = p.trim();
        if (!trimmed) return '';
        // Don't touch content inside pre/table blocks
        if (trimmed.indexOf('<pre>') !== -1 || trimmed.indexOf('<table>') !== -1) {
          return trimmed;
        }
        return '<p>' + trimmed.replace(/\\n/g, '<br>') + '</p>';
      }).filter(function(p) { return p; }).join('');

      return html;
    }

    // ── Voice input — macOS Dictation helper ──
    function toggleVoice() {
      if (voiceActive) {
        // Hide the tip
        voiceStatusEl.classList.remove('visible');
        micBtn.classList.remove('recording');
        voiceActive = false;
      } else {
        // Show dictation tip and focus the input
        voiceStatusEl.innerHTML = 'Click in the text box, then press <strong>Fn</strong> twice (or the 🌐 key) to start macOS Dictation. Speak your message, then press <strong>Fn</strong> again to stop.';
        voiceStatusEl.classList.add('visible');
        micBtn.classList.add('recording');
        voiceActive = true;
        inputEl.focus();
      }
    }

    micBtn.addEventListener('click', () => toggleVoice());

    // Handle messages from the extension host
    window.addEventListener('message', (event) => {
      const msg = event.data;
      switch (msg.type) {
        case 'filesSelected':
          pendingAttachments = pendingAttachments.concat(msg.files || []);
          renderAttachmentChips();
          inputEl.focus();
          break;
        case 'streamText':
          appendStreamText(msg.text);
          break;
        case 'streamEnd':
          endStreaming();
          break;
        case 'toolCallStart':
          sessionStats.toolCalls++;
          addToolCard(msg.name, msg.input, '');
          break;
        case 'toolProgress': {
          // Append streaming text to the last tool card
          const progressCards = messagesEl.querySelectorAll('.tool-card');
          if (progressCards.length > 0) {
            const lastCard = progressCards[progressCards.length - 1];
            let streamEl = lastCard.querySelector('.tool-stream');
            if (!streamEl) {
              streamEl = document.createElement('div');
              streamEl.className = 'tool-stream';
              lastCard.appendChild(streamEl);
            }
            streamEl.textContent += msg.text;
            streamEl.scrollTop = streamEl.scrollHeight;
            scrollToBottom();
          }
          break;
        }
        case 'toolCallEnd':
          // Update the last tool card
          const cards = messagesEl.querySelectorAll('.tool-card');
          if (cards.length > 0) {
            const last = cards[cards.length - 1];
            last.className = 'tool-card ' + (msg.success ? 'success' : 'error');
            const icon = msg.success ? '&#10003;' : '&#10007;';
            last.innerHTML = last.innerHTML.replace(/<span class="spinner">.*?<\\/span>/, icon);
          }
          break;
        case 'confirmationRequired':
          addConfirmCard(msg.name, msg.input);
          break;
        case 'complete':
          if (msg.fullText === '(Cancelled by user)') {
            addAssistantMessage('*(Cancelled by user)*');
          }
          setProcessing(false);
          break;
        case 'error':
          addMessage('assistant', 'Error: ' + msg.message);
          setProcessing(false);
          break;
        case 'ready':
          // Agent is initialized
          break;
        case 'metadata':
          // Skills, MCP server info, model, and accounts for UI features
          skills = msg.skills || [];
          if (msg.model) currentModel = msg.model;
          if (msg.accounts) accounts = msg.accounts;
          if (msg.activeAccount) currentAccount = msg.activeAccount;
          if (msg.apiKeyProfiles) apiKeyProfiles = msg.apiKeyProfiles;
          if (msg.activeApiKey) currentApiKey = msg.activeApiKey;
          // Show footer immediately on metadata (before first API call)
          var footerEl = document.getElementById('statusFooter');
          footerEl.style.display = 'flex';
          if (msg.model) {
            var ml = msg.model.replace('claude-', '').replace('-4-6', ' 4.6').replace('-4-5-20251001', ' 4.5');
            ml = ml.charAt(0).toUpperCase() + ml.slice(1);
            document.getElementById('footerModel').textContent = ml;
          }
          if (msg.activeApiKey) {
            document.getElementById('footerApiKey').textContent = msg.activeApiKey;
          }
          // Start session timer immediately
          if (!window._sessionTimerInterval) {
            window._sessionTimerInterval = setInterval(function() {
              var elapsed = Math.floor((Date.now() - sessionStats.startTime) / 1000);
              var mins = Math.floor(elapsed / 60);
              var secs = elapsed % 60;
              document.getElementById('sessionTimer').textContent = mins + ':' + (secs < 10 ? '0' : '') + secs;
            }, 1000);
          }
          if (msg.mcpServers && msg.mcpServers.length > 0) {
            mcpStatusEl.style.display = 'flex';
            const count = msg.mcpServers.length;
            mcpLabelEl.textContent = count + ' MCP server' + (count > 1 ? 's' : '');
            mcpTooltipEl.innerHTML = msg.mcpServers.map(function(s) {
              return '<div class="mcp-server-item"><span class="mcp-server-dot"></span>' + escapeHtml(s) + '</div>';
            }).join('');
          }
          break;
        case 'modelChanged':
          currentModel = msg.model;
          break;
        case 'accountChanged':
          currentAccount = msg.account;
          break;
        case 'apiKeyChanged':
          currentApiKey = msg.label;
          break;
        case 'compactChanged':
          compactMode = msg.compact;
          break;
        case 'usageUpdate': {
          var m = msg.metrics;
          var footer = document.getElementById('statusFooter');
          footer.style.display = 'flex';
          var pct = Math.min(100, m.contextUsagePercent).toFixed(0);
          document.getElementById('contextPct').textContent = pct + '%';
          var fill = document.getElementById('contextFill');
          fill.style.width = pct + '%';
          fill.className = 'context-fill' + (m.contextUsagePercent > 80 ? ' danger' : m.contextUsagePercent > 50 ? ' warning' : '');
          var totalTokens = m.totalInputTokens + m.totalOutputTokens;
          document.getElementById('tokenCount').textContent = totalTokens > 1000 ? (totalTokens / 1000).toFixed(1) + 'K tokens' : totalTokens + ' tokens';
          document.getElementById('cacheRate').textContent = (m.cacheHitRate * 100).toFixed(0) + '%';
          document.getElementById('sessionCost').textContent = '$' + m.estimatedCostUsd.toFixed(4);
          if (msg.model) {
            var modelLabel = msg.model.replace('claude-', '').replace('-4-6', ' 4.6').replace('-4-5-20251001', ' 4.5');
            modelLabel = modelLabel.charAt(0).toUpperCase() + modelLabel.slice(1);
            document.getElementById('footerModel').textContent = modelLabel;
          }
          if (msg.apiKeyLabel) {
            document.getElementById('footerApiKey').textContent = msg.apiKeyLabel;
          }
          // Start session timer on first usage update (if not already running)
          if (!window._sessionTimerInterval) {
            window._sessionTimerInterval = setInterval(function() {
              var elapsed = Math.floor((Date.now() - sessionStats.startTime) / 1000);
              var mins = Math.floor(elapsed / 60);
              var secs = elapsed % 60;
              document.getElementById('sessionTimer').textContent = mins + ':' + (secs < 10 ? '0' : '') + secs;
            }, 1000);
          }
          break;
        }
      }
    });
  </script>
</body>
</html>`;
}

export function getNonce(): string {
  let text = "";
  const possible =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}
