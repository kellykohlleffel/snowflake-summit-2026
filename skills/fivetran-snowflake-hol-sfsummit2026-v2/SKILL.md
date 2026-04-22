---
name: fivetran-snowflake-hol-sfsummit2026
description: "Snowflake Summit 2026 Hands-on Lab — end-to-end Fivetran ODI solution: Source → Move & Manage → Transform → Agent → Activate. Guides a lab attendee through 25 minutes of interactive, educational hands-on steps. Use for: SF Summit 2026 HOL, Snowflake Summit hands-on lab, Fivetran ODI lab."
---

# Fivetran x Snowflake Hands-on Lab — SF Summit 2026

## Purpose

Guide a hands-on lab attendee through the complete Fivetran ODI solution in 25-30 minutes. The solution tells Fivetran's full ODI story:

**MOVE & MANAGE → TRANSFORM → AGENT → ACTIVATE**

Source (PostgreSQL) → Fivetran sync → Snowflake → dbt (staging/mart/semantic) → Cortex Agent → Interactive Q&A → Fivetran Activation → React app (real-time)

The attendee never leaves the CLI. Every step uses CLI tools, MCP server tools, or both.

## When to Use

Trigger on: "run the hands-on lab", "SF Summit HOL", "Snowflake Summit lab", "Fivetran ODI lab", "hands-on lab", "/fivetran-snowflake-hol-sfsummit2026"

## Required MCP Servers

Before starting, verify these MCP servers are connected:
- **se-demo** — consolidated server with Snowflake queries, Cortex Agent, dbt execution, and activation tools (7 tools total)
- **fivetran-code** — Fivetran API tools (connectors, syncs, schema config, cert approval, setup_postgresql_connection, trigger_sync, etc.)

If either is missing, tell the attendee: "The lab environment is missing a required MCP server. Please check your configuration."

## Step Heading Rule (MANDATORY)

At the START of every step (Steps 1-7), output the step heading as a markdown `##` header BEFORE doing anything else for that step. Use these exact headings:
- `## Step 1: Prerequisites Check`
- `## Step 2: MOVE — Connect the Source`
- `## Step 3: MOVE & MANAGE — Sync Data to Snowflake`
- `## Step 4: TRANSFORM — Build & Run dbt Project`
- `## Step 5: AGENT — Create & Deploy Cortex Agent`
- `## Step 6: ASK — Interactive Q&A`
- `## Step 7: ACTIVATE — Push to Business App`

This creates clear visual section breaks in the chat UI. Do NOT skip these headings.

## Formatting Rules (MANDATORY)

- **Do NOT use markdown blockquote markers** (`>`) in your responses.
- **Do NOT use horizontal rules** (`---` or `***`).
- **ALWAYS insert a blank line between every paragraph** in educational content. Each block of text MUST be separated by an empty line (`\n\n`). Never run paragraphs together with only a single newline — the UI needs double newlines to render paragraph spacing. This is critical for readability.
- These rules ensure consistent rendering across both Fivetran Code and Cortex Code VSCode extensions.

## Lab Roadmap (Show First)

When the skill is invoked, ALWAYS start by showing this roadmap AND asking for industry selection. Do NOT make any tool calls or run any prerequisites until the user selects an industry. This is mandatory even if no industry argument is provided.

```
FIVETRAN x SNOWFLAKE HANDS-ON LAB — 25 Minutes
══════════════════════════════════════════

Step 1  Prerequisites Check .............. 2 min
Step 2  MOVE: Connect the Source ......... 3 min
Step 3  MOVE & MANAGE: Sync to Snowflake . 3-5 min
Step 4  TRANSFORM: Build dbt Project ..... 5-8 min
Step 5  AGENT: Create & Deploy Cortex Agent  3 min
Step 6  ASK: Interactive Q&A ............. 5-8 min
Step 7  ACTIVATE: Push to Business App ... 2-3 min

Industry: [selected below]
MCP Servers: fivetran-code + se-tools
```

Then IMMEDIATELY ask (do NOT skip this — output this text before doing anything else):

"Which industry would you like to use?

1. **pharma** — Clinical Trials Risk Analysis
2. **retail** — Customer Re-engagement & Price Optimization
3. **higher education** — Student Retention & Success
4. **financial** — Transaction Monitoring & Customer Health
5. **agriculture** — Livestock Weather Risk
6. **healthcare** — Clinical Decision Support
7. **supply chain** — Demand Intelligence

Pick a number or name."

**STOP here and wait for the user's response.** Do not proceed to Step 1 until the user selects an industry.

## Speed Run Mode

If the SE says "speed run" or provides a connection_id:
- Skip Step 2 and Step 3 (connector already exists and data is synced)
- Start at Step 4 with the existing connection
- Total time: ~12-15 minutes

---

## Lab Defaults

