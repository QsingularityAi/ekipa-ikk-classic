# Grafana Dashboard Sharing and Permissions Guide

## Overview

This guide provides comprehensive instructions for configuring dashboard sharing and permissions in Grafana. It covers public dashboards, shareable links, team-based access, and security considerations.

## Dashboard Sharing Configuration

### 1. Public Dashboard Access

#### User Engagement Analytics Dashboard
- **Purpose**: Share business metrics with external stakeholders
- **Access Level**: Public (no authentication required)
- **Configuration**:
  1. Navigate to User Engagement Analytics dashboard
  2. Click Settings (gear icon) → Sharing
  3. Enable "Public dashboard"
  4. Configure time selection: Enabled
  5. Configure annotations: Disabled
  6. Generate public URL

**Public URL Format**: `http://localhost:3001/public-dashboards/{uid}`

#### Business Intelligence Dashboard
- **Purpose**: Share with business partners and executives
- **Access Level**: Limited public (time-restricted)
- **Configuration**:
  1. Create snapshot with 7-day expiration
  2. Enable external sharing
  3. Disable sensitive panels if needed

### 2. Team-Based Sharing

#### System Monitoring Dashboard
- **Target Audience**: Development team and system administrators
- **Access Control**:
  - Administrators: Full access (Admin permission)
  - Developers: Edit access (Editor permission)
  - Others: View only (Viewer permission)

**Configuration Steps**:
1. Go to Dashboard Settings → Permissions
2. Remove "Viewer" role default permission
3. Add team permissions:
   - Administrators team: Admin
   - Developers team: Edit
   - Viewers team: View

#### Real-time Operations Dashboard
- **Target Audience**: Operations team and on-call engineers
- **Access Control**:
  - Administrators: Full access
  - Developers: Edit access
  - Business Users: View only
  - External: No access

### 3. Shareable Links

#### Creating Shareable Links

**For Internal Sharing**:
```bash
# Create internal snapshot (24-hour expiration)
curl -X POST http://localhost:3001/api/snapshots \
  -H "Content-Type: application/json" \
  -u "admin:admin123secure!" \
  -d '{
    "dashboard": {"uid": "dashboard-uid"},
    "name": "Dashboard Snapshot",
    "expires": 86400,
    "external": false
  }'
```

**For External Sharing**:
```bash
# Create external snapshot (7-day expiration)
curl -X POST http://localhost:3001/api/snapshots \
  -H "Content-Type: application/json" \
  -u "admin:admin123secure!" \
  -d '{
    "dashboard": {"uid": "dashboard-uid"},
    "name": "External Dashboard Share",
    "expires": 604800,
    "external": true
  }'
```

#### Link Types and Use Cases

| Link Type | Duration | Use Case | Security Level |
|-----------|----------|----------|----------------|
| Internal Snapshot | 24 hours | Team collaboration | Medium |
| External Snapshot | 7 days | Stakeholder reviews | Low |
| Public Dashboard | Permanent | Public metrics | Lowest |
| Embedded Link | Permanent | Application integration | High |

## Permission Matrix

### Dashboard Access Permissions

| Dashboard | Admin | Developers | Business | Viewers | Public |
|-----------|-------|------------|----------|---------|--------|
| System Monitoring | Admin | Edit | View | View | No |
| User Engagement Analytics | Admin | View | Edit | View | Yes |
| Business Intelligence | Admin | View | Edit | View | Limited |
| Real-time Operations | Admin | Edit | View | View | No |

### Permission Levels Explained

- **Admin (1)**: Full dashboard access including settings, permissions, and deletion
- **Edit (2)**: Can modify panels, queries, and dashboard content
- **View (4)**: Read-only access to dashboard content

## Security Configuration

### 1. Public Dashboard Security

#### Data Sanitization
- Remove or anonymize sensitive data in public views
- Use aggregated metrics instead of raw data
- Implement time-based data filtering

#### Access Restrictions
```json
{
  "publicDashboard": {
    "annotationsEnabled": false,
    "timeSelectionEnabled": true,
    "shareUrl": "custom-url-path",
    "accessToken": "secure-random-token"
  }
}
```

### 2. Shareable Link Security

#### Time-Limited Access
- Internal links: 24-hour expiration
- External links: 7-day maximum
- Emergency links: 1-hour expiration

#### Revocation Mechanism
```bash
# Revoke shareable link
curl -X DELETE http://localhost:3001/api/snapshots/{snapshot-key} \
  -H "Authorization: Bearer {delete-key}"
```

### 3. Team-Based Security

#### Role Validation
- Regular team membership audits
- Automatic role expiration
- Multi-factor authentication for admin access

#### Permission Inheritance
```json
{
  "permissions": [
    {"role": "Admin", "permission": 1},
    {"teamId": 2, "permission": 2},
    {"userId": 123, "permission": 4}
  ]
}
```

## Implementation Steps

### Step 1: Configure Team Permissions

1. **Access Dashboard Settings**
   - Navigate to dashboard
   - Click Settings (gear icon)
   - Select "Permissions" tab

2. **Remove Default Permissions**
   - Remove "Viewer" role default access
   - This ensures explicit permission assignment

3. **Add Team Permissions**
   - Click "Add Permission"
   - Select team from dropdown
   - Assign appropriate permission level
   - Save changes

### Step 2: Create Public Dashboards

1. **Enable Public Access**
   - Go to Sharing tab in dashboard settings
   - Toggle "Public dashboard" option
   - Configure public dashboard settings

2. **Customize Public View**
   - Set time selection options
   - Disable annotations if needed
   - Configure theme (light/dark)

