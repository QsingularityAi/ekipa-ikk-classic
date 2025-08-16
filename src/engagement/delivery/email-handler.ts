import { DeliveryChannelHandler, DeliveryResult, ChannelConfig, EmailPayload } from './interfaces';
import { DeliveryRequest } from '../../types';

/**
 * Configuration for email handler
 */
export interface EmailConfig {
  apiKey: string;
  endpoint: string;
  fromEmail: string;
  retryAttempts: number;
}

/**
 * Email delivery handler
 * Requirements: 2.2, 3.2 - Deliver interventions via email
 */
export class EmailHandler implements DeliveryChannelHandler {
  private config: ChannelConfig;
  private emailConfig: EmailConfig;
  private deliveryHistory: Map<string, Date[]> = new Map();

  constructor(emailConfig: EmailConfig, config?: Partial<ChannelConfig>) {
    this.emailConfig = emailConfig;
    this.config = {
      name: 'email',
      enabled: true,
      rateLimits: {
        perMinute: 5,
        perHour: 30,
        perDay: 100
      },
      retryPolicy: {
        maxRetries: emailConfig.retryAttempts || 3,
        backoffMultiplier: 2,
        maxBackoffSeconds: 1800 // 30 minutes
      },
      ...config
    };
  }

  /**
   * Delivers email message
   * Requirements: 2.2 - Provide detailed interventions via email for comprehensive communication
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
            message: 'Email service is not available',
            retryable: true,
            retryAfter: 600
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
            message: 'Rate limit exceeded for email',
            retryable: true,
            retryAfter: 1800
          }
        };
      }

      // Convert content to email payload
      const payload = this.createEmailPayload(request);

      // Validate email content
      const validationError = this.validateEmailContent(payload);
      if (validationError) {
        return {
          success: false,
          timestamp: new Date(),
          error: validationError
        };
      }

      // Send email (simulate email service)
      const deliveryId = await this.sendEmail(request.userId, payload);

      // Record delivery for rate limiting
      this.recordDelivery(request.userId);

      return {
        success: true,
        deliveryId,
        timestamp: new Date(),
        metadata: {
          channel: 'email',
          subject: payload.subject,
          htmlLength: payload.htmlBody.length,
          textLength: payload.textBody.length
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
          retryAfter: 600
        }
      };
    }
  }

  /**
   * Checks if email service is available
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
   * Creates email payload from delivery request
   */
  private createEmailPayload(request: DeliveryRequest): EmailPayload {
    const { content } = request;
    
    // Create subject line
    const subject = `IKK classic: ${content.title}`;
    
    // Create HTML body with proper formatting
    const htmlBody = this.createHTMLBody(content, request);
    
    // Create plain text version
    const textBody = this.createTextBody(content, request);
    
    return {
      subject,
      htmlBody,
      textBody,
      sender: {
        name: 'IKK classic',
        email: 'noreply@ikk-classic.de'
      },
      replyTo: 'support@ikk-classic.de'
    };
  }

  /**
   * Creates HTML email body with accessibility features
   */
  private createHTMLBody(content: any, request: DeliveryRequest): string {
    const { accessibility } = content;
    const fontSize = this.getFontSize(accessibility?.fontSize);
    const colorScheme = accessibility?.highContrast ? 'high-contrast' : 'normal';
    
    return `
<!DOCTYPE html>
<html lang="de">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${content.title}</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            font-size: ${fontSize};
            line-height: 1.6;
            color: ${colorScheme === 'high-contrast' ? '#000000' : '#333333'};
            background-color: ${colorScheme === 'high-contrast' ? '#FFFFFF' : '#f9f9f9'};
            margin: 0;
            padding: 20px;
        }
        .container {
            max-width: 600px;
            margin: 0 auto;
            background-color: ${colorScheme === 'high-contrast' ? '#FFFFFF' : '#ffffff'};
            padding: 30px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .header {
            text-align: center;
            margin-bottom: 30px;
            padding-bottom: 20px;
            border-bottom: 2px solid #0066cc;
        }
        .logo {
            font-size: 24px;
            font-weight: bold;
            color: #0066cc;
        }
        .title {
            font-size: ${this.adjustFontSize(fontSize, 1.2)};
            font-weight: bold;
            color: #0066cc;
            margin-bottom: 20px;
        }
        .message {
            margin-bottom: 30px;
            line-height: 1.8;
        }
        .cta-button {
            display: inline-block;
            background-color: #0066cc;
            color: white;
            padding: 12px 24px;
            text-decoration: none;
            border-radius: 5px;
            font-weight: bold;
            margin: 20px 0;
        }
        .footer {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #e0e0e0;
            font-size: ${this.adjustFontSize(fontSize, 0.9)};
            color: #666666;
            text-align: center;
        }
        @media (max-width: 600px) {
            .container {
                padding: 20px;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="logo">IKK classic</div>
        </div>
        
        <h1 class="title">${content.title}</h1>
        
        <div class="message">
            ${content.message.replace(/\n/g, '<br>')}
        </div>
        
        ${content.callToAction ? `
        <div style="text-align: center;">
            <a href="#" class="cta-button" role="button" aria-label="${content.callToAction}">
                ${content.callToAction}
            </a>
        </div>
        ` : ''}
        
        ${content.visualElements?.imageUrl ? `
        <div style="text-align: center; margin: 20px 0;">
            <img src="${content.visualElements.imageUrl}" alt="Illustration" style="max-width: 100%; height: auto;">
        </div>
        ` : ''}
        
        <div class="footer">
            <p>Diese E-Mail wurde automatisch generiert, um Ihnen bei der Nutzung der IKK classic App zu helfen.</p>
            <p>Bei Fragen wenden Sie sich gerne an unseren Support: support@ikk-classic.de</p>
            <p>IKK classic | Tannenstraße 4b | 01099 Dresden</p>
        </div>
    </div>
</body>
</html>`;
  }

