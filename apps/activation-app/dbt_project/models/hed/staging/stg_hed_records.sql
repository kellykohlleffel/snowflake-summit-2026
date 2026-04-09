{{
  config(
    materialized='view',
    tags=['staging', 'hed']
  )
}}

with source as (

  select * from {{ source('hed', 'HED_RECORDS') }}

),

cleaned as (

  select
    record_id,
    student_id,
    cast(left(enrollment_date, 10) as date) as enrollment_date,
    academic_standing,
    round(current_gpa, 2) as current_gpa,
    credit_hours_attempted,
    credit_hours_earned,
    major_code,
    advisor_id,
    round(financial_aid_amount, 2) as financial_aid_amount,
    cast(last_login_date as timestamp) as last_login_date,
    total_course_views,
    assignment_submissions,
    discussion_posts,
    round(avg_assignment_score, 2) as avg_assignment_score,
    round(course_completion_rate, 2) as course_completion_rate,
    plagiarism_incidents,
    round(writing_quality_score, 2) as writing_quality_score,
    round(engagement_score, 2) as engagement_score,
    at_risk_flag,
    intervention_count,
    cast(last_updated as timestamp) as last_updated
  from source

)

select * from cleaned