These defaults are used unless the user overrides them:
- **Default Fivetran group (destination):** `HOL_DATABASE_1` (group_id: `verbatim_suite`)
- **Default PostgreSQL database:** `industry-se-demo`
- **Known schemas/tables** (the database contains these 7):
  - `pharma.phr_records` (750 rows)
  - `retail.rdp_records` (750 rows)
  - `higher_education.hed_records` (751 rows)
  - `financial_services.fpr_records` (751 rows)
  - `agriculture.agr_records` (750 rows)
  - `healthcare.cds_records` (750 rows)
  - `supply_chain.spl_records` (750 rows)

### Environment Detection (for booth lab laptops)

The defaults above reflect Kelly's dev Snowflake account. When this skill runs
on a dedicated lab laptop (Snowflake Summit / BDL booth), the per-laptop values
come from env vars set by `setup.sh`:

- `LABUSER_NUM` (1–7) — which lab user this laptop is. If set, you're on a
  booth lab laptop.
- `SNOWFLAKE_DATABASE` — e.g., `SF_LABUSER3_DB`. Overrides the `HOL_DATABASE_1`
  default in the readiness summary and downstream calls.
- `FIVETRAN_GROUP_ID` — e.g., `really_woof`. Overrides the default
  `verbatim_suite` group for connector creation.
- `LAPTOP_ID` — e.g., `laptop3`. Used by `activate_to_app` / `reset_activation_app`
  to namespace per-laptop data in the activation React app.
- `HOL_INSTRUCTOR` — `"true"` only on labuser-7 laptop. Controls whether
  Step 8 cleanup is offered.

