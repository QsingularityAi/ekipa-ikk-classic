import { describe, it, expect, beforeEach } from 'vitest';
import { UserSegmentationEngine } from './user-segmentation-engine';
import { UserProfile, UserSegment, InterventionStrategy } from '../types';

describe('UserSegmentationEngine', () => {
  let engine: UserSegmentationEngine;

  beforeEach(() => {
    engine = new UserSegmentationEngine();
  });

  describe('User Segmentation', () => {
    it('should segment young high-engagement users correctly', () => {
      const userProfile: UserProfile = {
        userId: 'user-123',
        demographics: {
          ageGroup: '22-30',
          registrationDate: new Date('2023-01-01'),
          lastActiveDate: new Date('2024-01-15')
        },
        engagementMetrics: {
          totalSessions: 25,
          averageSessionDuration: 350,
          featuresUsed: ['claims', 'benefits', 'documents', 'chat', 'payments', 'profile'],
          digitalTasksCompleted: 15,
          traditionalChannelUsage: {
            phoneCallsLastMonth: 0,
            paperFormsLastMonth: 0
          }
        },
        preferences: {
          communicationChannels: ['push', 'in_app'],
          notificationFrequency: 'high',
          contentComplexity: 'detailed'
        },
        consentStatus: []
      };

      const segment = engine.segmentUser(userProfile);
      
      expect(segment).toBeDefined();
      expect(segment?.segmentId).toBe('young-high-engagement');
      expect(segment?.criteria.ageRange).toEqual([22, 30]);
      expect(segment?.criteria.engagementLevel).toBe('high');
      expect(segment?.criteria.digitalLiteracy).toBe('advanced');
    });

    it('should segment senior low-engagement users correctly', () => {
      const userProfile: UserProfile = {
        userId: 'user-456',
        demographics: {
          ageGroup: '66+',
          registrationDate: new Date('2023-06-01'),
          lastActiveDate: new Date('2024-01-10')
        },
        engagementMetrics: {
          totalSessions: 3,
          averageSessionDuration: 45,
          featuresUsed: ['benefits'],
          digitalTasksCompleted: 1,
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
      };

      const segment = engine.segmentUser(userProfile);
      
      expect(segment).toBeDefined();
      expect(segment?.segmentId).toBe('senior-low-engagement');
      expect(segment?.criteria.ageRange).toEqual([56, 100]);
      expect(segment?.criteria.engagementLevel).toBe('low');
      expect(segment?.criteria.digitalLiteracy).toBe('beginner');
    });

    it('should segment professional medium-engagement users correctly', () => {
      const userProfile: UserProfile = {
        userId: 'user-789',
        demographics: {
          ageGroup: '31-40',
          registrationDate: new Date('2023-03-01'),
          lastActiveDate: new Date('2024-01-12')
        },
        engagementMetrics: {
          totalSessions: 15,
          averageSessionDuration: 180,
          featuresUsed: ['claims', 'benefits', 'documents', 'profile'],
          digitalTasksCompleted: 6,
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
        consentStatus: []
      };

      const segment = engine.segmentUser(userProfile);
      
      expect(segment).toBeDefined();
      expect(segment?.segmentId).toBe('professional-medium-engagement');
      expect(segment?.criteria.ageRange).toEqual([31, 55]);
      expect(segment?.criteria.engagementLevel).toBe('medium');
      expect(segment?.criteria.digitalLiteracy).toBe('intermediate');
    });

    it('should return default segment for edge cases', () => {
      const userProfile: UserProfile = {
        userId: 'user-edge',
        demographics: {
          ageGroup: '22-30',
          registrationDate: new Date('2024-01-01'),
          lastActiveDate: new Date('2024-01-01')
        },
        engagementMetrics: {
          totalSessions: 12,
          averageSessionDuration: 200,
          featuresUsed: ['benefits', 'profile'],
          digitalTasksCompleted: 3,
          traditionalChannelUsage: {
            phoneCallsLastMonth: 1,
            paperFormsLastMonth: 0
          }
        },
        preferences: {
          communicationChannels: ['email'],
          notificationFrequency: 'medium',
          contentComplexity: 'simple'
        },
        consentStatus: []
      };

      const segment = engine.segmentUser(userProfile);
      
      expect(segment).toBeDefined();
      expect(segment?.segmentId).toBe('default-segment');
    });
  });

  describe('Engagement Level Calculation', () => {
    it('should calculate high engagement for active users', () => {
      const userProfile: UserProfile = {
        userId: 'user-high',
        demographics: {
          ageGroup: '31-40',
          registrationDate: new Date('2023-01-01'),
          lastActiveDate: new Date('2024-01-15')
        },
        engagementMetrics: {
          totalSessions: 30,
          averageSessionDuration: 400,
          featuresUsed: ['claims', 'benefits', 'documents', 'chat', 'payments', 'profile', 'settings'],
          digitalTasksCompleted: 20,
          traditionalChannelUsage: {
            phoneCallsLastMonth: 0,
            paperFormsLastMonth: 0
          }
        },
        preferences: {
          communicationChannels: ['push', 'in_app'],
          notificationFrequency: 'high',
          contentComplexity: 'detailed'
        },
        consentStatus: []
      };

      const segment = engine.segmentUser(userProfile);
      expect(segment?.criteria.engagementLevel).toBe('high');
    });

    it('should calculate low engagement for inactive users', () => {
      const userProfile: UserProfile = {
        userId: 'user-low',
        demographics: {
          ageGroup: '41-55',
          registrationDate: new Date('2023-01-01'),
          lastActiveDate: new Date('2024-01-05')
        },
        engagementMetrics: {
          totalSessions: 2,
          averageSessionDuration: 30,
          featuresUsed: ['benefits'],
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

      const segment = engine.segmentUser(userProfile);
      expect(segment?.criteria.engagementLevel).toBe('low');
    });
  });

  describe('Digital Literacy Assessment', () => {
    it('should assess advanced literacy for young tech-savvy users', () => {
      const userProfile: UserProfile = {
        userId: 'user-advanced',
        demographics: {
          ageGroup: '22-30',
          registrationDate: new Date('2023-01-01'),
          lastActiveDate: new Date('2024-01-15')
        },
        engagementMetrics: {
          totalSessions: 25,
          averageSessionDuration: 300,
          featuresUsed: ['claims', 'benefits', 'documents', 'chat', 'payments', 'profile', 'settings', 'api'],
          digitalTasksCompleted: 15,
          traditionalChannelUsage: {
            phoneCallsLastMonth: 0,
            paperFormsLastMonth: 0
          }
        },
        preferences: {
          communicationChannels: ['push', 'in_app'],
          notificationFrequency: 'high',
          contentComplexity: 'detailed'
        },
        consentStatus: []
      };

      const segment = engine.segmentUser(userProfile);
      expect(segment?.criteria.digitalLiteracy).toBe('advanced');
    });

    it('should assess beginner literacy for older users with limited usage', () => {
      const userProfile: UserProfile = {
        userId: 'user-beginner',
        demographics: {
          ageGroup: '66+',
          registrationDate: new Date('2023-01-01'),
          lastActiveDate: new Date('2024-01-10')
        },
        engagementMetrics: {
          totalSessions: 5,
          averageSessionDuration: 60,
          featuresUsed: ['benefits'],
          digitalTasksCompleted: 1,
          traditionalChannelUsage: {
            phoneCallsLastMonth: 5,
            paperFormsLastMonth: 2
          }
        },
        preferences: {
          communicationChannels: ['email'],
          notificationFrequency: 'low',
          contentComplexity: 'simple'
        },
        consentStatus: []
      };

      const segment = engine.segmentUser(userProfile);
      expect(segment?.criteria.digitalLiteracy).toBe('beginner');
    });
  });

  describe('Segment Management', () => {
    it('should create custom segments', () => {
      const customSegment: UserSegment = {
        segmentId: 'custom-test',
        name: 'Custom Test Segment',
        criteria: {
          ageRange: [25, 35],
          engagementLevel: 'high',
          preferredChannels: ['push'],
          digitalLiteracy: 'advanced'
        },
        interventionStrategies: []
      };

      engine.createCustomSegment(customSegment);
      const segments = engine.getAllSegments();
      
      expect(segments.some(s => s.segmentId === 'custom-test')).toBe(true);
    });

    it('should update segment strategies', () => {
      const newStrategy: InterventionStrategy = {
        strategyId: 'test-strategy',
        type: 'nudge',
        trigger: {
          eventType: 'page_view',
          conditions: {}
        },
        content: {
          title: 'Test',
          message: 'Test message'
        },
        channels: ['in_app'],
        timing: {
          delay: 0
        }
      };

      const success = engine.updateSegmentStrategies('young-high-engagement', [newStrategy]);
      expect(success).toBe(true);

      const segments = engine.getAllSegments();
      const updatedSegment = segments.find(s => s.segmentId === 'young-high-engagement');
      expect(updatedSegment?.interventionStrategies).toHaveLength(1);
      expect(updatedSegment?.interventionStrategies[0].strategyId).toBe('test-strategy');
    });

    it('should return false when updating non-existent segment', () => {
      const success = engine.updateSegmentStrategies('non-existent', []);
      expect(success).toBe(false);
    });

    it('should filter users by segment', () => {
      const users: UserProfile[] = [
        {
          userId: 'young-user',
          demographics: {
            ageGroup: '22-30',
            registrationDate: new Date('2023-01-01'),
            lastActiveDate: new Date('2024-01-15')
          },
          engagementMetrics: {
            totalSessions: 25,
            averageSessionDuration: 350,
            featuresUsed: ['claims', 'benefits', 'documents', 'chat', 'payments', 'profile'],
            digitalTasksCompleted: 15,
            traditionalChannelUsage: {
              phoneCallsLastMonth: 0,
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
          userId: 'senior-user',
          demographics: {
            ageGroup: '66+',
            registrationDate: new Date('2023-06-01'),
            lastActiveDate: new Date('2024-01-10')
          },
          engagementMetrics: {
            totalSessions: 3,
            averageSessionDuration: 45,
            featuresUsed: ['benefits'],
            digitalTasksCompleted: 1,
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

      const youngUsers = engine.getUsersInSegment('young-high-engagement', users);
      const seniorUsers = engine.getUsersInSegment('senior-low-engagement', users);

      expect(youngUsers).toHaveLength(1);
      expect(youngUsers[0].userId).toBe('young-user');
      expect(seniorUsers).toHaveLength(1);
      expect(seniorUsers[0].userId).toBe('senior-user');
    });

    it('should return empty array for non-existent segment', () => {
      const users: UserProfile[] = [];
      const result = engine.getUsersInSegment('non-existent', users);
      expect(result).toEqual([]);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle users with minimal data', () => {
      const minimalProfile: UserProfile = {
        userId: 'minimal-user',
        demographics: {
          ageGroup: '31-40',
          registrationDate: new Date('2024-01-01'),
          lastActiveDate: new Date('2024-01-01')
        },
        engagementMetrics: {
          totalSessions: 0,
          averageSessionDuration: 0,
          featuresUsed: [],
          digitalTasksCompleted: 0,
          traditionalChannelUsage: {
            phoneCallsLastMonth: 0,
            paperFormsLastMonth: 0
          }
        },
        preferences: {
          communicationChannels: [],
          notificationFrequency: 'low',
          contentComplexity: 'simple'
        },
        consentStatus: []
      };

      const segment = engine.segmentUser(minimalProfile);
      expect(segment).toBeDefined();
      // Minimal user with 31-40 age group and low engagement should match professional-low-engagement
      expect(segment?.segmentId).toBe('professional-low-engagement');
      expect(segment?.criteria.engagementLevel).toBe('low');
      expect(segment?.criteria.digitalLiteracy).toBe('beginner');
    });

    it('should handle extreme engagement values', () => {
      const extremeProfile: UserProfile = {
        userId: 'extreme-user',
        demographics: {
          ageGroup: '22-30',
          registrationDate: new Date('2023-01-01'),
          lastActiveDate: new Date('2024-01-15')
        },
        engagementMetrics: {
          totalSessions: 1000,
          averageSessionDuration: 3600,
          featuresUsed: Array.from({ length: 20 }, (_, i) => `feature-${i}`),
          digitalTasksCompleted: 100,
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

      const segment = engine.segmentUser(extremeProfile);
      expect(segment).toBeDefined();
      expect(segment?.criteria.engagementLevel).toBe('high');
      expect(segment?.criteria.digitalLiteracy).toBe('advanced');
    });

    it('should handle all age groups correctly', () => {
      const ageGroups: Array<'22-30' | '31-40' | '41-55' | '56-65' | '66+'> = 
        ['22-30', '31-40', '41-55', '56-65', '66+'];

      ageGroups.forEach(ageGroup => {
        const profile: UserProfile = {
          userId: `user-${ageGroup}`,
          demographics: {
            ageGroup,
            registrationDate: new Date('2023-01-01'),
            lastActiveDate: new Date('2024-01-15')
          },
          engagementMetrics: {
            totalSessions: 10,
            averageSessionDuration: 120,
            featuresUsed: ['benefits', 'profile'],
            digitalTasksCompleted: 3,
            traditionalChannelUsage: {
              phoneCallsLastMonth: 1,
              paperFormsLastMonth: 0
            }
          },
          preferences: {
            communicationChannels: ['email'],
            notificationFrequency: 'medium',
            contentComplexity: 'simple'
          },
          consentStatus: []
        };

        const segment = engine.segmentUser(profile);
        expect(segment).toBeDefined();
        expect(segment?.segmentId).toBeDefined();
      });
    });
  });

  describe('Intervention Strategies', () => {
    it('should provide appropriate strategies for each segment type', () => {
      const segments = engine.getAllSegments();
      
      segments.forEach(segment => {
        expect(segment.interventionStrategies).toBeDefined();
        expect(segment.interventionStrategies.length).toBeGreaterThan(0);
        
        segment.interventionStrategies.forEach(strategy => {
          expect(strategy.strategyId).toBeDefined();
          expect(strategy.type).toMatch(/^(nudge|incentive|education|gamification)$/);
          expect(strategy.content.title).toBeDefined();
          expect(strategy.content.message).toBeDefined();
          expect(strategy.channels.length).toBeGreaterThan(0);
        });
      });
    });

    it('should have age-appropriate strategies', () => {
      const youngSegment = engine.getAllSegments()
        .find(s => s.segmentId === 'young-high-engagement');
      const seniorSegment = engine.getAllSegments()
        .find(s => s.segmentId === 'senior-low-engagement');

      expect(youngSegment?.interventionStrategies[0].type).toBe('gamification');
      expect(seniorSegment?.interventionStrategies[0].type).toBe('education');
    });
  });
});