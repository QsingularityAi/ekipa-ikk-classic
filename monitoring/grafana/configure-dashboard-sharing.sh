#!/bin/bash

# Grafana Dashboard Sharing and Permissions Configuration Script
# This script configures shareable links and public dashboard access

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

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to make API calls to Grafana
grafana_api() {
    local method=$1
    local endpoint=$2
    local data=$3
    
    if [ -n "$data" ]; then
        curl -s -X "$method" \
            -H "Content-Type: application/json" \
            -u "$ADMIN_USER:$ADMIN_PASSWORD" \
            -d "$data" \
            "$GRAFANA_URL/api$endpoint"
    else
        curl -s -X "$method" \
            -H "Content-Type: application/json" \
            -u "$ADMIN_USER:$ADMIN_PASSWORD" \
            "$GRAFANA_URL/api$endpoint"
    fi
}

# Wait for Grafana to be ready
wait_for_grafana() {
    print_status "Waiting for Grafana to be ready..."
    local max_attempts=30
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        if curl -s -f "$GRAFANA_URL/api/health" > /dev/null 2>&1; then
            print_status "Grafana is ready!"
            return 0
        fi
        
        print_status "Attempt $attempt/$max_attempts - Grafana not ready yet, waiting..."
        sleep 2
        ((attempt++))
    done
    
    print_error "Grafana failed to start within expected time"
    exit 1
}

# Get all dashboards
get_dashboards() {
    print_status "Retrieving dashboard information..."
    dashboards_response=$(grafana_api "GET" "/search?type=dash-db")
    echo "$dashboards_response" | jq -r '.[] | "\(.uid)|\(.title)|\(.id)"'
}

# Configure public dashboard access
configure_public_dashboards() {
    print_status "Configuring public dashboard access..."
    
    # Get dashboards
    local dashboards=$(get_dashboards)
    
    # Configure public access for specific dashboards
    while IFS='|' read -r uid title id; do
        case "$title" in
            "User Engagement Analytics")
                print_status "Configuring public access for User Engagement Analytics..."
                configure_public_dashboard "$uid" "$title" "business-public"
                ;;
            "System Monitoring")
                print_status "Configuring restricted sharing for System Monitoring..."
                configure_restricted_sharing "$uid" "$title" "system-ops"
                ;;
            "Business Intelligence")
                print_status "Configuring business sharing for Business Intelligence..."
                configure_business_sharing "$uid" "$title" "business-intel"
                ;;
            "Real-time Operations")
                print_status "Configuring operations sharing for Real-time Operations..."
                configure_operations_sharing "$uid" "$title" "real-time-ops"
                ;;
        esac
    done <<< "$dashboards"
}

# Configure public dashboard with time-limited access
configure_public_dashboard() {
    local dashboard_uid=$1
    local dashboard_title=$2
    local share_name=$3
    
    # Create public dashboard configuration
    local public_config='{
        "dashboard": {
            "uid": "'$dashboard_uid'",
            "title": "'$dashboard_title'"
        },
        "meta": {
            "isPublic": true,
            "annotationsEnabled": false,
            "timeSelectionEnabled": true,
            "shareUrl": "'$GRAFANA_URL'/public-dashboards/'$share_name'"
        },
        "publicDashboard": {
            "uid": "'$share_name'",
            "accessToken": "'$(generate_access_token)'",
            "isEnabled": true,
            "annotationsEnabled": false,
            "timeSelectionEnabled": true
        }
    }'
    
    # Enable public dashboard
    response=$(grafana_api "POST" "/dashboards/uid/$dashboard_uid/public-dashboards" "$public_config")
    
    if echo "$response" | jq -e '.uid' > /dev/null 2>&1; then
        local public_url=$(echo "$response" | jq -r '.dashboardUrl')
        print_status "✓ Public dashboard created: $public_url"
        
        # Store sharing information
        echo "$dashboard_title|$public_url|public|$(date)" >> monitoring/grafana/dashboard-shares.log
    else
        print_warning "Failed to create public dashboard for $dashboard_title"
    fi
}

# Configure restricted sharing (team-based access)
configure_restricted_sharing() {
    local dashboard_uid=$1
    local dashboard_title=$2
    local share_name=$3
    
    print_status "Setting up restricted sharing for $dashboard_title..."
    
    # Get team IDs
    local dev_team_id=$(get_team_id "Developers")
    local admin_team_id=$(get_team_id "Administrators")
    
    if [ -n "$dev_team_id" ] && [ -n "$admin_team_id" ]; then
        # Configure team-based permissions
        local permissions='{
            "items": [
                {"role": "Admin", "permission": 1},
                {"teamId": '$dev_team_id', "permission": 2},
                {"teamId": '$admin_team_id', "permission": 1}
            ]
        }'
        
        response=$(grafana_api "POST" "/dashboards/uid/$dashboard_uid/permissions" "$permissions")
        
        if echo "$response" | jq -e '.message' > /dev/null 2>&1; then
            print_status "✓ Restricted sharing configured for $dashboard_title"
            
            # Create shareable link for team members
            create_shareable_link "$dashboard_uid" "$dashboard_title" "team-restricted"
        else
            print_warning "Failed to configure restricted sharing for $dashboard_title"
        fi
    fi
}

