# Supply Chain — Demand Intelligence

## Source
- host: 34.94.122.157, port: 5432, database: industry-se-demo, user: fivetran, password: <read PG_HOL_PASSWORD from mcp-servers/se-demo/.env>
- connection_type: google_cloud_postgresql, update_method: TELEPORT
- Schema: `supply_chain`, Table: `spl_records` (750 rows, 21 columns, ~1-2 min sync)

## dbt
- `--select supply_chain` runs: stg_spl_records -> fct_demand_intelligence -> sv_demand_intelligence
- dbt vars key: `supply_chain_source_schema` (e.g., `{"supply_chain_source_schema": "SC_DEMO_1_SUPPLY_CHAIN"}`)
- Agent DDL: read from `references/agents/supply_chain/create_cortex_agent.sql`

## Cortex Agent
- Name: DEMAND_INTELLIGENCE_AGENT
- Location: [database].SUPPLY_CHAIN_SEMANTIC
- Semantic view: [database].SUPPLY_CHAIN_SEMANTIC.SV_DEMAND_INTELLIGENCE

## Sample Questions
1. Which SKUs have the highest stockout risk?
2. What is the forecast accuracy breakdown by product category?
3. Show me SKUs with poor forecast accuracy and high stockout risk
4. Which regions have the highest demand signal scores?
5. How do sales rep adjustments impact forecast accuracy?

## Activation
- Query: `SELECT record_id as forecast_id, product_sku, product_category, location_code, forecast_accuracy_tier, round(forecast_accuracy_mape, 2) as mape, round(stockout_risk_score, 4) as stockout_risk, inventory_health, round(inventory_days_supply, 1) as days_supply, competitive_position, round(demand_signal_score, 2) as demand_signal FROM [database].SUPPLY_CHAIN_MARTS.FCT_DEMAND_INTELLIGENCE WHERE needs_review = true ORDER BY stockout_risk_score DESC LIMIT 10`
- App: https://fivetran-activation-demo.web.app (Supply Chain tab)
