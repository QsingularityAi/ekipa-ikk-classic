import { UserEvent } from '../types';
import { ConsentManager } from '../compliance/consent-manager';
import { DataAnonymizer } from '../compliance/data-anonymizer';

/**
 * Configuration interface for EventCollector
 */
export interface EventCollectorConfig {
  apiEndpoint: string;
  batchSize: number;
  flushInterval: number;
  retryAttempts: number;
  enableValidation: boolean;
  enableSanitization: boolean;
}

/**
 * Validation result interface
 */
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

/**
 * EventCollector class for capturing user interactions
 * Requirements: 1.1 - Track user navigation paths, session duration, feature usage, and drop-off points
 * Requirements: 1.2 - Identify common abandonment patterns and bottlenecks in user flows
 */
export class EventCollector {
  private config: EventCollectorConfig;
  private eventBuffer: UserEvent[] = [];
  private flushTimer: NodeJS.Timeout | null = null;
  private consentManager: ConsentManager;
  private dataAnonymizer: DataAnonymizer;

  constructor(
    config: EventCollectorConfig,
    consentManager: ConsentManager,
    dataAnonymizer: DataAnonymizer
  ) {
    this.config = config;
    this.consentManager = consentManager;
    this.dataAnonymizer = dataAnonymizer;
    this.startFlushTimer();
  }

  /**
   * Collect a user event with validation and consent checking
   * Requirements: 1.1 - Track user interactions with consent compliance
   */
  async collectEvent(event: UserEvent): Promise<boolean> {
    try {
      // Check user consent before collecting analytics data
      const hasConsent = await this.consentManager.hasConsent(
        event.userId,
        'analytics'
      );

      if (!hasConsent) {
        console.warn(`Analytics consent not granted for user: ${event.userId}`);
        return false;
      }

      // Validate event if validation is enabled
      if (this.config.enableValidation) {
        const validationResult = this.validateEvent(event);
        if (!validationResult.isValid) {
          console.error('Event validation failed:', validationResult.errors);
          return false;
        }
      }

      // Sanitize event if sanitization is enabled
      let sanitizedEvent = event;
      if (this.config.enableSanitization) {
        sanitizedEvent = this.sanitizeEvent(event);
      }

      // Pseudonymize user ID for privacy
      sanitizedEvent.userId = this.dataAnonymizer.pseudonymizeUserId(
        sanitizedEvent.userId
      );

      // Add to buffer
      this.eventBuffer.push(sanitizedEvent);

      // Flush if buffer is full
      if (this.eventBuffer.length >= this.config.batchSize) {
        await this.flush();
      }

      return true;
    } catch (error) {
      console.error('Error collecting event:', error);
      return false;
    }
  }

