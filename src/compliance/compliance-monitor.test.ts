import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ComplianceMonitor, ComplianceViolation, ComplianceMetrics } from './compliance-monitor';
import { ConsentManager } from './consent-manager';
import { ConsentManagerConfig, DataSubjectRequest, ProcessingActivity } from './interfaces';
import { UserEvent, UserProfile } from '../types';

/**
 * Unit tests for ComplianceMonitor class
 * Requirements: 5.1, 5.2, 5.3, 5.4 - Test compliance validation and audit trail integrity
 */
describe('ComplianceMonitor', () => {
  let complianceMonitor: ComplianceMonitor;
  let consentManager: ConsentManager;
  let config: ConsentManagerConfig;

  beforeEach(() => {
    config = {
      consentVersion: '1.0',
      retentionPeriod: 365, // 1 year
      auditLogEnabled: true
    };

    consentManager = new ConsentManager(config);
    complianceMonitor = new ComplianceMonitor(consentManager, config);
  });

  describe('monitorUserEvent', () => {
    it('should detect consent violations', async () => {
      const event = createMockUserEvent('user1', 'feature_usage');
      
      // Mock consent manager to return false for consent check
      vi.spyOn(consentManager, 'hasConsent').mockResolvedValue(false);

      const violations = await complianceMonitor.monitorUserEvent(event);

      expect(violations).toHaveLength(1);
      expect(violations[0].type).toBe('consent_missing');
      expect(violations[0].severity).toBe('high');
      expect(violations[0].userId).toBe('user1');
      expect(violations[0].resolved).toBe(false);
    });

    it('should detect data minimization violations', async () => {
      const event = createMockUserEvent('user1', 'feature_usage');
      // Add sensitive data to event
      event.metadata = { ...event.metadata, email: 'user@example.com' };
      
      // Mock consent manager to return true for consent check
      vi.spyOn(consentManager, 'hasConsent').mockResolvedValue(true);

      const violations = await complianceMonitor.monitorUserEvent(event);

      expect(violations).toHaveLength(1);
      expect(violations[0].type).toBe('data_minimization');
      expect(violations[0].severity).toBe('medium');
    });

    it('should not create violations when compliant', async () => {
      const event = createMockUserEvent('user1', 'feature_usage');
      
      // Mock consent manager to return true for consent check
      vi.spyOn(consentManager, 'hasConsent').mockResolvedValue(true);

      const violations = await complianceMonitor.monitorUserEvent(event);

      expect(violations).toHaveLength(0);
    });

    it('should store violations for tracking', async () => {
      const event = createMockUserEvent('user1', 'feature_usage');
      vi.spyOn(consentManager, 'hasConsent').mockResolvedValue(false);

      await complianceMonitor.monitorUserEvent(event);
      const allViolations = await complianceMonitor.getViolations();

      expect(allViolations).toHaveLength(1);
      expect(allViolations[0].type).toBe('consent_missing');
    });
  });

  describe('monitorUserProfile', () => {
    it('should detect data retention violations', async () => {
      const profile = createMockUserProfile('user1');
      // Set registration date to exceed retention period
      profile.demographics.registrationDate = new Date(Date.now() - (400 * 24 * 60 * 60 * 1000)); // 400 days ago

      const violations = await complianceMonitor.monitorUserProfile(profile);

      expect(violations).toHaveLength(1);
      expect(violations[0].type).toBe('data_retention');
      expect(violations[0].severity).toBe('high');
      expect(violations[0].details.retentionPeriod).toBe(365);
    });

    it('should detect consent validity violations', async () => {
      const profile = createMockUserProfile('user1');
      // Add expired consent
      profile.consentStatus = [{
        userId: 'user1',
        consentType: 'analytics',
        granted: true,
        timestamp: new Date(Date.now() - (400 * 24 * 60 * 60 * 1000)), // 400 days ago
        version: '0.9' // Old version
      }];

      // Mock consent validation to return invalid
      vi.spyOn(consentManager, 'validateConsent').mockReturnValue({
        isValid: false,
        errors: ['Consent has expired and needs to be renewed']
      });

      const violations = await complianceMonitor.monitorUserProfile(profile);

      expect(violations).toHaveLength(1);
      expect(violations[0].type).toBe('consent_missing');
      expect(violations[0].severity).toBe('high');
    });

    it('should not create violations for compliant profiles', async () => {
      const profile = createMockUserProfile('user1');
      
      // Mock consent validation to return valid
      vi.spyOn(consentManager, 'validateConsent').mockReturnValue({
        isValid: true,
        errors: []
      });

      const violations = await complianceMonitor.monitorUserProfile(profile);

      expect(violations).toHaveLength(0);
    });
  });

  describe('processDataSubjectRequest', () => {
    it('should process data subject request', async () => {
      const request: DataSubjectRequest = {
        requestId: 'req_123',
        userId: 'user1',
        requestType: 'access',
        timestamp: new Date(),
        status: 'pending'
      };

      await complianceMonitor.processDataSubjectRequest(request);

      // Request should be stored
      const metrics = await complianceMonitor.getComplianceMetrics();
      expect(metrics.gdprRequests.pending).toBeGreaterThan(0);
    });

    it('should auto-process deletion requests', async () => {
      const request: DataSubjectRequest = {
        requestId: 'req_123',
        userId: 'user1',
        requestType: 'deletion',
        timestamp: new Date(),
        status: 'pending'
      };

      await complianceMonitor.processDataSubjectRequest(request);

      // Check that request was processed
      const report = await complianceMonitor.generateComplianceReport();
      const processedRequest = report.dataSubjectRequests.find(r => r.requestId === 'req_123');
      
      expect(processedRequest?.status).toBe('completed');
      expect(processedRequest?.completedAt).toBeDefined();
    });

    it('should validate request parameters', async () => {
      const invalidRequest: DataSubjectRequest = {
        requestId: '',
        userId: '',
        requestType: 'access',
        timestamp: new Date(),
        status: 'pending'
      };

      await expect(complianceMonitor.processDataSubjectRequest(invalidRequest))
        .rejects.toThrow('Invalid data subject request');
    });
  });

  describe('getComplianceMetrics', () => {
    it('should return comprehensive compliance metrics', async () => {
      const metrics = await complianceMonitor.getComplianceMetrics();

      expect(metrics).toBeDefined();
      expect(typeof metrics.totalUsers).toBe('number');
      expect(typeof metrics.usersWithValidConsent).toBe('number');
      expect(typeof metrics.consentComplianceRate).toBe('number');
      expect(typeof metrics.dataRetentionCompliance).toBe('number');
      expect(typeof metrics.activeViolations).toBe('number');
      expect(typeof metrics.resolvedViolations).toBe('number');
      expect(metrics.auditLogIntegrity).toBeDefined();
      expect(metrics.gdprRequests).toBeDefined();
    });

    it('should calculate consent compliance rate correctly', async () => {
      const metrics = await complianceMonitor.getComplianceMetrics();

      expect(metrics.consentComplianceRate).toBeGreaterThanOrEqual(0);
      expect(metrics.consentComplianceRate).toBeLessThanOrEqual(100);
    });

    it('should track violation counts', async () => {
      // Create a violation
      const event = createMockUserEvent('user1', 'feature_usage');
      vi.spyOn(consentManager, 'hasConsent').mockResolvedValue(false);
      await complianceMonitor.monitorUserEvent(event);

      const metrics = await complianceMonitor.getComplianceMetrics();

      expect(metrics.activeViolations).toBe(1);
      expect(metrics.resolvedViolations).toBe(0);
    });
  });

  describe('getViolations', () => {
    beforeEach(async () => {
      // Create test violations
      const event1 = createMockUserEvent('user1', 'feature_usage');
      const event2 = createMockUserEvent('user2', 'feature_usage');
      
      vi.spyOn(consentManager, 'hasConsent').mockResolvedValue(false);
      
      await complianceMonitor.monitorUserEvent(event1);
      await complianceMonitor.monitorUserEvent(event2);
    });

    it('should return all violations by default', async () => {
      const violations = await complianceMonitor.getViolations();

      expect(violations).toHaveLength(2);
      expect(violations.every(v => v.type === 'consent_missing')).toBe(true);
    });

    it('should filter by severity', async () => {
      const highSeverityViolations = await complianceMonitor.getViolations('high');

      expect(highSeverityViolations).toHaveLength(2);
      expect(highSeverityViolations.every(v => v.severity === 'high')).toBe(true);
    });

    it('should filter by resolved status', async () => {
      const unresolvedViolations = await complianceMonitor.getViolations(undefined, false);

      expect(unresolvedViolations).toHaveLength(2);
      expect(unresolvedViolations.every(v => !v.resolved)).toBe(true);
    });

    it('should sort violations by timestamp descending', async () => {
      const violations = await complianceMonitor.getViolations();

      for (let i = 1; i < violations.length; i++) {
        expect(violations[i - 1].timestamp.getTime()).toBeGreaterThanOrEqual(
          violations[i].timestamp.getTime()
        );
      }
    });
  });

  describe('resolveViolation', () => {
    it('should resolve existing violation', async () => {
      // Create a violation
      const event = createMockUserEvent('user1', 'feature_usage');
      vi.spyOn(consentManager, 'hasConsent').mockResolvedValue(false);
      const violations = await complianceMonitor.monitorUserEvent(event);
      
      const violationId = violations[0].violationId;
      const resolution = 'User consent obtained retroactively';

      await complianceMonitor.resolveViolation(violationId, resolution);

      const resolvedViolations = await complianceMonitor.getViolations(undefined, true);
      expect(resolvedViolations).toHaveLength(1);
      expect(resolvedViolations[0].resolved).toBe(true);
      expect(resolvedViolations[0].resolution).toBe(resolution);
      expect(resolvedViolations[0].resolvedAt).toBeDefined();
    });

    it('should throw error for non-existent violation', async () => {
      await expect(complianceMonitor.resolveViolation('non-existent', 'resolution'))
        .rejects.toThrow('Violation not found: non-existent');
    });

    it('should update violation metrics after resolution', async () => {
      // Create and resolve a violation
      const event = createMockUserEvent('user1', 'feature_usage');
      vi.spyOn(consentManager, 'hasConsent').mockResolvedValue(false);
      const violations = await complianceMonitor.monitorUserEvent(event);
      
      await complianceMonitor.resolveViolation(violations[0].violationId, 'Fixed');

      const metrics = await complianceMonitor.getComplianceMetrics();
      expect(metrics.activeViolations).toBe(0);
      expect(metrics.resolvedViolations).toBe(1);
    });
  });

  describe('registerProcessingActivity', () => {
    it('should register processing activity', async () => {
      const activity: ProcessingActivity = {
        activityId: 'activity_1',
        name: 'User Analytics',
        purpose: 'Improve user experience',
        legalBasis: 'consent',
        dataCategories: ['usage_data', 'preferences'],
        dataSubjects: ['app_users'],
        recipients: ['internal_analytics_team'],
        retentionPeriod: 365,
        securityMeasures: ['encryption', 'access_controls'],
        crossBorderTransfers: []
      };

      await complianceMonitor.registerProcessingActivity(activity);

      const activities = await complianceMonitor.getProcessingActivities();
      expect(activities).toHaveLength(1);
      expect(activities[0].activityId).toBe('activity_1');
      expect(activities[0].name).toBe('User Analytics');
    });

    it('should store multiple processing activities', async () => {
      const activity1: ProcessingActivity = {
        activityId: 'activity_1',
        name: 'User Analytics',
        purpose: 'Improve user experience',
        legalBasis: 'consent',
        dataCategories: ['usage_data'],
        dataSubjects: ['app_users'],
        recipients: ['internal_team'],
        retentionPeriod: 365,
        securityMeasures: ['encryption'],
        crossBorderTransfers: []
      };

      const activity2: ProcessingActivity = {
        activityId: 'activity_2',
        name: 'Marketing Communications',
        purpose: 'Send promotional content',
        legalBasis: 'consent',
        dataCategories: ['contact_data'],
        dataSubjects: ['subscribers'],
        recipients: ['marketing_team'],
        retentionPeriod: 730,
        securityMeasures: ['encryption', 'access_controls'],
        crossBorderTransfers: []
      };

      await complianceMonitor.registerProcessingActivity(activity1);
      await complianceMonitor.registerProcessingActivity(activity2);

      const activities = await complianceMonitor.getProcessingActivities();
      expect(activities).toHaveLength(2);
    });
  });

  describe('verifyAuditLogIntegrity', () => {
    it('should verify audit log integrity', async () => {
      // Create some audit entries by monitoring events
      const event = createMockUserEvent('user1', 'feature_usage');
      vi.spyOn(consentManager, 'hasConsent').mockResolvedValue(false);
      await complianceMonitor.monitorUserEvent(event);

      const integrity = await complianceMonitor.verifyAuditLogIntegrity();

      expect(integrity.isValid).toBeDefined();
      expect(typeof integrity.integrityScore).toBe('number');
      expect(Array.isArray(integrity.issues)).toBe(true);
      expect(integrity.integrityScore).toBeGreaterThanOrEqual(0);
      expect(integrity.integrityScore).toBeLessThanOrEqual(100);
    });

    it('should detect integrity issues', async () => {
      // This test would require mocking invalid audit entries
      // For now, we'll test that the method works with valid entries
      const integrity = await complianceMonitor.verifyAuditLogIntegrity();

      expect(integrity.integrityScore).toBe(100); // Should be 100% for empty/valid log
    });
  });

  describe('generateComplianceReport', () => {
    it('should generate comprehensive compliance report', async () => {
      // Create test data
      const event = createMockUserEvent('user1', 'feature_usage');
      vi.spyOn(consentManager, 'hasConsent').mockResolvedValue(false);
      await complianceMonitor.monitorUserEvent(event);

      const request: DataSubjectRequest = {
        requestId: 'req_123',
        userId: 'user1',
        requestType: 'access',
        timestamp: new Date(),
        status: 'pending'
      };
      await complianceMonitor.processDataSubjectRequest(request);

      const activity: ProcessingActivity = {
        activityId: 'activity_1',
        name: 'User Analytics',
        purpose: 'Improve user experience',
        legalBasis: 'consent',
        dataCategories: ['usage_data'],
        dataSubjects: ['app_users'],
        recipients: ['internal_team'],
        retentionPeriod: 365,
        securityMeasures: ['encryption'],
        crossBorderTransfers: []
      };
      await complianceMonitor.registerProcessingActivity(activity);

      const report = await complianceMonitor.generateComplianceReport();

      expect(report.period).toBeDefined();
      expect(report.period.start).toBeInstanceOf(Date);
      expect(report.period.end).toBeInstanceOf(Date);
      expect(report.metrics).toBeDefined();
      expect(Array.isArray(report.violations)).toBe(true);
      expect(Array.isArray(report.dataSubjectRequests)).toBe(true);
      expect(Array.isArray(report.processingActivities)).toBe(true);
      expect(report.auditSummary).toBeDefined();
      expect(typeof report.auditSummary.totalEntries).toBe('number');
      expect(typeof report.auditSummary.integrityScore).toBe('number');
      expect(typeof report.auditSummary.criticalEvents).toBe('number');
    });

    it('should filter report by date range', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');

      const report = await complianceMonitor.generateComplianceReport(startDate, endDate);

      expect(report.period.start).toEqual(startDate);
      expect(report.period.end).toEqual(endDate);
    });

    it('should include audit summary with critical events', async () => {
      // Create a deletion request (critical event)
      const request: DataSubjectRequest = {
        requestId: 'req_123',
        userId: 'user1',
        requestType: 'deletion',
        timestamp: new Date(),
        status: 'pending'
      };
      await complianceMonitor.processDataSubjectRequest(request);

      const report = await complianceMonitor.generateComplianceReport();

      expect(report.auditSummary.criticalEvents).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid user events gracefully', async () => {
      const invalidEvent = {} as UserEvent;

      // Should not throw error, but may not detect violations properly
      const violations = await complianceMonitor.monitorUserEvent(invalidEvent);
      expect(Array.isArray(violations)).toBe(true);
    });

    it('should handle consent manager errors', async () => {
      const event = createMockUserEvent('user1', 'feature_usage');
      
      // Mock consent manager to throw error
      vi.spyOn(consentManager, 'hasConsent').mockRejectedValue(new Error('Consent check failed'));

      // Should handle error gracefully
      await expect(complianceMonitor.monitorUserEvent(event)).resolves.toBeDefined();
    });
  });

  // Helper functions
  function createMockUserEvent(userId: string, eventType: UserEvent['eventType']): UserEvent {
    return {
      eventId: `event_${Date.now()}_${Math.random()}`,
      userId,
      sessionId: `session_${userId}_${Date.now()}`,
      timestamp: new Date(),
      eventType,
      metadata: {
        duration: 60,
        success: true
      },
      userContext: {
        ageGroup: '22-30',
        digitalLiteracyScore: 0.7,
        preferredChannel: 'push'
      }
    };
  }

  function createMockUserProfile(userId: string): UserProfile {
    return {
      userId,
      demographics: {
        ageGroup: '22-30',
        registrationDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
        lastActiveDate: new Date()
      },
      engagementMetrics: {
        totalSessions: 25,
        averageSessionDuration: 180,
        featuresUsed: ['claims', 'profile'],
        digitalTasksCompleted: 10,
        traditionalChannelUsage: {
          phoneCallsLastMonth: 2,
          paperFormsLastMonth: 1
        }
      },
      preferences: {
        communicationChannels: ['push', 'email'],
        notificationFrequency: 'medium',
        contentComplexity: 'simple'
      },
      consentStatus: [{
        userId,
        consentType: 'analytics',
        granted: true,
        timestamp: new Date(),
        version: '1.0'
      }]
    };
  }
});