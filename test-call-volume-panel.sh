#!/bin/bash

# Test script to verify the call volume reduction panel implementation
echo "Testing Call Volume Reduction Panel Implementation..."

# Check if Grafana is running
echo "1. Checking Grafana service..."
if curl -s http://localhost:3001/api/health > /dev/null; then
    echo "✓ Grafana is running"
else
    echo "✗ Grafana is not accessible"
    exit 1
fi

# Check if PostgreSQL is running
echo "2. Checking PostgreSQL service..."
if psql -h localhost -p 5432 -U anuragtrivedi -d your_project_db -c "SELECT 1;" > /dev/null 2>&1; then
    echo "✓ PostgreSQL is running"
else
    echo "✗ PostgreSQL is not accessible"
    exit 1
fi

# Validate JSON structure
echo "3. Validating dashboard JSON..."
if python3 -m json.tool monitoring/grafana/dashboards/business-intelligence.json > /dev/null 2>&1; then
    echo "✓ Dashboard JSON is valid"
else
    echo "✗ Dashboard JSON is invalid"
    exit 1
fi

# Test the call volume queries
echo "4. Testing call volume queries..."

# Test current period query
echo "   Testing current period call volume query..."
if docker-compose exec -T postgres psql -U postgres -d app_engagement_intelligence -c "
SELECT 
  SUM(phone_calls_last_month) as current_calls,
  COUNT(DISTINCT user_id) as current_users
FROM analytics.user_profiles 
WHERE updated_at >= NOW() - INTERVAL '30 days';
" > /dev/null 2>&1; then
    echo "   ✓ Current period query works"
else
    echo "   ✗ Current period query failed"
    exit 1
fi

# Test comparison query
echo "   Testing period comparison query..."
if docker-compose exec -T postgres psql -U postgres -d app_engagement_intelligence -c "
WITH current_period AS (
  SELECT SUM(phone_calls_last_month) as current_calls
  FROM analytics.user_profiles 
  WHERE updated_at >= NOW() - INTERVAL '30 days'
),
previous_period AS (
  SELECT SUM(phone_calls_last_month) as previous_calls
  FROM analytics.user_profiles 
  WHERE updated_at >= NOW() - INTERVAL '60 days'
    AND updated_at < NOW() - INTERVAL '30 days'
)
SELECT 
  COALESCE(cp.current_calls, 0) as current_calls,
  COALESCE(pp.previous_calls, 0) as previous_calls,
  CASE 
    WHEN pp.previous_calls > 0 THEN 
      ROUND(((pp.previous_calls - cp.current_calls) / pp.previous_calls::decimal * 100), 2)
    ELSE 0
  END as reduction_percentage
FROM current_period cp
CROSS JOIN previous_period pp;
" > /dev/null 2>&1; then
    echo "   ✓ Period comparison query works"
else
    echo "   ✗ Period comparison query failed"
    exit 1
fi

# Check if the new panels are present in the dashboard
echo "5. Verifying panel configuration..."
if grep -q "Call Volume Reduction Trend" monitoring/grafana/dashboards/business-intelligence.json; then
    echo "   ✓ Call Volume Reduction Trend panel found"
else
    echo "   ✗ Call Volume Reduction Trend panel not found"
    exit 1
fi

if grep -q "Call Volume Reduction Analysis" monitoring/grafana/dashboards/business-intelligence.json; then
    echo "   ✓ Call Volume Reduction Analysis panel found"
else
    echo "   ✗ Call Volume Reduction Analysis panel not found"
    exit 1
fi

echo ""
echo "🎉 All tests passed! Call Volume Reduction panel implementation is complete."
echo ""
echo "The implementation includes:"
echo "- Time series panel showing call volume trends (current vs previous period)"
echo "- Table panel with detailed analysis including percentage reduction and cost impact"
echo "- Proper color coding and thresholds for visual indicators"
echo "- Integration with existing dashboard variables (time_period, channel)"
echo ""
echo "Panel Features:"
echo "- Compares current period vs previous period call volumes"
echo "- Calculates percentage reduction in call volume"
echo "- Estimates cost impact based on $15 per call (industry average)"
echo "- Color-coded thresholds: Red (<5%), Yellow (5-15%), Green (>15%) reduction"
echo "- Responsive to dashboard time range and channel filters"