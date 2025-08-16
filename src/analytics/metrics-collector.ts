import { UserEvent, UserProfile } from '../types';

/**
 * Performance metrics for tracking engagement improvements
 * Requirements: 4.1, 4.3, 4.4 - Track conversion rates, cost savings, and performance metrics
 */
export interface EngagementMetrics {
  totalUsers: number;
  activeUsers: number;
  digitalAdoptionRate: number; // Percentage of users using digital services
  averageSessionDuration: number;
  featureUsageRates: Record<string, number>;
  taskCompletionRates: Record<string, number>;
  userRetentionRate: number;
  timeToFirstValue: number; // Time until user completes first meaningful action
}

/**
 * Cost savings metrics for measuring operational efficiency
 * Requirements: 4.1, 4.3 - Quantify reductions in call volume and operational costs
 */
export interface CostSavingsMetrics {
  callVolumeReduction: {
    previousPeriod: number;
    currentPeriod: number;
    reductionPercentage: number;
    estimatedCostSavings: number;
  };
  digitalChannelAdoption: {
    digitalTransactions: number;
    traditionalTransactions: number;
    digitalAdoptionRate: number;
    costPerDigitalTransaction: number;
    costPerTraditionalTransaction: number;
    totalCostSavings: number;
  };
  processingTimeReduction: {
    averageDigitalProcessingTime: number;
    averageTraditionalProcessingTime: number;
    timeSavingsPerTransaction: number;
    totalTimeSavings: number;
  };
  staffProductivityGains: {
    routineTasksAutomated: number;
    timeFreedForComplexTasks: number;
    productivityImprovementPercentage: number;
  };
}

/**
 * Intervention effectiveness metrics
 * Requirements: 4.2, 4.4 - Measure intervention effectiveness and A/B test results
 */
export interface InterventionMetrics {
  interventionId: string;
  type: 'nudge' | 'incentive' | 'education' | 'gamification';
  channel: 'push' | 'in_app' | 'sms' | 'email';
  performance: {
    sent: number;
    delivered: number;
    opened: number;
    clicked: number;
    converted: number;
    deliveryRate: number;
    openRate: number;
    clickThroughRate: number;
    conversionRate: number;
  };
  segmentPerformance: Record<string, {
    sent: number;
    converted: number;
    conversionRate: number;
  }>;
  costEffectiveness: {
    costPerIntervention: number;
    costPerConversion: number;
    returnOnInvestment: number;
  };
}

/**
 * Dashboard aggregation data for reporting
 * Requirements: 4.1, 4.3 - Dashboard data aggregation for reporting
 */
export interface DashboardMetrics {
  overview: {
    totalUsers: number;
    activeUsersToday: number;
    digitalAdoptionRate: number;
    costSavingsThisMonth: number;
    topPerformingIntervention: string;
  };
  trends: {
    userEngagementTrend: Array<{ date: string; value: number }>;
    digitalAdoptionTrend: Array<{ date: string; value: number }>;
    costSavingsTrend: Array<{ date: string; value: number }>;
    callVolumeReductionTrend: Array<{ date: string; value: number }>;
  };
  segmentBreakdown: Record<string, {
    userCount: number;
    engagementRate: number;
    digitalAdoptionRate: number;
    averageCostSavings: number;
  }>;
  interventionPerformance: InterventionMetrics[];
}

/**
 * Time period for metrics calculation
 */
export type MetricsPeriod = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';

/**
 * Metrics calculation configuration
 */
export interface MetricsConfig {
  costPerPhoneCall: number;
  costPerPaperForm: number;
  costPerDigitalTransaction: number;
  averageStaffHourlyRate: number;
  timePerPhoneCall: number; // in minutes
  timePerPaperForm: number; // in minutes
  timePerDigitalTransaction: number; // in minutes
}

/**
 * MetricsCollector class for tracking engagement improvements and cost savings
 * Requirements: 4.1, 4.3, 4.4 - Track engagement improvements, cost savings, and performance metrics
 */
