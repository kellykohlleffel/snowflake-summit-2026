# Healthcare — Clinical Decision Support

## Source
- host: 34.94.122.157, port: 5432, database: industry-se-demo, user: fivetran, password: <read PG_HOL_PASSWORD from mcp-servers/se-demo/.env>
- connection_type: google_cloud_postgresql, update_method: TELEPORT
- Schema: `healthcare`, Table: `cds_records` (750 rows, 31 columns, ~1-2 min sync)

## dbt
- `--select healthcare` runs: stg_cds_records → fct_clinical_decisions → sv_clinical_decisions
- dbt vars key: `healthcare_source_schema` (e.g., `{"healthcare_source_schema": "HEALTHCARE_DEMO_HEALTHCARE"}`)
- Agent DDL: read from `references/agents/healthcare/create_cortex_agent.sql`

## Cortex Agent
- Name: CLINICAL_DECISIONS_AGENT
- Location: [database].HEALTHCARE_SEMANTIC
- Semantic view: [database].HEALTHCARE_SEMANTIC.SV_CLINICAL_DECISIONS

## Sample Questions
1. Which patients have the highest readmission risk?
2. What is the average outcome score by diagnosis?
3. Show me non-adherent patients with high readmission risk
4. Compare treatment outcomes across treatment plans
5. Which diagnoses have the highest medical error rates?

## Activation
- Query: `SELECT patient_id, diagnosis as condition, readmission_risk_level as severity, treatment_outcome as alert_type, medical_conditions, treatment_plan, medication_adherence, round(readmission_risk, 4) as readmission_risk, round(patient_outcome_score, 4) as patient_outcome_score, round(total_treatment_cost, 2) as total_treatment_cost FROM [database].HEALTHCARE_MARTS.FCT_CLINICAL_DECISIONS WHERE needs_review = true ORDER BY readmission_risk DESC LIMIT 10`
- App: https://fivetran-activation-demo.web.app (Healthcare tab)
