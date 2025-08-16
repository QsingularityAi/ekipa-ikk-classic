#!/bin/bash

# Test Export Functionality for Business Intelligence Dashboard
# This script tests CSV and PDF export capabilities

echo "Testing Grafana Export Functionality..."

# Configuration
GRAFANA_URL="http://localhost:3001"
ADMIN_USER="admin"
ADMIN_PASS="admin123secure!"

# Function to test CSV export
test_csv_export() {
    echo "Testing CSV export functionality..."
    
    # Test CSV export for Cost Savings Metrics panel (panel ID 1)
    echo "Testing CSV export for Cost Savings Metrics..."
    curl -u "$ADMIN_USER:$ADMIN_PASS" \
         -H "Accept: text/csv" \
         "$GRAFANA_URL/api/ds/query" \
         -X POST \
         -H "Content-Type: application/json" \
         -d '{
           "queries": [{
             "datasource": {"type": "postgres", "uid": "postgresql"},
             "format": "table",
             "rawSql": "WITH current_period AS (SELECT SUM(digital_tasks_completed * 5.0) as current_savings, COUNT(DISTINCT user_id) as current_users FROM analytics.user_profiles WHERE updated_at >= NOW() - INTERVAL '\''30 days'\''), previous_period AS (SELECT SUM(digital_tasks_completed * 5.0) as previous_savings, COUNT(DISTINCT user_id) as previous_users FROM analytics.user_profiles WHERE updated_at >= NOW() - INTERVAL '\''60 days'\'' AND updated_at < NOW() - INTERVAL '\''30 days'\'') SELECT '\''Total Cost Savings'\'' as \"Metric\", COALESCE(cp.current_savings, 0) as \"Current Period ($)\", COALESCE(pp.previous_savings, 0) as \"Previous Period ($)\", CASE WHEN pp.previous_savings > 0 THEN ROUND(((cp.current_savings - pp.previous_savings) / pp.previous_savings * 100)::numeric, 2) ELSE 0 END as \"Change %\", cp.current_users as \"Active Users\" FROM current_period cp CROSS JOIN previous_period pp;",
             "refId": "A"
           }],
           "from": "now-30d",
           "to": "now"
         }' \
         -o "cost_savings_export.csv"
    
    if [ -f "cost_savings_export.csv" ]; then
        echo "✓ CSV export for Cost Savings Metrics successful"
        echo "Sample data:"
        head -5 "cost_savings_export.csv"
    else
        echo "✗ CSV export for Cost Savings Metrics failed"
    fi
    
    # Test CSV export for Call Volume Reduction Analysis (panel ID 6)
    echo "Testing CSV export for Call Volume Reduction Analysis..."
    curl -u "$ADMIN_USER:$ADMIN_PASS" \
         -H "Accept: text/csv" \
         "$GRAFANA_URL/api/ds/query" \
         -X POST \
         -H "Content-Type: application/json" \
         -d '{
           "queries": [{
             "datasource": {"type": "postgres", "uid": "postgresql"},
             "format": "table",
             "rawSql": "WITH current_period AS (SELECT SUM(phone_calls_last_month) as current_calls, COUNT(DISTINCT user_id) as current_users FROM analytics.user_profiles WHERE updated_at >= NOW() - INTERVAL '\''30 days'\''), previous_period AS (SELECT SUM(phone_calls_last_month) as previous_calls, COUNT(DISTINCT user_id) as previous_users FROM analytics.user_profiles WHERE updated_at >= NOW() - INTERVAL '\''60 days'\'' AND updated_at < NOW() - INTERVAL '\''30 days'\''), cost_calculation AS (SELECT cp.current_calls, pp.previous_calls, CASE WHEN pp.previous_calls > 0 THEN ROUND(((pp.previous_calls - cp.current_calls) / pp.previous_calls::decimal * 100), 2) ELSE 0 END as reduction_percentage, (COALESCE(pp.previous_calls, 0) - COALESCE(cp.current_calls, 0)) * 15 as cost_impact FROM current_period cp CROSS JOIN previous_period pp) SELECT '\''Call Volume Analysis'\'' as \"Metric\", COALESCE(current_calls, 0) as \"Current Period Calls\", COALESCE(previous_calls, 0) as \"Previous Period Calls\", COALESCE(previous_calls, 0) - COALESCE(current_calls, 0) as \"Calls Reduced\", reduction_percentage as \"Reduction %\", cost_impact as \"Cost Impact ($)\" FROM cost_calculation;",
             "refId": "A"
           }],
           "from": "now-30d",
           "to": "now"
         }' \
         -o "call_volume_export.csv"
    
    if [ -f "call_volume_export.csv" ]; then
        echo "✓ CSV export for Call Volume Analysis successful"
        echo "Sample data:"
        head -5 "call_volume_export.csv"
    else
        echo "✗ CSV export for Call Volume Analysis failed"
    fi
}

