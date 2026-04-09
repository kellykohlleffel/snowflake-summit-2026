# Changelog

All notable changes to **Cortex Code for VSCode** are documented here.

## [0.1.0] — 2026-04-08 / 2026-04-09

Initial release. Built across two sessions.

### Added

- **Stream-json subprocess host** — spawns `cortex` with `--output-format stream-json --include-partial-messages --dangerously-allow-all-tool-calls`, pipes stdin/stdout, parses newline-delimited JSON events matching the Anthropic Messages API shape. No PTY, no ANSI parsing.
- **Real footer token metrics via Anthropic `count_tokens`** — TokenCounter wraps the free, non-model-invocation count_tokens endpoint; CortexUsageTracker accumulates per-turn content and tokenizes on cortex's `result` event. Input counts are a lower bound (cortex's system prompt and tool schemas are invisible). Output counts are exact. API key loaded from `~/.fivetran-code/config.json`; graceful degradation to zero if missing. (PR #1)
- **Session manager refactor** — new `CortexSessionManager` owns the subprocess, parser, token counter, usage tracker, and skills catalog. Broadcasts events to a set of registered webview targets so multiple surfaces can share one session. (PR #3)
- **Editor tab view** — new `ChatPanelManager` hosts a `WebviewPanel` in `ViewColumn.One`. Sidebar + editor tab share a single cortex session; messages from either surface flow through the same subprocess and both views update in sync. New setting `cortexCodeForVscode.preferEditorTab` (default true). (PR #3)
- **Slash menu parity with Fivetran Code** — sectioned Context / Model / Account / Skills layout. New commands: `/voice`, `/compact` (with ON/OFF badge), `/account` (session info + usage), `/mcp` (MCP server list + toggle), `/upgrade` (runs `cortex update`). Model section with pricing model submenu (Sonnet / Opus / Haiku). (PR #3, #7)
- **Skills discovery** — `cortex skill list` invoked on session start; slash menu groups skills by category (Project / Plugin / Bundled / Remote / Stage).
- **MCP server indicator** — green-dot header badge with server count. Click to see dropdown list. Read from `~/.snowflake/cortex/mcp.json`. (PR #5)
- **Welcome card** — shows Snowflake connection info (from `~/.snowflake/connections.toml`), model, and instruction file count. Disappears on first message. (PR #6)
- **Mode selector** — Confirm / Auto-execute / Plan mode toggle above input area. Visual-only pending Snowflake stream-json permission support. (PR #8, #10)
- **Voice input** — microphone icon toggles macOS Dictation helper with red pulse animation. (PR #8)
- **File attachments** — paperclip icon opens native file picker; text files inlined as markdown. (PR #8)
- **Markdown rendering** — bold, italic, inline/fenced code, links (including bare `https://` URLs), `#`-`####` headings, bullet/ordered lists (with blank-line tolerance), pipe-delimited tables with styled header rows, paragraph spacing. Re-renders on every stream delta. (PR #4, #11)
- **Tool card green on success** — tool name turns green on success, red on error (matches border color). (PR #12)

### Changed

- **Assistant bubble label** — "Cortex Code" (was "Assistant"). (PR #2)
- **Thinking indicator** — "Cortex Code is thinking..." (was "Cortex is thinking..."). (PR #4)
- **Footer version** — drops redundant `cortex` prefix. (PR #2)
- **Footer model label** — maps cortex's `auto` to the configured pricing model name. (PR #3)
- **Header layout** — removed Restart/Clear buttons (available via slash menu). Header: brand + version + spacer + MCP indicator. (PR #5)
- **Slash menu skills** — display as `/skillname` (not `$skillname`); translated to `$` at send time. (PR #4)
- **Tool card bodies** — truncated to ~100 chars. Full JSON payloads no longer dominate chat. (PR #11)
- **Parallel tool card resolution** — FIFO queue per tool name. Multiple concurrent calls to the same tool all resolve their spinners independently. (PR #12)
- **Context % calculation** — accumulates across all turns (was stuck at 0%). (PR #10)
- **Mode selectors** — moved from footer to input toolbar. (PR #10)
- **Paragraph spacing** — `<p>` tags get 10px bottom margin. (PR #12)

### Removed

- Session-started chat boilerplate (footer already shows model + status). (PR #2)
- Tool cards for internal plumbing tools (skill, Glob, Read, Bash, Task). (PR #4)
- Parser-owned usage computation (session manager owns the lifecycle). (PR #1)

### Upstream requests filed with Snowflake Cortex Code

1. **Populate `result.usage` in stream-json mode** — currently all zeros; forces external re-tokenization for metrics.
2. **Add an interrupt event to stream-json input** — cancel turn without killing session.
3. **Ship a native VSCode extension for Cortex Code** — first-party polished webview host.
4. **Add permission/mode support to stream-json** — set execution mode and receive permission prompts for approve/deny.
