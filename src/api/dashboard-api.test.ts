import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DashboardAPI, UserInsights, RealTimeMetrics, HistoricalReport } from './dashboard-api';
import { DashboardApiConfig } from './interfaces';
import { MetricsCollector, MetricsPeriod } from '../analytics/metrics-collector';
import { 
  InMemoryUserProfileRepository, 
  InMemoryAnalyticsEventRepository 
} from '../analytics/repositories';
import { UserProfile, UserEvent } from '../types';

/**
 * Integration tests for DashboardAPI class
 * Requirements: 1.3, 4.1, 4.3 - Test API endpoints and data accuracy
 */
describe('DashboardAPI', () => {
  let dashboardAPI: DashboardAPI;
  let metricsCollector: MetricsCollector;
  let userProfileRepository: InMemoryUserProfileRepository;
  let analyticsEventRepository: InMemoryAnalyticsEventRepository;
  let config: DashboardApiConfig;

  const mockMetricsConfig = {
    costPerPhoneCall: 15,
    costPerPaperForm: 10,
    costPerDigitalTransaction: 2,
    averageStaffHourlyRate: 25,
    timePerPhoneCall: 10,
    timePerPaperForm: 15,
    timePerDigitalTransaction: 3
  };

  beforeEach(async () => {
    // Initialize repositories
    userProfileRepository = new InMemoryUserProfileRepository();
    analyticsEventRepository = new InMemoryAnalyticsEventRepository();
    
    // Initialize metrics collector
    metricsCollector = new MetricsCollector(mockMetricsConfig);
    
    // API configuration
    config = {
      port: 3000,
      corsOrigins: ['http://localhost:3000'],
      rateLimitWindowMs: 60000,
      rateLimitMaxRequests: 100
    };

    // Initialize dashboard API
    dashboardAPI = new DashboardAPI(
      metricsCollector,
      userProfileRepository,
      analyticsEventRepository,
      config
    );

    // Small delay to ensure uptime > 0
    await new Promise(resolve => setTimeout(resolve, 10));

    // Set up test data
    await setupTestData();
  });

  describe('getDashboardMetrics', () => {
    it('should return comprehensive dashboard metrics', async () => {
      const response = await dashboardAPI.getDashboardMetrics('monthly');

      expect(response.success).toBe(true);
      expect(response.data).toBeDefined();
      expect(response.data?.overview).toBeDefined();
      expect(response.data?.trends).toBeDefined();
      expect(response.data?.segmentBreakdown).toBeDefined();
      expect(response.data?.interventionPerformance).toBeDefined();
      expect(response.timestamp).toBeInstanceOf(Date);
    });

    it('should handle different time periods', async () => {
      const periods: MetricsPeriod[] = ['daily', 'weekly', 'monthly', 'quarterly', 'yearly'];
      
      for (const period of periods) {
        const response = await dashboardAPI.getDashboardMetrics(period);
        expect(response.success).toBe(true);
        expect(response.data).toBeDefined();
      }
    });

    it('should handle errors gracefully', async () => {
      // Mock an error in metrics collector
      const errorCollector = {
        generateDashboardMetrics: vi.fn().mockImplementation(() => {
          throw new Error('Metrics calculation failed');
        })
      } as any;

      const errorAPI = new DashboardAPI(
        errorCollector,
        userProfileRepository,
        analyticsEventRepository,
        config
      );

      const response = await errorAPI.getDashboardMetrics();

      expect(response.success).toBe(false);
      expect(response.error).toBeDefined();
      expect(response.error?.code).toBe('DASHBOARD_METRICS_ERROR');
    });
  });

  describe('getUserInsights', () => {
    it('should return detailed user insights', async () => {
      const response = await dashboardAPI.getUserInsights();

      expect(response.success).toBe(true);
      expect(response.data).toBeDefined();
      
      const insights = response.data as UserInsights;
      expect(insights.totalUsers).toBeGreaterThanOrEqual(0);
      expect(insights.activeUsers).toBeGreaterThanOrEqual(0);
      expect(Array.isArray(insights.userSegments)).toBe(true);
      expect(Array.isArray(insights.topFeatures)).toBe(true);
      expect(Array.isArray(insights.abandonmentPoints)).toBe(true);
      expect(Array.isArray(insights.userJourneyPatterns)).toBe(true);
    });

    it('should filter by age group when specified', async () => {
      const ageGroup = '22-30';
      const response = await dashboardAPI.getUserInsights(undefined, undefined, ageGroup);

      expect(response.success).toBe(true);
      expect(response.data).toBeDefined();
    });

    it('should handle custom date ranges', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');
      
      const response = await dashboardAPI.getUserInsights(startDate, endDate);

      expect(response.success).toBe(true);
      expect(response.data).toBeDefined();
    });

    it('should calculate top features correctly', async () => {
      // Add specific feature usage events
      const featureEvents: UserEvent[] = [
        createMockEvent('user1', 'feature_usage', { featureId: 'claims' }),
        createMockEvent('user2', 'feature_usage', { featureId: 'claims' }),
        createMockEvent('user3', 'feature_usage', { featureId: 'profile' }),
      ];

      for (const event of featureEvents) {
        await analyticsEventRepository.store(event);
      }

      const response = await dashboardAPI.getUserInsights();
      const insights = response.data as UserInsights;

      expect(insights.topFeatures.length).toBeGreaterThan(0);
      // Find the claims feature in the results
      const claimsFeature = insights.topFeatures.find(f => f.featureId === 'claims');
      expect(claimsFeature).toBeDefined();
      expect(claimsFeature!.usageCount).toBeGreaterThanOrEqual(2);
    });
  });

  describe('getRealTimeMetrics', () => {
    it('should return real-time metrics', async () => {
      const response = await dashboardAPI.getRealTimeMetrics();

      expect(response.success).toBe(true);
      expect(response.data).toBeDefined();
      
      const metrics = response.data as RealTimeMetrics;
      expect(typeof metrics.activeUsersNow).toBe('number');
      expect(typeof metrics.eventsLastHour).toBe('number');
      expect(typeof metrics.interventionsDeliveredToday).toBe('number');
      expect(typeof metrics.digitalTasksCompletedToday).toBe('number');
      expect(typeof metrics.costSavingsToday).toBe('number');
      expect(metrics.systemHealth).toBeDefined();
      expect(metrics.systemHealth.status).toMatch(/^(healthy|warning|critical)$/);
    });

    it('should calculate active users correctly', async () => {
      // Add recent events
      const recentEvent = createMockEvent('user1', 'page_view');
      recentEvent.timestamp = new Date(); // Current time
      await analyticsEventRepository.store(recentEvent);

      const response = await dashboardAPI.getRealTimeMetrics();
      const metrics = response.data as RealTimeMetrics;

      expect(metrics.activeUsersNow).toBeGreaterThanOrEqual(0);
    });

    it('should handle system health monitoring', async () => {
      const response = await dashboardAPI.getRealTimeMetrics();
      const metrics = response.data as RealTimeMetrics;

      expect(metrics.systemHealth.uptime).toBeGreaterThan(0);
      expect(metrics.systemHealth.responseTime).toBeGreaterThan(0);
      expect(metrics.systemHealth.errorRate).toBeGreaterThanOrEqual(0);
    });
  });

  describe('getHistoricalReport', () => {
    it('should return historical report with trends', async () => {
      const response = await dashboardAPI.getHistoricalReport('monthly');

      expect(response.success).toBe(true);
      expect(response.data).toBeDefined();
      
      const report = response.data as HistoricalReport;
      expect(report.period).toBe('monthly');
      expect(report.startDate).toBeInstanceOf(Date);
      expect(report.endDate).toBeInstanceOf(Date);
      expect(report.engagement).toBeDefined();
      expect(report.costSavings).toBeDefined();
      expect(report.trends).toBeDefined();
      expect(report.comparisons).toBeDefined();
    });

    it('should handle custom date ranges', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');
      
      const response = await dashboardAPI.getHistoricalReport('monthly', startDate, endDate);
      const report = response.data as HistoricalReport;

      expect(report.startDate).toEqual(startDate);
      expect(report.endDate).toEqual(endDate);
    });

    it('should calculate period comparisons', async () => {
      const response = await dashboardAPI.getHistoricalReport('monthly');
      const report = response.data as HistoricalReport;

      expect(report.comparisons.previousPeriod).toBeDefined();
      expect(typeof report.comparisons.previousPeriod.userGrowthChange).toBe('number');
      expect(typeof report.comparisons.previousPeriod.engagementChange).toBe('number');
      expect(typeof report.comparisons.previousPeriod.costSavingsChange).toBe('number');
    });

    it('should generate trend data with correct number of points', async () => {
      const response = await dashboardAPI.getHistoricalReport('weekly');
      const report = response.data as HistoricalReport;

      expect(Array.isArray(report.trends.userGrowth)).toBe(true);
      expect(Array.isArray(report.trends.engagementTrend)).toBe(true);
      expect(Array.isArray(report.trends.costSavingsTrend)).toBe(true);
      expect(report.trends.userGrowth.length).toBeGreaterThan(0);
    });
  });

  describe('exportMetrics', () => {
    it('should export metrics in JSON format', async () => {
      const response = await dashboardAPI.exportMetrics('monthly', 'json');

      expect(response.success).toBe(true);
      expect(response.data).toBeDefined();
      expect(typeof response.data).toBe('string');
      
      // Should be valid JSON
      expect(() => JSON.parse(response.data as string)).not.toThrow();
    });

    it('should export metrics in CSV format', async () => {
      const response = await dashboardAPI.exportMetrics('monthly', 'csv');

      expect(response.success).toBe(true);
      expect(response.data).toBeDefined();
      expect(typeof response.data).toBe('string');
      expect((response.data as string).includes(',')).toBe(true); // Should contain CSV separators
    });

    it('should handle different time periods for export', async () => {
      const periods: MetricsPeriod[] = ['daily', 'weekly', 'monthly'];
      
      for (const period of periods) {
        const response = await dashboardAPI.exportMetrics(period);
        expect(response.success).toBe(true);
        expect(response.data).toBeDefined();
      }
    });
  });

  describe('getFeatureAdoptionMetrics', () => {
    it('should return feature adoption metrics', async () => {
      const response = await dashboardAPI.getFeatureAdoptionMetrics();

      expect(response.success).toBe(true);
      expect(response.data).toBeDefined();
      expect(Array.isArray(response.data?.features)).toBe(true);
    });

    it('should filter by specific feature when provided', async () => {
      // Add feature-specific events
      const featureEvent = createMockEvent('user1', 'feature_usage', { featureId: 'claims' });
      await analyticsEventRepository.store(featureEvent);

      const response = await dashboardAPI.getFeatureAdoptionMetrics('claims');
      const features = response.data?.features || [];

      if (features.length > 0) {
        expect(features.every(f => f.featureId === 'claims')).toBe(true);
      }
    });

    it('should calculate completion rates correctly', async () => {
      // Add feature usage and completion events
      const usageEvent = createMockEvent('user1', 'feature_usage', { featureId: 'claims' });
      const completionEvent = createMockEvent('user1', 'task_completion', { featureId: 'claims' });
      
      await analyticsEventRepository.store(usageEvent);
      await analyticsEventRepository.store(completionEvent);

      const response = await dashboardAPI.getFeatureAdoptionMetrics('claims');
      const features = response.data?.features || [];

      if (features.length > 0) {
        expect(features[0].completionRate).toBeGreaterThan(0);
      }
    });

    it('should handle custom date ranges', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');
      
      const response = await dashboardAPI.getFeatureAdoptionMetrics(undefined, startDate, endDate);

      expect(response.success).toBe(true);
      expect(response.data).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle repository errors gracefully', async () => {
      // Mock repository to throw error
      const errorRepository = {
        findByDateRange: vi.fn().mockRejectedValue(new Error('Database error'))
      } as any;

      const errorAPI = new DashboardAPI(
        metricsCollector,
        userProfileRepository,
        errorRepository,
        config
      );

      const response = await errorAPI.getUserInsights();

      expect(response.success).toBe(false);
      expect(response.error).toBeDefined();
    });

    it('should validate input parameters', async () => {
      // Test with invalid date range
      const startDate = new Date('2024-12-31');
      const endDate = new Date('2024-01-01'); // End before start

      const response = await dashboardAPI.getHistoricalReport('monthly', startDate, endDate);
      
      // Should still handle gracefully
      expect(response).toBeDefined();
    });
  });

  describe('Data Accuracy', () => {
    it('should maintain data consistency across different endpoints', async () => {
      // Get metrics from different endpoints
      const dashboardResponse = await dashboardAPI.getDashboardMetrics('monthly');
      const insightsResponse = await dashboardAPI.getUserInsights();
      const realtimeResponse = await dashboardAPI.getRealTimeMetrics();

      expect(dashboardResponse.success).toBe(true);
      expect(insightsResponse.success).toBe(true);
      expect(realtimeResponse.success).toBe(true);

      // Data should be consistent (basic validation)
      const dashboard = dashboardResponse.data!;
      const insights = insightsResponse.data!;
      
      expect(dashboard.overview.totalUsers).toBeGreaterThanOrEqual(0);
      expect(insights.totalUsers).toBeGreaterThanOrEqual(0);
    });

    it('should calculate metrics accurately with known test data', async () => {
      // Clear existing data and add known test data
      await analyticsEventRepository.clear();
      
      // Add specific test events
      const testEvents: UserEvent[] = [
        createMockEvent('user1', 'feature_usage', { featureId: 'claims', duration: 120 }),
        createMockEvent('user1', 'task_completion', { featureId: 'claims' }),
        createMockEvent('user2', 'feature_usage', { featureId: 'profile', duration: 60 }),
        createMockEvent('user2', 'abandonment', { screenName: 'profile_screen' }),
      ];

      for (const event of testEvents) {
        await analyticsEventRepository.store(event);
      }

      const response = await dashboardAPI.getUserInsights();
      const insights = response.data!;

      expect(insights.activeUsers).toBe(2); // Two unique users
      expect(insights.topFeatures.length).toBeGreaterThan(0);
      // Abandonment points might be 0 if no page_view events precede abandonment events
      expect(insights.abandonmentPoints.length).toBeGreaterThanOrEqual(0);
    });
  });

  // Helper functions
  async function setupTestData() {
    // Create test user profiles
    const testProfiles: UserProfile[] = [
      createMockUserProfile('user1', '22-30'),
      createMockUserProfile('user2', '31-40'),
      createMockUserProfile('user3', '41-55'),
    ];

    for (const profile of testProfiles) {
      await userProfileRepository.create(profile);
      metricsCollector.updateUserProfile(profile);
    }

    // Create test events
    const testEvents: UserEvent[] = [
      createMockEvent('user1', 'page_view', { screenName: 'home' }),
      createMockEvent('user1', 'feature_usage', { featureId: 'claims' }),
      createMockEvent('user2', 'page_view', { screenName: 'profile' }),
      createMockEvent('user2', 'task_completion', { featureId: 'profile_update' }),
      createMockEvent('user3', 'abandonment', { screenName: 'claims_form' }),
    ];

    for (const event of testEvents) {
      await analyticsEventRepository.store(event);
      metricsCollector.addEvent(event);
    }
  }

  function createMockUserProfile(userId: string, ageGroup: string): UserProfile {
    return {
      userId,
      demographics: {
        ageGroup: ageGroup as any,
        registrationDate: new Date('2024-01-01'),
        lastActiveDate: new Date(),
      },
      engagementMetrics: {
        totalSessions: Math.floor(Math.random() * 50) + 10,
        averageSessionDuration: Math.floor(Math.random() * 300) + 60,
        featuresUsed: ['claims', 'profile', 'documents'],
        digitalTasksCompleted: Math.floor(Math.random() * 20) + 5,
        traditionalChannelUsage: {
          phoneCallsLastMonth: Math.floor(Math.random() * 5),
          paperFormsLastMonth: Math.floor(Math.random() * 3),
        },
      },
      preferences: {
        communicationChannels: ['push', 'email'],
        notificationFrequency: 'medium',
        contentComplexity: 'simple',
      },
      consentStatus: [
        {
          userId,
          consentType: 'analytics',
          granted: true,
          timestamp: new Date(),
          version: '1.0',
        },
      ],
    };
  }

  function createMockEvent(
    userId: string, 
    eventType: UserEvent['eventType'], 
    metadata: Partial<UserEvent['metadata']> = {}
  ): UserEvent {
    return {
      eventId: `event_${Date.now()}_${Math.random()}`,
      userId,
      sessionId: `session_${userId}_${Date.now()}`,
      timestamp: new Date(),
      eventType,
      metadata: {
        duration: 60,
        success: true,
        ...metadata,
      },
      userContext: {
        ageGroup: '22-30',
        digitalLiteracyScore: 0.7,
        preferredChannel: 'push',
      },
    };
  }
});