3. **Generate Public URL**
   - Copy generated public URL
   - Test access without authentication
   - Document URL for distribution

### Step 3: Generate Shareable Links

1. **Create Dashboard Snapshots**
   - Use Grafana API or UI
   - Set appropriate expiration time
   - Choose internal vs external sharing

2. **Distribute Links Securely**
   - Use secure communication channels
   - Include expiration information
   - Provide revocation instructions

### Step 4: Test Access Controls

1. **Verify Team Access**
   - Test with different user accounts
   - Confirm permission levels work correctly
   - Check dashboard visibility

2. **Test Public Access**
   - Access public URLs without authentication
   - Verify data visibility and restrictions
   - Test on different devices/networks

3. **Validate Shareable Links**
   - Test link accessibility
   - Verify expiration behavior
   - Test revocation mechanism

## Monitoring and Maintenance

### Access Monitoring

#### Audit Logging
- Enable Grafana audit logging
- Monitor dashboard access patterns
- Track permission changes

#### Usage Analytics
```bash
# Query dashboard access logs
grep "dashboard" /var/log/grafana/grafana.log | \
  grep -E "(view|edit|admin)" | \
  awk '{print $1, $2, $NF}' | \
  sort | uniq -c
```

### Regular Maintenance Tasks

#### Weekly Tasks
- [ ] Review active shareable links
- [ ] Check for expired snapshots
- [ ] Audit team memberships
- [ ] Monitor public dashboard usage

#### Monthly Tasks
- [ ] Rotate public dashboard tokens
- [ ] Review permission assignments
- [ ] Update security configurations
- [ ] Generate access reports

#### Quarterly Tasks
- [ ] Comprehensive security audit
- [ ] Update sharing policies
- [ ] Review external access needs
- [ ] Update documentation

## Troubleshooting

### Common Issues

#### Access Denied Errors
**Symptoms**: Users cannot access dashboards
**Solutions**:
1. Check team membership
2. Verify permission assignments
3. Clear browser cache
4. Check user role assignments

#### Public Dashboard Not Loading
**Symptoms**: Public URLs return errors
**Solutions**:
1. Verify public dashboard is enabled
2. Check URL format and parameters
3. Confirm dashboard exists and is published
4. Test with different browsers

#### Shareable Links Expired
**Symptoms**: Shared links no longer work
**Solutions**:
1. Check link expiration date
2. Generate new snapshot
3. Update distributed links
4. Implement automatic renewal

### Error Codes and Solutions

| Error Code | Description | Solution |
|------------|-------------|----------|
| 403 | Forbidden access | Check permissions and team membership |
| 404 | Dashboard not found | Verify dashboard UID and existence |
| 401 | Unauthorized | Check authentication and login status |
| 500 | Server error | Check Grafana logs and system health |

## API Reference

### Dashboard Permissions API

#### Get Dashboard Permissions
```bash
GET /api/dashboards/uid/{uid}/permissions
Authorization: Bearer {token}
```

#### Update Dashboard Permissions
```bash
POST /api/dashboards/uid/{uid}/permissions
Content-Type: application/json
Authorization: Bearer {token}

{
  "items": [
    {"role": "Admin", "permission": 1},
    {"teamId": 2, "permission": 2}
  ]
}
```

### Snapshot API

#### Create Snapshot
```bash
POST /api/snapshots
Content-Type: application/json
Authorization: Bearer {token}

{
  "dashboard": {"uid": "dashboard-uid"},
  "name": "Snapshot Name",
  "expires": 86400,
  "external": false
}
```

#### Delete Snapshot
```bash
DELETE /api/snapshots/{key}
Authorization: Bearer {delete-key}
```

### Public Dashboard API

#### Create Public Dashboard
```bash
POST /api/dashboards/uid/{uid}/public-dashboards
Content-Type: application/json
Authorization: Bearer {token}

{
  "isEnabled": true,
  "annotationsEnabled": false,
  "timeSelectionEnabled": true
}
```

## Best Practices

### Security Best Practices

1. **Principle of Least Privilege**
   - Grant minimum necessary permissions
   - Regular permission reviews
   - Time-limited access where possible

2. **Data Protection**
   - Sanitize sensitive data in public views
   - Use aggregated metrics
   - Implement data masking

3. **Access Control**
   - Multi-factor authentication for admins
   - Regular password rotation
   - Session timeout configuration

### Sharing Best Practices

1. **Link Management**
   - Use descriptive names for snapshots
   - Set appropriate expiration times
   - Document shared links

2. **Communication**
   - Clearly communicate access levels
   - Provide usage instructions
   - Include contact information for support

3. **Monitoring**
   - Track link usage
   - Monitor access patterns
   - Regular security audits

## Support and Contact

### Internal Support
- **System Administrator**: admin@company.com
- **Dashboard Team**: dashboard-support@company.com
- **IT Helpdesk**: it-support@company.com

### External Resources
- **Grafana Documentation**: https://grafana.com/docs/
- **Community Forum**: https://community.grafana.com/
- **Security Guidelines**: https://grafana.com/docs/grafana/latest/administration/security/

### Emergency Procedures

#### Security Incident Response
1. Immediately revoke compromised links
2. Disable public dashboards if needed
3. Review access logs
4. Contact security team
5. Document incident

#### System Recovery
1. Backup current configuration
2. Restore from known good state
3. Verify permissions and access
4. Test all sharing functionality
5. Update documentation

This guide provides comprehensive coverage of Grafana dashboard sharing and permissions configuration. Regular updates and reviews ensure continued security and effectiveness of the sharing system.