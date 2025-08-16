#!/bin/bash

# Test script for Digital Transaction Growth Panel
# This script tests the PostgreSQL queries used in the digital transaction growth panel

echo "Testing Digital Transaction Growth Panel Queries..."
echo "=================================================="

# Database connection parameters
DB_HOST="localhost"
DB_PORT="5432"
DB_NAME="your_project_db"
DB_USER="anuragtrivedi"

# Test if database is accessible
echo "1. Testing database connection..."
if psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "SELECT 1;" > /dev/null 2>&1; then
    echo "✓ Database connection successful"
else
    echo "✗ Database connection failed"
    echo "Make sure PostgreSQL is running and the database exists"
    exit 1
fi

echo ""
echo "2. Testing digital transaction volume query..."
TRANSACTION_QUERY="
SELECT 
  DATE_TRUNC('day', ue.timestamp) as time,
  COUNT(*) as digital_transactions
FROM analytics.user_events ue
WHERE ue.timestamp >= NOW() - INTERVAL '30 days' AND ue.timestamp < NOW()
  AND ue.event_type = 'task_completion'
  AND ue.success = true
GROUP BY time
ORDER BY time
LIMIT 5;
"

if psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "$TRANSACTION_QUERY" > /dev/null 2>&1; then
    echo "✓ Digital transaction volume query executed successfully"
    echo "Sample results:"
    psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "$TRANSACTION_QUERY"
else
    echo "✗ Digital transaction volume query failed"
fi

echo ""
echo "3. Testing growth trend query (7-day moving average)..."
GROWTH_TREND_QUERY="
WITH daily_transactions AS (
  SELECT 
    DATE_TRUNC('day', ue.timestamp) as day,
    COUNT(*) as transaction_count
  FROM analytics.user_events ue
  WHERE ue.timestamp >= NOW() - INTERVAL '37 days' AND ue.timestamp < NOW()
    AND ue.event_type = 'task_completion'
    AND ue.success = true
  GROUP BY day
),
moving_average AS (
  SELECT 
    day as time,
    AVG(transaction_count) OVER (
      ORDER BY day 
      ROWS BETWEEN 6 PRECEDING AND CURRENT ROW
    ) as growth_trend
  FROM daily_transactions
  WHERE day >= NOW() - INTERVAL '30 days'
)
SELECT time, ROUND(growth_trend::numeric, 2) as growth_trend 
FROM moving_average 
ORDER BY time
LIMIT 5;
"

if psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "$GROWTH_TREND_QUERY" > /dev/null 2>&1; then
    echo "✓ Growth trend query executed successfully"
    echo "Sample results:"
    psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "$GROWTH_TREND_QUERY"
else
    echo "✗ Growth trend query failed"
fi

echo ""
echo "4. Testing target calculation query..."
TARGET_QUERY="
WITH historical_growth AS (
  SELECT 
    AVG(daily_count) * 1.15 as target_value
  FROM (
    SELECT 
      DATE_TRUNC('day', ue.timestamp) as day,
      COUNT(*) as daily_count
    FROM analytics.user_events ue
    WHERE ue.timestamp >= NOW() - INTERVAL '60 days' AND ue.timestamp < NOW() - INTERVAL '30 days'
      AND ue.event_type = 'task_completion'
      AND ue.success = true
    GROUP BY day
  ) historical
)
SELECT ROUND(target_value::numeric, 2) as target_value
FROM historical_growth;
"

if psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "$TARGET_QUERY" > /dev/null 2>&1; then
    echo "✓ Target calculation query executed successfully"
    echo "Sample results:"
    psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "$TARGET_QUERY"
else
    echo "✗ Target calculation query failed"
fi

echo ""
echo "5. Testing growth analysis table query..."
ANALYSIS_QUERY="
WITH current_period AS (
  SELECT 
    COUNT(*) as current_transactions,
    COUNT(DISTINCT ue.user_id) as current_active_users
  FROM analytics.user_events ue
  WHERE ue.timestamp >= NOW() - INTERVAL '30 days'
    AND ue.event_type = 'task_completion'
    AND ue.success = true
),
previous_period AS (
  SELECT 
    COUNT(*) as previous_transactions,
    COUNT(DISTINCT ue.user_id) as previous_active_users
  FROM analytics.user_events ue
  WHERE ue.timestamp >= NOW() - INTERVAL '60 days'
    AND ue.timestamp < NOW() - INTERVAL '30 days'
    AND ue.event_type = 'task_completion'
    AND ue.success = true
),
total_users AS (
  SELECT COUNT(DISTINCT user_id) as total_user_count
  FROM analytics.user_profiles
  WHERE updated_at >= NOW() - INTERVAL '30 days'
),
growth_calculation AS (
  SELECT 
    cp.current_transactions,
    pp.previous_transactions,
    cp.current_active_users,
    tu.total_user_count,
    CASE 
      WHEN pp.previous_transactions > 0 THEN 
        ROUND(((cp.current_transactions - pp.previous_transactions) / pp.previous_transactions::decimal * 100), 2)
      ELSE 0
    END as growth_rate,
    ROUND((cp.current_active_users / tu.total_user_count::decimal * 100), 2) as adoption_rate
  FROM current_period cp
  CROSS JOIN previous_period pp
  CROSS JOIN total_users tu
)
SELECT 
  'Digital Transaction Analysis' as metric,
  current_transactions,
  previous_transactions,
  current_transactions - previous_transactions as net_growth,
  growth_rate as growth_rate_percent,
  current_active_users,
  adoption_rate as adoption_curve_percent
FROM growth_calculation;
"

if psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "$ANALYSIS_QUERY" > /dev/null 2>&1; then
    echo "✓ Growth analysis query executed successfully"
    echo "Sample results:"
    psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "$ANALYSIS_QUERY"
else
    echo "✗ Growth analysis query failed"
fi

echo ""
echo "6. Checking for sample data availability..."
SAMPLE_DATA_QUERY="
SELECT 
  COUNT(*) as total_events,
  COUNT(CASE WHEN event_type = 'task_completion' THEN 1 END) as task_completions,
  COUNT(CASE WHEN event_type = 'task_completion' AND success = true THEN 1 END) as successful_completions
FROM analytics.user_events
WHERE timestamp >= NOW() - INTERVAL '30 days';
"

echo "Data availability check:"
psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "$SAMPLE_DATA_QUERY"

echo ""
echo "Digital Transaction Growth Panel Test Complete!"
echo "=============================================="
echo ""
echo "Panel Features Implemented:"
echo "• Time series chart showing daily digital transaction volume"
echo "• 7-day moving average growth trend line"
echo "• Target indicator based on 15% growth from historical average"
echo "• Growth analysis table with period comparisons"
echo "• Adoption curve showing percentage of users completing digital transactions"
echo ""
echo "The panel supports:"
echo "• Time range filtering via Grafana time picker"
echo "• Channel filtering via dashboard variable"
echo "• Growth forecasting with target indicators"
echo "• Comprehensive adoption metrics"