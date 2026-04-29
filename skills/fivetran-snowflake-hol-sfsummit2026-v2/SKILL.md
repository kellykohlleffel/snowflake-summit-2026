---
name: fivetran-snowflake-hol-sfsummit2026-v2
description: "Snowflake Summit 2026 Hands-on Lab — end-to-end Fivetran ODI solution: Source → Move & Manage → Transform → Agent → Activate. Guides a lab attendee through 20 minutes of interactive, educational hands-on steps. Use for: SF Summit 2026 HOL, Snowflake Summit hands-on lab, Fivetran ODI lab."
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

At the START of every step (Steps 1-8), output the step heading as a markdown `##` header BEFORE doing anything else for that step. Use these exact headings:
- `## Step 1: Prerequisites Check`
- `## Step 2: MOVE — Connect the Source`
- `## Step 3: MOVE & MANAGE — Sync Data to Snowflake`
- `## Step 4: TRANSFORM — Build & Run dbt Project`
- `## Step 5: AGENT — Create & Deploy Cortex Agent`
- `## Step 6: ASK — Interactive Q&A`
- `## Step 7: ACTIVATE — Push to Business App`
- `## Step 8: What's Next?`

This creates clear visual section breaks in the chat UI. Do NOT skip these headings.

## Formatting Rules (MANDATORY)

- **Do NOT use markdown blockquote markers** (`>`) in your responses.
- **Do NOT use horizontal rules** (`---` or `***`).
- **ALWAYS insert a blank line between every paragraph** in context content. Each block of text MUST be separated by an empty line (`\n\n`). Never run paragraphs together with only a single newline — the UI needs double newlines to render paragraph spacing. This is critical for readability.
- These rules ensure consistent rendering across both Fivetran Code and Cortex Code VSCode extensions.

## Educational Reference Files (MANDATORY — NO PARAPHRASING)

Every step that says "read `references/educational/<file>.md`" is a HARD INSTRUCTION. These files contain the lab's curated educational narrative. Treat them as a teleprompter, not a prompt:

- **READ the file via the Read tool. Do NOT skip the read.**
- **Output the block text VERBATIM.** Do not rephrase, summarize, abbreviate, expand, reorder, merge, or substitute it with your own prose. The exact wording is intentional and reviewed.
- **Do NOT generate alternative educational content** — even if you believe you can write something more relevant to the chosen industry. The blocks are industry-agnostic by design.
- **Do NOT invent block titles, headings, or section labels** that aren't in the file (e.g., "What Fivetran is doing right now", "Why this matters for retail analytics", "The managed part of Move & Manage"). These are signs the model went off-script.
- **Preserve block boundaries.** If the file says Block 1, Block 2, Block 3, output them in order, one at a time, with the timing cues in the file. Do not collapse them into a single response.
- **Bolding, em dashes, and emphasis in the file are part of the verbatim output** — preserve them.

If the file is missing or empty, STOP and tell the attendee the lab content file is missing — do NOT fall back to generated content.

## Lab Roadmap (Show First)

When the skill is invoked, ALWAYS start by showing this roadmap AND asking for industry selection. Do NOT make any tool calls or run any prerequisites until the user selects an industry. This is mandatory even if no industry argument is provided.

**FIVETRAN x SNOWFLAKE HANDS-ON LAB -- 20 Minutes**

| Step | Phase | Time |
|------|-------|------|
| 1 | Prerequisites Check | 2 min |
| 2 | MOVE: Connect the Source | 3 min |
| 3 | MOVE & MANAGE: Sync to Snowflake | 3-5 min |
| 4 | TRANSFORM: Build dbt Project | 5-8 min |
| 5 | AGENT: Create & Deploy Cortex Agent | 3 min |
| 6 | ASK: Interactive Q&A | 5-8 min |
| 7 | ACTIVATE: Push to Business App | 2-3 min |
| 8 | What's Next? | 1 min |

