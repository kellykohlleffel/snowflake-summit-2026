{{
  config(
    materialized='view',
    tags=['staging', 'healthcare']
  )
}}

with source as (

  select * from {{ source('healthcare', 'CDS_RECORDS') }}

),

cleaned as (

  select
    record_id,
    patient_id,
    diagnosis,
    medical_conditions,
    medical_history,
    family_medical_history,
    allergies,
    vital_signs,
    genetic_data,
    lab_results,
    current_medications,
    medication_adherence,
    medication_recommendation,
    medication_side_effects,
    treatment_plan,
    treatment_recommendation,
    treatment_outcome,
    patient_satisfaction,
    round(readmission_risk, 4) as readmission_risk,
    round(patient_outcome_score, 4) as patient_outcome_score,
    round(cost_of_care, 2) as cost_of_care,
    round(medication_cost, 2) as medication_cost,
    round(total_cost_savings, 2) as total_cost_savings,
    round(medical_error_rate, 4) as medical_error_rate,
    length_of_stay,
    clinical_trial_id,
    trial_name,
    trial_status,
    medical_publication_id,
    publication_title,
    cast(publication_date as date) as publication_date
  from source

)

select * from cleaned
