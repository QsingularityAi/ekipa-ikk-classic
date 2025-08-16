import { 
  ConsentRecord, 
  AuditLogEntry, 
  DataSubjectRequest
} from './interfaces';
import { ConsentManager } from './consent-manager';
import { UserEvent, UserProfile } from '../types';

/**
 * Configuration for compliance monitor
 */
export interface ComplianceMonitorConfig {
  gdprEnabled: boolean;
  gdngEnabled: boolean;
  auditLogRetention: number;
  retentionPeriod?: number;
  alertThresholds: {
    consentViolations: number;
    dataRetentionViolations: number;
    accessRequestDelays: number;
  };
}

/**
 * GDPR/GDNG compliance violation types
 * Requirements: 5.1, 5.2, 5.3, 5.4 - Compliance tracking and violation detection
 */
export interface ComplianceViolation {
  violationId: string;
  type: 'consent_missing' | 'data_retention' | 'access_without_consent' | 'cross_border_transfer' | 'data_minimization';
  severity: 'low' | 'medium' | 'high' | 'critical';
  userId: string;
  timestamp: Date;
  description: string;
  details: {
    dataType?: string;
    consentType?: string;
    retentionPeriod?: number;
    actualRetention?: number;
    location?: string;
  };
  resolved: boolean;
  resolvedAt?: Date;
  resolution?: string;
}

/**
 * Compliance metrics for monitoring and reporting
 * Requirements: 5.1, 5.2 - Compliance monitoring and audit trail integrity
 */
export interface ComplianceMetrics {
  totalUsers: number;
  usersWithValidConsent: number;
  consentComplianceRate: number;
  dataRetentionCompliance: number;
  activeViolations: number;
  resolvedViolations: number;
  auditLogIntegrity: {
    totalEntries: number;
    integrityScore: number;
    lastVerified: Date;
  };
  gdprRequests: {
    pending: number;
    completed: number;
    averageResponseTime: number; // in hours
  };
}

/**
 * Data processing activity for GDPR Article 30 compliance
 * Requirements: 5.1 - GDPR compliance tracking
 */
export interface ProcessingActivity {
  activityId: string;
  name: string;
  purpose: string;
  legalBasis: 'consent' | 'contract' | 'legal_obligation' | 'vital_interests' | 'public_task' | 'legitimate_interests';
  dataCategories: string[];
  dataSubjects: string[];
  recipients: string[];
  retentionPeriod: number; // in days
  securityMeasures: string[];
  crossBorderTransfers: {
    country: string;
    adequacyDecision: boolean;
    safeguards?: string;
  }[];
}

/**
 * ComplianceMonitor class for GDPR/GDNG compliance tracking
 * Requirements: 5.1, 5.2, 5.3, 5.4 - Compliance monitoring and audit tools
 */
export class ComplianceMonitor {
  private consentManager: ConsentManager;
  private violations: Map<string, ComplianceViolation> = new Map();
  private dataSubjectRequests: Map<string, DataSubjectRequest> = new Map();
  private processingActivities: Map<string, ProcessingActivity> = new Map();
  private auditLog: AuditLogEntry[] = [];
  private config: ComplianceMonitorConfig;

  constructor(config: ComplianceMonitorConfig, consentManager?: ConsentManager) {
    this.config = config;
    this.consentManager = consentManager || new ConsentManager({
      consentVersion: '1.0',
      retentionPeriod: 365,
      auditLogEnabled: true
    });
  }

  /**
   * Monitor user event for compliance violations
   * Requirements: 5.1, 5.2 - Automated compliance monitoring
   */
  async monitorUserEvent(event: UserEvent): Promise<ComplianceViolation[]> {
    const violations: ComplianceViolation[] = [];

    // Check consent compliance
    const consentViolation = await this.checkConsentCompliance(event);
    if (consentViolation) {
      violations.push(consentViolation);
    }

    // Check data minimization compliance
    const dataMinimizationViolation = await this.checkDataMinimization(event);
    if (dataMinimizationViolation) {
      violations.push(dataMinimizationViolation);
    }

    // Store violations
    for (const violation of violations) {
      this.violations.set(violation.violationId, violation);
      await this.logAuditEntry({
        logId: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        timestamp: new Date(),
        userId: event.userId,
        action: 'data_accessed',
        details: {
          reason: `Compliance violation detected: ${violation.type}`,
          dataType: 'user_event'
        }
      });
    }

    return violations;
  }

