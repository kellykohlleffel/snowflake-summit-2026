{{
  config(
    materialized='table',
    tags=['marts', 'supply_chain']
  )
}}

with staged as (

  select * from {{ ref('stg_spl_records') }}

),

enriched as (

  select
    record_id,
    forecast_date,
    product_sku,
    product_category,
    location_code,
    location_region,
    forecast_horizon_days,

    -- Demand metrics
    baseline_demand_forecast,
    adjusted_demand_forecast,
    actual_sales_units,
    pos_transaction_count,

    -- Forecast accuracy
    forecast_accuracy_mape,
    case
      when forecast_accuracy_mape < 15 then 'Excellent'
      when forecast_accuracy_mape < 25 then 'Good'
      when forecast_accuracy_mape < 35 then 'Fair'
      else 'Poor'
    end as forecast_accuracy_tier,

    -- Forecast bias: positive = over-forecast, negative = under-forecast
    round(
      case
        when actual_sales_units > 0
        then (adjusted_demand_forecast - actual_sales_units) / actual_sales_units * 100
        else 0
      end, 2
    ) as forecast_bias_percent,

    -- Sales rep adjustment impact
    sales_rep_adjustment,
    round(
      case
        when baseline_demand_forecast > 0
        then sales_rep_adjustment / baseline_demand_forecast * 100
        else 0
      end, 2
    ) as adjustment_impact_percent,

    -- Inventory metrics
    current_inventory_level,
    round(
      case
        when actual_sales_units > 0 and forecast_horizon_days > 0
        then current_inventory_level / (actual_sales_units / forecast_horizon_days)
        else 0
      end, 1
    ) as inventory_days_supply,

    -- Stockout risk: low inventory relative to demand trajectory
    round(
      case
        when adjusted_demand_forecast > 0
        then greatest(0, least(1,
          1 - (current_inventory_level / (adjusted_demand_forecast * 1.2))
        ))
        else 0
      end, 4
    ) as stockout_risk_score,

    stockout_indicator,

    -- Promotional data
    promotional_activity_flag,
    promotion_discount_percent,

    -- Market signals
    market_share_percent,
    category_growth_rate,
    competitor_price_index,
    economic_indicator_gdp,
    consumer_confidence_index,
    seasonal_index,

    -- Computed categories
    case
      when forecast_horizon_days <= 7 then 'Short-term'
      when forecast_horizon_days <= 30 then 'Medium-term'
      when forecast_horizon_days <= 90 then 'Quarterly'
      else 'Long-range'
    end as forecast_horizon_category,

    case
      when current_inventory_level / nullif(adjusted_demand_forecast, 0) < 0.5 then 'Critical'
      when current_inventory_level / nullif(adjusted_demand_forecast, 0) < 1.0 then 'Low'
      when current_inventory_level / nullif(adjusted_demand_forecast, 0) < 2.0 then 'Adequate'
      else 'Excess'
    end as inventory_health,

    case
      when competitor_price_index > 105 then 'Price Advantage'
      when competitor_price_index < 95 then 'Price Disadvantage'
      else 'Price Parity'
    end as competitive_position,

    -- Demand signal composite: combines promo, competitive, seasonal, macro signals
    round(
      (case when promotional_activity_flag then 0.2 else 0 end) +
      (case when category_growth_rate > 5 then 0.2 else 0 end) +
      (case when consumer_confidence_index > 110 then 0.15 else 0 end) +
      (case when seasonal_index > 1.2 then 0.15 else 0 end) +
      (case when competitor_price_index > 100 then 0.15 else 0 end) +
      (case when economic_indicator_gdp > 2 then 0.15 else 0 end)
    , 2) as demand_signal_score,

    -- Needs review flag: high MAPE + stockout risk
    case
      when forecast_accuracy_mape > 30
        and (current_inventory_level / nullif(adjusted_demand_forecast, 0)) < 1.0
      then true
      else false
    end as needs_review

  from staged

)

select * from enriched
