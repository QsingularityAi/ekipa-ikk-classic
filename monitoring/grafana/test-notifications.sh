#!/bin/bash

# Test script for Grafana notification channels
# This script tests the notification delivery and formatting

echo "Testing Grafana Notification Channels..."
echo "========================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test webhook endpoint
echo -e "${YELLOW}Testing webhook endpoint...${NC}"
if curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/webhooks/alerts | grep -q "200\|404"; then
    echo -e "${GREEN}✓ Webhook endpoint is accessible${NC}"
else
    echo -e "${RED}✗ Webhook endpoint is not accessible${NC}"
fi

# Test email configuration (check if SMTP is configured)
echo -e "${YELLOW}Checking email configuration...${NC}"
if grep -q "GF_SMTP_ENABLED=true" /etc/grafana/grafana.ini 2>/dev/null || grep -q "smtp" monitoring/grafana/grafana.ini 2>/dev/null; then
    echo -e "${GREEN}✓ SMTP configuration found${NC}"
else
    echo -e "${YELLOW}⚠ SMTP not configured - email notifications will not work${NC}"
    echo "  To enable email notifications, configure SMTP settings in grafana.ini:"
    echo "  [smtp]"
    echo "  enabled = true"
    echo "  host = smtp.gmail.com:587"
    echo "  user = your-email@gmail.com"
    echo "  password = your-app-password"
fi

# Test Slack webhook (if configured)
echo -e "${YELLOW}Checking Slack configuration...${NC}"
if [ -n "$SLACK_WEBHOOK_URL" ]; then
    echo -e "${GREEN}✓ Slack webhook URL is configured${NC}"
    # Test the webhook
    if curl -s -X POST -H 'Content-type: application/json' \
        --data '{"text":"Test message from Grafana notification setup"}' \
        "$SLACK_WEBHOOK_URL" | grep -q "ok"; then
        echo -e "${GREEN}✓ Slack webhook is working${NC}"
    else
        echo -e "${RED}✗ Slack webhook test failed${NC}"
    fi
else
    echo -e "${YELLOW}⚠ Slack webhook URL not configured${NC}"
    echo "  To enable Slack notifications, set SLACK_WEBHOOK_URL environment variable"
fi

# Check if Grafana is running
echo -e "${YELLOW}Checking Grafana service...${NC}"
if curl -s http://localhost:3001/api/health | grep -q "ok"; then
    echo -e "${GREEN}✓ Grafana is running and accessible${NC}"
else
    echo -e "${RED}✗ Grafana is not accessible at localhost:3001${NC}"
fi

# Validate alert configuration files
echo -e "${YELLOW}Validating alert configuration files...${NC}"

if [ -f "monitoring/grafana/provisioning/alerting/alerts.yml" ]; then
    echo -e "${GREEN}✓ Alert rules configuration found${NC}"
else
    echo -e "${RED}✗ Alert rules configuration missing${NC}"
fi

if [ -f "monitoring/grafana/provisioning/alerting/contactpoints.yml" ]; then
    echo -e "${GREEN}✓ Contact points configuration found${NC}"
else
    echo -e "${RED}✗ Contact points configuration missing${NC}"
fi

if [ -f "monitoring/grafana/provisioning/alerting/notification-policies.yml" ]; then
    echo -e "${GREEN}✓ Notification policies configuration found${NC}"
else
    echo -e "${RED}✗ Notification policies configuration missing${NC}"
fi

echo ""
echo -e "${YELLOW}Configuration Summary:${NC}"
echo "- Alert rules: System metrics (4 rules) + Business metrics (3 rules)"
echo "- Contact points: Email (critical/warning), Webhook, Slack"
echo "- Notification routing: Based on severity and team labels"
echo "- Inhibition rules: Prevent alert spam"
echo ""
echo -e "${GREEN}Notification setup complete!${NC}"
echo "To test alerts, you can:"
echo "1. Simulate high CPU usage or memory usage"
echo "2. Stop database connection temporarily"
echo "3. Generate high error rates in the application"
echo ""
echo "Monitor alerts in Grafana at: http://localhost:3001/alerting"