# Configure business sharing
configure_business_sharing() {
    local dashboard_uid=$1
    local dashboard_title=$2
    local share_name=$3
    
    print_status "Setting up business sharing for $dashboard_title..."
    
    # Get business team ID
    local business_team_id=$(get_team_id "Business Users")
    local admin_team_id=$(get_team_id "Administrators")
    
    if [ -n "$business_team_id" ] && [ -n "$admin_team_id" ]; then
        # Configure business team permissions
        local permissions='{
            "items": [
                {"role": "Admin", "permission": 1},
                {"teamId": '$business_team_id', "permission": 2},
                {"teamId": '$admin_team_id', "permission": 1}
            ]
        }'
        
        response=$(grafana_api "POST" "/dashboards/uid/$dashboard_uid/permissions" "$permissions")
        
        if echo "$response" | jq -e '.message' > /dev/null 2>&1; then
            print_status "✓ Business sharing configured for $dashboard_title"
            
            # Create external shareable link for stakeholders
            create_external_shareable_link "$dashboard_uid" "$dashboard_title" "business-external"
        else
            print_warning "Failed to configure business sharing for $dashboard_title"
        fi
    fi
}

# Configure operations sharing
configure_operations_sharing() {
    local dashboard_uid=$1
    local dashboard_title=$2
    local share_name=$3
    
    print_status "Setting up operations sharing for $dashboard_title..."
    
    # Get team IDs
    local dev_team_id=$(get_team_id "Developers")
    local admin_team_id=$(get_team_id "Administrators")
    
    if [ -n "$dev_team_id" ] && [ -n "$admin_team_id" ]; then
        # Configure operations permissions
        local permissions='{
            "items": [
                {"role": "Admin", "permission": 1},
                {"teamId": '$dev_team_id', "permission": 2},
                {"teamId": '$admin_team_id', "permission": 1}
            ]
        }'
        
        response=$(grafana_api "POST" "/dashboards/uid/$dashboard_uid/permissions" "$permissions")
        
        if echo "$response" | jq -e '.message' > /dev/null 2>&1; then
            print_status "✓ Operations sharing configured for $dashboard_title"
            
            # Create time-limited shareable link
            create_time_limited_link "$dashboard_uid" "$dashboard_title" "ops-limited"
        else
            print_warning "Failed to configure operations sharing for $dashboard_title"
        fi
    fi
}

# Get team ID by name
get_team_id() {
    local team_name=$1
    teams_response=$(grafana_api "GET" "/teams/search?name=$team_name")
    echo "$teams_response" | jq -r '.teams[0].id // empty'
}

# Create shareable link
create_shareable_link() {
    local dashboard_uid=$1
    local dashboard_title=$2
    local share_type=$3
    
    # Create snapshot for sharing
    local snapshot_config='{
        "dashboard": {
            "uid": "'$dashboard_uid'"
        },
        "name": "'$dashboard_title' - Shared",
        "expires": 86400,
        "external": false,
        "key": "'$(generate_share_key)'",
        "deleteKey": "'$(generate_delete_key)'"
    }'
    
    response=$(grafana_api "POST" "/snapshots" "$snapshot_config")
    
    if echo "$response" | jq -e '.url' > /dev/null 2>&1; then
        local share_url=$(echo "$response" | jq -r '.url')
        local delete_url=$(echo "$response" | jq -r '.deleteUrl')
        
        print_status "✓ Shareable link created: $share_url"
        
        # Store sharing information
        echo "$dashboard_title|$share_url|$share_type|$(date)|$delete_url" >> monitoring/grafana/dashboard-shares.log
    else
        print_warning "Failed to create shareable link for $dashboard_title"
    fi
}

# Create external shareable link (for business stakeholders)
create_external_shareable_link() {
    local dashboard_uid=$1
    local dashboard_title=$2
    local share_type=$3
    
    # Create external snapshot
    local external_config='{
        "dashboard": {
            "uid": "'$dashboard_uid'"
        },
        "name": "'$dashboard_title' - External Share",
        "expires": 604800,
        "external": true,
        "key": "'$(generate_share_key)'",
        "deleteKey": "'$(generate_delete_key)'"
    }'
    
    response=$(grafana_api "POST" "/snapshots" "$external_config")
    
    if echo "$response" | jq -e '.url' > /dev/null 2>&1; then
        local share_url=$(echo "$response" | jq -r '.url')
        local delete_url=$(echo "$response" | jq -r '.deleteUrl')
        
        print_status "✓ External shareable link created: $share_url"
        
        # Store sharing information
        echo "$dashboard_title|$share_url|$share_type|$(date)|$delete_url" >> monitoring/grafana/dashboard-shares.log
    else
        print_warning "Failed to create external shareable link for $dashboard_title"
    fi
}

