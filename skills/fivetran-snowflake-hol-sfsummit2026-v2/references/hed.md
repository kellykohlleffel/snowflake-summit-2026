# Higher Education — Student Retention & Success

## Source
- host: 34.94.122.157, port: 5432, database: industry-se-demo, user: fivetran, password: REDACTED_PG_PASSWORD
- connection_type: google_cloud_postgresql, update_method: TELEPORT
- Schema: `higher_education`, Table: `hed_records` (751 rows, 22 columns, ~1-2 min sync)

## dbt
- `--select hed` runs: stg_hed_records → fct_student_retention → sv_student_retention
- dbt vars key: `hed_source_schema` (e.g., `{"hed_source_schema": "HED_DEMO_HIGHER_EDUCATION"}`)
- Agent DDL: read from `references/agents/hed/create_cortex_agent.sql`

## Cortex Agent
- Name: HED_STUDENT_RETENTION_AGENT
- Location: [database].HED_SEMANTIC
- Semantic view: [database].HED_SEMANTIC.SV_STUDENT_RETENTION

## Sample Questions
1. Which students have the highest retention risk scores?
2. What is the average GPA by major?
3. How many students need intervention but haven't received one?
4. Show me engagement patterns across GPA brackets
5. Which majors have the highest dropout risk?

## Activation
- Query: `SELECT student_id, major_code as program, round(current_gpa, 2) as gpa, at_risk_flag as risk_level, round(retention_risk_score, 2) as retention_score, academic_standing, gpa_bracket, round(engagement_score, 2) as engagement_score, engagement_level, intervention_count FROM [database].HED_MARTS.FCT_STUDENT_RETENTION WHERE needs_intervention = true ORDER BY retention_risk_score DESC LIMIT 10`
- App: https://fivetran-activation-demo.web.app (Higher Ed tab)
