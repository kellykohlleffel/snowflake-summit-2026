# Snowflake Summit 2026 Hands-on Lab

**From Connectors to Data Agents in 20 Minutes**

A self-contained repo for running the Fivetran ODI (Open Data Integration) hands-on lab at Snowflake Summit 2026. Attendees walk through the full data lifecycle -- Source, Move & Manage, Transform, Agent, Activate -- using Cortex Code as the interface and Fivetran as the engine.

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

This triggers a guided 7-step flow:

1. **Prerequisites** -- verify APIs, select industry, choose schema prefix
2. **MOVE** -- connect a PostgreSQL source via Fivetran
3. **MOVE & MANAGE** -- sync data to Snowflake, learn about Fivetran along the way
4. **TRANSFORM** -- run dbt models (staging, marts, semantic views)
5. **AGENT** -- create a Snowflake Cortex Agent from pre-built DDL templates
6. **ASK** -- interactive Q&A with the Cortex Agent
7. **ACTIVATE** -- push insights to a React business app

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

Prerequisites: Node.js 18+, Python 3.12+, VSCode, Cortex Code CLI, GitHub CLI.

```bash
git clone https://github.com/kellykohlleffel/snowflake-summit-2026.git
cd snowflake-summit-2026
./setup.sh
```

The script handles everything -- checks prerequisites, builds extensions, installs MCP servers, creates config templates. Re-runnable. See [QUICKSTART.md](QUICKSTART.md) for the full walkthrough.

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
