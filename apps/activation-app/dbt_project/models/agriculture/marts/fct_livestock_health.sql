{{
  config(
    materialized='table',
    tags=['marts', 'agriculture']
  )
}}

with staged as (

  select * from {{ ref('stg_agr_records') }}

),

enriched as (

  select
    record_id,
    animal_id,
    farm_id,
    species,
    breed,
    age,
    weight,
    health_status,
    vaccination_history,
    medication_history,
    weather_data,
    temperature,
    humidity,
    precipitation,
    predicted_health_risk,
    recommended_action,

    -- Risk level
    case
      when predicted_health_risk < 0.3 then 'Low'
      when predicted_health_risk between 0.3 and 0.6 then 'Medium'
      when predicted_health_risk > 0.6 then 'High'
    end as risk_level,

    -- Heat stress flag
    case
      when temperature > 32 and humidity > 60 then true
      else false
    end as heat_stress_flag,

    -- Age category
    case
      when age between 0 and 2 then 'Young'
      when age between 3 and 7 then 'Adult'
      when age > 7 then 'Senior'
    end as age_category,

    -- Weather severity
    case
      when weather_data in ('Sunny', 'Clear', 'Cloudy') then 'Calm'
      when weather_data in ('Rainy', 'Windy') then 'Moderate'
      else 'Severe'
    end as weather_severity,

    -- Needs immediate action
    case
      when health_status in ('Sick', 'Injured') and predicted_health_risk > 0.5 then true
      else false
    end as needs_immediate_action

  from staged

)

select * from enriched
