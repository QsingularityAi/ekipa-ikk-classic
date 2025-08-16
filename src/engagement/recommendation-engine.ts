import { UserProfile, UserSegment, InterventionStrategy, UserEvent } from '../types';
import { UserSegmentationEngine } from './user-segmentation-engine';

/**
 * Recommendation engine for generating personalized intervention strategies
 * Requirements: 2.1, 2.2, 6.1 - Provide personalized guidance and recommendations based on user segments
 */
export class RecommendationEngine {
  private segmentationEngine: UserSegmentationEngine;
  private strategyCache: Map<string, InterventionStrategy[]> = new Map();
  private userInterventionHistory: Map<string, InterventionHistory[]> = new Map();

  constructor(segmentationEngine?: UserSegmentationEngine) {
    this.segmentationEngine = segmentationEngine || new UserSegmentationEngine();
  }

  /**
   * Generate intervention recommendations for a user based on their profile and recent events
   * Requirements: 2.1 - Analyze user profile and usage history to provide personalized feature recommendations
   */
  public generateRecommendations(
    userProfile: UserProfile,
    recentEvents: UserEvent[],
    maxRecommendations: number = 3
  ): InterventionRecommendation[] {
    // Get user segment
    const userSegment = this.segmentationEngine.segmentUser(userProfile);
    if (!userSegment) {
      return [];
    }

    // Analyze recent events to determine context
    const eventContext = this.analyzeEventContext(recentEvents);
    
    // Get intervention history to avoid over-messaging
    const interventionHistory = this.userInterventionHistory.get(userProfile.userId) || [];
    
    // Filter and score strategies based on context and history
    const scoredStrategies = this.scoreStrategies(
      userSegment.interventionStrategies,
      eventContext,
      interventionHistory,
      userProfile
    );

    // Select top recommendations
    const recommendations = scoredStrategies
      .sort((a, b) => b.score - a.score)
      .slice(0, maxRecommendations)
      .map(scored => ({
        strategy: scored.strategy,
        score: scored.score,
        reasoning: scored.reasoning,
        urgency: this.calculateUrgency(scored.strategy, eventContext),
        expectedImpact: this.estimateImpact(scored.strategy, userProfile)
      }));

    return recommendations;
  }

  /**
   * Get intervention strategy for a specific trigger event
   * Requirements: 2.2 - Provide contextual nudges when user is likely to abandon workflow
   */
  public getStrategyForTrigger(
    userProfile: UserProfile,
    triggerEvent: UserEvent
  ): InterventionStrategy | null {
    const userSegment = this.segmentationEngine.segmentUser(userProfile);
    if (!userSegment) {
      return null;
    }

    // Find strategies that match the trigger event
    const matchingStrategies = userSegment.interventionStrategies.filter(strategy =>
      this.matchesTrigger(strategy, triggerEvent)
    );

    if (matchingStrategies.length === 0) {
      return null;
    }

    // Select best strategy based on user context and history
    const interventionHistory = this.userInterventionHistory.get(userProfile.userId) || [];
    const scoredStrategies = this.scoreStrategies(
      matchingStrategies,
      { triggerEvent, recentEvents: [triggerEvent] },
      interventionHistory,
      userProfile
    );

    return scoredStrategies.length > 0 ? scoredStrategies[0].strategy : null;
  }

  /**
   * Record intervention delivery for tracking effectiveness
   * Requirements: 2.2 - Track intervention effectiveness and user response patterns
   */
  public recordInterventionDelivery(
    userId: string,
    strategy: InterventionStrategy,
    deliveryChannel: string,
    deliveredAt: Date
  ): void {
    const history = this.userInterventionHistory.get(userId) || [];
    history.push({
      strategyId: strategy.strategyId,
      deliveredAt,
      channel: deliveryChannel,
      responded: false,
      responseAt: null
    });
    this.userInterventionHistory.set(userId, history);
  }

  /**
   * Record user response to intervention
   * Requirements: 2.2 - Track user response patterns for optimization
   */
  public recordInterventionResponse(
    userId: string,
    strategyId: string,
    respondedAt: Date
  ): void {
    const history = this.userInterventionHistory.get(userId) || [];
    const intervention = history.find(h => h.strategyId === strategyId && !h.responded);
    
    if (intervention) {
      intervention.responded = true;
      intervention.responseAt = respondedAt;
    }
  }

