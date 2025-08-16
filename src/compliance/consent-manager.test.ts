import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ConsentManager } from './consent-manager';
import { ConsentManagerConfig, ConsentRecord } from './interfaces';

describe('ConsentManager', () => {
  let consentManager: ConsentManager;
  let config: ConsentManagerConfig;

  beforeEach(() => {
    config = {
      consentVersion: '1.0.0',
      retentionPeriod: 365, // 1 year
      auditLogEnabled: true,
    };
    consentManager = new ConsentManager(config);
  });

  describe('collectConsent', () => {
    it('should collect consent successfully', async () => {
      const userId = 'user123';
      const consentType = 'analytics';
      const granted = true;

      const result = await consentManager.collectConsent(userId, consentType, granted);

      expect(result).toMatchObject({
        userId,
        consentType,
        granted,
        version: config.consentVersion,
      });
      expect(result.timestamp).toBeInstanceOf(Date);
    });

    it('should throw error for missing required fields', async () => {
      await expect(
        consentManager.collectConsent('', 'analytics', true)
      ).rejects.toThrow('UserId and consentType are required');
    });

    it('should store consent with metadata', async () => {
      const userId = 'user123';
      const metadata = {
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0...',
      };

      await consentManager.collectConsent(userId, 'analytics', true, metadata);
      
      const auditLog = await consentManager.getAuditLog(userId);
      expect(auditLog).toHaveLength(1);
      expect(auditLog[0]).toMatchObject({
        userId,
        action: 'consent_granted',
        ipAddress: metadata.ipAddress,
        userAgent: metadata.userAgent,
      });
    });
  });

  describe('withdrawConsent', () => {
    it('should withdraw consent successfully', async () => {
      const userId = 'withdraw-user-1';
      const consentType = 'analytics';

      // First grant consent
      await consentManager.collectConsent(userId, consentType, true);
      
      // Add small delay to ensure different timestamps
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // Then withdraw it
      await consentManager.withdrawConsent(userId, consentType);

      const hasConsent = await consentManager.hasConsent(userId, consentType);
      expect(hasConsent).toBe(false);
    });

    it('should create audit log entry for withdrawal', async () => {
      const userId = 'withdraw-user-2';
      const consentType = 'analytics';

      await consentManager.withdrawConsent(userId, consentType);

      const auditLog = await consentManager.getAuditLog(userId);
      expect(auditLog).toHaveLength(1);
      expect(auditLog[0].action).toBe('consent_withdrawn');
    });
  });

  describe('hasConsent', () => {
    it('should return true for granted consent', async () => {
      const userId = 'has-consent-user-1';
      const consentType = 'analytics';

      await consentManager.collectConsent(userId, consentType, true);
      
      const hasConsent = await consentManager.hasConsent(userId, consentType);
      expect(hasConsent).toBe(true);
    });

    it('should return false for withdrawn consent', async () => {
      const userId = 'has-consent-user-2';
      const consentType = 'analytics';

      await consentManager.collectConsent(userId, consentType, true);
      
      // Add small delay to ensure different timestamps
      await new Promise(resolve => setTimeout(resolve, 10));
      
      await consentManager.withdrawConsent(userId, consentType);
      
      const hasConsent = await consentManager.hasConsent(userId, consentType);
      expect(hasConsent).toBe(false);
    });

    it('should return false for non-existent consent', async () => {
      const hasConsent = await consentManager.hasConsent('nonexistent', 'analytics');
      expect(hasConsent).toBe(false);
    });

    it('should return most recent consent status', async () => {
      const userId = 'has-consent-user-3';
      const consentType = 'analytics';

      // Grant, withdraw, then grant again
      await consentManager.collectConsent(userId, consentType, true);
      await consentManager.withdrawConsent(userId, consentType);
      await consentManager.collectConsent(userId, consentType, true);

      const hasConsent = await consentManager.hasConsent(userId, consentType);
      expect(hasConsent).toBe(true);
    });
  });

  describe('getUserConsents', () => {
    it('should return all consent records for a user', async () => {
      const userId = 'user123';

      await consentManager.collectConsent(userId, 'analytics', true);
      await consentManager.collectConsent(userId, 'personalization', false);
      await consentManager.collectConsent(userId, 'marketing', true);

      const consents = await consentManager.getUserConsents(userId);
      expect(consents).toHaveLength(3);
      
      const consentTypes = consents.map(c => c.consentType);
      expect(consentTypes).toContain('analytics');
      expect(consentTypes).toContain('personalization');
      expect(consentTypes).toContain('marketing');
    });

    it('should return empty array for user with no consents', async () => {
      const consents = await consentManager.getUserConsents('nonexistent');
      expect(consents).toEqual([]);
    });
  });

  describe('getConsentHistory', () => {
    it('should return consent history sorted by timestamp', async () => {
      const userId = 'user123';
      const consentType = 'analytics';

      // Create multiple consent records with small delays
      await consentManager.collectConsent(userId, consentType, true);
      await new Promise(resolve => setTimeout(resolve, 10));
      await consentManager.withdrawConsent(userId, consentType);
      await new Promise(resolve => setTimeout(resolve, 10));
      await consentManager.collectConsent(userId, consentType, true);

      const history = await consentManager.getConsentHistory(userId, consentType);
      expect(history).toHaveLength(3);
      
      // Should be sorted by timestamp descending (most recent first)
      expect(history[0].granted).toBe(true);
      expect(history[1].granted).toBe(false);
      expect(history[2].granted).toBe(true);
    });

    it('should filter by consent type when specified', async () => {
      const userId = 'user123';

      await consentManager.collectConsent(userId, 'analytics', true);
      await consentManager.collectConsent(userId, 'marketing', false);

      const analyticsHistory = await consentManager.getConsentHistory(userId, 'analytics');
      expect(analyticsHistory).toHaveLength(1);
      expect(analyticsHistory[0].consentType).toBe('analytics');
    });
  });

  describe('validateConsent', () => {
    it('should validate current consent as valid', () => {
      const consentRecord: ConsentRecord = {
        userId: 'user123',
        consentType: 'analytics',
        granted: true,
        timestamp: new Date(),
        version: config.consentVersion,
      };

      const validation = consentManager.validateConsent(consentRecord);
      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should invalidate expired consent', () => {
      const expiredDate = new Date(Date.now() - (config.retentionPeriod + 1) * 24 * 60 * 60 * 1000);
      const consentRecord: ConsentRecord = {
        userId: 'user123',
        consentType: 'analytics',
        granted: true,
        timestamp: expiredDate,
        version: config.consentVersion,
      };

      const validation = consentManager.validateConsent(consentRecord);
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Consent has expired and needs to be renewed');
    });

    it('should invalidate outdated consent version', () => {
      const consentRecord: ConsentRecord = {
        userId: 'user123',
        consentType: 'analytics',
        granted: true,
        timestamp: new Date(),
        version: '0.9.0', // Outdated version
      };

      const validation = consentManager.validateConsent(consentRecord);
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Consent version is outdated and needs to be renewed');
    });

    it('should invalidate non-granted consent', () => {
      const consentRecord: ConsentRecord = {
        userId: 'user123',
        consentType: 'analytics',
        granted: false,
        timestamp: new Date(),
        version: config.consentVersion,
      };

      const validation = consentManager.validateConsent(consentRecord);
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Consent must be explicitly granted');
    });
  });

  describe('getAuditLog', () => {
    beforeEach(async () => {
      // Create some audit log entries
      await consentManager.collectConsent('user1', 'analytics', true);
      await consentManager.collectConsent('user2', 'marketing', false);
      await consentManager.withdrawConsent('user1', 'analytics');
    });

    it('should return all audit log entries when no filters applied', async () => {
      const auditLog = await consentManager.getAuditLog();
      expect(auditLog.length).toBeGreaterThanOrEqual(3);
    });

    it('should filter by userId', async () => {
      const auditLog = await consentManager.getAuditLog('user1');
      expect(auditLog).toHaveLength(2);
      expect(auditLog.every(entry => entry.userId === 'user1')).toBe(true);
    });

    it('should filter by date range', async () => {
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      
      const auditLog = await consentManager.getAuditLog(undefined, oneHourAgo, now);
      expect(auditLog.length).toBeGreaterThanOrEqual(3);
    });

    it('should return entries sorted by timestamp descending', async () => {
      const auditLog = await consentManager.getAuditLog();
      
      for (let i = 1; i < auditLog.length; i++) {
        expect(auditLog[i - 1].timestamp.getTime()).toBeGreaterThanOrEqual(
          auditLog[i].timestamp.getTime()
        );
      }
    });
  });

  describe('cleanupExpiredConsents', () => {
    it('should remove expired consent records', async () => {
      const userId = 'user123';
      
      // Create a consent manager with short retention period for testing
      const shortRetentionConfig = { ...config, retentionPeriod: 0 };
      const shortRetentionManager = new ConsentManager(shortRetentionConfig);
      
      await shortRetentionManager.collectConsent(userId, 'analytics', true);
      
      // Wait a bit to ensure consent is "expired"
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const cleanedCount = await shortRetentionManager.cleanupExpiredConsents();
      expect(cleanedCount).toBe(1);
      
      const consents = await shortRetentionManager.getUserConsents(userId);
      expect(consents).toHaveLength(0);
    });

    it('should keep valid consent records', async () => {
      const userId = 'user123';
      
      await consentManager.collectConsent(userId, 'analytics', true);
      
      const cleanedCount = await consentManager.cleanupExpiredConsents();
      expect(cleanedCount).toBe(0);
      
      const consents = await consentManager.getUserConsents(userId);
      expect(consents).toHaveLength(1);
    });
  });

  describe('GDPR compliance scenarios', () => {
    it('should handle consent withdrawal scenario', async () => {
      const userId = 'gdpr-user-1';
      
      // User grants consent
      await consentManager.collectConsent(userId, 'analytics', true);
      expect(await consentManager.hasConsent(userId, 'analytics')).toBe(true);
      
      // Add small delay to ensure different timestamps
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // User withdraws consent
      await consentManager.withdrawConsent(userId, 'analytics');
      expect(await consentManager.hasConsent(userId, 'analytics')).toBe(false);
      
      // Audit trail should show both actions
      const auditLog = await consentManager.getAuditLog(userId);
      expect(auditLog).toHaveLength(2);
      expect(auditLog.some(entry => entry.action === 'consent_granted')).toBe(true);
      expect(auditLog.some(entry => entry.action === 'consent_withdrawn')).toBe(true);
    });

    it('should maintain consent versioning', async () => {
      const userId = 'gdpr-user-2';
      
      await consentManager.collectConsent(userId, 'analytics', true);
      
      const history = await consentManager.getConsentHistory(userId, 'analytics');
      expect(history[0].version).toBe(config.consentVersion);
    });

    it('should require explicit consent (not implicit)', async () => {
      const userId = 'gdpr-user-3';
      
      // No consent granted yet
      expect(await consentManager.hasConsent(userId, 'analytics')).toBe(false);
      
      // Explicit denial
      await consentManager.collectConsent(userId, 'analytics', false);
      expect(await consentManager.hasConsent(userId, 'analytics')).toBe(false);
      
      // Add small delay to ensure different timestamps
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // Only explicit grant should result in true
      await consentManager.collectConsent(userId, 'analytics', true);
      expect(await consentManager.hasConsent(userId, 'analytics')).toBe(true);
    });
  });
});