# Financial Services — Transaction Monitoring & Churn Prevention

## Source
- host: 34.94.122.157, port: 5432, database: industry-se-demo, user: fivetran, password: <read PG_HOL_PASSWORD from mcp-servers/se-demo/.env>
- connection_type: google_cloud_postgresql, update_method: TELEPORT
- Schema: `financial_services`, Table: `fpr_records` (751 rows, 28 columns, ~1-2 min sync)

## dbt
- `--select financial` runs: stg_fpr_records → fct_financial_analytics → sv_financial_analytics
- dbt vars key: `financial_source_schema` (e.g., `{"financial_source_schema": "FINANCIAL_DEMO_FINANCIAL_SERVICES"}`)
- Agent DDL: read from `references/agents/financial/create_cortex_agent.sql`

## Cortex Agent
- Name: FINANCIAL_ANALYTICS_AGENT
- Location: [database].FINANCIAL_SEMANTIC
- Semantic view: [database].FINANCIAL_SEMANTIC.SV_FINANCIAL_ANALYTICS

## Sample Questions
1. Which customers are at highest risk of churning?
2. What is the average satisfaction score by customer segment?
3. Show me high-balance customers with high churn probability
4. How effective are our product recommendations — acceptance rate by product type?
5. Compare customer health scores across lifecycle stages

## Activation
- Query: `SELECT customer_id as account_id, product_type as transaction_type, round(account_balance, 2) as amount, churn_risk_level as risk_flag, customer_name, customer_segment, balance_tier, round(customer_churn_probability, 4) as customer_churn_probability, round(customer_satisfaction_score, 4) as customer_satisfaction_score, round(customer_health_score, 4) as customer_health_score FROM [database].FINANCIAL_MARTS.FCT_FINANCIAL_ANALYTICS WHERE needs_attention = true ORDER BY account_balance DESC LIMIT 10`
- App: https://fivetran-activation-demo.web.app (Financial tab)
