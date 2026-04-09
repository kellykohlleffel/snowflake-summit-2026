# Fivetran Code

A conversational Fivetran management agent powered by Claude. Type natural language — the agent translates your intent into Fivetran REST API calls, MCP server tools, and Claude Skills.

**"Which connectors are broken?"** — Claude calls the Fivetran API, analyzes the results, and responds in plain English.

## Two Interfaces, One Engine

| Interface | Description |
|-----------|-------------|
| **VSCode Extension** (primary) | Rich chat panel with markdown rendering, tool call cards, confirmation dialogs, slash command palette, file attachments, voice input, MCP status indicator, account switching, theme-aware |
| **Terminal CLI** (secondary) | Interactive REPL via the `fivetran` command — streaming responses, color-coded output, persistent scrollback |

Both share a core engine (`src/core/`) that handles the agent loop, tool execution, and API communication. The frontends are thin UI wrappers.

## What It Can Do (v0.3)

### Fivetran Management

| Capability | Example Prompt | Permission |
|-----------|---------------|------------|
| List workspaces | "Show me my groups" | read |
| Inspect connectors | "What's the status of my Salesforce connector?" | read |
| Find broken connectors | "Which connectors are failing?" | read |
| Trigger sync | "Sync the HubSpot connector" | **write** (confirmation required) |
| Pause/resume | "Pause the Postgres connector" | **write** (confirmation required) |
| List destinations | "What destinations do I have?" | read |
| Inspect destinations | "Show me the Snowflake destination details" | read |
| List users | "Who has access to my Fivetran account?" | read |
| Schema management | "Show the schema config for this connector" | read |
| Create connectors | "Create a new Postgres connector" | **write** (confirmation required) |
| Delete connectors | "Delete the test connector" | **write** (confirmation required) |
| Transformations | "List my dbt transformations" | read |
| Create transformations | "Set up a new dbt transformation" | **write** (confirmation required) |

### Slash Commands

Type `/` in the input to open the command palette:

| Command | Description |
|---------|-------------|
| `/clear` | Clear conversation history |
| `/help` | Show available commands |
| `/account` | View account, auth method, model, and session usage (API calls, tokens, cache rate, context %, cost) |
| `/switch account` | Toggle between Fivetran accounts (via MCP server) |
| `/switch model` | Switch between Claude Sonnet 4.6, Opus 4.6, and Haiku 4.5 |
| `/memory` | Open CLAUDE.md preference files and project memory |
| `/settings` | Open Fivetran extension settings |
| `/terminal` | Launch the `fivetran` CLI in a VS Code terminal |
| `/docs` | Open project README |
| `/voice` | Toggle voice input — shows macOS Dictation instructions |
| `/compact` | Toggle compact mode — concise responses, no filler |
| `/skill-name` | Invoke a Claude Skill (22+ available) |

### Context Meter

A live status footer appears immediately when the extension loads:

| Metric | Description |
|--------|-------------|
| **Model** | Active Claude model (e.g., Sonnet 4.6) — updates when you switch |
| **API Key** | Active Anthropic API key profile (e.g., Fivetran Anthropic API Key) |
| **Context %** | How much of Claude's context window is used. Bar turns yellow at 50%, red at 80%. |
| **Tokens** | Running total of input + output tokens for the session |
| **Cache rate** | Percentage of input tokens served from prompt cache (higher = lower cost) |
| **Session cost** | Estimated API cost for the current session |
| **Timer** | Session elapsed time (m:ss), ticking from extension load |

Session metrics reset when you run `/clear`. If Claude hits its output token limit, a warning suggests using `/compact` or switching models. URLs in chat responses are clickable.

### File Attachments

Click the **paperclip icon** to attach files to your message. Supported types:

| Type | Formats | How it's sent to Claude |
|------|---------|------------------------|
| **Images** | PNG, JPG, GIF, WebP (up to 5 MB) | Base64 image content block (multimodal) |
| **Documents** | PDF (up to 25 MB) | Base64 document content block |
| **Code/Text** | SQL, Python, TypeScript, JSON, YAML, CSV, Markdown, etc. (up to 500 KB) | Text content block with file label |

