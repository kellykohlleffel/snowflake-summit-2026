# Pharma — Clinical Trials Risk Analysis

## Source
- host: 34.94.122.157, port: 5432, database: industry-se-demo, user: fivetran, password: REDACTED_PG_PASSWORD
- connection_type: google_cloud_postgresql, update_method: TELEPORT
- Schema: `pharma`, Table: `phr_records` (750 rows, 17 columns, ~1-2 min sync)

## dbt
- `--select pharma` runs: stg_phr_records → fct_clinical_trials → sv_clinical_trials
- dbt vars key: `pharma_source_schema` (e.g., `{"pharma_source_schema": "PHARMA_DEMO_PHARMA"}`)
- Agent DDL: read from `references/agents/pharma/create_cortex_agent.sql`

## Cortex Agent
- Name: PHARMA_CLINICAL_TRIALS_AGENT
- Location: [database].PHARMA_SEMANTIC
- Semantic view: [database].PHARMA_SEMANTIC.SV_CLINICAL_TRIALS

## Sample Questions
1. Which disease areas have the highest dropout rates?
2. What is the average enrollment rate by sponsor type?
3. Which trials are at risk — recruiting but with high dropout rates?
4. Show me the regulatory approval breakdown by disease area
5. What is the patient age distribution across active vs completed trials?

## Activation
- Query: `SELECT trial_name, disease_area, sponsor_name, trial_status, enrollment_rate, dropout_rate, trial_risk_score, patient_age, age_group, regulatory_approval_status FROM [database].PHARMA_MARTS.FCT_CLINICAL_TRIALS WHERE is_at_risk = true ORDER BY trial_risk_score DESC LIMIT 10`
- App: https://fivetran-activation-demo.web.app (Pharma tab)
