# Fivetran Code

## What This Is

A conversational Fivetran management agent — powered by Claude's tool_use — delivered as both a **VSCode extension** (primary UI) and a **terminal CLI** (secondary). Users type natural language like "Which connectors are broken?" and the agent translates intent into Fivetran REST API calls.

Built for Fivetran Sales Engineers managing demo environments.

## Architecture

**Shared core engine with two frontends:**

```
src/core/    → Agent loop, tools, API client, config (NO UI code)
src/cli/     → Terminal frontend (React + Ink)
src/vscode/  → VSCode extension (webview panel)
```

The core engine is UI-agnostic. Both frontends hook into it via callbacks.

**Critical rule:** Never import from `src/cli/` or `src/vscode/` in `src/core/`. Never import `vscode` module in core.

## Conventions

### TypeScript
- Strict mode, ESM modules (`"type": "module"`)
- Zod for all tool input validation — never skip it
- Explicit type imports: `import type { ... } from "..."`
- File extensions in imports: `"./foo.js"` (ESM requirement)

### Agent Loop (`src/core/agent/loop.ts`)
- Manual `while` loop (not Agent SDK) for full streaming control
- Uses `AgentCallbacks` interface — never manipulate UI directly
- `client.messages.stream()` + `.on("text")` for live streaming
- `stream.finalMessage()` for complete tool_use block extraction
- Max 15 tool rounds per turn (safety valve)

### Tools (`src/core/tools/`)
- Every tool implements `FivetranTool` interface
- Every tool has `permission: "read" | "write"`
  - `read` tools auto-execute (list, get, describe)
  - `write` tools require user confirmation before execution (sync, pause, resume)
- Tool registry in `src/core/tools/index.ts` — add new tools there
- Tool input schemas defined with Zod, converted to JSON Schema for Claude

### Fivetran API (`src/core/api/client.ts`)
- Base URL: `https://api.fivetran.com/v1/`
- Auth: HTTP Basic Auth — `Authorization: Basic <base64(key:secret)>`
- Header: `Accept: application/json;version=2`
- Response envelope: `{ code, message, data: { items[], next_cursor } }`
- Pagination: cursor-based, limit 1-1000, default 100
- Rate limiting: exponential backoff on 429, max 3 retries

### Configuration Priority
1. Environment variables: `FIVETRAN_API_KEY`, `FIVETRAN_API_SECRET`, `ANTHROPIC_API_KEY`
2. Config file: `~/.fivetran-code/config.json` (0600 permissions)
3. VSCode settings: `fivetran.apiKey`, `fivetran.apiSecret`, `fivetran.anthropicApiKey`

### VSCode Extension (`src/vscode/`)
- Webview panel for rich chat UI (HTML/CSS/JS)
- Extension host runs the core engine
- Communication via `postMessage()` / `onDidReceiveMessage()`
- Uses VSCode CSS variables for theme integration (light/dark)

### Terminal CLI (`src/cli/`)
- React + Ink for terminal rendering
- `<Static>` for completed messages (prevents re-render flicker)
- `ink-text-input` for user input

## Testing
- Framework: Vitest
- Mock Fivetran API responses in `tests/fixtures/api-responses.ts`
- Test core engine independently of UI
- Test tools with mocked API client

## Build
- `npm run dev` → `tsx` for development (CLI)
- `npm run build` → builds both CLI and extension
- `npm run build:cli` → `tsup` bundles to `dist/cli.js` (ESM)
- `npm run build:ext` → `tsup` bundles to `dist/extension.cjs` (CJS, vscode external)
- `npm run typecheck` → TypeScript type checking
- `npm run test` → `vitest run`

## Git Workflow
- **All changes go through branches** — never commit directly to `main`
- Create a feature branch (`feature/description`) or fix branch (`fix/description`) for every change
- Commit to the branch, push, create a PR, and merge to `main`
- Keep `main` clean and deployable at all times
- After merge, delete the feature/fix branch

## v0.2 Tools (25 Fivetran + dynamic MCP)
**Read (auto-execute)**: list_groups, get_group_details, list_connections, get_connection, list_destinations, get_destination, list_users, get_schema_config, list_transformations, get_transformation, test_connection, open_connector_setup, get_connector_metadata, reload_schema
**Write (confirmation required)**: sync_connection, pause_connection, resume_connection, create_connection, delete_connection, update_schema_config, create_transformation, trigger_transformation, approve_certificate, approve_fingerprint, setup_postgresql_connection
**MCP tools**: Dynamically registered from connected MCP servers, prefixed `mcp__{server}__{tool}`

