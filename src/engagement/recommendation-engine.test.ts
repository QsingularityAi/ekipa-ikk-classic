import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RecommendationEngine, InterventionRecommendation } from './recommendation-engine';
import { UserSegmentationEngine } from './user-segmentation-engine';
import { UserProfile, UserEvent, InterventionStrategy, UserSegment } from '../types';

describe('RecommendationEngine', () => {
  let recommendationEngine: RecommendationEngine;
  let mockSegmentationEngine: UserSegmentationEngine;
  let mockUserProfile: UserProfile;
  let mockUserSegment: UserSegment;

  beforeEach(() => {
    mockSegmentationEngine = new UserSegmentationEngine();
    recommendationEngine = new RecommendationEngine(mockSegmentationEngine);

    mockUserProfile = {
      userId: 'user123',
      demographics: {
        ageGroup: '31-40',
        registrationDate: new Date('2023-01-01'),
        lastActiveDate: new Date('2024-01-15')
      },
      engagementMetrics: {
        totalSessions: 15,
        averageSessionDuration: 180,
        featuresUsed: ['claims', 'benefits', 'profile'],
        digitalTasksCompleted: 8,
        traditionalChannelUsage: {
          phoneCallsLastMonth: 2,
          paperFormsLastMonth: 1
        }
      },
      preferences: {
        communicationChannels: ['email', 'in_app'],
        notificationFrequency: 'medium',
        contentComplexity: 'detailed'
      },
      consentStatus: [
        {
          userId: 'user123',
          consentType: 'analytics',
          granted: true,
          timestamp: new Date('2023-01-01'),
          version: '1.0'
        }
      ]
    };

    mockUserSegment = {
      segmentId: 'professional-medium-engagement',
      name: 'Professional Medium Engagement',
      criteria: {
        ageRange: [31, 55],
        engagementLevel: 'medium',
        preferredChannels: ['email', 'in_app'],
        digitalLiteracy: 'intermediate'
      },
      interventionStrategies: [
        {
          strategyId: 'nudge-reminder',
          type: 'nudge',
          trigger: {
            eventType: 'page_view',
            conditions: { screenName: 'dashboard' }
          },
          content: {
            title: 'Quick Tip',
            message: 'Did you know you can check your benefits status instantly?',
            actionButton: 'Check Now'
          },
          channels: ['in_app'],
          timing: {
            delay: 30,
            frequency: 'weekly'
          }
        },
        {
          strategyId: 'education-tutorial',
          type: 'education',
          trigger: {
            eventType: 'feature_usage',
            conditions: { success: false }
          },
          content: {
            title: 'Need Help?',
            message: 'Let us guide you through this step-by-step.',
            actionButton: 'Start Tutorial'
          },
          channels: ['in_app', 'email'],
          timing: {
            delay: 60,
            frequency: 'as_needed'
          }
        }
      ]
    };
  });

  describe('generateRecommendations', () => {
    it('should generate recommendations based on user profile and recent events', () => {
      // Arrange
      const recentEvents: UserEvent[] = [
        {
          eventId: 'event1',
          userId: 'user123',
          sessionId: 'session1',
          timestamp: new Date(),
          eventType: 'page_view',
          metadata: { screenName: 'dashboard' },
          userContext: { ageGroup: '31-40' }
        }
      ];

      vi.spyOn(mockSegmentationEngine, 'segmentUser').mockReturnValue(mockUserSegment);

      // Act
      const recommendations = recommendationEngine.generateRecommendations(
        mockUserProfile,
        recentEvents,
        2
      );

      // Assert
      expect(recommendations).toHaveLength(2);
      expect(recommendations[0]).toHaveProperty('strategy');
      expect(recommendations[0]).toHaveProperty('score');
      expect(recommendations[0]).toHaveProperty('reasoning');
      expect(recommendations[0]).toHaveProperty('urgency');
      expect(recommendations[0]).toHaveProperty('expectedImpact');
    });

    it('should return empty array when user segment is not found', () => {
      // Arrange
      const recentEvents: UserEvent[] = [];
      vi.spyOn(mockSegmentationEngine, 'segmentUser').mockReturnValue(null);

      // Act
      const recommendations = recommendationEngine.generateRecommendations(
        mockUserProfile,
        recentEvents
      );

      // Assert
      expect(recommendations).toHaveLength(0);
    });

    it('should limit recommendations to maxRecommendations parameter', () => {
      // Arrange
      const recentEvents: UserEvent[] = [
        {
          eventId: 'event1',
          userId: 'user123',
          sessionId: 'session1',
          timestamp: new Date(),
          eventType: 'page_view',
          metadata: { screenName: 'dashboard' },
          userContext: { ageGroup: '31-40' }
        }
      ];

      vi.spyOn(mockSegmentationEngine, 'segmentUser').mockReturnValue(mockUserSegment);

      // Act
      const recommendations = recommendationEngine.generateRecommendations(
        mockUserProfile,
        recentEvents,
        1
      );

      // Assert
      expect(recommendations).toHaveLength(1);
    });

    it('should prioritize strategies matching trigger events', () => {
      // Arrange
      const recentEvents: UserEvent[] = [
        {
          eventId: 'event1',
          userId: 'user123',
          sessionId: 'session1',
          timestamp: new Date(),
          eventType: 'page_view',
          metadata: { screenName: 'dashboard' },
          userContext: { ageGroup: '31-40' }
        }
      ];

      vi.spyOn(mockSegmentationEngine, 'segmentUser').mockReturnValue(mockUserSegment);

      // Act
      const recommendations = recommendationEngine.generateRecommendations(
        mockUserProfile,
        recentEvents
      );

      // Assert
      const topRecommendation = recommendations[0];
      expect(topRecommendation.strategy.strategyId).toBe('nudge-reminder');
      expect(topRecommendation.reasoning).toContain('Matches current trigger event');
    });
  });

  describe('getStrategyForTrigger', () => {
    it('should return matching strategy for trigger event', () => {
      // Arrange
      const triggerEvent: UserEvent = {
        eventId: 'event1',
        userId: 'user123',
        sessionId: 'session1',
        timestamp: new Date(),
        eventType: 'page_view',
        metadata: { screenName: 'dashboard' },
        userContext: { ageGroup: '31-40' }
      };

      vi.spyOn(mockSegmentationEngine, 'segmentUser').mockReturnValue(mockUserSegment);

      // Act
      const strategy = recommendationEngine.getStrategyForTrigger(mockUserProfile, triggerEvent);

      // Assert
      expect(strategy).not.toBeNull();
      expect(strategy?.strategyId).toBe('nudge-reminder');
    });

    it('should return null when no matching strategy found', () => {
      // Arrange
      const triggerEvent: UserEvent = {
        eventId: 'event1',
        userId: 'user123',
        sessionId: 'session1',
        timestamp: new Date(),
        eventType: 'abandonment',
        metadata: { screenName: 'unknown' },
        userContext: { ageGroup: '31-40' }
      };

      vi.spyOn(mockSegmentationEngine, 'segmentUser').mockReturnValue(mockUserSegment);

      // Act
      const strategy = recommendationEngine.getStrategyForTrigger(mockUserProfile, triggerEvent);

      // Assert
      expect(strategy).toBeNull();
    });

    it('should return null when user segment is not found', () => {
      // Arrange
      const triggerEvent: UserEvent = {
        eventId: 'event1',
        userId: 'user123',
        sessionId: 'session1',
        timestamp: new Date(),
        eventType: 'page_view',
        metadata: { screenName: 'dashboard' },
        userContext: { ageGroup: '31-40' }
      };

      vi.spyOn(mockSegmentationEngine, 'segmentUser').mockReturnValue(null);

      // Act
      const strategy = recommendationEngine.getStrategyForTrigger(mockUserProfile, triggerEvent);

      // Assert
      expect(strategy).toBeNull();
    });
  });

  describe('recordInterventionDelivery', () => {
    it('should record intervention delivery in user history', () => {
      // Arrange
      const strategy = mockUserSegment.interventionStrategies[0];
      const deliveredAt = new Date();

      // Act
      recommendationEngine.recordInterventionDelivery(
        'user123',
        strategy,
        'in_app',
        deliveredAt
      );

      // Assert
      const effectiveness = recommendationEngine.getStrategyEffectiveness(strategy.strategyId);
      expect(effectiveness.deliveryCount).toBe(1);
      expect(effectiveness.responseCount).toBe(0);
    });

    it('should track multiple deliveries for the same strategy', () => {
      // Arrange
      const strategy = mockUserSegment.interventionStrategies[0];
      const deliveredAt1 = new Date();
      const deliveredAt2 = new Date();

      // Act
      recommendationEngine.recordInterventionDelivery('user123', strategy, 'in_app', deliveredAt1);
      recommendationEngine.recordInterventionDelivery('user123', strategy, 'email', deliveredAt2);

      // Assert
      const effectiveness = recommendationEngine.getStrategyEffectiveness(strategy.strategyId);
      expect(effectiveness.deliveryCount).toBe(2);
    });
  });

  describe('recordInterventionResponse', () => {
    it('should record user response to intervention', () => {
      // Arrange
      const strategy = mockUserSegment.interventionStrategies[0];
      const deliveredAt = new Date();
      const respondedAt = new Date(deliveredAt.getTime() + 60000); // 1 minute later

      recommendationEngine.recordInterventionDelivery('user123', strategy, 'in_app', deliveredAt);

      // Act
      recommendationEngine.recordInterventionResponse('user123', strategy.strategyId, respondedAt);

      // Assert
      const effectiveness = recommendationEngine.getStrategyEffectiveness(strategy.strategyId);
      expect(effectiveness.responseCount).toBe(1);
      expect(effectiveness.responseRate).toBe(1.0);
      expect(effectiveness.averageResponseTime).toBe(60000);
    });

    it('should not record response for non-existent intervention', () => {
      // Arrange
      const respondedAt = new Date();

      // Act
      recommendationEngine.recordInterventionResponse('user123', 'non-existent', respondedAt);

      // Assert
      const effectiveness = recommendationEngine.getStrategyEffectiveness('non-existent');
      expect(effectiveness.responseCount).toBe(0);
    });
  });

  describe('getStrategyEffectiveness', () => {
    it('should calculate correct effectiveness metrics', () => {
      // Arrange
      const strategy = mockUserSegment.interventionStrategies[0];
      const deliveredAt1 = new Date();
      const deliveredAt2 = new Date();
      const respondedAt = new Date(deliveredAt1.getTime() + 30000); // 30 seconds later

      recommendationEngine.recordInterventionDelivery('user123', strategy, 'in_app', deliveredAt1);
      recommendationEngine.recordInterventionDelivery('user456', strategy, 'email', deliveredAt2);
      recommendationEngine.recordInterventionResponse('user123', strategy.strategyId, respondedAt);

      // Act
      const effectiveness = recommendationEngine.getStrategyEffectiveness(strategy.strategyId);

      // Assert
      expect(effectiveness.strategyId).toBe(strategy.strategyId);
      expect(effectiveness.deliveryCount).toBe(2);
      expect(effectiveness.responseCount).toBe(1);
      expect(effectiveness.responseRate).toBe(0.5);
      expect(effectiveness.averageResponseTime).toBe(30000);
    });

    it('should return zero metrics for unknown strategy', () => {
      // Act
      const effectiveness = recommendationEngine.getStrategyEffectiveness('unknown-strategy');

      // Assert
      expect(effectiveness.deliveryCount).toBe(0);
      expect(effectiveness.responseCount).toBe(0);
      expect(effectiveness.responseRate).toBe(0);
      expect(effectiveness.averageResponseTime).toBe(0);
    });
  });

  describe('clearUserHistory', () => {
    it('should clear intervention history for specified user', () => {
      // Arrange
      const strategy = mockUserSegment.interventionStrategies[0];
      const deliveredAt = new Date();

      recommendationEngine.recordInterventionDelivery('user123', strategy, 'in_app', deliveredAt);
      
      // Verify history exists
      let effectiveness = recommendationEngine.getStrategyEffectiveness(strategy.strategyId);
      expect(effectiveness.deliveryCount).toBe(1);

      // Act
      recommendationEngine.clearUserHistory('user123');

      // Assert
      effectiveness = recommendationEngine.getStrategyEffectiveness(strategy.strategyId);
      expect(effectiveness.deliveryCount).toBe(0);
    });
  });

  describe('age-appropriate recommendations', () => {
    it('should recommend gamification for young users', () => {
      // Arrange
      const youngUserProfile = {
        ...mockUserProfile,
        demographics: { ...mockUserProfile.demographics, ageGroup: '22-30' as const }
      };

      const youngUserSegment: UserSegment = {
        segmentId: 'young-high-engagement',
        name: 'Young High Engagement',
        criteria: {
          ageRange: [22, 30],
          engagementLevel: 'high',
          preferredChannels: ['push', 'in_app'],
          digitalLiteracy: 'advanced'
        },
        interventionStrategies: [
          {
            strategyId: 'gamification-achievement',
            type: 'gamification',
            trigger: { eventType: 'task_completion', conditions: { success: true } },
            content: { title: 'Achievement!', message: 'Well done!' },
            channels: ['push', 'in_app'],
            timing: { delay: 0 }
          }
        ]
      };

      const recentEvents: UserEvent[] = [
        {
          eventId: 'event1',
          userId: 'user123',
          sessionId: 'session1',
          timestamp: new Date(),
          eventType: 'task_completion',
          metadata: { success: true },
          userContext: { ageGroup: '22-30' }
        }
      ];

      vi.spyOn(mockSegmentationEngine, 'segmentUser').mockReturnValue(youngUserSegment);

      // Act
      const recommendations = recommendationEngine.generateRecommendations(
        youngUserProfile,
        recentEvents
      );

      // Assert
      expect(recommendations).toHaveLength(1);
      expect(recommendations[0].strategy.type).toBe('gamification');
      expect(recommendations[0].reasoning).toContain('Age-appropriate content');
    });

    it('should recommend education for older users', () => {
      // Arrange
      const olderUserProfile = {
        ...mockUserProfile,
        demographics: { ...mockUserProfile.demographics, ageGroup: '66+' as const }
      };

      const olderUserSegment: UserSegment = {
        segmentId: 'senior-low-engagement',
        name: 'Senior Low Engagement',
        criteria: {
          ageRange: [66, 100],
          engagementLevel: 'low',
          preferredChannels: ['email'],
          digitalLiteracy: 'beginner'
        },
        interventionStrategies: [
          {
            strategyId: 'simple-education',
            type: 'education',
            trigger: { eventType: 'page_view', conditions: { screenName: 'main_menu' } },
            content: { title: 'Welcome', message: 'Here are the important features.' },
            channels: ['email'],
            timing: { delay: 0 }
          }
        ]
      };

      const recentEvents: UserEvent[] = [
        {
          eventId: 'event1',
          userId: 'user123',
          sessionId: 'session1',
          timestamp: new Date(),
          eventType: 'page_view',
          metadata: { screenName: 'main_menu' },
          userContext: { ageGroup: '66+' }
        }
      ];

      vi.spyOn(mockSegmentationEngine, 'segmentUser').mockReturnValue(olderUserSegment);

      // Act
      const recommendations = recommendationEngine.generateRecommendations(
        olderUserProfile,
        recentEvents
      );

      // Assert
      expect(recommendations).toHaveLength(1);
      expect(recommendations[0].strategy.type).toBe('education');
      expect(recommendations[0].reasoning).toContain('Age-appropriate content');
    });
  });

  describe('abandonment risk handling', () => {
    it('should increase urgency for high abandonment risk', () => {
      // Arrange
      const abandonmentEvents: UserEvent[] = [
        {
          eventId: 'event1',
          userId: 'user123',
          sessionId: 'session1',
          timestamp: new Date(),
          eventType: 'abandonment',
          metadata: { screenName: 'claim_form' },
          userContext: { ageGroup: '31-40' }
        },
        {
          eventId: 'event2',
          userId: 'user123',
          sessionId: 'session1',
          timestamp: new Date(),
          eventType: 'abandonment',
          metadata: { screenName: 'benefits' },
          userContext: { ageGroup: '31-40' }
        }
      ];

      vi.spyOn(mockSegmentationEngine, 'segmentUser').mockReturnValue(mockUserSegment);

      // Act
      const recommendations = recommendationEngine.generateRecommendations(
        mockUserProfile,
        abandonmentEvents
      );

      // Assert
      expect(recommendations.length).toBeGreaterThan(0);
      expect(recommendations[0].urgency).toBe('high');
    });
  });
});