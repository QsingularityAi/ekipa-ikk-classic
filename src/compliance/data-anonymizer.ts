import { createHash, createHmac, randomBytes } from 'crypto';
import { DataAnonymizationConfig } from './interfaces';

export class DataAnonymizer {
  private config: DataAnonymizationConfig;

  constructor(config: DataAnonymizationConfig) {
    this.config = config;
  }

  /**
   * Pseudonymize user identifier using HMAC-SHA256
   * This creates a consistent but non-reversible identifier
   */
  pseudonymizeUserId(userId: string): string {
    if (!userId) {
      throw new Error('UserId is required for pseudonymization');
    }

    // Use HMAC with secret key for consistent pseudonymization
    const hmac = createHmac('sha256', this.config.pseudonymizationKey);
    hmac.update(userId);
    return `pseudo_${hmac.digest('hex').substring(0, 16)}`;
  }

  /**
   * Hash sensitive data with salt for anonymization
   */
  hashSensitiveData(data: string): string {
    if (!data) {
      return '';
    }

    const hash = createHash('sha256');
    hash.update(data + this.config.hashSalt);
    return hash.digest('hex');
  }

  /**
   * Generate random identifier for session tracking
   */
  generateSessionId(): string {
    return `session_${randomBytes(16).toString('hex')}`;
  }

  /**
   * Anonymize IP address by removing last octet
   */
  anonymizeIpAddress(ipAddress: string): string {
    if (!ipAddress) {
      return '';
    }

    // Handle IPv4
    if (ipAddress.includes('.')) {
      const parts = ipAddress.split('.');
      if (parts.length === 4) {
        return `${parts[0]}.${parts[1]}.${parts[2]}.0`;
      }
    }

    // Handle IPv6 - remove last 64 bits
    if (ipAddress.includes(':')) {
      const parts = ipAddress.split(':');
      if (parts.length >= 4) {
        return `${parts.slice(0, 4).join(':')}::`;
      }
    }

    return 'anonymized';
  }

  /**
   * Remove or minimize personal data from event objects
   */
  minimizeEventData<T extends Record<string, any>>(
    eventData: T,
    dataType: string
  ): Partial<T> {
    const retentionPolicy = this.config.retentionPolicies[dataType];
    
    if (!retentionPolicy) {
      throw new Error(`No retention policy defined for data type: ${dataType}`);
    }

    // Create a copy to avoid mutating original data
    const minimizedData = { ...eventData };

    // Remove or anonymize sensitive fields based on data type
    switch (dataType) {
      case 'user_event':
        return this.minimizeUserEventData(minimizedData);
      case 'user_profile':
        return this.minimizeUserProfileData(minimizedData);
      case 'analytics_event':
        return this.minimizeAnalyticsEventData(minimizedData);
      default:
        // Generic minimization - remove common sensitive fields
        return this.minimizeGenericData(minimizedData);
    }
  }

  /**
   * Check if data should be retained based on age and retention policy
   */
  shouldRetainData(timestamp: Date, dataType: string): boolean {
    const retentionPeriod = this.config.retentionPolicies[dataType];
    
    if (!retentionPeriod) {
      return false; // If no policy defined, don't retain
    }

    const dataAge = Date.now() - timestamp.getTime();
    const maxAge = retentionPeriod * 24 * 60 * 60 * 1000; // Convert days to milliseconds

    return dataAge <= maxAge;
  }

  /**
   * Get list of data that should be purged based on retention policies
   */
  getDataToPurge<T extends { timestamp: Date; dataType?: string }>(
    dataItems: T[],
    defaultDataType: string = 'generic'
  ): T[] {
    return dataItems.filter(item => {
      const dataType = item.dataType || defaultDataType;
      return !this.shouldRetainData(item.timestamp, dataType);
    });
  }