  /**
   * Validate event structure and required fields
   * Requirements: 1.1 - Ensure data quality for accurate tracking
   */
  validateEvent(event: UserEvent): ValidationResult {
    const errors: string[] = [];

    // Required fields validation
    if (!event.eventId || typeof event.eventId !== 'string') {
      errors.push('eventId is required and must be a string');
    }

    if (!event.userId || typeof event.userId !== 'string') {
      errors.push('userId is required and must be a string');
    }

    if (!event.sessionId || typeof event.sessionId !== 'string') {
      errors.push('sessionId is required and must be a string');
    }

    if (!event.timestamp || !(event.timestamp instanceof Date)) {
      errors.push('timestamp is required and must be a Date object');
    }

    // Event type validation
    const validEventTypes = ['page_view', 'feature_usage', 'task_completion', 'abandonment'];
    if (!validEventTypes.includes(event.eventType)) {
      errors.push(`eventType must be one of: ${validEventTypes.join(', ')}`);
    }

    // Age group validation if provided
    if (event.userContext?.ageGroup) {
      const validAgeGroups = ['22-30', '31-40', '41-55', '56-65', '66+'];
      if (!validAgeGroups.includes(event.userContext.ageGroup)) {
        errors.push(`ageGroup must be one of: ${validAgeGroups.join(', ')}`);
      }
    }

    // Metadata validation
    if (event.metadata) {
      if (event.metadata.duration !== undefined && typeof event.metadata.duration !== 'number') {
        errors.push('metadata.duration must be a number');
      }

      if (event.metadata.success !== undefined && typeof event.metadata.success !== 'boolean') {
        errors.push('metadata.success must be a boolean');
      }
    }

    // Digital literacy score validation
    if (event.userContext?.digitalLiteracyScore !== undefined) {
      const score = event.userContext.digitalLiteracyScore;
      if (typeof score !== 'number' || score < 0 || score > 100) {
        errors.push('digitalLiteracyScore must be a number between 0 and 100');
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Sanitize event data to remove potentially sensitive information
   * Requirements: 5.2 - Implement data minimization principles
   */
  sanitizeEvent(event: UserEvent): UserEvent {
    const sanitized = { ...event };

    // Remove or sanitize potentially sensitive metadata
    if (sanitized.metadata) {
      // Remove error codes that might contain sensitive information
      if (sanitized.metadata.errorCode) {
        sanitized.metadata.errorCode = this.sanitizeErrorCode(sanitized.metadata.errorCode);
      }

      // Sanitize screen names to remove user-specific data
      if (sanitized.metadata.screenName) {
        sanitized.metadata.screenName = this.sanitizeScreenName(sanitized.metadata.screenName);
      }
    }

    // Ensure timestamp is not in the future (data integrity)
    if (sanitized.timestamp > new Date()) {
      sanitized.timestamp = new Date();
    }

    return sanitized;
  }

  /**
   * Sanitize error codes to remove sensitive information
   */
  private sanitizeErrorCode(errorCode: string): string {
    // Remove any potential user IDs, emails, or other sensitive data from error codes
    return errorCode.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[EMAIL]')
                   .replace(/\b\d{4,}\b/g, '[ID]')
                   .replace(/\b[A-Za-z0-9]{8,}\b/g, '[TOKEN]');
  }

  /**
   * Sanitize screen names to remove user-specific information
   */
  private sanitizeScreenName(screenName: string): string {
    // Remove any potential user IDs or sensitive parameters from screen names
    return screenName.replace(/\/\d+/g, '/[ID]')
                    .replace(/[?&]id=\d+/g, (match) => match.charAt(0) + 'id=[ID]')
                    .replace(/[?&]user=\w+/g, (match) => match.charAt(0) + 'user=[USER]');
  }

  /**
   * Flush buffered events to the processing pipeline
   * Requirements: 1.1 - Reliable event processing with buffering
   */
  async flush(): Promise<void> {
    if (this.eventBuffer.length === 0) {
      return;
    }

    const eventsToFlush = [...this.eventBuffer];
    this.eventBuffer = [];

    try {
      await this.sendEvents(eventsToFlush);
    } catch (error) {
      console.error('Error flushing events:', error);
      // Re-add events to buffer for retry
      this.eventBuffer.unshift(...eventsToFlush);
      throw error;
    }
  }

  /**
   * Send events to the processing pipeline with retry logic
   */
  private async sendEvents(events: UserEvent[]): Promise<void> {
    let attempts = 0;
    let lastError: Error | null = null;

    while (attempts < this.config.retryAttempts) {
      try {
        // In a real implementation, this would send to Kafka/API endpoint
        // For now, we'll simulate the sending process
        await this.simulateEventSending(events);
        return;
      } catch (error) {
        lastError = error as Error;
        attempts++;
        
        if (attempts < this.config.retryAttempts) {
          // Exponential backoff
          const delay = Math.pow(2, attempts) * 1000;
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw new Error(`Failed to send events after ${attempts} attempts: ${lastError?.message}`);
  }

  /**
   * Simulate event sending (placeholder for actual implementation)
   */
  private async simulateEventSending(events: UserEvent[]): Promise<void> {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Simulate occasional failures for testing retry logic
    if (Math.random() < 0.1) {
      throw new Error('Simulated network error');
    }

    console.log(`Successfully sent ${events.length} events to processing pipeline`);
  }

  /**
   * Start the automatic flush timer
   */
  private startFlushTimer(): void {
    this.flushTimer = setInterval(async () => {
      try {
        await this.flush();
      } catch (error) {
        console.error('Error in automatic flush:', error);
      }
    }, this.config.flushInterval);
  }

  /**
   * Stop the event collector and flush remaining events
   */
  async stop(): Promise<void> {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }

    await this.flush();
  }

  /**
   * Get current buffer size for monitoring
   */
  getBufferSize(): number {
    return this.eventBuffer.length;
  }
}
