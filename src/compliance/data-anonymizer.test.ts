import { describe, it, expect, beforeEach } from 'vitest';
import { DataAnonymizer } from './data-anonymizer';
import { DataAnonymizationConfig } from './interfaces';

describe('DataAnonymizer', () => {
  let dataAnonymizer: DataAnonymizer;
  let config: DataAnonymizationConfig;

  beforeEach(() => {
    config = {
      hashSalt: 'test-salt-12345',
      pseudonymizationKey: 'test-key-67890',
      retentionPolicies: {
        user_event: 365, // 1 year
        user_profile: 730, // 2 years
        analytics_event: 90, // 3 months
        generic: 30, // 1 month
      },
    };
    dataAnonymizer = new DataAnonymizer(config);
  });

  describe('pseudonymizeUserId', () => {
    it('should create consistent pseudonymized user ID', () => {
      const userId = 'user123';
      
      const pseudo1 = dataAnonymizer.pseudonymizeUserId(userId);
      const pseudo2 = dataAnonymizer.pseudonymizeUserId(userId);
      
      expect(pseudo1).toBe(pseudo2);
      expect(pseudo1).toMatch(/^pseudo_[a-f0-9]{16}$/);
      expect(pseudo1).not.toBe(userId);
    });

    it('should create different pseudonyms for different users', () => {
      const pseudo1 = dataAnonymizer.pseudonymizeUserId('user1');
      const pseudo2 = dataAnonymizer.pseudonymizeUserId('user2');
      
      expect(pseudo1).not.toBe(pseudo2);
    });

    it('should throw error for empty user ID', () => {
      expect(() => dataAnonymizer.pseudonymizeUserId('')).toThrow('UserId is required for pseudonymization');
    });
  });

  describe('hashSensitiveData', () => {
    it('should hash sensitive data consistently', () => {
      const data = 'sensitive-info';
      
      const hash1 = dataAnonymizer.hashSensitiveData(data);
      const hash2 = dataAnonymizer.hashSensitiveData(data);
      
      expect(hash1).toBe(hash2);
      expect(hash1).toMatch(/^[a-f0-9]{64}$/); // SHA-256 hex string
      expect(hash1).not.toBe(data);
    });

    it('should return empty string for empty input', () => {
      expect(dataAnonymizer.hashSensitiveData('')).toBe('');
    });

    it('should create different hashes for different data', () => {
      const hash1 = dataAnonymizer.hashSensitiveData('data1');
      const hash2 = dataAnonymizer.hashSensitiveData('data2');
      
      expect(hash1).not.toBe(hash2);
    });
  });

  describe('generateSessionId', () => {
    it('should generate unique session IDs', () => {
      const session1 = dataAnonymizer.generateSessionId();
      const session2 = dataAnonymizer.generateSessionId();
      
      expect(session1).not.toBe(session2);
      expect(session1).toMatch(/^session_[a-f0-9]{32}$/);
      expect(session2).toMatch(/^session_[a-f0-9]{32}$/);
    });
  });

  describe('anonymizeIpAddress', () => {
    it('should anonymize IPv4 addresses', () => {
      const ipv4 = '192.168.1.100';
      const anonymized = dataAnonymizer.anonymizeIpAddress(ipv4);
      
      expect(anonymized).toBe('192.168.1.0');
    });

    it('should anonymize IPv6 addresses', () => {
      const ipv6 = '2001:0db8:85a3:0000:0000:8a2e:0370:7334';
      const anonymized = dataAnonymizer.anonymizeIpAddress(ipv6);
      
      expect(anonymized).toBe('2001:0db8:85a3:0000::');
    });

    it('should handle invalid IP addresses', () => {
      expect(dataAnonymizer.anonymizeIpAddress('invalid-ip')).toBe('anonymized');
      expect(dataAnonymizer.anonymizeIpAddress('')).toBe('');
    });
  });

  describe('minimizeEventData', () => {
    it('should minimize user event data', () => {
      const eventData = {
        userId: 'user123',
        ipAddress: '192.168.1.100',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        gpsCoordinates: { lat: 40.7128, lng: -74.0060 },
        detailedLocation: '123 Main St, New York, NY',
        eventType: 'page_view',
        timestamp: new Date(),
      };

      const minimized = dataAnonymizer.minimizeEventData(eventData, 'user_event');

      expect(minimized.userId).toMatch(/^pseudo_[a-f0-9]{16}$/);
      expect(minimized.ipAddress).toBe('192.168.1.0');
      expect(minimized.userAgent).toContain('X.X');
      expect(minimized.gpsCoordinates).toBeUndefined();
      expect(minimized.detailedLocation).toBeUndefined();
      expect(minimized.eventType).toBe('page_view'); // Non-sensitive data preserved
    });

    it('should minimize user profile data', () => {
      const profileData = {
        userId: 'user123',
        email: 'user@example.com',
        phoneNumber: '+1234567890',
        fullName: 'John Doe',
        address: '123 Main St',
        demographics: {
          age: 30,
          location: 'New York, NY, USA',
          gender: 'male',
        },
        preferences: {
          notifications: true,
        },
      };

      const minimized = dataAnonymizer.minimizeEventData(profileData, 'user_profile');

      expect(minimized.userId).toMatch(/^pseudo_[a-f0-9]{16}$/);
      expect(minimized.email).toBeUndefined();
      expect(minimized.phoneNumber).toBeUndefined();
      expect(minimized.fullName).toBeUndefined();
      expect(minimized.address).toBeUndefined();
      expect(minimized.demographics?.ageGroup).toBe('25-34');
      expect(minimized.demographics?.locationRegion).toBe('USA');
      expect(minimized.preferences).toEqual({ notifications: true }); // Non-sensitive data preserved
    });

    it('should throw error for unknown data type', () => {
      const data = { test: 'value' };
      
      expect(() => dataAnonymizer.minimizeEventData(data, 'unknown_type')).toThrow(
        'No retention policy defined for data type: unknown_type'
      );
    });
  });

  describe('shouldRetainData', () => {
    it('should retain recent data within retention period', () => {
      const recentDate = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000); // 10 days ago
      
      expect(dataAnonymizer.shouldRetainData(recentDate, 'generic')).toBe(true); // 30 day policy
    });

    it('should not retain old data beyond retention period', () => {
      const oldDate = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000); // 40 days ago
      
      expect(dataAnonymizer.shouldRetainData(oldDate, 'generic')).toBe(false); // 30 day policy
    });

    it('should return false for undefined data type', () => {
      const recentDate = new Date();
      
      expect(dataAnonymizer.shouldRetainData(recentDate, 'undefined_type')).toBe(false);
    });
  });

  describe('getDataToPurge', () => {
    it('should identify data that should be purged', () => {
      const dataItems = [
        { id: '1', timestamp: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), dataType: 'generic' }, // 10 days - keep
        { id: '2', timestamp: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000), dataType: 'generic' }, // 40 days - purge
        { id: '3', timestamp: new Date(Date.now() - 100 * 24 * 60 * 60 * 1000), dataType: 'analytics_event' }, // 100 days - purge
        { id: '4', timestamp: new Date(Date.now() - 50 * 24 * 60 * 60 * 1000), dataType: 'analytics_event' }, // 50 days - keep (90 day policy)
      ];

      const toPurge = dataAnonymizer.getDataToPurge(dataItems);

      expect(toPurge).toHaveLength(2);
      expect(toPurge.map(item => item.id)).toEqual(['2', '3']);
    });

    it('should use default data type when not specified', () => {
      const dataItems = [
        { id: '1', timestamp: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000) }, // No dataType, uses default 'generic'
      ];

      const toPurge = dataAnonymizer.getDataToPurge(dataItems);

      expect(toPurge).toHaveLength(1);
    });
  });

  describe('anonymizeUserAgent', () => {
    it('should anonymize user agent string', () => {
      const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36';
      
      const anonymized = dataAnonymizer.anonymizeUserAgent(userAgent);
      
      expect(anonymized).toContain('X.X');
      expect(anonymized).toContain('(anonymized)');
      expect(anonymized).not.toContain('10.0');
      expect(anonymized).not.toContain('91.0.4472.124');
      expect(anonymized.length).toBeLessThanOrEqual(100);
    });

    it('should handle empty user agent', () => {
      expect(dataAnonymizer.anonymizeUserAgent('')).toBe('');
    });
  });

  describe('anonymizeDemographics', () => {
    it('should convert age to age group', () => {
      const demographics = { age: 30, location: 'New York, NY, USA', gender: 'male' };
      
      const anonymized = dataAnonymizer.anonymizeDemographics(demographics);
      
      expect(anonymized.ageGroup).toBe('25-34');
      expect(anonymized.locationRegion).toBe('USA');
      expect(anonymized.gender).toBe('male');
    });

    it('should handle different age ranges', () => {
      expect(dataAnonymizer.anonymizeDemographics({ age: 20 }).ageGroup).toBe('18-24');
      expect(dataAnonymizer.anonymizeDemographics({ age: 30 }).ageGroup).toBe('25-34');
      expect(dataAnonymizer.anonymizeDemographics({ age: 40 }).ageGroup).toBe('35-44');
      expect(dataAnonymizer.anonymizeDemographics({ age: 50 }).ageGroup).toBe('45-54');
      expect(dataAnonymizer.anonymizeDemographics({ age: 60 }).ageGroup).toBe('55-64');
      expect(dataAnonymizer.anonymizeDemographics({ age: 70 }).ageGroup).toBe('65+');
    });

    it('should generalize location to region', () => {
      const demographics = { location: 'Berlin, Germany' };
      
      const anonymized = dataAnonymizer.anonymizeDemographics(demographics);
      
      expect(anonymized.locationRegion).toBe('Germany');
    });

    it('should handle missing demographic data', () => {
      const anonymized = dataAnonymizer.anonymizeDemographics({});
      
      expect(anonymized).toEqual({});
    });
  });

  describe('data retention policies', () => {
    it('should apply different retention periods for different data types', () => {
      const now = Date.now();
      const dates = {
        recent: new Date(now - 10 * 24 * 60 * 60 * 1000), // 10 days ago
        medium: new Date(now - 100 * 24 * 60 * 60 * 1000), // 100 days ago
        old: new Date(now - 400 * 24 * 60 * 60 * 1000), // 400 days ago
        veryOld: new Date(now - 800 * 24 * 60 * 60 * 1000), // 800 days ago
      };

      // Generic data (30 days)
      expect(dataAnonymizer.shouldRetainData(dates.recent, 'generic')).toBe(true);
      expect(dataAnonymizer.shouldRetainData(dates.medium, 'generic')).toBe(false);

      // Analytics events (90 days)
      expect(dataAnonymizer.shouldRetainData(dates.recent, 'analytics_event')).toBe(true);
      expect(dataAnonymizer.shouldRetainData(dates.medium, 'analytics_event')).toBe(false);

      // User events (365 days)
      expect(dataAnonymizer.shouldRetainData(dates.recent, 'user_event')).toBe(true);
      expect(dataAnonymizer.shouldRetainData(dates.medium, 'user_event')).toBe(true);
      expect(dataAnonymizer.shouldRetainData(dates.old, 'user_event')).toBe(false);

      // User profiles (730 days)
      expect(dataAnonymizer.shouldRetainData(dates.recent, 'user_profile')).toBe(true);
      expect(dataAnonymizer.shouldRetainData(dates.medium, 'user_profile')).toBe(true);
      expect(dataAnonymizer.shouldRetainData(dates.old, 'user_profile')).toBe(true);
      expect(dataAnonymizer.shouldRetainData(dates.veryOld, 'user_profile')).toBe(false);
    });
  });

  describe('GDPR compliance scenarios', () => {
    it('should properly pseudonymize user data for analytics', () => {
      const userData = {
        userId: 'real-user-123',
        email: 'user@example.com',
        sessionId: 'session-abc-123',
        ipAddress: '192.168.1.100',
        eventType: 'login',
        timestamp: new Date(),
      };

      const anonymized = dataAnonymizer.minimizeEventData(userData, 'analytics_event');

      // Should pseudonymize identifiers
      expect(anonymized.userId).toMatch(/^pseudo_[a-f0-9]{16}$/);
      expect(anonymized.userId).not.toBe(userData.userId);
      
      // Should hash session ID
      expect(anonymized.sessionId).toMatch(/^[a-f0-9]{64}$/);
      expect(anonymized.sessionId).not.toBe(userData.sessionId);
      
      // Should preserve non-sensitive data
      expect(anonymized.eventType).toBe('login');
      expect(anonymized.timestamp).toBe(userData.timestamp);
    });

    it('should support data minimization for different purposes', () => {
      const fullUserData = {
        userId: 'user123',
        email: 'user@example.com',
        phoneNumber: '+1234567890',
        fullName: 'John Doe',
        address: '123 Main St',
        preferences: { theme: 'dark' },
        lastLogin: new Date(),
      };

      const minimizedForAnalytics = dataAnonymizer.minimizeEventData(fullUserData, 'user_profile');

      // Should remove direct identifiers
      expect(minimizedForAnalytics.email).toBeUndefined();
      expect(minimizedForAnalytics.phoneNumber).toBeUndefined();
      expect(minimizedForAnalytics.fullName).toBeUndefined();
      expect(minimizedForAnalytics.address).toBeUndefined();
      
      // Should preserve non-sensitive data
      expect(minimizedForAnalytics.preferences).toEqual({ theme: 'dark' });
      expect(minimizedForAnalytics.lastLogin).toBe(fullUserData.lastLogin);
      
      // Should pseudonymize user ID
      expect(minimizedForAnalytics.userId).toMatch(/^pseudo_[a-f0-9]{16}$/);
    });

    it('should ensure consistent pseudonymization across sessions', () => {
      const userId = 'consistent-user-123';
      
      // Create multiple anonymizers with same config
      const anonymizer1 = new DataAnonymizer(config);
      const anonymizer2 = new DataAnonymizer(config);
      
      const pseudo1 = anonymizer1.pseudonymizeUserId(userId);
      const pseudo2 = anonymizer2.pseudonymizeUserId(userId);
      
      // Should produce same pseudonym with same key
      expect(pseudo1).toBe(pseudo2);
    });
  });
});