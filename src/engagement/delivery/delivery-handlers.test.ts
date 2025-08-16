import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PushNotificationHandler } from './push-notification-handler';
import { InAppNotificationHandler } from './in-app-notification-handler';
import { SMSHandler } from './sms-handler';
import { EmailHandler } from './email-handler';
import { DeliveryRequest, PersonalizedContent } from '../../types';

describe('Delivery Channel Handlers Integration Tests', () => {
  let mockDeliveryRequest: DeliveryRequest;
  let mockContent: PersonalizedContent;

  beforeEach(() => {
    mockContent = {
      title: 'Complete Your Payment',
      message: 'You were almost done! Complete your payment now to secure your insurance coverage.',
      callToAction: 'Continue Payment',
      visualElements: {
        iconUrl: 'https://example.com/icon.png',
        imageUrl: 'https://example.com/image.png',
        color: '#0066cc'
      },
      accessibility: {
        fontSize: 'normal',
        highContrast: false,
        screenReaderText: 'Payment completion reminder'
      }
    };

    mockDeliveryRequest = {
      userId: 'user123',
      interventionId: 'intervention456',
      channel: 'push',
      content: mockContent,
      scheduledFor: new Date(),
      expiresAt: new Date(Date.now() + 3600000) // 1 hour from now
    };
  });

  describe('PushNotificationHandler', () => {
    let handler: PushNotificationHandler;

    beforeEach(() => {
      handler = new PushNotificationHandler();
    });

    it('should successfully deliver push notification', async () => {
      const result = await handler.deliver({
        ...mockDeliveryRequest,
        channel: 'push'
      });

      expect(result.success).toBe(true);
      expect(result.deliveryId).toBeDefined();
      expect(result.deliveryId).toMatch(/^push_/);
      expect(result.timestamp).toBeInstanceOf(Date);
      expect(result.metadata?.channel).toBe('push');
    });

    it('should respect rate limits', async () => {
      const config = {
        rateLimits: {
          perMinute: 2,
          perHour: 5,
          perDay: 10
        }
      };
      
      const limitedHandler = new PushNotificationHandler(config);
      
      // Send up to the limit
      for (let i = 0; i < config.rateLimits.perMinute; i++) {
        const result = await limitedHandler.deliver(mockDeliveryRequest);
        expect(result.success).toBe(true);
      }
      
      // Next delivery should be rate limited
      const result = await limitedHandler.deliver(mockDeliveryRequest);
      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('RATE_LIMIT_EXCEEDED');
    });

    it('should handle disabled channel', async () => {
      const disabledHandler = new PushNotificationHandler({
        enabled: false
      });
      
      const result = await disabledHandler.deliver(mockDeliveryRequest);
      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('CHANNEL_UNAVAILABLE');
    });

    it('should provide delivery statistics', () => {
      const stats = handler.getDeliveryStats();
      expect(stats).toHaveProperty('totalDeliveries');
      expect(stats).toHaveProperty('successRate');
      expect(stats).toHaveProperty('averageDeliveryTime');
    });
  });

  describe('InAppNotificationHandler', () => {
    let handler: InAppNotificationHandler;

    beforeEach(() => {
      handler = new InAppNotificationHandler();
    });

    it('should successfully deliver in-app notification', async () => {
      const result = await handler.deliver({
        ...mockDeliveryRequest,
        channel: 'in_app'
      });

      expect(result.success).toBe(true);
      expect(result.deliveryId).toBeDefined();
      expect(result.deliveryId).toMatch(/^inapp_/);
      expect(result.metadata?.channel).toBe('in_app');
      expect(result.metadata?.queuePosition).toBe(1);
    });

    it('should manage notification queue', async () => {
      // Add multiple notifications
      await handler.deliver(mockDeliveryRequest);
      await handler.deliver({
        ...mockDeliveryRequest,
        interventionId: 'intervention789'
      });

      const pendingNotifications = handler.getPendingNotifications('user123');
      expect(pendingNotifications).toHaveLength(2);
    });

    it('should limit concurrent notifications', async () => {
      // Add notifications beyond the limit (default is 3)
      for (let i = 0; i < 5; i++) {
        await handler.deliver({
          ...mockDeliveryRequest,
          interventionId: `intervention${i}`
        });
      }

      const pendingNotifications = handler.getPendingNotifications('user123');
      expect(pendingNotifications.length).toBeLessThanOrEqual(3);
    });

    it('should dismiss notifications', async () => {
      await handler.deliver(mockDeliveryRequest);
      
      const dismissed = handler.dismissNotification('user123', 0);
      expect(dismissed).toBe(true);
      
      const pendingNotifications = handler.getPendingNotifications('user123');
      expect(pendingNotifications).toHaveLength(0);
    });

    it('should clear all notifications', async () => {
      await handler.deliver(mockDeliveryRequest);
      await handler.deliver({
        ...mockDeliveryRequest,
        interventionId: 'intervention789'
      });

      handler.clearAllNotifications('user123');
      
      const pendingNotifications = handler.getPendingNotifications('user123');
      expect(pendingNotifications).toHaveLength(0);
    });
  });

  describe('SMSHandler', () => {
    let handler: SMSHandler;

    beforeEach(() => {
      handler = new SMSHandler();
    });

    it('should successfully deliver SMS', async () => {
      const result = await handler.deliver({
        ...mockDeliveryRequest,
        channel: 'sms'
      });

      expect(result.success).toBe(true);
      expect(result.deliveryId).toBeDefined();
      expect(result.deliveryId).toMatch(/^sms_/);
      expect(result.metadata?.channel).toBe('sms');
      expect(result.metadata?.messageLength).toBeGreaterThan(0);
    });

    it('should handle long messages by truncating', async () => {
      const longContent = {
        ...mockContent,
        message: 'A'.repeat(200) // Very long message
      };

      const result = await handler.deliver({
        ...mockDeliveryRequest,
        content: longContent
      });

      expect(result.success).toBe(true);
      expect(result.metadata?.messageLength).toBeLessThanOrEqual(160);
    });

    it('should detect Unicode content', async () => {
      const unicodeContent = {
        ...mockContent,
        message: 'Hallo! Ihre Versicherung läuft bald ab. Ω' // Using Greek Omega which is in GSM but testing with Chinese character
      };

      // Use a character definitely outside GSM charset
      unicodeContent.message = 'Hello 中文 Chinese characters';

      const result = await handler.deliver({
        ...mockDeliveryRequest,
        content: unicodeContent
      });

      expect(result.success).toBe(true);
      expect(result.metadata?.unicode).toBe(true);
    });

    it('should respect stricter SMS rate limits', async () => {
      const config = {
        rateLimits: {
          perMinute: 1,
          perHour: 5,
          perDay: 10
        }
      };
      
      const limitedHandler = new SMSHandler(config);
      
      // First SMS should succeed
      const result1 = await limitedHandler.deliver(mockDeliveryRequest);
      expect(result1.success).toBe(true);
      
      // Second SMS within the same minute should be rate limited
      const result2 = await limitedHandler.deliver(mockDeliveryRequest);
      expect(result2.success).toBe(false);
      expect(result2.error?.code).toBe('RATE_LIMIT_EXCEEDED');
    });

    it('should estimate SMS cost', () => {
      const payload = {
        message: 'Short message',
        sender: 'IKK classic',
        unicode: false
      };
      
      const cost = handler.estimateCost(payload);
      expect(cost).toBeGreaterThan(0);
      expect(typeof cost).toBe('number');
    });
  });

  describe('EmailHandler', () => {
    let handler: EmailHandler;

    beforeEach(() => {
      handler = new EmailHandler();
    });

    it('should successfully deliver email', async () => {
      const result = await handler.deliver({
        ...mockDeliveryRequest,
        channel: 'email'
      });

      expect(result.success).toBe(true);
      expect(result.deliveryId).toBeDefined();
      expect(result.deliveryId).toMatch(/^email_/);
      expect(result.metadata?.channel).toBe('email');
      expect(result.metadata?.subject).toContain('IKK classic');
    });

    it('should create proper HTML email with accessibility features', async () => {
      const accessibleContent = {
        ...mockContent,
        accessibility: {
          fontSize: 'large',
          highContrast: true,
          screenReaderText: 'Payment completion reminder'
        }
      };

      const result = await handler.deliver({
        ...mockDeliveryRequest,
        content: accessibleContent
      });

      expect(result.success).toBe(true);
      expect(result.metadata?.htmlLength).toBeGreaterThan(0);
      expect(result.metadata?.textLength).toBeGreaterThan(0);
    });

    it('should handle different font size preferences', async () => {
      const fontSizes = ['normal', 'large', 'extra_large'];
      
      for (const fontSize of fontSizes) {
        const content = {
          ...mockContent,
          accessibility: {
            fontSize: fontSize as 'normal' | 'large' | 'extra_large',
            highContrast: false
          }
        };

        const result = await handler.deliver({
          ...mockDeliveryRequest,
          content
        });

        expect(result.success).toBe(true);
      }
    });

    it('should validate email content', async () => {
      // Test with a handler that has invalid sender configuration
      const invalidHandler = new EmailHandler();
      
      // Override the createEmailPayload method to return invalid payload
      (invalidHandler as any).createEmailPayload = () => ({
        subject: '', // Empty subject
        htmlBody: 'Valid body',
        textBody: 'Valid text',
        sender: {
          name: 'IKK classic',
          email: 'noreply@ikk-classic.de'
        }
      });

      const result = await invalidHandler.deliver(mockDeliveryRequest);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_SUBJECT');
    });

    it('should estimate email cost', () => {
      const payload = {
        subject: 'Test Subject',
        htmlBody: '<html><body>Test HTML content</body></html>',
        textBody: 'Test text content',
        sender: {
          name: 'IKK classic',
          email: 'noreply@ikk-classic.de'
        }
      };
      
      const cost = handler.estimateCost(payload);
      expect(cost).toBeGreaterThan(0);
      expect(typeof cost).toBe('number');
    });
  });

  describe('Cross-Channel Integration', () => {
    let pushHandler: PushNotificationHandler;
    let inAppHandler: InAppNotificationHandler;
    let smsHandler: SMSHandler;
    let emailHandler: EmailHandler;

    beforeEach(() => {
      pushHandler = new PushNotificationHandler();
      inAppHandler = new InAppNotificationHandler();
      smsHandler = new SMSHandler();
      emailHandler = new EmailHandler();
    });

    it('should deliver same content across all channels', async () => {
      const channels = [
        { handler: pushHandler, channel: 'push' as const },
        { handler: inAppHandler, channel: 'in_app' as const },
        { handler: smsHandler, channel: 'sms' as const },
        { handler: emailHandler, channel: 'email' as const }
      ];

      const results = await Promise.all(
        channels.map(({ handler, channel }) =>
          handler.deliver({
            ...mockDeliveryRequest,
            channel,
            userId: `user_${channel}` // Different users to avoid rate limits
          })
        )
      );

      results.forEach((result, index) => {
        expect(result.success).toBe(true);
        expect(result.deliveryId).toBeDefined();
        expect(result.metadata?.channel).toBe(channels[index].channel);
      });
    });

    it('should handle channel availability checks', async () => {
      const handlers = [pushHandler, inAppHandler, smsHandler, emailHandler];
      
      const availabilityChecks = await Promise.all(
        handlers.map(handler => handler.isAvailable())
      );

      availabilityChecks.forEach(isAvailable => {
        expect(typeof isAvailable).toBe('boolean');
      });
    });

    it('should provide consistent configuration structure', () => {
      const handlers = [pushHandler, inAppHandler, smsHandler, emailHandler];
      
      handlers.forEach(handler => {
        const config = handler.getChannelConfig();
        
        expect(config).toHaveProperty('name');
        expect(config).toHaveProperty('enabled');
        expect(config).toHaveProperty('rateLimits');
        expect(config).toHaveProperty('retryPolicy');
        
        expect(config.rateLimits).toHaveProperty('perMinute');
        expect(config.rateLimits).toHaveProperty('perHour');
        expect(config.rateLimits).toHaveProperty('perDay');
        
        expect(config.retryPolicy).toHaveProperty('maxRetries');
        expect(config.retryPolicy).toHaveProperty('backoffMultiplier');
        expect(config.retryPolicy).toHaveProperty('maxBackoffSeconds');
      });
    });

    it('should handle delivery failures gracefully', async () => {
      // Mock a handler that always fails
      const failingHandler = new PushNotificationHandler();
      
      // Override the sendPushNotification method to always throw
      (failingHandler as any).sendPushNotification = async () => {
        throw new Error('Service unavailable');
      };

      const result = await failingHandler.deliver(mockDeliveryRequest);
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error?.retryable).toBe(true);
      expect(result.timestamp).toBeInstanceOf(Date);
    });
  });
});