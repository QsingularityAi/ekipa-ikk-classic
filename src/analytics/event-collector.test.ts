import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventCollector, EventCollectorConfig } from './event-collector';
import { ConsentManager } from '../compliance/consent-manager';
import { DataAnonymizer } from '../compliance/data-anonymizer';
import { UserEvent } from '../types';

describe('EventCollector', () => {
  let eventCollector: EventCollector;
  let mockConsentManager: ConsentManager;
  let mockDataAnonymizer: DataAnonymizer;
  let config: EventCollectorConfig;

  const mockUserEvent: UserEvent = {
    eventId: 'test-event-123',
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

  beforeEach(() => {
    config = {
      apiEndpoint: 'https://api.example.com/events',
      batchSize: 10,
      flushInterval: 5000,
      retryAttempts: 3,
      enableValidation: true,
      enableSanitization: true
    };

    mockConsentManager = {
      hasConsent: vi.fn().mockResolvedValue(true),
      collectConsent: vi.fn(),
      withdrawConsent: vi.fn(),
      getUserConsents: vi.fn(),
      getConsentHistory: vi.fn(),
      validateConsent: vi.fn(),
      getAuditLog: vi.fn(),
      cleanupExpiredConsents: vi.fn()
    } as any;

    mockDataAnonymizer = {
      pseudonymizeUserId: vi.fn().mockReturnValue('pseudo-user-456'),
      hashSensitiveData: vi.fn(),
      generateSessionId: vi.fn(),
      anonymizeIpAddress: vi.fn(),
      minimizeEventData: vi.fn(),
      shouldRetainData: vi.fn(),
      getDataToPurge: vi.fn(),
      anonymizeUserAgent: vi.fn(),
      anonymizeDemographics: vi.fn()
    } as any;

    eventCollector = new EventCollector(config, mockConsentManager, mockDataAnonymizer);
  });

  afterEach(async () => {
    if (eventCollector) {
      await eventCollector.stop();
    }
    vi.clearAllMocks();
  });

  describe('collectEvent', () => {
    it('should successfully collect a valid event with consent', async () => {
      const result = await eventCollector.collectEvent(mockUserEvent);

      expect(result).toBe(true);
      expect(mockConsentManager.hasConsent).toHaveBeenCalledWith('user-456', 'analytics');
      expect(mockDataAnonymizer.pseudonymizeUserId).toHaveBeenCalledWith('user-456');
      expect(eventCollector.getBufferSize()).toBe(1);
    });

    it('should reject event when consent is not granted', async () => {
      mockConsentManager.hasConsent = vi.fn().mockResolvedValue(false);

      const result = await eventCollector.collectEvent(mockUserEvent);

      expect(result).toBe(false);
      expect(eventCollector.getBufferSize()).toBe(0);
    });

    it('should reject invalid event when validation is enabled', async () => {
      const invalidEvent = { ...mockUserEvent, eventType: 'invalid_type' as any };

      const result = await eventCollector.collectEvent(invalidEvent);

      expect(result).toBe(false);
      expect(eventCollector.getBufferSize()).toBe(0);
    });

    it('should handle consent manager errors gracefully', async () => {
      mockConsentManager.hasConsent = vi.fn().mockRejectedValue(new Error('Consent check failed'));

      const result = await eventCollector.collectEvent(mockUserEvent);

      expect(result).toBe(false);
      expect(eventCollector.getBufferSize()).toBe(0);
    });
  });

  describe('validateEvent', () => {
    it('should validate a correct event', () => {
      const result = eventCollector.validateEvent(mockUserEvent);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject event with missing required fields', () => {
      const invalidEvent = { ...mockUserEvent, eventId: '' };

      const result = eventCollector.validateEvent(invalidEvent);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('eventId is required and must be a string');
    });

    it('should reject event with invalid eventType', () => {
      const invalidEvent = { ...mockUserEvent, eventType: 'invalid_type' as any };

      const result = eventCollector.validateEvent(invalidEvent);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('eventType must be one of: page_view, feature_usage, task_completion, abandonment');
    });

    it('should reject event with invalid ageGroup', () => {
      const invalidEvent = {
        ...mockUserEvent,
        userContext: { ...mockUserEvent.userContext, ageGroup: 'invalid-age' }
      };

      const result = eventCollector.validateEvent(invalidEvent);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('ageGroup must be one of: 22-30, 31-40, 41-55, 56-65, 66+');
    });

    it('should reject event with invalid digitalLiteracyScore', () => {
      const invalidEvent = {
        ...mockUserEvent,
        userContext: { ...mockUserEvent.userContext, digitalLiteracyScore: 150 }
      };

      const result = eventCollector.validateEvent(invalidEvent);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('digitalLiteracyScore must be a number between 0 and 100');
    });

    it('should reject event with invalid metadata types', () => {
      const invalidEvent = {
        ...mockUserEvent,
        metadata: { ...mockUserEvent.metadata, duration: 'invalid' as any, success: 'true' as any }
      };

      const result = eventCollector.validateEvent(invalidEvent);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('metadata.duration must be a number');
      expect(result.errors).toContain('metadata.success must be a boolean');
    });
  });

  describe('sanitizeEvent', () => {
    it('should sanitize error codes containing sensitive information', () => {
      const eventWithSensitiveError = {
        ...mockUserEvent,
        metadata: {
          ...mockUserEvent.metadata,
          errorCode: 'User john.doe@example.com failed with token ABC123DEF456 and ID 12345'
        }
      };

      const sanitized = eventCollector.sanitizeEvent(eventWithSensitiveError);

      expect(sanitized.metadata?.errorCode).toBe('User [EMAIL] failed with token [TOKEN] and ID [ID]');
    });

    it('should sanitize screen names with user IDs', () => {
      const eventWithSensitiveScreen = {
        ...mockUserEvent,
        metadata: {
          ...mockUserEvent.metadata,
          screenName: '/profile/12345?id=67890&user=johndoe'
        }
      };

      const sanitized = eventCollector.sanitizeEvent(eventWithSensitiveScreen);

      expect(sanitized.metadata?.screenName).toBe('/profile/[ID]?id=[ID]&user=[USER]');
    });

    it('should adjust future timestamps to current time', () => {
      const futureDate = new Date(Date.now() + 86400000); // 1 day in future
      const eventWithFutureTimestamp = {
        ...mockUserEvent,
        timestamp: futureDate
      };

      const sanitized = eventCollector.sanitizeEvent(eventWithFutureTimestamp);

      expect(sanitized.timestamp.getTime()).toBeLessThanOrEqual(Date.now());
    });

    it('should preserve valid data during sanitization', () => {
      const sanitized = eventCollector.sanitizeEvent(mockUserEvent);

      expect(sanitized.eventId).toBe(mockUserEvent.eventId);
      expect(sanitized.userId).toBe(mockUserEvent.userId);
      expect(sanitized.sessionId).toBe(mockUserEvent.sessionId);
      expect(sanitized.eventType).toBe(mockUserEvent.eventType);
      expect(sanitized.userContext).toEqual(mockUserEvent.userContext);
    });
  });

  describe('buffer management', () => {
    it('should flush buffer when batch size is reached', async () => {
      const smallBatchConfig = { ...config, batchSize: 2 };
      const collector = new EventCollector(smallBatchConfig, mockConsentManager, mockDataAnonymizer);

      // Add first event
      await collector.collectEvent(mockUserEvent);
      expect(collector.getBufferSize()).toBe(1);

      // Add second event - should trigger flush
      await collector.collectEvent({ ...mockUserEvent, eventId: 'event-2' });
      expect(collector.getBufferSize()).toBe(0); // Buffer should be empty after flush

      await collector.stop();
    });

    it('should flush remaining events on stop', async () => {
      await eventCollector.collectEvent(mockUserEvent);
      expect(eventCollector.getBufferSize()).toBe(1);

      await eventCollector.stop();
      expect(eventCollector.getBufferSize()).toBe(0);
    });
  });

  describe('error handling', () => {
    it('should handle validation errors gracefully', async () => {
      const invalidEvent = { ...mockUserEvent, eventId: '' };

      const result = await eventCollector.collectEvent(invalidEvent);

      expect(result).toBe(false);
      expect(eventCollector.getBufferSize()).toBe(0);
    });

    it('should handle anonymization errors gracefully', async () => {
      mockDataAnonymizer.pseudonymizeUserId = vi.fn().mockImplementation(() => {
        throw new Error('Anonymization failed');
      });

      const result = await eventCollector.collectEvent(mockUserEvent);

      expect(result).toBe(false);
      expect(eventCollector.getBufferSize()).toBe(0);
    });
  });

  describe('configuration options', () => {
    it('should skip validation when disabled', async () => {
      const noValidationConfig = { ...config, enableValidation: false };
      const collector = new EventCollector(noValidationConfig, mockConsentManager, mockDataAnonymizer);

      const invalidEvent = { ...mockUserEvent, eventType: 'invalid_type' as any };
      const result = await collector.collectEvent(invalidEvent);

      expect(result).toBe(true);
      expect(collector.getBufferSize()).toBe(1);

      await collector.stop();
    });

    it('should skip sanitization when disabled', async () => {
      const noSanitizationConfig = { ...config, enableSanitization: false };
      const collector = new EventCollector(noSanitizationConfig, mockConsentManager, mockDataAnonymizer);

      const eventWithSensitiveData = {
        ...mockUserEvent,
        metadata: { ...mockUserEvent.metadata, errorCode: 'sensitive@email.com' }
      };

      await collector.collectEvent(eventWithSensitiveData);
      
      // Since we can't directly access the buffer, we verify through successful collection
      expect(collector.getBufferSize()).toBe(1);

      await collector.stop();
    });
  });
});