  /**
   * Get intervention effectiveness metrics for a strategy
   * Requirements: 2.2 - Measure intervention effectiveness for optimization
   */
  public getStrategyEffectiveness(strategyId: string): StrategyEffectiveness {
    let totalDeliveries = 0;
    let totalResponses = 0;
    let totalResponseTime = 0;
    let responseCount = 0;

    for (const history of this.userInterventionHistory.values()) {
      for (const intervention of history) {
        if (intervention.strategyId === strategyId) {
          totalDeliveries++;
          if (intervention.responded && intervention.responseAt) {
            totalResponses++;
            const responseTime = intervention.responseAt.getTime() - intervention.deliveredAt.getTime();
            totalResponseTime += responseTime;
            responseCount++;
          }
        }
      }
    }

    return {
      strategyId,
      deliveryCount: totalDeliveries,
      responseCount: totalResponses,
      responseRate: totalDeliveries > 0 ? totalResponses / totalDeliveries : 0,
      averageResponseTime: responseCount > 0 ? totalResponseTime / responseCount : 0
    };
  }

  /**
   * Update strategy cache for performance optimization
   */
  public updateStrategyCache(segmentId: string, strategies: InterventionStrategy[]): void {
    this.strategyCache.set(segmentId, strategies);
  }

  /**
   * Clear intervention history for a user (for privacy compliance)
   * Requirements: 5.1 - Support data deletion for GDPR compliance
   */
  public clearUserHistory(userId: string): void {
    this.userInterventionHistory.delete(userId);
  }

  private analyzeEventContext(recentEvents: UserEvent[]): EventContext {
    const context: EventContext = {
      recentEvents,
      abandonmentRisk: this.calculateAbandonmentRisk(recentEvents),
      engagementTrend: this.calculateEngagementTrend(recentEvents),
      lastActiveFeature: this.getLastActiveFeature(recentEvents),
      sessionDuration: this.calculateSessionDuration(recentEvents)
    };

    // Add trigger event - prioritize most recent event that could trigger an intervention
    const triggerEvent = recentEvents
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .find(event => 
        event.eventType === 'abandonment' || 
        event.eventType === 'page_view' ||
        (event.eventType === 'feature_usage' && event.metadata.success === false) ||
        event.eventType === 'task_completion'
      );
    
    if (triggerEvent) {
      context.triggerEvent = triggerEvent;
    }

    return context;
  }

  private scoreStrategies(
    strategies: InterventionStrategy[],
    context: EventContext,
    history: InterventionHistory[],
    userProfile: UserProfile
  ): ScoredStrategy[] {
    return strategies.map(strategy => {
      let score = 50; // Base score
      const reasoning: string[] = [];

      // Context relevance scoring
      if (context.triggerEvent && this.matchesTrigger(strategy, context.triggerEvent)) {
        score += 30;
        reasoning.push('Matches current trigger event');
      }

      // Abandonment risk scoring
      if (context.abandonmentRisk > 0.7 && strategy.type === 'nudge') {
        score += 25;
        reasoning.push('High abandonment risk detected');
      } else if (context.abandonmentRisk > 0.5 && strategy.type === 'incentive') {
        score += 20;
        reasoning.push('Medium abandonment risk detected');
      }

      // Engagement trend scoring
      if (context.engagementTrend === 'declining' && strategy.type === 'education') {
        score += 15;
        reasoning.push('Declining engagement trend');
      } else if (context.engagementTrend === 'improving' && strategy.type === 'gamification') {
        score += 10;
        reasoning.push('Improving engagement trend');
      }

      // Channel preference scoring
      const preferredChannels = userProfile.preferences.communicationChannels;
      const channelMatch = strategy.channels.some(channel => preferredChannels.includes(channel));
      if (channelMatch) {
        score += 15;
        reasoning.push('Matches preferred communication channel');
      }

      // Frequency and timing scoring
      const recentSimilarInterventions = history.filter(h => 
        h.strategyId === strategy.strategyId && 
        Date.now() - h.deliveredAt.getTime() < 24 * 60 * 60 * 1000 // Last 24 hours
      );

      if (recentSimilarInterventions.length > 0) {
        score -= 20;
        reasoning.push('Recently delivered similar intervention');
      }

      // User notification frequency preference
      const frequencyMultiplier = this.getFrequencyMultiplier(userProfile.preferences.notificationFrequency);
      score *= frequencyMultiplier;

      // Age-appropriate content scoring
      const ageGroup = userProfile.demographics.ageGroup;
      if (this.isAgeAppropriate(strategy, ageGroup)) {
        score += 10;
        reasoning.push('Age-appropriate content');
      }

      return {
        strategy,
        score: Math.max(0, Math.min(100, score)), // Clamp between 0-100
        reasoning: reasoning.join(', ')
      };
    });
  }

  private matchesTrigger(strategy: InterventionStrategy, event: UserEvent): boolean {
    if (strategy.trigger.eventType !== event.eventType) {
      return false;
    }

    // Check trigger conditions
    for (const [key, value] of Object.entries(strategy.trigger.conditions)) {
      if (event.metadata[key as keyof typeof event.metadata] !== value) {
        return false;
      }
    }

    return true;
  }

