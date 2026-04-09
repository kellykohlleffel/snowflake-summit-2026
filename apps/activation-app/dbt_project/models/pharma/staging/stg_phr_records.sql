{{
  config(
    materialized='view',
    tags=['staging', 'pharma']
  )
}}

with source as (

  select * from {{ source('pharma', 'PHR_RECORDS') }}

),

cleaned as (

  select
    record_id,
    trial_id,
    protocol_id,
    trial_name,
    sponsor_name,
    disease_area,
    patient_id,
    patient_age,
    patient_gender,
    site_id,
    site_name,
    trial_status,
    regulatory_approval_status,
    cast(enrollment_date as date) as enrollment_date,
    cast(protocol_amendment_date as date) as protocol_amendment_date,
    round(enrollment_rate, 2) as enrollment_rate,
    round(dropout_rate, 2) as dropout_rate
  from source

)

select * from cleaned