**Industry:** [selected below] | **MCP Servers:** fivetran-code + se-tools

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

- **Snowflake:** Connected ([account])
- **Fivetran API:** Connected ([N] groups)
- **Group:** HOL_DATABASE_1 [or user override]
- **Industry:** [industry]
- **Source:** PostgreSQL at 34.94.122.157 / industry-se-demo / [schema]
- **Dataset:** [table] ([row_count] rows, ~1-2 min sync)
- **Schema prefix:** [prefix from 1.3]

Ready to start. **Step 2: Connect the source?**

**STOP — Wait for confirmation before proceeding.**

---

## Step 2: MOVE — Connect the Source (3 min)

### 2.1 Resolve the PostgreSQL Password (DETERMINISTIC + VISIBLE)

Before calling `setup_postgresql_connection`, resolve `PG_HOL_PASSWORD` by following these exact steps in order:

1. **Make exactly ONE Read tool call** on `mcp-servers/se-demo/.env`. This file is populated by `setup.sh` from 1Password on lab laptops, and exists locally on Kelly's dev laptop. It is gitignored — the public repo never contains the password.
2. Extract the value after `=` on the line that starts with `PG_HOL_PASSWORD=`. That string is the password.
3. **MANDATORY VISIBILITY — Print this exact line to the chat before proceeding:**
   `Resolved PG_HOL_PASSWORD from mcp-servers/se-demo/.env (length: <N> chars).`
   where `<N>` is the actual length of the password string. Do NOT print the password value itself. This line is the SE's audit trail — without it, the SE cannot verify the deterministic Read happened. If you cannot print this line, you have not actually performed the Read and must stop.
4. **DO NOT** use `grep`, `find`, ripgrep, or any search tool. **DO NOT** read any file in `setup/creds/`, the activation app, or anywhere else. The path above is the only authoritative source.
5. **STOP-and-tell branch.** If the file is missing or `PG_HOL_PASSWORD` is empty, STOP and tell the attendee: *"The local `mcp-servers/se-demo/.env` is missing or has no `PG_HOL_PASSWORD`. On lab laptops this is populated by `setup.sh` from 1Password. On the dev laptop, copy the value from `setup/creds/labuser1.env`."* Do NOT attempt any fallback search or guess.

### 2.2 Create the PostgreSQL Connector

Use `setup_postgresql_connection` with **exactly** these parameters (substitute the password value resolved in 2.1 and the schema value from Step 1.3):

```json
{
  "group_id": "verbatim_suite",
  "host": "34.94.122.157",
  "port": 5432,
  "database": "industry-se-demo",
  "user": "fivetran",
  "password": "[value of PG_HOL_PASSWORD resolved in Step 2.1]",
  "schema": "[schema prefix from Step 1.3]",
  "connection_type": "google_cloud_postgresql",
  "update_method": "TELEPORT",
  "sync_frequency": 360
}
```

**CRITICAL:** The parameter is `schema` — same as `create_connection`. Do NOT use `create_connection` — use `setup_postgresql_connection` which handles everything in one call.

**NOTE:** If the user specified a non-default group name, call `list_groups` ONCE to resolve the name to an ID. Otherwise, use `verbatim_suite` directly — no API call needed.

This is a deterministic tool — one call handles: create → test → TLS cert approval → schema discovery.

### 2.3 Select Tables

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

### 2.4 Summary

Show what happened:
> One API call — no UI. Fivetran handled TLS certificates, schema discovery, and replication method automatically. This connector is production-ready.

### 2.5 Transition

Show:

**Step 2 Complete: Connector created and tested**
- **Connection ID:** [id]
- **Schema:** [schema_name]
- **Tables:** [table_list]

**Step 3: Start the sync?**

**STOP — Wait for confirmation.**

---

## Step 3: MOVE — Sync Data to Snowflake (3-5 min)

### 3.1 Trigger Initial Sync

Call `trigger_sync` with the connection_id from Step 2. This auto-unpauses the connector.

