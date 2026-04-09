{{
  config(
    materialized='view',
    tags=['staging', 'agriculture']
  )
}}

with source as (

  select * from {{ source('agriculture', 'AGR_RECORDS') }}

),

cleaned as (

  select
    record_id,
    animal_id,
    farm_id,
    species,
    breed,
    age,
    round(weight, 2) as weight,
    health_status,
    vaccination_history,
    medication_history,
    weather_data,
    round(temperature, 2) as temperature,
    round(humidity, 2) as humidity,
    round(precipitation, 2) as precipitation,
    round(predicted_health_risk, 4) as predicted_health_risk,
    recommended_action
  from source

)

select * from cleaned