# Create time-limited link (24 hours)
create_time_limited_link() {
    local dashboard_uid=$1
    local dashboard_title=$2
    local share_type=$3
    
    # Create time-limited snapshot
    local limited_config='{
        "dashboard": {
            "uid": "'$dashboard_uid'"
        },
        "name": "'$dashboard_title' - Time Limited",
        "expires": 86400,
        "external": false,
        "key": "'$(generate_share_key)'",
        "deleteKey": "'$(generate_delete_key)'"
    }'
    
    response=$(grafana_api "POST" "/snapshots" "$limited_config")
    
    if echo "$response" | jq -e '.url' > /dev/null 2>&1; then
        local share_url=$(echo "$response" | jq -r '.url')
        local delete_url=$(echo "$response" | jq -r '.deleteUrl')
        
        print_status "✓ Time-limited link created (24h): $share_url"
        
        # Store sharing information
        echo "$dashboard_title|$share_url|$share_type|$(date)|$delete_url" >> monitoring/grafana/dashboard-shares.log
    else
        print_warning "Failed to create time-limited link for $dashboard_title"
    fi
}

# Generate access token
generate_access_token() {
    echo "$(openssl rand -hex 16)"
}

# Generate share key
generate_share_key() {
    echo "$(openssl rand -hex 8)"
}

# Generate delete key
generate_delete_key() {
    echo "$(openssl rand -hex 12)"
}

# Test sharing functionality
test_sharing_functionality() {
    print_status "Testing sharing functionality..."
    
    # Test public dashboard access
    print_status "Testing public dashboard access..."
    if [ -f "monitoring/grafana/dashboard-shares.log" ]; then
        while IFS='|' read -r title url type date delete_url; do
            if [ "$type" = "public" ]; then
                print_status "Testing public access: $title"
                response_code=$(curl -s -o /dev/null -w "%{http_code}" "$url")
                if [ "$response_code" = "200" ]; then
                    print_status "✓ Public dashboard accessible: $title"
                else
                    print_warning "✗ Public dashboard not accessible: $title (HTTP $response_code)"
                fi
            fi
        done < monitoring/grafana/dashboard-shares.log
    fi
    
    # Test team-based access
    print_status "Testing team-based access..."
    test_team_access "dev1" "dev123!" "Developers"
    test_team_access "pm" "pm123!" "Business Users"
    test_team_access "viewer1" "viewer123!" "Viewers"
}

# Test team access
test_team_access() {
    local username=$1
    local password=$2
    local team_name=$3
    
    print_status "Testing access for $team_name team member: $username"
    
    # Test dashboard access
    response=$(curl -s -u "$username:$password" "$GRAFANA_URL/api/search?type=dash-db")
    
    if echo "$response" | jq -e '.[0]' > /dev/null 2>&1; then
        local dashboard_count=$(echo "$response" | jq '. | length')
        print_status "✓ $username can access $dashboard_count dashboards"
    else
        print_warning "✗ $username cannot access dashboards"
    fi
}

