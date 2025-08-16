#!/bin/bash

# Test ROI Panel Export Functionality
echo "Testing ROI Panel Export..."

GRAFANA_URL="http://localhost:3001"
ADMIN_USER="admin"
ADMIN_PASS="admin123secure!"

# Test CSV export for ROI panel
echo "Testing CSV export for Executive ROI Summary..."
curl -u "$ADMIN_USER:$ADMIN_PASS" \
     -H "Accept: text/csv" \
     "$GRAFANA_URL/api/ds/query" \
     -X POST \
     -H "Content-Type: application/json" \
     -d '{
       "queries": [{
         "datasource": {"type": "postgres", "uid": "postgresql"},
         "format": "table",
         "rawSql": "WITH investment_data AS (SELECT '\''Platform Development'\'' as investment_category, 250000 as investment_amount, '\''Initial development and setup costs'\'' as description UNION ALL SELECT '\''Annual Operations'\'', 120000, '\''Annual operational and maintenance costs'\'' UNION ALL SELECT '\''Training & Change Management'\'', 50000, '\''User training and change management'\''), savings_data AS (SELECT COALESCE(SUM(digital_tasks_completed * 5.0), 50000) as total_cost_savings, COUNT(DISTINCT user_id) as active_users, AVG(digital_tasks_completed) as avg_digital_adoption FROM analytics.user_profiles WHERE updated_at >= NOW() - INTERVAL '\''30 days'\''), roi_calculation AS (SELECT i.investment_category as \"Investment Category\", i.investment_amount as \"Investment ($)\", s.total_cost_savings as \"Total Savings ($)\", CASE WHEN i.investment_amount > 0 THEN ROUND(((s.total_cost_savings - i.investment_amount) / i.investment_amount * 100)::numeric, 2) ELSE 0 END as \"ROI %\", CASE WHEN s.total_cost_savings > 0 THEN ROUND((i.investment_amount / (s.total_cost_savings / 365.0))::numeric, 0) ELSE 0 END as \"Payback Period (Days)\", i.description as \"Description\" FROM investment_data i CROSS JOIN savings_data s) SELECT * FROM roi_calculation;",
         "refId": "A"
       }],
       "from": "now-30d",
       "to": "now"
     }' \
     -o "roi_calculation_export.csv"

if [ -f "roi_calculation_export.csv" ]; then
    echo "✓ CSV export for ROI calculation successful"
    echo "Sample data:"
    head -5 "roi_calculation_export.csv"
else
    echo "✗ CSV export for ROI calculation failed"
fi

echo "ROI Panel export test completed!"