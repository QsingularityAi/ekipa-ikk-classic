import { DeliveryChannelHandler, DeliveryResult, ChannelConfig, SMSPayload } from './interfaces';
import { DeliveryRequest } from '../../types';

/**
 * Configuration for SMS handler
 */
export interface SMSConfig {
  apiKey: string;
  endpoint: string;
  fromNumber: string;
  retryAttempts: number;
}

/**
 * SMS delivery handler
 * Requirements: 2.2, 3.2 - Deliver interventions via SMS
 */
export class SMSHandler implements DeliveryChannelHandler {
  private config: ChannelConfig;
  private smsConfig: SMSConfig;
  private deliveryHistory: Map<string, Date[]> = new Map();

  constructor(smsConfig: SMSConfig, config?: Partial<ChannelConfig>) {
    this.smsConfig = smsConfig;
    this.config = {
      name: 'sms',
      enabled: true,
      rateLimits: {
        perMinute: 2,
        perHour: 20,
        perDay: 50
      },
      retryPolicy: {
        maxRetries: smsConfig.retryAttempts || 3,
        backoffMultiplier: 2,
        maxBackoffSeconds: 600
      },
      ...config
    };
  }

  /**
   * Delivers SMS message
   * Requirements: 2.2 - Provide interventions via SMS for users who prefer traditional channels
   */
  async deliver(request: DeliveryRequest): Promise<DeliveryResult> {
    try {
      // Check if channel is available
      if (!await this.isAvailable()) {
        return {
          success: false,
          timestamp: new Date(),
          error: {
            code: 'CHANNEL_UNAVAILABLE',
            message: 'SMS service is not available',
            retryable: true,
            retryAfter: 300
          }
        };
      }

      // Check rate limits
      if (!this.checkRateLimits(request.userId)) {
        return {
          success: false,
          timestamp: new Date(),
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: 'Rate limit exceeded for SMS',
            retryable: true,
            retryAfter: 600
          }
        };
      }

      // Convert content to SMS payload
      const payload = this.createSMSPayload(request);

      // Validate SMS content
      const validationError = this.validateSMSContent(payload);
      if (validationError) {
        return {
          success: false,
          timestamp: new Date(),
          error: validationError
        };
      }

      // Send SMS (simulate SMS gateway)
      const deliveryId = await this.sendSMS(request.userId, payload);

      // Record delivery for rate limiting
      this.recordDelivery(request.userId);

      return {
        success: true,
        deliveryId,
        timestamp: new Date(),
        metadata: {
          channel: 'sms',
          messageLength: payload.message.length,
          unicode: payload.unicode
        }
      };

    } catch (error) {
      return {
        success: false,
        timestamp: new Date(),
        error: {
          code: 'DELIVERY_FAILED',
          message: error instanceof Error ? error.message : 'Unknown error',
          retryable: true,
          retryAfter: 300
        }
      };
    }
  }

  /**
   * Checks if SMS service is available
   */
  async isAvailable(): Promise<boolean> {
    return this.config.enabled;
  }

  /**
   * Gets channel configuration
   */
  getChannelConfig(): ChannelConfig {
    return { ...this.config };
  }

  /**
   * Creates SMS payload from delivery request
   */
  private createSMSPayload(request: DeliveryRequest): SMSPayload {
    const { content } = request;
    
    // Create concise SMS message
    let message = `${content.title}\n\n${content.message}`;
    
    // Add call to action if present
    if (content.callToAction) {
      message += `\n\n${content.callToAction}: Öffnen Sie die IKK classic App`;
    }
    
    // Truncate if too long (SMS limit is typically 160 characters for GSM, 70 for Unicode)
    const maxLength = this.containsUnicode(message) ? 70 : 160;
    if (message.length > maxLength) {
      message = message.substring(0, maxLength - 3) + '...';
    }
    
    return {
      message,
      sender: 'IKK classic',
      unicode: this.containsUnicode(message)
    };
  }

  /**
   * Checks if message contains Unicode characters
   */
  private containsUnicode(text: string): boolean {
    // Check for characters outside GSM 7-bit character set
    const gsmCharset = /^[A-Za-z0-9@£$¥èéùìòÇØøÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !"#¤%&'()*+,\-./:;<=>?¡ÄÖÑÜ§¿äöñüà\r\n\f\^{}\\~\[\]|€]*$/;
    return !gsmCharset.test(text);
  }

  /**
   * Validates SMS content before sending
   */
  private validateSMSContent(payload: SMSPayload): any {
    if (!payload.message || payload.message.trim().length === 0) {
      return {
        code: 'INVALID_CONTENT',
        message: 'SMS message cannot be empty',
        retryable: false
      };
    }
    
    if (payload.message.length > 1600) { // Multi-part SMS limit
      return {
        code: 'MESSAGE_TOO_LONG',
        message: 'SMS message exceeds maximum length',
        retryable: false
      };
    }
    
    return null;
  }

  /**
   * Simulates sending SMS (replace with actual SMS gateway implementation)
   */
  private async sendSMS(userId: string, payload: SMSPayload): Promise<string> {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 200));
    
    // Simulate occasional failures
    if (Math.random() < 0.02) { // 2% failure rate
      throw new Error('SMS gateway temporarily unavailable');
    }
    
    // Generate mock delivery ID
    return `sms_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Checks rate limits for user
   */
  private checkRateLimits(userId: string): boolean {
    const now = new Date();
    const userHistory = this.deliveryHistory.get(userId) || [];
    
    // Clean old entries
    const oneMinuteAgo = new Date(now.getTime() - 60 * 1000);
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    
    const recentDeliveries = userHistory.filter(timestamp => timestamp > oneDayAgo);
    const hourlyDeliveries = recentDeliveries.filter(timestamp => timestamp > oneHourAgo);
    const minutelyDeliveries = recentDeliveries.filter(timestamp => timestamp > oneMinuteAgo);
    
    // Update history with cleaned entries
    this.deliveryHistory.set(userId, recentDeliveries);
    
    // Check limits (SMS has stricter limits due to cost)
    return (
      minutelyDeliveries.length < this.config.rateLimits.perMinute &&
      hourlyDeliveries.length < this.config.rateLimits.perHour &&
      recentDeliveries.length < this.config.rateLimits.perDay
    );
  }

  /**
   * Records delivery timestamp for rate limiting
   */
  private recordDelivery(userId: string): void {
    const userHistory = this.deliveryHistory.get(userId) || [];
    userHistory.push(new Date());
    this.deliveryHistory.set(userId, userHistory);
  }

  /**
   * Gets delivery statistics for monitoring
   */
  getDeliveryStats(): {
    totalDeliveries: number;
    successRate: number;
    averageMessageLength: number;
    unicodeMessagePercentage: number;
  } {
    let totalDeliveries = 0;
    for (const userDeliveries of this.deliveryHistory.values()) {
      totalDeliveries += userDeliveries.length;
    }
    
    return {
      totalDeliveries,
      successRate: 0.98, // Mock success rate (SMS typically has high success rate)
      averageMessageLength: 85, // Mock average message length
      unicodeMessagePercentage: 0.15 // Mock percentage of Unicode messages
    };
  }

  /**
   * Estimates SMS cost based on message characteristics
   */
  estimateCost(payload: SMSPayload): number {
    const baseRate = 0.05; // €0.05 per SMS segment
    const unicodeMultiplier = 1.2; // Unicode messages cost slightly more
    
    // Calculate number of SMS segments
    const maxLength = payload.unicode ? 70 : 160;
    const segments = Math.ceil(payload.message.length / maxLength);
    
    let cost = segments * baseRate;
    if (payload.unicode) {
      cost *= unicodeMultiplier;
    }
    
    return cost;
  }
}