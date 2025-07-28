# Getting Your Mobile App Connected - A Friendly Integration Guide

## What We're Going to Accomplish

Hey there! 👋 Ready to supercharge your mobile app with some smart analytics and user engagement features? This guide will walk you through connecting your app to our App Engagement Intelligence API so you can start understanding your users better and helping them have an amazing experience.

Think of this as adding a smart assistant to your app - one that notices what users do, learns from their behavior, and helps them succeed. The best part? We'll show you exactly how to set it up, step by step.

## How This All Works Together

Here's the simple flow of what happens:

```
Your Mobile App → Sends Events → Our API → Creates Insights → You See Beautiful Dashboards
     ↓
  User Interactions → Event Tracking → Smart Analysis → Helpful Visualizations
```

It's that straightforward! Users do things in your app, we capture those interactions (with their permission, of course), analyze the patterns, and give you actionable insights through gorgeous Grafana dashboards.

## Step 1: Getting Our SDK Into Your App

No matter what platform you're building on, we've got you covered! Pick your favorite technology and let's get started:

### React Native (The Popular Choice)

```bash
npm install @ikk-classic/engagement-intelligence-sdk
```

### Flutter (Cross-Platform Goodness)

```yaml
dependencies:
  engagement_intelligence_sdk: ^1.0.0
```

### Native iOS with Swift (Apple's Finest)

```swift
// Add this to your Package.swift file
.package(url: "https://github.com/ikk-classic/engagement-intelligence-ios-sdk", from: "1.0.0")
```

### Native Android with Kotlin (Google's Way)

```gradle
implementation 'de.ikk-classic:engagement-intelligence-android:1.0.0'
```

## Step 2: Setting Up Your Connection

Now let's configure your app to talk to our API. Here's how to do it for each platform:

### React Native Setup (Most Common)

```typescript
import { EngagementIntelligenceClient } from '@ikk-classic/engagement-intelligence-sdk';

const client = new EngagementIntelligenceClient({
  baseUrl: 'https://api.ikk-classic.de/engagement/v1',
  apiKey: process.env.ENGAGEMENT_API_KEY, // Keep this secret!
  batchSize: 10, // How many events to send at once
  flushInterval: 30000, // 30 seconds
  enableAutoTracking: true,
  debugMode: __DEV__
});
```

## 2. Event Tracking Implementation

### 2.1 Core Event Types for Mobile Apps

```typescript
// Screen/Page Views
client.trackEvent({
  eventType: 'page_view',
  metadata: {
    screenName: 'ClaimsListScreen',
    previousScreen: 'DashboardScreen',
    loadTime: 1200,
    navigationMethod: 'tab_navigation'
  }
});

// Feature Usage
client.trackEvent({
  eventType: 'feature_usage',
  metadata: {
    featureId: 'claim_submission',
    action: 'initiated',
    featureVersion: '2.1.0',
    accessMethod: 'main_menu'
  }
});

// Task Completion
client.trackEvent({
  eventType: 'task_completion',
  metadata: {
    taskId: 'claim_photo_upload',
    success: true,
    duration: 45000,
    steps_completed: 3,
    total_steps: 3,
    errors_encountered: 0
  }
});

// User Engagement
client.trackEvent({
  eventType: 'engagement',
  metadata: {
    action: 'scroll',
    element: 'claims_list',
    depth: 0.75,
    time_spent: 15000
  }
});
```

### 2.2 Mobile-Specific Context Data

```typescript
const mobileContext = {
  deviceInfo: {
    platform: 'iOS', // or 'Android'
    osVersion: '17.2',
    appVersion: '3.1.2',
    deviceModel: 'iPhone 15 Pro',
    screenSize: '393x852',
    connectionType: 'wifi' // or '4g', '5g', 'offline'
  },
  userContext: {
    ageGroup: '31-40',
    digitalLiteracyScore: 7,
    preferredChannel: 'push',
    notificationsEnabled: true,
    biometricEnabled: true
  },
  sessionContext: {
    sessionId: 'session_mobile_123',
    sessionStart: '2024-01-15T10:00:00Z',
    isFirstSession: false,
    previousSessionEnd: '2024-01-14T18:30:00Z'
  }
};
```

## 3. Automated Event Tracking

### 3.1 Screen Navigation Tracking

**React Native with React Navigation:**
```typescript
import { NavigationContainer } from '@react-navigation/native';

const navigationRef = useRef();

const onStateChange = (state) => {
  const currentScreen = getCurrentRouteName(state);
  const previousScreen = getPreviousRouteName(state);
  
  client.trackEvent({
    eventType: 'page_view',
    metadata: {
      screenName: currentScreen,
      previousScreen: previousScreen,
      navigationStack: getNavigationStack(state),
      timestamp: new Date().toISOString()
    }
  });
};

<NavigationContainer ref={navigationRef} onStateChange={onStateChange}>
  {/* Your navigation structure */}
</NavigationContainer>
```