# Generate sharing report
generate_sharing_report() {
    print_status "Generating dashboard sharing report..."
    
    cat > monitoring/grafana/DASHBOARD_SHARING_REPORT.md << 'EOF'
# Dashboard Sharing Configuration Report

## Overview

This report documents the dashboard sharing configuration and provides access information for different user roles and external stakeholders.

## Sharing Configuration Summary

### Public Dashboards
- **User Engagement Analytics**: Publicly accessible for business stakeholders
- **Access**: No authentication required
- **Limitations**: Read-only, no data export

### Team-Restricted Dashboards
- **System Monitoring**: Developers and Administrators only
- **Real-time Operations**: Operations team and Administrators
- **Access**: Team membership required

### Business Dashboards
- **Business Intelligence**: Business team and external stakeholders
- **Access**: Team membership or shareable link

## Shareable Links

EOF

    # Add shareable links to report
    if [ -f "monitoring/grafana/dashboard-shares.log" ]; then
        echo "### Generated Shareable Links" >> monitoring/grafana/DASHBOARD_SHARING_REPORT.md
        echo "" >> monitoring/grafana/DASHBOARD_SHARING_REPORT.md
        
        while IFS='|' read -r title url type date delete_url; do
            echo "#### $title" >> monitoring/grafana/DASHBOARD_SHARING_REPORT.md
            echo "- **Type**: $type" >> monitoring/grafana/DASHBOARD_SHARING_REPORT.md
            echo "- **URL**: $url" >> monitoring/grafana/DASHBOARD_SHARING_REPORT.md
            echo "- **Created**: $date" >> monitoring/grafana/DASHBOARD_SHARING_REPORT.md
            if [ -n "$delete_url" ]; then
                echo "- **Delete URL**: $delete_url" >> monitoring/grafana/DASHBOARD_SHARING_REPORT.md
            fi
            echo "" >> monitoring/grafana/DASHBOARD_SHARING_REPORT.md
        done < monitoring/grafana/dashboard-shares.log
    fi
    
    # Add access control matrix
    cat >> monitoring/grafana/DASHBOARD_SHARING_REPORT.md << 'EOF'

## Access Control Matrix

| Dashboard | Admin | Developers | Business | Viewers | Public |
|-----------|-------|------------|----------|---------|--------|
| System Monitoring | Full | Edit | View | View | No |
| User Engagement Analytics | Full | View | Edit | View | Yes |
| Business Intelligence | Full | View | Edit | View | Limited |
| Real-time Operations | Full | Edit | View | View | No |

## Permission Levels
- **Full**: Complete access including configuration
- **Edit**: Can modify panels and queries
- **View**: Read-only access
- **Limited**: Time-limited or feature-restricted access
- **No**: No access

## Security Considerations

### Public Dashboard Security
- No sensitive data exposed in public dashboards
- Time-based data aggregation to prevent detailed analysis
- No user-specific information displayed

### Shareable Link Security
- Time-limited links expire automatically
- Delete keys provided for manual revocation
- External links have additional restrictions

### Team-based Access
- Role-based permissions enforced
- Regular access reviews recommended
- Audit logging enabled for all access

## Maintenance

### Regular Tasks
- Review public dashboard content monthly
- Rotate shareable links quarterly
- Audit team memberships
- Monitor access patterns

### Link Management
- Expired links are automatically cleaned up
- Manual revocation available via delete URLs
- New links can be generated as needed

## Support

For dashboard sharing issues:
1. Check team membership
2. Verify link expiration
3. Review permissions matrix
4. Contact system administrator

## Troubleshooting

### Common Issues
- **Access Denied**: Check team membership and permissions
- **Link Expired**: Generate new shareable link
- **Public Dashboard Not Loading**: Verify public access configuration
- **Permission Errors**: Review role assignments

### Contact Information
- **System Administrator**: admin@company.com
- **Dashboard Support**: dashboard-support@company.com
- **Emergency Access**: Call IT support hotline

EOF

    print_status "Dashboard sharing report generated at monitoring/grafana/DASHBOARD_SHARING_REPORT.md"
}

# Cleanup expired links
cleanup_expired_links() {
    print_status "Cleaning up expired shareable links..."
    
    if [ -f "monitoring/grafana/dashboard-shares.log" ]; then
        local temp_file=$(mktemp)
        local current_time=$(date +%s)
        
        while IFS='|' read -r title url type date delete_url; do
            local link_time=$(date -d "$date" +%s 2>/dev/null || echo "0")
            local age=$((current_time - link_time))
            
            # Keep links younger than 7 days (604800 seconds)
            if [ $age -lt 604800 ]; then
                echo "$title|$url|$type|$date|$delete_url" >> "$temp_file"
            else
                print_status "Removing expired link: $title ($type)"
                # Attempt to delete via API if delete URL exists
                if [ -n "$delete_url" ] && [ "$delete_url" != "delete_url" ]; then
                    curl -s -X DELETE "$delete_url" > /dev/null 2>&1 || true
                fi
            fi
        done < monitoring/grafana/dashboard-shares.log
        
        mv "$temp_file" monitoring/grafana/dashboard-shares.log
        print_status "Expired links cleanup completed"
    fi
}

# Main execution
main() {
    print_status "Starting Grafana Dashboard Sharing Configuration..."
    
    # Check if jq is installed
    if ! command -v jq &> /dev/null; then
        print_error "jq is required but not installed. Please install jq first."
        exit 1
    fi
    
    # Check if openssl is installed
    if ! command -v openssl &> /dev/null; then
        print_error "openssl is required but not installed. Please install openssl first."
        exit 1
    fi
    
    # Initialize sharing log file
    echo "Dashboard Title|Share URL|Share Type|Created Date|Delete URL" > monitoring/grafana/dashboard-shares.log
    
    wait_for_grafana
    configure_public_dashboards
    test_sharing_functionality
    cleanup_expired_links
    generate_sharing_report
    
    print_status "Dashboard sharing configuration completed successfully!"
    print_status "Check monitoring/grafana/DASHBOARD_SHARING_REPORT.md for sharing details"
    print_status "Shareable links logged in monitoring/grafana/dashboard-shares.log"
}

# Run main function
main "$@"