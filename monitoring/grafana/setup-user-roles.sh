#!/bin/bash

# Grafana User Roles and Permissions Setup Script
# This script creates user roles and configures permissions for the Grafana dashboard

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

# Create user accounts
create_users() {
    print_status "Creating user accounts..."
    
    # Development team users
    local dev_users=(
        '{"name":"Developer 1","email":"dev1@company.com","login":"dev1","password":"dev123!","role":"Editor"}'
        '{"name":"Developer 2","email":"dev2@company.com","login":"dev2","password":"dev123!","role":"Editor"}'
        '{"name":"DevOps Engineer","email":"devops@company.com","login":"devops","password":"devops123!","role":"Editor"}'
    )
    
    # Business team users
    local business_users=(
        '{"name":"Product Manager","email":"pm@company.com","login":"pm","password":"pm123!","role":"Editor"}'
        '{"name":"Business Analyst","email":"analyst@company.com","login":"analyst","password":"analyst123!","role":"Editor"}'
        '{"name":"Executive","email":"exec@company.com","login":"exec","password":"exec123!","role":"Viewer"}'
    )
    
    # Viewer users
    local viewer_users=(
        '{"name":"Viewer 1","email":"viewer1@company.com","login":"viewer1","password":"viewer123!","role":"Viewer"}'
        '{"name":"Viewer 2","email":"viewer2@company.com","login":"viewer2","password":"viewer123!","role":"Viewer"}'
    )
    
    # Create development users
    for user_data in "${dev_users[@]}"; do
        local email=$(echo "$user_data" | jq -r '.email')
        print_status "Creating developer user: $email"
        
        response=$(grafana_api "POST" "/admin/users" "$user_data")
        if echo "$response" | jq -e '.id' > /dev/null 2>&1; then
            print_status "Successfully created user: $email"
        else
            print_warning "User $email may already exist or creation failed"
        fi
    done
    
    # Create business users
    for user_data in "${business_users[@]}"; do
        local email=$(echo "$user_data" | jq -r '.email')
        print_status "Creating business user: $email"
        
        response=$(grafana_api "POST" "/admin/users" "$user_data")
        if echo "$response" | jq -e '.id' > /dev/null 2>&1; then
            print_status "Successfully created user: $email"
        else
            print_warning "User $email may already exist or creation failed"
        fi
    done
    
    # Create viewer users
    for user_data in "${viewer_users[@]}"; do
        local email=$(echo "$user_data" | jq -r '.email')
        print_status "Creating viewer user: $email"
        
        response=$(grafana_api "POST" "/admin/users" "$user_data")
        if echo "$response" | jq -e '.id' > /dev/null 2>&1; then
            print_status "Successfully created user: $email"
        else
            print_warning "User $email may already exist or creation failed"
        fi
    done
}

# Create teams and assign users
create_teams() {
    print_status "Creating teams and assigning users..."
    
    # Create Administrators team
    local admin_team='{"name":"Administrators","email":"admin@company.com"}'
    response=$(grafana_api "POST" "/teams" "$admin_team")
    local admin_team_id=$(echo "$response" | jq -r '.teamId // empty')
    
    if [ -n "$admin_team_id" ]; then
        print_status "Created Administrators team with ID: $admin_team_id"
    else
        print_warning "Administrators team may already exist"
        # Get existing team ID
        teams_response=$(grafana_api "GET" "/teams/search?name=Administrators")
        admin_team_id=$(echo "$teams_response" | jq -r '.teams[0].id // empty')
    fi
    
    # Create Developers team
    local dev_team='{"name":"Developers","email":"dev-team@company.com"}'
    response=$(grafana_api "POST" "/teams" "$dev_team")
    local dev_team_id=$(echo "$response" | jq -r '.teamId // empty')
    
    if [ -n "$dev_team_id" ]; then
        print_status "Created Developers team with ID: $dev_team_id"
    else
        print_warning "Developers team may already exist"
        teams_response=$(grafana_api "GET" "/teams/search?name=Developers")
        dev_team_id=$(echo "$teams_response" | jq -r '.teams[0].id // empty')
    fi
    
    # Create Business Users team
    local business_team='{"name":"Business Users","email":"business@company.com"}'
    response=$(grafana_api "POST" "/teams" "$business_team")
    local business_team_id=$(echo "$response" | jq -r '.teamId // empty')
    
    if [ -n "$business_team_id" ]; then
        print_status "Created Business Users team with ID: $business_team_id"
    else
        print_warning "Business Users team may already exist"
        teams_response=$(grafana_api "GET" "/teams/search?name=Business Users")
        business_team_id=$(echo "$teams_response" | jq -r '.teams[0].id // empty')
    fi
    
    # Create Viewers team
    local viewers_team='{"name":"Viewers","email":"viewers@company.com"}'
    response=$(grafana_api "POST" "/teams" "$viewers_team")
    local viewers_team_id=$(echo "$response" | jq -r '.teamId // empty')
    
    if [ -n "$viewers_team_id" ]; then
        print_status "Created Viewers team with ID: $viewers_team_id"
    else
        print_warning "Viewers team may already exist"
        teams_response=$(grafana_api "GET" "/teams/search?name=Viewers")
        viewers_team_id=$(echo "$teams_response" | jq -r '.teams[0].id // empty')
    fi
    
    # Store team IDs for later use
    echo "$dev_team_id" > /tmp/dev_team_id
    echo "$business_team_id" > /tmp/business_team_id
    echo "$viewers_team_id" > /tmp/viewers_team_id
}

