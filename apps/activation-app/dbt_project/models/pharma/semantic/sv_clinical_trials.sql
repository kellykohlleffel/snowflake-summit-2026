{{ config(materialized='semantic_view') }}

TABLES (
  CLINICAL_TRIALS AS {{ ref('fct_clinical_trials') }}
    UNIQUE (RECORD_ID)
    COMMENT='Patient-level clinical trial records with enrollment metrics, dropout rates, risk scores, and regulatory status. Data flows from Google Cloud PostgreSQL through Fivetran to Snowflake. Use to analyze trial performance, patient demographics, sponsor effectiveness, and clinical risk across 15 disease areas.'
)
FACTS (
  CLINICAL_TRIALS.ENROLLMENT_RATE AS ENROLLMENT_RATE COMMENT='Percentage of target patients successfully enrolled in the trial. Higher values indicate strong recruitment. Rates below 30% suggest enrollment challenges that may delay the trial timeline.',
  CLINICAL_TRIALS.DROPOUT_RATE AS DROPOUT_RATE COMMENT='Percentage of enrolled patients who discontinued the trial before completion. Values above 40% indicate potential safety concerns, adverse events, or excessive protocol burden.',
  CLINICAL_TRIALS.TRIAL_RISK_SCORE AS TRIAL_RISK_SCORE COMMENT='Composite risk score from 0 to 100 calculated from dropout rate (50% weight), inverse enrollment rate (30% weight), and trial status penalties (20% weight). Scores above 60 indicate high-risk trials requiring attention.',
  CLINICAL_TRIALS.PATIENT_AGE AS PATIENT_AGE COMMENT='Age of the patient at enrollment, ranging from 18 to 80 years. Use to analyze age-related enrollment patterns and demographic representation.',
  CLINICAL_TRIALS.DAYS_SINCE_ENROLLMENT AS DAYS_SINCE_ENROLLMENT COMMENT='Number of days from patient enrollment to today. Use to identify long-running trials and analyze enrollment timing patterns.',
  CLINICAL_TRIALS.DAYS_TO_AMENDMENT AS DAYS_TO_AMENDMENT COMMENT='Days between enrollment and most recent protocol amendment. Negative values mean amendment occurred before enrollment. Frequent early amendments may indicate protocol design issues.'
)
DIMENSIONS (
  CLINICAL_TRIALS.DISEASE_AREA AS DISEASE_AREA COMMENT='Medical specialty such as Oncology, Cardiology, Immunology, Neurology, or Dermatology. 15 disease areas total.',
  CLINICAL_TRIALS.SPONSOR_NAME AS SPONSOR_NAME COMMENT='Organization sponsoring the trial: Pharmaceutical Company, BioTech Inc., University Hospital, Academic Institution, Government Agency, and others.',
  CLINICAL_TRIALS.TRIAL_STATUS AS TRIAL_STATUS COMMENT='Current operational status: Recruiting, Active, Completed, Suspended, Terminated, Withdrawn, Inactive, Enrolling, Pre-Enrollment, Data Review, or Closed.',
  CLINICAL_TRIALS.REGULATORY_APPROVAL_STATUS AS REGULATORY_APPROVAL_STATUS COMMENT='Regulatory review status: Approved, Pending, Under Review, Conditionally Approved, Rejected, On Hold, Suspended, Withdrawn, Expired, or Revoked.',
  CLINICAL_TRIALS.TRIAL_NAME AS TRIAL_NAME COMMENT='Therapeutic category: Oncology, Pain Management, Cardiovascular, Diabetes, Neurological Disorder, Autoimmune, and others. 15 categories total.',
  CLINICAL_TRIALS.SITE_NAME AS SITE_NAME COMMENT='Type of facility conducting the trial: Pharmaceutical Company, University Hospital, Military Hospital, Contract Research Organization, or Community Clinic.',
  CLINICAL_TRIALS.PATIENT_GENDER AS PATIENT_GENDER COMMENT='Patient gender: Female, Male, or Other. Use to analyze demographic representation and gender-specific patterns.',
  CLINICAL_TRIALS.AGE_GROUP AS AGE_GROUP COMMENT='Patient age bucket: 18-30, 31-45, 46-60, or 61-80. Use for demographic analysis and age-related trends.',
  CLINICAL_TRIALS.IS_AT_RISK AS IS_AT_RISK COMMENT='Boolean flag for high-risk trials: true when dropout rate exceeds 40%, enrollment rate below 30%, and trial is still actively recruiting. Use to quickly identify trials needing intervention.',
  CLINICAL_TRIALS.ENROLLMENT_DATE AS ENROLLMENT_DATE COMMENT='Date the patient enrolled in the trial. Ranges from August 2024 to August 2025.'
)
COMMENT='Clinical trials analytics semantic view for Cortex Analyst. Contains patient-level trial records with enrollment metrics, dropout rates, risk scores, and regulatory status across 15 disease areas and 15 sponsor types.'
