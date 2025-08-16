import { describe, it, expect } from 'vitest';
import { UserEvent, ConsentRecord, UserProfile, InterventionStrategy } from './index';

describe('Core Types', () => {
  it('should define UserEvent interface correctly', () => {
    const userEvent: UserEvent = {
      eventId: 'test-event-1',
      userId: 'user-123',
      sessionId: 'session-456',
      timestamp: new Date(),
      eventType: 'page_view',
      metadata: {
        screenName: 'dashboard',
        duration: 5000,
      },
      userContext: {
        ageGroup: '31-40',
        digitalLiteracyScore: 7,
        preferredChannel: 'push',
      },
    };

    expect(userEvent.eventId).toBe('test-event-1');
    expect(userEvent.eventType).toBe('page_view');
  });

  it('should define ConsentRecord interface correctly', () => {
    const consentRecord: ConsentRecord = {
      userId: 'user-123',
      consentType: 'analytics',
      granted: true,
      timestamp: new Date(),
      version: '1.0',
    };

    expect(consentRecord.consentType).toBe('analytics');
    expect(consentRecord.granted).toBe(true);
  });

  it('should define UserProfile interface correctly', () => {
    const userProfile: UserProfile = {
      userId: 'user-123',
      demographics: {
        ageGroup: '31-40',
        registrationDate: new Date(),
        lastActiveDate: new Date(),
      },
      engagementMetrics: {
        totalSessions: 10,
        averageSessionDuration: 300,
        featuresUsed: ['dashboard', 'claims'],
        digitalTasksCompleted: 5,
        traditionalChannelUsage: {
          phoneCallsLastMonth: 2,
          paperFormsLastMonth: 1,
        },
      },
      preferences: {
        communicationChannels: ['push', 'email'],
        notificationFrequency: 'medium',
        contentComplexity: 'simple',
      },
      consentStatus: [],
    };

    expect(userProfile.demographics.ageGroup).toBe('31-40');
    expect(userProfile.engagementMetrics.totalSessions).toBe(10);
  });

  it('should define InterventionStrategy interface correctly', () => {
    const strategy: InterventionStrategy = {
      strategyId: 'strategy-1',
      type: 'nudge',
      trigger: {
        eventType: 'abandonment',
        conditions: { screenName: 'claims' },
      },
      content: {
        title: 'Complete Your Claim',
        message: 'You were almost done! Complete your claim in just 2 more steps.',
        actionButton: 'Continue Claim',
      },
      channels: ['push', 'in_app'],
      timing: {
        delay: 300,
        frequency: 'once',
        expiresAfter: 86400,
      },
    };

    expect(strategy.type).toBe('nudge');
    expect(strategy.channels).toContain('push');
  });
});