  private calculateAbandonmentRisk(events: UserEvent[]): number {
    if (events.length === 0) return 0;

    const abandonmentEvents = events.filter(e => e.eventType === 'abandonment');
    const failureEvents = events.filter(e => 
      e.eventType === 'feature_usage' && e.metadata.success === false
    );

    // Calculate risk based on proportion of negative events
    const negativeEvents = abandonmentEvents.length + failureEvents.length;
    const riskScore = negativeEvents / events.length;
    
    // Apply weights to make abandonment events more significant
    const weightedRisk = (abandonmentEvents.length * 0.9 + failureEvents.length * 0.6) / events.length;
    
    return Math.min(1, Math.max(riskScore, weightedRisk));
  }

  private calculateEngagementTrend(events: UserEvent[]): 'improving' | 'stable' | 'declining' {
    if (events.length < 3) return 'stable';

    const sortedEvents = events.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    const midPoint = Math.floor(sortedEvents.length / 2);
    
    const firstHalf = sortedEvents.slice(0, midPoint);
    const secondHalf = sortedEvents.slice(midPoint);

    const firstHalfSuccess = firstHalf.filter(e => 
      e.eventType === 'task_completion' && e.metadata.success === true
    ).length;
    
    const secondHalfSuccess = secondHalf.filter(e => 
      e.eventType === 'task_completion' && e.metadata.success === true
    ).length;

    const firstHalfRate = firstHalfSuccess / firstHalf.length;
    const secondHalfRate = secondHalfSuccess / secondHalf.length;

    if (secondHalfRate > firstHalfRate + 0.1) return 'improving';
    if (secondHalfRate < firstHalfRate - 0.1) return 'declining';
    return 'stable';
  }

  private getLastActiveFeature(events: UserEvent[]): string | null {
    const featureEvents = events
      .filter(e => e.eventType === 'feature_usage' && e.metadata.featureId)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    
    return featureEvents.length > 0 ? featureEvents[0].metadata.featureId || null : null;
  }

  private calculateSessionDuration(events: UserEvent[]): number {
    if (events.length === 0) return 0;

    const sessionEvents = events.filter(e => e.metadata.duration);
    const totalDuration = sessionEvents.reduce((sum, e) => sum + (e.metadata.duration || 0), 0);
    
    return sessionEvents.length > 0 ? totalDuration / sessionEvents.length : 0;
  }

  private calculateUrgency(strategy: InterventionStrategy, context: EventContext): 'low' | 'medium' | 'high' {
    if (context.abandonmentRisk > 0.8) return 'high';
    if (context.abandonmentRisk > 0.5 || strategy.type === 'nudge') return 'medium';
    return 'low';
  }

  private estimateImpact(strategy: InterventionStrategy, userProfile: UserProfile): 'low' | 'medium' | 'high' {
    const effectiveness = this.getStrategyEffectiveness(strategy.strategyId);
    
    if (effectiveness.responseRate > 0.7) return 'high';
    if (effectiveness.responseRate > 0.4) return 'medium';
    return 'low';
  }

  private getFrequencyMultiplier(frequency: 'high' | 'medium' | 'low'): number {
    switch (frequency) {
      case 'high': return 1.2;
      case 'medium': return 1.0;
      case 'low': return 0.8;
      default: return 1.0;
    }
  }

  private isAgeAppropriate(strategy: InterventionStrategy, ageGroup: string): boolean {
    // Age-appropriate strategy mapping
    const youngAgeGroups = ['22-30', '31-40'];
    const olderAgeGroups = ['56-65', '66+'];

    if (youngAgeGroups.includes(ageGroup)) {
      return strategy.type === 'gamification' || strategy.type === 'incentive';
    }

    if (olderAgeGroups.includes(ageGroup)) {
      return strategy.type === 'education' || strategy.type === 'nudge';
    }

    return true; // Middle age groups are flexible
  }
}

// Supporting interfaces
interface InterventionHistory {
  strategyId: string;
  deliveredAt: Date;
  channel: string;
  responded: boolean;
  responseAt: Date | null;
}

interface EventContext {
  recentEvents: UserEvent[];
  triggerEvent?: UserEvent;
  abandonmentRisk: number;
  engagementTrend: 'improving' | 'stable' | 'declining';
  lastActiveFeature: string | null;
  sessionDuration: number;
}

interface ScoredStrategy {
  strategy: InterventionStrategy;
  score: number;
  reasoning: string;
}

export interface InterventionRecommendation {
  strategy: InterventionStrategy;
  score: number;
  reasoning: string;
  urgency: 'low' | 'medium' | 'high';
  expectedImpact: 'low' | 'medium' | 'high';
}

export interface StrategyEffectiveness {
  strategyId: string;
  deliveryCount: number;
  responseCount: number;
  responseRate: number;
  averageResponseTime: number;
}