  /**
   * Creates plain text email body
   */
  private createTextBody(content: any, request: DeliveryRequest): string {
    let textBody = `IKK classic\n\n`;
    textBody += `${content.title}\n`;
    textBody += `${'='.repeat(content.title.length)}\n\n`;
    textBody += `${content.message}\n\n`;
    
    if (content.callToAction) {
      textBody += `${content.callToAction}: Öffnen Sie die IKK classic App\n\n`;
    }
    
    textBody += `---\n`;
    textBody += `Diese E-Mail wurde automatisch generiert, um Ihnen bei der Nutzung der IKK classic App zu helfen.\n`;
    textBody += `Bei Fragen wenden Sie sich gerne an unseren Support: support@ikk-classic.de\n\n`;
    textBody += `IKK classic | Tannenstraße 4b | 01099 Dresden`;
    
    return textBody;
  }

  /**
   * Gets CSS font size based on accessibility preference
   */
  private getFontSize(preference?: string): string {
    switch (preference) {
      case 'large':
        return '18px';
      case 'extra_large':
        return '22px';
      default:
        return '16px';
    }
  }

  /**
   * Adjusts font size by a multiplier
   */
  private adjustFontSize(baseSize: string, multiplier: number): string {
    const size = parseInt(baseSize);
    return `${Math.round(size * multiplier)}px`;
  }

  /**
   * Validates email content before sending
   */
  private validateEmailContent(payload: EmailPayload): any {
    if (!payload.subject || payload.subject.trim().length === 0) {
      return {
        code: 'INVALID_SUBJECT',
        message: 'Email subject cannot be empty',
        retryable: false
      };
    }
    
    if (!payload.htmlBody || payload.htmlBody.trim().length === 0) {
      return {
        code: 'INVALID_CONTENT',
        message: 'Email body cannot be empty',
        retryable: false
      };
    }
    
    if (!payload.sender.email || !this.isValidEmail(payload.sender.email)) {
      return {
        code: 'INVALID_SENDER',
        message: 'Invalid sender email address',
        retryable: false
      };
    }
    
    return null;
  }

  /**
   * Validates email address format
   */
  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Simulates sending email (replace with actual email service implementation)
   */
  private async sendEmail(userId: string, payload: EmailPayload): Promise<string> {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 300));
    
    // Simulate occasional failures
    if (Math.random() < 0.01) { // 1% failure rate
      throw new Error('Email service temporarily unavailable');
    }
    
    // Generate mock delivery ID
    return `email_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
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
    averageSubjectLength: number;
    averageBodyLength: number;
  } {
    let totalDeliveries = 0;
    for (const userDeliveries of this.deliveryHistory.values()) {
      totalDeliveries += userDeliveries.length;
    }
    
    return {
      totalDeliveries,
      successRate: 0.99, // Mock success rate (email typically has very high success rate)
      averageSubjectLength: 35, // Mock average subject length
      averageBodyLength: 1200 // Mock average body length
    };
  }

  /**
   * Estimates email delivery cost
   */
  estimateCost(payload: EmailPayload): number {
    const baseRate = 0.001; // €0.001 per email
    const htmlMultiplier = 1.1; // HTML emails cost slightly more
    
    let cost = baseRate;
    if (payload.htmlBody.length > payload.textBody.length * 2) {
      cost *= htmlMultiplier;
    }
    
    return cost;
  }
}