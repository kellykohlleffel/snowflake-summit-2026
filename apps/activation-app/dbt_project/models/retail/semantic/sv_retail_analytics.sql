{{ config(materialized='semantic_view') }}

TABLES (
  RETAIL_ANALYTICS AS {{ ref('fct_retail_analytics') }}
    UNIQUE (RECORD_ID)
    COMMENT='Customer order records with pricing optimization, inventory health, and lifetime value metrics. Data flows from Google Cloud PostgreSQL through Fivetran to Snowflake. Use to analyze customer re-engagement opportunities, pricing strategy, and inventory management across product categories.'
)
FACTS (
  RETAIL_ANALYTICS.ORDER_TOTAL AS ORDER_TOTAL COMMENT='Total value of the customer order in dollars. Use to analyze revenue patterns and average order sizes across segments.',
  RETAIL_ANALYTICS.PRODUCT_PRICE AS PRODUCT_PRICE COMMENT='Listed price of the product. Compare with order_total and average_order_value to understand pricing dynamics.',
  RETAIL_ANALYTICS.CUSTOMER_LIFETIME_VALUE AS CUSTOMER_LIFETIME_VALUE COMMENT='Total predicted revenue from a customer over their lifetime. Values above $7000 indicate high-value customers worth prioritizing for retention.',
  RETAIL_ANALYTICS.INVENTORY_TURNOVER AS INVENTORY_TURNOVER COMMENT='Rate at which inventory is sold and replaced. Higher values indicate efficient inventory management. Low turnover may signal overstock.',
  RETAIL_ANALYTICS.STOCKOUT_RATE AS STOCKOUT_RATE COMMENT='Percentage of time a product is out of stock. Rates above 5% indicate supply chain issues that risk lost sales.',
  RETAIL_ANALYTICS.OVERSTOCK_RATE AS OVERSTOCK_RATE COMMENT='Percentage of excess inventory beyond demand. Rates above 5% indicate overordering that ties up capital.',
  RETAIL_ANALYTICS.PRICE_ELASTICITY AS PRICE_ELASTICITY COMMENT='Sensitivity of demand to price changes. Values above 0.5 suggest customers are price-sensitive — good candidates for price optimization.',
  RETAIL_ANALYTICS.CUSTOMER_SATISFACTION_RATE AS CUSTOMER_SATISFACTION_RATE COMMENT='Customer satisfaction score from 0 to 1. Values below 0.5 indicate dissatisfied customers at risk of churn.',
  RETAIL_ANALYTICS.CUSTOMER_VALUE_SCORE AS CUSTOMER_VALUE_SCORE COMMENT='Composite score from 0 to 1 combining lifetime value (40%), order frequency (30%), and satisfaction (30%). Use to prioritize customer engagement efforts.',
  RETAIL_ANALYTICS.REVENUE_GROWTH_RATE AS REVENUE_GROWTH_RATE COMMENT='Rate of revenue change for the product or customer. Negative values indicate declining performance.'
)
DIMENSIONS (
  RETAIL_ANALYTICS.CUSTOMER_SEGMENT AS CUSTOMER_SEGMENT COMMENT='Customer value tier: High-Value, Medium-Value, or Low-Value. Based on purchase history and engagement.',
  RETAIL_ANALYTICS.ORDER_STATUS AS ORDER_STATUS COMMENT='Current order status: Shipped, Cancelled, Processing, Delivered, or Returned.',
  RETAIL_ANALYTICS.PRODUCT_CATEGORY AS PRODUCT_CATEGORY COMMENT='Top-level product category: Beauty, Apparel, Electronics, Home, Sports, etc.',
  RETAIL_ANALYTICS.PRODUCT_SUBCATEGORY AS PRODUCT_SUBCATEGORY COMMENT='Specific product type within category: Laptops, Shoes, Tops, Accessories, etc.',
  RETAIL_ANALYTICS.CLV_SEGMENT AS CLV_SEGMENT COMMENT='Customer lifetime value bucket: Low (under $3K), Medium ($3K-$7K), or High (over $7K). Use to segment retention strategies.',
  RETAIL_ANALYTICS.INVENTORY_HEALTH AS INVENTORY_HEALTH COMMENT='Inventory status: Healthy, Stockout Risk (stockout rate above 5%), or Overstock Risk (overstock rate above 5%).',
  RETAIL_ANALYTICS.PRICE_OPTIMIZATION_RESULT AS PRICE_OPTIMIZATION_RESULT COMMENT='Outcome of last price optimization: Success or Failure.',
  RETAIL_ANALYTICS.PRICE_OPTIMIZATION_RECOMMENDATION AS PRICE_OPTIMIZATION_RECOMMENDATION COMMENT='Recommended pricing action: Increase Price, Decrease Price, or Maintain Price.',
  RETAIL_ANALYTICS.PRICE_ACTION_NEEDED AS PRICE_ACTION_NEEDED COMMENT='Boolean flag: true when product has not been optimized but has high price elasticity (above 0.5). Identifies quick wins for pricing.',
  RETAIL_ANALYTICS.ORDER_DATE AS ORDER_DATE COMMENT='Date the order was placed. Use for trend analysis and seasonal patterns.',
  RETAIL_ANALYTICS.CUSTOMER_ID AS CUSTOMER_ID COMMENT='Unique customer identifier. Use to identify specific customers in queries about individual customers or lists of at-risk customers.'
)
COMMENT='Retail analytics semantic view for Cortex Analyst. Contains customer order data with pricing optimization, inventory health, and lifetime value metrics across product categories and customer segments.'