## v0.2 Features (shipped March 24, 2026)
- **Slash menu command palette** — `/` opens sectioned menu with Context, Model, Account, Skills
- **Model switcher** — toggle between Sonnet 4.6, Opus 4.6, Haiku 4.5 at runtime
- **Extended slash commands** — /account, /memory, /terminal, /settings, /docs, /voice
- **Voice input** — macOS Dictation integration via mic icon or /voice
- **File attachments** — paperclip icon opens native file picker; images, PDFs, code files sent as multimodal content blocks to Claude
- **Claude Max OAuth** — supports `anthropicAuthToken` for $100-200/mo subscription auth (via `claude setup-token`)
- **OAuth fallback** — tries auth token first, automatically falls back to API key on failure (no manual switching)
- **Account switching** — toggle Fivetran accounts via MCP server (fivetran2)
- **Intelligent connector setup** — metadata-driven flow: get_connector_metadata → create → auth → test → reload_schema → table selection → sync
- **CLI terminal** — `fivetran` global command, banner in stdout, responses persist in scrollback
- **Non-interactive CLI** — `fivetran -q "..." --output json` for scripting, Claude Code, Cortex Code
- **CLI flags** — `--auto`, `--dry-run`, `--plain`, `--quiet`, `--no-color`, `--debug`, `--timeout`, `--model`
- **Env var defaults** — `FIVETRAN_QUIET=1`, `FIVETRAN_NO_COLOR=1`, `FIVETRAN_PLAIN=1`
- **Compact mode** — `/compact` toggle for concise responses (no filler, no suggestions, data only)
- **Config merging** — env vars + config file + VS Code settings merged per-field (auth token from file works even when API key comes from env)

## Don't
- Import `vscode` module in `src/core/` — breaks CLI builds
- Import UI code (`src/cli/`, `src/vscode/`) in `src/core/` — breaks architecture
- Hard-code API keys anywhere — always use config manager
- Skip Zod validation on tool inputs — security boundary
- Execute write tools without user confirmation — safety requirement
- Make up connector names, IDs, or statuses — always use real API data
- Use `npm install` without `--break-system-packages` flag on Kelly's machine

## Key Files
- `src/core/agent/loop.ts` — The heart: agentic while-loop with streaming + tool dispatch + prompt caching
- `src/core/agent/usage-tracker.ts` — SessionTracker: per-session token/cost/context tracking
- `src/core/tools/types.ts` — Tool interface contract (FivetranTool, ToolResult)
- `src/core/tools/index.ts` — Tool registry (add new tools here)
- `src/core/api/client.ts` — Fivetran API client (auth, retry, pagination)
- `src/core/agent/system-prompt.ts` — Claude's system prompt (Fivetran expert persona + model identity)
- `src/core/tools/query-cortex-agent.ts` — Native streaming Cortex Agent tool (SSE → webview)
- `src/vscode/chat-provider.ts` — VSCode webview provider
- `src/cli/app.tsx` — Terminal REPL root component

