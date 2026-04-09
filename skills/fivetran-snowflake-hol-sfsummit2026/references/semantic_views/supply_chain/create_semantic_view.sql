-- Supply Chain Demand Intelligence Semantic View
-- Working DDL extracted from HOL_DATABASE_1.SUPPLY_CHAIN_SEMANTIC.SV_DEMAND_INTELLIGENCE
-- Substitution points: {DATABASE}, {SEMANTIC_SCHEMA}, {MARTS_SCHEMA}

create or replace semantic view {DATABASE}.{SEMANTIC_SCHEMA}.SV_DEMAND_INTELLIGENCE
	tables (
		DEMAND_INTEL as {DATABASE}.{MARTS_SCHEMA}.FCT_DEMAND_INTELLIGENCE unique (RECORD_ID) comment='Supply chain demand intelligence records with forecast accuracy, stockout risk, and inventory health metrics. Data flows from PostgreSQL through Fivetran to Snowflake. Use to analyze demand forecasting performance, SKU-level stockout risk, and inventory health across product categories and locations.'
	)
	facts (
		DEMAND_INTEL.FORECAST_ACCURACY_MAPE as FORECAST_ACCURACY_MAPE comment='Mean Absolute Percentage Error for forecast accuracy. Lower values indicate better accuracy. Values below 10% are Excellent, 10-20% Good, 20-30% Fair, above 30% Poor.',
		DEMAND_INTEL.STOCKOUT_RISK_SCORE as STOCKOUT_RISK_SCORE comment='Predicted stockout risk score from 0 to 1. Scores above 0.7 indicate critical risk requiring immediate inventory replenishment action.',
		DEMAND_INTEL.DEMAND_SIGNAL_SCORE as DEMAND_SIGNAL_SCORE comment='Composite demand signal score from 0 to 100 combining POS transaction data, consumer confidence, and market trends. Higher scores indicate stronger near-term demand.',
		DEMAND_INTEL.INVENTORY_DAYS_SUPPLY as INVENTORY_DAYS_SUPPLY comment='Estimated number of days current inventory will last based on forecast demand. Under 7 days is Critical, 7-14 days Low, 14-30 days Adequate, over 30 days Surplus.',
		DEMAND_INTEL.BASELINE_DEMAND_FORECAST as BASELINE_DEMAND_FORECAST comment='Baseline statistical demand forecast in units before any adjustments.',
		DEMAND_INTEL.ADJUSTED_DEMAND_FORECAST as ADJUSTED_DEMAND_FORECAST comment='Final adjusted demand forecast incorporating sales rep overrides and promotional lift.',
		DEMAND_INTEL.ACTUAL_SALES_UNITS as ACTUAL_SALES_UNITS comment='Actual units sold — used to calculate forecast accuracy against the baseline and adjusted forecasts.',
		DEMAND_INTEL.CURRENT_INVENTORY_LEVEL as CURRENT_INVENTORY_LEVEL comment='Current on-hand inventory level in units at the time of the forecast record.',
		DEMAND_INTEL.SEASONAL_INDEX as SEASONAL_INDEX comment='Seasonal adjustment index. Values above 1.0 indicate above-average seasonal demand for the period.',
		DEMAND_INTEL.PROMOTION_DISCOUNT_PERCENT as PROMOTION_DISCOUNT_PERCENT comment='Discount percentage applied during promotional activity. Use to correlate promotions with demand lift.',
		DEMAND_INTEL.SALES_REP_ADJUSTMENT as SALES_REP_ADJUSTMENT comment='Manual forecast adjustment made by sales representatives. Positive values indicate upward override, negative values indicate downward override.',
		DEMAND_INTEL.COMPETITOR_PRICE_INDEX as COMPETITOR_PRICE_INDEX comment='Relative competitor pricing index. Values above 1.0 indicate competitors are priced higher, creating pricing advantage.',
		DEMAND_INTEL.CONSUMER_CONFIDENCE_INDEX as CONSUMER_CONFIDENCE_INDEX comment='Consumer confidence index at time of forecast. Higher values indicate stronger consumer sentiment and likely higher demand.',
		DEMAND_INTEL.MARKET_SHARE_PERCENT as MARKET_SHARE_PERCENT comment='Estimated market share percentage for this SKU in its category.',
		DEMAND_INTEL.POS_TRANSACTION_COUNT as POS_TRANSACTION_COUNT comment='Point-of-sale transaction count used as a real-time demand signal.'
	)
	dimensions (
		DEMAND_INTEL.RECORD_ID as RECORD_ID comment='Unique identifier for each demand forecast record.',
		DEMAND_INTEL.PRODUCT_SKU as PRODUCT_SKU comment='Product SKU identifier. Use to analyze individual product performance.',
		DEMAND_INTEL.PRODUCT_CATEGORY as PRODUCT_CATEGORY comment='Product category classification. Use to group and compare performance across categories.',
		DEMAND_INTEL.LOCATION_CODE as LOCATION_CODE comment='Distribution center or location code. Use to analyze regional demand and inventory patterns.',
		DEMAND_INTEL.FORECAST_DATE as FORECAST_DATE comment='Date of the demand forecast record.',
		DEMAND_INTEL.FORECAST_HORIZON_DAYS as FORECAST_HORIZON_DAYS comment='Number of days in the forecast horizon — typically 7, 14, 30, or 90 days.',
		DEMAND_INTEL.STOCKOUT_INDICATOR as STOCKOUT_INDICATOR comment='Binary flag indicating whether a stockout occurred for this SKU at this location.',
		DEMAND_INTEL.PROMOTIONAL_ACTIVITY_FLAG as PROMOTIONAL_ACTIVITY_FLAG comment='Indicates whether a promotional campaign is active for this SKU during the forecast period.',
		DEMAND_INTEL.ECONOMIC_INDICATOR_GDP as ECONOMIC_INDICATOR_GDP comment='GDP growth indicator relevant to macroeconomic demand context.',
		DEMAND_INTEL.CATEGORY_GROWTH_RATE as CATEGORY_GROWTH_RATE comment='Year-over-year growth rate for the product category. Use to contextualize individual SKU performance.',
		DEMAND_INTEL.INVENTORY_HEALTH as INVENTORY_HEALTH comment='Inventory health tier: Critical (under 7 days supply), Low (7-14 days), Adequate (14-30 days), Surplus (over 30 days).',
		DEMAND_INTEL.FORECAST_ACCURACY_TIER as FORECAST_ACCURACY_TIER comment='Forecast accuracy tier based on MAPE: Excellent (under 10%), Good (10-20%), Fair (20-30%), Poor (over 30%).',
		DEMAND_INTEL.NEEDS_REVIEW as NEEDS_REVIEW comment='Flag for records needing immediate attention — true when stockout risk is high or forecast accuracy is Poor or Fair.',
		DEMAND_INTEL.COMPETITIVE_POSITION as COMPETITIVE_POSITION comment='Competitive position classification based on market share and competitor pricing: Strong, Moderate, or Weak.'
	)
	comment='Demand intelligence semantic view for Cortex Analyst. Contains SKU-level demand forecasting records with stockout risk scores, inventory health metrics, and demand signal analysis across product categories and locations.';
