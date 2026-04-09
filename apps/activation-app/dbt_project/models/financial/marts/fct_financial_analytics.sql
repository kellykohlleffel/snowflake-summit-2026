{{
  config(
    materialized='table',
    tags=['marts', 'financial']
  )
}}

with staged as (

  select * from {{ ref('stg_fpr_records') }}

),

enriched as (

  select
    record_id,
    customer_id,
    customer_name,
    customer_email,
    account_balance,
    product_id,
    product_name,
    product_type,
    product_recommendation,
    recommendation_score,
    customer_segment,
    customer_lifecycle_stage,
    customer_transaction_value,
    customer_transaction_count,
    customer_product_affinity,
    product_sales_date,
    product_sales_amount,
    customer_satisfaction_score,
    customer_churn_probability,
    lifecycle_transition_date,
    product_recommendation_date,
    product_recommendation_status,

    -- Balance tier
    case
      when account_balance < 25000 then 'Low'
      when account_balance between 25000 and 75000 then 'Medium'
      when account_balance > 75000 then 'High'
    end as balance_tier,

    -- Churn risk level
    case
      when customer_churn_probability < 0.3 then 'Low'
      when customer_churn_probability between 0.3 and 0.6 then 'Medium'
      when customer_churn_probability > 0.6 then 'High'
    end as churn_risk_level,

    -- Customer health score (composite 0-1)
    round(
      (customer_satisfaction_score * 0.4)
      + (customer_product_affinity * 0.3)
      + ((1 - customer_churn_probability) * 0.3),
      4
    ) as customer_health_score,

    -- Recommendation accepted
    case
      when product_recommendation_status = 'Accepted' then true
      else false
    end as recommendation_accepted,

    -- Days since lifecycle transition
    datediff('day', lifecycle_transition_date, current_date()) as days_since_transition,

    -- Needs attention
    case
      when customer_churn_probability > 0.6 and customer_satisfaction_score < 0.5 then true
      else false
    end as needs_attention

  from staged

)

select * from enriched
