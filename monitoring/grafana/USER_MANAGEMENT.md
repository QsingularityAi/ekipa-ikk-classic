# Grafana User Management and Access Control

## Overview

This document outlines the user management and access control system implemented for the Grafana dashboards. The system provides role-based access control (RBAC) with four distinct user roles, each with specific permissions and dashboard access.

## User Roles and Permissions

### 1. Admin Role
- **Full dashboard access**: Can view, edit, and manage all dashboards
- **System configuration**: Can modify data sources, alerting rules, and system settings
- **User management**: Can create, modify, and delete user accounts
- **Team management**: Can create and manage teams and permissions
- **Default account**: admin / admin123secure!

### 2. Developer Role
- **System monitoring access**: Full access to System Monitoring dashboard
- **Real-time operations access**: Full access to Real-time Operations dashboard
- **Limited configuration**: Can modify panels and queries in assigned dashboards
- **No user management**: Cannot create or modify user accounts
- **Team members**: dev1, dev2, devops

### 3. Business Role
- **Analytics access**: Full access to User Engagement Analytics dashboard
- **Business intelligence access**: Full access to Business Intelligence dashboard
- **Export capabilities**: Can export data and generate reports
- **Limited configuration**: Can modify panels and queries in assigned dashboards
- **Team members**: pm (Product Manager), analyst (Business Analyst), exec (Executive)

### 4. Viewer Role
- **Read-only access**: Can view assigned dashboards but cannot edit
- **No configuration access**: Cannot modify any dashboard settings
- **Limited export**: Can export data but cannot modify queries
- **Team members**: viewer1, viewer2

## Team Structure

### Administrators Team
- **Members**: admin
- **Permissions**: Full access to all dashboards and system configuration
- **Dashboard Access**: All dashboards with edit permissions

### Developers Team
- **Members**: dev1, dev2, devops
- **Permissions**: Edit access to system and operational dashboards
- **Dashboard Access**:
  - System Monitoring (Edit)
  - Real-time Operations (Edit)
  - Other dashboards (View only)

### Business Users Team
- **Members**: pm, analyst, exec
- **Permissions**: Edit access to analytics and business dashboards
- **Dashboard Access**:
  - User Engagement Analytics (Edit)
  - Business Intelligence (Edit)
  - Other dashboards (View only)

### Viewers Team
- **Members**: viewer1, viewer2
- **Permissions**: Read-only access to assigned dashboards
- **Dashboard Access**: All dashboards (View only)

## Dashboard Permissions Matrix

| Dashboard | Admin | Developers | Business | Viewers |
|-----------|-------|------------|----------|---------|
| System Monitoring | Edit | Edit | View | View |
| User Engagement Analytics | Edit | View | Edit | View |
| Business Intelligence | Edit | View | Edit | View |
| Real-time Operations | Edit | Edit | View | View |

**Permission Levels:**
- **Edit (2)**: Can view, edit, and save dashboard changes
- **View (1)**: Can view dashboard but cannot make changes

## Setup Instructions

### 1. Automatic Setup
Run the automated setup script to create all users, teams, and permissions:

```bash
cd monitoring/grafana
./setup-user-roles.sh
```

This script will:
- Create all user accounts with default passwords
- Create teams and assign users
- Configure dashboard permissions
- Test role-based access
- Generate a credentials report

### 2. Manual Setup (Alternative)

If you prefer manual setup, follow these steps:

#### Create Users via Grafana UI
1. Access Grafana at http://localhost:3001
2. Login as admin (admin / admin123secure!)
3. Go to Configuration > Users
4. Create users according to the roles defined above

#### Create Teams
1. Go to Configuration > Teams
2. Create the four teams: Administrators, Developers, Business Users, Viewers
3. Add users to appropriate teams

#### Configure Dashboard Permissions
1. Go to each dashboard
2. Click on Dashboard Settings (gear icon)
3. Go to Permissions tab
4. Add team permissions according to the matrix above

### 3. Verification

After setup, verify the configuration:

```bash
# Test developer access
curl -u "dev1:dev123!" "http://localhost:3001/api/search?type=dash-db"

# Test business user access
curl -u "pm:pm123!" "http://localhost:3001/api/search?type=dash-db"

# Test viewer access
curl -u "viewer1:viewer123!" "http://localhost:3001/api/search?type=dash-db"
```

## User Account Details

### Development Team
- **dev1** / dev123! - Developer 1
- **dev2** / dev123! - Developer 2  
- **devops** / devops123! - DevOps Engineer

### Business Team
- **pm** / pm123! - Product Manager
- **analyst** / analyst123! - Business Analyst
- **exec** / exec123! - Executive (Viewer role)

### Viewers
- **viewer1** / viewer123! - General Viewer 1
- **viewer2** / viewer123! - General Viewer 2

## Security Considerations

### Password Policy
- All default passwords should be changed on first login
- Implement regular password rotation (recommended: every 90 days)
- Use strong passwords with minimum 8 characters, including numbers and special characters

### Session Management
- Session timeout is configured to 7 days of inactivity
- Maximum session lifetime is 30 days
- Token rotation occurs every 10 minutes for active sessions

### Access Control
- User registration is disabled to prevent unauthorized access
- Role-based permissions are enforced at the dashboard level
- API access is restricted based on user roles

### Audit and Monitoring
- User login activities are logged
- Dashboard access is tracked
- Permission changes are audited

## Troubleshooting

### Common Issues

#### Users Cannot Access Dashboards
1. Verify user is assigned to correct team
2. Check dashboard permissions for the team
3. Ensure user has correct role assignment

#### Permission Denied Errors
1. Check if user role matches required permission level
2. Verify team membership
3. Review dashboard-specific permissions

#### Script Execution Failures
1. Ensure Grafana is running and accessible
2. Verify admin credentials are correct
3. Check if jq is installed for JSON processing

### API Endpoints for Troubleshooting

```bash
# List all users
curl -u "admin:admin123secure!" "http://localhost:3001/api/users"

# List all teams
curl -u "admin:admin123secure!" "http://localhost:3001/api/teams/search"

# Get dashboard permissions
curl -u "admin:admin123secure!" "http://localhost:3001/api/dashboards/uid/{dashboard-uid}/permissions"
```

## Maintenance

### Regular Tasks
- Review user access quarterly
- Update passwords according to security policy
- Audit team memberships and permissions
- Monitor dashboard usage and access patterns

### Adding New Users
1. Create user account with appropriate role
2. Add to relevant team
3. Test access to assigned dashboards
4. Update documentation

### Modifying Permissions
1. Update team permissions for dashboard access
2. Test changes with affected users
3. Document permission changes
4. Notify affected users of changes

## Integration with External Systems

### LDAP/Active Directory (Future Enhancement)
The current setup uses local Grafana users. For enterprise environments, consider integrating with:
- LDAP for centralized user management
- Active Directory for Windows environments
- OAuth providers (Google, GitHub, etc.)

### API Integration
User management can be automated through Grafana's REST API:
- User creation and management
- Team assignment
- Permission configuration
- Bulk operations

## Backup and Recovery

### Configuration Backup
- Export user configurations regularly
- Backup team definitions
- Save dashboard permissions
- Document custom role configurations

### Recovery Procedures
- Restore from configuration backups
- Re-run setup scripts if needed
- Verify permissions after recovery
- Test user access post-recovery