Attach a screenshot of a Fivetran error, a JSON API response, a dbt model, or a CSV file — Claude sees and analyzes it alongside your question.

### Voice Input

Click the **mic icon** or type `/voice` to enable voice input. Uses macOS Dictation (press **Fn** twice to start/stop). Transcribed text appears in the input box for review before sending.

### Authentication

Uses Anthropic API keys for Claude. Supports multiple named API key profiles for switching between accounts at runtime (e.g., Personal vs Fivetran).

| Method | How to set up |
|--------|---------------|
| **API Key** | Set `ANTHROPIC_API_KEY` env var or add to config file |
| **Multiple API Keys** | Add `anthropicApiKeys` array to config file (see config example below) |

Switch keys at runtime via the slash menu (Account > Switch Claude API key) or CLI `/apikey` command. Check which key is active with `/account`.

### MCP Server Integration

Connects to your Claude Desktop MCP servers automatically. Any tools from connected servers are available to the agent — Snowflake queries, PSE Intelligence, Fivetran account management, and more.

### Skills System

Type `/` to browse 22+ Claude Skills via the command palette. Skills inject specialized context into the conversation:
- `/dbt-project-builder` — Generate complete dbt projects from Fivetran connector data
- `/fivetran-connector-builder` — Build custom Fivetran connectors with the Connector SDK
- `/mcp-server-builder` — Build custom MCP servers for Claude Desktop
- `/cortex-agent-orchestrator` — Build multi-agent orchestration with Snowflake Cortex

### Preferences

Automatically loads coding preferences from `~/.claude/CLAUDE.md` (global) and project-level `CLAUDE.md` files, injecting them into the agent's system prompt.

## Quick Start

### Prerequisites

