# App Engagement Intelligence API - Your Guide to Better User Experiences

## Welcome! Let's Get You Started

Hey there! 👋 Welcome to the App Engagement Intelligence API. Think of this as your toolkit for understanding how users interact with your app and helping them have a better experience. Whether you're trying to figure out why people drop off at certain points or want to send them helpful nudges at just the right moment, we've got you covered.

This guide will walk you through everything you need to know to get up and running. Don't worry - we'll explain things in plain English and give you plenty of examples along the way.

**Where to find us:** `https://api.ikk-classic.de/engagement/v1`

**Security note:** You'll need a Bearer token (JWT) for most things here - think of it as your API key that proves you're allowed to access the data. The only exception is our health check endpoint, which is open for everyone to make sure everything's running smoothly.

## What You'll Find Here

Think of this as your roadmap through the API. We've organized everything so you can quickly jump to what you need:

1. [Getting Authenticated](#authentication) - How to prove you're you
2. [System Health](#health--monitoring) - Making sure everything's working
3. [User Events](#user-events) - Tracking what people do in your app
4. [Analytics](#analytics) - Making sense of all that data
5. [Interventions](#interventions) - Helping users at the right moment
6. [Compliance](#compliance) - Keeping everything legal and ethical
7. [When Things Go Wrong](#error-handling) - Troubleshooting guide
8. [Playing Nice](#rate-limiting) - Making sure everyone gets fair access

## Getting Authenticated

Before we dive into the fun stuff, let's get you authenticated. Think of this like getting a backstage pass - once you have it, you can access all the cool features.

### Log In and Get Your Access Token

Want to get started? Just send us your username and password, and we'll give you a special token that works like a temporary pass.

**What to send us:**

```json
{
  "username": "your_username_here",
  "password": "your_super_secret_password"
}
```

**What you'll get back:**

```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresIn": "24h",
  "user": {
    "id": "your_unique_id",
    "username": "your_username_here",
    "role": "admin|analyst|viewer"
  }
}
```

Pro tip: That token is good for 24 hours, so you don't need to log in constantly. Just keep it somewhere safe!

### Need a Fresh Token?

Your token is about to expire? No worries! Just use your current token to get a shiny new one. It's like renewing your library card.

**Just include your current token in the header:**

```http
Authorization: Bearer <your_current_token>
```

**And we'll send you back:**

```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresIn": "24h"
}
```

## System Health & Monitoring

Let's make sure everything's running smoothly! These endpoints help you (and us) keep an eye on the system.

### Check If We're Up and Running

This is like knocking on our door to see if anyone's home. You don't need any special permissions for this one - it's open to everyone.

**What you'll get back tells you how we're doing:**

```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00Z",
  "version": "1.0.0",
  "components": {
    "database": "healthy",
    "redis": "healthy", 
    "externalServices": "healthy"
  },
  "uptime": 3600
}
```

If something's not quite right, you might see "unhealthy" instead. Don't panic - we're probably already on it!

### System Metrics (For the Tech-Savvy)

If you're into Prometheus metrics and want to hook this up to your monitoring dashboard, this endpoint's for you. It gives you all the technical details about how our system is performing.

## User Events - The Heart of Everything

This is where the magic happens! Every tap, swipe, and click in your app can become valuable data that helps you understand your users better.

### Tell Us What Your Users Are Doing

Think of this as your app's way of saying "Hey, something interesting just happened!" Whether someone viewed a page, completed a task, or maybe got frustrated and left - we want to know about it.

**Here's how to send us events:**

You'll need to include your authorization token in the header:

```http
Authorization: Bearer <your_token>
Content-Type: application/json
```

**Then send us the juicy details:**

```json
{
  "events": [
    {
      "eventId": "evt_123456",
      "userId": "user_789", 
      "sessionId": "session_abc",
      "timestamp": "2024-01-15T10:30:00Z",
      "eventType": "page_view",
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

**We'll let you know how it went:**

```json
{
  "processed": 1,
  "failed": 0,
  "errors": []
}
```

**Event types you can track:**
- `page_view` - Someone looked at a screen
- `feature_usage` - They used a specific feature  
- `task_completion` - They finished something important
- `abandonment` - They left without finishing (happens to the best of us!)

### Want to Look Up Someone's Activity?

Sometimes you need to see what a user has been up to (don't worry, we keep privacy in mind!). Here's how to get their recent events.

**You'll need your token:**

```http
Authorization: Bearer <your_token>
```

**You can be picky about what you want to see:**

- `startDate` (optional): Only show events after this date (use ISO 8601 format)
- `endDate` (optional): Only show events before this date
- `eventType` (optional): Filter by a specific type of event
- `limit` (optional): How many events to return (default is 100, max is 1000)
- `offset` (optional): Skip this many events (useful for pagination)

**Here's what you'll get back:**

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

Notice how we pseudonymize the user ID? That's our way of protecting privacy while still giving you useful data.

## Analytics - Making Sense of It All

Now for the fun part! Let's turn all those events into insights that actually help you improve your app.

### Your Analytics Dashboard

This gives you the bird's-eye view of how things are going. Think of it as your app's health report card.

**You'll need your token:**

```http
Authorization: Bearer <your_token>
```

**Tell us what timeframe you're interested in:**

- `timeRange`: Choose from `1h`, `24h`, `7d`, `30d`, or `90d`
- `metrics`: Want specific metrics? Just list them separated by commas

**Here's the kind of insights you'll get:**

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

Pretty cool, right? You can see not just the numbers, but trends over time and how different age groups behave.

### Understanding Your User Groups

Ever wonder how different types of users behave? This endpoint breaks down your users into meaningful segments so you can understand patterns and tailor your approach.

**You'll need your token:**

```http
Authorization: Bearer <your_token>
```

**Here's what you'll discover about your user segments:**

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

This is super helpful for understanding who your power users are and what they love about your app!

### How Well Are Your Interventions Working?

Want to know if those helpful nudges and reminders are actually helping? This endpoint shows you which interventions are hitting the mark and which ones might need some tweaking.

**You'll need your token:**

```http
Authorization: Bearer <your_token>
```

**You can filter what you want to see:**

- `timeRange`: Pick from `1h`, `24h`, `7d`, `30d`, or `90d`
- `interventionType`: Focus on a specific type of intervention

**Here's the kind of performance data you'll get:**

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

Look at that! Not only can you see how well your interventions performed, but you can also see the real business impact - like how many support calls you avoided and how much time (and money) you saved.

## Interventions - Helping Users at Just the Right Moment

This is where you can send personalized, helpful messages to your users when they need them most. Think of it as being a helpful friend who knows exactly what to say and when to say it.

### Send a Helpful Intervention

Ready to help a user get unstuck or complete an important task? Here's how to create and send an intervention.

**You'll need your token:**

```http
Authorization: Bearer <your_token>
Content-Type: application/json
```

**Here's how to set up your intervention:**

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

**We'll tell you how it went:**

```json
{
  "interventionId": "int_789456",
  "status": "scheduled",
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

**Delivery status options:**
- `scheduled` - We've got it queued up
- `delivered` - Successfully sent!
- `failed` - Oops, something went wrong (we'll tell you what)

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

## Compliance - Keeping Everything Legal and Ethical

Privacy matters! This section helps you manage user consent and stay compliant with GDPR and other privacy regulations. We make it easy to do the right thing.

### Managing User Consent

When users give or update their consent preferences, this is how you let us know about it. Think of it as keeping a clear record of what users are comfortable with.

**You'll need your token:**

```http
Authorization: Bearer <your_token>
Content-Type: application/json
```

**Here's how to record consent:**

```json
{
  "userId": "user_123",
  "consentType": "analytics",
  "granted": true,
  "metadata": {
    "ipAddress": "192.168.1.1",
    "userAgent": "Mozilla/5.0...",
    "consentMethod": "explicit_opt_in"
  }
}
```

**Consent types you can track:**
- `analytics` - Can we analyze their usage patterns?
- `personalization` - Can we customize their experience?
- `marketing` - Can we send them promotional content?

**We'll confirm we've recorded it:**

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

### Check What a User Has Consented To

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

## When Things Go Wrong - Error Handling

Don't worry, we all make mistakes! When something doesn't go as planned, we'll give you a clear explanation of what happened and how to fix it.

**Here's what our error messages look like:**

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

### What Different Error Codes Mean

Think of these as our way of telling you specifically what went wrong:

- `VALIDATION_ERROR` (400): You sent us something we couldn't understand - check your request format
- `UNAUTHORIZED` (401): You need to log in or your token has expired
- `FORBIDDEN` (403): You're logged in, but you don't have permission for this action
- `NOT_FOUND` (404): We couldn't find what you're looking for
- `CONFLICT` (409): There's a conflict (like trying to create something that already exists)
- `RATE_LIMIT_EXCEEDED` (429): Whoa there! You're making requests too quickly
- `INTERNAL_ERROR` (500): Something's wrong on our end (we'll fix it!)
- `SERVICE_UNAVAILABLE` (503): We're temporarily down for maintenance

## Playing Nice - Rate Limiting

We want everyone to have a good experience, so we have some gentle limits on how many requests you can make:

**The rules:**
- **If you're not logged in:** 100 requests per 15 minutes per IP address
- **Regular users:** 500 requests per 15 minutes
- **Admin users:** 1000 requests per 15 minutes (you get the VIP treatment!)

**We'll always tell you where you stand:**

```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1642248600
```

**If you hit the limit, we'll let you know:**

```json
{
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Rate limit exceeded. Try again in 15 minutes.",
    "retryAfter": 900
  }
}
```

Just take a little break and you'll be good to go!

## Ready to Code? SDK and Examples

We've made it super easy for you to get started, no matter what tech stack you're using.

### Our JavaScript/TypeScript SDK (Recommended!)

This is probably the easiest way to get up and running:

```typescript
import { EngagementIntelligenceClient } from '@ikk-classic/engagement-intelligence-sdk';

const client = new EngagementIntelligenceClient({
  baseUrl: 'https://api.ikk-classic.de/engagement/v1',
  apiKey: 'your-api-key'
});

// Track what users are doing
await client.events.submit({
  eventId: 'evt_123',
  userId: 'user_456',
  eventType: 'page_view',
  metadata: { screenName: 'dashboard' }
});

// Get insights about your users
const analytics = await client.analytics.getDashboard('24h');
```

### Prefer cURL? We've Got You Covered

Sometimes you just want to test things out quickly. Here are some copy-paste examples:

```bash
# Send a user event
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

# Check your analytics dashboard
curl -X GET "https://api.ikk-classic.de/engagement/v1/analytics/dashboard?timeRange=24h" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Webhooks - Real-Time Updates

Want to know the moment something happens? Set up webhooks and we'll notify you instantly!

**We'll ping you about these events:**

- `intervention.delivered`: Your intervention was successfully delivered
- `intervention.failed`: Something went wrong with delivery (we'll tell you what)
- `user.consent_changed`: A user updated their privacy preferences
- `compliance.violation`: We detected a compliance issue that needs attention

**Here's what our webhook payload looks like:**

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

## Need Help?

We're here for you! Here's how to get support:

- **Documentation:** [https://docs.ikk-classic.de/engagement-intelligence](https://docs.ikk-classic.de/engagement-intelligence)
- **Support Email:** [api-support@ikk-classic.de](mailto:api-support@ikk-classic.de)
- **Status Page:** [https://status.ikk-classic.de](https://status.ikk-classic.de)

Happy coding! 🚀