  /**
   * Monitor user profile for compliance violations
   * Requirements: 5.2, 5.3 - Data retention and privacy compliance
   */
  async monitorUserProfile(profile: UserProfile): Promise<ComplianceViolation[]> {
    const violations: ComplianceViolation[] = [];

    // Check data retention compliance
    const retentionViolation = await this.checkDataRetention(profile);
    if (retentionViolation) {
      violations.push(retentionViolation);
    }

    // Check consent validity
    const consentValidityViolation = await this.checkConsentValidity(profile);
    if (consentValidityViolation) {
      violations.push(consentValidityViolation);
    }

    // Store violations
    for (const violation of violations) {
      this.violations.set(violation.violationId, violation);
    }

    return violations;
  }

  /**
   * Process data subject request (GDPR Article 15-22)
   * Requirements: 5.3, 5.4 - Handle data subject requests within required timeframes
   */
  async processDataSubjectRequest(request: DataSubjectRequest): Promise<void> {
    // Validate request
    if (!request.userId || !request.requestType) {
      throw new Error('Invalid data subject request');
    }

    // Store request
    this.dataSubjectRequests.set(request.requestId, request);

    // Log audit entry
    await this.logAuditEntry({
      logId: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      timestamp: new Date(),
      userId: request.userId,
      action: 'data_accessed',
      details: {
        reason: `Data subject request: ${request.requestType}`,
        dataType: 'data_subject_request'
      }
    });

    // Auto-process certain request types
    if (request.requestType === 'deletion') {
      await this.processDataDeletionRequest(request);
    }
  }

  /**
   * Get compliance metrics for reporting
   * Requirements: 5.1, 5.2 - Compliance monitoring and reporting
   */
  async getComplianceMetrics(): Promise<ComplianceMetrics> {
    const totalUsers = await this.getTotalUserCount();
    const usersWithValidConsent = await this.getUsersWithValidConsent();
    const activeViolations = Array.from(this.violations.values()).filter(v => !v.resolved).length;
    const resolvedViolations = Array.from(this.violations.values()).filter(v => v.resolved).length;

    // Calculate GDPR request metrics
    const gdprRequests = this.calculateGdprRequestMetrics();

    // Calculate audit log integrity
    const auditLogIntegrity = await this.calculateAuditLogIntegrity();

    return {
      totalUsers,
      usersWithValidConsent,
      consentComplianceRate: totalUsers > 0 ? (usersWithValidConsent / totalUsers) * 100 : 0,
      dataRetentionCompliance: await this.calculateDataRetentionCompliance(),
      activeViolations,
      resolvedViolations,
      auditLogIntegrity,
      gdprRequests
    };
  }

