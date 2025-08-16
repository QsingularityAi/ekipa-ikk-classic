import { ConsentRecord, ConsentManagerConfig, AuditLogEntry } from './interfaces';

export class ConsentManager {
  private config: ConsentManagerConfig;
  private consentStorage: Map<string, ConsentRecord[]> = new Map();
  private auditLog: AuditLogEntry[] = [];

  constructor(config: ConsentManagerConfig) {
    this.config = config;
  }

  /**
   * Collect consent from user with GDPR compliance
   */
  async collectConsent(
    userId: string,
    consentType: ConsentRecord['consentType'],
    granted: boolean,
    metadata?: { ipAddress?: string; userAgent?: string }
  ): Promise<ConsentRecord> {
    // Validate input
    if (!userId || !consentType) {
      throw new Error('UserId and consentType are required');
    }

    const consentRecord: ConsentRecord = {
      userId,
      consentType,
      granted,
      timestamp: new Date(),
      version: this.config.consentVersion,
    };

    // Store consent record
    await this.storeConsentRecord(consentRecord);

    // Create audit log entry
    if (this.config.auditLogEnabled) {
      await this.logConsentAction(
        userId,
        granted ? 'consent_granted' : 'consent_withdrawn',
        { consentType },
        metadata
      );
    }

    return consentRecord;
  }

  /**
   * Withdraw consent for a specific type
   */
  async withdrawConsent(
    userId: string,
    consentType: ConsentRecord['consentType'],
    metadata?: { ipAddress?: string; userAgent?: string }
  ): Promise<void> {
    const withdrawalRecord: ConsentRecord = {
      userId,
      consentType,
      granted: false,
      timestamp: new Date(),
      version: this.config.consentVersion,
    };

    await this.storeConsentRecord(withdrawalRecord);

    if (this.config.auditLogEnabled) {
      await this.logConsentAction(
        userId,
        'consent_withdrawn',
        { consentType },
        metadata
      );
    }
  }

  /**
   * Check if user has granted consent for a specific type
   */
  async hasConsent(
    userId: string,
    consentType: ConsentRecord['consentType']
  ): Promise<boolean> {
    const userConsents = this.consentStorage.get(userId) || [];
    
    // Get the most recent consent record for this type
    const latestConsent = userConsents
      .filter(record => record.consentType === consentType)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())[0];

    return latestConsent ? latestConsent.granted : false;
  }

  /**
   * Get all consent records for a user
   */
  async getUserConsents(userId: string): Promise<ConsentRecord[]> {
    return this.consentStorage.get(userId) || [];
  }

  /**
   * Get consent history with versioning
   */
  async getConsentHistory(
    userId: string,
    consentType?: ConsentRecord['consentType']
  ): Promise<ConsentRecord[]> {
    const userConsents = this.consentStorage.get(userId) || [];
    
    if (consentType) {
      return userConsents
        .filter(record => record.consentType === consentType)
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    }

    return userConsents.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  /**
   * Validate consent according to GDPR requirements
   */
  validateConsent(consentRecord: ConsentRecord): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    // Check if consent is not older than retention period
    const consentAge = Date.now() - consentRecord.timestamp.getTime();
    const maxAge = this.config.retentionPeriod * 24 * 60 * 60 * 1000; // Convert days to milliseconds

    if (consentAge > maxAge) {
      errors.push('Consent has expired and needs to be renewed');
    }

    // Check if consent version is current
    if (consentRecord.version !== this.config.consentVersion) {
      errors.push('Consent version is outdated and needs to be renewed');
    }

    // GDPR requires explicit consent (must be granted, not just absence of withdrawal)
    if (!consentRecord.granted) {
      errors.push('Consent must be explicitly granted');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Get audit log entries for compliance reporting
   */
  async getAuditLog(
    userId?: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<AuditLogEntry[]> {
    let filteredLog = this.auditLog;

    if (userId) {
      filteredLog = filteredLog.filter(entry => entry.userId === userId);
    }

    if (startDate) {
      filteredLog = filteredLog.filter(entry => entry.timestamp >= startDate);
    }

    if (endDate) {
      filteredLog = filteredLog.filter(entry => entry.timestamp <= endDate);
    }

    return filteredLog.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  /**
   * Clean up expired consent records
   */
  async cleanupExpiredConsents(): Promise<number> {
    let cleanedCount = 0;
    const cutoffDate = new Date(Date.now() - this.config.retentionPeriod * 24 * 60 * 60 * 1000);

    for (const [userId, consents] of this.consentStorage.entries()) {
      const validConsents = consents.filter(consent => consent.timestamp > cutoffDate);
      
      if (validConsents.length !== consents.length) {
        cleanedCount += consents.length - validConsents.length;
        
        if (validConsents.length === 0) {
          this.consentStorage.delete(userId);
        } else {
          this.consentStorage.set(userId, validConsents);
        }
      }
    }

    return cleanedCount;
  }

  private async storeConsentRecord(consentRecord: ConsentRecord): Promise<void> {
    const userId = consentRecord.userId;
    const existingConsents = this.consentStorage.get(userId) || [];
    
    existingConsents.push(consentRecord);
    this.consentStorage.set(userId, existingConsents);
  }

  private async logConsentAction(
    userId: string,
    action: AuditLogEntry['action'],
    details: AuditLogEntry['details'],
    metadata?: { ipAddress?: string; userAgent?: string }
  ): Promise<void> {
    const logEntry: AuditLogEntry = {
      logId: `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      userId,
      action,
      details,
      ipAddress: metadata?.ipAddress,
      userAgent: metadata?.userAgent,
    };

    this.auditLog.push(logEntry);
  }
}
