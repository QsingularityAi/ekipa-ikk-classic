import { describe, it, expect, beforeEach } from 'vitest';
import { PatternAnalyzer, UserJourney, AbandonmentPoint, BehaviorPattern, EngagementMetrics } from './pattern-analyzer';
import { UserEvent, UserProfile } from '../types';

describe('PatternAnalyzer', () => {
  let analyzer: PatternAnalyzer;
  let mockEvents: UserEvent[];
  let mockUserProfiles: UserProfile[];

  beforeEach(() => {
    analyzer = new PatternAnalyzer();
    
    // Create mock events for testing
    mockEvents = [
      {
        eventId: 'event-1',
        userId: 'user-1',
        sessionId: 'session-1',
        timestamp: new Date('2024-01-15T10:00:00Z'),
        eventType: 'page_view',
        metadata: {
          screenName: 'dashboard',
          duration: 120
        },
        userContext: {
          ageGroup: '22-30',
          digitalLiteracyScore: 8,
          preferredChannel: 'push'
        }
      },
      {
        eventId: 'event-2',
        userId: 'user-1',
        sessionId: 'session-1',
        timestamp: new Date('2024-01-15T10:02:00Z'),
        eventType: 'feature_usage',
        metadata: {
          screenName: 'claims',
          featureId: 'claim-form',
          duration: 300
        },
        userContext: {
          ageGroup: '22-30',
          digitalLiteracyScore: 8,
          preferredChannel: 'push'
        }
      },
      {
        eventId: 'event-3',
        userId: 'user-1',
        sessionId: 'session-1',
        timestamp: new Date('2024-01-15T10:07:00Z'),
        eventType: 'task_completion',
        metadata: {
          screenName: 'claims',
          featureId: 'claim-form',
          success: true,
          duration: 60
        },
        userContext: {
          ageGroup: '22-30',
          digitalLiteracyScore: 8,
          preferredChannel: 'push'
        }
      },
      {
        eventId: 'event-4',
        userId: 'user-2',
        sessionId: 'session-2',
        timestamp: new Date('2024-01-15T11:00:00Z'),
        eventType: 'page_view',
        metadata: {
          screenName: 'benefits',
          duration: 60
        },
        userContext: {
          ageGroup: '66+',
          digitalLiteracyScore: 3,
          preferredChannel: 'email'
        }
      },
      {
        eventId: 'event-5',
        userId: 'user-2',
        sessionId: 'session-2',
        timestamp: new Date('2024-01-15T11:01:00Z'),
        eventType: 'abandonment',
        metadata: {
          screenName: 'benefits',
          featureId: 'benefit-calculator',
          duration: 30
        },
        userContext: {
          ageGroup: '66+',
          digitalLiteracyScore: 3,
          preferredChannel: 'email'
        }
      }
    ];

    // Create mock user profiles
    mockUserProfiles = [
      {
        userId: 'user-1',
        demographics: {
          ageGroup: '22-30',
          registrationDate: new Date('2023-01-01'),
          lastActiveDate: new Date('2024-01-15')
        },
        engagementMetrics: {
          totalSessions: 25,
          averageSessionDuration: 300,
          featuresUsed: ['claims', 'benefits', 'documents', 'profile'],
          digitalTasksCompleted: 15,
          traditionalChannelUsage: {
            phoneCallsLastMonth: 1,
            paperFormsLastMonth: 0
          }
        },
        preferences: {
          communicationChannels: ['push', 'in_app'],
          notificationFrequency: 'high',
          contentComplexity: 'detailed'
        },
        consentStatus: []
      },
      {
        userId: 'user-2',
        demographics: {
          ageGroup: '66+',
          registrationDate: new Date('2023-06-01'),
          lastActiveDate: new Date('2024-01-15')
        },
        engagementMetrics: {
          totalSessions: 5,
          averageSessionDuration: 90,
          featuresUsed: ['benefits'],
          digitalTasksCompleted: 2,
          traditionalChannelUsage: {
            phoneCallsLastMonth: 8,
            paperFormsLastMonth: 3
          }
        },
        preferences: {
          communicationChannels: ['email'],
          notificationFrequency: 'low',
          contentComplexity: 'simple'
        },
        consentStatus: []
      }
    ];
  });

  describe('User Journey Analysis', () => {
    it('should analyze user journeys from events', () => {
      const journeys = analyzer.analyzeUserJourney(mockEvents);
      
      expect(journeys).toHaveLength(2); // Two different sessions
      
      const user1Journey = journeys.find(j => j.userId === 'user-1');
      expect(user1Journey).toBeDefined();
      expect(user1Journey?.sessionId).toBe('session-1');
      expect(user1Journey?.events).toHaveLength(3);
      expect(user1Journey?.completedTasks).toContain('claim-form');
      expect(user1Journey?.abandonedTasks).toHaveLength(0);
      expect(user1Journey?.engagementScore).toBeGreaterThan(0);
    });

    it('should handle empty events array', () => {
      const journeys = analyzer.analyzeUserJourney([]);
      expect(journeys).toHaveLength(0);
    });

    it('should calculate journey engagement scores correctly', () => {
      const journeys = analyzer.analyzeUserJourney(mockEvents);
      const user1Journey = journeys.find(j => j.userId === 'user-1');
      const user2Journey = journeys.find(j => j.userId === 'user-2');
      
      // User 1 completed a task, should have higher engagement
      expect(user1Journey?.engagementScore).toBeGreaterThan(user2Journey?.engagementScore || 0);
    });

    it('should track completed and abandoned tasks', () => {
      const journeys = analyzer.analyzeUserJourney(mockEvents);
      
      const user1Journey = journeys.find(j => j.userId === 'user-1');
      const user2Journey = journeys.find(j => j.userId === 'user-2');
      
      expect(user1Journey?.completedTasks).toContain('claim-form');
      expect(user1Journey?.abandonedTasks).toHaveLength(0);
      
      expect(user2Journey?.completedTasks).toHaveLength(0);
      expect(user2Journey?.abandonedTasks).toContain('benefit-calculator');
    });
  });

  describe('Abandonment Point Identification', () => {
    it('should identify abandonment points', () => {
      const abandonmentPoints = analyzer.identifyAbandonmentPoints(mockEvents);
      
      expect(abandonmentPoints.length).toBeGreaterThan(0);
      
      const benefitsAbandonment = abandonmentPoints.find(
        ap => ap.screenName === 'benefits' && ap.featureId === 'benefit-calculator'
      );
      
      expect(benefitsAbandonment).toBeDefined();
      expect(benefitsAbandonment?.abandonmentRate).toBe(1); // 100% abandonment
      expect(benefitsAbandonment?.userSegments).toContain('66+');
    });

    it('should calculate abandonment rates correctly', () => {
      // Add more events to test abandonment rate calculation
      const extendedEvents = [
        ...mockEvents,
        {
          eventId: 'event-6',
          userId: 'user-3',
          sessionId: 'session-3',
          timestamp: new Date('2024-01-15T12:00:00Z'),
          eventType: 'feature_usage',
          metadata: {
            screenName: 'benefits',
            featureId: 'benefit-calculator',
            duration: 180
          },
          userContext: {
            ageGroup: '31-40',
            digitalLiteracyScore: 6,
            preferredChannel: 'email'
          }
        },
        {
          eventId: 'event-7',
          userId: 'user-3',
          sessionId: 'session-3',
          timestamp: new Date('2024-01-15T12:03:00Z'),
          eventType: 'task_completion',
          metadata: {
            screenName: 'benefits',
            featureId: 'benefit-calculator',
            success: true,
            duration: 30
          },
          userContext: {
            ageGroup: '31-40',
            digitalLiteracyScore: 6,
            preferredChannel: 'email'
          }
        }
      ];

      const abandonmentPoints = analyzer.identifyAbandonmentPoints(extendedEvents);
      const benefitsAbandonment = abandonmentPoints.find(
        ap => ap.screenName === 'benefits' && ap.featureId === 'benefit-calculator'
      );
      
      expect(benefitsAbandonment?.abandonmentRate).toBe(0.5); // 50% abandonment (1 out of 2)
    });

    it('should sort abandonment points by rate', () => {
      const abandonmentPoints = analyzer.identifyAbandonmentPoints(mockEvents);
      
      for (let i = 0; i < abandonmentPoints.length - 1; i++) {
        expect(abandonmentPoints[i].abandonmentRate).toBeGreaterThanOrEqual(
          abandonmentPoints[i + 1].abandonmentRate
        );
      }
    });
  });

  describe('Behavior Pattern Detection', () => {
    it('should detect behavioral patterns', () => {
      const patterns = analyzer.detectBehaviorPatterns(mockEvents, mockUserProfiles);
      
      expect(patterns.length).toBeGreaterThan(0);
      
      // Should include exploration pattern
      const explorationPattern = patterns.find(p => p.patternId === 'exploration-vs-task');
      expect(explorationPattern).toBeDefined();
      expect(explorationPattern?.frequency).toBeGreaterThan(0);
    });

    it('should detect age-based patterns', () => {
      const patterns = analyzer.detectBehaviorPatterns(mockEvents, mockUserProfiles);
      
      const youngPattern = patterns.find(p => p.patternId === 'age-pattern-22-30');
      const seniorPattern = patterns.find(p => p.patternId === 'age-pattern-66+');
      
      expect(youngPattern).toBeDefined();
      expect(seniorPattern).toBeDefined();
      
      expect(youngPattern?.userSegments).toContain('22-30');
      expect(seniorPattern?.userSegments).toContain('66+');
    });

    it('should detect channel preference patterns', () => {
      const patterns = analyzer.detectBehaviorPatterns(mockEvents, mockUserProfiles);
      
      const channelPattern = patterns.find(p => p.patternId === 'channel-preference');
      expect(channelPattern).toBeDefined();
      expect(channelPattern?.name).toContain('Digital vs Traditional');
    });

    it('should filter out patterns with zero frequency', () => {
      const patterns = analyzer.detectBehaviorPatterns([], []);
      
      // All patterns should have frequency > 0 or be filtered out
      patterns.forEach(pattern => {
        expect(pattern.frequency).toBeGreaterThan(0);
      });
    });
  });

  describe('Engagement Score Calculation', () => {
    it('should calculate engagement metrics for a user', () => {
      const userEvents = mockEvents.filter(e => e.userId === 'user-1');
      const userProfile = mockUserProfiles.find(p => p.userId === 'user-1')!;
      
      const metrics = analyzer.calculateEngagementScore(userEvents, userProfile);
      
      expect(metrics.userId).toBe('user-1');
      expect(metrics.overallScore).toBeGreaterThan(0);
      expect(metrics.overallScore).toBeLessThanOrEqual(100);
      expect(metrics.sessionEngagement).toBeGreaterThan(0);
      expect(metrics.featureAdoption).toBeGreaterThan(0);
      expect(metrics.taskCompletion).toBeGreaterThan(0);
      expect(metrics.digitalPreference).toBeGreaterThan(0);
      expect(['improving', 'declining', 'stable']).toContain(metrics.trendDirection);
      expect(['low', 'medium', 'high']).toContain(metrics.riskLevel);
    });

    it('should calculate different scores for different user types', () => {
      const user1Events = mockEvents.filter(e => e.userId === 'user-1');
      const user2Events = mockEvents.filter(e => e.userId === 'user-2');
      
      const user1Profile = mockUserProfiles.find(p => p.userId === 'user-1')!;
      const user2Profile = mockUserProfiles.find(p => p.userId === 'user-2')!;
      
      const metrics1 = analyzer.calculateEngagementScore(user1Events, user1Profile);
      const metrics2 = analyzer.calculateEngagementScore(user2Events, user2Profile);
      
      // User 1 should have higher engagement (completed task vs abandoned)
      expect(metrics1.overallScore).toBeGreaterThan(metrics2.overallScore);
      expect(metrics1.taskCompletion).toBeGreaterThan(metrics2.taskCompletion);
    });

    it('should handle users with no events', () => {
      const userProfile = mockUserProfiles[0];
      const metrics = analyzer.calculateEngagementScore([], userProfile);
      
      expect(metrics.userId).toBe(userProfile.userId);
      expect(metrics.overallScore).toBeGreaterThanOrEqual(0);
      expect(metrics.sessionEngagement).toBe(0);
      expect(metrics.featureAdoption).toBe(0);
      expect(metrics.taskCompletion).toBe(0);
    });
  });

  describe('Segment Engagement Metrics', () => {
    it('should calculate engagement metrics for multiple users', () => {
      const metrics = analyzer.getSegmentEngagementMetrics(
        mockEvents, 
        mockUserProfiles, 
        'test-segment'
      );
      
      expect(metrics).toHaveLength(mockUserProfiles.length);
      
      metrics.forEach(metric => {
        expect(metric.userId).toBeDefined();
        expect(metric.overallScore).toBeGreaterThanOrEqual(0);
        expect(metric.overallScore).toBeLessThanOrEqual(100);
      });
    });

    it('should handle empty user profiles array', () => {
      const metrics = analyzer.getSegmentEngagementMetrics(mockEvents, [], 'test-segment');
      expect(metrics).toHaveLength(0);
    });
  });

  describe('Churn Risk Prediction', () => {
    it('should predict churn risk for users', () => {
      const userEvents = mockEvents.filter(e => e.userId === 'user-2'); // User with abandonment
      const userProfile = mockUserProfiles.find(p => p.userId === 'user-2')!;
      
      const churnRisk = analyzer.predictChurnRisk(userEvents, userProfile);
      
      expect(churnRisk.riskScore).toBeGreaterThanOrEqual(0);
      expect(churnRisk.riskScore).toBeLessThanOrEqual(100);
      expect(['low', 'medium', 'high']).toContain(churnRisk.riskLevel);
      expect(Array.isArray(churnRisk.riskFactors)).toBe(true);
      expect(Array.isArray(churnRisk.recommendedActions)).toBe(true);
    });

    it('should identify high-risk users correctly', () => {
      // Create a high-risk user profile
      const highRiskProfile: UserProfile = {
        userId: 'high-risk-user',
        demographics: {
          ageGroup: '66+',
          registrationDate: new Date('2023-01-01'),
          lastActiveDate: new Date('2024-01-01')
        },
        engagementMetrics: {
          totalSessions: 1,
          averageSessionDuration: 30,
          featuresUsed: [],
          digitalTasksCompleted: 0,
          traditionalChannelUsage: {
            phoneCallsLastMonth: 10,
            paperFormsLastMonth: 5
          }
        },
        preferences: {
          communicationChannels: ['email'],
          notificationFrequency: 'low',
          contentComplexity: 'simple'
        },
        consentStatus: []
      };

      const churnRisk = analyzer.predictChurnRisk([], highRiskProfile);
      
      expect(churnRisk.riskLevel).toBe('high');
      expect(churnRisk.riskScore).toBeGreaterThan(50);
      expect(churnRisk.riskFactors.length).toBeGreaterThan(0);
    });

    it('should provide appropriate recommendations based on risk factors', () => {
      const userEvents = mockEvents.filter(e => e.userId === 'user-2');
      const userProfile = mockUserProfiles.find(p => p.userId === 'user-2')!;
      
      const churnRisk = analyzer.predictChurnRisk(userEvents, userProfile);
      
      expect(churnRisk.recommendedActions.length).toBeGreaterThan(0);
      
      // Senior users should get age-appropriate recommendations
      if (userProfile.demographics.ageGroup === '66+') {
        expect(churnRisk.recommendedActions.some(action => 
          action.includes('simplified') || action.includes('phone support')
        )).toBe(true);
      }
    });

    it('should handle users with no recent activity', () => {
      const userProfile = mockUserProfiles[0];
      const churnRisk = analyzer.predictChurnRisk([], userProfile);
      
      expect(churnRisk.riskScore).toBeGreaterThan(0);
      expect(churnRisk.riskFactors).toContain('Low session frequency');
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle malformed events gracefully', () => {
      const malformedEvents: UserEvent[] = [
        {
          eventId: 'malformed-1',
          userId: 'user-1',
          sessionId: 'session-1',
          timestamp: new Date('2024-01-15T10:00:00Z'),
          eventType: 'page_view',
          metadata: {}, // Empty metadata
          userContext: {
            ageGroup: '22-30'
          }
        }
      ];

      expect(() => {
        analyzer.analyzeUserJourney(malformedEvents);
        analyzer.identifyAbandonmentPoints(malformedEvents);
        analyzer.detectBehaviorPatterns(malformedEvents, mockUserProfiles);
      }).not.toThrow();
    });

    it('should handle events with missing timestamps', () => {
      const eventsWithMissingData = mockEvents.map(event => ({
        ...event,
        metadata: {
          ...event.metadata,
          duration: undefined
        }
      }));

      expect(() => {
        analyzer.analyzeUserJourney(eventsWithMissingData);
      }).not.toThrow();
    });

    it('should handle users with extreme engagement values', () => {
      const extremeProfile: UserProfile = {
        userId: 'extreme-user',
        demographics: {
          ageGroup: '22-30',
          registrationDate: new Date('2020-01-01'),
          lastActiveDate: new Date('2024-01-15')
        },
        engagementMetrics: {
          totalSessions: 10000,
          averageSessionDuration: 7200,
          featuresUsed: Array.from({ length: 50 }, (_, i) => `feature-${i}`),
          digitalTasksCompleted: 1000,
          traditionalChannelUsage: {
            phoneCallsLastMonth: 0,
            paperFormsLastMonth: 0
          }
        },
        preferences: {
          communicationChannels: ['push', 'in_app', 'email', 'sms'],
          notificationFrequency: 'high',
          contentComplexity: 'detailed'
        },
        consentStatus: []
      };

      expect(() => {
        analyzer.calculateEngagementScore(mockEvents, extremeProfile);
        analyzer.predictChurnRisk(mockEvents, extremeProfile);
      }).not.toThrow();
    });

    it('should handle concurrent sessions for the same user', () => {
      const concurrentEvents: UserEvent[] = [
        {
          eventId: 'concurrent-1',
          userId: 'user-1',
          sessionId: 'session-a',
          timestamp: new Date('2024-01-15T10:00:00Z'),
          eventType: 'page_view',
          metadata: { screenName: 'dashboard' },
          userContext: { ageGroup: '22-30' }
        },
        {
          eventId: 'concurrent-2',
          userId: 'user-1',
          sessionId: 'session-b',
          timestamp: new Date('2024-01-15T10:01:00Z'),
          eventType: 'page_view',
          metadata: { screenName: 'claims' },
          userContext: { ageGroup: '22-30' }
        }
      ];

      const journeys = analyzer.analyzeUserJourney(concurrentEvents);
      expect(journeys).toHaveLength(2); // Should handle both sessions
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle large datasets efficiently', () => {
      // Generate a large dataset
      const largeEventSet: UserEvent[] = [];
      for (let i = 0; i < 1000; i++) {
        largeEventSet.push({
          eventId: `event-${i}`,
          userId: `user-${i % 100}`,
          sessionId: `session-${i % 200}`,
          timestamp: new Date(Date.now() - i * 60000),
          eventType: i % 4 === 0 ? 'abandonment' : 'page_view',
          metadata: {
            screenName: `screen-${i % 10}`,
            featureId: `feature-${i % 5}`,
            duration: Math.random() * 300
          },
          userContext: {
            ageGroup: ['22-30', '31-40', '41-55', '56-65', '66+'][i % 5] as any
          }
        });
      }

      const startTime = Date.now();
      
      analyzer.analyzeUserJourney(largeEventSet);
      analyzer.identifyAbandonmentPoints(largeEventSet);
      
      const endTime = Date.now();
      const processingTime = endTime - startTime;
      
      // Should process 1000 events in reasonable time (less than 1 second)
      expect(processingTime).toBeLessThan(1000);
    });
  });
});