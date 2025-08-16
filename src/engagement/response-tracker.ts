import { UserEvent, UserProfile } from '../types';

/**
 * Configuration interface for ResponseTracker
 */
export interface ResponseTrackerConfig {
  trackingWindow: number; // milliseconds
  conversionEvents: string[];
  attributionModel: 'first_click' | 'last_click' | 'linear';
}

/**
 * Response tracking and measurement for intervention effectiveness
 * Requirements: 2.3, 4.1, 4.3 - Track intervention effectiveness and conversion rates
 */
export class ResponseTracker {
  private config: ResponseTrackerConfig;
  private interventionResponses: Map<string, InterventionResponse[]> = new Map();
  private conversionEvents: Map<string, ConversionEvent[]> = new Map();
  private channelPerformance: Map<string, ChannelPerformanceMetrics> = new Map();

  constructor(config: ResponseTrackerConfig) {
    this.config = config;
  }

  /**
   * Records a user response to an intervention
   * Requirements: 2.3 - Track user response to interventions
   */
  recordInterventionResponse(response: InterventionResponse): void {
    const interventionId = response.interventionId;
    const responses = this.interventionResponses.get(interventionId) || [];
    responses.push(response);
    this.interventionResponses.set(interventionId, responses);

    // Update channel performance metrics
    this.updateChannelPerformance(response);
  }

  /**
   * Tracks intervention response with simplified interface for tests
   * Requirements: 2.3 - Track user response to interventions
   */
  async trackInterventionResponse(
    interventionId: string,
    userId: string,
    responseType: 'opened' | 'clicked' | 'converted' | 'dismissed' | 'no_response',
    timestamp: Date,
    channel: 'push' | 'in_app' | 'sms' | 'email' = 'push'
  ): Promise<void> {
    const response: InterventionResponse = {
      interventionId,
      userId,
      channel,
      responseType,
      timestamp,
      responseTime: Date.now() - timestamp.getTime()
    };

    this.recordInterventionResponse(response);
  }

  /**
   * Gets intervention metrics for a specific intervention
   * Requirements: 4.1, 4.3 - Track intervention effectiveness
   */
  async getInterventionMetrics(interventionId: string): Promise<{
    totalSent: number;
    clickRate: number;
    conversionRate: number;
    responseRate: number;
  }> {
    const effectiveness = this.measureInterventionEffectiveness(interventionId);
    
    return {
      totalSent: effectiveness.totalDeliveries,
      clickRate: effectiveness.responseRate,
      conversionRate: effectiveness.conversionRate,
      responseRate: effectiveness.responseRate
    };
  }

  /**
   * Gets segment-specific metrics
   * Requirements: 6.1 - Track effectiveness across user segments
   */
  async getSegmentMetrics(ageGroup: string): Promise<{
    totalDeliveries: number;
    responseRate: number;
    conversionRate: number;
  }> {
    let totalDeliveries = 0;
    let totalResponses = 0;
    let totalConversions = 0;

    // Aggregate metrics for the age group across all interventions
    for (const responses of this.interventionResponses.values()) {
      const segmentResponses = responses.filter(r => r.userSegment === ageGroup);
      
      totalDeliveries += segmentResponses.length;
      totalResponses += segmentResponses.filter(r => r.responseType !== 'no_response').length;
      totalConversions += segmentResponses.filter(r => r.responseType === 'converted').length;
    }

    return {
      totalDeliveries,
      responseRate: totalDeliveries > 0 ? totalResponses / totalDeliveries : 0,
      conversionRate: totalDeliveries > 0 ? totalConversions / totalDeliveries : 0
    };
  }

  /**
   * Records a conversion event from traditional to digital channels
   * Requirements: 4.1, 4.3 - Track conversion from traditional to digital channels
   */
  recordConversionEvent(event: ConversionEvent): void {
    const userId = event.userId;
    const userConversions = this.conversionEvents.get(userId) || [];
    userConversions.push(event);
    this.conversionEvents.set(userId, userConversions);
  }

