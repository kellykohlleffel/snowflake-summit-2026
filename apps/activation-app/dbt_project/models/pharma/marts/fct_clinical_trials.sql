{{
  config(
    materialized='table',
    tags=['marts', 'pharma']
  )
}}

with staged as (

  select * from {{ ref('stg_phr_records') }}

),

enriched as (

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
    enrollment_date,
    protocol_amendment_date,
    enrollment_rate,
    dropout_rate,

    -- Age group buckets
    case
      when patient_age between 18 and 30 then '18-30'
      when patient_age between 31 and 45 then '31-45'
      when patient_age between 46 and 60 then '46-60'
      when patient_age between 61 and 80 then '61-80'
    end as age_group,

    -- Days since enrollment
    datediff('day', enrollment_date, current_date()) as days_since_enrollment,

    -- Days between enrollment and protocol amendment
    datediff('day', enrollment_date, protocol_amendment_date) as days_to_amendment,

    -- Trial risk score (0-100, higher = more risk)
    -- Factors: high dropout rate, low enrollment rate, concerning trial status
    round(
      (dropout_rate * 0.5)
      + ((100 - enrollment_rate) * 0.3)
      + (case
          when trial_status in ('Terminated', 'Suspended', 'Withdrawn') then 20
          when trial_status in ('Inactive', 'Closed') then 10
          else 0
        end),
      2
    ) as trial_risk_score,

    -- Risk flag
    case
      when dropout_rate > 40
        and enrollment_rate < 30
        and trial_status in ('Recruiting', 'Enrolling', 'Active', 'Pre-Enrollment')
      then true
      else false
    end as is_at_risk

  from staged

)

select * from enriched
