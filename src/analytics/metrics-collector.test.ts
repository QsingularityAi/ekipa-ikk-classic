import { describe, it, expect, beforeEach } from 'vitest';
import { MetricsCollector, MetricsConfig, InterventionMetrics } from './metrics-collector';
import { UserEvent, UserProfile } from '../types';

describe('MetricsCollector', () => {
  let metricsCollector: MetricsCollector;
  let mockConfig: MetricsConfig;
  let mockUserProfile: UserProfile;
  let mockUserEvent: UserEvent;

  beforeEach(() => {
    mockConfig = {
      costPerPhoneCall: 15.0,
      costPerPaperForm: 8.0,
      costPerDigitalTransaction: 2.0,
      averageStaffHourlyRate: 25.0,
      timePerPhoneCall: 10, // minutes
      timePerPaperForm: 15, // minutes
      timePerDigitalTransaction: 2, // minutes
    };

    metricsCollector = new MetricsCollector(mockConfig);

    mockUserProfile = {
      userId: 'user_123',
      demographics: {
        ageGroup: '31-40',
        registrationDate: new Date('2024-01-01'),
        lastActiveDate: new Date(),
      },
      engagementMetrics: {
        totalSessions: 10,
        averageSessionDuration: 300, // 5 minutes
        featuresUsed: ['dashboard', 'claims', 'documents'],
        digitalTasksCompleted: 5,
        traditionalChannelUsage: {
          phoneCallsLastMonth: 2,
          paperFormsLastMonth: 1,
        },
      },
      preferences: {
        communicationChannels: ['push', 'email'],
        notificationFrequency: 'medium',
        contentComplexity: 'detailed',
      },
      consentStatus: [],
    };

    mockUserEvent = {
      eventId: 'event_123',
      userId: 'user_123',
      sessionId: 'session_123',
      timestamp: new Date(),
      eventType: 'task_completion',
      metadata: {
        screenName: 'claims',
        featureId: 'submit_claim',
        duration: 180,
        success: true,
      },
      userContext: {
        ageGroup: '31-40',
        digitalLiteracyScore: 0.8,
        preferredChannel: 'push',
      },
    };
  });

  describe('addEvent', () => {
    it('should add user event for metrics calculation', () => {
      metricsCollector.addEvent(mockUserEvent);
      
      const metrics = metricsCollector.calculateEngagementMetrics('daily');
      expect(metrics.activeUsers).toBe(1);
    });

    it('should handle multiple events from same user', () => {
      const event1 = { ...mockUserEvent, eventId: 'event_1' };
      const event2 = { ...mockUserEvent, eventId: 'event_2', eventType: 'feature_usage' as const };
      
      metricsCollector.addEvent(event1);
      metricsCollector.addEvent(event2);
      
      const metrics = metricsCollector.calculateEngagementMetrics('daily');
      expect(metrics.activeUsers).toBe(1); // Same user, so still 1 active user
    });

    it('should handle events from different users', () => {
      const event1 = { ...mockUserEvent, userId: 'user_1' };
      const event2 = { ...mockUserEvent, userId: 'user_2' };
      
      metricsCollector.addEvent(event1);
      metricsCollector.addEvent(event2);
      
      const metrics = metricsCollector.calculateEngagementMetrics('daily');
      expect(metrics.activeUsers).toBe(2);
    });
  });

  describe('updateUserProfile', () => {
    it('should update user profile data', () => {
      metricsCollector.updateUserProfile(mockUserProfile);
      
      const metrics = metricsCollector.calculateEngagementMetrics('daily');
      expect(metrics.totalUsers).toBe(1);
    });

    it('should handle multiple user profiles', () => {
      const profile1 = { ...mockUserProfile, userId: 'user_1' };
      const profile2 = { ...mockUserProfile, userId: 'user_2' };
      
      metricsCollector.updateUserProfile(profile1);
      metricsCollector.updateUserProfile(profile2);
      
      const metrics = metricsCollector.calculateEngagementMetrics('daily');
      expect(metrics.totalUsers).toBe(2);
    });

    it('should update existing user profile', () => {
      metricsCollector.updateUserProfile(mockUserProfile);
      
      const updatedProfile = {
        ...mockUserProfile,
        engagementMetrics: {
          ...mockUserProfile.engagementMetrics,
          totalSessions: 20,
        },
      };
      
      metricsCollector.updateUserProfile(updatedProfile);
      
      const metrics = metricsCollector.calculateEngagementMetrics('daily');
      expect(metrics.totalUsers).toBe(1); // Still same user
    });
  });

  describe('recordInterventionMetrics', () => {
    it('should record intervention performance data', () => {
      const interventionMetrics: InterventionMetrics = {
        interventionId: 'intervention_123',
        type: 'nudge',
        channel: 'push',
        performance: {
          sent: 100,
          delivered: 95,
          opened: 60,
          clicked: 30,
          converted: 15,
          deliveryRate: 0.95,
          openRate: 0.63,
          clickThroughRate: 0.5,
          conversionRate: 0.5,
        },
        segmentPerformance: {
          'segment_1': {
            sent: 50,
            converted: 8,
            conversionRate: 0.16,
          },
        },
        costEffectiveness: {
          costPerIntervention: 1.0,
          costPerConversion: 6.67,
          returnOnInvestment: 2.5,
        },
      };

      metricsCollector.recordInterventionMetrics(interventionMetrics);
      
      const dashboardMetrics = metricsCollector.generateDashboardMetrics();
      expect(dashboardMetrics.interventionPerformance).toHaveLength(1);
      expect(dashboardMetrics.interventionPerformance[0].interventionId).toBe('intervention_123');
    });
  });

  describe('calculateEngagementMetrics', () => {
    beforeEach(() => {
      // Set up test data
      metricsCollector.updateUserProfile(mockUserProfile);
      metricsCollector.addEvent(mockUserEvent);
      
      // Add feature usage event
      const featureEvent = {
        ...mockUserEvent,
        eventId: 'feature_event',
        eventType: 'feature_usage' as const,
        metadata: {
          ...mockUserEvent.metadata,
          featureId: 'dashboard',
        },
      };
      metricsCollector.addEvent(featureEvent);
    });

    it('should calculate basic engagement metrics', () => {
      const metrics = metricsCollector.calculateEngagementMetrics('daily');
      
      expect(metrics.totalUsers).toBe(1);
      expect(metrics.activeUsers).toBe(1);
      expect(metrics.digitalAdoptionRate).toBe(1); // User has digital tasks completed
      expect(metrics.averageSessionDuration).toBeGreaterThan(0);
    });

    it('should calculate feature usage rates', () => {
      const metrics = metricsCollector.calculateEngagementMetrics('daily');
      
      expect(metrics.featureUsageRates).toBeDefined();
      expect(metrics.featureUsageRates['dashboard']).toBe(1); // 1 usage / 1 active user
    });

    it('should calculate task completion rates', () => {
      const metrics = metricsCollector.calculateEngagementMetrics('daily');
      
      expect(metrics.taskCompletionRates).toBeDefined();
      expect(metrics.taskCompletionRates['submit_claim']).toBe(1); // 1 completion / 1 attempt
    });

    it('should handle empty data gracefully', () => {
      const emptyCollector = new MetricsCollector(mockConfig);
      const metrics = emptyCollector.calculateEngagementMetrics('daily');
      
      expect(metrics.totalUsers).toBe(0);
      expect(metrics.activeUsers).toBe(0);
      expect(metrics.digitalAdoptionRate).toBe(0);
      expect(metrics.averageSessionDuration).toBe(0);
    });

    it('should calculate metrics for different time periods', () => {
      const dailyMetrics = metricsCollector.calculateEngagementMetrics('daily');
      const weeklyMetrics = metricsCollector.calculateEngagementMetrics('weekly');
      const monthlyMetrics = metricsCollector.calculateEngagementMetrics('monthly');
      
      expect(dailyMetrics).toBeDefined();
      expect(weeklyMetrics).toBeDefined();
      expect(monthlyMetrics).toBeDefined();
      
      // All should have same active users since events are recent
      expect(dailyMetrics.activeUsers).toBe(weeklyMetrics.activeUsers);
      expect(weeklyMetrics.activeUsers).toBe(monthlyMetrics.activeUsers);
    });
  });

  describe('calculateCostSavingsMetrics', () => {
    beforeEach(() => {
      // Set up user profiles with traditional channel usage
      const profile1 = {
        ...mockUserProfile,
        userId: 'user_1',
        engagementMetrics: {
          ...mockUserProfile.engagementMetrics,
          digitalTasksCompleted: 10,
          traditionalChannelUsage: {
            phoneCallsLastMonth: 5,
            paperFormsLastMonth: 3,
          },
        },
      };
      
      const profile2 = {
        ...mockUserProfile,
        userId: 'user_2',
        engagementMetrics: {
          ...mockUserProfile.engagementMetrics,
          digitalTasksCompleted: 5,
          traditionalChannelUsage: {
            phoneCallsLastMonth: 2,
            paperFormsLastMonth: 1,
          },
        },
      };

      metricsCollector.updateUserProfile(profile1);
      metricsCollector.updateUserProfile(profile2);

      // Add task completion events
      for (let i = 0; i < 15; i++) {
        const event = {
          ...mockUserEvent,
          eventId: `event_${i}`,
          userId: i < 10 ? 'user_1' : 'user_2',
          eventType: 'task_completion' as const,
        };
        metricsCollector.addEvent(event);
      }
    });

    it('should calculate digital channel adoption metrics', () => {
      const metrics = metricsCollector.calculateCostSavingsMetrics('monthly');
      
      expect(metrics.digitalChannelAdoption).toBeDefined();
      expect(metrics.digitalChannelAdoption.digitalTransactions).toBe(15);
      expect(metrics.digitalChannelAdoption.digitalAdoptionRate).toBeGreaterThan(0);
      expect(metrics.digitalChannelAdoption.totalCostSavings).toBeGreaterThan(0);
    });

    it('should calculate processing time reduction', () => {
      const metrics = metricsCollector.calculateCostSavingsMetrics('monthly');
      
      expect(metrics.processingTimeReduction).toBeDefined();
      expect(metrics.processingTimeReduction.averageDigitalProcessingTime).toBe(mockConfig.timePerDigitalTransaction);
      expect(metrics.processingTimeReduction.averageTraditionalProcessingTime).toBeGreaterThan(mockConfig.timePerDigitalTransaction);
      expect(metrics.processingTimeReduction.totalTimeSavings).toBeGreaterThan(0);
    });

    it('should calculate staff productivity gains', () => {
      const metrics = metricsCollector.calculateCostSavingsMetrics('monthly');
      
      expect(metrics.staffProductivityGains).toBeDefined();
      expect(metrics.staffProductivityGains.routineTasksAutomated).toBe(15);
      expect(metrics.staffProductivityGains.timeFreedForComplexTasks).toBeGreaterThan(0);
      expect(metrics.staffProductivityGains.productivityImprovementPercentage).toBeGreaterThan(0);
    });

    it('should handle zero traditional transactions', () => {
      const emptyCollector = new MetricsCollector(mockConfig);
      const metrics = emptyCollector.calculateCostSavingsMetrics('monthly');
      
      expect(metrics.digitalChannelAdoption.digitalAdoptionRate).toBe(0);
      expect(metrics.digitalChannelAdoption.totalCostSavings).toBe(0);
    });
  });

  describe('generateDashboardMetrics', () => {
    beforeEach(() => {
      // Set up comprehensive test data
      metricsCollector.updateUserProfile(mockUserProfile);
      metricsCollector.addEvent(mockUserEvent);
      
      const interventionMetrics: InterventionMetrics = {
        interventionId: 'top_intervention',
        type: 'nudge',
        channel: 'push',
        performance: {
          sent: 100,
          delivered: 95,
          opened: 60,
          clicked: 30,
          converted: 20,
          deliveryRate: 0.95,
          openRate: 0.63,
          clickThroughRate: 0.5,
          conversionRate: 0.67, // Highest conversion rate
        },
        segmentPerformance: {},
        costEffectiveness: {
          costPerIntervention: 1.0,
          costPerConversion: 5.0,
          returnOnInvestment: 3.0,
        },
      };
      
      metricsCollector.recordInterventionMetrics(interventionMetrics);
    });

    it('should generate comprehensive dashboard metrics', () => {
      const dashboard = metricsCollector.generateDashboardMetrics();
      
      expect(dashboard.overview).toBeDefined();
      expect(dashboard.trends).toBeDefined();
      expect(dashboard.segmentBreakdown).toBeDefined();
      expect(dashboard.interventionPerformance).toBeDefined();
    });

    it('should calculate overview metrics correctly', () => {
      const dashboard = metricsCollector.generateDashboardMetrics();
      
      expect(dashboard.overview.totalUsers).toBe(1);
      expect(dashboard.overview.digitalAdoptionRate).toBe(1);
      expect(dashboard.overview.topPerformingIntervention).toBe('top_intervention');
    });

    it('should generate trend data', () => {
      const dashboard = metricsCollector.generateDashboardMetrics();
      
      expect(dashboard.trends.userEngagementTrend).toBeInstanceOf(Array);
      expect(dashboard.trends.digitalAdoptionTrend).toBeInstanceOf(Array);
      expect(dashboard.trends.costSavingsTrend).toBeInstanceOf(Array);
      expect(dashboard.trends.callVolumeReductionTrend).toBeInstanceOf(Array);
      
      // Each trend should have data points
      expect(dashboard.trends.userEngagementTrend.length).toBeGreaterThan(0);
      expect(dashboard.trends.userEngagementTrend[0]).toHaveProperty('date');
      expect(dashboard.trends.userEngagementTrend[0]).toHaveProperty('value');
    });

    it('should calculate segment breakdown', () => {
      const dashboard = metricsCollector.generateDashboardMetrics();
      
      expect(dashboard.segmentBreakdown).toBeDefined();
      expect(dashboard.segmentBreakdown['31-40']).toBeDefined();
      expect(dashboard.segmentBreakdown['31-40'].userCount).toBe(1);
      expect(dashboard.segmentBreakdown['31-40'].digitalAdoptionRate).toBe(1);
    });

    it('should include intervention performance data', () => {
      const dashboard = metricsCollector.generateDashboardMetrics();
      
      expect(dashboard.interventionPerformance).toHaveLength(1);
      expect(dashboard.interventionPerformance[0].interventionId).toBe('top_intervention');
      expect(dashboard.interventionPerformance[0].performance.conversionRate).toBe(0.67);
    });
  });

  describe('exportMetricsData', () => {
    beforeEach(() => {
      metricsCollector.updateUserProfile(mockUserProfile);
      metricsCollector.addEvent(mockUserEvent);
    });

    it('should export metrics data in JSON format', () => {
      const jsonData = metricsCollector.exportMetricsData('monthly', 'json');
      
      expect(jsonData).toBeDefined();
      expect(() => JSON.parse(jsonData)).not.toThrow();
      
      const parsed = JSON.parse(jsonData);
      expect(parsed.period).toBe('monthly');
      expect(parsed.generatedAt).toBeDefined();
      expect(parsed.engagement).toBeDefined();
      expect(parsed.costSavings).toBeDefined();
      expect(parsed.dashboard).toBeDefined();
    });

    it('should export metrics data in CSV format', () => {
      const csvData = metricsCollector.exportMetricsData('monthly', 'csv');
      
      expect(csvData).toBeDefined();
      expect(csvData).toContain('Metric,Value');
      expect(csvData).toContain('Total Users');
      expect(csvData).toContain('Active Users');
      expect(csvData).toContain('Digital Adoption Rate');
      expect(csvData).toContain('Cost Savings');
    });

    it('should handle different time periods', () => {
      const dailyData = metricsCollector.exportMetricsData('daily');
      const weeklyData = metricsCollector.exportMetricsData('weekly');
      const monthlyData = metricsCollector.exportMetricsData('monthly');
      
      expect(dailyData).toBeDefined();
      expect(weeklyData).toBeDefined();
      expect(monthlyData).toBeDefined();
      
      const dailyParsed = JSON.parse(dailyData);
      const weeklyParsed = JSON.parse(weeklyData);
      const monthlyParsed = JSON.parse(monthlyData);
      
      expect(dailyParsed.period).toBe('daily');
      expect(weeklyParsed.period).toBe('weekly');
      expect(monthlyParsed.period).toBe('monthly');
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle events with missing metadata', () => {
      const incompleteEvent = {
        ...mockUserEvent,
        metadata: {},
      };
      
      metricsCollector.addEvent(incompleteEvent);
      
      const metrics = metricsCollector.calculateEngagementMetrics('daily');
      expect(metrics.activeUsers).toBe(1);
    });

    it('should handle users with no digital tasks completed', () => {
      const nonDigitalProfile = {
        ...mockUserProfile,
        engagementMetrics: {
          ...mockUserProfile.engagementMetrics,
          digitalTasksCompleted: 0,
        },
      };
      
      metricsCollector.updateUserProfile(nonDigitalProfile);
      
      const metrics = metricsCollector.calculateEngagementMetrics('daily');
      expect(metrics.digitalAdoptionRate).toBe(0);
    });

    it('should handle future dates gracefully', () => {
      const futureEvent = {
        ...mockUserEvent,
        timestamp: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
      };
      
      metricsCollector.addEvent(futureEvent);
      
      const metrics = metricsCollector.calculateEngagementMetrics('daily');
      expect(metrics.activeUsers).toBe(0); // Future event shouldn't count for today
    });

    it('should handle very old events', () => {
      const oldEvent = {
        ...mockUserEvent,
        timestamp: new Date('2020-01-01'),
      };
      
      metricsCollector.addEvent(oldEvent);
      
      const metrics = metricsCollector.calculateEngagementMetrics('daily');
      expect(metrics.activeUsers).toBe(0); // Old event shouldn't count for recent period
    });
  });
});