// Compliance module interfaces
export interface ConsentRecord {
  userId: string;
  consentType: 'analytics' | 'personalization' | 'marketing';
  granted: boolean;
  timestamp: Date;
  version: string;
}

export interface ConsentManagerConfig {
  consentVersion: string;
  retentionPeriod: number; // in days
  auditLogEnabled: boolean;
}

export interface DataAnonymizationConfig {
  hashSalt: string;
  pseudonymizationKey: string;
  retentionPolicies: {
    [dataType: string]: number; // retention period in days
  };
}

export interface AuditLogEntry {
  logId: string;
  timestamp: Date;
  userId: string;
  action:
    | 'consent_granted'
    | 'consent_withdrawn'
    | 'data_accessed'
    | 'data_deleted'
    | 'data_anonymized';
  details: {
    consentType?: string;
    dataType?: string;
    reason?: string;
  };
  ipAddress?: string;
  userAgent?: string;
}

export interface DataSubjectRequest {
  requestId: string;
  userId: string;
  requestType: 'access' | 'deletion' | 'portability' | 'rectification';
  timestamp: Date;
  status: 'pending' | 'processing' | 'completed' | 'rejected';
  completedAt?: Date;
  reason?: string;
}
