import { UserProfile, InterventionStrategy, DeliveryRequest, PersonalizedContent } from '../types';
import { InterventionOrchestratorConfig } from './interfaces';

/**
 * InterventionOrchestrator manages the delivery timing and channel selection for user interventions
 * Requirements: 2.2, 2.3, 3.2 - Deliver personalized interventions across multiple channels
 */
export class InterventionOrchestrator {
  private config: InterventionOrchestratorConfig;
  private deliveryHistory: Map<string, DeliveryRequest[]> = new Map();
  private channelEffectiveness: Map<string, Map<string, number>> = new Map(); // userId -> channel -> effectiveness score

  constructor(config: InterventionOrchestratorConfig) {
    this.config = config;
  }

  /**
   * Orchestrates intervention delivery by selecting optimal channel and timing
   * Requirements: 2.2 - Provide contextual nudges and assistance
   */
  async orchestrateIntervention(
    userId: string,
    userProfile: UserProfile,
    strategy: InterventionStrategy,
    personalizedContent: PersonalizedContent
  ): Promise<DeliveryRequest | null> {
    // Check rate limits
    if (!this.checkRateLimits(userId)) {
      return null;
    }

    // Select optimal channel
    const selectedChannel = this.selectOptimalChannel(userId, userProfile, strategy);
    if (!selectedChannel) {
      return null;
    }

    // Calculate delivery timing
    const scheduledFor = this.calculateDeliveryTiming(strategy, userProfile);
    const expiresAt = new Date(scheduledFor.getTime() + (strategy.timing.expiresAfter || 24 * 60 * 60 * 1000));

    const deliveryRequest: DeliveryRequest = {
      userId,
      interventionId: strategy.strategyId,
      channel: selectedChannel,
      content: personalizedContent,
      scheduledFor,
      expiresAt
    };

    // Record delivery request
    this.recordDeliveryRequest(userId, deliveryRequest);

    return deliveryRequest;
  }

  /**
   * Selects the optimal delivery channel based on user preferences and effectiveness
   * Requirements: 2.2 - Route interventions based on user preferences and effectiveness
   */
  private selectOptimalChannel(
    userId: string,
    userProfile: UserProfile,
    strategy: InterventionStrategy
  ): 'push' | 'in_app' | 'sms' | 'email' | null {
    // Filter available channels based on strategy and config
    const availableChannels = strategy.channels.filter(channel => {
      switch (channel) {
        case 'push':
          return this.config.channels.push;
        case 'in_app':
          return this.config.channels.inApp;
        case 'sms':
          return this.config.channels.sms;
        case 'email':
          return this.config.channels.email;
        default:
          return false;
      }
    });

    if (availableChannels.length === 0) {
      return null;
    }

    // Get user preferences
    const preferredChannels = userProfile.preferences.communicationChannels;
    
    // Get channel effectiveness for this user
    const userEffectiveness = this.channelEffectiveness.get(userId) || new Map();

    // Score channels based on preference and effectiveness
    const channelScores = availableChannels.map(channel => {
      let score = 0;
      
      // Preference score (0-1)
      if (preferredChannels.includes(channel)) {
        score += 0.6;
      }
      
      // Effectiveness score (0-1)
      const effectiveness = userEffectiveness.get(channel) || 0.5; // Default to neutral
      score += effectiveness * 0.4;
      
      // Age-based channel preferences
      score += this.getAgeBasedChannelScore(userProfile.demographics.ageGroup, channel);

      return { channel, score };
    });

    // Sort by score and return the best channel
    channelScores.sort((a, b) => b.score - a.score);
    return channelScores[0].channel as 'push' | 'in_app' | 'sms' | 'email';
  }

  /**
   * Calculates optimal delivery timing based on strategy and user profile
   * Requirements: 2.3 - Manage timing of interventions
   */
  private calculateDeliveryTiming(strategy: InterventionStrategy, userProfile: UserProfile): Date {
    const now = new Date();
    const delay = strategy.timing.delay || 0;
    
    // Base delivery time
    let deliveryTime = new Date(now.getTime() + delay);
    
    // Adjust for user's notification frequency preference
    if (userProfile.preferences.notificationFrequency === 'low') {
      // Add additional delay for low-frequency users
      deliveryTime = new Date(deliveryTime.getTime() + 2 * 60 * 60 * 1000); // +2 hours
    }
    
    // Ensure delivery during reasonable hours (9 AM - 9 PM)
    const hour = deliveryTime.getHours();
    if (hour < 9) {
      deliveryTime.setHours(9, 0, 0, 0);
    } else if (hour > 21) {
      deliveryTime.setDate(deliveryTime.getDate() + 1);
      deliveryTime.setHours(9, 0, 0, 0);
    }
    
    return deliveryTime;
  }