  /**
   * Measures intervention effectiveness for a specific intervention
   * Requirements: 2.3 - Measure intervention effectiveness
   */
  measureInterventionEffectiveness(interventionId: string): InterventionEffectivenessMetrics {
    const responses = this.interventionResponses.get(interventionId) || [];
    
    if (responses.length === 0) {
      return {
        interventionId,
        totalDeliveries: 0,
        totalResponses: 0,
        responseRate: 0,
        conversionRate: 0,
        averageResponseTime: 0,
        channelBreakdown: {},
        effectivenessScore: 0
      };
    }

    const totalDeliveries = responses.length;
    const totalResponses = responses.filter(r => r.responseType !== 'no_response').length;
    const conversions = responses.filter(r => r.responseType === 'converted').length;
    
    const responseRate = totalResponses / totalDeliveries;
    const conversionRate = conversions / totalDeliveries;
    
    // Calculate average response time
    const responseTimes = responses
      .filter(r => r.responseTime)
      .map(r => r.responseTime!);
    const averageResponseTime = responseTimes.length > 0 
      ? responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length 
      : 0;

    // Channel breakdown
    const channelBreakdown: Record<string, ChannelMetrics> = {};
    const channelGroups = this.groupResponsesByChannel(responses);
    
    for (const [channel, channelResponses] of channelGroups.entries()) {
      const channelConversions = channelResponses.filter(r => r.responseType === 'converted').length;
      channelBreakdown[channel] = {
        deliveries: channelResponses.length,
        responses: channelResponses.filter(r => r.responseType !== 'no_response').length,
        conversions: channelConversions,
        responseRate: channelResponses.filter(r => r.responseType !== 'no_response').length / channelResponses.length,
        conversionRate: channelConversions / channelResponses.length
      };
    }

    // Calculate effectiveness score (weighted combination of metrics)
    const effectivenessScore = this.calculateEffectivenessScore(responseRate, conversionRate, averageResponseTime);

    return {
      interventionId,
      totalDeliveries,
      totalResponses,
      responseRate,
      conversionRate,
      averageResponseTime,
      channelBreakdown,
      effectivenessScore
    };
  }

  /**
   * Tracks conversion from traditional to digital channels
   * Requirements: 4.1 - Track call volume reduction and digital adoption
   */
  measureChannelConversion(userId?: string): ChannelConversionMetrics {
    let allConversions: ConversionEvent[] = [];
    
    if (userId) {
      allConversions = this.conversionEvents.get(userId) || [];
    } else {
      for (const userConversions of this.conversionEvents.values()) {
        allConversions.push(...userConversions);
      }
    }

    const totalConversions = allConversions.length;
    const phoneToDigital = allConversions.filter(e => 
      e.fromChannel === 'phone' && ['app', 'web'].includes(e.toChannel)
    ).length;
    const paperToDigital = allConversions.filter(e => 
      e.fromChannel === 'paper' && ['app', 'web'].includes(e.toChannel)
    ).length;

    // Calculate time-based metrics
    const now = new Date();
    const lastMonth = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const recentConversions = allConversions.filter(e => e.timestamp > lastMonth);

    // Calculate cost savings (estimated)
    const phoneCallCostSaving = phoneToDigital * 8.50; // €8.50 per avoided phone call
    const paperProcessingCostSaving = paperToDigital * 3.20; // €3.20 per avoided paper form
    const totalCostSavings = phoneCallCostSaving + paperProcessingCostSaving;

    return {
      totalConversions,
      phoneToDigitalConversions: phoneToDigital,
      paperToDigitalConversions: paperToDigital,
      recentConversions: recentConversions.length,
      conversionRate: totalConversions > 0 ? recentConversions.length / totalConversions : 0,
      estimatedCostSavings: totalCostSavings,
      averageConversionTime: this.calculateAverageConversionTime(allConversions)
    };
  }

  /**
   * Gets comprehensive performance metrics across all channels
   * Requirements: 4.3 - Performance metrics and reporting
   */
  getPerformanceMetrics(): PerformanceMetrics {
    const channelMetrics: Record<string, ChannelPerformanceMetrics> = {};
    
    for (const [channel, metrics] of this.channelPerformance.entries()) {
      channelMetrics[channel] = { ...metrics };
    }

    // Calculate overall metrics
    let totalDeliveries = 0;
    let totalResponses = 0;
    let totalConversions = 0;
    
    for (const metrics of this.channelPerformance.values()) {
      totalDeliveries += metrics.totalDeliveries;
      totalResponses += metrics.totalResponses;
      totalConversions += metrics.totalConversions;
    }

    const overallResponseRate = totalDeliveries > 0 ? totalResponses / totalDeliveries : 0;
    const overallConversionRate = totalDeliveries > 0 ? totalConversions / totalDeliveries : 0;

    return {
      overallResponseRate,
      overallConversionRate,
      totalDeliveries,
      totalResponses,
      totalConversions,
      channelMetrics,
      conversionMetrics: this.measureChannelConversion()
    };
  }

