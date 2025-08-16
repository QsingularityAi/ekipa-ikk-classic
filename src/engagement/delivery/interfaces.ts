import { DeliveryRequest, PersonalizedContent } from '../../types';

/**
 * Base interface for all delivery channel handlers
 * Requirements: 2.2, 3.2 - Multi-channel intervention delivery
 */
export interface DeliveryChannelHandler {
  /**
   * Delivers an intervention through the specific channel
   */
  deliver(request: DeliveryRequest): Promise<DeliveryResult>;
  
  /**
   * Checks if the channel is available and configured
   */
  isAvailable(): Promise<boolean>;
  
  /**
   * Gets channel-specific configuration
   */
  getChannelConfig(): ChannelConfig;
}

/**
 * Result of a delivery attempt
 */
export interface DeliveryResult {
  success: boolean;
  deliveryId?: string;
  timestamp: Date;
  content?: import('../../types').PersonalizedContent;
  error?: DeliveryError;
  metadata?: Record<string, unknown>;
}

/**
 * Delivery error information
 */
export interface DeliveryError {
  code: string;
  message: string;
  retryable: boolean;
  retryAfter?: number; // seconds
}

/**
 * Channel-specific configuration
 */
export interface ChannelConfig {
  name: string;
  enabled: boolean;
  rateLimits: {
    perMinute: number;
    perHour: number;
    perDay: number;
  };
  retryPolicy: {
    maxRetries: number;
    backoffMultiplier: number;
    maxBackoffSeconds: number;
  };
}

/**
 * Push notification specific payload
 */
export interface PushNotificationPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
  badge?: number;
  sound?: string;
  icon?: string;
  image?: string;
  actions?: Array<{
    action: string;
    title: string;
    icon?: string;
  }>;
}

/**
 * In-app notification specific payload
 */
export interface InAppNotificationPayload {
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  duration?: number; // milliseconds
  actionButton?: {
    text: string;
    action: string;
  };
  dismissible?: boolean;
}

/**
 * SMS specific payload
 */
export interface SMSPayload {
  message: string;
  sender?: string;
  unicode?: boolean;
}

/**
 * Email specific payload
 */
export interface EmailPayload {
  subject: string;
  htmlBody: string;
  textBody: string;
  sender: {
    name: string;
    email: string;
  };
  replyTo?: string;
  attachments?: Array<{
    filename: string;
    content: Buffer;
    contentType: string;
  }>;
}