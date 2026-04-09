# Changelog

All notable changes to Fivetran Code are documented here.

## [0.3.1] — 2026-04-03

### Added
- **Claude API key switcher** — toggle between named Anthropic API key profiles at runtime (e.g., Personal vs Fivetran). VSCode slash menu submenu in Account section + CLI `/apikey` command. Config stored in `~/.fivetran-code/config.json` `anthropicApiKeys` array.
- **Session timer** — ticking clock (m:ss) in the context meter footer showing elapsed session time.
- **`query_cortex_agent` tool** — native streaming tool that calls Snowflake Cortex Agent REST API directly with SSE. Tokens stream live to the webview during execution.
- **Snowflake config** — `snowflakeAccount` and `snowflakePatToken` fields in config for direct Snowflake API access.
- **Tool streaming** — `onToolProgress` callback in `AgentCallbacks` for live tool output during execution.

### Fixed
- **`schema_prefix` bug** — Fivetran API expects `config.schema_prefix` not `config.schema` in connector creation. Fixed in both `create-connection` and `setup-postgresql-connection` tools. This was the root cause of repeated `setup_postgresql_connection` failures.
- **Max tool rounds** — increased from 15 to 50 for longer demo sessions.
- **`/account` display** — restructured to clearly show Fivetran account vs Claude API key. "Not connected" changed to "Default" for Fivetran account.
- **Anthropic SDK** — updated to ^0.82.0.

## [0.3.0] — 2026-04-02

### Added
- **`/fivetran-se-ai-solution-demo` skill** — 7-step guided demo: Source → Move → Transform → Agent → Activate. 6 industries (pharma, retail, higher ed, financial, agriculture, healthcare). Invoked from the Fivetran CLI.
- **Multi-industry dbt project** — consolidated `fivetran-se-ai-solution-demo-app/dbt_project/` with per-industry folders and `--select` execution
- **Cortex Agent DDL** — deterministic CREATE AGENT SQL per industry with full YAML spec
- **Activation app** — React + Firebase + Cloud Run dashboard at fivetran-activation-demo.web.app
- **Context meter footer** — live status bar below the message area (appears after first API response). Shows context usage %, token count, cache hit rate, and session cost. Bar turns yellow at 50% context, red at 80%.
- **SessionTracker** — per-session usage tracking in both VSCode and CLI frontends. Tracks API calls, tokens (input/output/cache), cost, and context usage. Resets on `/clear`.
- **Stop reason handling** — when Claude hits `max_tokens`, a warning message appears suggesting `/compact` or switching to a model with a larger output window.
- **`/account` usage section** — `/account` now includes a "Usage (this session)" section with API calls, token counts, cache hit rate, context usage %, and estimated cost.
- **Model identity in system prompt** — Claude correctly reports its model (Sonnet 4.6 / Opus 4.6 / Haiku 4.5) via `MODEL_LABELS` map in `system-prompt.ts`
- **Prompt caching** — `cache_control: { type: "ephemeral" }` on system prompt and last tool definition. ~90% input token savings on rounds 2+ of multi-tool conversations.
- **SE Demo MCP Server** — consolidated 7-tool MCP server (`se-demo`) replaces 3 separate servers (snowflake, dbt-core, fivetran-snowflake-hol-builder). Drops tool count from 130+ to ~20.
- **OAuth auth visibility** — `/account` now shows live auth method (oauth vs api-key) so users know if subscription is active
- **OAuth fallback warning** — stderr warning when OAuth silently falls back to API key (prevents unexpected credit burn)
- **Stream error detail** — error messages now include the actual failure reason instead of generic "Stream failed unexpectedly"
- **Snowflake key pair auth** — dbt-core MCP server uses RSA key pair instead of password for Snowflake connection
- **UI color swap** — "You" labels in green, "Fivetran Code" labels in blue

### Fixed
- OAuth token expiration silently draining API credits — now logs warning and shows live auth method
- `trigger_sync` sends `force: true` for immediate sync execution instead of waiting for scheduler queue

## [0.2.1] — 2026-03-30