### 3.2 Performance Tracking

```typescript
// App Launch Performance
const trackAppLaunch = () => {
  const launchTime = Date.now() - appStartTime;
  
  client.trackEvent({
    eventType: 'performance',
    metadata: {
      metric: 'app_launch_time',
      value: launchTime,
      coldStart: isColdStart,
      memoryUsage: getMemoryUsage(),
      batteryLevel: getBatteryLevel()
    }
  });
};

// API Response Times
const trackApiCall = async (endpoint, method) => {
  const startTime = Date.now();
  try {
    const response = await fetch(endpoint, { method });
    const duration = Date.now() - startTime;
    
    client.trackEvent({
      eventType: 'api_performance',
      metadata: {
        endpoint: endpoint,
        method: method,
        duration: duration,
        status: response.status,
        success: response.ok
      }
    });
    
    return response;
  } catch (error) {
    const duration = Date.now() - startTime;
    
    client.trackEvent({
      eventType: 'api_error',
      metadata: {
        endpoint: endpoint,
        method: method,
        duration: duration,
        error: error.message,
        networkStatus: getNetworkStatus()
      }
    });
    
    throw error;
  }
};
```

## 4. Grafana Dashboard Metrics

### 4.1 Key Mobile Metrics to Track

```typescript
// User Engagement Metrics
const engagementMetrics = {
  daily_active_users: 'COUNT(DISTINCT userId) WHERE timestamp >= NOW() - 24h',
  session_duration: 'AVG(session_end - session_start)',
  screen_views_per_session: 'AVG(screen_views) GROUP BY sessionId',
  feature_adoption_rate: 'COUNT(feature_usage) / COUNT(DISTINCT userId)',
  retention_rate: 'COUNT(returning_users) / COUNT(total_users)'
};

// Performance Metrics
const performanceMetrics = {
  app_launch_time: 'AVG(launch_time) WHERE metric = "app_launch_time"',
  api_response_time: 'AVG(duration) WHERE eventType = "api_performance"',
  crash_rate: 'COUNT(crashes) / COUNT(sessions)',
  error_rate: 'COUNT(errors) / COUNT(total_events)',
  offline_usage: 'COUNT(events) WHERE connectionType = "offline"'
};

// Business Metrics
const businessMetrics = {
  claim_completion_rate: 'COUNT(completed_claims) / COUNT(started_claims)',
  digital_adoption_score: 'AVG(digital_feature_usage) / AVG(total_feature_usage)',
  support_ticket_reduction: 'COUNT(support_tickets) - COUNT(previous_period_tickets)',
  user_satisfaction_score: 'AVG(rating) WHERE eventType = "feedback"'
};
```

### 4.2 Real-time Dashboard Queries

```json
{
  "dashboard": "Mobile App Analytics",
  "panels": [
    {
      "title": "Active Users (Real-time)",
      "query": "sum(rate(mobile_active_users_total[5m]))",
      "visualization": "stat"
    },
    {
      "title": "Screen Views by Platform",
      "query": "sum by (platform) (rate(mobile_screen_views_total[1h]))",
      "visualization": "pie_chart"
    },
    {
      "title": "App Performance",
      "query": "histogram_quantile(0.95, rate(mobile_app_launch_duration_seconds_bucket[5m]))",
      "visualization": "graph"
    },
    {
      "title": "Feature Usage Heatmap",
      "query": "sum by (feature_id, hour) (rate(mobile_feature_usage_total[1h]))",
      "visualization": "heatmap"
    }
  ]
}
```

## 5. Data Pipeline Configuration

### 5.1 Prometheus Metrics Export

Configure your API to expose metrics in Prometheus format:

```yaml
# prometheus.yml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'engagement-intelligence-api'
    static_configs:
      - targets: ['api.ikk-classic.de:9090']
    scrape_interval: 30s
    metrics_path: /metrics
    
  - job_name: 'mobile-app-metrics'
    static_configs:
      - targets: ['mobile-metrics-exporter:8080']
    scrape_interval: 15s
```

### 5.2 Custom Metrics for Mobile Events