### 3.2 Wait for Sync — Share Fivetran Context

**CRITICAL RULES:**
- **DO NOT poll sync status repeatedly.** The sync takes approximately 2 minutes. Do NOT call `get_connection_details` more than once before the SE says "check".
- **DO NOT fall back to a different schema.** ALWAYS use the exact schema created by the connector in Step 2 (e.g., PHARMA_FIVETRAN_CODE_3_PHARMA). NEVER look for or use pre-existing schemas from prior lab runs.
- **DO NOT make up explanations.** If the sync is still queued, say it's still queued — don't invent stories about pre-loaded data or shared datasets.

After triggering the sync, check status ONCE with `get_connection_details`. Then **read `references/educational/step3_sync_context.md` with the Read tool and output Blocks 1–6 VERBATIM**, one at a time, with pauses between them, while the attendee waits for the sync. Do NOT paraphrase, do NOT generate your own retail/pharma/etc. industry-specific commentary, and do NOT invent block titles like "What Fivetran is doing right now" or "Why this matters for [industry]". The 6 blocks in the file are the only educational content allowed at this step. After all blocks, ask the attendee to say "check" when ready.

Then wait for the attendee to say "check" (or similar). Only then call `get_connection_details` and verify in Snowflake.

### 3.3 Confirm Sync Complete (only when SE says "check")

Call `get_connection_details` to verify sync completed. Then verify data in Snowflake using the EXACT schema from Step 2:

Call `mcp__se-demo__run_snowflake_query`:
```sql
SELECT COUNT(*) as row_count FROM [database].[schema_from_step_2].[table];
```

If sync is still running, say "Still syncing — say 'check' again in 30 seconds" and stop. Do NOT poll again automatically.

When confirmed, briefly note:
> Fivetran detected the PostgreSQL schema, created the Snowflake schema, moved the data, and set up incremental change detection — configurable from every 1 minute to every 24 hours depending on your use case and downstream data freshness requirements. In production, Fivetran webhook notifications fire the moment a sync completes, triggering downstream processes like dbt transformations automatically.

Then show:

**Step 3 Complete: Data synced to Snowflake**
- **Rows loaded:** [count]
- **Sync time:** [duration]
- **Destination:** [database].[schema].[table]

**Step 4: Build the dbt project and transform the data?**

**STOP — Wait for confirmation.**

---

## Step 4: TRANSFORM — Build & Run dbt Project (5-8 min)

### Context

**Read `references/educational/step4_transform_context.md` with the Read tool and output its blocks VERBATIM** before, during, and after dbt runs as indicated by the timing cues in the file. Do NOT paraphrase or substitute your own dbt commentary.

### 4.1 Explain the dbt Project

The dbt project is pre-built for each industry with 3 models:

| PostgreSQL (raw) | dbt Transformation | Snowflake |
|---|---|---|
| [source_table] | stg_[table] (clean & cast) | [SCHEMA]_STAGING |
| | fct_[domain] (enrich) | [SCHEMA]_MARTS |
| | sv_[domain] (semantic view) | [SCHEMA]_SEMANTIC |

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

**Step 4 Complete: dbt project built and deployed**
- **Staging:** stg_phr_records ([count] rows)
- **Mart:** fct_clinical_trials ([count] rows, risk scores + age buckets)
- **Semantic:** sv_clinical_trials (ready for Cortex Agent)

**Step 5: Create and deploy the Cortex Agent?**

**STOP — Wait for confirmation.**

---

## Step 5: AGENT — Create & Deploy Cortex Agent (3 min)

### Context

**Read `references/educational/step5_agent_context.md` with the Read tool and output its blocks VERBATIM** before and after agent creation as indicated by the timing cues in the file. Do NOT paraphrase or substitute your own Cortex Agent commentary.

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

### 5.3 Pre-warm the Agent

Send a warm-up question via `query_cortex_agent` — e.g., "How many records are in the dataset?" Frame it as: "Let me verify the agent can answer questions." Show the brief result and move on.

