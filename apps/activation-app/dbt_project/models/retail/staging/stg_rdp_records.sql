{{
  config(
    materialized='view',
    tags=['staging', 'retail']
  )
}}

with source as (

  select * from {{ source('retail', 'RDP_RECORDS') }}

),

cleaned as (

  select
    record_id,
    order_id,
    customer_id,
    product_id,
    cast(order_date as date) as order_date,
    round(order_total, 2) as order_total,
    round(product_price, 2) as product_price,
    inventory_level,
    customer_segment,
    order_status,
    product_category,
    product_subcategory,
    round(customer_lifetime_value, 2) as customer_lifetime_value,
    order_frequency,
    round(average_order_value, 2) as average_order_value,
    round(product_rating, 2) as product_rating,
    product_review_count,
    price_optimization_flag,
    round(price_elasticity, 2) as price_elasticity,
    demand_forecast,
    round(inventory_turnover, 2) as inventory_turnover,
    round(stockout_rate, 4) as stockout_rate,
    round(overstock_rate, 4) as overstock_rate,
    round(revenue_growth_rate, 4) as revenue_growth_rate,
    round(customer_satisfaction_rate, 4) as customer_satisfaction_rate,
    cast(price_optimization_date as date) as price_optimization_date,
    price_optimization_result,
    price_optimization_recommendation
  from source

)

select * from cleaned
