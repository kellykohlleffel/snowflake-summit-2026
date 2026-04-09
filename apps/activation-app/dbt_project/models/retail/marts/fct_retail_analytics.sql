{{
  config(
    materialized='table',
    tags=['marts', 'retail']
  )
}}

with staged as (

  select * from {{ ref('stg_rdp_records') }}

),

enriched as (

  select
    record_id,
    order_id,
    customer_id,
    product_id,
    order_date,
    order_total,
    product_price,
    inventory_level,
    customer_segment,
    order_status,
    product_category,
    product_subcategory,
    customer_lifetime_value,
    order_frequency,
    average_order_value,
    product_rating,
    product_review_count,
    price_optimization_flag,
    price_elasticity,
    demand_forecast,
    inventory_turnover,
    stockout_rate,
    overstock_rate,
    revenue_growth_rate,
    customer_satisfaction_rate,
    price_optimization_date,
    price_optimization_result,
    price_optimization_recommendation,

    -- CLV segment
    case
      when customer_lifetime_value < 3000 then 'Low'
      when customer_lifetime_value between 3000 and 7000 then 'Medium'
      when customer_lifetime_value > 7000 then 'High'
    end as clv_segment,

    -- Inventory health
    case
      when stockout_rate > 0.05 then 'Stockout Risk'
      when overstock_rate > 0.05 then 'Overstock Risk'
      else 'Healthy'
    end as inventory_health,

    -- Days since order
    datediff('day', order_date, current_date()) as days_since_order,

    -- Price action needed
    case
      when price_optimization_flag = 'FALSE' and price_elasticity > 0.5 then true
      else false
    end as price_action_needed,

    -- Customer value score (composite 0-1)
    round(
      (least(customer_lifetime_value / 10000, 1) * 0.4)
      + (least(order_frequency / 10.0, 1) * 0.3)
      + (customer_satisfaction_rate * 0.3),
      2
    ) as customer_value_score

  from staged

)

select * from enriched
