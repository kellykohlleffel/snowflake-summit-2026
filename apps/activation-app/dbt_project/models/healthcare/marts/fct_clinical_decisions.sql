{{
  config(
    materialized='table',
    tags=['marts', 'healthcare']
  )
}}

with staged as (

  select * from {{ ref('stg_cds_records') }}

),

enriched as (

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
    readmission_risk,
    patient_outcome_score,
    cost_of_care,
    medication_cost,
    total_cost_savings,
    medical_error_rate,
    length_of_stay,
    clinical_trial_id,
    trial_name,
    trial_status,
    publication_date,

    -- Total treatment cost
    round(cost_of_care + medication_cost, 2) as total_treatment_cost,

    -- Cost efficiency
    round(total_cost_savings / nullif(cost_of_care + medication_cost, 0), 4) as cost_efficiency,

    -- Readmission risk level
    case
      when readmission_risk < 0.3 then 'Low'
      when readmission_risk between 0.3 and 0.6 then 'Medium'
      when readmission_risk > 0.6 then 'High'
    end as readmission_risk_level,

    -- Outcome quality
    case
      when patient_outcome_score > 0.7 then 'Good'
      when patient_outcome_score between 0.4 and 0.7 then 'Fair'
      when patient_outcome_score < 0.4 then 'Poor'
    end as outcome_quality,

    -- Stay category
    case
      when length_of_stay < 30 then 'Short'
      when length_of_stay between 30 and 120 then 'Medium'
      when length_of_stay > 120 then 'Long'
    end as stay_category,

    -- Needs review
    case
      when readmission_risk > 0.5
        and (medication_adherence = 'Non-Adherent' or medical_error_rate > 0.08)
      then true
      else false
    end as needs_review

  from staged

)

select * from enriched
