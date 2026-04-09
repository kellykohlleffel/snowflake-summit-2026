{{
  config(
    materialized='view',
    tags=['staging', 'financial']
  )
}}

with source as (

  select * from {{ source('financial', 'FPR_RECORDS') }}

),

cleaned as (

  select
    record_id,
    customer_id,
    customer_name,
    customer_email,
    round(account_balance, 2) as account_balance,
    transaction_history,
    product_id,
    product_name,
    product_type,
    product_terms,
    product_recommendation,
    round(recommendation_score, 4) as recommendation_score,
    customer_segment,
    customer_lifecycle_stage,
    round(customer_transaction_value, 2) as customer_transaction_value,
    customer_transaction_count,
    customer_product_usage,
    customer_product_interests,
    round(customer_product_affinity, 4) as customer_product_affinity,
    cast(product_sales_date as date) as product_sales_date,
    round(product_sales_amount, 2) as product_sales_amount,
    round(customer_satisfaction_score, 4) as customer_satisfaction_score,
    round(customer_churn_probability, 4) as customer_churn_probability,
    cast(customer_lifecycle_stage_transition_date as date) as lifecycle_transition_date,
    cast(product_recommendation_date as date) as product_recommendation_date,
    product_recommendation_status,
    customer_product_usage_trend,
    customer_product_affinity_trend
  from source

)

select * from cleaned
