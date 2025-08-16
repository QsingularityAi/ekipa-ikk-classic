import { DeliveryChannelHandler, DeliveryResult, ChannelConfig, InAppNotificationPayload } from './interfaces';
import { DeliveryRequest } from '../../types';

/**
 * Configuration for in-app notification handler
 */
export interface InAppNotificationConfig {
  maxActiveNotifications: number;
  displayDuration: number;
  priority: 'low' | 'normal' | 'high';
}

/**
 * In-app notification delivery handler
 * Requirements: 2.2, 3.2 - Deliver interventions via in-app notifications
 */
export class InAppNotificationHandler implements DeliveryChannelHandler {
  private config: ChannelConfig;
  private inAppConfig: InAppNotificationConfig;
  private activeNotifications: Map<string, InAppNotificationPayload[]> = new Map();
  private deliveryHistory: Map<string, Date[]> = new Map();

  constructor(inAppConfig: InAppNotificationConfig, config?: Partial<ChannelConfig>) {
    this.inAppConfig = inAppConfig;
    this.config = {
      name: 'in_app',
      enabled: true,
      rateLimits: {
        perMinute: 5,
        perHour: 50,
        perDay: 200
      },
      retryPolicy: {
        maxRetries: 2,
        backoffMultiplier: 1.5,
        maxBackoffSeconds: 60
      },
      ...config
    };
  }

  /**
   * Delivers in-app notification
   * Requirements: 2.2 - Provide contextual nudges within the app
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
            message: 'In-app notification service is not available',
            retryable: true,
            retryAfter: 30
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
            message: 'Rate limit exceeded for in-app notifications',
            retryable: true,
            retryAfter: 60
          }
        };
      }

      // Convert content to in-app notification payload
      const payload = this.createInAppPayload(request);

      // Store notification for user session
      const deliveryId = await this.storeNotification(request.userId, payload);

      // Record delivery for rate limiting
      this.recordDelivery(request.userId);

      return {
        success: true,
        deliveryId,
        timestamp: new Date(),
        metadata: {
          channel: 'in_app',
          payload: payload,
          queuePosition: this.getQueuePosition(request.userId)
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
          retryAfter: 30
        }
      };
    }
  }

  /**
   * Checks if in-app notification service is available
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
   * Creates in-app notification payload from delivery request
   */
  private createInAppPayload(request: DeliveryRequest): InAppNotificationPayload {
    const { content } = request;
    
    // Determine notification type based on intervention strategy
    let type: 'info' | 'success' | 'warning' | 'error' = 'info';
    if (content.title.toLowerCase().includes('complete')) {
      type = 'warning';
    } else if (content.title.toLowerCase().includes('success')) {
      type = 'success';
    }
    
    return {
      title: content.title,
      message: content.message,
      type,
      duration: this.calculateDisplayDuration(content),
      actionButton: content.callToAction ? {
        text: content.callToAction,
        action: `intervention_${request.interventionId}`
      } : undefined,
      dismissible: true
    };
  }

  /**
   * Calculates display duration based on content complexity
   */
  private calculateDisplayDuration(content: any): number {
    const baseTime = 3000; // 3 seconds
    const messageLength = content.message.length;
    const readingTime = Math.max(messageLength * 50, baseTime); // ~50ms per character
    
    return Math.min(readingTime, 10000); // Max 10 seconds
  }

  /**
   * Stores notification in user's notification queue
   */
  private async storeNotification(userId: string, payload: InAppNotificationPayload): Promise<string> {
    const userNotifications = this.activeNotifications.get(userId) || [];
    
    // Limit concurrent notifications per user
    const maxConcurrent = 3;
    if (userNotifications.length >= maxConcurrent) {
      // Remove oldest notification
      userNotifications.shift();
    }
    
    userNotifications.push(payload);
    this.activeNotifications.set(userId, userNotifications);
    
    // Generate delivery ID
    return `inapp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Gets user's position in notification queue
   */
  private getQueuePosition(userId: string): number {
    const userNotifications = this.activeNotifications.get(userId) || [];
    return userNotifications.length;
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
   * Gets pending notifications for a user (for client polling)
   */
  getPendingNotifications(userId: string): InAppNotificationPayload[] {
    return this.activeNotifications.get(userId) || [];
  }

  /**
   * Marks notification as dismissed
   */
  dismissNotification(userId: string, notificationIndex: number): boolean {
    const userNotifications = this.activeNotifications.get(userId) || [];
    
    if (notificationIndex >= 0 && notificationIndex < userNotifications.length) {
      userNotifications.splice(notificationIndex, 1);
      this.activeNotifications.set(userId, userNotifications);
      return true;
    }
    
    return false;
  }

  /**
   * Clears all notifications for a user
   */
  clearAllNotifications(userId: string): void {
    this.activeNotifications.delete(userId);
  }

  /**
   * Gets delivery statistics for monitoring
   */
  getDeliveryStats(): {
    totalDeliveries: number;
    activeNotifications: number;
    averageQueueSize: number;
  } {
    let totalDeliveries = 0;
    for (const userDeliveries of this.deliveryHistory.values()) {
      totalDeliveries += userDeliveries.length;
    }
    
    let totalActiveNotifications = 0;
    for (const userNotifications of this.activeNotifications.values()) {
      totalActiveNotifications += userNotifications.length;
    }
    
    const averageQueueSize = this.activeNotifications.size > 0 
      ? totalActiveNotifications / this.activeNotifications.size 
      : 0;
    
    return {
      totalDeliveries,
      activeNotifications: totalActiveNotifications,
      averageQueueSize
    };
  }
}