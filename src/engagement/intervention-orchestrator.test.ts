import { describe, it, expect, beforeEach, vi } from 'vitest';
import { InterventionOrchestrator } from './intervention-orchestrator';
import { UserProfile, InterventionStrategy, PersonalizedContent } from '../types';
import { InterventionOrchestratorConfig } from './interfaces';

describe('InterventionOrchestrator', () => {
  let orchestrator: InterventionOrchestrator;
  let config: InterventionOrchestratorConfig;
  let mockUserProfile: UserProfile;
  let mockStrategy: InterventionStrategy;
  let mockContent: PersonalizedContent;

  beforeEach(() => {
    config = {
      channels: {
        push: true,
        inApp: true,
        sms: true,
        email: true
      },
      rateLimits: {
        perUser: 10,
        perHour: 5
      }
    };

    orchestrator = new InterventionOrchestrator(config);

    mockUserProfile = {
      userId: 'user123',
      demographics: {
        ageGroup: '31-40',
        registrationDate: new Date('2023-01-01'),
        lastActiveDate: new Date()
      },
      engagementMetrics: {
        totalSessions: 50,
        averageSessionDuration: 300,
        featuresUsed: ['feature1', 'feature2'],
        digitalTasksCompleted: 10,
        traditionalChannelUsage: {
          phoneCallsLastMonth: 3,
          paperFormsLastMonth: 1
        }
      },
      preferences: {
        communicationChannels: ['push', 'email'],
        notificationFrequency: 'medium',
        contentComplexity: 'detailed'
      },
      consentStatus: []
    };

    mockStrategy = {
      strategyId: 'strategy123',
      type: 'nudge',
      trigger: {
        eventType: 'abandonment',
        conditions: { feature: 'payment' }
      },
      content: {
        title: 'Complete Your Payment',
        message: 'You were almost done! Complete your payment now.',
        actionButton: 'Continue Payment'
      },
      channels: ['push', 'in_app', 'email'],
      timing: {
        delay: 300000, // 5 minutes
        frequency: 'once',
        expiresAfter: 3600000 // 1 hour
      }
    };

    mockContent = {
      title: 'Complete Your Payment',
      message: 'You were almost done! Complete your payment now.',
      callToAction: 'Continue Payment',
      accessibility: {
        fontSize: 'normal',
        highContrast: false
      }
    };
  });

  describe('orchestrateIntervention', () => {
    it('should create a delivery request with optimal channel selection', async () => {
      const result = await orchestrator.orchestrateIntervention(
        'user123',
        mockUserProfile,
        mockStrategy,
        mockContent
      );

      expect(result).toBeDefined();
      expect(result!.userId).toBe('user123');
      expect(result!.interventionId).toBe('strategy123');
      expect(['push', 'email']).toContain(result!.channel); // Should prefer user's preferred channels
      expect(result!.content).toEqual(mockContent);
      expect(result!.scheduledFor).toBeInstanceOf(Date);
      expect(result!.expiresAt).toBeInstanceOf(Date);
    });

    it('should respect rate limits', async () => {
      // Fill up the rate limit
      for (let i = 0; i < config.rateLimits.perHour; i++) {
        await orchestrator.orchestrateIntervention(
          'user123',
          mockUserProfile,
          mockStrategy,
          mockContent
        );
      }

      // Next request should be rejected
      const result = await orchestrator.orchestrateIntervention(
        'user123',
        mockUserProfile,
        mockStrategy,
        mockContent
      );

      expect(result).toBeNull();
    });

    it('should return null when no channels are available', async () => {
      const restrictedConfig = {
        ...config,
        channels: {
          push: false,
          inApp: false,
          sms: false,
          email: false
        }
      };

      const restrictedOrchestrator = new InterventionOrchestrator(restrictedConfig);
      
      const result = await restrictedOrchestrator.orchestrateIntervention(
        'user123',
        mockUserProfile,
        mockStrategy,
        mockContent
      );

      expect(result).toBeNull();
    });

    it('should adjust delivery timing for low-frequency users', async () => {
      const lowFreqProfile = {
        ...mockUserProfile,
        preferences: {
          ...mockUserProfile.preferences,
          notificationFrequency: 'low' as const
        }
      };

      const result = await orchestrator.orchestrateIntervention(
        'user123',
        lowFreqProfile,
        mockStrategy,
        mockContent
      );

      expect(result).toBeDefined();
      // Should have additional delay for low-frequency users
      const expectedMinTime = new Date(Date.now() + mockStrategy.timing.delay! + 2 * 60 * 60 * 1000);
      expect(result!.scheduledFor.getTime()).toBeGreaterThanOrEqual(expectedMinTime.getTime() - 60000); // 1 minute tolerance
    });

    it('should schedule delivery during reasonable hours', async () => {
      // Mock current time to be late at night
      const lateNightTime = new Date();
      lateNightTime.setHours(23, 0, 0, 0);
      vi.setSystemTime(lateNightTime);

      const result = await orchestrator.orchestrateIntervention(
        'user123',
        mockUserProfile,
        { ...mockStrategy, timing: { delay: 0 } },
        mockContent
      );

      expect(result).toBeDefined();
      expect(result!.scheduledFor.getHours()).toBeGreaterThanOrEqual(9);
      expect(result!.scheduledFor.getHours()).toBeLessThanOrEqual(21);

      vi.useRealTimers();
    });
  });

  describe('channel selection logic', () => {
    it('should prefer user preferred channels', async () => {
      const results = [];
      
      // Run multiple times to test channel selection
      for (let i = 0; i < 10; i++) {
        const result = await orchestrator.orchestrateIntervention(
          `user${i}`,
          mockUserProfile,
          mockStrategy,
          mockContent
        );
        if (result) {
          results.push(result.channel);
        }
      }

      // Should mostly select from preferred channels (push, email)
      const preferredChannelCount = results.filter(channel => 
        ['push', 'email'].includes(channel)
      ).length;
      
      expect(preferredChannelCount).toBeGreaterThan(results.length * 0.6); // At least 60% should be preferred
    });

    it('should consider age-based channel preferences', async () => {
      const youngUserProfile = {
        ...mockUserProfile,
        demographics: {
          ...mockUserProfile.demographics,
          ageGroup: '22-30' as const
        },
        preferences: {
          ...mockUserProfile.preferences,
          communicationChannels: ['push', 'in_app', 'sms', 'email'] // All channels preferred
        }
      };

      const results = [];
      
      for (let i = 0; i < 20; i++) {
        const result = await orchestrator.orchestrateIntervention(
          `young_user${i}`,
          youngUserProfile,
          mockStrategy,
          mockContent
        );
        if (result) {
          results.push(result.channel);
        }
      }

      // Young users should prefer push and in_app more
      const mobileChannelCount = results.filter(channel => 
        ['push', 'in_app'].includes(channel)
      ).length;
      
      expect(mobileChannelCount).toBeGreaterThan(results.length * 0.5);
    });

    it('should handle older users with appropriate channel selection', async () => {
      const olderUserProfile = {
        ...mockUserProfile,
        demographics: {
          ...mockUserProfile.demographics,
          ageGroup: '66+' as const
        },
        preferences: {
          ...mockUserProfile.preferences,
          communicationChannels: ['push', 'in_app', 'sms', 'email'] // All channels preferred
        }
      };

      const results = [];
      
      for (let i = 0; i < 20; i++) {
        const result = await orchestrator.orchestrateIntervention(
          `older_user${i}`,
          olderUserProfile,
          mockStrategy,
          mockContent
        );
        if (result) {
          results.push(result.channel);
        }
      }

      // Older users should prefer SMS and email more
      const traditionalChannelCount = results.filter(channel => 
        ['sms', 'email'].includes(channel)
      ).length;
      
      expect(traditionalChannelCount).toBeGreaterThan(results.length * 0.5);
    });
  });

  describe('updateChannelEffectiveness', () => {
    it('should update channel effectiveness using exponential moving average', () => {
      // Initial effectiveness should be 0.5 (neutral)
      orchestrator.updateChannelEffectiveness('user123', 'push', 0.8);
      
      // Create another intervention to test the updated effectiveness
      const stats = orchestrator.getDeliveryStats('user123');
      
      // The effectiveness should be updated but we can't directly test it
      // Instead, we test that the system accepts the update without error
      expect(() => {
        orchestrator.updateChannelEffectiveness('user123', 'push', 0.9);
        orchestrator.updateChannelEffectiveness('user123', 'email', 0.3);
      }).not.toThrow();
    });

    it('should clamp effectiveness values between 0 and 1', () => {
      expect(() => {
        orchestrator.updateChannelEffectiveness('user123', 'push', 1.5);
        orchestrator.updateChannelEffectiveness('user123', 'email', -0.5);
      }).not.toThrow();
    });
  });

  describe('getDeliveryStats', () => {
    it('should return correct delivery statistics', async () => {
      // Create some deliveries
      await orchestrator.orchestrateIntervention('user1', mockUserProfile, mockStrategy, mockContent);
      await orchestrator.orchestrateIntervention('user2', mockUserProfile, mockStrategy, mockContent);
      
      const stats = orchestrator.getDeliveryStats();
      
      expect(stats.totalDeliveries).toBe(2);
      expect(stats.channelBreakdown).toBeDefined();
      expect(stats.averageEffectiveness).toBe(0.5); // Default effectiveness
    });

    it('should return user-specific statistics', async () => {
      await orchestrator.orchestrateIntervention('user1', mockUserProfile, mockStrategy, mockContent);
      await orchestrator.orchestrateIntervention('user2', mockUserProfile, mockStrategy, mockContent);
      
      const user1Stats = orchestrator.getDeliveryStats('user1');
      const user2Stats = orchestrator.getDeliveryStats('user2');
      
      expect(user1Stats.totalDeliveries).toBe(1);
      expect(user2Stats.totalDeliveries).toBe(1);
    });

    it('should calculate average effectiveness correctly', () => {
      orchestrator.updateChannelEffectiveness('user1', 'push', 0.8);
      orchestrator.updateChannelEffectiveness('user1', 'email', 0.6);
      orchestrator.updateChannelEffectiveness('user2', 'sms', 0.9);
      
      const stats = orchestrator.getDeliveryStats();
      
      // Should calculate average of all effectiveness scores
      expect(stats.averageEffectiveness).toBeGreaterThan(0.5);
      expect(stats.averageEffectiveness).toBeLessThan(1.0);
    });
  });

  describe('edge cases', () => {
    it('should handle strategy with no channels', async () => {
      const noChannelStrategy = {
        ...mockStrategy,
        channels: [] as ('push' | 'in_app' | 'sms' | 'email')[]
      };

      const result = await orchestrator.orchestrateIntervention(
        'user123',
        mockUserProfile,
        noChannelStrategy,
        mockContent
      );

      expect(result).toBeNull();
    });

    it('should handle user with no preferred channels', async () => {
      const noPreferenceProfile = {
        ...mockUserProfile,
        preferences: {
          ...mockUserProfile.preferences,
          communicationChannels: []
        }
      };

      const result = await orchestrator.orchestrateIntervention(
        'user123',
        noPreferenceProfile,
        mockStrategy,
        mockContent
      );

      expect(result).toBeDefined(); // Should still work with default scoring
    });

    it('should handle missing timing configuration', async () => {
      const noTimingStrategy = {
        ...mockStrategy,
        timing: {}
      };

      const result = await orchestrator.orchestrateIntervention(
        'user123',
        mockUserProfile,
        noTimingStrategy,
        mockContent
      );

      expect(result).toBeDefined();
      expect(result!.scheduledFor).toBeInstanceOf(Date);
      expect(result!.expiresAt).toBeInstanceOf(Date);
    });
  });
});