- Node.js >= 18
- A [Fivetran API key and secret](https://fivetran.com/docs/rest-api/getting-started)
- An [Anthropic API key](https://console.anthropic.com/) or Claude Max subscription

### Install & Configure

```bash
git clone https://github.com/kellykohlleffel/fivetran-cli.git
cd fivetran-cli
npm install
```

Set your credentials (pick one method):

**Option 1 — Config file** (recommended):
```bash
mkdir -p ~/.fivetran-code
cat > ~/.fivetran-code/config.json << 'EOF'
{
  "fivetranApiKey": "your_key",
  "fivetranApiSecret": "your_secret",
  "anthropicApiKey": "your_default_anthropic_key",
  "anthropicApiKeys": [
    { "label": "Fivetran Anthropic API Key", "key": "sk-ant-..." },
    { "label": "Personal Anthropic API Key", "key": "sk-ant-..." }
  ],
  "snowflakeAccount": "your_snowflake_account",
  "snowflakePatToken": "your_snowflake_pat_token"
}
EOF
chmod 600 ~/.fivetran-code/config.json
```

**Option 2 — Environment variables:**
```bash
export FIVETRAN_API_KEY=your_key
export FIVETRAN_API_SECRET=your_secret
export ANTHROPIC_API_KEY=your_anthropic_key
```

**Option 3 — VSCode settings:**
Configure in Settings > Extensions > Fivetran Code.

### VSCode Extension (Permanent Install)

```bash
npm run build:ext
npx @vscode/vsce package --no-dependencies
code --install-extension fivetran-code-0.2.0.vsix
```

After install, reload VSCode (`Cmd+Shift+P` > "Reload Window"). The Fivetran icon appears in the activity bar.

### VSCode Extension (Development)

1. Open this repo in VSCode
2. Press `F5` to launch the Extension Development Host
3. Click the Fivetran icon in the activity bar
4. Start chatting

### Terminal CLI

```bash
# Install globally
sudo npm link

# Interactive REPL
fivetran

# Non-interactive (for scripting, Claude Code, Cortex Code)
fivetran -q "list my connectors" --output json --quiet

# Development mode (tsx)
npm run dev
```

### Non-Interactive Mode

The CLI works as both an interactive REPL and a subprocess tool. Use `-q` / `--query` for scripting:

```bash
# JSON output for machine parsing
fivetran -q "which connectors are broken?" --output json --quiet

# Auto-execute write operations (no confirmation prompts)
fivetran -q "sync the HubSpot connector" --auto --output json --quiet

# Compact output (low token count for AI agents)
fivetran -q "show my groups" --output compact --no-color

# With timeout for CI/automation
fivetran -q "list destinations" --timeout 30
```

| Flag | Short | Description |
|------|-------|-------------|
| `--query <text>` | `-q` | Run a single query and exit |
| `--output <format>` | `-o` | `json`, `compact`, or `table` (default: table) |
| `--auto` | | Auto-execute write operations without confirmation |
| `--dry-run` | | Plan mode — show what write operations would do without executing |
| `--plain` | | Strip emoji and markdown from output (agent-friendly) |
| `--timeout <sec>` | | Max execution time in seconds (default: 120) |
| `--quiet` | | Suppress banner and progress (results only to stdout) |
| `--no-color` | | Strip ANSI color codes |
| `--debug` | | Include tool_calls in JSON output (hidden by default) |
| `--model <id>` | | Override model (e.g., `claude-haiku-4-5-20251001` for speed) |

**Env var defaults:** Set `FIVETRAN_QUIET=1`, `FIVETRAN_NO_COLOR=1`, or `FIVETRAN_PLAIN=1` to avoid repeating flags.

**stdout/stderr separation:** Results go to stdout, progress/errors go to stderr. This means `2>/dev/null` gives clean output and `$?` gives the exit code (0 = success, 1 = error).

## Architecture

```
src/
├── core/                 # Shared engine (UI-agnostic)
│   ├── agent/            # Agent loop with streaming + tool dispatch + prompt caching
│   │   ├── loop.ts       # Agentic while-loop (multimodal, prompt caching, stop reason handling)
│   │   ├── conversation.ts # Message history (text + image/doc content blocks)
│   │   ├── claude-client.ts # API key + OAuth auth support
│   │   ├── system-prompt.ts # Dynamic system prompt with model identity, MCP/skills/preferences
│   │   └── usage-tracker.ts # SessionTracker — per-session token/cost/context tracking
│   ├── tools/            # 25 Fivetran tools with Zod validation
│   ├── api/              # Fivetran REST API client (auth, retry, pagination)
│   ├── config/           # Credential management (env, file, VSCode — merged)
│   ├── mcp/              # MCP server client (STDIO transport, tool adapter)
│   ├── skills/           # Skill discovery and loading from ~/.claude/skills/
│   ├── preferences/      # CLAUDE.md preference loader
│   └── utils/            # Constants, formatters
├── cli/                  # Terminal frontend (React + Ink)
│   ├── components/       # Chat, streaming, tool display, input
│   └── hooks/            # useAgent bridge to core engine
└── vscode/               # VSCode extension (webview)
    ├── extension.ts      # Activate/deactivate
    ├── webview-html.ts   # Full webview UI (command palette, attachments, voice)
    ├── agent-controller.ts # Core engine ↔ webview bridge (multimodal content blocks)
    ├── agent-manager.ts  # Shared manager (file picker, account switching, voice)
    ├── chat-panel-manager.ts # Editor tab webview panel
    └── chat-provider.ts  # Sidebar webview provider
```

The core engine uses a **callback-based agent loop** (`AgentCallbacks` interface) — both frontends subscribe to events (`onStreamText`, `onToolCallStart`, `onToolCallEnd`, `onConfirmationRequired`, etc.) without the core knowing which UI is active.

## Tools (v0.2)

### Built-in Fivetran Tools (25)

| Tool | Type | Description |
|------|------|-------------|
| `list_groups` | read | List all groups/workspaces |
| `get_group_details` | read | Get group details by ID |
| `list_connections` | read | List connectors in a group |
| `get_connection` | read | Get connector details |
| `test_connection` | read | Test connector auth and connectivity |
| `get_connector_metadata` | read | Get config schema for any connector type from Fivetran API |
| `open_connector_setup` | read | Open connector setup page in browser (for OAuth) |
| `reload_schema` | read | Discover schemas/tables from the source (Fetch Schema) |
| `get_schema_config` | read | Get connector schema configuration |
| `list_destinations` | read | List all destinations |
| `get_destination` | read | Get destination details |
| `list_users` | read | List account users |
| `list_transformations` | read | List dbt transformations |
| `get_transformation` | read | Get transformation details |
| `sync_connection` | write | Trigger a connector sync |
| `pause_connection` | write | Pause a connector |
| `resume_connection` | write | Resume a paused connector |
| `create_connection` | write | Create a new connector |
| `delete_connection` | write | Delete a connector |
| `update_schema_config` | write | Update connector schema |
| `create_transformation` | write | Create a dbt transformation |
| `trigger_transformation` | write | Trigger a transformation run |
| `approve_certificate` | write | Approve TLS/SSL certificate for a connection (auto-detects pending) |
| `approve_fingerprint` | write | Approve SSH host fingerprint for a connection (auto-detects pending) |
| `setup_postgresql_connection` | write | Create and fully set up a PostgreSQL connector in one step (create → test → cert → schema) |

### Dynamic MCP Tools

Any tools from connected MCP servers are registered at runtime with the naming convention `mcp__{server}__{tool}`. MCP server configuration is read from `~/Library/Application Support/Claude/claude_desktop_config.json`.

## Build

```bash
npm run build          # Build both CLI and extension
npm run build:cli      # CLI only → dist/cli.js (ESM)
npm run build:ext      # Extension only → dist/extension.cjs (CJS, bundled)
npm run typecheck      # TypeScript type checking
npm run test           # Run tests with Vitest
```

### Packaging the Extension

```bash
npx @vscode/vsce package --no-dependencies
code --install-extension fivetran-code-0.2.0.vsix --force
```

## Configuration

All config sources are **merged** — each field uses the highest-priority source that provides it:

1. **Environment variables**: `FIVETRAN_API_KEY`, `FIVETRAN_API_SECRET`, `ANTHROPIC_API_KEY`, `ANTHROPIC_AUTH_TOKEN`
2. **Config file**: `~/.fivetran-code/config.json` (0600 permissions)
3. **VSCode settings**: `fivetran.apiKey`, `fivetran.apiSecret`, `fivetran.anthropicApiKey`, `fivetran.anthropicAuthToken`

This means you can have Fivetran credentials in env vars and the Claude auth token in the config file — both are picked up.

## Safety Model

- **Read tools** auto-execute (list, get, describe operations)
- **Write tools** require explicit user confirmation before execution
- The agent proposes the action, the UI shows what will happen, and the user approves or denies
- MCP tools default to read permission (auto-execute)

## Tech Stack

- **TypeScript** (strict mode, ESM)
- **Anthropic SDK** — Claude API with tool_use, streaming, and multimodal content blocks
- **Fivetran REST API v2** — HTTP Basic Auth, cursor-based pagination
- **MCP SDK** — `@modelcontextprotocol/sdk` for MCP server integration
- **React + Ink** — terminal UI framework
- **VSCode Webview API** — extension chat panel with command palette
- **Zod** — tool input validation
- **tsup** — bundling (esbuild-based, CJS for extension, ESM for CLI)
- **Vitest** — testing

## Roadmap

- **v0.4**: Real Fivetran Activations via Census API, deterministic connector skills for non-PG connectors (Salesforce, etc.), session memory / conversation persistence, unit tests, Connect Card API for minimal OAuth

## License

Internal tool — Fivetran SE team use.
