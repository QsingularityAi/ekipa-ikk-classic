# App Engagement Intelligence API Documentation

## Overview

The App Engagement Intelligence system provides RESTful APIs for managing user engagement, analytics, and compliance. This document describes all available endpoints, request/response formats, and authentication requirements.

**Base URL:** `https://api.ikk-classic.de/engagement/v1`

**Authentication:** Bearer token (JWT) required for all endpoints except health checks.

## Table of Contents

1. [Authentication](#authentication)
2. [Health & Monitoring](#health--monitoring)
3. [User Events](#user-events)
4. [Analytics](#analytics)
5. [Interventions](#interventions)
6. [Compliance](#compliance)
7. [Error Handling](#error-handling)
8. [Rate Limiting](#rate-limiting)

## Authentication

### POST /auth/login

Authenticate user and receive JWT token.

**Request:**
```json
{
  "username": "string",
  "password": "string"
}
```

**Response:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresIn": "24h",
  "user": {
    "id": "string",
    "username": "string",
    "role": "admin|analyst|viewer"
  }
}
```

### POST /auth/refresh

Refresh JWT token.

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresIn": "24h"
}
```

## Health & Monitoring

### GET /health

System health check (no authentication required).

**Response:**
```json
{
  "status": "healthy|unhealthy",
  "timestamp": "2024-01-15T10:30:00Z",
  "version": "1.0.0",
  "components": {
    "database": "healthy|unhealthy",
    "redis": "healthy|unhealthy",
    "externalServices": "healthy|unhealthy"
  },
  "uptime": 3600
}
```

### GET /metrics

Prometheus metrics endpoint (no authentication required).

**Response:** Prometheus format metrics

## User Events

### POST /events

Submit user interaction events.

**Headers:**
```
Authorization: Bearer <token>
Content-Type: application/json
```

**Request:**
```json
{
  "events": [
    {
      "eventId": "evt_123456",
      "userId": "user_789",
      "sessionId": "session_abc",
      "timestamp": "2024-01-15T10:30:00Z",
      "eventType": "page_view|feature_usage|task_completion|abandonment",
      "metadata": {
        "screenName": "dashboard",
        "featureId": "claims_view",
        "duration": 30000,
        "success": true
      },
      "userContext": {
        "ageGroup": "31-40",
        "digitalLiteracyScore": 7,
        "preferredChannel": "push"
      }
    }
  ]
}
```

**Response:**
```json
{
  "processed": 1,
  "failed": 0,
  "errors": []
}
```

### GET /events/{userId}

Retrieve user events (with privacy controls).

**Headers:**
```
Authorization: Bearer <token>
```

**Query Parameters:**
- `startDate` (optional): ISO 8601 date string
- `endDate` (optional): ISO 8601 date string
- `eventType` (optional): Filter by event type
- `limit` (optional): Maximum number of events (default: 100, max: 1000)
- `offset` (optional): Pagination offset

**Response:**
```json
{
  "events": [
    {
      "eventId": "evt_123456",
      "userId": "pseudo_abc123",
      "sessionId": "session_xyz",
      "timestamp": "2024-01-15T10:30:00Z",
      "eventType": "page_view",
      "metadata": {
        "screenName": "dashboard",
        "duration": 30000
      }
    }
  ],
  "pagination": {
    "total": 150,
    "limit": 100,
    "offset": 0,
    "hasMore": true
  }
}
```

## Analytics

### GET /analytics/dashboard

Get dashboard analytics data.

**Headers:**
```
Authorization: Bearer <token>
```

**Query Parameters:**
- `timeRange`: `1h|24h|7d|30d|90d`
- `metrics`: Comma-separated list of metrics to include

**Response:**
```json
{
  "timeRange": "24h",
  "metrics": {
    "totalUsers": 1250,
    "activeUsers": 890,
    "engagementRate": 0.712,
    "digitalAdoptionRate": 0.456,
    "interventionsDelivered": 234,
    "conversionRate": 0.123
  },
  "trends": {
    "userGrowth": 0.05,
    "engagementTrend": 0.12,
    "adoptionTrend": 0.08
  },
  "segmentBreakdown": {
    "22-30": { "users": 200, "engagement": 0.85 },
    "31-40": { "users": 350, "engagement": 0.72 },
    "41-55": { "users": 400, "engagement": 0.65 },
    "56-65": { "users": 250, "engagement": 0.45 },
    "66+": { "users": 50, "engagement": 0.25 }
  }
}
```

### GET /analytics/user-segments

Get user segmentation data.

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "segments": [
    {
      "segmentId": "high_engagement_young",
      "name": "High Engagement Young Adults",
      "criteria": {
        "ageRange": [22, 40],
        "engagementLevel": "high",
        "digitalLiteracy": "advanced"
      },
      "userCount": 450,
      "averageEngagement": 0.85,
      "topFeatures": ["mobile_claims", "digital_documents", "chat_support"]
    }
  ]
}
```

### GET /analytics/interventions

Get intervention effectiveness analytics.

**Headers:**
```
Authorization: Bearer <token>
```

**Query Parameters:**
- `timeRange`: `1h|24h|7d|30d|90d`
- `interventionType`: Filter by intervention type

**Response:**
```json
{
  "interventions": [
    {
      "interventionId": "nudge_claim_completion",
      "type": "nudge",
      "totalSent": 1000,
      "delivered": 950,
      "opened": 680,
      "clicked": 340,
      "converted": 85,
      "metrics": {
        "deliveryRate": 0.95,
        "openRate": 0.716,
        "clickRate": 0.5,
        "conversionRate": 0.25
      },
      "costSavings": {
        "estimatedCallsAvoided": 42,
        "timeSavedMinutes": 1260,
        "costSavedEur": 315.0
      }
    }
  ]
}
```

## Interventions

### POST /interventions

Create and deliver intervention.

**Headers:**
```
Authorization: Bearer <token>
Content-Type: application/json
```

**Request:**
```json
{
  "userId": "user_123",
  "strategyId": "nudge_claim_completion",
  "channels": ["push", "email"],
  "content": {
    "title": "Complete Your Claim",
    "message": "You're almost done! Complete your claim in just 2 steps.",
    "actionButton": "Continue Claim",
    "personalizedElements": {
      "userName": "Max",
      "claimType": "Dental"
    }
  },
  "scheduling": {
    "deliverAt": "2024-01-15T14:00:00Z",
    "expiresAt": "2024-01-16T14:00:00Z"
  }
}
```

**Response:**
```json
{
  "interventionId": "int_789456",
  "status": "scheduled|delivered|failed",
  "deliveryDetails": [
    {
      "channel": "push",
      "status": "delivered",
      "deliveredAt": "2024-01-15T14:00:05Z",
      "deliveryId": "push_123"
    }
  ]
}
```

### GET /interventions/{interventionId}

Get intervention status and metrics.

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "interventionId": "int_789456",
  "userId": "pseudo_abc123",
  "status": "delivered",
  "createdAt": "2024-01-15T13:55:00Z",
  "deliveredAt": "2024-01-15T14:00:05Z",
  "channels": ["push", "email"],
  "metrics": {
    "delivered": true,
    "opened": true,
    "clicked": false,
    "converted": false,
    "openedAt": "2024-01-15T14:05:12Z"
  }
}
```

### POST /interventions/{interventionId}/response

Track user response to intervention.

**Headers:**
```
Authorization: Bearer <token>
Content-Type: application/json
```

**Request:**
```json
{
  "responseType": "opened|clicked|converted|dismissed",
  "timestamp": "2024-01-15T14:05:12Z",
  "metadata": {
    "channel": "push",
    "actionTaken": "claim_completed"
  }
}
```

**Response:**
```json
{
  "tracked": true,
  "interventionId": "int_789456",
  "responseType": "clicked"
}
```

## Compliance

### POST /compliance/consent

Manage user consent.

**Headers:**
```
Authorization: Bearer <token>
Content-Type: application/json
```

**Request:**
```json
{
  "userId": "user_123",
  "consentType": "analytics|personalization|marketing",
  "granted": true,
  "metadata": {
    "ipAddress": "192.168.1.1",
    "userAgent": "Mozilla/5.0...",
    "consentMethod": "explicit_opt_in"
  }
}
```

**Response:**
```json
{
  "consentId": "consent_456789",
  "userId": "user_123",
  "consentType": "analytics",
  "granted": true,
  "timestamp": "2024-01-15T10:30:00Z",
  "version": "1.0"
}
```

### GET /compliance/consent/{userId}

Get user consent status.

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "userId": "user_123",
  "consents": [
    {
      "consentType": "analytics",
      "granted": true,
      "timestamp": "2024-01-15T10:30:00Z",
      "version": "1.0"
    },
    {
      "consentType": "personalization",
      "granted": false,
      "timestamp": "2024-01-15T10:30:00Z",
      "version": "1.0"
    }
  ]
}
```

### DELETE /compliance/data/{userId}

Request user data deletion (GDPR Article 17).

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "deletionRequestId": "del_123456",
  "userId": "user_123",
  "status": "initiated",
  "estimatedCompletionTime": "2024-01-16T10:30:00Z"
}
```

### GET /compliance/audit-log

Get compliance audit log.

**Headers:**
```
Authorization: Bearer <token>
```

**Query Parameters:**
- `userId` (optional): Filter by user ID
- `action` (optional): Filter by action type
- `startDate` (optional): ISO 8601 date string
- `endDate` (optional): ISO 8601 date string
- `limit` (optional): Maximum number of entries (default: 100)

**Response:**
```json
{
  "auditEntries": [
    {
      "entryId": "audit_789",
      "userId": "pseudo_abc123",
      "action": "consent_granted",
      "timestamp": "2024-01-15T10:30:00Z",
      "details": {
        "consentType": "analytics",
        "ipAddress": "anonymized",
        "userAgent": "anonymized"
      }
    }
  ],
  "pagination": {
    "total": 500,
    "limit": 100,
    "offset": 0,
    "hasMore": true
  }
}
```

## Error Handling

All API endpoints return consistent error responses:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request parameters",
    "details": [
      {
        "field": "userId",
        "message": "User ID is required"
      }
    ],
    "timestamp": "2024-01-15T10:30:00Z",
    "requestId": "req_123456"
  }
}
```

### Error Codes

- `VALIDATION_ERROR` (400): Invalid request parameters
- `UNAUTHORIZED` (401): Authentication required or invalid token
- `FORBIDDEN` (403): Insufficient permissions
- `NOT_FOUND` (404): Resource not found
- `CONFLICT` (409): Resource conflict (e.g., duplicate consent)
- `RATE_LIMIT_EXCEEDED` (429): Too many requests
- `INTERNAL_ERROR` (500): Internal server error
- `SERVICE_UNAVAILABLE` (503): Service temporarily unavailable

## Rate Limiting

API endpoints are rate-limited to prevent abuse:

- **Default limit:** 100 requests per 15 minutes per IP address
- **Authenticated users:** 500 requests per 15 minutes per user
- **Admin users:** 1000 requests per 15 minutes per user

Rate limit headers are included in all responses:

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1642248600
```

When rate limit is exceeded, a 429 status code is returned:

```json
{
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Rate limit exceeded. Try again in 15 minutes.",
    "retryAfter": 900
  }
}
```

## SDK and Integration Examples

### JavaScript/TypeScript SDK

```typescript
import { EngagementIntelligenceClient } from '@ikk-classic/engagement-intelligence-sdk';

const client = new EngagementIntelligenceClient({
  baseUrl: 'https://api.ikk-classic.de/engagement/v1',
  apiKey: 'your-api-key'
});

// Submit user event
await client.events.submit({
  eventId: 'evt_123',
  userId: 'user_456',
  eventType: 'page_view',
  metadata: { screenName: 'dashboard' }
});

// Get analytics
const analytics = await client.analytics.getDashboard('24h');
```

### cURL Examples

```bash
# Submit user event
curl -X POST https://api.ikk-classic.de/engagement/v1/events \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "events": [{
      "eventId": "evt_123",
      "userId": "user_456",
      "eventType": "page_view",
      "metadata": {"screenName": "dashboard"}
    }]
  }'

# Get dashboard analytics
curl -X GET "https://api.ikk-classic.de/engagement/v1/analytics/dashboard?timeRange=24h" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Webhooks

The system supports webhooks for real-time notifications:

### Webhook Events

- `intervention.delivered`: Intervention successfully delivered
- `intervention.failed`: Intervention delivery failed
- `user.consent_changed`: User consent status changed
- `compliance.violation`: Compliance violation detected

### Webhook Payload

```json
{
  "eventType": "intervention.delivered",
  "timestamp": "2024-01-15T10:30:00Z",
  "data": {
    "interventionId": "int_123",
    "userId": "pseudo_abc123",
    "channel": "push",
    "deliveredAt": "2024-01-15T10:30:05Z"
  },
  "signature": "sha256=abc123..."
}
```

## Support

For API support and questions:
- **Documentation:** https://docs.ikk-classic.de/engagement-intelligence
- **Support Email:** api-support@ikk-classic.de
- **Status Page:** https://status.ikk-classic.de