export class MetricsCollector {
  private events: UserEvent[] = [];
  private userProfiles: Map<string, UserProfile> = new Map();
  private interventionMetrics: Map<string, InterventionMetrics> = new Map();
  private config: MetricsConfig;

  constructor(config: MetricsConfig) {
    this.config = config;
  }

  /**
   * Add user event for metrics calculation
   * Requirements: 4.1 - Track conversion rates and user engagement
   */
  addEvent(event: UserEvent): void {
    this.events.push(event);
  }

  /**
   * Record user event for metrics calculation (alias for addEvent)
   * Requirements: 4.1 - Track conversion rates and user engagement
   */
  recordEvent(event: UserEvent): void {
    this.addEvent(event);
  }

  /**
   * Update user profile data
   * Requirements: 4.1 - Track user behavior and engagement patterns
   */
  updateUserProfile(profile: UserProfile): void {
    this.userProfiles.set(profile.userId, profile);
  }

  /**
   * Record intervention performance data
   * Requirements: 4.2, 4.4 - Track intervention effectiveness
   */
  recordInterventionMetrics(metrics: InterventionMetrics): void {
    this.interventionMetrics.set(metrics.interventionId, metrics);
  }

  /**
   * Calculate engagement metrics for a given period
   * Requirements: 4.1 - Track engagement improvements and user behavior
   */
  calculateEngagementMetrics(period: MetricsPeriod, startDate?: Date, endDate?: Date): EngagementMetrics {
    const { start, end } = this.getPeriodDates(period, startDate, endDate);
    const periodEvents = this.getEventsInPeriod(start, end);
    const activeUserIds = new Set(periodEvents.map(e => e.userId));

    // Calculate feature usage rates
    const featureUsageRates: Record<string, number> = {};
    const featureEvents = periodEvents.filter(e => e.eventType === 'feature_usage');
    const featureUsageCounts = featureEvents.reduce((acc, event) => {
      const featureId = event.metadata.featureId || 'unknown';
      acc[featureId] = (acc[featureId] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    Object.keys(featureUsageCounts).forEach(featureId => {
      featureUsageRates[featureId] = featureUsageCounts[featureId] / activeUserIds.size;
    });

    // Calculate task completion rates
    const taskCompletionRates: Record<string, number> = {};
    const taskEvents = periodEvents.filter(e => e.eventType === 'task_completion');
    const taskAttempts = periodEvents.filter(e => e.eventType === 'feature_usage' || e.eventType === 'task_completion');
    
    const taskCompletions = taskEvents.reduce((acc, event) => {
      const featureId = event.metadata.featureId || 'unknown';
      acc[featureId] = (acc[featureId] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const taskAttemptCounts = taskAttempts.reduce((acc, event) => {
      const featureId = event.metadata.featureId || 'unknown';
      acc[featureId] = (acc[featureId] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    Object.keys(taskCompletions).forEach(featureId => {
      const completions = taskCompletions[featureId] || 0;
      const attempts = taskAttemptCounts[featureId] || 0;
      taskCompletionRates[featureId] = attempts > 0 ? completions / attempts : 0;
    });

    // Calculate digital adoption rate
    const digitalUsers = Array.from(this.userProfiles.values()).filter(profile => 
      profile.engagementMetrics.digitalTasksCompleted > 0
    ).length;
    const digitalAdoptionRate = this.userProfiles.size > 0 ? digitalUsers / this.userProfiles.size : 0;

    // Calculate average session duration
    const sessionDurations = periodEvents
      .filter(e => e.metadata.duration !== undefined)
      .map(e => e.metadata.duration!);
    const averageSessionDuration = sessionDurations.length > 0 
      ? sessionDurations.reduce((sum, duration) => sum + duration, 0) / sessionDurations.length 
      : 0;

    // Calculate user retention (users active in both current and previous period)
    const previousPeriod = this.getPreviousPeriod(start, end);
    const previousEvents = this.getEventsInPeriod(previousPeriod.start, previousPeriod.end);
    const previousActiveUsers = new Set(previousEvents.map(e => e.userId));
    const retainedUsers = Array.from(activeUserIds).filter(userId => previousActiveUsers.has(userId));
    const userRetentionRate = previousActiveUsers.size > 0 ? retainedUsers.length / previousActiveUsers.size : 0;

    // Calculate time to first value
    const firstValueTimes = Array.from(activeUserIds).map(userId => {
      const userEvents = periodEvents.filter(e => e.userId === userId);
      const firstTaskCompletion = userEvents.find(e => e.eventType === 'task_completion');
      const firstEvent = userEvents[0];
      
      if (firstTaskCompletion && firstEvent) {
        return firstTaskCompletion.timestamp.getTime() - firstEvent.timestamp.getTime();
      }
      return null;
    }).filter(time => time !== null) as number[];

    const timeToFirstValue = firstValueTimes.length > 0 
      ? firstValueTimes.reduce((sum, time) => sum + time, 0) / firstValueTimes.length / (1000 * 60) // Convert to minutes
      : 0;

    return {
      totalUsers: this.userProfiles.size,
      activeUsers: activeUserIds.size,
      digitalAdoptionRate,
      averageSessionDuration,
      featureUsageRates,
      taskCompletionRates,
      userRetentionRate,
      timeToFirstValue,
    };
  }

  /**
   * Calculate cost savings metrics
   * Requirements: 4.1, 4.3 - Quantify reductions in call volume and operational costs
   */
  calculateCostSavingsMetrics(period: MetricsPeriod, startDate?: Date, endDate?: Date): CostSavingsMetrics {
    const { start, end } = this.getPeriodDates(period, startDate, endDate);
    const previousPeriod = this.getPreviousPeriod(start, end);

    // Calculate call volume reduction
    const currentCallVolume = this.calculateCallVolume(start, end);
    const previousCallVolume = this.calculateCallVolume(previousPeriod.start, previousPeriod.end);
    const callVolumeReduction = {
      previousPeriod: previousCallVolume,
      currentPeriod: currentCallVolume,
      reductionPercentage: previousCallVolume > 0 ? ((previousCallVolume - currentCallVolume) / previousCallVolume) * 100 : 0,
      estimatedCostSavings: (previousCallVolume - currentCallVolume) * this.config.costPerPhoneCall,
    };

    // Calculate digital channel adoption
    const digitalTransactions = this.calculateDigitalTransactions(start, end);
    const traditionalTransactions = this.calculateTraditionalTransactions(start, end);
    const totalTransactions = digitalTransactions + traditionalTransactions;
    const digitalChannelAdoption = {
      digitalTransactions,
      traditionalTransactions,
      digitalAdoptionRate: totalTransactions > 0 ? digitalTransactions / totalTransactions : 0,
      costPerDigitalTransaction: this.config.costPerDigitalTransaction,
      costPerTraditionalTransaction: (this.config.costPerPhoneCall + this.config.costPerPaperForm) / 2,
      totalCostSavings: digitalTransactions * (((this.config.costPerPhoneCall + this.config.costPerPaperForm) / 2) - this.config.costPerDigitalTransaction),
    };

    // Calculate processing time reduction
    const processingTimeReduction = {
      averageDigitalProcessingTime: this.config.timePerDigitalTransaction,
      averageTraditionalProcessingTime: (this.config.timePerPhoneCall + this.config.timePerPaperForm) / 2,
      timeSavingsPerTransaction: ((this.config.timePerPhoneCall + this.config.timePerPaperForm) / 2) - this.config.timePerDigitalTransaction,
      totalTimeSavings: digitalTransactions * (((this.config.timePerPhoneCall + this.config.timePerPaperForm) / 2) - this.config.timePerDigitalTransaction),
    };

    // Calculate staff productivity gains
    const routineTasksAutomated = digitalTransactions;
    const timeFreedForComplexTasks = processingTimeReduction.totalTimeSavings;
    const staffProductivityGains = {
      routineTasksAutomated,
      timeFreedForComplexTasks,
      productivityImprovementPercentage: timeFreedForComplexTasks > 0 ? (timeFreedForComplexTasks / (timeFreedForComplexTasks + (traditionalTransactions * processingTimeReduction.averageTraditionalProcessingTime))) * 100 : 0,
    };

    return {
      callVolumeReduction,
      digitalChannelAdoption,
      processingTimeReduction,
      staffProductivityGains,
    };
  }

  /**
   * Generate dashboard metrics for reporting
   * Requirements: 4.1, 4.3 - Dashboard data aggregation for real-time and historical reporting
   */
  generateDashboardMetrics(period: MetricsPeriod = 'monthly'): DashboardMetrics {
    const engagementMetrics = this.calculateEngagementMetrics(period);
    const costSavingsMetrics = this.calculateCostSavingsMetrics(period);

    // Calculate overview metrics
    const overview = {
      totalUsers: engagementMetrics.totalUsers,
      activeUsersToday: this.calculateActiveUsersToday(),
      digitalAdoptionRate: engagementMetrics.digitalAdoptionRate,
      costSavingsThisMonth: costSavingsMetrics.digitalChannelAdoption.totalCostSavings,
      topPerformingIntervention: this.getTopPerformingIntervention(),
    };

    // Generate trend data
    const trends = this.generateTrendData(period);

    // Calculate segment breakdown
    const segmentBreakdown = this.calculateSegmentBreakdown();

    // Get intervention performance
    const interventionPerformance = Array.from(this.interventionMetrics.values());

    return {
      overview,
      trends,
      segmentBreakdown,
      interventionPerformance,
    };
  }

  /**
   * Export metrics data for external reporting
   * Requirements: 4.3 - Provide metrics for external reporting and analysis
   */
  exportMetricsData(period: MetricsPeriod, format: 'json' | 'csv' = 'json'): string {
    const engagementMetrics = this.calculateEngagementMetrics(period);
    const costSavingsMetrics = this.calculateCostSavingsMetrics(period);
    const dashboardMetrics = this.generateDashboardMetrics(period);

    const exportData = {
      period,
      generatedAt: new Date().toISOString(),
      engagement: engagementMetrics,
      costSavings: costSavingsMetrics,
      dashboard: dashboardMetrics,
    };

    if (format === 'json') {
      return JSON.stringify(exportData, null, 2);
    } else {
      // Convert to CSV format (simplified)
      return this.convertToCSV(exportData);
    }
  }

  // Private helper methods

  private getPeriodDates(period: MetricsPeriod, startDate?: Date, endDate?: Date): { start: Date; end: Date } {
    const now = new Date();
    const end = endDate || now;
    let start: Date;

    switch (period) {
      case 'daily':
        start = startDate || new Date(end.getTime() - 24 * 60 * 60 * 1000);
        break;
      case 'weekly':
        start = startDate || new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'monthly':
        start = startDate || new Date(end.getFullYear(), end.getMonth() - 1, end.getDate());
        break;
      case 'quarterly':
        start = startDate || new Date(end.getFullYear(), end.getMonth() - 3, end.getDate());
        break;
      case 'yearly':
        start = startDate || new Date(end.getFullYear() - 1, end.getMonth(), end.getDate());
        break;
      default:
        start = startDate || new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    return { start, end };
  }

  private getPreviousPeriod(start: Date, end: Date): { start: Date; end: Date } {
    const duration = end.getTime() - start.getTime();
    return {
      start: new Date(start.getTime() - duration),
      end: new Date(start.getTime()),
    };
  }

  private getEventsInPeriod(start: Date, end: Date): UserEvent[] {
    return this.events.filter(event => 
      event.timestamp >= start && event.timestamp <= end
    );
  }

  private calculateCallVolume(start: Date, end: Date): number {
    return Array.from(this.userProfiles.values()).reduce((total, profile) => {
      return total + profile.engagementMetrics.traditionalChannelUsage.phoneCallsLastMonth;
    }, 0);
  }

  private calculateDigitalTransactions(start: Date, end: Date): number {
    const periodEvents = this.getEventsInPeriod(start, end);
    return periodEvents.filter(event => event.eventType === 'task_completion').length;
  }

  private calculateTraditionalTransactions(start: Date, end: Date): number {
    return Array.from(this.userProfiles.values()).reduce((total, profile) => {
      return total + profile.engagementMetrics.traditionalChannelUsage.phoneCallsLastMonth + 
                     profile.engagementMetrics.traditionalChannelUsage.paperFormsLastMonth;
    }, 0);
  }

  private calculateActiveUsersToday(): number {
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);
    
    const todayEvents = this.getEventsInPeriod(startOfDay, endOfDay);
    return new Set(todayEvents.map(e => e.userId)).size;
  }

  private getTopPerformingIntervention(): string {
    let topIntervention = '';
    let highestConversionRate = 0;

    for (const metrics of this.interventionMetrics.values()) {
      if (metrics.performance.conversionRate > highestConversionRate) {
        highestConversionRate = metrics.performance.conversionRate;
        topIntervention = metrics.interventionId;
      }
    }

    return topIntervention;
  }

  private generateTrendData(period: MetricsPeriod): DashboardMetrics['trends'] {
    // Generate sample trend data (in a real implementation, this would calculate historical data)
    const days = period === 'daily' ? 7 : period === 'weekly' ? 4 : 12;
    const trends = {
      userEngagementTrend: [] as Array<{ date: string; value: number }>,
      digitalAdoptionTrend: [] as Array<{ date: string; value: number }>,
      costSavingsTrend: [] as Array<{ date: string; value: number }>,
      callVolumeReductionTrend: [] as Array<{ date: string; value: number }>,
    };

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];

      trends.userEngagementTrend.push({ date: dateStr, value: Math.random() * 100 });
      trends.digitalAdoptionTrend.push({ date: dateStr, value: Math.random() * 100 });
      trends.costSavingsTrend.push({ date: dateStr, value: Math.random() * 1000 });
      trends.callVolumeReductionTrend.push({ date: dateStr, value: Math.random() * 50 });
    }

    return trends;
  }

  private calculateSegmentBreakdown(): Record<string, any> {
    const segments: Record<string, any> = {};
    
    for (const profile of this.userProfiles.values()) {
      const segment = profile.demographics.ageGroup;
      
      if (!segments[segment]) {
        segments[segment] = {
          userCount: 0,
          totalEngagement: 0,
          digitalUsers: 0,
          totalCostSavings: 0,
        };
      }
      
      segments[segment].userCount++;
      segments[segment].totalEngagement += profile.engagementMetrics.totalSessions;
      if (profile.engagementMetrics.digitalTasksCompleted > 0) {
        segments[segment].digitalUsers++;
      }
      segments[segment].totalCostSavings += profile.engagementMetrics.digitalTasksCompleted * this.config.costPerDigitalTransaction;
    }

    // Calculate rates
    Object.keys(segments).forEach(segment => {
      const data = segments[segment];
      data.engagementRate = data.userCount > 0 ? data.totalEngagement / data.userCount : 0;
      data.digitalAdoptionRate = data.userCount > 0 ? data.digitalUsers / data.userCount : 0;
      data.averageCostSavings = data.userCount > 0 ? data.totalCostSavings / data.userCount : 0;
    });

    return segments;
  }

  private convertToCSV(data: any): string {
    // Simplified CSV conversion
    const headers = ['Metric', 'Value'];
    const rows = [
      ['Total Users', data.engagement.totalUsers],
      ['Active Users', data.engagement.activeUsers],
      ['Digital Adoption Rate', data.engagement.digitalAdoptionRate],
      ['Cost Savings', data.costSavings.digitalChannelAdoption.totalCostSavings],
    ];

    return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
  }
}