## v0.3 Features (shipped April 2-3, 2026)
- **Claude API key switcher** — toggle between named Anthropic API key profiles (e.g., Personal vs Fivetran) at runtime. VSCode slash menu submenu + CLI `/apikey` command. Config: `anthropicApiKeys` array in `~/.fivetran-code/config.json`.
- **Context meter footer** — live status bar below the message area after first API response. Shows context %, token count, cache hit rate, session cost, and session timer (m:ss). Yellow at 50%, red at 80%.
- **Session timer** — ticking clock in the context meter footer showing elapsed session time.
- **SessionTracker** — per-session usage tracking in both VSCode and CLI (`src/core/agent/usage-tracker.ts`). Tracks API calls, tokens, cost, context %. Resets on `/clear`.
- **`/account` usage section** — includes "Usage (this session)" with API calls, tokens, cache rate, context %, and estimated cost. Shows Fivetran account + Claude API key label.
- **Stop reason handling** — when Claude hits `max_tokens`, a warning suggests `/compact` or model switch.
- **`query_cortex_agent` tool** — native streaming tool that calls Snowflake Cortex Agent REST API directly with SSE. Tokens stream live to webview during execution. Requires `snowflakeAccount` and `snowflakePatToken` in config.
- **Model identity in system prompt** — Claude correctly reports its model (Sonnet 4.6 / Opus 4.6 / Haiku 4.5) via `MODEL_LABELS` map in `system-prompt.ts`. PR #27.
- **Prompt caching** — `cache_control: { type: "ephemeral" }` on system prompt and last tool definition. System prompt + tools built once per turn, cached across rounds. Reduces input token costs ~90% on rounds 2+ of multi-tool conversations.
- **SE Demo MCP Server** — Consolidated 9-tool MCP server (`fivetran-se-demo-mcp-server`) replaces 3 separate servers (snowflake, dbt-core, fivetran-snowflake-hol-builder) for the AI Solution Demo. Drops tool count from 130+ to ~20 total. Repo: `kellykohlleffel/fivetran-se-demo-mcp-server`.
- **schema_prefix fix** — Fivetran API expects `config.schema_prefix` not `config.schema`. Fixed in both `create-connection` and `setup-postgresql-connection`.
- **Max tool rounds** — increased to 50 for longer demo sessions.
- **`max_tokens: 8192`** — doubled from 4096 to handle large skill prompts.
- **System prompt: prefer `query_cortex_agent`** — model always uses the native streaming tool for Cortex Agent queries, never the MCP `cortex_analyst` tool.
- **`create_demo_cortex_agent` MCP tool** — deterministic agent creation from pre-built DDL templates. Reads SQL from `references/agents/{industry}/create_cortex_agent.sql`, substitutes paths, executes in Snowflake. Eliminates model improvisation of DDL syntax.
- **`cleanup_demo` MCP tool** — preview-first teardown of all demo artifacts. Looks up Fivetran connector by schema prefix (no guessing), drops Snowflake agents + schemas, deletes the connector, resets activation app. One tool, two calls (preview → execute).
- **Dynamic activation columns** — React activation app derives table columns from data keys at render time. No more hardcoded column definitions. Sortable columns (click header for asc/desc/clear).
- **cortex_analyst SSE dedup** — paragraph-level deduplication in MCP server for clean agent responses. Agent-specific REST endpoint (`/api/v2/databases/{DB}/schemas/{SCHEMA}/agents/{AGENT}:run`).
- **dbt source schemas** — all 6 industries use `var()` for source schema override. dbt profiles.yml schema prefix removed to avoid `PHARMA_` prefix on non-pharma schemas.
- **Clickable URLs in webview** — markdown links `[text](url)` and bare URLs render as clickable `<a>` tags in the chat.
- **Session elapsed time in system prompt** — injected so the model uses actual duration in closing summaries instead of guessing.
- **Footer on load** — context meter footer appears immediately on extension load (before first API call) with model name and API key label.
- **Cold-start retry** — if model returns empty response on first turn, automatically retries without user having to type twice.

## v0.3 Skills
- **`/fivetran-se-ai-solution-demo`** — End-to-end AI solution in 25 min: Source → Move & Manage → Transform (dbt) → Agent (Cortex) → Activate (React app). 7-phase guided flow using native CLI tools + `se-demo` MCP server. Activation pushes insights to `fivetran-se-ai-solution-demo-app` (React + Firebase). 6 industries supported (pharma, retail, hed, financial, agriculture, healthcare).

### Demo Tool Map
| Step | Phase | Fivetran Code (native) | se-demo MCP |
|------|-------|----------------------|-------------|
| 1 | Prerequisites | — | run_snowflake_query, reset_activation_app |
| 2 | MOVE: Connect | setup_postgresql_connection, update_schema_config | — |
| 3 | MOVE & MANAGE: Sync | trigger_sync, get_connection | run_snowflake_query |
| 4 | TRANSFORM | — | dbt_run, dbt_test, run_snowflake_query |
| 5 | AGENT | — | create_demo_cortex_agent, list_cortex_agents |
| 6 | ASK | query_cortex_agent | — |
| 7 | ACTIVATE | — | activate_to_app |
| — | CLEANUP | — | cleanup_demo |
