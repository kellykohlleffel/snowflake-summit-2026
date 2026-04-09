{{ config(materialized='semantic_view') }}

TABLES (
  CLINICAL_DECISIONS AS {{ ref('fct_clinical_decisions') }}
    UNIQUE (RECORD_ID)
    COMMENT='Patient clinical records with treatment outcomes, readmission risk, medication adherence, and cost metrics. Data flows from Google Cloud PostgreSQL through Fivetran to Snowflake. Use to identify high-risk patients, optimize treatment protocols, and reduce readmissions and medical errors.'
)
FACTS (
  CLINICAL_DECISIONS.READMISSION_RISK AS READMISSION_RISK COMMENT='Predicted probability of patient readmission from 0 to 1. Above 0.6 is High risk requiring proactive care planning and discharge follow-up.',
  CLINICAL_DECISIONS.PATIENT_OUTCOME_SCORE AS PATIENT_OUTCOME_SCORE COMMENT='Treatment outcome quality from 0 to 1. Above 0.7 is Good, 0.4-0.7 is Fair, below 0.4 is Poor. Low scores may indicate need for protocol review.',
  CLINICAL_DECISIONS.COST_OF_CARE AS COST_OF_CARE COMMENT='Total cost of patient care in dollars. Use to analyze cost drivers across diagnoses and treatment plans.',
  CLINICAL_DECISIONS.MEDICATION_COST AS MEDICATION_COST COMMENT='Cost of medications prescribed to the patient. Compare with treatment outcomes to assess cost-effectiveness.',
  CLINICAL_DECISIONS.TOTAL_TREATMENT_COST AS TOTAL_TREATMENT_COST COMMENT='Combined cost of care plus medication cost. Use for total cost analysis across diagnoses and treatment types.',
  CLINICAL_DECISIONS.TOTAL_COST_SAVINGS AS TOTAL_COST_SAVINGS COMMENT='Estimated cost savings achieved through clinical decision support interventions.',
  CLINICAL_DECISIONS.COST_EFFICIENCY AS COST_EFFICIENCY COMMENT='Ratio of cost savings to total treatment cost. Higher values indicate more cost-effective care.',
  CLINICAL_DECISIONS.MEDICAL_ERROR_RATE AS MEDICAL_ERROR_RATE COMMENT='Rate of medical errors from 0 to 1. Above 0.08 is concerning and triggers review. Use to identify systemic issues.',
  CLINICAL_DECISIONS.LENGTH_OF_STAY AS LENGTH_OF_STAY COMMENT='Number of days the patient stayed in care. Longer stays increase cost and readmission risk.'
)
DIMENSIONS (
  CLINICAL_DECISIONS.DIAGNOSIS AS DIAGNOSIS COMMENT='Primary diagnosis: Kidney Disease, Stroke, Asthma, Diabetes, Heart Disease, Cancer, Arthritis, COPD, etc.',
  CLINICAL_DECISIONS.MEDICAL_CONDITIONS AS MEDICAL_CONDITIONS COMMENT='Active medical conditions the patient is being treated for.',
  CLINICAL_DECISIONS.TREATMENT_OUTCOME AS TREATMENT_OUTCOME COMMENT='Result of treatment: Successful, Partially Successful, Unsuccessful, or Ongoing.',
  CLINICAL_DECISIONS.MEDICATION_ADHERENCE AS MEDICATION_ADHERENCE COMMENT='Patient medication compliance: Adherent, Partially Adherent, or Non-Adherent. Non-adherence is a top readmission driver.',
  CLINICAL_DECISIONS.PATIENT_SATISFACTION AS PATIENT_SATISFACTION COMMENT='Patient satisfaction level: Satisfied, Neutral, or Unsatisfied.',
  CLINICAL_DECISIONS.READMISSION_RISK_LEVEL AS READMISSION_RISK_LEVEL COMMENT='Risk tier: Low (under 30%), Medium (30-60%), or High (over 60%). High-risk patients need discharge planning.',
  CLINICAL_DECISIONS.OUTCOME_QUALITY AS OUTCOME_QUALITY COMMENT='Outcome tier: Good (above 0.7), Fair (0.4-0.7), or Poor (below 0.4).',
  CLINICAL_DECISIONS.STAY_CATEGORY AS STAY_CATEGORY COMMENT='Length of stay bucket: Short (under 30 days), Medium (30-120 days), or Long (over 120 days).',
  CLINICAL_DECISIONS.NEEDS_REVIEW AS NEEDS_REVIEW COMMENT='Boolean flag: true when readmission risk exceeds 50% AND patient is non-adherent or error rate exceeds 8%. These cases need clinical review.',
  CLINICAL_DECISIONS.ALLERGIES AS ALLERGIES COMMENT='Allergy severity: None, Moderate, or Severe. Affects treatment plan selection.',
  CLINICAL_DECISIONS.VITAL_SIGNS AS VITAL_SIGNS COMMENT='Current vital signs status: Stable, Unstable, or Critical.',
  CLINICAL_DECISIONS.TREATMENT_PLAN AS TREATMENT_PLAN COMMENT='Current treatment approach: Medication, Surgery, Therapy, Monitoring, or Lifestyle Changes.',
  CLINICAL_DECISIONS.PATIENT_ID AS PATIENT_ID COMMENT='Unique patient identifier. Use to identify specific patients in queries about individual patients or high-risk cases.'
)
COMMENT='Clinical decision support semantic view for Cortex Analyst. Contains patient records with readmission risk, treatment outcomes, medication adherence, and cost metrics across diagnoses and treatment types.'