  /**
   * Get all compliance violations
   * Requirements: 5.1, 5.2 - Violation detection and tracking
   */
  async getViolations(
    severity?: ComplianceViolation['severity'],
    resolved?: boolean
  ): Promise<ComplianceViolation[]> {
    let violations = Array.from(this.violations.values());

    if (severity) {
      violations = violations.filter(v => v.severity === severity);
    }

    if (resolved !== undefined) {
      violations = violations.filter(v => v.resolved === resolved);
    }

    return violations.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  /**
   * Resolve compliance violation
   * Requirements: 5.1, 5.2 - Violation resolution tracking
   */
  async resolveViolation(violationId: string, resolution: string): Promise<void> {
    const violation = this.violations.get(violationId);
    if (!violation) {
      throw new Error(`Violation not found: ${violationId}`);
    }

    violation.resolved = true;
    violation.resolvedAt = new Date();
    violation.resolution = resolution;

    this.violations.set(violationId, violation);

    // Log resolution
    await this.logAuditEntry({
      logId: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      timestamp: new Date(),
      userId: violation.userId,
      action: 'data_accessed',
      details: {
        reason: `Violation resolved: ${violationId}`,
        dataType: 'compliance_violation'
      }
    });
  }

  /**
   * Register processing activity for GDPR Article 30 compliance
   * Requirements: 5.1 - GDPR compliance documentation
   */
  async registerProcessingActivity(activity: ProcessingActivity): Promise<void> {
    this.processingActivities.set(activity.activityId, activity);

    await this.logAuditEntry({
      logId: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      timestamp: new Date(),
      userId: 'system',
      action: 'data_accessed',
      details: {
        reason: `Processing activity registered: ${activity.name}`,
        dataType: 'processing_activity'
      }
    });
  }

  /**
   * Get processing activities for GDPR Article 30 reporting
   * Requirements: 5.1 - GDPR compliance documentation
   */
  async getProcessingActivities(): Promise<ProcessingActivity[]> {
    return Array.from(this.processingActivities.values());
  }

  /**
   * Verify audit log integrity
   * Requirements: 5.2 - Audit trail integrity
   */
  async verifyAuditLogIntegrity(): Promise<{
    isValid: boolean;
    issues: string[];
    integrityScore: number;
  }> {
    const issues: string[] = [];
    let validEntries = 0;

    for (const entry of this.auditLog) {
      // Check required fields
      if (!entry.logId || !entry.timestamp || !entry.userId || !entry.action) {
        issues.push(`Invalid audit entry: ${entry.logId || 'unknown'}`);
        continue;
      }

      // Check timestamp consistency
      if (entry.timestamp > new Date()) {
        issues.push(`Future timestamp in audit entry: ${entry.logId}`);
        continue;
      }

      validEntries++;
    }

    const integrityScore = this.auditLog.length > 0 ? (validEntries / this.auditLog.length) * 100 : 100;

    return {
      isValid: issues.length === 0,
      issues,
      integrityScore
    };
  }

  /**
   * Generate compliance report
   * Requirements: 5.1, 5.2, 5.3, 5.4 - Comprehensive compliance reporting
   */
  async generateComplianceReport(startDate?: Date, endDate?: Date): Promise<{
    period: { start: Date; end: Date };
    metrics: ComplianceMetrics;
    violations: ComplianceViolation[];
    dataSubjectRequests: DataSubjectRequest[];
    processingActivities: ProcessingActivity[];
    auditSummary: {
      totalEntries: number;
      integrityScore: number;
      criticalEvents: number;
    };
  }> {
    const end = endDate || new Date();
    const start = startDate || new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000); // Default to last 30 days

    const metrics = await this.getComplianceMetrics();
    const violations = await this.getViolations();
    const dataSubjectRequests = Array.from(this.dataSubjectRequests.values())
      .filter(req => req.timestamp >= start && req.timestamp <= end);
    const processingActivities = await this.getProcessingActivities();

    // Calculate audit summary
    const auditEntries = this.auditLog.filter(entry => 
      entry.timestamp >= start && entry.timestamp <= end
    );
    const criticalEvents = auditEntries.filter(entry => 
      entry.action === 'data_deleted' || entry.action === 'consent_withdrawn'
    ).length;

    const auditIntegrity = await this.verifyAuditLogIntegrity();

    return {
      period: { start, end },
      metrics,
      violations: violations.filter(v => v.timestamp >= start && v.timestamp <= end),
      dataSubjectRequests,
      processingActivities,
      auditSummary: {
        totalEntries: auditEntries.length,
        integrityScore: auditIntegrity.integrityScore,
        criticalEvents
      }
    };
  }

  /**
   * Check compliance status for a specific user
   * Requirements: 5.1, 5.2 - Check GDPR/GDNG compliance status
   */
  async checkCompliance(userId: string): Promise<{
    gdprCompliant: boolean;
    gdngCompliant: boolean;
    violations: ComplianceViolation[];
  }> {
    const userViolations = Array.from(this.violations.values())
      .filter(v => v.userId === userId && !v.resolved);

    const gdprCompliant = this.config.gdprEnabled ? 
      !userViolations.some(v => ['consent_missing', 'data_retention', 'access_without_consent'].includes(v.type)) : 
      true;

    const gdngCompliant = this.config.gdngEnabled ? 
      !userViolations.some(v => ['data_minimization', 'cross_border_transfer'].includes(v.type)) : 
      true;

    return {
      gdprCompliant,
      gdngCompliant,
      violations: userViolations
    };
  }

  // Private helper methods

  private async checkConsentCompliance(event: UserEvent): Promise<ComplianceViolation | null> {
    try {
      const hasAnalyticsConsent = await this.consentManager.hasConsent(event.userId, 'analytics');
      
      if (!hasAnalyticsConsent) {
        return {
          violationId: `violation_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
          type: 'consent_missing',
          severity: 'high',
          userId: event.userId,
          timestamp: new Date(),
          description: 'User event processed without valid analytics consent',
          details: {
            consentType: 'analytics',
            dataType: 'user_event'
          },
          resolved: false
        };
      }

      return null;
    } catch (error) {
      // If consent check fails, treat as missing consent for safety
      return {
        violationId: `violation_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        type: 'consent_missing',
        severity: 'critical',
        userId: event.userId,
        timestamp: new Date(),
        description: `Consent check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        details: {
          consentType: 'analytics',
          dataType: 'user_event'
        },
        resolved: false
      };
    }
  }

  private async checkDataMinimization(event: UserEvent): Promise<ComplianceViolation | null> {
    // Check if event contains excessive personal data
    const sensitiveFields = ['email', 'phone', 'address', 'ssn'];
    const eventData = JSON.stringify(event);
    
    for (const field of sensitiveFields) {
      if (eventData.toLowerCase().includes(field)) {
        return {
          violationId: `violation_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
          type: 'data_minimization',
          severity: 'medium',
          userId: event.userId,
          timestamp: new Date(),
          description: 'Event contains potentially excessive personal data',
          details: {
            dataType: 'user_event'
          },
          resolved: false
        };
      }
    }

    return null;
  }