  /**
   * Checks if user is within rate limits for interventions
   * Requirements: 3.2 - Manage intervention frequency to avoid spam
   */
  private checkRateLimits(userId: string): boolean {
    const userHistory = this.deliveryHistory.get(userId) || [];
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    
    // Count deliveries in the last hour
    const recentDeliveries = userHistory.filter(req => req.scheduledFor > oneHourAgo);
    
    return recentDeliveries.length < this.config.rateLimits.perHour;
  }

  /**
   * Records delivery request for rate limiting and analytics
   */
  private recordDeliveryRequest(userId: string, request: DeliveryRequest): void {
    const userHistory = this.deliveryHistory.get(userId) || [];
    userHistory.push(request);
    
    // Keep only recent history (last 24 hours)
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const filteredHistory = userHistory.filter(req => req.scheduledFor > oneDayAgo);
    
    this.deliveryHistory.set(userId, filteredHistory);
  }

  /**
   * Updates channel effectiveness based on user response
   * Requirements: 2.2 - Optimize channel selection based on effectiveness
   */
  updateChannelEffectiveness(userId: string, channel: string, effectiveness: number): void {
    if (!this.channelEffectiveness.has(userId)) {
      this.channelEffectiveness.set(userId, new Map());
    }
    
    const userEffectiveness = this.channelEffectiveness.get(userId)!;
    
    // Use exponential moving average to update effectiveness
    const currentEffectiveness = userEffectiveness.get(channel) || 0.5;
    const alpha = 0.3; // Learning rate
    const newEffectiveness = alpha * effectiveness + (1 - alpha) * currentEffectiveness;
    
    userEffectiveness.set(channel, Math.max(0, Math.min(1, newEffectiveness)));
  }

  /**
   * Gets age-based channel preference score
   * Requirements: 6.1, 6.2 - Tailor interventions based on age demographics
   */
  private getAgeBasedChannelScore(ageGroup: string, channel: string): number {
    const ageChannelPreferences: Record<string, Record<string, number>> = {
      '22-30': { push: 0.3, in_app: 0.4, sms: 0.2, email: 0.1 },
      '31-40': { push: 0.25, in_app: 0.35, sms: 0.25, email: 0.15 },
      '41-55': { push: 0.2, in_app: 0.25, sms: 0.3, email: 0.25 },
      '56-65': { push: 0.15, in_app: 0.2, sms: 0.35, email: 0.3 },
      '66+': { push: 0.1, in_app: 0.15, sms: 0.4, email: 0.35 }
    };
    
    return ageChannelPreferences[ageGroup]?.[channel] || 0;
  }

  /**
   * Gets delivery statistics for analytics
   * Requirements: 4.1, 4.3 - Track intervention effectiveness
   */
  getDeliveryStats(userId?: string): {
    totalDeliveries: number;
    channelBreakdown: Record<string, number>;
    averageEffectiveness: number;
  } {
    let allDeliveries: DeliveryRequest[] = [];
    
    if (userId) {
      allDeliveries = this.deliveryHistory.get(userId) || [];
    } else {
      for (const userDeliveries of this.deliveryHistory.values()) {
        allDeliveries.push(...userDeliveries);
      }
    }
    
    const channelBreakdown: Record<string, number> = {};
    allDeliveries.forEach(delivery => {
      channelBreakdown[delivery.channel] = (channelBreakdown[delivery.channel] || 0) + 1;
    });
    
    // Calculate average effectiveness
    let totalEffectiveness = 0;
    let effectivenessCount = 0;
    
    for (const userEffectiveness of this.channelEffectiveness.values()) {
      for (const effectiveness of userEffectiveness.values()) {
        totalEffectiveness += effectiveness;
        effectivenessCount++;
      }
    }
    
    const averageEffectiveness = effectivenessCount > 0 ? totalEffectiveness / effectivenessCount : 0.5;
    
    return {
      totalDeliveries: allDeliveries.length,
      channelBreakdown,
      averageEffectiveness
    };
  }
}