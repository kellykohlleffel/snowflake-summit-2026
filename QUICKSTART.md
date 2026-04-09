# Snowflake Summit 2026 HOL -- Quick Start

## Prerequisites

Install these before running setup.sh. The script will check for each and tell you what's missing.

| Tool | Version | Install |
|------|---------|---------|
| Node.js | 18+ | [nodejs.org](https://nodejs.org/) (LTS .pkg) |
| Python | 3.12+ | [python.org](https://python.org/downloads/) (.pkg) |
| VSCode | Latest | [code.visualstudio.com](https://code.visualstudio.com/) |
| Cortex Code CLI | Latest | [Snowflake docs](https://docs.snowflake.com/en/developer-guide/cortex-code/overview) |
| GitHub CLI | Latest | Auto-installed by setup.sh |
| Xcode CLT | Latest | Auto-installed by setup.sh |

**After installing VSCode**, enable the `code` command: `Cmd+Shift+P` > "Shell Command: Install 'code' command in PATH"

**After installing Cortex Code CLI**, verify: `cortex --version`

If cortex is installed to `~/.local/bin`, add to PATH:
```bash
echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc
```

## Setup (5 minutes)

```bash
git clone https://github.com/kellykohlleffel/snowflake-summit-2026.git
cd snowflake-summit-2026
./setup.sh
```

The script is re-runnable. If it stops (missing prerequisite, auth needed), fix the issue and run it again.

## Credentials

After setup.sh completes, fill in 3 config files:

### File 1: ~/.fivetran-code/config.json

```json
{
  "fivetranApiKey": "your-fivetran-api-key",
  "fivetranApiSecret": "your-fivetran-api-secret",
  "anthropicApiKey": "your-anthropic-api-key",
  "snowflakeAccount": "your-snowflake-account-locator",
  "snowflakePatToken": "your-snowflake-pat-token"
}
```

### File 2: ~/.snowflake/connections.toml

```toml
default_connection_name = "summit-hol"

[summit-hol]
account = "your-snowflake-account-locator"
user = "your-snowflake-user"
password = "your-snowflake-pat-token"
warehouse = "HANDS_ON_LAB_WAREHOUSE"
database = "your-snowflake-database"
```

### File 3: mcp-servers/se-demo/.env

Fill in lines 2-4 and 8 (Snowflake credentials and database) plus lines 16-18 (Fivetran API credentials).

## Verify

1. Reload VSCode: `Cmd+Shift+P` > "Developer: Reload Window"
2. Click the Snowflake icon in the activity bar
3. Type: `list my groups` (verifies Fivetran MCP server)
4. Type: `/fivetran-snowflake-hol-sfsummit2026` (runs the HOL)

## Lab Laptop Prep

Each lab laptop needs:
- Its own Snowflake user (e.g., `hol_lab_user3`)
- Its own Snowflake database (e.g., `HOL_DATABASE_3`)
- A laptop ID for activation app isolation (e.g., `lab3`)
- Shared: Fivetran API key/secret, Anthropic API key, Snowflake account

Run setup.sh on each laptop, fill in that laptop's credentials, verify with `list my groups`.