### Added
- **`approve_certificate` tool** — Approve TLS/SSL certificates for connections via API (no browser needed)
- **`approve_fingerprint` tool** — Approve SSH host fingerprints for tunnel-based connections via API
- **`setup_postgresql_connection` tool** — Deterministic composite tool for full PostgreSQL setup in one call
- **Deterministic PostgreSQL setup in `create_connection`** — when service is `google_cloud_postgresql`, `postgres`, or `aurora_postgresql`, the tool automatically runs: test with `trust_certificates: true` + `trust_fingerprints: true` → reload schema → get schema config. No separate cert approval or browser needed.
- **`trigger_sync` now force-syncs and unpauses** — sends `{ force: true }` and auto-unpauses the connector so initial syncs actually start
- Tool count: **25 Fivetran tools** (up from 22)
- Improved schema/table selection UX — numbered lists for picking schemas and tables by number
- PostgreSQL `database` field now explicitly required in connector setup prompts
- Update method defaults communicated to user (Query-based / TELEPORT)
- **Escape to cancel** — press Escape to abort the running agent request in both VS Code extension and CLI terminal. Kills the Claude API stream mid-flight.
- **Conversation labels** — "user" → "You", "assistant" → "Fivetran Code" in both VS Code webview and CLI terminal

### Fixed
- TypeScript error in `open_connector_setup` — missing generic type on `.post()` call
- Agent no longer opens browser for credential-based connector certificate approval
- TLS certificate approval now uses `trust_certificates: true` on the test endpoint instead of separate approve → re-test flow that was unreliable due to API propagation delays
- Initial sync now actually triggers — connector is unpaused after sync is triggered

## [0.2.0] — 2026-03-24

### Added
- **Slash menu command palette** — `/` opens sectioned menu with Context, Model, Account, Skills
- **Model switcher** — toggle between Claude Sonnet 4.6, Opus 4.6, Haiku 4.5 at runtime
- **Extended slash commands** — `/account`, `/memory`, `/terminal`, `/settings`, `/docs`, `/voice`, `/compact`
- **Voice input** — macOS Dictation integration via mic icon or `/voice`
- **File attachments** — paperclip icon attaches images, PDFs, code files as multimodal content blocks
- **Claude Max OAuth** — `anthropicAuthToken` for $100-200/mo subscription auth (`claude setup-token`)
- **OAuth fallback** — tries auth token first, falls back to API key automatically
- **Account switching** — toggle Fivetran accounts via MCP server
- **Compact mode** — `/compact` toggle for concise, data-only responses
- **Intelligent connector setup** — metadata-driven flow: `get_connector_metadata` → create → auth → test → `reload_schema` → table selection → sync
- **4 new Fivetran tools** — `get_connector_metadata`, `test_connection`, `open_connector_setup`, `reload_schema` (22 total)
- **Non-interactive CLI** — `fivetran -q "..." --output json` for scripting, Claude Code, Cortex Code
- **CLI flags** — `--auto`, `--dry-run`, `--plain`, `--quiet`, `--no-color`, `--debug`, `--timeout`, `--model`
- **Env var defaults** — `FIVETRAN_QUIET=1`, `FIVETRAN_NO_COLOR=1`, `FIVETRAN_PLAIN=1`
- **Config merging** — env vars + config file + VS Code settings merged per-field
- **QUICKSTART.md** — 5-minute setup guide for teammates
- **Global CLI** — `sudo npm link` installs `fivetran` as a system-wide command

### Fixed
- CLI terminal output — responses persist in scrollback (banner moved out of Ink render tree)
- `/memory` scoped to current workspace project only
- `/switch account` parses MCP server string arrays correctly
- Exit code 0 on success in non-interactive mode
- Webview JS syntax error from unescaped `\n` in template literal

## [0.1.0] — 2026-03-23

### Added
- Initial release — VSCode extension + terminal CLI
- 18 Fivetran tools (list, get, sync, pause, resume, create, delete, schema, transformations)
- MCP server integration (auto-discovers tools from Claude Desktop config)
- Skills system (22+ skills from `~/.claude/skills/`)
- Preferences loader (CLAUDE.md files)
- Execution modes: Confirm actions, Auto-execute, Plan mode
- Editor tab + sidebar panel with webview chat UI