### 5.4 Summary

> We just created an AI agent from a single SQL statement. It reads the semantic view metadata — the column comments from the dbt project — to understand what every metric means. No model training, no fine-tuning. Structured metadata is all it needs. This is the power of the Snowflake + Fivetran data stack: clean data, rich metadata, instant AI.

Show:

**Step 5 Complete: Cortex Agent created and deployed**
- **Agent:** [AGENT_NAME]
- **Location:** [DATABASE].[SEMANTIC_SCHEMA]
- **Semantic view:** [SV_NAME]
- **Sample questions:** [count] pre-configured
- Ready for natural language queries

**Step 6: Let's ask the agent some questions?**

**STOP — Wait for confirmation.**

---

## Step 6: ASK — Interactive Q&A (5-8 min)

**MANDATORY Q&A RULES -- READ BEFORE EXECUTING ANY QUESTION:**
1. When the user says a number (e.g., "5"), run THAT question. NOT question 1. The number maps directly to the numbered list.
2. Run exactly ONE question per user message. Never run 2 or more questions in one turn.
3. After answering, STOP. Show the question list. Wait for the user's next input. Do NOT auto-run the next question.
4. Only proceed to Step 7 when the user explicitly says "activate".

### 6.1 Present Sample Questions

Show the industry-specific sample questions from the reference file. Format them as a numbered list.

Example:

Sample questions for the Cortex Agent:

1. [opening question -- broad overview]
2. [opening question -- key metric]
3. [analytical question -- comparison]
4. [analytical question -- risk/opportunity]
5. [executive question -- business insight]

Pick a number, or ask your own question.

### 6.2 Execute Questions

**CRITICAL — RUN ONLY THE QUESTION THE USER SELECTED.** If the user says "5", run question 5. If the user says "2", run question 2. Do NOT start from question 1. Do NOT run multiple questions. Run exactly ONE question per user input.

For the selected question, call `query_cortex_agent` (the native Fivetran Code tool, NOT `mcp__se-demo__cortex_analyst`). The native tool streams the agent's response progressively to the UI. The MCP tool returns a blob with no streaming.

**CRITICAL:** Always use `query_cortex_agent` for Step 6 Q&A. Never use `mcp__se-demo__cortex_analyst` here.

**CRITICAL — PRESENT THE RESULTS:** After the `query_cortex_agent` tool completes, you MUST present the agent's key findings in your own response — with clean formatted tables, key metrics, and actionable insights. Do NOT just say "That answer came from..." — actually summarize the data the agent returned.

After presenting the results, briefly note the data flow:
> That answer came from: PostgreSQL source -> Fivetran sync -> dbt transformation -> Cortex Agent. Automated end-to-end.

**CRITICAL — After EVERY answer, ALWAYS re-display the full sample question list, then STOP and WAIT for the user to pick another number or say activate.** Do NOT automatically run the next question. Do NOT continue without user input. Mark answered questions with (done). Example:

Pick another number, ask your own question, or say **activate** to push insights to the app.

1. [question] (done)
2. [question]
3. [question]
4. [question]
5. [question]

**STOP HERE — Wait for the user to pick a number, ask a question, or say activate. Do NOT proceed without user input.**

Do NOT skip re-listing the questions. The SE should never have to scroll up.

### Context

**Read `references/educational/step6_qa_context.md` with the Read tool and output its blocks VERBATIM** in between questions as indicated by the timing cues in the file. Do NOT paraphrase or invent your own Q&A framing text.

### 6.3 Encourage Interaction

After 2-3 sample questions, invite questions:
> What would you like to ask this data? The agent understands natural language — try anything.

### 6.4 Transition to Activation

After the Q&A, connect the dots for the audience. Reference the at-risk/high-priority records that were identified during the Q&A — this creates narrative continuity into Step 7.

Show:

**Step 6 Complete: Cortex Agent answering business questions**

