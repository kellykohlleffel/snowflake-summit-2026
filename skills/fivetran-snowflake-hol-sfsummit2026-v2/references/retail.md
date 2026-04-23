# Retail — Customer Re-engagement & Price Optimization

## Source
- host: 34.94.122.157, port: 5432, database: industry-se-demo, user: fivetran, password: <read PG_HOL_PASSWORD from mcp-servers/se-demo/.env>
- connection_type: google_cloud_postgresql, update_method: TELEPORT
- Schema: `retail`, Table: `rdp_records` (750 rows, 28 columns, ~1-2 min sync)

## dbt
- `--select retail` runs: stg_rdp_records → fct_retail_analytics → sv_retail_analytics
- dbt vars key: `retail_source_schema` (e.g., `{"retail_source_schema": "RETAIL_DEMO_RETAIL"}`)
- Agent DDL: read from `references/agents/retail/create_cortex_agent.sql`

## Cortex Agent
- Name: RETAIL_ANALYTICS_AGENT
- Location: [database].RETAIL_SEMANTIC
- Semantic view: [database].RETAIL_SEMANTIC.SV_RETAIL_ANALYTICS

## Sample Questions
1. Which customer segments have the highest lifetime value?
2. What products have the highest stockout rates?
3. Show me customers at risk of churn — low satisfaction and high value
4. Which product categories need price optimization?
5. Compare inventory health across product categories

## Activation
- Query: `SELECT customer_id, customer_segment as segment, round(customer_lifetime_value, 2) as lifetime_value, days_since_order as days_since_last_order, round(customer_satisfaction_rate, 4) as customer_satisfaction_rate, round(customer_value_score, 2) as customer_value_score, clv_segment, inventory_health, price_optimization_recommendation as recommendation FROM [database].RETAIL_MARTS.FCT_RETAIL_ANALYTICS WHERE customer_value_score > 0.5 AND customer_satisfaction_rate < 0.5 ORDER BY customer_lifetime_value DESC LIMIT 10`
- App: https://fivetran-activation-demo.web.app (Retail tab)
