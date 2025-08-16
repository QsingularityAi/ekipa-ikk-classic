import { describe, it, expect, beforeEach } from 'vitest';
import { 
  InMemoryUserProfileRepository, 
  InMemoryAnalyticsEventRepository 
} from './repositories';
import { UserProfile, UserEvent } from '../types';

describe('InMemoryUserProfileRepository', () => {
  let repository: InMemoryUserProfileRepository;
  let mockProfile: UserProfile;

  beforeEach(() => {
    repository = new InMemoryUserProfileRepository();
    mockProfile = {
      userId: 'user-123',
      demographics: {
        ageGroup: '31-40',
        registrationDate: new Date('2024-01-01'),
        lastActiveDate: new Date('2024-01-15')
      },
      engagementMetrics: {
        totalSessions: 10,
        averageSessionDuration: 300,
        featuresUsed: ['dashboard', 'profile', 'settings'],
        digitalTasksCompleted: 5,
        traditionalChannelUsage: {
          phoneCallsLastMonth: 2,
          paperFormsLastMonth: 1
        }
      },
      preferences: {
        communicationChannels: ['push', 'email'],
        notificationFrequency: 'medium',
        contentComplexity: 'detailed'
      },
      consentStatus: [
        {
          userId: 'user-123',
          consentType: 'analytics',
          granted: true,
          timestamp: new Date('2024-01-01'),
          version: '1.0'
        }
      ]
    };
  });

  describe('CRUD operations', () => {
    it('should create a new user profile', async () => {
      const result = await repository.create(mockProfile);

      expect(result).toEqual(mockProfile);
      expect(result.demographics.registrationDate).toBeInstanceOf(Date);
      expect(result.demographics.lastActiveDate).toBeInstanceOf(Date);
    });

    it('should throw error when creating duplicate profile', async () => {
      await repository.create(mockProfile);

      await expect(repository.create(mockProfile))
        .rejects.toThrow('User profile already exists for userId: user-123');
    });

    it('should find profile by ID', async () => {
      await repository.create(mockProfile);

      const result = await repository.findById('user-123');
      expect(result).toEqual(mockProfile);
    });

    it('should return null for non-existent profile', async () => {
      const result = await repository.findById('non-existent');
      expect(result).toBeNull();
    });

    it('should update existing profile', async () => {
      await repository.create(mockProfile);

      const updates = {
        engagementMetrics: {
          ...mockProfile.engagementMetrics,
          totalSessions: 15,
          digitalTasksCompleted: 8
        }
      };

      const result = await repository.update('user-123', updates);

      expect(result).not.toBeNull();
      expect(result!.engagementMetrics.totalSessions).toBe(15);
      expect(result!.engagementMetrics.digitalTasksCompleted).toBe(8);
      expect(result!.demographics.lastActiveDate).toBeInstanceOf(Date);
    });

    it('should return null when updating non-existent profile', async () => {
      const result = await repository.update('non-existent', {});
      expect(result).toBeNull();
    });

    it('should delete existing profile', async () => {
      await repository.create(mockProfile);

      const result = await repository.delete('user-123');
      expect(result).toBe(true);

      const profile = await repository.findById('user-123');
      expect(profile).toBeNull();
    });

    it('should return false when deleting non-existent profile', async () => {
      const result = await repository.delete('non-existent');
      expect(result).toBe(false);
    });
  });

  describe('query operations', () => {
    beforeEach(async () => {
      // Create multiple profiles for testing
      const profiles = [
        { ...mockProfile, userId: 'user-1', demographics: { ...mockProfile.demographics, ageGroup: '22-30' as const } },
        { ...mockProfile, userId: 'user-2', demographics: { ...mockProfile.demographics, ageGroup: '31-40' as const } },
        { ...mockProfile, userId: 'user-3', demographics: { ...mockProfile.demographics, ageGroup: '31-40' as const } },
        { 
          ...mockProfile, 
          userId: 'user-4', 
          demographics: { 
            ...mockProfile.demographics, 
            ageGroup: '41-55' as const,
            lastActiveDate: new Date('2023-12-01') // Inactive user
          },
          engagementMetrics: {
            ...mockProfile.engagementMetrics,
            totalSessions: 1, // Low engagement
            digitalTasksCompleted: 0
          }
        }
      ];

      for (const profile of profiles) {
        await repository.create(profile);
      }
    });

    it('should find profiles by age group', async () => {
      const result = await repository.findByAgeGroup('31-40');
      expect(result).toHaveLength(2);
      expect(result.every(p => p.demographics.ageGroup === '31-40')).toBe(true);
    });

    it('should find profiles by engagement level', async () => {
      const allProfiles = await repository.getAllProfiles();
      expect(allProfiles.length).toBe(4);

      const highEngagement = await repository.findByEngagementLevel('high');
      const mediumEngagement = await repository.findByEngagementLevel('medium');
      const lowEngagement = await repository.findByEngagementLevel('low');

      // At least one profile should be in each category
      const totalCategorized = highEngagement.length + mediumEngagement.length + lowEngagement.length;
      expect(totalCategorized).toBe(4);
      
      // We should have at least some low engagement users (user-4 was designed to be low)
      expect(lowEngagement.length).toBeGreaterThan(0);
    });

    it('should find inactive users', async () => {
      const inactiveUsers = await repository.findInactive(30); // 30 days
      expect(inactiveUsers.length).toBeGreaterThan(0);
      
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - 30);
      
      for (const user of inactiveUsers) {
        expect(user.demographics.lastActiveDate.getTime()).toBeLessThan(cutoffDate.getTime());
      }
    });

    it('should perform bulk updates', async () => {
      const updates = [
        { userId: 'user-1', updates: { engagementMetrics: { ...mockProfile.engagementMetrics, totalSessions: 20 } } },
        { userId: 'user-2', updates: { engagementMetrics: { ...mockProfile.engagementMetrics, totalSessions: 25 } } },
        { userId: 'non-existent', updates: { engagementMetrics: { ...mockProfile.engagementMetrics, totalSessions: 30 } } }
      ];

      const updatedCount = await repository.bulkUpdate(updates);
      expect(updatedCount).toBe(2); // Only 2 existing users updated

      const user1 = await repository.findById('user-1');
      const user2 = await repository.findById('user-2');
      
      expect(user1!.engagementMetrics.totalSessions).toBe(20);
      expect(user2!.engagementMetrics.totalSessions).toBe(25);
    });
  });

  describe('utility methods', () => {
    it('should get all profiles', async () => {
      await repository.create(mockProfile);
      await repository.create({ ...mockProfile, userId: 'user-2' });

      const profiles = await repository.getAllProfiles();
      expect(profiles).toHaveLength(2);
    });

    it('should get profile count', async () => {
      expect(await repository.getCount()).toBe(0);

      await repository.create(mockProfile);
      expect(await repository.getCount()).toBe(1);

      await repository.create({ ...mockProfile, userId: 'user-2' });
      expect(await repository.getCount()).toBe(2);
    });

    it('should clear all profiles', async () => {
      await repository.create(mockProfile);
      await repository.create({ ...mockProfile, userId: 'user-2' });

      await repository.clear();
      expect(await repository.getCount()).toBe(0);
    });
  });
});