  private async checkDataRetention(profile: UserProfile): Promise<ComplianceViolation | null> {
    const maxRetentionDays = this.config.retentionPeriod || 365;
    const profileAge = Date.now() - profile.demographics.registrationDate.getTime();
    const profileAgeDays = profileAge / (1000 * 60 * 60 * 24);

    if (profileAgeDays > maxRetentionDays) {
      return {
        violationId: `violation_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        type: 'data_retention',
        severity: 'high',
        userId: profile.userId,
        timestamp: new Date(),
        description: 'User profile exceeds maximum retention period',
        details: {
          dataType: 'user_profile',
          retentionPeriod: maxRetentionDays,
          actualRetention: Math.floor(profileAgeDays)
        },
        resolved: false
      };
    }

    return null;
  }

  private async checkConsentValidity(profile: UserProfile): Promise<ComplianceViolation | null> {
    for (const consent of profile.consentStatus) {
      const validation = this.consentManager.validateConsent(consent);
      if (!validation.isValid) {
        return {
          violationId: `violation_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
          type: 'consent_missing',
          severity: 'high',
          userId: profile.userId,
          timestamp: new Date(),
          description: `Invalid consent: ${validation.errors.join(', ')}`,
          details: {
            consentType: consent.consentType,
            dataType: 'consent_record'
          },
          resolved: false
        };
      }
    }

    return null;
  }

  private async processDataDeletionRequest(request: DataSubjectRequest): Promise<void> {
    // Mark request as processing
    request.status = 'processing';
    this.dataSubjectRequests.set(request.requestId, request);

    // Log data deletion
    await this.logAuditEntry({
      logId: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      timestamp: new Date(),
      userId: request.userId,
      action: 'data_deleted',
      details: {
        reason: `Data deletion request: ${request.requestId}`,
        dataType: 'user_data'
      }
    });

    // Mark request as completed
    request.status = 'completed';
    request.completedAt = new Date();
    this.dataSubjectRequests.set(request.requestId, request);
  }

  private async getTotalUserCount(): Promise<number> {
    // This would typically query the user repository
    // For now, return a placeholder value
    return 1000;
  }

  private async getUsersWithValidConsent(): Promise<number> {
    // This would typically check all users' consent status
    // For now, return a placeholder value
    return 850;
  }

  private calculateGdprRequestMetrics(): ComplianceMetrics['gdprRequests'] {
    const requests = Array.from(this.dataSubjectRequests.values());
    const pending = requests.filter(r => r.status === 'pending' || r.status === 'processing').length;
    const completed = requests.filter(r => r.status === 'completed').length;

    // Calculate average response time for completed requests
    const completedRequests = requests.filter(r => r.status === 'completed' && r.completedAt);
    const totalResponseTime = completedRequests.reduce((sum, req) => {
      if (req.completedAt) {
        return sum + (req.completedAt.getTime() - req.timestamp.getTime());
      }
      return sum;
    }, 0);

    const averageResponseTime = completedRequests.length > 0 
      ? totalResponseTime / completedRequests.length / (1000 * 60 * 60) // Convert to hours
      : 0;

    return {
      pending,
      completed,
      averageResponseTime
    };
  }

  private async calculateAuditLogIntegrity(): Promise<ComplianceMetrics['auditLogIntegrity']> {
    const integrity = await this.verifyAuditLogIntegrity();
    
    return {
      totalEntries: this.auditLog.length,
      integrityScore: integrity.integrityScore,
      lastVerified: new Date()
    };
  }

  private async calculateDataRetentionCompliance(): Promise<number> {
    // This would typically check all data against retention policies
    // For now, return a placeholder value
    return 95.5;
  }

  private async logAuditEntry(entry: AuditLogEntry): Promise<void> {
    this.auditLog.push(entry);
  }
}