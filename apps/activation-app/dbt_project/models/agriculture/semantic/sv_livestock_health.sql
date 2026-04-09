{{ config(materialized='semantic_view') }}

TABLES (
  LIVESTOCK_HEALTH AS {{ ref('fct_livestock_health') }}
    UNIQUE (RECORD_ID)
    COMMENT='Animal health records with weather conditions, vaccination status, and AI-predicted health risk. Data flows from Google Cloud PostgreSQL through Fivetran to Snowflake. Use to identify at-risk animals, analyze weather impact on herd health, and optimize veterinary interventions across farms.'
)
FACTS (
  LIVESTOCK_HEALTH.TEMPERATURE AS TEMPERATURE COMMENT='Current temperature in degrees Celsius at the farm location. Above 32C combined with high humidity triggers heat stress alerts.',
  LIVESTOCK_HEALTH.HUMIDITY AS HUMIDITY COMMENT='Current humidity percentage at the farm location. Above 60% combined with high temperature indicates heat stress conditions.',
  LIVESTOCK_HEALTH.PRECIPITATION AS PRECIPITATION COMMENT='Precipitation in millimeters. High precipitation may increase disease transmission risk for outdoor livestock.',
  LIVESTOCK_HEALTH.PREDICTED_HEALTH_RISK AS PREDICTED_HEALTH_RISK COMMENT='AI-predicted health risk from 0 to 1. Above 0.6 is High risk requiring immediate veterinary attention. Factors include weather, vaccination status, current health, and age.',
  LIVESTOCK_HEALTH.WEIGHT AS WEIGHT COMMENT='Animal weight in pounds (cattle) or pounds (poultry). Sudden weight changes may indicate illness.',
  LIVESTOCK_HEALTH.AGE AS AGE COMMENT='Animal age in years. Senior animals (8+) are more vulnerable to weather stress and disease.'
)
DIMENSIONS (
  LIVESTOCK_HEALTH.SPECIES AS SPECIES COMMENT='Animal species: Beef Cattle, Dairy Cattle, Chickens, Pigs, Sheep, Goats, Horses, or Turkeys.',
  LIVESTOCK_HEALTH.BREED AS BREED COMMENT='Specific breed within species: Brahman, Angus, Hereford, Brahma, Buff Orpington, etc.',
  LIVESTOCK_HEALTH.HEALTH_STATUS AS HEALTH_STATUS COMMENT='Current health status: Healthy, Sick, Injured, Recovering, or Under Observation.',
  LIVESTOCK_HEALTH.VACCINATION_HISTORY AS VACCINATION_HISTORY COMMENT='Vaccination status: Up-to-date, Overdue, Partial, or None. Overdue vaccinations increase disease risk.',
  LIVESTOCK_HEALTH.MEDICATION_HISTORY AS MEDICATION_HISTORY COMMENT='Current medication status: None, Current, Completed, or Discontinued.',
  LIVESTOCK_HEALTH.WEATHER_DATA AS WEATHER_DATA COMMENT='Current weather condition: Sunny, Cloudy, Rainy, Windy, Stormy, etc.',
  LIVESTOCK_HEALTH.RISK_LEVEL AS RISK_LEVEL COMMENT='Health risk tier: Low (under 30%), Medium (30-60%), or High (over 60%). High-risk animals need immediate attention.',
  LIVESTOCK_HEALTH.HEAT_STRESS_FLAG AS HEAT_STRESS_FLAG COMMENT='Boolean: true when temperature exceeds 32C and humidity exceeds 60%. Heat stress can cause mortality in livestock.',
  LIVESTOCK_HEALTH.AGE_CATEGORY AS AGE_CATEGORY COMMENT='Age bucket: Young (0-2 years), Adult (3-7 years), or Senior (8+ years). Senior animals are most vulnerable.',
  LIVESTOCK_HEALTH.WEATHER_SEVERITY AS WEATHER_SEVERITY COMMENT='Weather impact level: Calm (sunny/clear/cloudy), Moderate (rainy/windy), or Severe (stormy/extreme).',
  LIVESTOCK_HEALTH.NEEDS_IMMEDIATE_ACTION AS NEEDS_IMMEDIATE_ACTION COMMENT='Boolean: true when animal is Sick or Injured AND predicted risk exceeds 50%. These animals need veterinary intervention now.',
  LIVESTOCK_HEALTH.RECOMMENDED_ACTION AS RECOMMENDED_ACTION COMMENT='AI-recommended action: Monitor closely, Administer medication, Quarantine, Veterinary visit, or No action needed.',
  LIVESTOCK_HEALTH.FARM_ID AS FARM_ID COMMENT='Farm identifier. Use to compare health outcomes and risk levels across farms.',
  LIVESTOCK_HEALTH.RECORD_ID AS ANIMAL_ID COMMENT='Unique animal identifier. Use to identify specific animals in queries about individual animals or lists of at-risk animals.'
)
COMMENT='Livestock health analytics semantic view for Cortex Analyst. Contains animal health records with weather impact, vaccination status, and AI-predicted risk metrics across species, breeds, and farms.'
