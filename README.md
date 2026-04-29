# Snowflake Summit 2026 Hands-on Lab

**From Connectors to Data Agents in 20 Minutes**

A self-contained repo for running the Fivetran ODI (Open Data Infrastructure) hands-on lab at Snowflake Summit 2026. Attendees walk through the full data lifecycle -- Source, Move & Manage, Transform, Agent, Activate -- using Cortex Code as the interface and Fivetran as the engine.

## What's in this repo

| Directory | What it is |
|-----------|------------|
| `cortex-code/` | Cortex Code VSCode extension (primary UI) |
| `fivetran-code/` | Fivetran Code MCP server (25 Fivetran API tools exposed to Cortex) |
| `mcp-servers/se-demo/` | SE Demo MCP server (Snowflake, dbt, activation tools) |
| `apps/activation-app/` | React activation app + Cloud Run API + dbt project (7 industries) |
| `skills/` | HOL skill that drives the guided 7-step lab flow |
| `docs/` | HOL abstract and concept doc |

## How it works

The lab is driven by a single slash command in Cortex Code:

```
/fivetran-snowflake-hol-sfsummit2026-v2
```

This triggers a guided 8-step flow:

1. **Prerequisites Check** -- verify APIs, select industry, choose schema prefix
2. **MOVE -- Fivetran Connects the Source** -- create a PostgreSQL connector via the Fivetran REST API
3. **MOVE & MANAGE -- Fivetran Syncs to Snowflake** -- sync data + learn how Fivetran manages it
4. **TRANSFORM -- Build dbt Project** -- run staging, mart, and semantic view models with dbt Run Cache
5. **AGENT -- Create & Deploy Cortex Agent** -- build a Snowflake Cortex Agent from a single DDL template
6. **ASK -- Interactive Q&A** -- ask the Cortex Agent natural-language questions against the semantic view
7. **ACTIVATE -- Fivetran pushes to the Business App** -- push insights to a React business app
8. **What's Next?** -- lab summary, CTAs, optional cleanup

## 7 Industries

Each attendee picks an industry. All share the same PostgreSQL source, same Fivetran account, same Snowflake warehouse -- differentiated by schema prefix.

| Industry | Domain | Source Table |
|----------|--------|-------------|
| Pharma | Clinical Trials Risk | pharma.phr_records |
| Retail | Customer Re-engagement | retail.rdp_records |
| Higher Education | Student Retention | higher_education.hed_records |
| Financial | Transaction Monitoring | financial_services.fpr_records |
| Agriculture | Livestock Weather Risk | agriculture.agr_records |
| Healthcare | Clinical Decision Support | healthcare.cds_records |
| Supply Chain | Demand Intelligence | supply_chain.spl_records |

## Setup

Prerequisites are auto-installed if missing (Node 20 LTS, Python 3.12, VSCode, Cortex Code CLI, GitHub CLI — all via native Apple-signed installers; no Homebrew).

```bash
git clone https://github.com/kellykohlleffel/snowflake-summit-2026.git
cd snowflake-summit-2026

./setup.sh              # Dev flow (placeholder creds, manual fill-in)
./setup.sh <1-6>        # Dedicated lab laptop mode (reads setup/creds/labuser{N}.env)
./setup.sh 7            # Instructor laptop mode (interactive, with per-step backups)
./setup.sh <1-7> --dry-run   # Preview what would install; zero state changes
./setup.sh 7 --auto     # Instructor mode without interactive prompts
```

**Lab modes:**
- **labuser1–6 (dedicated lab laptops):** Bare/non-Fivetran-imaged Macs. Script runs unattended; safe-merges all credential files from `setup/creds/labuser{N}.env`. Aggressive — overwriting OK.
- **labuser7 (instructor laptops):** Fivetran-imaged work laptops with existing daily-work configs. Same script with two extra protections: (1) interactive prompts before each phase ("About to: X. Press Enter to proceed.") so the operator sees what's about to change, (2) backup of `~/.claude/skills/fivetran-snowflake-hol-sfsummit2026-v2/` to `~/.summit-hol-backups/<TS>-labuser7/skills/` before overwrite. Revert via `./restore-instructor-backup.sh --confirm`. Pass `--auto` to skip prompts.

The script checks prerequisites (auto-installs anything missing), builds extensions, installs MCP servers, creates config templates, and runs `verify.sh` on lab-laptop runs. Re-runnable. See [QUICKSTART.md](QUICKSTART.md) for the full walkthrough.

## Between-session cleanup (instructors)

To purge attendee-created Snowflake schemas between lab sessions, run the skill's `cleanup_demo` MCP tool from each laptop (or invoke it from the lab skill flow at Step 8). `instructor-reset-all-labs.sh` handles Fivetran connector cleanup + activation-app reset across all 7 laptops, but Snowflake schema drops are intentionally delegated to `cleanup_demo` — it's the tested teardown path and avoids adding a snowflake-connector-python runtime dependency to the instructor laptop. Wiring up the SQL-execution stub at `instructor-reset-all-labs.sh:174` is post-Summit work.

## Architecture

```
Attendee
   |
   v
Cortex Code (VSCode extension)
   |
   |--- cortex CLI subprocess (Snowflake Cortex Code)
   |       |
   |       |--- fivetran-code MCP server (25 Fivetran REST API tools)
   |       |--- se-demo MCP server (Snowflake SQL, dbt, activation)
   |       |--- built-in tools (bash, read, write, edit, web_search, snowflake_sql_execute)
   |
   v
Snowflake (data warehouse + Cortex Agents)
Fivetran (data movement + management)
React App (activation / business insights)
```

## Docs

- [QUICKSTART.md](QUICKSTART.md) -- 5-minute setup guide
- [docs/summit_hol_abstract.md](docs/summit_hol_abstract.md) -- Lab abstract
- [docs/summit_hol_concept_doc.md](docs/summit_hol_concept_doc.md) -- Lab concept doc