```typescript
// Custom Prometheus metrics for mobile events
const mobileMetrics = {
  screen_views: new prometheus.Counter({
    name: 'mobile_screen_views_total',
    help: 'Total number of screen views',
    labelNames: ['screen_name', 'platform', 'app_version']
  }),
  
  feature_usage: new prometheus.Counter({
    name: 'mobile_feature_usage_total',
    help: 'Total feature usage count',
    labelNames: ['feature_id', 'platform', 'success']
  }),
  
  session_duration: new prometheus.Histogram({
    name: 'mobile_session_duration_seconds',
    help: 'Mobile app session duration',
    labelNames: ['platform', 'user_segment'],
    buckets: [30, 60, 300, 600, 1800, 3600]
  }),
  
  api_response_time: new prometheus.Histogram({
    name: 'mobile_api_response_duration_seconds',
    help: 'API response time from mobile app',
    labelNames: ['endpoint', 'method', 'status'],
    buckets: [0.1, 0.5, 1, 2, 5, 10]
  })
};
```

## 6. Implementation Best Practices

### 6.1 Event Batching and Offline Support

```typescript
class MobileEventTracker {
  private eventQueue: Event[] = [];
  private isOnline: boolean = true;
  
  constructor(private client: EngagementIntelligenceClient) {
    this.setupNetworkListener();
    this.setupPeriodicFlush();
  }
  
  trackEvent(event: Event) {
    // Add timestamp and mobile context
    const enrichedEvent = {
      ...event,
      timestamp: new Date().toISOString(),
      deviceContext: this.getDeviceContext(),
      networkStatus: this.getNetworkStatus()
    };
    
    this.eventQueue.push(enrichedEvent);
    
    // Immediate flush for critical events
    if (event.priority === 'high' && this.isOnline) {
      this.flushEvents();
    }
  }
  
  private async flushEvents() {
    if (this.eventQueue.length === 0 || !this.isOnline) return;
    
    const eventsToSend = this.eventQueue.splice(0, 50); // Batch size
    
    try {
      await this.client.events.submit({ events: eventsToSend });
    } catch (error) {
      // Re-queue events on failure
      this.eventQueue.unshift(...eventsToSend);
      console.error('Failed to send events:', error);
    }
  }
  
  private setupNetworkListener() {
    NetInfo.addEventListener(state => {
      this.isOnline = state.isConnected;
      if (this.isOnline && this.eventQueue.length > 0) {
        this.flushEvents();
      }
    });
  }
}
```

### 6.2 Privacy and Compliance

```typescript
class PrivacyCompliantTracker {
  private consentStatus: ConsentStatus = {};
  
  async trackEvent(event: Event) {
    // Check consent before tracking
    if (!this.hasConsent(event.eventType)) {
      console.log('Skipping event due to lack of consent:', event.eventType);
      return;
    }
    
    // Anonymize sensitive data
    const anonymizedEvent = this.anonymizeEvent(event);
    
    // Track with consent metadata
    await this.client.trackEvent({
      ...anonymizedEvent,
      consentMetadata: {
        analyticsConsent: this.consentStatus.analytics,
        personalizationConsent: this.consentStatus.personalization,
        consentVersion: '1.0'
      }
    });
  }
  
  private anonymizeEvent(event: Event): Event {
    // Remove or hash PII
    const anonymized = { ...event };
    
    if (anonymized.metadata?.userId) {
      anonymized.metadata.userId = this.hashUserId(anonymized.metadata.userId);
    }
    
    if (anonymized.metadata?.ipAddress) {
      delete anonymized.metadata.ipAddress;
    }
    
    return anonymized;
  }
}
```

## 7. Grafana Dashboard Setup

### 7.1 Mobile-Specific Dashboard Panels

```json
{
  "dashboard": {
    "title": "Mobile App Intelligence Dashboard",
    "panels": [
      {
        "title": "Real-time Active Users",
        "type": "stat",
        "targets": [
          {
            "expr": "sum(mobile_active_users)",
            "legendFormat": "Active Users"
          }
        ]
      },
      {
        "title": "Platform Distribution",
        "type": "piechart",
        "targets": [
          {
            "expr": "sum by (platform) (mobile_users_total)",
            "legendFormat": "{{platform}}"
          }
        ]
      },
      {
        "title": "Feature Adoption Funnel",
        "type": "bargauge",
        "targets": [
          {
            "expr": "sum by (feature_id) (mobile_feature_usage_total)",
            "legendFormat": "{{feature_id}}"
          }
        ]
      },
      {
        "title": "Session Duration Distribution",
        "type": "histogram",
        "targets": [
          {
            "expr": "histogram_quantile(0.50, mobile_session_duration_seconds_bucket)",
            "legendFormat": "50th percentile"
          },
          {
            "expr": "histogram_quantile(0.95, mobile_session_duration_seconds_bucket)",
            "legendFormat": "95th percentile"
          }
        ]
      }
    ]
  }
}
```

### 7.2 Alert Configuration

