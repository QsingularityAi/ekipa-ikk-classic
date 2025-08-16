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
