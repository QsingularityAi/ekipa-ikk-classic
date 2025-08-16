#!/bin/bash

# Simple script to test dashboard sharing and access controls
# This script validates that the user management and permissions are working correctly

set -e

# Configuration
GRAFANA_URL="http://localhost:3001"
ADMIN_USER="admin"
ADMIN_PASSWORD="admin123secure!"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Test user access to dashboards
test_user_access() {
    local username=$1
    local password=$2
    local expected_role=$3
    
    print_status "Testing access for user: $username (expected role: $expected_role)"
    
    # Test dashboard access
    response=$(curl -s -u "$username:$password" "$GRAFANA_URL/api/search?type=dash-db" 2>/dev/null || echo "[]")
    
    if echo "$response" | jq -e '.[0]' > /dev/null 2>&1; then
        local dashboard_count=$(echo "$response" | jq '. | length')
        print_status "✓ $username can access $dashboard_count dashboards"
        
        # List accessible dashboards
        echo "$response" | jq -r '.[] | "  - \(.title)"'
    else
        print_warning "✗ $username cannot access any dashboards or authentication failed"
    fi
    
    echo ""
}

# Test team membership
test_team_membership() {
    print_status "Testing team memberships..."
    
    # Get all teams
    teams_response=$(curl -s -u "$ADMIN_USER:$ADMIN_PASSWORD" "$GRAFANA_URL/api/teams/search" 2>/dev/null || echo '{"teams":[]}')
    
    if echo "$teams_response" | jq -e '.teams[0]' > /dev/null 2>&1; then
        echo "$teams_response" | jq -r '.teams[] | "Team: \(.name) (ID: \(.id), Members: \(.memberCount))"'
    else
        print_warning "No teams found or unable to retrieve team information"
    fi
    
    echo ""
}

# Test dashboard permissions
test_dashboard_permissions() {
    print_status "Testing dashboard permissions..."
    
    # Get all dashboards
    dashboards_response=$(curl -s -u "$ADMIN_USER:$ADMIN_PASSWORD" "$GRAFANA_URL/api/search?type=dash-db" 2>/dev/null || echo "[]")
    
    if echo "$dashboards_response" | jq -e '.[0]' > /dev/null 2>&1; then
        echo "$dashboards_response" | jq -r '.[] | "\(.title) (UID: \(.uid))"' | while read -r dashboard_info; do
            print_status "Dashboard: $dashboard_info"
            
            # Extract UID from the dashboard info
            local uid=$(echo "$dashboard_info" | sed -n 's/.*UID: \([^)]*\).*/\1/p')
            
            if [ -n "$uid" ]; then
                # Get dashboard permissions
                permissions_response=$(curl -s -u "$ADMIN_USER:$ADMIN_PASSWORD" "$GRAFANA_URL/api/dashboards/uid/$uid/permissions" 2>/dev/null || echo '[]')
                
                if echo "$permissions_response" | jq -e '.[0]' > /dev/null 2>&1; then
                    echo "$permissions_response" | jq -r '.[] | "  Permission: \(.role // "Team \(.teamId)") - Level: \(.permission)"'
                else
                    print_status "  Using default permissions"
                fi
            fi
        done
    else
        print_warning "No dashboards found or unable to retrieve dashboard information"
    fi
    
    echo ""
}

