# Snowflake Summit 2026 HOL -- Quick Start

## Two flows

| Flow | Command | Use case |
|------|---------|----------|
| **Dev** | `./setup.sh` | Local development; placeholder creds you fill in manually |
| **Dedicated lab laptop** | `./setup.sh <1-6>` | Bare/non-Fivetran-imaged Macs (labuser1–6); reads `setup/creds/labuser{N}.env`; runs unattended |
| **Instructor laptop** | `./setup.sh 7` | Fivetran-imaged work laptops (labuser7); same script with interactive prompts + per-step backup of any prior skill dir; revert via `./restore-instructor-backup.sh --confirm` |
| Any mode | add `--dry-run` | Preview phases; zero state changes |
| Instructor | add `--auto` | Skip the interactive prompts (for re-runs) |

## Prerequisites

setup.sh **auto-installs** any missing prerequisites via native Apple-signed installers (no Homebrew):

| Tool | Version |
|------|---------|
| Node.js | 20 LTS |
| Python | 3.12+ |
| VSCode | Latest |
| Cortex Code CLI | Latest (Snowflake official installer) |
| GitHub CLI | Latest |
| Xcode CLT | Latest |

The first thing `./setup.sh` does is check each prerequisite and install anything missing. You can run `./setup.sh --dry-run` to preview without making changes.

## Lab-laptop quick start (labuser1–6 or labuser7)

```bash
git clone https://github.com/kellykohlleffel/snowflake-summit-2026.git
cd snowflake-summit-2026

# Drop the per-laptop credential file at setup/creds/labuserN.env (Kelly distributes via 1Password/scp)
ls -la setup/creds/labuser${N}.env

# Optional preview
./setup.sh ${N} --dry-run

# Run it
./setup.sh ${N}
```

**On lab laptops 1–6:** runs unattended; safe-merges credentials from `setup/creds/labuser${N}.env` into VSCode `settings.json`, `~/.fivetran-code/config.json`, `~/.snowflake/connections.toml`, and `mcp-servers/se-demo/.env`. Existing keys you didn't manage are preserved by the safe-merge.

**On instructor laptop 7:** same flow, plus:
- Interactive prompts before each major phase ("About to: X. Press Enter to proceed."). Read the description; press Enter to continue, or Ctrl-C to abort.
- Skill directory at `~/.claude/skills/fivetran-snowflake-hol-sfsummit2026-v2/` is backed up to `~/.summit-hol-backups/<TS>-labuser7/skills/` before overwrite. Revert any time with `./restore-instructor-backup.sh --confirm`.
- The lab VSIX (`fivetran-kkohlleffel.cortex-code-for-vscode@0.1.0`) installs alongside any existing Cortex Code, Fivetran Code, Snowflake, or Databricks extensions — different publisher.name, no collision.
- Pass `--auto` to skip the interactive prompts on subsequent re-runs.

## Dev-flow quick start (no LABUSER_NUM)

```bash
git clone https://github.com/kellykohlleffel/snowflake-summit-2026.git
cd snowflake-summit-2026
./setup.sh
```

Setup writes config templates with `YOUR_*` placeholders. Fill them in:

### File 1: `~/.fivetran-code/config.json`

```json
{
  "fivetranApiKey": "your-fivetran-api-key",
  "fivetranApiSecret": "your-fivetran-api-secret",
  "anthropicApiKey": "your-anthropic-api-key",
  "snowflakeAccount": "your-snowflake-account-locator",
  "snowflakePatToken": "your-snowflake-pat-token"
}
```

### File 2: `~/.snowflake/connections.toml`

```toml
default_connection_name = "summit-hol"

[summit-hol]
account = "your-snowflake-account-locator"
user = "your-snowflake-user"
password = "your-snowflake-pat-token"
warehouse = "HANDS_ON_LAB_WAREHOUSE"
database = "your-snowflake-database"
```

### File 3: `mcp-servers/se-demo/.env`

Copy from `mcp-servers/se-demo/.env.example` and fill in Snowflake + Fivetran + PG_HOL_PASSWORD values. This file is gitignored.

## Verify

1. Reload VSCode: `Cmd+Shift+P` > "Developer: Reload Window"
2. Click the Snowflake icon in the activity bar
3. Type: `list my groups` (verifies Fivetran MCP server)
4. Type: `/fivetran-snowflake-hol-sfsummit2026-v2` (runs the HOL)

The skill walks through the 8-step lab flow:

1. Prerequisites Check
2. MOVE -- Fivetran Connects the Source
3. MOVE & MANAGE -- Fivetran Syncs to Snowflake
4. TRANSFORM -- Build dbt Project
5. AGENT -- Create & Deploy Cortex Agent
6. ASK -- Interactive Q&A
7. ACTIVATE -- Fivetran pushes to the Business App
8. What's Next?

## Reverting an instructor-mode setup.sh run

```bash
./restore-instructor-backup.sh --dry-run    # preview
./restore-instructor-backup.sh --confirm    # apply
```

Restores `~/.claude/skills/fivetran-snowflake-hol-sfsummit2026-v2/` from the most recent backup at `~/.summit-hol-backups/.latest`. Idempotent.

## Between-session cleanup (instructors)

To purge attendee-created Snowflake schemas between lab sessions, run the skill's `cleanup_demo` MCP tool from each laptop (the lab skill exposes this at Step 8). For Fivetran connector + activation-app cleanup across all 7 laptops, use `./instructor-reset-all-labs.sh`.
