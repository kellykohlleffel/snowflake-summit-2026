# Cortex Code for VSCode

A polished VSCode host for the [Snowflake Cortex Code](https://docs.snowflake.com/en/user-guide/cortex-code/cortex-code) CLI.

Runs real `cortex` sessions inside a Fivetran Code-inspired webview with chat bubbles, tool call cards, sectioned slash menu, and a live status footer — the Cortex Code experience you already know, in a polished VSCode home.

## What this is (and isn't)

- **It IS** a VSCode extension that spawns the `cortex` CLI as a background subprocess in stream-json mode and renders its structured events as polished chat bubbles inside a custom webview. Available as both a sidebar view and an editor tab — both surfaces share a single session.
- **It is NOT** a replacement for or a fork of Snowflake's Cortex Code. MCP integration, skills, agent behavior, and Snowflake authentication all happen in the real binary, unchanged. This extension is just a nicer-looking window into the same session.
- **It does NOT** affect the separate Fivetran Code VSCode extension. The two coexist in VSCode and can be used independently.

## Prerequisites

1. **VSCode** 1.96 or later
2. **Snowflake Cortex Code CLI** installed and on your `PATH`. Verify with:
   ```bash
   cortex --version
   ```
3. Any MCP servers you want Cortex Code to load configured in `~/.snowflake/cortex/mcp.json` — this extension does not change or override that config.
4. *(Optional)* An Anthropic API key in `~/.fivetran-code/config.json` — used for the footer token counter only (see "Footer token counts" below). Works without one; the metrics just stay at zero.

## Installation

### From VSIX

```bash
git clone https://github.com/kellykohlleffel/cortex-code-for-vscode.git
cd cortex-code-for-vscode
npm install
npm run build
npx vsce package   # produces cortex-code-for-vscode-0.1.0.vsix
code --install-extension cortex-code-for-vscode-0.1.0.vsix --force
```

Then **Cmd+Shift+P → Developer: Reload Window**.

### Development (F5 debug)

```bash
git clone https://github.com/kellykohlleffel/cortex-code-for-vscode.git
cd cortex-code-for-vscode
npm install
npm run build
code .
```

Press `F5` in VSCode to launch a new Extension Development Host window with the extension loaded.

## Usage

1. Click the **Snowflake icon** in VSCode's activity bar
2. The Cortex Code panel opens in the sidebar AND an editor tab auto-opens (controlled by `cortexCodeForVscode.preferEditorTab`)
3. A new cortex session starts automatically
4. Type your prompt and hit Enter
5. Responses, tool calls, and confirmation prompts render as polished chat bubbles and cards

Both surfaces share one cortex session — messages sent from either the sidebar or the editor tab flow through the same subprocess and both views update in sync.

### Slash menu

Type `/` in the input box to open a sectioned command palette (matches Fivetran Code's UX):

- **Context** — `/clear`, `/restart`, `/help`, `/memory`, `/docs`, `/terminal`, `/voice`, `/compact` (with ON/OFF badge)
- **Model** — "Switch pricing model..." submenu for choosing Sonnet 4.6 / Opus 4.6 / Haiku 4.5 (affects the footer cost estimate only)
- **Account** — `/account` (session info + usage), `/mcp` (MCP server list + toggle instructions), `/upgrade` (update cortex CLI), `/settings`
- **Skills** — all skills discovered via `cortex skill list`, grouped by category (Project / Plugin / Bundled / Remote / Stage). Selecting one inserts `/<skillname> ` into the input. The host translates this to `$<skillname>` before forwarding to cortex (cortex's real skill invocation prefix), so the user bubble shows the familiar `/` prefix.

### Compact mode

Toggle with `/compact`. When ON, every user message is prepended with a concise-response hint before being sent to cortex. The slash menu badge reflects current state.

### Mode selector

Three execution modes available above the input area (matches Fivetran Code's UX):

- **Confirm actions** (default) — request confirmation before executing write tools
- **Auto-execute** — run all tools without confirmation
- **Plan mode** — plan actions without executing

Note: all three modes are currently visual-only because cortex uses `--dangerously-allow-all-tool-calls` (always auto-executes). The mode value is sent with every message for future permission support when Snowflake adds stream-json mode/permission events.

### Voice

Click the microphone icon next to the input box (or run `/voice`) to toggle the macOS Dictation helper. The mic icon pulses red when active. Press `fn` twice to start dictation, speak your message, then press `fn` again to stop.

### Welcome card

On session start, the welcome card shows Snowflake connection info read from `~/.snowflake/connections.toml` (the default connection):

- Connection name, Warehouse, Database, Model
- Instruction files loaded (e.g., `~/.claude/CLAUDE.md`, project `CLAUDE.md`)

The card disappears on first message. The same information is available anytime via `/account`.

### Header

- **MCP server indicator** — green dot with server count (e.g., "6 MCP servers"). Click to see the dropdown list of connected servers. Read from `~/.snowflake/cortex/mcp.json`.

### Footer

Live status bar with:

- **Model** — mapped from cortex's reported model (`auto` displays as the configured pricing model's friendly name)
- Snowflake Cortex label
- **Context %** — with a colored progress bar (green / yellow at 50% / red at 80%)
- **Token count** — real BPE token counts from Anthropic's count_tokens endpoint (see "Footer token counts" below)
- **Cache rate** — stays at "—" because Snowflake Cortex Complete doesn't report cache hits
- **Session cost** — estimated USD, based on the selected pricing model's rate card
- **Session timer** — ticks every second from session start
- **Session status dot** — running / starting / exited
- **Cortex version**

### Footer token counts

Snowflake Cortex Complete (the LLM backend cortex uses) does not surface per-call token counts to the cortex CLI — every `result.usage` field arrives as zero. To show real numbers, the extension accumulates the assistant text, tool uses, and tool results it observes flowing through cortex's stream-json stream, then tokenizes them using Anthropic's `count_tokens` endpoint. This is **not model invocation** — count_tokens is free, doesn't run a model, and just returns BPE counts from Claude's real tokenizer.

**Known limitation:** cortex prepends its own system prompt and registers tool schemas that are invisible in the stream-json output, so input counts are a lower bound on true billing — typically 3–15K tokens short depending on how many tools cortex registered. Output counts are exact because the extension sees the full assistant text. The pricing model setting lets you pick which Claude variant's rate card to apply for the cost estimate (Snowflake doesn't expose which variant `auto` resolved to).

The API key is read from `~/.fivetran-code/config.json` (same file Fivetran Code uses). If the file is missing or has no key, metrics silently stay at zero.

## Configuration

Open VSCode Settings and search for "cortex code":

| Setting | Default | Purpose |
|---|---|---|
| `cortexCodeForVscode.binaryPath` | `"cortex"` | Path to the cortex CLI binary |
| `cortexCodeForVscode.cwd` | `""` | Working directory for the cortex subprocess. Empty = VSCode workspace root |
| `cortexCodeForVscode.autoStart` | `true` | Automatically start a session when the panel opens |
| `cortexCodeForVscode.preferEditorTab` | `true` | Auto-open the editor tab alongside the sidebar view |
| `cortexCodeForVscode.pricingModel` | `"claude-sonnet-4-6"` | Which Claude model's pricing to apply for the footer cost estimate (`claude-sonnet-4-6` / `claude-opus-4-6` / `claude-haiku-4-5-20251001`) |

## Architecture

```
┌─ Extension Host ──────────────────────────┐    ┌─ Webview Targets ────────┐
│                                           │    │                          │
│  CortexSessionManager                     │    │  Sidebar (WebviewView)   │
│    ├─ CortexHost (subprocess, stream-json)│───▶│     shared state         │
│    ├─ CortexOutputParser                  │    │                          │
│    ├─ TokenCounter (Anthropic count_tokens)│   │  Editor Tab (Panel)      │
│    ├─ CortexUsageTracker                  │───▶│     shared state         │
│    └─ targets: Set<WebviewTarget>         │    │                          │
│                                           │    │  (both get broadcasts)   │
│  ChatViewProvider  ←┐                     │    │                          │
│  ChatPanelManager  ←┘ register as targets │    │                          │
└───────────────────────────────────────────┘    └──────────────────────────┘
```

- **CortexSessionManager** owns the cortex subprocess, output parser, token counter, and usage tracker. It broadcasts events (assistant text deltas, tool calls, footer updates, usage metrics) to every registered webview target.
- **ChatViewProvider** (sidebar) and **ChatPanelManager** (editor tab) both register as targets and forward user input back to the session manager. They are thin adapters — no state of their own.
- **CortexHost** spawns `cortex` with `--output-format stream-json --include-partial-messages --dangerously-allow-all-tool-calls` and pipes stdin/stdout. User input is written as JSON lines; cortex emits newline-delimited JSON events matching the Anthropic Messages API shape.
- **CortexOutputParser** maps cortex events to webview messages:
  - `system.init` → `metadata` (model, version, skills, MCP servers)
  - `stream_event.content_block_delta` (text_delta) → `streamText` (live)
  - `assistant` with `tool_use` → `toolCallStart`
  - `user` with `tool_result` → `toolCallEnd`
  - `result` → turn boundary (triggers tracker end-of-turn and count_tokens)
- Tool cards for noisy internal tools (`skill`, `Glob`, `Read`, `Bash`, `Task`) are suppressed in the webview — they'd otherwise dump full SKILL.md contents and long file lists into the chat during skill loading.
- Tool card results are truncated to ~100 characters (matching Fivetran Code). Parallel tool calls of the same name (e.g., 3x `run_snowflake_query`) each get their own FIFO queue slot so all spinners resolve to checkmarks.
- Assistant bubbles render markdown live as streaming deltas arrive: bold, italic, inline code, fenced code blocks, links (including bare `https://` URLs), `#`/`##`/`###`/`####` headings, bullet and numbered lists (with blank-line tolerance), and pipe-delimited tables with styled header rows.

## Relationship to Fivetran Code

This project **does not share runtime code** with [fivetran-code](https://github.com/kellykohlleffel/fivetran-cli). The visual design patterns (CSS, chat bubbles, tool card layout, footer, slash menu, sectioned palette) and the dual-surface architecture (shared AgentManager + targets + ChatPanelManager) are copied and adapted from Fivetran Code's webview as reference, but the two extensions are completely independent:

- Different GitHub repo
- Different VSCode extension ID
- Different activity bar icon
- Different build output
- Both can be installed side-by-side in VSCode

## Limitations

- **Per-call token counts from Snowflake are not available** — the footer uses Anthropic's count_tokens as a workaround, which under-counts by the size of cortex's hidden system prompt and tool schemas (typically 3–15K tokens). Snowflake enhancement request filed.
- **No interrupt/cancel in stream-json mode** — the Cancel / Stop button is a no-op because cortex's stream-json input protocol has no documented interrupt event. The only way to stop a runaway turn is Restart, which wipes the session. Snowflake enhancement request filed.
- **Mode selector is visual-only** — Confirm actions / Auto-execute / Plan mode buttons are present for UX parity but cortex always auto-executes (no stream-json permission/mode events). Snowflake enhancement request filed.
- **Snowflake reports `model=auto`** — we can't know which Claude variant actually ran, so cost estimates use the configured pricing model setting.
- **No file attachment multimodal support** — text files get inlined as markdown; images and PDFs are not forwarded.
- **Single session per subprocess.** Restart replaces the existing session.
- **Not yet published to the VSCode Marketplace.** Install via `.vsix` only.

## Changelog

See [CHANGELOG.md](CHANGELOG.md).

## License

TBD (internal tool as of v0.1.0).

## Related projects

- [fivetran-cli](https://github.com/kellykohlleffel/fivetran-cli) — Fivetran Code's VSCode extension + CLI + MCP server
- [Snowflake Cortex Code](https://docs.snowflake.com/en/user-guide/cortex-code/cortex-code) — the CLI this extension hosts
