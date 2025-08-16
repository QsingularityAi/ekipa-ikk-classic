# Grafana Alerting Setup Documentation

## Overview

This document describes the alerting and notification setup for the Grafana dashboard system. The configuration includes alert rules for system and business metrics, along with multiple notification channels.

## Alert Rules Configuration

### System Metrics Alerts

Located in `monitoring/grafana/provisioning/alerting/alerts.yml`

1. **High Error Rate Alert**
   - Threshold: >5% error rate
   - Query: `rate(http_requests_total{status=~"5.."}[5m]) / rate(http_requests_total[5m]) * 100`
   - Severity: Critical
   - Team: DevOps

2. **Slow API Response Time Alert**
   - Threshold: >2 seconds (95th percentile)
   - Query: `histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))`
   - Severity: Warning
   - Team: DevOps

3. **High CPU Usage Alert**
   - Threshold: >90% CPU usage
   - Query: `rate(process_cpu_seconds_total[5m]) * 100`
   - Severity: Critical
   - Team: DevOps

4. **High Memory Usage Alert**
   - Threshold: >85% memory usage
   - Query: `(process_resident_memory_bytes / (1024 * 1024 * 1024)) / (node_memory_MemTotal_bytes / (1024 * 1024 * 1024)) * 100`
   - Severity: Warning
   - Team: DevOps

### Business Metrics Alerts

1. **Low User Engagement Alert**
   - Threshold: 20% drop in user engagement
   - Data Source: PostgreSQL
   - Severity: Warning
   - Team: Product

2. **Database Connection Failure Alert**
   - Threshold: Database unavailable
   - Query: `up{job="postgresql"}`
   - Severity: Critical
   - Team: DevOps

3. **Data Pipeline Issues Alert**
   - Threshold: <10 events in 30 minutes
   - Data Source: PostgreSQL
   - Severity: Warning
   - Team: Data

## Notification Channels

### Contact Points

Located in `monitoring/grafana/provisioning/alerting/contactpoints.yml`

1. **Email Critical** (`email-critical`)
   - Recipients: devops-alerts@company.com, admin@company.com
   - For critical alerts only
   - Includes detailed alert information

2. **Email Warning** (`email-warning`)
   - Recipients: team-alerts@company.com
   - For warning-level alerts
   - Standard alert format

3. **Webhook Integration** (`webhook-integration`)
   - URL: http://localhost:3000/api/webhooks/alerts
   - JSON payload format
   - For integration with external systems

4. **Slack DevOps** (`slack-devops`)
   - Channel: #devops-alerts
   - Color-coded messages based on severity
   - Requires SLACK_WEBHOOK_URL environment variable

### Notification Policies

Located in `monitoring/grafana/provisioning/alerting/notification-policies.yml`

- **Critical Alerts**: Email + Slack + Webhook (immediate notification)
- **Warning Alerts**: Email + Slack for DevOps team
- **Team-specific routing**: Different teams get different notification timing
- **Inhibition rules**: Prevent alert spam when multiple related alerts fire

## Configuration Steps

### 1. Email Notifications Setup

To enable email notifications, update `monitoring/grafana/grafana.ini`:

```ini
[smtp]
enabled = true
host = smtp.gmail.com:587
user = your-email@gmail.com
password = your-app-password
from_address = grafana@yourcompany.com
from_name = Grafana Alerts
```

### 2. Slack Notifications Setup

1. Create a Slack webhook URL in your Slack workspace
2. Set the environment variable:
   ```bash
   export SLACK_WEBHOOK_URL="https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK"
   ```
3. Restart Grafana service

### 3. Webhook Integration Setup

Ensure your application has an endpoint at `/api/webhooks/alerts` that can receive POST requests with the following JSON structure:

```json
{
  "alert": "Alert Name",
  "status": "firing|resolved",
  "severity": "critical|warning",
  "team": "devops|product|data",
  "summary": "Alert summary",
  "description": "Detailed description",
  "timestamp": "2024-01-01T00:00:00Z",
  "dashboard_url": "http://localhost:3001"
}
```

## Testing Notifications

Run the test script to verify your notification setup:

```bash
./monitoring/grafana/test-notifications.sh
```

This script will:
- Test webhook endpoint accessibility
- Check email configuration
- Verify Slack webhook (if configured)
- Validate configuration files
- Confirm Grafana service status

## Manual Alert Testing

To test alerts manually:

1. **High CPU Alert**: Run a CPU-intensive process
2. **High Memory Alert**: Consume system memory
3. **Database Alert**: Stop PostgreSQL service temporarily
4. **Error Rate Alert**: Generate HTTP 5xx errors in your application
5. **User Engagement Alert**: Simulate low user activity in the database

## Monitoring Alerts

Access the Grafana alerting interface at:
- **Alert Rules**: http://localhost:3001/alerting/list
- **Contact Points**: http://localhost:3001/alerting/notifications
- **Notification Policies**: http://localhost:3001/alerting/routes
- **Alert History**: http://localhost:3001/alerting/history

## Troubleshooting

### Common Issues

1. **Alerts not firing**
   - Check data source connectivity
   - Verify query syntax in Grafana query editor
   - Ensure metrics are being collected

2. **Email notifications not working**
   - Verify SMTP configuration in grafana.ini
   - Check firewall settings for SMTP port
   - Test SMTP credentials

3. **Slack notifications not working**
   - Verify SLACK_WEBHOOK_URL environment variable
   - Test webhook URL manually with curl
   - Check Slack app permissions

4. **Webhook notifications not working**
   - Ensure webhook endpoint is accessible
   - Check application logs for webhook processing
   - Verify JSON payload format

### Log Files

Check Grafana logs for alerting issues:
- Docker: `docker logs grafana`
- System: `/var/log/grafana/grafana.log`

## Security Considerations

1. **Email Credentials**: Store SMTP credentials securely
2. **Webhook URLs**: Use HTTPS in production
3. **Slack Tokens**: Rotate webhook URLs regularly
4. **Access Control**: Limit who can modify alert rules
5. **Network Security**: Restrict notification endpoint access

## Maintenance

### Regular Tasks

1. **Review Alert Rules**: Monthly review of thresholds and conditions
2. **Test Notifications**: Quarterly testing of all notification channels
3. **Update Contact Lists**: Keep email and Slack channels current
4. **Monitor Alert Volume**: Adjust thresholds to prevent alert fatigue
5. **Backup Configuration**: Version control alert configurations

### Performance Optimization

1. **Query Optimization**: Ensure alert queries are efficient
2. **Evaluation Frequency**: Balance between responsiveness and resource usage
3. **Retention Policies**: Configure alert history retention
4. **Resource Monitoring**: Monitor Grafana resource usage during alert evaluation

## Integration with External Systems

The webhook integration allows for:
- **Incident Management**: Integration with PagerDuty, Opsgenie
- **Ticketing Systems**: Automatic ticket creation in Jira, ServiceNow
- **Chat Platforms**: Custom integrations beyond Slack
- **Monitoring Tools**: Forward alerts to other monitoring systems
- **Automation**: Trigger automated remediation scripts

## Compliance and Auditing

- All alert configurations are version controlled
- Alert history is retained for compliance requirements
- Notification delivery is logged
- Access to alerting configuration is role-based
- Regular audits of alert effectiveness and accuracy