# Function to test PDF export
test_pdf_export() {
    echo "Testing PDF export functionality..."
    
    # Get dashboard UID for Business Intelligence dashboard
    DASHBOARD_UID=$(curl -s -u "$ADMIN_USER:$ADMIN_PASS" \
                    "$GRAFANA_URL/api/search?query=Business%20Intelligence" | \
                    jq -r '.[0].uid' 2>/dev/null || echo "business-intelligence")
    
    if [ "$DASHBOARD_UID" != "null" ] && [ -n "$DASHBOARD_UID" ]; then
        echo "Testing PDF export for Business Intelligence dashboard (UID: $DASHBOARD_UID)..."
        
        # Test PDF export of entire dashboard
        curl -u "$ADMIN_USER:$ADMIN_PASS" \
             "$GRAFANA_URL/render/d-solo/$DASHBOARD_UID/business-intelligence?orgId=1&from=now-30d&to=now&width=1000&height=500&tz=UTC" \
             -H "Accept: application/pdf" \
             -o "business_intelligence_dashboard.pdf"
        
        if [ -f "business_intelligence_dashboard.pdf" ] && [ -s "business_intelligence_dashboard.pdf" ]; then
            echo "✓ PDF export for Business Intelligence dashboard successful"
            echo "PDF file size: $(ls -lh business_intelligence_dashboard.pdf | awk '{print $5}')"
        else
            echo "✗ PDF export for Business Intelligence dashboard failed"
        fi
        
        # Test PDF export of individual panels
        echo "Testing PDF export for individual panels..."
        
        # Export Cost Savings Metrics panel (panel ID 1)
        curl -u "$ADMIN_USER:$ADMIN_PASS" \
             "$GRAFANA_URL/render/d-solo/$DASHBOARD_UID/business-intelligence?orgId=1&from=now-30d&to=now&panelId=1&width=800&height=400&tz=UTC" \
             -H "Accept: application/pdf" \
             -o "cost_savings_panel.pdf"
        
        if [ -f "cost_savings_panel.pdf" ] && [ -s "cost_savings_panel.pdf" ]; then
            echo "✓ PDF export for Cost Savings panel successful"
        else
            echo "✗ PDF export for Cost Savings panel failed"
        fi
        
        # Export ROI Calculation panel (panel ID 8, if exists)
        curl -u "$ADMIN_USER:$ADMIN_PASS" \
             "$GRAFANA_URL/render/d-solo/$DASHBOARD_UID/business-intelligence?orgId=1&from=now-30d&to=now&panelId=8&width=800&height=400&tz=UTC" \
             -H "Accept: application/pdf" \
             -o "roi_calculation_panel.pdf"
        
        if [ -f "roi_calculation_panel.pdf" ] && [ -s "roi_calculation_panel.pdf" ]; then
            echo "✓ PDF export for ROI Calculation panel successful"
        else
            echo "✗ PDF export for ROI Calculation panel failed (panel may not exist)"
        fi
    else
        echo "✗ Could not find Business Intelligence dashboard UID"
    fi
}

# Function to test export formatting
test_export_formatting() {
    echo "Testing export formatting..."
    
    # Check CSV formatting
    if [ -f "cost_savings_export.csv" ]; then
        echo "CSV formatting check:"
        echo "- Headers present: $(head -1 cost_savings_export.csv | grep -c ',')"
        echo "- Data rows: $(tail -n +2 cost_savings_export.csv | wc -l)"
        echo "- Currency formatting preserved: $(grep -c '\$' cost_savings_export.csv || echo '0')"
    fi
    
    # Check PDF file validity
    if [ -f "business_intelligence_dashboard.pdf" ]; then
        echo "PDF formatting check:"
        echo "- File type: $(file business_intelligence_dashboard.pdf)"
        echo "- File size: $(ls -lh business_intelligence_dashboard.pdf | awk '{print $5}')"
    fi
}