  /**
   * Anonymize user agent string by removing version numbers
   */
  anonymizeUserAgent(userAgent: string): string {
    if (!userAgent) {
      return '';
    }

    // Remove version numbers and specific identifiers
    return userAgent
      .replace(/\d+\.\d+(\.\d+)*/g, 'X.X') // Replace version numbers
      .replace(/\([^)]*\)/g, '(anonymized)') // Replace parenthetical content
      .substring(0, 100); // Limit length
  }

  /**
   * Create anonymized demographic data
   */
  anonymizeDemographics(demographics: {
    age?: number;
    location?: string;
    gender?: string;
  }): {
    ageGroup?: string;
    locationRegion?: string;
    gender?: string;
  } {
    const anonymized: any = {};

    // Convert age to age group
    if (demographics.age) {
      if (demographics.age < 25) anonymized.ageGroup = '18-24';
      else if (demographics.age < 35) anonymized.ageGroup = '25-34';
      else if (demographics.age < 45) anonymized.ageGroup = '35-44';
      else if (demographics.age < 55) anonymized.ageGroup = '45-54';
      else if (demographics.age < 65) anonymized.ageGroup = '55-64';
      else anonymized.ageGroup = '65+';
    }

    // Generalize location to region/state level
    if (demographics.location) {
      // Extract first part (state/region) and remove specific city
      const locationParts = demographics.location.split(',');
      anonymized.locationRegion = locationParts[locationParts.length - 1]?.trim() || 'Unknown';
    }

    // Keep gender as is (already general category)
    if (demographics.gender) {
      anonymized.gender = demographics.gender;
    }

    return anonymized;
  }

  private minimizeUserEventData<T extends Record<string, any>>(data: T): Partial<T> {
    const minimized = { ...data };

    // Remove or anonymize sensitive fields
    if (minimized.userId) {
      minimized.userId = this.pseudonymizeUserId(minimized.userId as string);
    }

    if (minimized.ipAddress) {
      minimized.ipAddress = this.anonymizeIpAddress(minimized.ipAddress as string);
    }

    if (minimized.userAgent) {
      minimized.userAgent = this.anonymizeUserAgent(minimized.userAgent as string);
    }

    // Remove detailed location data, keep only general region
    delete minimized.gpsCoordinates;
    delete minimized.detailedLocation;

    return minimized;
  }

  private minimizeUserProfileData<T extends Record<string, any>>(data: T): Partial<T> {
    const minimized = { ...data };

    // Pseudonymize user ID
    if (minimized.userId) {
      minimized.userId = this.pseudonymizeUserId(minimized.userId as string);
    }

    // Remove direct identifiers
    delete minimized.email;
    delete minimized.phoneNumber;
    delete minimized.fullName;
    delete minimized.address;

    // Anonymize demographics
    if (minimized.demographics) {
      minimized.demographics = this.anonymizeDemographics(minimized.demographics);
    }

    return minimized;
  }

  private minimizeAnalyticsEventData<T extends Record<string, any>>(data: T): Partial<T> {
    const minimized = { ...data };

    // Pseudonymize identifiers
    if (minimized.userId) {
      minimized.userId = this.pseudonymizeUserId(minimized.userId as string);
    }

    if (minimized.sessionId && typeof minimized.sessionId === 'string') {
      // Keep session structure but anonymize the actual ID
      minimized.sessionId = this.hashSensitiveData(minimized.sessionId);
    }

    // Remove detailed context that might be identifying
    if (minimized.context) {
      delete minimized.context.deviceId;
      delete minimized.context.installationId;
    }

    return minimized;
  }

  private minimizeGenericData<T extends Record<string, any>>(data: T): Partial<T> {
    const minimized = { ...data };

    // Remove common sensitive fields
    const sensitiveFields = [
      'email', 'phoneNumber', 'fullName', 'firstName', 'lastName',
      'address', 'zipCode', 'ssn', 'creditCard', 'bankAccount',
      'password', 'token', 'apiKey', 'deviceId', 'installationId'
    ];

    sensitiveFields.forEach(field => {
      delete minimized[field];
    });

    // Pseudonymize user identifiers
    if (minimized.userId) {
      minimized.userId = this.pseudonymizeUserId(minimized.userId as string);
    }

    return minimized;
  }
}