# Assign users to teams
assign_users_to_teams() {
    print_status "Assigning users to teams..."
    
    # Get team IDs
    local dev_team_id=$(cat /tmp/dev_team_id 2>/dev/null || echo "")
    local business_team_id=$(cat /tmp/business_team_id 2>/dev/null || echo "")
    local viewers_team_id=$(cat /tmp/viewers_team_id 2>/dev/null || echo "")
    
    # Get all users
    users_response=$(grafana_api "GET" "/users")
    
    # Assign developers to Developers team
    if [ -n "$dev_team_id" ]; then
        for login in "dev1" "dev2" "devops"; do
            user_id=$(echo "$users_response" | jq -r ".[] | select(.login==\"$login\") | .id // empty")
            if [ -n "$user_id" ]; then
                response=$(grafana_api "POST" "/teams/$dev_team_id/members" "{\"userId\":$user_id}")
                print_status "Added user $login to Developers team"
            fi
        done
    fi
    
    # Assign business users to Business Users team
    if [ -n "$business_team_id" ]; then
        for login in "pm" "analyst" "exec"; do
            user_id=$(echo "$users_response" | jq -r ".[] | select(.login==\"$login\") | .id // empty")
            if [ -n "$user_id" ]; then
                response=$(grafana_api "POST" "/teams/$business_team_id/members" "{\"userId\":$user_id}")
                print_status "Added user $login to Business Users team"
            fi
        done
    fi
    
    # Assign viewers to Viewers team
    if [ -n "$viewers_team_id" ]; then
        for login in "viewer1" "viewer2"; do
            user_id=$(echo "$users_response" | jq -r ".[] | select(.login==\"$login\") | .id // empty")
            if [ -n "$user_id" ]; then
                response=$(grafana_api "POST" "/teams/$viewers_team_id/members" "{\"userId\":$user_id}")
                print_status "Added user $login to Viewers team"
            fi
        done
    fi
}

# Configure dashboard permissions
configure_dashboard_permissions() {
    print_status "Configuring dashboard permissions..."
    
    # Get dashboard UIDs
    dashboards_response=$(grafana_api "GET" "/search?type=dash-db")
    
    # Get team IDs
    local dev_team_id=$(cat /tmp/dev_team_id 2>/dev/null || echo "")
    local business_team_id=$(cat /tmp/business_team_id 2>/dev/null || echo "")
    local viewers_team_id=$(cat /tmp/viewers_team_id 2>/dev/null || echo "")
    
    # Configure System Monitoring Dashboard permissions (Developers + Admin)
    local system_dashboard_uid=$(echo "$dashboards_response" | jq -r '.[] | select(.title=="System Monitoring") | .uid // empty')
    if [ -n "$system_dashboard_uid" ] && [ -n "$dev_team_id" ]; then
        local permissions='{"items":[
            {"role":"Admin","permission":1},
            {"teamId":'$dev_team_id',"permission":2},
            {"teamId":'$viewers_team_id',"permission":1}
        ]}'
        grafana_api "POST" "/dashboards/uid/$system_dashboard_uid/permissions" "$permissions"
        print_status "Configured permissions for System Monitoring dashboard"
    fi
    
    # Configure User Engagement Analytics Dashboard permissions (Business + Admin)
    local engagement_dashboard_uid=$(echo "$dashboards_response" | jq -r '.[] | select(.title=="User Engagement Analytics") | .uid // empty')
    if [ -n "$engagement_dashboard_uid" ] && [ -n "$business_team_id" ]; then
        local permissions='{"items":[
            {"role":"Admin","permission":1},
            {"teamId":'$business_team_id',"permission":2},
            {"teamId":'$viewers_team_id',"permission":1}
        ]}'
        grafana_api "POST" "/dashboards/uid/$engagement_dashboard_uid/permissions" "$permissions"
        print_status "Configured permissions for User Engagement Analytics dashboard"
    fi
    
    # Configure Business Intelligence Dashboard permissions (Business + Admin)
    local bi_dashboard_uid=$(echo "$dashboards_response" | jq -r '.[] | select(.title=="Business Intelligence") | .uid // empty')
    if [ -n "$bi_dashboard_uid" ] && [ -n "$business_team_id" ]; then
        local permissions='{"items":[
            {"role":"Admin","permission":1},
            {"teamId":'$business_team_id',"permission":2},
            {"teamId":'$viewers_team_id',"permission":1}
        ]}'
        grafana_api "POST" "/dashboards/uid/$bi_dashboard_uid/permissions" "$permissions"
        print_status "Configured permissions for Business Intelligence dashboard"
    fi
    
    # Configure Real-time Operations Dashboard permissions (Developers + Admin)
    local realtime_dashboard_uid=$(echo "$dashboards_response" | jq -r '.[] | select(.title=="Real-time Operations") | .uid // empty')
    if [ -n "$realtime_dashboard_uid" ] && [ -n "$dev_team_id" ]; then
        local permissions='{"items":[
            {"role":"Admin","permission":1},
            {"teamId":'$dev_team_id',"permission":2},
            {"teamId":'$viewers_team_id',"permission":1}
        ]}'
        grafana_api "POST" "/dashboards/uid/$realtime_dashboard_uid/permissions" "$permissions"
        print_status "Configured permissions for Real-time Operations dashboard"
    fi
}

