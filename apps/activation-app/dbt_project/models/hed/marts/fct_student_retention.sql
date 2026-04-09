{{
  config(
    materialized='table',
    tags=['marts', 'hed']
  )
}}

with staged as (

  select * from {{ ref('stg_hed_records') }}

),

enriched as (

  select
    record_id,
    student_id,
    enrollment_date,
    academic_standing,
    current_gpa,
    credit_hours_attempted,
    credit_hours_earned,
    major_code,
    advisor_id,
    financial_aid_amount,
    last_login_date,
    total_course_views,
    assignment_submissions,
    discussion_posts,
    avg_assignment_score,
    course_completion_rate,
    plagiarism_incidents,
    writing_quality_score,
    engagement_score,
    at_risk_flag,
    intervention_count,
    last_updated,

    -- GPA bracket
    case
      when current_gpa < 2.0 then 'Critical'
      when current_gpa between 2.0 and 2.49 then 'At Risk'
      when current_gpa between 2.5 and 2.99 then 'Warning'
      when current_gpa between 3.0 and 3.49 then 'Good'
      when current_gpa >= 3.5 then 'Excellent'
    end as gpa_bracket,

    -- Credit completion rate
    round(credit_hours_earned / nullif(credit_hours_attempted, 0)::numeric, 2) as credit_completion_rate,

    -- Days since last login
    datediff('day', last_login_date, current_timestamp()) as days_since_login,

    -- Engagement level
    case
      when engagement_score < 30 then 'Low'
      when engagement_score between 30 and 60 then 'Medium'
      when engagement_score > 60 then 'High'
    end as engagement_level,

    -- Retention risk score (0-100)
    round(
      (case when at_risk_flag = 'TRUE' then 40 else 0 end)
      + ((1 - course_completion_rate) * 30)
      + (case
          when current_gpa < 2.0 then 20
          when current_gpa < 2.5 then 10
          else 0
        end)
      + (case when engagement_score < 30 then 10 else 0 end),
      2
    ) as retention_risk_score,

    -- Needs intervention
    case
      when (
        (case when at_risk_flag = 'TRUE' then 40 else 0 end)
        + ((1 - course_completion_rate) * 30)
        + (case when current_gpa < 2.0 then 20 when current_gpa < 2.5 then 10 else 0 end)
        + (case when engagement_score < 30 then 10 else 0 end)
      ) > 50
      and intervention_count < 2
      then true
      else false
    end as needs_intervention

  from staged

)

select * from enriched
