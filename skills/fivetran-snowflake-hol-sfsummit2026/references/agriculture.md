# Agriculture — Livestock Weather Risk

## Source
- host: 34.94.122.157, port: 5432, database: industry-se-demo, user: fivetran, password: 2PcnxqFrHh64WKbfsYDU
- connection_type: google_cloud_postgresql, update_method: TELEPORT
- Schema: `agriculture`, Table: `agr_records` (750 rows, 16 columns, ~1-2 min sync)

## dbt
- `--select agriculture` runs: stg_agr_records → fct_livestock_health → sv_livestock_health
- dbt vars key: `agriculture_source_schema` (e.g., `{"agriculture_source_schema": "AGRICULTURE_DEMO_AGRICULTURE"}`)
- Agent DDL: read from `references/agents/agriculture/create_cortex_agent.sql`

## Cortex Agent
- Name: LIVESTOCK_HEALTH_AGENT
- Location: [database].AGRICULTURE_SEMANTIC
- Semantic view: [database].AGRICULTURE_SEMANTIC.SV_LIVESTOCK_HEALTH

## Sample Questions
1. Which animals need immediate veterinary attention?
2. What is the health risk distribution by species?
3. Show me animals under heat stress conditions
4. Which farms have the highest average health risk?
5. How many animals have overdue vaccinations?

## Activation
- Query: `SELECT animal_id, farm_id as location, species, breed, health_status, round(predicted_health_risk, 4) as predicted_health_risk, risk_level, vaccination_history, weather_data, round(temperature, 2) as heat_index, recommended_action FROM [database].AGRICULTURE_MARTS.FCT_LIVESTOCK_HEALTH WHERE needs_immediate_action = true ORDER BY predicted_health_risk DESC LIMIT 10`
- App: https://fivetran-activation-demo.web.app (Agriculture tab)