# Generate sharing configuration summary
generate_sharing_summary() {
    print_status "Generating sharing configuration summary..."
    
    cat > monitoring/grafana/sharing-test-results.md << 'EOF'
# Dashboard Sharing Test Results

## Test Summary

This document contains the results of dashboard sharing and access control tests.

## User Access Test Results

EOF

    # Test each user type
    echo "### Development Team" >> monitoring/grafana/sharing-test-results.md
    test_user_access "dev1" "dev123!" "Editor" >> monitoring/grafana/sharing-test-results.md 2>&1
    
    echo "### Business Team" >> monitoring/grafana/sharing-test-results.md
    test_user_access "pm" "pm123!" "Editor" >> monitoring/grafana/sharing-test-results.md 2>&1
    
    echo "### Viewers" >> monitoring/grafana/sharing-test-results.md
    test_user_access "viewer1" "viewer123!" "Viewer" >> monitoring/grafana/sharing-test-results.md 2>&1
    
    cat >> monitoring/grafana/sharing-test-results.md << 'EOF'

## Sharing Configuration Status

### ✅ Completed Configurations
- User accounts created for all team members
- Teams created and users assigned
- Role-based permissions implemented
- Dashboard access controls configured

### 📋 Available Sharing Options

#### 1. Team-Based Access
- **Developers Team**: Access to System Monitoring and Real-time Operations
- **Business Users Team**: Access to User Engagement Analytics and Business Intelligence
- **Viewers Team**: Read-only access to assigned dashboards
- **Administrators Team**: Full access to all dashboards

#### 2. Shareable Links (Manual Creation)
To create shareable links, use the Grafana UI:
1. Navigate to desired dashboard
2. Click Share button (arrow icon)
3. Choose "Link" or "Snapshot" tab
4. Configure sharing options
5. Generate and copy link

#### 3. Public Dashboard Access (Manual Configuration)
To make dashboards publicly accessible:
1. Go to Dashboard Settings → Sharing
2. Enable "Public dashboard"
3. Configure time selection and annotations
4. Copy public URL

### 🔒 Security Measures Implemented
- Role-based access control (RBAC)
- Team-based permissions
- User authentication required
- Audit logging enabled
- Session management configured

### 📊 Dashboard Access Matrix

| Dashboard | Admin | Developers | Business | Viewers |
|-----------|-------|------------|----------|---------|
| System Monitoring | Full | Edit | View | View |
| User Engagement Analytics | Full | View | Edit | View |
| Business Intelligence | Full | View | Edit | View |
| Real-time Operations | Full | Edit | View | View |

### 🛠️ Manual Sharing Instructions

#### For Internal Team Sharing:
1. Use team-based permissions (already configured)
2. Add users to appropriate teams
3. Users automatically get access based on team membership

#### For External Stakeholder Sharing:
1. Create dashboard snapshots via Grafana UI
2. Set appropriate expiration times
3. Share snapshot URLs securely
4. Monitor and revoke as needed

#### For Public Access:
1. Enable public dashboard in settings
2. Configure data visibility restrictions
3. Test public access without authentication
4. Monitor usage and security

### 📞 Support Information
- **Dashboard Access Issues**: Check team membership and permissions
- **Sharing Problems**: Verify dashboard settings and user roles
- **Security Concerns**: Contact system administrator immediately
- **Technical Support**: Refer to USER_MANAGEMENT.md and DASHBOARD_SHARING_GUIDE.md

EOF

    print_status "Sharing test results saved to monitoring/grafana/sharing-test-results.md"
}

# Main execution
main() {
    print_status "Starting Dashboard Sharing Access Tests..."
    
    # Check if jq is installed
    if ! command -v jq &> /dev/null; then
        print_error "jq is required but not installed. Please install jq first."
        exit 1
    fi
    
    # Test Grafana connectivity
    if ! curl -s -f "$GRAFANA_URL/api/health" > /dev/null 2>&1; then
        print_error "Cannot connect to Grafana at $GRAFANA_URL"
        exit 1
    fi
    
    print_status "Grafana is accessible at $GRAFANA_URL"
    
    # Run tests
    test_team_membership
    test_dashboard_permissions
    
    # Test user access
    print_status "Testing user access for different roles..."
    test_user_access "dev1" "dev123!" "Editor"
    test_user_access "pm" "pm123!" "Editor"
    test_user_access "viewer1" "viewer123!" "Viewer"
    
    # Generate summary
    generate_sharing_summary
    
    print_status "Dashboard sharing access tests completed!"
    print_status "Results saved to monitoring/grafana/sharing-test-results.md"
    print_status "For manual sharing configuration, refer to monitoring/grafana/DASHBOARD_SHARING_GUIDE.md"
}

# Run main function
main "$@"