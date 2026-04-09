{{ config(materialized='semantic_view') }}

TABLES (
  DEMAND_INTEL AS {{ ref('fct_demand_intelligence') }}
    UNIQUE (RECORD_ID)
    COMMENT='Supply chain demand intelligence records with forecast accuracy, stockout risk, and inventory health metrics. Data flows from PostgreSQL through Fivetran to Snowflake. Use to analyze demand forecasting performance, SKU-level stockout risk, and inventory health across product categories and locations.'
)
FACTS (
  DEMAND_INTEL.FORECAST_ACCURACY_MAPE AS FORECAST_ACCURACY_MAPE COMMENT='Mean Absolute Percentage Error for forecast accuracy. Lower values indicate better accuracy. Values below 10% are Excellent, 10-20% Good, 20-30% Fair, above 30% Poor.',
  DEMAND_INTEL.STOCKOUT_RISK_SCORE AS STOCKOUT_RISK_SCORE COMMENT='Predicted stockout risk score from 0 to 1. Scores above 0.7 indicate critical risk requiring immediate inventory replenishment action.',
  DEMAND_INTEL.DEMAND_SIGNAL_SCORE AS DEMAND_SIGNAL_SCORE COMMENT='Composite demand signal score from 0 to 100 combining POS transaction data, consumer confidence, and market trends. Higher scores indicate stronger near-term demand.',
  DEMAND_INTEL.INVENTORY_DAYS_SUPPLY AS INVENTORY_DAYS_SUPPLY COMMENT='Estimated number of days current inventory will last based on forecast demand. Under 7 days is Critical, 7-14 days Low, 14-30 days Adequate, over 30 days Surplus.',
  DEMAND_INTEL.BASELINE_DEMAND_FORECAST AS BASELINE_DEMAND_FORECAST COMMENT='Baseline statistical demand forecast in units before any adjustments.',
  DEMAND_INTEL.ADJUSTED_DEMAND_FORECAST AS ADJUSTED_DEMAND_FORECAST COMMENT='Final adjusted demand forecast incorporating sales rep overrides and promotional lift.',
  DEMAND_INTEL.ACTUAL_SALES_UNITS AS ACTUAL_SALES_UNITS COMMENT='Actual units sold — used to calculate forecast accuracy against the baseline and adjusted forecasts.',
  DEMAND_INTEL.CURRENT_INVENTORY_LEVEL AS CURRENT_INVENTORY_LEVEL COMMENT='Current on-hand inventory level in units at the time of the forecast record.',
  DEMAND_INTEL.SEASONAL_INDEX AS SEASONAL_INDEX COMMENT='Seasonal adjustment index. Values above 1.0 indicate above-average seasonal demand for the period.',
  DEMAND_INTEL.PROMOTION_DISCOUNT_PERCENT AS PROMOTION_DISCOUNT_PERCENT COMMENT='Discount percentage applied during promotional activity. Use to correlate promotions with demand lift.',
  DEMAND_INTEL.SALES_REP_ADJUSTMENT AS SALES_REP_ADJUSTMENT COMMENT='Manual forecast adjustment made by sales representatives. Positive values indicate upward override, negative values indicate downward override.',
  DEMAND_INTEL.COMPETITOR_PRICE_INDEX AS COMPETITOR_PRICE_INDEX COMMENT='Relative competitor pricing index. Values above 1.0 indicate competitors are priced higher, creating pricing advantage.',
  DEMAND_INTEL.CONSUMER_CONFIDENCE_INDEX AS CONSUMER_CONFIDENCE_INDEX COMMENT='Consumer confidence index at time of forecast. Higher values indicate stronger consumer sentiment and likely higher demand.',
  DEMAND_INTEL.MARKET_SHARE_PERCENT AS MARKET_SHARE_PERCENT COMMENT='Estimated market share percentage for this SKU in its category.',
  DEMAND_INTEL.POS_TRANSACTION_COUNT AS POS_TRANSACTION_COUNT COMMENT='Point-of-sale transaction count used as a real-time demand signal.'
)
DIMENSIONS (
  DEMAND_INTEL.RECORD_ID AS RECORD_ID COMMENT='Unique identifier for each demand forecast record.',
  DEMAND_INTEL.PRODUCT_SKU AS PRODUCT_SKU COMMENT='Product SKU identifier. Use to analyze individual product performance.',
  DEMAND_INTEL.PRODUCT_CATEGORY AS PRODUCT_CATEGORY COMMENT='Product category classification. Use to group and compare performance across categories.',
  DEMAND_INTEL.LOCATION_CODE AS LOCATION_CODE COMMENT='Distribution center or location code. Use to analyze regional demand and inventory patterns.',
  DEMAND_INTEL.FORECAST_DATE AS FORECAST_DATE COMMENT='Date of the demand forecast record.',
  DEMAND_INTEL.FORECAST_HORIZON_DAYS AS FORECAST_HORIZON_DAYS COMMENT='Number of days in the forecast horizon — typically 7, 14, 30, or 90 days.',
  DEMAND_INTEL.STOCKOUT_INDICATOR AS STOCKOUT_INDICATOR COMMENT='Binary flag indicating whether a stockout occurred for this SKU at this location.',
  DEMAND_INTEL.PROMOTIONAL_ACTIVITY_FLAG AS PROMOTIONAL_ACTIVITY_FLAG COMMENT='Indicates whether a promotional campaign is active for this SKU during the forecast period.',
  DEMAND_INTEL.ECONOMIC_INDICATOR_GDP AS ECONOMIC_INDICATOR_GDP COMMENT='GDP growth indicator relevant to macroeconomic demand context.',
  DEMAND_INTEL.CATEGORY_GROWTH_RATE AS CATEGORY_GROWTH_RATE COMMENT='Year-over-year growth rate for the product category. Use to contextualize individual SKU performance.',
  DEMAND_INTEL.INVENTORY_HEALTH AS INVENTORY_HEALTH COMMENT='Inventory health tier: Critical (under 7 days supply), Low (7-14 days), Adequate (14-30 days), Surplus (over 30 days).',
  DEMAND_INTEL.FORECAST_ACCURACY_TIER AS FORECAST_ACCURACY_TIER COMMENT='Forecast accuracy tier based on MAPE: Excellent (under 10%), Good (10-20%), Fair (20-30%), Poor (over 30%).',
  DEMAND_INTEL.NEEDS_REVIEW AS NEEDS_REVIEW COMMENT='Flag for records needing immediate attention — true when stockout risk is high or forecast accuracy is Poor or Fair.',
  DEMAND_INTEL.COMPETITIVE_POSITION AS COMPETITIVE_POSITION COMMENT='Competitive position classification based on market share and competitor pricing: Strong, Moderate, or Weak.'
)
COMMENT='Demand intelligence semantic view for Cortex Analyst. Contains SKU-level demand forecasting records with stockout risk scores, inventory health metrics, and demand signal analysis across product categories and locations.'