  /**
   * Generates attribution report for intervention success
   * Requirements: 2.3 - Response measurement and attribution
   */
  generateAttributionReport(timeRange: { start: Date; end: Date }): AttributionReport {
    const interventionMetrics: Record<string, InterventionEffectivenessMetrics> = {};
    
    // Get metrics for all interventions
    for (const interventionId of this.interventionResponses.keys()) {
      interventionMetrics[interventionId] = this.measureInterventionEffectiveness(interventionId);
    }

    // Filter responses within time range
    const timeFilteredResponses = new Map<string, InterventionResponse[]>();
    for (const [interventionId, responses] of this.interventionResponses.entries()) {
      const filteredResponses = responses.filter(r => 
        r.timestamp >= timeRange.start && r.timestamp <= timeRange.end
      );
      if (filteredResponses.length > 0) {
        timeFilteredResponses.set(interventionId, filteredResponses);
      }
    }

    // Calculate top performing interventions
    const topInterventions = Object.entries(interventionMetrics)
      .sort(([, a], [, b]) => b.effectivenessScore - a.effectivenessScore)
      .slice(0, 10)
      .map(([id, metrics]) => ({ interventionId: id, ...metrics }));

    // Calculate channel attribution
    const channelAttribution: Record<string, number> = {};
    let totalAttributedConversions = 0;

    for (const responses of timeFilteredResponses.values()) {
      for (const response of responses) {
        if (response.responseType === 'converted') {
          channelAttribution[response.channel] = (channelAttribution[response.channel] || 0) + 1;
          totalAttributedConversions++;
        }
      }
    }

    // Normalize attribution percentages
    for (const channel in channelAttribution) {
      channelAttribution[channel] = totalAttributedConversions > 0 
        ? channelAttribution[channel] / totalAttributedConversions 
        : 0;
    }

    return {
      timeRange,
      topPerformingInterventions: topInterventions,
      channelAttribution,
      totalAttributedConversions,
      conversionsByTimeOfDay: this.analyzeConversionsByTimeOfDay(timeFilteredResponses),
      userSegmentPerformance: this.analyzeUserSegmentPerformance(timeFilteredResponses)
    };
  }

  /**
   * Updates channel performance metrics
   */
  private updateChannelPerformance(response: InterventionResponse): void {
    const channel = response.channel;
    const metrics = this.channelPerformance.get(channel) || {
      totalDeliveries: 0,
      totalResponses: 0,
      totalConversions: 0,
      averageResponseTime: 0,
      lastUpdated: new Date()
    };

    metrics.totalDeliveries++;
    if (response.responseType !== 'no_response') {
      metrics.totalResponses++;
    }
    if (response.responseType === 'converted') {
      metrics.totalConversions++;
    }

    // Update average response time
    if (response.responseTime) {
      const currentAvg = metrics.averageResponseTime;
      const count = metrics.totalResponses;
      metrics.averageResponseTime = ((currentAvg * (count - 1)) + response.responseTime) / count;
    }

    metrics.lastUpdated = new Date();
    this.channelPerformance.set(channel, metrics);
  }

  /**
   * Groups responses by channel
   */
  private groupResponsesByChannel(responses: InterventionResponse[]): Map<string, InterventionResponse[]> {
    const groups = new Map<string, InterventionResponse[]>();
    
    for (const response of responses) {
      const channel = response.channel;
      const channelResponses = groups.get(channel) || [];
      channelResponses.push(response);
      groups.set(channel, channelResponses);
    }
    
    return groups;
  }

  /**
   * Calculates effectiveness score based on multiple metrics
   */
  private calculateEffectivenessScore(responseRate: number, conversionRate: number, averageResponseTime: number): number {
    // Weighted scoring: conversion rate (50%), response rate (30%), response time (20%)
    const conversionScore = conversionRate * 0.5;
    const responseScore = responseRate * 0.3;
    
    // Response time score (faster is better, normalized to 0-1 scale)
    const maxResponseTime = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
    const responseTimeScore = averageResponseTime > 0 
      ? Math.max(0, (maxResponseTime - averageResponseTime) / maxResponseTime) * 0.2 
      : 0;
    
    return Math.min(1, conversionScore + responseScore + responseTimeScore);
  }

  /**
   * Calculates average conversion time
   */
  private calculateAverageConversionTime(conversions: ConversionEvent[]): number {
    if (conversions.length === 0) return 0;
    
    const conversionTimes = conversions
      .filter(c => c.conversionTime)
      .map(c => c.conversionTime!);
    
    return conversionTimes.length > 0 
      ? conversionTimes.reduce((sum, time) => sum + time, 0) / conversionTimes.length 
      : 0;
  }

