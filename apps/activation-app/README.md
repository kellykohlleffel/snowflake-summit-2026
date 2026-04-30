# Fivetran SE AI Solution Demo

End-to-end AI solution demo for Fivetran Sales Engineers: **Source → Move → Transform → Agent → Activate**.

Demonstrates Fivetran's Open Data Infrastructure (ODI) vision in a 25-minute live demo — all from the Fivetran CLI. No UI required.

## Architecture

```
┌─────────────────┐     ┌──────────┐     ┌───────────┐     ┌──────────────┐     ┌───────────┐
│ Google Cloud     │     │ Fivetran │     │ Snowflake │     │ Cortex Agent │     │ React App │
│ PostgreSQL       │────→│ Move     │────→│ dbt       │────→│ Q&A          │────→│ Activate  │
│ (industry DB)    │     │          │     │ Transform │     │              │     │           │
└─────────────────┘     └──────────┘     └───────────┘     └──────────────┘     └───────────┘
```

## Components

| Component | Location | Purpose |
|-----------|----------|---------|
| **React App** | `src/`, `index.html` | Activation dashboard — displays insights pushed from Snowflake |
| **Cloud Run API** | `api/` | Receives activation data, writes to Firestore |
| **dbt Project** | `dbt_project/` | Multi-industry transformation models (staging → mart → semantic view) |
| **Agent DDL** | `dbt_project/agents/` | Snowflake Cortex Agent CREATE statements per industry |

## Supported Industries

| Industry | Schema | Source Table | Use Case |
|----------|--------|-------------|----------|
| Pharma | `pharma` | `phr_records` | Clinical trials risk analysis |
| Retail | `retail` | `rdp_records` | Customer re-engagement & price optimization |
| Higher Education | `higher_education` | `hed_records` | Student retention & success |
| Financial Services | `financial_services` | `fpr_records` | Transaction monitoring & churn prevention |
| Agriculture | `agriculture` | `agr_records` | Livestock weather risk |
| Healthcare | `healthcare` | `cds_records` | Clinical decision support |

## dbt Project Structure

```
dbt_project/
├── dbt_project.yml              # Multi-industry config
├── packages.yml                 # dbt_utils + dbt_semantic_view
├── profiles.yml                 # Snowflake connection (env vars)
├── models/
│   ├── pharma/
│   │   ├── staging/stg_phr_records.sql
│   │   ├── marts/fct_clinical_trials.sql
│   │   └── semantic/sv_clinical_trials.sql
│   ├── retail/
│   ├── hed/
│   ├── financial/
│   ├── agriculture/
│   └── healthcare/
└── agents/
    ├── pharma/create_cortex_agent.sql
    ├── retail/
    ├── hed/
    ├── financial/
    ├── agriculture/
    └── healthcare/
```

Each industry has 3 dbt models + 1 Cortex Agent DDL. Run a specific industry with:

```bash
dbt run --select pharma
dbt run --select retail
```

## Adding a New Industry

1. Add a folder under `dbt_project/models/{industry}/` with staging, marts, semantic
2. Add agent DDL under `dbt_project/agents/{industry}/`
3. Uncomment/add the industry block in `dbt_project.yml`
4. Add a reference file in the skill: `~/.claude/skills/fivetran-se-ai-solution-demo/references/{industry}.md`
5. Add an industry tab in the React app (`src/types.ts`)

## Setup

### Prerequisites

- Node.js 18+
- Python 3.12+ with dbt-core and dbt-snowflake
- Firebase CLI (`npm install -g firebase-tools`)
- gcloud CLI (for Cloud Run deployment)
- Snowflake account with ACCOUNTADMIN access

### Environment Variables

```bash
# dbt (set in dbt-core MCP server config or shell)
SNOWFLAKE_USER=your_user
SNOWFLAKE_PRIVATE_KEY_PATH=~/.snowflake/dbt_rsa_key.p8
```

### React App

The activation app has TWO independent deployments — the React frontend (Firebase hosting) and the Cloud Run API (next section). Each must be redeployed when its own source changes; one staying stale while the other is current is a common foot-gun.

Easiest path is the bundled script (run from `apps/activation-app/`):

```bash
./deploy.sh
```

Or run the underlying commands directly:

```bash
npm install
npm run build
firebase deploy --only hosting:activation-demo
```

(The `activation-demo` target maps to site `fivetran-activation-demo` via `.firebaserc` — the URL is `https://fivetran-activation-demo.web.app`.)

Hosted at: `https://fivetran-activation-demo.web.app` (no query params for the dev flow / Kelly's flow) or `https://fivetran-activation-demo.web.app?laptop_id=laptopN` (per-laptop scoped for booth labs — Firestore listener subscribes to `industries/<industry>_laptopN`).

### Cloud Run API

The Fivetran GCP org enforces `constraints/storage.softDeletePolicySeconds`,
which blocks `gcloud run deploy --source` (it tries to auto-create a staging
bucket with the default 7-day soft-delete and gets denied). We deploy via
build-and-push to Artifact Registry instead, matching the pse-platform
pattern. Easiest path is the bundled script:

```bash
cd api/
./deploy.sh
```

Or run the underlying commands directly:

```bash
cd api/

docker build --platform linux/amd64 \
  -t us-central1-docker.pkg.dev/fivetran-fivetran-248-war-mraw/cloud-run-source-deploy/fivetran-activation-api:latest .

docker push \
  us-central1-docker.pkg.dev/fivetran-fivetran-248-war-mraw/cloud-run-source-deploy/fivetran-activation-api:latest

gcloud run deploy fivetran-activation-api \
  --image=us-central1-docker.pkg.dev/fivetran-fivetran-248-war-mraw/cloud-run-source-deploy/fivetran-activation-api:latest \
  --region=us-central1 \
  --allow-unauthenticated
```

The deploy keeps the same service URL (`https://fivetran-activation-api-81810785507.us-central1.run.app`) — Cloud Run just rolls a new revision. Lab laptops don't need any config change after deploy.

### dbt

```bash
cd dbt_project/
dbt deps
dbt run --select pharma   # or any industry
dbt test --select pharma
```

## Demo Flow

Invoked via the Fivetran CLI skill: `/fivetran-se-ai-solution-demo pharma`

| Step | What | Time |
|------|------|------|
| 1 | Prerequisites check (Fivetran API + Snowflake) | 2 min |
| 2 | MOVE: Create PostgreSQL connector via Fivetran API | 3 min |
| 3 | MOVE: Sync data to Snowflake | 3-5 min |
| 4 | TRANSFORM: Run dbt models via dbt-core MCP | 5-8 min |
| 5 | AGENT: Create Cortex Agent via SQL DDL | 3 min |
| 6 | ASK: Interactive Q&A with the agent | 5-8 min |
| 7 | ACTIVATE: Push insights to React app | 2-3 min |

## Deployment

| Service | URL |
|---------|-----|
| React App | https://fivetran-activation-demo.web.app |
| Cloud Run API | https://fivetran-activation-api-81810785507.us-central1.run.app |
| Firebase Project | fivetran-fivetran-248-war-mraw |

## MCP Servers Required

| Server | Purpose |
|--------|---------|
| `snowflake` | Snowflake queries, Cortex Agent creation + Q&A |
| `fivetran-snowflake-hol-builder` | Activation push to React app |
| `dbt-core` | dbt run/test/build |