If `LABUSER_NUM` is set, tell the user in Step 1 that you're running as
lab user `$LABUSER_NUM` against `$SNOWFLAKE_DATABASE`. The MCP tools read
these env vars automatically — you just need to phrase the narrative
accurately (e.g., "I'll create the connector in your lab destination
`$FIVETRAN_GROUP_ID`").

---

## Step 1: Prerequisites Check (2 min)

**IMPORTANT:** When starting Step 1, output the heading "## Step 1: Prerequisites Check" as the first line before doing anything else — matching the heading style used in Steps 2-7.

### 1.1 Verify APIs + Pre-warm

Run these three calls in parallel (do NOT call `list_groups` — use the default group):
- `mcp__se-demo__run_snowflake_query` — `SELECT CURRENT_ACCOUNT(), CURRENT_ROLE(), CURRENT_WAREHOUSE(), CURRENT_DATABASE();`
- `mcp__se-demo__reset_activation_app` with `industry="all"` — silently resets stale data and wakes up Cloud Run (do NOT mention this to the audience)
- `mcp__fivetran-code__list_groups` — verifies the fivetran-code MCP server is connected and the Fivetran API is reachable. Include the result in the readiness summary (e.g., "✓ Fivetran API: Connected (N groups)").

### 1.2 Load Industry Configuration

Based on the industry choice, load the connection details and dataset information from the reference files appended to this skill.

**IMPORTANT**: The reference files contain pre-provisioned PostgreSQL source credentials, dataset summaries, dbt model guidance, sample Cortex Agent questions, and activation queries. Use these — do not ask for connection details.

### 1.3 Ask for Schema Prefix

**MANDATORY — DO NOT SKIP THIS STEP.**

Tell the user you'll use the default group **HOL_DATABASE_1** (they can say a different group name if needed), then ask:

**"What schema prefix should I use?"** — explain that the prefix becomes the Snowflake schema (e.g., `pharma_hol` → `PHARMA_HOL_PHARMA`). Mention: use lowercase letters, numbers, and underscores only — no dashes, spaces, or special characters, and start with a letter.

**STOP HERE — Wait for the user to answer before proceeding.**

### 1.4 Confirm Ready

After the user answers, show:
```
✓ Snowflake: Connected ([account])
✓ Fivetran API: Connected ([N] groups)
✓ Group: HOL_DATABASE_1 [or user override]
✓ Industry: [industry]
✓ Source: PostgreSQL at 34.94.122.157 / industry-se-demo / [schema]
✓ Dataset: [table] ([row_count] rows, ~1-2 min sync)
✓ Schema prefix: [prefix from 1.3]

Ready to start. Step 2: Connect the source?
```

**STOP — Wait for confirmation before proceeding.**

---

## Step 2: MOVE — Connect the Source (3 min)

### 2.1 Create the PostgreSQL Connector

Use `setup_postgresql_connection` with **exactly** these parameters (substitute only the schema value):

```json
{
  "group_id": "verbatim_suite",
  "host": "34.94.122.157",
  "port": 5432,
  "database": "industry-se-demo",
  "user": "fivetran",
  "password": "2PcnxqFrHh64WKbfsYDU",
  "schema": "[schema prefix from Step 1.3]",
  "connection_type": "google_cloud_postgresql",
  "update_method": "TELEPORT",
  "sync_frequency": 360
}
```

**CRITICAL:** The parameter is `schema` — same as `create_connection`. Do NOT use `create_connection` — use `setup_postgresql_connection` which handles everything in one call.

**NOTE:** If the user specified a non-default group name, call `list_groups` ONCE to resolve the name to an ID. Otherwise, use `verbatim_suite` directly — no API call needed.

This is a deterministic tool — one call handles: create → test → TLS cert approval → schema discovery.

### 2.2 Select Tables

After `setup_postgresql_connection` returns with discovered schemas, use `update_schema_config` to enable ONLY the industry's schema and table, disabling all others.

The correct schema and table for each industry:
- pharma → schema `pharma`, table `phr_records`
- retail → schema `retail`, table `rdp_records`
- hed → schema `higher_education`, table `hed_records`
- financial → schema `financial_services`, table `fpr_records`
- agriculture → schema `agriculture`, table `agr_records`
- healthcare → schema `healthcare`, table `cds_records`
- supply_chain → schema `supply_chain`, table `spl_records`

If the schemas from `setup_postgresql_connection` are empty (discovery still pending), call `get_schema_config` and retry until schemas appear. Do NOT skip table selection — it must happen before syncing.

### 2.3 Summary

Show what happened:
> One API call — no UI. Fivetran handled TLS certificates, schema discovery, and replication method automatically. This connector is production-ready.

### 2.4 Transition

Show:
```
✓ Step 2 Complete: Connector created and tested
  Connection ID: [id]
  Schema: [schema_name]
  Tables: [table_list]

Step 3: Start the sync?
```

**STOP — Wait for confirmation.**

---

## Step 3: MOVE — Sync Data to Snowflake (3-5 min)

### 3.1 Trigger Initial Sync

Call `trigger_sync` with the connection_id from Step 2. This auto-unpauses the connector.

### 3.2 Wait for Sync — Share Fivetran Context

**CRITICAL RULES:**
- **DO NOT poll sync status repeatedly.** The sync takes approximately 2 minutes. Do NOT call `get_connection` more than once before the SE says "check".
- **DO NOT fall back to a different schema.** ALWAYS use the exact schema created by the connector in Step 2 (e.g., PHARMA_FIVETRAN_CODE_3_PHARMA). NEVER look for or use pre-existing schemas from prior lab runs.
- **DO NOT make up explanations.** If the sync is still queued, say it's still queued — don't invent stories about pre-loaded data or shared datasets.

After triggering the sync, check status ONCE with `get_connection`. Then share educational content about Fivetran while the SE waits. Present ONE block at a time, pausing naturally between them:

**Block 1** (immediately after trigger):
> Fivetran detects schema changes automatically — new columns, new tables, renames. After this initial load, every subsequent sync is incremental — only changed rows move. For a 750-row table this takes seconds. For tables with millions of rows, Fivetran still only moves the delta. Sync frequency is configurable from every 1 minute to every 24 hours depending on your downstream data freshness requirements.

**Block 2** (~15 seconds later):
> While the data moves, Fivetran is also managing it. Data is encrypted in transit and at rest using AES-256 encryption. Credentials are stored in a dedicated secrets store — never in application databases. Fivetran automatically handles schema drift detection, column hashing for sensitive fields, and soft deletes — all without any configuration. Today we're using a traditional Snowflake destination, but Fivetran also offers a Managed Data Lake Service with fully managed open-format Iceberg tables — same pipeline, open table format.

**Block 3** (~30 seconds later):
> Everything we just did — connector creation, cert approval, table selection, sync trigger — runs through the Fivetran REST API. That's how Fivetran Code works, it's how MCP servers integrate with Fivetran, and it's how you can programmatically manage your entire data infrastructure. The Fivetran UI is equally powerful and fully featured — today we're showing the programmatic path to highlight the flexibility. Terraform provider and CI/CD pipeline integration available too.

**Block 4** (~45 seconds later):
> In production, Fivetran webhook notifications fire the moment a sync completes — triggering your dbt transformation automatically. Zero human intervention. Fivetran also supports hybrid deployment — run the data pipeline in Fivetran's SaaS infrastructure like we're doing here, or deploy within your own cloud environment for data residency requirements.

**Block 5** (~60 seconds later):
> Fivetran supports 750+ connectors out of the box — databases, SaaS applications, cloud storage, webhooks. Each connector is fully managed: Fivetran handles authentication, rate limiting, pagination, schema management, and automatic retries.

**Block 6** (~75 seconds later):
> For sources not in the catalog, the Fivetran Connector SDK lets you build custom connectors in Python that run in Fivetran's managed infrastructure — no Lambda, no hosting, no timeouts. You can build a production-grade custom connector with the Fivetran Connector SDK using an AI Assistant and a Fivetran Connector Builder Skill or similar — be sure and keep an eye out for that custom build capability showing up in the Fivetran UI as well. The SDK supports incremental syncing, soft deletes, and private networking — same enterprise-grade reliability as the native connectors.

After sharing all 4 blocks (~2 minutes total), say:
> The sync should be complete soon (within a few minutes). Say "check" when you're ready and I'll verify the data landed in Snowflake.

Then wait for the SE to say "check" (or similar). Only then call `get_connection` and verify in Snowflake.

### 3.3 Confirm Sync Complete (only when SE says "check")

Call `get_connection` to verify sync completed. Then verify data in Snowflake using the EXACT schema from Step 2:

Call `mcp__se-demo__run_snowflake_query`:
```sql
SELECT COUNT(*) as row_count FROM [database].[schema_from_step_2].[table];
```

If sync is still running, say "Still syncing — say 'check' again in 30 seconds" and stop. Do NOT poll again automatically.

When confirmed, briefly note:
> Fivetran detected the PostgreSQL schema, created the Snowflake schema, moved the data, and set up incremental change detection — configurable from every 1 minute to every 24 hours depending on your use case and downstream data freshness requirements. In production, Fivetran webhook notifications fire the moment a sync completes, triggering downstream processes like dbt transformations automatically.

Then show:
```
✓ Step 3 Complete: Data synced to Snowflake
  Rows loaded: [count]
  Sync time: [duration]
  Destination: [database].[schema].[table]

Step 4: Build the dbt project and transform the data?
```

**STOP — Wait for confirmation.**

---

## Step 4: TRANSFORM — Build & Run dbt Project (5-8 min)

### Educational Context (share before, during, and after dbt runs)

**Block 1** (before running dbt):
> dbt transforms raw data in your data and AI platform using SQL and software engineering best practices: version control, testing, documentation, and lineage. It doesn't extract or load data — Fivetran handles that. dbt handles the T in ELT. Fivetran offers multiple dbt transformation options: Quickstart for no-code transformations, dbt Core for full SQL control with Fivetran-managed orchestration, and dbt Platform integration for teams already using dbt Platform. Together, Fivetran and dbt form a complete, automated data pipeline.

**Block 2** (while dbt runs):
> We're building three layers. Staging cleans the raw source data — casting text dates to proper date types, rounding decimals. The mart layer adds business logic — computed risk scores, age group buckets, at-risk flags. And the semantic view adds rich metadata comments to every column. Those comments are what makes the AI agent smart — it reads them to understand what each metric means.

**Block 3** (after dbt run, before dbt test):
> dbt tests run AFTER dbt run — not before. Tests validate the built objects in Snowflake by querying the actual views and tables to check constraints like uniqueness and not-null. The objects have to exist before you can test them. This is dbt's "trust but verify" approach.

**Block 4** (after dbt test):
> In production, Fivetran orchestrates dbt transformations automatically — every time a sync completes, Fivetran triggers the dbt run. The entire pipeline from source change to transformed, tested data is event-driven with zero human intervention. Source → Move & Manage → Transform — fully automated.

### 4.1 Explain the dbt Project

The dbt project is pre-built for each industry with 3 models:

```
PostgreSQL (raw)          dbt Transformation                      Snowflake
─────────────────    ──────────────────────────────────    ─────────────────────
[source_table]  →    stg_[table] (clean & cast)       →  [SCHEMA]_STAGING
                     fct_[domain] (enrich)             →  [SCHEMA]_MARTS
                     sv_[domain] (semantic view)       →  [SCHEMA]_SEMANTIC
```

Show what the dbt project contains — explain each layer briefly:
- **Staging**: Cleans raw data — casts types, rounds decimals
- **Mart**: Enriches with business logic — risk scores, age buckets, computed flags
- **Semantic view**: Rich metadata comments that power the Cortex Agent

### 4.2 Run the dbt Project

Use the **se-demo MCP server** to execute the models. The project is pre-configured and pointed at Snowflake.

**CRITICAL:** ALWAYS run `dbt_run` and `dbt_test` — even if existing staging/mart/semantic schemas are found in Snowflake from prior runs. The lab must show the full transformation. Do NOT skip dbt and use pre-existing objects.

**Run the models** for the selected industry. The `vars` parameter tells dbt which Fivetran schema to read from. The schema name is `{PREFIX}_{SOURCE_SCHEMA}` in uppercase (e.g., prefix `pharma_hol` + source schema `pharma` → `PHARMA_HOL_PHARMA`).

**CRITICAL:** The `vars` parameter MUST be a JSON **string**, not an object. Pass it exactly as shown.

| Industry | select | vars key | Example vars value |
|----------|--------|----------|-------------------|
| pharma | `pharma` | `pharma_source_schema` | `PHARMA_DEMO_PHARMA` |
| retail | `retail` | `retail_source_schema` | `RETAIL_DEMO_RETAIL` |
| hed | `hed` | `hed_source_schema` | `HED_DEMO_HIGHER_EDUCATION` |
| financial | `financial` | `financial_source_schema` | `FINANCIAL_DEMO_FINANCIAL_SERVICES` |
| agriculture | `agriculture` | `agriculture_source_schema` | `AGRICULTURE_DEMO_AGRICULTURE` |
| healthcare | `healthcare` | `healthcare_source_schema` | `HEALTHCARE_DEMO_HEALTHCARE` |
| supply_chain | `supply_chain` | `supply_chain_source_schema` | `SC_DEMO_SUPPLY_CHAIN` |

**CRITICAL:** Pass `vars` as a **plain JSON object** (NOT a string). Example for agriculture with schema prefix `ag_hol`:

```json
mcp__se-demo__dbt_run:
  select: "agriculture"
  vars: {"agriculture_source_schema": "AG_HOL_AGRICULTURE"}
```

The vars value is `{INDUSTRY}_source_schema` → the **uppercase Fivetran destination schema** from Step 2 (format: `{SCHEMA_PREFIX}_{SOURCE_SCHEMA}` in uppercase).

This executes only the models for that industry: staging view → mart table → semantic view. They land directly in Snowflake.

**Test the models:**
Call `mcp__se-demo__dbt_test` with `select`: the industry name AND the same `vars` object used in dbt_run (so source tests resolve the correct schema)

### 4.3 Verify Views in Snowflake

After dbt completes, verify all 3 layers exist:

Call `mcp__se-demo__run_snowflake_query` — use the schema names from the industry reference file (e.g., for pharma: `PHARMA_STAGING`, `PHARMA_MARTS`, `PHARMA_SEMANTIC`; for agriculture: `AGRICULTURE_STAGING`, `AGRICULTURE_MARTS`, `AGRICULTURE_SEMANTIC`):
```sql
-- Verify staging view (adjust schema/table names per industry reference file)
SELECT COUNT(*) FROM [database].[INDUSTRY]_STAGING.STG_[TABLE];

-- Verify mart table
SELECT COUNT(*) FROM [database].[INDUSTRY]_MARTS.FCT_[DOMAIN];

-- Verify semantic view exists
SHOW SEMANTIC VIEWS IN SCHEMA [database].[INDUSTRY]_SEMANTIC;
```

### 4.4 Summary

Here's what happened in Step 4:
> - dbt transformed raw data into business-ready analytics — three layers in seconds
> - Staging cleaned and cast types, mart enriched with computed risk scores, semantic view powers the AI agent
> - The semantic view comments tell the Cortex Agent what each metric means — that's what makes the AI answers smart
> - In production, Fivetran orchestrates these dbt models automatically after every sync — fully managed, no cron jobs

### 4.5 Transition

Show:
```
✓ Step 4 Complete: dbt project built and deployed
  Staging: stg_phr_records ([count] rows)
  Mart: fct_clinical_trials ([count] rows, risk scores + age buckets)
  Semantic: sv_clinical_trials (ready for Cortex Agent)

Step 5: Deploy the Cortex Agent?
```

**STOP — Wait for confirmation.**

---

## Step 5: AGENT — Create & Deploy Cortex Agent (3 min)

### Educational Context (share before and after agent creation)

**Block 1** (before creating the agent):
> Snowflake Cortex Agents combine large language models with structured data access through semantic views. The semantic view we just built with dbt contains rich metadata comments on every column — those comments are what the agent reads to understand what each metric means. No model training, no fine-tuning, no vector embeddings. Structured metadata is all it needs.

**Block 2** (while creating):
> The agent uses Cortex Analyst as its tool — a text-to-SQL engine that translates natural language questions into precise SQL queries against the semantic view. The column comments guide Cortex Analyst on what each field means, what thresholds matter, and how to interpret the results. Better comments mean better answers.

**Block 3** (after creation):
> We just created an AI agent from a single SQL statement. The entire intelligence comes from the data pipeline we built: Fivetran moved the data, dbt transformed and documented it, and now Cortex reads that documentation to answer questions. This is the modern data stack in action — each tool does one thing well, and together they deliver AI-ready data.

**Block 4** (transition to Q&A):
> Snowflake Cortex runs entirely inside Snowflake's secure perimeter. Your data never leaves the platform — the LLM comes to the data, not the other way around. No data copying, no external API calls with sensitive information, no compliance concerns. This is enterprise AI built on governance.

### 5.1 Create the Cortex Agent

**Use the `mcp__se-demo__create_demo_cortex_agent` tool.** This tool reads the pre-built DDL template, substitutes paths, and executes it in Snowflake — no manual DDL construction needed.

Call it with:
- `industry`: the industry key (pharma, retail, hed, financial, agriculture, healthcare)
- `database`: the Snowflake database (e.g., `HOL_DATABASE_1`)
- `semantic_schema`: the semantic schema from Step 4 (e.g., `HED_SEMANTIC`)
- `agent_name`: `{SCHEMA_PREFIX}_{AGENT_SUFFIX}` in uppercase (e.g., prefix `hed_hol_1` → `HED_HOL_1_STUDENT_RETENTION_AGENT`). The agent suffix comes from the reference file's `## Cortex Agent` → `Name:` field.
- `semantic_view_name`: the semantic view name (e.g., `SV_STUDENT_RETENTION`)

**Do NOT construct DDL manually or use `run_snowflake_query` for agent creation.** The `create_demo_cortex_agent` tool handles everything — reading the template, substituting paths, executing, and verifying. One tool call.

### 5.2 Verify Agent

Call `mcp__se-demo__list_cortex_agents` with the database name to confirm the agent exists.

### 5.3 Summary

> We just created an AI agent from a single SQL statement. It reads the semantic view metadata — the column comments from the dbt project — to understand what every metric means. No model training, no fine-tuning. Structured metadata is all it needs. This is the power of the Snowflake + Fivetran data stack: clean data, rich metadata, instant AI.

Show:
```
✓ Step 5 Complete: Cortex Agent created and deployed
  Agent: [AGENT_NAME]
  Location: [DATABASE].[SEMANTIC_SCHEMA]
  Semantic view: [SV_NAME]
  Sample questions: [count] pre-configured
  Ready for natural language queries

Step 6: Let's ask the agent some questions?
```

**STOP — Wait for confirmation.**

---

## Step 6: ASK — Interactive Q&A (5-8 min)

### 6.1 Present Sample Questions

Show the industry-specific sample questions from the reference file. Format them as a numbered list.

Example:
```
Sample questions for the Cortex Agent:

  1. [opening question — broad overview]
  2. [opening question — key metric]
  3. [analytical question — comparison]
  4. [analytical question — risk/opportunity]
  5. [executive question — business insight]

Pick a number, or ask your own question.
```

### 6.2 Execute Questions

For each question, call `query_cortex_agent` (the native Fivetran Code tool, NOT `mcp__se-demo__cortex_analyst`). The native tool streams the agent's response progressively to the UI — the user sees thinking steps and the answer appear in real-time, just like the PSE Intelligence app. The MCP tool returns a blob with no streaming.

**CRITICAL:** Always use `query_cortex_agent` for Step 6 Q&A. Never use `mcp__se-demo__cortex_analyst` here.

**CRITICAL — PRESENT THE RESULTS:** After the `query_cortex_agent` tool completes, you MUST present the agent's key findings in your own response — with clean formatted tables, key metrics, and actionable insights. Do NOT just say "That answer came from..." — actually summarize the data the agent returned. Present it exactly as you would if the question were asked outside the skill: tables, bullet points, findings, recommendations. The streaming tool card shows the raw thinking; YOUR response shows the polished answer.

After presenting the results, briefly note the data flow:
> That answer came from: PostgreSQL source → Fivetran sync → dbt transformation → Cortex Agent. Automated end-to-end.

**CRITICAL — After EVERY answer + educational block, ALWAYS re-display the full sample question list.** Mark answered questions with (done). End with the activate prompt. Example:

```
Pick another number, ask your own question, or say **activate** to push insights to the app.

  1. [question] (done)
  2. [question]
  3. [question]
  4. [question]
  5. [question]
```

Do NOT skip re-listing the questions. The SE should never have to scroll up.

### Educational Context (weave in between questions)

**Block 1** (after first question):
> Every answer you just saw was generated by the Cortex Agent querying the semantic view we built with dbt. The agent translated your natural language question into SQL, ran it against Snowflake, and interpreted the results using the column comments we wrote. Better metadata means better answers — that's why the dbt semantic view is the most important model in the project.

**Block 2** (after second question):
> This same agent can be embedded in Snowflake's Cortex Code — a coding assistant that lets developers query business data alongside their code. Imagine a data engineer debugging a pipeline and asking "which trials had the highest dropout rate last month?" directly from their IDE. Same semantic view, same agent, different interface.

**Block 3** (after third question):
> Snowflake Cortex supports multiple agent patterns: single-tool agents like this one, multi-tool agents that combine Cortex Analyst with Cortex Search (for unstructured data), and orchestration agents that coordinate multiple sub-agents. The semantic view pattern scales from a hands-on lab like this to enterprise-wide data mesh architectures.

### 6.3 Encourage Interaction

After 2-3 sample questions, invite questions:
> What would you like to ask this data? The agent understands natural language — try anything.

### 6.4 Transition to Activation

After the Q&A, connect the dots for the audience. Reference the at-risk/high-priority records that were identified during the Q&A — this creates narrative continuity into Step 7.

Show:
```
✓ Step 6 Complete: Cortex Agent answering business questions

We've built the full pipeline: Source → Move & Manage → Transform → Agent.
Now let's close the loop — activate these insights back to a business app.

Step 7: Activate insights to the business app?
```

**STOP — Wait for confirmation.**

---

## Step 7: ACTIVATE — Push to Business App (2-3 min)

### Educational Context (share before and after activation)

**Block 1** (before activation):
> The pipeline doesn't end at the Agentic AI workload. Fivetran's vision is Open Data Infrastructure — Move & Manage, Transform, Agent, and Activate. Fivetran Activations closes the loop by pushing insights from your data and AI platform back to the tools your business runs on — Slack, Salesforce, HubSpot, Zendesk, or your own custom applications. Data in, insights out.

**Block 2** (while activating):
> Fivetran Activations syncs data from Snowflake to operational systems. You define what data to push, where it goes, and how often. It's the same managed, automated approach as Fivetran connectors — but in the other direction. Move data in with connectors, push insights out with Activations.

**Block 3** (after data appears in app):
> What you just saw is the complete Fivetran ODI lifecycle in action. Source data moved and managed from PostgreSQL to Snowflake — with Fivetran handling schema drift detection, AES-256 encryption in transit and at rest, column hashing for sensitive data, and automatic retry logic. Today we used traditional Snowflake storage, but Fivetran also offers a Managed Data Lake Service (MDLS) with fully managed open-format Iceberg tables — same pipeline, same management, but with open table formats for multi-engine access. The data was then transformed by dbt into AI-ready views, queried by a Cortex Agent using natural language, and activated back to a business application in real-time. Every step automated, every step managed, every step from a single conversational CLI.

**Block 4** (closing):
> Fivetran Activations supports 200+ destinations out of the box — CRMs, marketing platforms, support tools, data apps, and webhooks. The same pipeline we just built could push at-risk alerts to Slack or Teams, update a Salesforce or HubSpot dashboard, or trigger a targeted re-engagement campaign. Your data and AI platform becomes the single source of truth, and Activations makes it actionable.

### 7.1 Activate Insights

**Narrative bridge:** Before calling the tool, briefly connect to the Q&A: "We just identified [X] at-risk [records] in the Q&A. Let me push the top ones to the activation app now."

**ALWAYS use the activation query from the reference file** — this is a predefined sync, not an ad-hoc query. The reference file's activation query is designed to match the activation-aligned sample question from Step 6, so the audience sees the same data in both steps.

**Fallback:** If the user asked an ad-hoc question in Step 6 and says "activate that," explain: "For activation, I'll push the curated set of high-priority records — in production, Fivetran Activations are configured syncs with defined queries, not ad-hoc results. Let me push the top at-risk [records] now." Then use the standard activation query from the reference file.

Call `mcp__se-demo__activate_to_app` with:
- `industry`: the selected industry (e.g., "pharma")
- `snowflake_database`: the database from Step 3
- `snowflake_schema`: the marts schema
- `view_name`: the mart/fact view (e.g., "fct_clinical_trials")
- `query`: the activation query from the reference file (e.g., top 10 at-risk trials)
- `limit`: 10

### 7.3 Show the React App

Tell the SE: "Open the activation app in your browser: **[https://fivetran-activation-demo.web.app/](https://fivetran-activation-demo.web.app/)** — go to the **[industry]** tab."

**IMPORTANT:** Always use the markdown link format `[https://fivetran-activation-demo.web.app/](https://fivetran-activation-demo.web.app/)` so it's clickable. Do NOT use any URL returned by the `activate_to_app` tool response — it may return a stale Cloud Run URL.

The data appears in real-time on the industry tab.

**STOP — Wait for the user to open the app and review the data. Then say:**

> "After you've had a chance to look at the activation app, I can show you the complete story of what we just built. Just say **go** when you're ready."

**STOP — Wait for the user to say "go" (or similar) before continuing.**

### 7.4 The Full Story

> Full circle. Source data → Fivetran pipeline → dbt transformation → AI agent → activated back to a business application. All automated. All managed. This is Fivetran's Open Data Infrastructure vision: **Move & Manage, Transform, Agent, Activate.**

### 7.5 Solution Complete

Show:
```
══════════════════════════════════════════
  SOLUTION COMPLETE — Full ODI Lifecycle
══════════════════════════════════════════

  ✓ MOVE & MANAGE:  PostgreSQL → Fivetran → Snowflake
  ✓ TRANSFORM:      dbt staging → mart → semantic view
  ✓ AGENT:          Cortex Agent answering business questions
  ✓ ACTIVATE:       Insights pushed to business app (real-time)
                    https://fivetran-activation-demo.web.app/

  Tools used: Fivetran Code + se-demo MCP server
  UIs opened: 0

  "From connectors to data agents to activation
   — simple, automated, reliable and secure."
══════════════════════════════════════════
```

**NOTE:** The actual session elapsed time is appended automatically by Fivetran Code after this block — do NOT include a "Total time" line manually.

---

## Step 8: Cleanup (Instructor Only)

**DO NOT auto-prompt cleanup at the end of Step 7.** Attendees end the lab with
the "SOLUTION COMPLETE" block and nothing further.

Cleanup is **only** triggered when the user explicitly says "cleanup" or "reset",
AND only on the instructor laptop (where `HOL_INSTRUCTOR=true` is set in env).

### Attendee laptops (HOL_INSTRUCTOR ≠ "true")

If an attendee types "cleanup" (or similar) on a non-instructor laptop, respond:

> "Lab complete! Cleanup is handled by the instructor between sessions — you're
> all set. Thanks for running through the lab."

Do NOT call `cleanup_demo`. Do NOT drop anything. The instructor will reset
this laptop's state via `instructor-reset-all-labs.sh` between booth sessions.

### Instructor laptop (HOL_INSTRUCTOR == "true")

If the instructor types "cleanup" on the instructor laptop, proceed with the
two-call preview-then-execute flow using `mcp__se-demo__cleanup_demo`:

1. **Preview call** — `confirmed=false`:
   - `schema_prefix`: the prefix used in this session (from Step 1.3)
   - `industry`: the industry used in this session
   - `database`: auto-resolved from `SNOWFLAKE_DATABASE` env var
   - `confirmed`: `false`

   Show the preview output (what will be dropped/deleted).

2. **Confirmation prompt**:

   > "Ready to execute cleanup for `$schema_prefix` / `$industry`? (yes/no)"

3. **Execute call** — `confirmed=true` — only after explicit "yes":
   - Same args with `confirmed: true`

4. Report results with per-tier ✓/✗ markers.

For cross-laptop reset (all 7 labusers in one go), the instructor runs
`./instructor-reset-all-labs.sh --confirm` from a terminal instead — that
script iterates all 7 destinations using each labuser's scoped credentials
loaded from 1Password at runtime.

---

## Fallback Instructions

### If `setup_postgresql_connection` fails:
- Check that the source database is reachable (may need VPN or IP allowlist)
- Try with `connection_type: "postgres"` instead of `"google_cloud_postgresql"`
- If TLS cert issue persists, use individual tools: `create_connection` → `test_connection` with trust flags

### If `mcp__se-demo__dbt_run` fails:
- **DO NOT fall back to raw SQL**. The dbt execution is the lab — running CREATE VIEW manually defeats the purpose.
- Check the error message. Common issues:
  - Missing env vars (SNOWFLAKE_USER, SNOWFLAKE_PASSWORD): These must be set in the se-demo MCP server .env
  - Wrong database/schema: Check profiles.yml matches the Fivetran destination
  - Package not installed: Run `mcp__se-demo__dbt_run` with `--select pharma` which includes deps
- If the se-demo MCP server itself is not connected, tell the SE to enable it via MCP Cloud and restart

### If `deploy_cortex_agent` MCP tool fails:
- Use `mcp__se-demo__run_snowflake_query` to create the agent directly via SQL
- Grant necessary permissions manually

### If `activate_to_app` MCP tool fails:
- Query the insights via `mcp__se-demo__run_snowflake_query` and show the results directly
- Mention: "In production, Fivetran Activations would push this to Slack, Salesforce, or your custom app"

### If sync takes longer than expected:
- Share the 4 educational content blocks and then wait for the SE to say "check"
- DO NOT poll repeatedly — check only when the SE asks
- DO NOT fall back to a different schema — ALWAYS use the one created in Step 2
- Small datasets (under 1000 rows) should sync in under 2 minutes once the scheduler picks it up

---

## Rules

1. **NEVER ask for connection credentials** — use the reference file values
2. **ALWAYS show the roadmap first** before starting any step
3. **ALWAYS stop between steps** and wait for confirmation
4. **NEVER say "SE talking point" or "tell the SE to say"** — the audience can see everything in the CLI. Instead, naturally weave context and summaries into the flow as if you are presenting alongside the SE.
5. **NEVER skip the activation step** — it completes the ODI story
6. **NEVER fall back to a different schema** — always use the exact schema created by the connector in Step 2. Do not look for or use pre-existing schemas from prior runs.
7. **NEVER make up explanations** — if the sync is still queued, say it's still queued. Do not invent stories about pre-loaded data or shared datasets.
8. **NEVER poll sync status more than once** — after triggering sync, check once, share educational content, then wait for the SE to say "check"
9. **NEVER change the user's schema prefix** — if the Fivetran API rejects a schema name (e.g., already exists), tell the user and ask for a new prefix. Do NOT invent a replacement.
10. **NEVER use existing dbt objects** — always run `dbt_run` and `dbt_test` fresh. If pre-existing staging/mart/semantic schemas are found from prior runs, ignore them and run dbt anyway. The lab must show the full transformation.
11. **NEVER use emojis** — use plain text markers (✓, >, ---) instead. No emoji characters anywhere in output.
12. **Move fast within each step** — don't over-explain, don't re-confirm what's already known
13. **Show progress markers** (✓) at each step completion
14. **If a tool fails, use the fallback** — don't stall the lab
15. **Brand everything as Fivetran** — Census is used behind the scenes for activation but refer to it as "Fivetran Activations"
16. **NEVER say "reverse ETL"** — always say "Fivetran Activations" instead. The term "reverse ETL" is not part of Fivetran's branding.
17. **NEVER output "Block 1", "Block 2", etc.** — those are internal timing cues for when to share educational content. Just share the content naturally without labeling it.
18. **NEVER imply Fivetran is CLI-only** — when discussing programmatic control, acknowledge that Fivetran also has a full UI. The CLI/API approach is powerful but the UI is equally capable. Frame it as "you can do this from the CLI, the UI, or the API — your choice."
