import { DeliveryChannelHandler, DeliveryResult, ChannelConfig, PushNotificationPayload } from './interfaces';
import { DeliveryRequest } from '../../types';

/**
 * Configuration for push notification handler
 */
export interface PushNotificationConfig {
  apiKey: string;
  endpoint: string;
  retryAttempts: number;
}

/**
 * Push notification delivery handler
 * Requirements: 2.2, 3.2 - Deliver interventions via push notifications
 */
export class PushNotificationHandler implements DeliveryChannelHandler {
  private config: ChannelConfig;
  private pushConfig: PushNotificationConfig;
  private deliveryHistory: Map<string, Date[]> = new Map();

  constructor(pushConfig: PushNotificationConfig, config?: Partial<ChannelConfig>) {
    this.pushConfig = pushConfig;
    this.config = {
      name: 'push',
      enabled: true,
      rateLimits: {
        perMinute: 10,
        perHour: 100,
        perDay: 500
      },
      retryPolicy: {
        maxRetries: pushConfig.retryAttempts || 3,
        backoffMultiplier: 2,
        maxBackoffSeconds: 300
      },
      ...config
    };
  }

  /**
   * Delivers push notification
   * Requirements: 2.2 - Provide contextual nudges through push notifications
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
            message: 'Push notification service is not available',
            retryable: true,
            retryAfter: 60
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
            message: 'Rate limit exceeded for push notifications',
            retryable: true,
            retryAfter: 300
          }
        };
      }

      // Convert content to push notification payload
      const payload = this.createPushPayload(request);

      // Simulate push notification delivery (in real implementation, this would call FCM/APNS)
      const deliveryId = await this.sendPushNotification(request.userId, payload);

      // Record delivery for rate limiting
      this.recordDelivery(request.userId);

      return {
        success: true,
        deliveryId,
        timestamp: new Date(),
        content: request.content,
        metadata: {
          channel: 'push',
          payload: payload
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
          retryAfter: 60
        }
      };
    }
  }

  /**
   * Checks if push notification service is available
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
   * Creates push notification payload from delivery request
   */
  private createPushPayload(request: DeliveryRequest): PushNotificationPayload {
    const { content } = request;
    
    return {
      title: content.title,
      body: content.message,
      data: {
        interventionId: request.interventionId,
        userId: request.userId,
        action: content.callToAction || 'open_app'
      },
      badge: 1,
      sound: 'default',
      icon: content.visualElements?.iconUrl,
      image: content.visualElements?.imageUrl,
      actions: content.callToAction ? [{
        action: 'open_action',
        title: content.callToAction,
        icon: 'ic_action'
      }] : undefined
    };
  }

  /**
   * Simulates sending push notification (replace with actual FCM/APNS implementation)
   */
  private async sendPushNotification(userId: string, payload: PushNotificationPayload): Promise<string> {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Simulate occasional failures
    if (Math.random() < 0.05) { // 5% failure rate
      throw new Error('Push notification service temporarily unavailable');
    }
    
    // Generate mock delivery ID
    return `push_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
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
    
    // Check limits
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
    averageDeliveryTime: number;
  } {
    let totalDeliveries = 0;
    for (const userDeliveries of this.deliveryHistory.values()) {
      totalDeliveries += userDeliveries.length;
    }
    
    return {
      totalDeliveries,
      successRate: 0.95, // Mock success rate
      averageDeliveryTime: 150 // Mock average delivery time in ms
    };
  }
}