# Test role-based access
test_role_access() {
    print_status "Testing role-based access..."
    
    # Test developer access to system monitoring
    print_status "Testing developer access to system monitoring dashboard..."
    response=$(curl -s -u "dev1:dev123!" "$GRAFANA_URL/api/search?type=dash-db")
    if echo "$response" | jq -e '.[] | select(.title=="System Monitoring")' > /dev/null 2>&1; then
        print_status "✓ Developer can access System Monitoring dashboard"
    else
        print_warning "✗ Developer cannot access System Monitoring dashboard"
    fi
    
    # Test business user access to analytics
    print_status "Testing business user access to analytics dashboard..."
    response=$(curl -s -u "pm:pm123!" "$GRAFANA_URL/api/search?type=dash-db")
    if echo "$response" | jq -e '.[] | select(.title=="User Engagement Analytics")' > /dev/null 2>&1; then
        print_status "✓ Business user can access User Engagement Analytics dashboard"
    else
        print_warning "✗ Business user cannot access User Engagement Analytics dashboard"
    fi
    
    # Test viewer access (should be read-only)
    print_status "Testing viewer access..."
    response=$(curl -s -u "viewer1:viewer123!" "$GRAFANA_URL/api/search?type=dash-db")
    if [ "$(echo "$response" | jq '. | length')" -gt 0 ]; then
        print_status "✓ Viewer can access dashboards"
    else
        print_warning "✗ Viewer cannot access dashboards"
    fi
}

# Generate user credentials report
generate_credentials_report() {
    print_status "Generating user credentials report..."
    
    cat > monitoring/grafana/user-credentials.md << 'EOF'
# Grafana User Credentials Report

## Administrator Account
- **Username:** admin
- **Password:** admin123secure!
- **Role:** Admin
- **Access:** Full system access

## Development Team
- **Username:** dev1
- **Password:** dev123!
- **Role:** Editor
- **Access:** System Monitoring, Real-time Operations

- **Username:** dev2
- **Password:** dev123!
- **Role:** Editor
- **Access:** System Monitoring, Real-time Operations

- **Username:** devops
- **Password:** devops123!
- **Role:** Editor
- **Access:** System Monitoring, Real-time Operations

## Business Team
- **Username:** pm
- **Password:** pm123!
- **Role:** Editor
- **Access:** User Engagement Analytics, Business Intelligence

- **Username:** analyst
- **Password:** analyst123!
- **Role:** Editor
- **Access:** User Engagement Analytics, Business Intelligence

- **Username:** exec
- **Password:** exec123!
- **Role:** Viewer
- **Access:** Business Intelligence (read-only)

## Viewers
- **Username:** viewer1
- **Password:** viewer123!
- **Role:** Viewer
- **Access:** Read-only access to assigned dashboards

- **Username:** viewer2
- **Password:** viewer123!
- **Role:** Viewer
- **Access:** Read-only access to assigned dashboards

## Team Structure
- **Administrators:** Full access to all dashboards and system configuration
- **Developers:** Access to system monitoring and operational dashboards
- **Business Users:** Access to analytics and business intelligence dashboards
- **Viewers:** Read-only access to assigned dashboards

## Security Notes
- All passwords should be changed on first login
- Users are assigned to teams for easier permission management
- Dashboard permissions are configured per team
- Regular password rotation is recommended
EOF

    print_status "User credentials report generated at monitoring/grafana/user-credentials.md"
}

# Main execution
main() {
    print_status "Starting Grafana User Roles and Permissions Setup..."
    
    # Check if jq is installed
    if ! command -v jq &> /dev/null; then
        print_error "jq is required but not installed. Please install jq first."
        exit 1
    fi
    
    wait_for_grafana
    create_users
    create_teams
    assign_users_to_teams
    configure_dashboard_permissions
    test_role_access
    generate_credentials_report
    
    # Cleanup temporary files
    rm -f /tmp/dev_team_id /tmp/business_team_id /tmp/viewers_team_id
    
    print_status "User roles and permissions setup completed successfully!"
    print_status "Check monitoring/grafana/user-credentials.md for login details"
}

# Run main function
main "$@"