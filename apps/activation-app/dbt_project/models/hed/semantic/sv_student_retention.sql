{{ config(materialized='semantic_view') }}

TABLES (
  STUDENT_RETENTION AS {{ ref('fct_student_retention') }}
    UNIQUE (RECORD_ID)
    COMMENT='Student-level retention records with academic performance, engagement metrics, and intervention tracking. Data flows from Google Cloud PostgreSQL through Fivetran to Snowflake. Use to identify at-risk students, analyze engagement patterns, and optimize advising strategies across majors.'
)
FACTS (
  STUDENT_RETENTION.CURRENT_GPA AS CURRENT_GPA COMMENT='Student cumulative GPA on a 4.0 scale. Below 2.0 is Critical and triggers academic probation. Below 2.5 is At Risk.',
  STUDENT_RETENTION.ENGAGEMENT_SCORE AS ENGAGEMENT_SCORE COMMENT='Composite engagement metric from 0 to 100 based on LMS activity. Below 30 is Low engagement — a strong predictor of dropout.',
  STUDENT_RETENTION.COURSE_COMPLETION_RATE AS COURSE_COMPLETION_RATE COMMENT='Percentage of enrolled courses completed (0 to 1). Below 0.5 indicates the student is failing to finish most courses.',
  STUDENT_RETENTION.AVG_ASSIGNMENT_SCORE AS AVG_ASSIGNMENT_SCORE COMMENT='Average score across all assignments. Use to identify students struggling academically despite attending.',
  STUDENT_RETENTION.WRITING_QUALITY_SCORE AS WRITING_QUALITY_SCORE COMMENT='AI-assessed writing quality score. Low scores combined with high plagiarism incidents may indicate academic integrity issues.',
  STUDENT_RETENTION.FINANCIAL_AID_AMOUNT AS FINANCIAL_AID_AMOUNT COMMENT='Total financial aid awarded in dollars. Zero aid may correlate with higher dropout risk.',
  STUDENT_RETENTION.CREDIT_COMPLETION_RATE AS CREDIT_COMPLETION_RATE COMMENT='Ratio of credits earned to credits attempted. Below 0.7 indicates the student is frequently withdrawing or failing courses.',
  STUDENT_RETENTION.RETENTION_RISK_SCORE AS RETENTION_RISK_SCORE COMMENT='Composite risk score from 0 to 100. Factors: at-risk flag (40%), incomplete courses (30%), low GPA (20%), low engagement (10%). Above 50 needs intervention.',
  STUDENT_RETENTION.DAYS_SINCE_LOGIN AS DAYS_SINCE_LOGIN COMMENT='Days since the student last logged into the LMS. Over 14 days is concerning. Over 30 days suggests the student has disengaged.',
  STUDENT_RETENTION.TOTAL_COURSE_VIEWS AS TOTAL_COURSE_VIEWS COMMENT='Total number of course content views in the LMS. Use as a leading indicator of engagement.',
  STUDENT_RETENTION.DISCUSSION_POSTS AS DISCUSSION_POSTS COMMENT='Number of discussion forum posts. Low participation combined with low engagement score indicates social isolation.',
  STUDENT_RETENTION.INTERVENTION_COUNT AS INTERVENTION_COUNT COMMENT='Number of advising interventions already performed. Students with high risk but low intervention count are the highest priority.'
)
DIMENSIONS (
  STUDENT_RETENTION.ACADEMIC_STANDING AS ACADEMIC_STANDING COMMENT='Official academic standing: Satisfactory Progress, Academic Probation, Dean List, or Suspended.',
  STUDENT_RETENTION.MAJOR_CODE AS MAJOR_CODE COMMENT='Student major code: PHIL, POLI, ECON, PSYCH, BIOL, CHEM, MATH, ENGR, HIST, ENGL, and others.',
  STUDENT_RETENTION.GPA_BRACKET AS GPA_BRACKET COMMENT='GPA performance tier: Critical (below 2.0), At Risk (2.0-2.49), Warning (2.5-2.99), Good (3.0-3.49), Excellent (3.5-4.0).',
  STUDENT_RETENTION.ENGAGEMENT_LEVEL AS ENGAGEMENT_LEVEL COMMENT='Engagement tier: Low (below 30), Medium (30-60), or High (above 60). Low engagement is the strongest dropout predictor.',
  STUDENT_RETENTION.AT_RISK_FLAG AS AT_RISK_FLAG COMMENT='Boolean flag from the source system indicating the student has been flagged as at-risk by their advisor or an early alert system.',
  STUDENT_RETENTION.NEEDS_INTERVENTION AS NEEDS_INTERVENTION COMMENT='Computed flag: true when retention risk score exceeds 50 and fewer than 2 interventions have been performed. These students need immediate outreach.',
  STUDENT_RETENTION.ENROLLMENT_DATE AS ENROLLMENT_DATE COMMENT='Date the student enrolled. Use to analyze retention by cohort and identify seasonal patterns.',
  STUDENT_RETENTION.STUDENT_ID AS STUDENT_ID COMMENT='Unique student identifier. Use to identify specific students in queries about individual students or lists of at-risk students.'
)
COMMENT='Student retention analytics semantic view for Cortex Analyst. Contains student-level records with GPA, engagement, course completion, and risk metrics across majors and academic standings.'
