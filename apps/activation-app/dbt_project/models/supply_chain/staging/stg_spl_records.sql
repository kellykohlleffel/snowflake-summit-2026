{{
  config(
    materialized='view',
    tags=['staging', 'supply_chain']
  )
}}

with source as (

  select * from {{ source('supply_chain', 'SPL_RECORDS') }}

),

cleaned as (

  select
    record_id,
    cast(forecast_date as date) as forecast_date,
    product_sku,
    split_part(product_sku, '-', 1) as product_category,
    location_code,
    split_part(location_code, '-', 2) as location_region,
    forecast_horizon_days,
    round(baseline_demand_forecast, 2) as baseline_demand_forecast,
    round(adjusted_demand_forecast, 2) as adjusted_demand_forecast,
    round(actual_sales_units, 2) as actual_sales_units,
    pos_transaction_count,
    round(current_inventory_level, 2) as current_inventory_level,
    case when stockout_indicator = 'true' then true else false end as stockout_indicator,
    case when promotional_activity_flag = 'true' then true else false end as promotional_activity_flag,
    round(promotion_discount_percent, 2) as promotion_discount_percent,
    round(market_share_percent, 2) as market_share_percent,
    round(category_growth_rate, 2) as category_growth_rate,
    round(competitor_price_index, 2) as competitor_price_index,
    round(economic_indicator_gdp, 2) as economic_indicator_gdp,
    round(consumer_confidence_index, 1) as consumer_confidence_index,
    round(seasonal_index, 3) as seasonal_index,
    round(forecast_accuracy_mape, 2) as forecast_accuracy_mape,
    round(sales_rep_adjustment, 1) as sales_rep_adjustment
  from source

)

select * from cleaned