  /**
   * Analyzes conversions by time of day
   */
  private analyzeConversionsByTimeOfDay(responses: Map<string, InterventionResponse[]>): Record<number, number> {
    const hourlyConversions: Record<number, number> = {};
    
    for (let hour = 0; hour < 24; hour++) {
      hourlyConversions[hour] = 0;
    }
    
    for (const responseList of responses.values()) {
      for (const response of responseList) {
        if (response.responseType === 'converted') {
          const hour = response.timestamp.getHours();
          hourlyConversions[hour]++;
        }
      }
    }
    
    return hourlyConversions;
  }

  /**
   * Analyzes performance by user segment
   */
  private analyzeUserSegmentPerformance(responses: Map<string, InterventionResponse[]>): Record<string, SegmentPerformance> {
    const segmentPerformance: Record<string, SegmentPerformance> = {};
    
    for (const responseList of responses.values()) {
      for (const response of responseList) {
        const segment = response.userSegment || 'unknown';
        
        if (!segmentPerformance[segment]) {
          segmentPerformance[segment] = {
            totalDeliveries: 0,
            totalResponses: 0,
            totalConversions: 0,
            responseRate: 0,
            conversionRate: 0
          };
        }
        
        const segmentData = segmentPerformance[segment];
        segmentData.totalDeliveries++;
        
        if (response.responseType !== 'no_response') {
          segmentData.totalResponses++;
        }
        
        if (response.responseType === 'converted') {
          segmentData.totalConversions++;
        }
      }
    }
    
    // Calculate rates
    for (const segment in segmentPerformance) {
      const data = segmentPerformance[segment];
      data.responseRate = data.totalDeliveries > 0 ? data.totalResponses / data.totalDeliveries : 0;
      data.conversionRate = data.totalDeliveries > 0 ? data.totalConversions / data.totalDeliveries : 0;
    }
    
    return segmentPerformance;
  }
}

// Supporting interfaces

export interface InterventionResponse {
  interventionId: string;
  userId: string;
  channel: 'push' | 'in_app' | 'sms' | 'email';
  responseType: 'opened' | 'clicked' | 'converted' | 'dismissed' | 'no_response';
  timestamp: Date;
  responseTime?: number; // milliseconds from delivery to response
  userSegment?: string;
  metadata?: Record<string, unknown>;
}

export interface ConversionEvent {
  userId: string;
  fromChannel: 'phone' | 'paper' | 'in_person';
  toChannel: 'app' | 'web';
  taskType: string; // e.g., 'claim_submission', 'appointment_booking'
  timestamp: Date;
  conversionTime?: number; // milliseconds from intervention to conversion
  interventionId?: string; // if conversion was triggered by an intervention
}

export interface InterventionEffectivenessMetrics {
  interventionId: string;
  totalDeliveries: number;
  totalResponses: number;
  responseRate: number;
  conversionRate: number;
  averageResponseTime: number;
  channelBreakdown: Record<string, ChannelMetrics>;
  effectivenessScore: number; // 0-1 score
}

export interface ChannelMetrics {
  deliveries: number;
  responses: number;
  conversions: number;
  responseRate: number;
  conversionRate: number;
}

export interface ChannelConversionMetrics {
  totalConversions: number;
  phoneToDigitalConversions: number;
  paperToDigitalConversions: number;
  recentConversions: number;
  conversionRate: number;
  estimatedCostSavings: number;
  averageConversionTime: number;
}

export interface ChannelPerformanceMetrics {
  totalDeliveries: number;
  totalResponses: number;
  totalConversions: number;
  averageResponseTime: number;
  lastUpdated: Date;
}

export interface PerformanceMetrics {
  overallResponseRate: number;
  overallConversionRate: number;
  totalDeliveries: number;
  totalResponses: number;
  totalConversions: number;
  channelMetrics: Record<string, ChannelPerformanceMetrics>;
  conversionMetrics: ChannelConversionMetrics;
}

export interface AttributionReport {
  timeRange: { start: Date; end: Date };
  topPerformingInterventions: Array<{ interventionId: string } & InterventionEffectivenessMetrics>;
  channelAttribution: Record<string, number>; // percentage attribution by channel
  totalAttributedConversions: number;
  conversionsByTimeOfDay: Record<number, number>; // hour -> conversion count
  userSegmentPerformance: Record<string, SegmentPerformance>;
}

export interface SegmentPerformance {
  totalDeliveries: number;
  totalResponses: number;
  totalConversions: number;
  responseRate: number;
  conversionRate: number;
}