{{ config(materialized='semantic_view') }}

TABLES (
  FINANCIAL_ANALYTICS AS {{ ref('fct_financial_analytics') }}
    UNIQUE (RECORD_ID)
    COMMENT='Customer account records with transaction metrics, churn probability, product recommendations, and satisfaction scores. Data flows from Google Cloud PostgreSQL through Fivetran to Snowflake. Use to analyze customer health, churn risk, product cross-sell effectiveness, and segment performance.'
)
FACTS (
  FINANCIAL_ANALYTICS.ACCOUNT_BALANCE AS ACCOUNT_BALANCE COMMENT='Current account balance in dollars. Use to segment customers by wealth tier and identify high-value relationships.',
  FINANCIAL_ANALYTICS.CUSTOMER_TRANSACTION_VALUE AS CUSTOMER_TRANSACTION_VALUE COMMENT='Total transaction value across all customer interactions. Higher values indicate more engaged customers.',
  FINANCIAL_ANALYTICS.CUSTOMER_SATISFACTION_SCORE AS CUSTOMER_SATISFACTION_SCORE COMMENT='Customer satisfaction from 0 to 1. Below 0.5 indicates dissatisfaction requiring immediate outreach.',
  FINANCIAL_ANALYTICS.CUSTOMER_CHURN_PROBABILITY AS CUSTOMER_CHURN_PROBABILITY COMMENT='Predicted probability of customer churning from 0 to 1. Above 0.6 is High risk requiring retention intervention.',
  FINANCIAL_ANALYTICS.CUSTOMER_HEALTH_SCORE AS CUSTOMER_HEALTH_SCORE COMMENT='Composite health score from 0 to 1 combining satisfaction (40%), product affinity (30%), and inverse churn risk (30%). Below 0.4 needs attention.',
  FINANCIAL_ANALYTICS.RECOMMENDATION_SCORE AS RECOMMENDATION_SCORE COMMENT='AI-generated score from 0 to 1 indicating how well the recommended product fits the customer. Higher scores mean better fit.',
  FINANCIAL_ANALYTICS.PRODUCT_SALES_AMOUNT AS PRODUCT_SALES_AMOUNT COMMENT='Revenue from product sales to this customer. Use to analyze product performance across segments.',
  FINANCIAL_ANALYTICS.CUSTOMER_PRODUCT_AFFINITY AS CUSTOMER_PRODUCT_AFFINITY COMMENT='How strongly the customer aligns with their current product from 0 to 1. Low affinity with high balance suggests cross-sell opportunity.',
  FINANCIAL_ANALYTICS.DAYS_SINCE_TRANSITION AS DAYS_SINCE_TRANSITION COMMENT='Days since the customer last changed lifecycle stage. Long periods in Inactive stage indicate disengagement.',
  FINANCIAL_ANALYTICS.CUSTOMER_TRANSACTION_COUNT AS CUSTOMER_TRANSACTION_COUNT COMMENT='Total number of transactions. Combined with transaction value, reveals average transaction size and engagement frequency.'
)
DIMENSIONS (
  FINANCIAL_ANALYTICS.CUSTOMER_SEGMENT AS CUSTOMER_SEGMENT COMMENT='Business segment: Commercial, Wealth Management, Retail, Small Business, or Corporate.',
  FINANCIAL_ANALYTICS.CUSTOMER_LIFECYCLE_STAGE AS CUSTOMER_LIFECYCLE_STAGE COMMENT='Customer lifecycle position: Active, Engaged, Inactive, New, or At Risk. Inactive customers need re-engagement.',
  FINANCIAL_ANALYTICS.PRODUCT_TYPE AS PRODUCT_TYPE COMMENT='Financial product type: Savings Account, Insurance, Auto Loan, Credit Card, Mortgage, Investment, etc.',
  FINANCIAL_ANALYTICS.BALANCE_TIER AS BALANCE_TIER COMMENT='Account balance bucket: Low (under $25K), Medium ($25K-$75K), or High (over $75K).',
  FINANCIAL_ANALYTICS.CHURN_RISK_LEVEL AS CHURN_RISK_LEVEL COMMENT='Churn risk tier: Low (under 30%), Medium (30-60%), or High (over 60%). High-risk customers need immediate retention outreach.',
  FINANCIAL_ANALYTICS.PRODUCT_RECOMMENDATION_STATUS AS PRODUCT_RECOMMENDATION_STATUS COMMENT='Status of product recommendation: Accepted, Rejected, or Pending. Track recommendation effectiveness.',
  FINANCIAL_ANALYTICS.RECOMMENDATION_ACCEPTED AS RECOMMENDATION_ACCEPTED COMMENT='Boolean: true if the customer accepted the product recommendation. Use to measure cross-sell conversion rates.',
  FINANCIAL_ANALYTICS.NEEDS_ATTENTION AS NEEDS_ATTENTION COMMENT='Boolean flag: true when churn probability exceeds 60% AND satisfaction is below 50%. These customers require immediate outreach.',
  FINANCIAL_ANALYTICS.PRODUCT_SALES_DATE AS PRODUCT_SALES_DATE COMMENT='Date of the most recent product sale. Use for trend analysis and seasonal patterns.',
  FINANCIAL_ANALYTICS.CUSTOMER_ID AS CUSTOMER_ID COMMENT='Unique customer identifier. Use to identify specific customers in queries about individual customers or at-risk accounts.',
  FINANCIAL_ANALYTICS.CUSTOMER_NAME AS CUSTOMER_NAME COMMENT='Customer full name. Use alongside customer_id for human-readable customer identification.'
)
COMMENT='Financial services analytics semantic view for Cortex Analyst. Contains customer account data with churn prediction, satisfaction scores, and product recommendation metrics across segments and product types.'