We've built the full pipeline: Source -> Move & Manage -> Transform -> Agent. Now let's close the loop -- activate these insights back to a business app.

**Step 7: Activate insights to the business app?**

**STOP — Wait for confirmation.**

---

## Step 7: ACTIVATE — Push to Business App (2-3 min)

### Context

**Read `references/educational/step7_activate_context.md` with the Read tool and output its blocks VERBATIM** before and after activation as indicated by the timing cues in the file. Do NOT paraphrase or substitute your own activation/Census commentary.

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

"After you've had a chance to look at the activation app, say **go** when you're ready for the lab wrap-up and what's next."

**STOP HERE. Do NOT continue until the user says "go" (or similar). This is a mandatory wait point.**

---

## Step 8: What's Next? (1 min)

**This step ONLY runs after the user says "go" at the end of Step 7.** Do NOT show this content until the user explicitly says go.

**Read `references/educational/step8_whats_next.md` with the Read tool and output sections 8.1 (lab summary), 8.2 (What's Next CTAs), and 8.3 (cleanup prompt) VERBATIM** in that order. Do NOT paraphrase, abbreviate, or skip any section. The What's Next CTA block uses emoji visual markers intentionally — this is an exception to the no-emoji rule.

**STOP after showing the cleanup prompt. Do NOT run cleanup automatically. Only run cleanup if the user explicitly says "cleanup" or "yes".**

### Cleanup Flow (when user says "cleanup")

1. **FIRST** call `mcp__se-demo__cleanup_demo` with `confirmed=false` to get a preview of what will be removed.
2. Show the preview to the user and ask: "Should I go ahead and execute the cleanup?"
3. **WAIT for the user to say "yes"** before proceeding. Do NOT execute automatically after the preview.
4. **ONLY after the user confirms**, call `mcp__se-demo__cleanup_demo` with `confirmed=true` to execute.
5. Show the results.

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
- Share the 4 context content blocks and then wait for the SE to say "check"
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
8. **NEVER poll sync status more than once** — after triggering sync, check once, share context content, then wait for the SE to say "check"
9. **NEVER change the user's schema prefix** — if the Fivetran API rejects a schema name (e.g., already exists), tell the user and ask for a new prefix. Do NOT invent a replacement.
10. **NEVER use existing dbt objects** — always run `dbt_run` and `dbt_test` fresh. If pre-existing staging/mart/semantic schemas are found from prior runs, ignore them and run dbt anyway. The lab must show the full transformation.
11. **NEVER use emojis** — use plain text markers (✓, >, ---) instead. No emoji characters anywhere in output (exception: Step 8 What's Next CTA uses visual markers intentionally).
12. **Move fast within each step** — don't over-explain, don't re-confirm what's already known
19. **ALWAYS read reference files when directed** — do not skip or improvise. The files contain specific branded messaging that must be presented verbatim.
13. **Show progress markers** (✓) at each step completion
14. **If a tool fails, use the fallback** — don't stall the lab
15. **Brand everything as Fivetran** — Census is used behind the scenes for activation but refer to it as "Fivetran Activations"
16. **NEVER say "reverse ETL"** — always say "Fivetran Activations" instead. The term "reverse ETL" is not part of Fivetran's branding.
17. **NEVER output "Block 1", "Block 2", etc.** — those are internal timing cues for when to share context content. Just share the content naturally without labeling it.
18. **NEVER imply Fivetran is CLI-only** — when discussing programmatic control, acknowledge that Fivetran also has a full UI. The CLI/API approach is powerful but the UI is equally capable. Frame it as "you can do this from the CLI, the UI, or the API — your choice."
19. **ALWAYS run the EXACT question the user selects in Step 6** — if user says "5", run question 5. NEVER start from question 1. NEVER run a different question than what was requested.
20. **NEVER auto-run the next question in Step 6** — after answering one question, show the question list and STOP. Wait for the user to pick the next number or say "activate". Do NOT chain questions automatically.