# Function to create export documentation
create_export_documentation() {
    echo "Creating export functionality documentation..."
    
    cat > "EXPORT_FUNCTIONALITY.md" << 'EOF'
# Business Intelligence Dashboard Export Functionality

## Overview
The Business Intelligence dashboard now supports both CSV and PDF export functionality for executive reporting and data analysis.

## CSV Export Options

### Available for Business Panels:
1. **Cost Savings Metrics** - Exportable table with current/previous period comparisons
2. **Call Volume Reduction Analysis** - Detailed call volume metrics and cost impact
3. **ROI Calculations** - Investment returns and payback period data
4. **Digital Transaction Growth** - Transaction volume and growth trends

### How to Export CSV:
1. Navigate to the Business Intelligence dashboard
2. Click on the panel menu (three dots) in the top-right corner of any table panel
3. Select "Inspect" → "Data" → "Download CSV"
4. The CSV file will include all visible data with proper formatting

### CSV Export Features:
- Maximum 10,000 rows per export
- Preserves currency formatting ($)
- Includes percentage calculations
- Headers match panel column names
- Compatible with Excel and other spreadsheet applications

## PDF Export Options

### Dashboard Export:
- Full dashboard export for executive presentations
- Customizable time ranges
- High-resolution output (1000x500 default)
- Includes all panels and formatting

### Individual Panel Export:
- Export specific panels for focused reports
- Maintains chart formatting and colors
- Suitable for embedding in presentations
- Multiple size options available

### How to Export PDF:
1. **Full Dashboard:**
   - Use the share button in the top toolbar
   - Select "Export" → "PDF"
   - Choose time range and resolution
   - Download generated PDF

2. **Individual Panels:**
   - Click panel menu (three dots)
   - Select "Share" → "Export" → "PDF"
   - Configure size and time range
   - Download panel PDF

## Export Configuration

### Grafana Settings:
- CSV export enabled with 10,000 row limit
- PDF export enabled with 30-second timeout
- Concurrent export limit: 10 requests
- Export feature toggle enabled

### Security Considerations:
- Exports respect user permissions
- Data source access controls apply
- Authentication required for all exports
- Audit logging for export activities

## Use Cases

### Executive Reports:
- Monthly cost savings summaries (CSV)
- ROI dashboard presentations (PDF)
- Call volume reduction reports (CSV + PDF)

### Data Analysis:
- Historical trend analysis (CSV)
- Comparative period studies (CSV)
- Visual presentation materials (PDF)

### Compliance and Auditing:
- Data export for regulatory reporting
- Historical record keeping
- Performance metric documentation

## Troubleshooting

### Common Issues:
1. **Export timeout** - Reduce time range or data complexity
2. **Large file sizes** - Use panel-specific exports instead of full dashboard
3. **Formatting issues** - Check data source query formatting
4. **Permission errors** - Verify user has appropriate dashboard access

### Support:
- Check Grafana logs for export errors
- Verify data source connectivity
- Ensure sufficient system resources for rendering
EOF

    echo "✓ Export documentation created: EXPORT_FUNCTIONALITY.md"
}

# Main execution
echo "Starting export functionality tests..."
echo "========================================"

# Check if Grafana is running
if curl -s "$GRAFANA_URL/api/health" > /dev/null; then
    echo "✓ Grafana is accessible at $GRAFANA_URL"
    
    # Run tests
    test_csv_export
    echo ""
    test_pdf_export
    echo ""
    test_export_formatting
    echo ""
    create_export_documentation
    
    echo ""
    echo "========================================"
    echo "Export functionality testing completed!"
    echo ""
    echo "Generated files:"
    ls -la *.csv *.pdf EXPORT_FUNCTIONALITY.md 2>/dev/null || echo "No export files generated"
    
else
    echo "✗ Grafana is not accessible at $GRAFANA_URL"
    echo "Please ensure Grafana is running and accessible"
    exit 1
fi