describe('InMemoryAnalyticsEventRepository', () => {
  let repository: InMemoryAnalyticsEventRepository;
  let mockEvent: UserEvent;

  beforeEach(() => {
    repository = new InMemoryAnalyticsEventRepository();
    mockEvent = {
      eventId: 'event-123',
      userId: 'user-456',
      sessionId: 'session-789',
      timestamp: new Date('2024-01-15T10:00:00Z'),
      eventType: 'page_view',
      metadata: {
        screenName: 'dashboard',
        featureId: 'main-nav',
        duration: 5000,
        success: true
      },
      userContext: {
        ageGroup: '31-40',
        digitalLiteracyScore: 75,
        preferredChannel: 'push'
      }
    };
  });

  describe('storage operations', () => {
    it('should store a single event', async () => {
      await repository.store(mockEvent);

      const events = await repository.getAllEvents();
      expect(events).toHaveLength(1);
      expect(events[0]).toEqual(mockEvent);
    });

    it('should store batch of events', async () => {
      const events = [
        mockEvent,
        { ...mockEvent, eventId: 'event-2', timestamp: new Date('2024-01-15T10:01:00Z') },
        { ...mockEvent, eventId: 'event-3', timestamp: new Date('2024-01-15T10:02:00Z') }
      ];

      await repository.storeBatch(events);

      const storedEvents = await repository.getAllEvents();
      expect(storedEvents).toHaveLength(3);
      
      // Should be sorted by timestamp
      expect(storedEvents[0].timestamp.getTime()).toBeLessThanOrEqual(storedEvents[1].timestamp.getTime());
      expect(storedEvents[1].timestamp.getTime()).toBeLessThanOrEqual(storedEvents[2].timestamp.getTime());
    });

    it('should maintain indexes when storing events', async () => {
      const events = [
        mockEvent,
        { ...mockEvent, eventId: 'event-2', userId: 'user-2', eventType: 'feature_usage' },
        { ...mockEvent, eventId: 'event-3', sessionId: 'session-2' }
      ];

      await repository.storeBatch(events);

      // Test user index
      const userEvents = await repository.findByUserId('user-456');
      expect(userEvents).toHaveLength(2);

      // Test event type index
      const pageViewEvents = await repository.findByEventType('page_view');
      expect(pageViewEvents).toHaveLength(2);

      // Test session index
      const sessionEvents = await repository.findBySessionId('session-789');
      expect(sessionEvents).toHaveLength(2);
    });
  });

  describe('query operations', () => {
    beforeEach(async () => {
      // Create test data
      const events = [
        { ...mockEvent, eventId: 'event-1', timestamp: new Date('2024-01-15T10:00:00Z') },
        { ...mockEvent, eventId: 'event-2', timestamp: new Date('2024-01-15T11:00:00Z'), eventType: 'feature_usage' as const },
        { ...mockEvent, eventId: 'event-3', timestamp: new Date('2024-01-16T10:00:00Z'), userId: 'user-2' },
        { ...mockEvent, eventId: 'event-4', timestamp: new Date('2024-01-17T10:00:00Z'), sessionId: 'session-2' },
        { ...mockEvent, eventId: 'event-5', timestamp: new Date('2024-01-18T10:00:00Z') }
      ];

      await repository.storeBatch(events);
    });

    it('should find events by user ID', async () => {
      const events = await repository.findByUserId('user-456');
      expect(events).toHaveLength(4);
      expect(events.every(e => e.userId === 'user-456')).toBe(true);
    });

    it('should find events by user ID with date range', async () => {
      const startDate = new Date('2024-01-15T00:00:00Z');
      const endDate = new Date('2024-01-16T00:00:00Z');

      const events = await repository.findByUserId('user-456', startDate, endDate);
      expect(events).toHaveLength(2);
      
      for (const event of events) {
        expect(event.timestamp.getTime()).toBeGreaterThanOrEqual(startDate.getTime());
        expect(event.timestamp.getTime()).toBeLessThanOrEqual(endDate.getTime());
      }
    });

    it('should find events by event type', async () => {
      const events = await repository.findByEventType('page_view');
      expect(events).toHaveLength(4);
      expect(events.every(e => e.eventType === 'page_view')).toBe(true);
    });

    it('should find events by session ID', async () => {
      const events = await repository.findBySessionId('session-789');
      expect(events).toHaveLength(4);
      expect(events.every(e => e.sessionId === 'session-789')).toBe(true);
    });

    it('should find events by date range', async () => {
      const startDate = new Date('2024-01-16T00:00:00Z');
      const endDate = new Date('2024-01-17T23:59:59Z');

      const events = await repository.findByDateRange(startDate, endDate);
      expect(events).toHaveLength(2);
      
      for (const event of events) {
        expect(event.timestamp.getTime()).toBeGreaterThanOrEqual(startDate.getTime());
        expect(event.timestamp.getTime()).toBeLessThanOrEqual(endDate.getTime());
      }
    });
  });

  describe('aggregation operations', () => {
    beforeEach(async () => {
      const events = [
        { ...mockEvent, eventId: 'event-1', eventType: 'page_view' as const, timestamp: new Date('2024-01-15T10:00:00Z') },
        { ...mockEvent, eventId: 'event-2', eventType: 'page_view' as const, timestamp: new Date('2024-01-15T11:00:00Z') },
        { ...mockEvent, eventId: 'event-3', eventType: 'feature_usage' as const, timestamp: new Date('2024-01-15T12:00:00Z') },
        { ...mockEvent, eventId: 'event-4', eventType: 'task_completion' as const, timestamp: new Date('2024-01-15T13:00:00Z') },
        { ...mockEvent, eventId: 'event-5', eventType: 'page_view' as const, timestamp: new Date('2024-01-16T10:00:00Z') }
      ];

      await repository.storeBatch(events);
    });

    it('should aggregate events by type', async () => {
      const startDate = new Date('2024-01-15T00:00:00Z');
      const endDate = new Date('2024-01-15T23:59:59Z');

      const aggregation = await repository.aggregateByEventType(startDate, endDate);

      expect(aggregation).toEqual({
        page_view: 2,
        feature_usage: 1,
        task_completion: 1
      });
    });

    it('should aggregate events by user', async () => {
      const startDate = new Date('2024-01-15T00:00:00Z');
      const endDate = new Date('2024-01-16T23:59:59Z');

      const aggregation = await repository.aggregateByUser('user-456', startDate, endDate);

      expect(aggregation.totalEvents).toBe(5);
      expect(aggregation.eventTypes).toEqual({
        page_view: 3,
        feature_usage: 1,
        task_completion: 1
      });
      expect(aggregation.averageSessionDuration).toBe(5000);
      expect(aggregation.uniqueSessions).toBe(1);
    });
  });

  describe('maintenance operations', () => {
    beforeEach(async () => {
      const events = [
        { ...mockEvent, eventId: 'event-1', timestamp: new Date('2024-01-01T10:00:00Z') }, // Old
        { ...mockEvent, eventId: 'event-2', timestamp: new Date('2024-01-10T10:00:00Z') }, // Old
        { ...mockEvent, eventId: 'event-3', timestamp: new Date('2024-01-20T10:00:00Z') }, // Recent
        { ...mockEvent, eventId: 'event-4', timestamp: new Date('2024-01-25T10:00:00Z') }  // Recent
      ];

      await repository.storeBatch(events);
    });

    it('should delete old events', async () => {
      const cutoffDate = new Date('2024-01-15T00:00:00Z');
      const deletedCount = await repository.deleteOldEvents(cutoffDate);

      expect(deletedCount).toBe(2);

      const remainingEvents = await repository.getAllEvents();
      expect(remainingEvents).toHaveLength(2);
      
      for (const event of remainingEvents) {
        expect(event.timestamp.getTime()).toBeGreaterThanOrEqual(cutoffDate.getTime());
      }
    });

    it('should get event count', async () => {
      const totalCount = await repository.getEventCount();
      expect(totalCount).toBe(4);

      const startDate = new Date('2024-01-15T00:00:00Z');
      const endDate = new Date('2024-01-30T00:00:00Z');
      const rangeCount = await repository.getEventCount(startDate, endDate);
      expect(rangeCount).toBe(2);
    });

    it('should clear all events', async () => {
      await repository.clear();

      const events = await repository.getAllEvents();
      expect(events).toHaveLength(0);

      const stats = await repository.getStats();
      expect(stats.totalEvents).toBe(0);
      expect(stats.uniqueUsers).toBe(0);
      expect(stats.uniqueSessions).toBe(0);
    });
  });

  describe('statistics', () => {
    beforeEach(async () => {
      const events = [
        { ...mockEvent, eventId: 'event-1', userId: 'user-1', sessionId: 'session-1', eventType: 'page_view' as const, timestamp: new Date('2024-01-15T10:00:00Z') },
        { ...mockEvent, eventId: 'event-2', userId: 'user-1', sessionId: 'session-2', eventType: 'feature_usage' as const, timestamp: new Date('2024-01-15T11:00:00Z') },
        { ...mockEvent, eventId: 'event-3', userId: 'user-2', sessionId: 'session-3', eventType: 'page_view' as const, timestamp: new Date('2024-01-16T10:00:00Z') },
        { ...mockEvent, eventId: 'event-4', userId: 'user-2', sessionId: 'session-3', eventType: 'task_completion' as const, timestamp: new Date('2024-01-17T10:00:00Z') }
      ];

      await repository.storeBatch(events);
    });

    it('should provide comprehensive statistics', async () => {
      const stats = await repository.getStats();

      expect(stats.totalEvents).toBe(4);
      expect(stats.uniqueUsers).toBe(2);
      expect(stats.uniqueSessions).toBe(3);
      expect(stats.eventTypes).toEqual(['page_view', 'feature_usage', 'task_completion']);
      expect(stats.dateRange.earliest).toEqual(new Date('2024-01-15T10:00:00Z'));
      expect(stats.dateRange.latest).toEqual(new Date('2024-01-17T10:00:00Z'));
    });

    it('should handle empty repository statistics', async () => {
      await repository.clear();
      const stats = await repository.getStats();

      expect(stats.totalEvents).toBe(0);
      expect(stats.uniqueUsers).toBe(0);
      expect(stats.uniqueSessions).toBe(0);
      expect(stats.eventTypes).toEqual([]);
      expect(stats.dateRange.earliest).toBeNull();
      expect(stats.dateRange.latest).toBeNull();
    });
  });
});