```yaml
# alerts.yml
groups:
  - name: mobile_app_alerts
    rules:
      - alert: HighCrashRate
        expr: rate(mobile_crashes_total[5m]) > 0.05
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: "High crash rate detected in mobile app"
          
      - alert: LowEngagementRate
        expr: rate(mobile_feature_usage_total[1h]) < 100
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "Low user engagement detected"
          
      - alert: APIResponseTimeHigh
        expr: histogram_quantile(0.95, rate(mobile_api_response_duration_seconds_bucket[5m])) > 2
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "API response time is high"
```

## 8. Testing and Validation

### 8.1 Integration Testing

```typescript
describe('Mobile Analytics Integration', () => {
  let tracker: MobileEventTracker;
  
  beforeEach(() => {
    tracker = new MobileEventTracker(mockClient);
  });
  
  test('should track screen view events', async () => {
    await tracker.trackScreenView('ClaimsListScreen');
    
    expect(mockClient.trackEvent).toHaveBeenCalledWith({
      eventType: 'page_view',
      metadata: {
        screenName: 'ClaimsListScreen',
        platform: 'iOS',
        timestamp: expect.any(String)
      }
    });
  });
  
  test('should batch events when offline', async () => {
    tracker.setNetworkStatus(false);
    
    await tracker.trackEvent({ eventType: 'feature_usage' });
    await tracker.trackEvent({ eventType: 'feature_usage' });
    
    expect(mockClient.trackEvent).not.toHaveBeenCalled();
    expect(tracker.getQueueSize()).toBe(2);
  });
});
```

### 8.2 Dashboard Validation

```bash
#!/bin/bash
# validate-dashboard-metrics.sh

echo "Validating mobile dashboard metrics..."

# Check if metrics are being received
curl -s "http://prometheus:9090/api/v1/query?query=mobile_active_users" | jq '.data.result | length'

# Validate dashboard panels
curl -s "http://grafana:3000/api/dashboards/uid/mobile-dashboard" \
  -H "Authorization: Bearer $GRAFANA_TOKEN" | jq '.dashboard.panels | length'

# Test alert rules
curl -s "http://prometheus:9090/api/v1/rules" | jq '.data.groups[] | select(.name=="mobile_app_alerts")'

echo "Validation complete!"
```

## 9. Monitoring and Maintenance

### 9.1 Health Checks

```typescript
// Mobile SDK health monitoring
class SDKHealthMonitor {
  async performHealthCheck(): Promise<HealthStatus> {
    const checks = await Promise.allSettled([
      this.checkAPIConnectivity(),
      this.checkEventQueueHealth(),
      this.checkStorageHealth(),
      this.checkNetworkStatus()
    ]);
    
    return {
      overall: checks.every(check => check.status === 'fulfilled') ? 'healthy' : 'unhealthy',
      details: {
        api: checks[0].status === 'fulfilled' ? 'healthy' : 'unhealthy',
        queue: checks[1].status === 'fulfilled' ? 'healthy' : 'unhealthy',
        storage: checks[2].status === 'fulfilled' ? 'healthy' : 'unhealthy',
        network: checks[3].status === 'fulfilled' ? 'healthy' : 'unhealthy'
      },
      timestamp: new Date().toISOString()
    };
  }
}
```

### 9.2 Performance Optimization

```typescript
// Optimize event tracking performance
class OptimizedEventTracker {
  private eventBuffer: Map<string, Event[]> = new Map();
  private compressionEnabled: boolean = true;
  
  trackEvent(event: Event) {
    // Group similar events for batching
    const eventKey = `${event.eventType}_${event.metadata?.screenName}`;
    
    if (!this.eventBuffer.has(eventKey)) {
      this.eventBuffer.set(eventKey, []);
    }
    
    this.eventBuffer.get(eventKey)!.push(event);
    
    // Flush when buffer reaches threshold
    if (this.eventBuffer.get(eventKey)!.length >= 10) {
      this.flushEventGroup(eventKey);
    }
  }
  
  private async flushEventGroup(eventKey: string) {
    const events = this.eventBuffer.get(eventKey) || [];
    this.eventBuffer.delete(eventKey);
    
    if (this.compressionEnabled) {
      const compressedEvents = this.compressEvents(events);
      await this.client.events.submit({ events: compressedEvents });
    } else {
      await this.client.events.submit({ events });
    }
  }
}
```

## 10. Troubleshooting Guide

### Common Integration Issues

1. **Events not appearing in Grafana**
   - Check API connectivity
   - Verify Prometheus scraping configuration
   - Ensure proper metric labeling

2. **High data usage**
   - Implement event batching
   - Enable compression
   - Filter non-essential events

3. **Performance impact**
   - Use background queues
   - Implement sampling for high-frequency events
   - Optimize payload size

4. **Privacy compliance**
   - Implement consent checking
   - Anonymize sensitive data
   - Regular compliance audits

This integration approach ensures comprehensive mobile app analytics while maintaining performance, privacy, and real-time visibility in your Grafana dashboards.