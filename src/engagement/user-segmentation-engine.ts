import { UserProfile, UserSegment, InterventionStrategy } from '../types';

/**
 * Configuration for user segmentation engine
 */
export interface UserSegmentationConfig {
  segmentationRules: any[];
  refreshInterval: number;
  minSegmentSize: number;
}

/**
 * User segmentation engine for creating dynamic user segments based on demographics and behavior
 * Requirements: 1.2, 6.1, 6.4 - Segment users by age groups and tailor interventions accordingly
 */
export class UserSegmentationEngine {
  private config: UserSegmentationConfig;
  private segments: Map<string, UserSegment> = new Map();

  constructor(config: UserSegmentationConfig) {
    this.config = config;
    this.initializeDefaultSegments();
  }

  /**
   * Initialize default user segments based on age groups and engagement levels
   * Requirements: 6.1 - Segment users by age groups (22-30, 31-40, 41-55, 56-65, 66+)
   */
  private initializeDefaultSegments(): void {
    const defaultSegments: UserSegment[] = [
      // Young Digital Natives (22-30)
      {
        segmentId: 'young-high-engagement',
        name: 'Young High Engagement',
        criteria: {
          ageRange: [22, 30],
          engagementLevel: 'high',
          preferredChannels: ['push', 'in_app'],
          digitalLiteracy: 'advanced'
        },
        interventionStrategies: this.getGamificationStrategies()
      },
      {
        segmentId: 'young-low-engagement',
        name: 'Young Low Engagement',
        criteria: {
          ageRange: [22, 30],
          engagementLevel: 'low',
          preferredChannels: ['push', 'sms'],
          digitalLiteracy: 'intermediate'
        },
        interventionStrategies: this.getIncentiveStrategies()
      },
      // Middle-aged Professional (31-55)
      {
        segmentId: 'professional-medium-engagement',
        name: 'Professional Medium Engagement',
        criteria: {
          ageRange: [31, 55],
          engagementLevel: 'medium',
          preferredChannels: ['email', 'in_app'],
          digitalLiteracy: 'intermediate'
        },
        interventionStrategies: this.getNudgeStrategies()
      },
      {
        segmentId: 'professional-low-engagement',
        name: 'Professional Low Engagement',
        criteria: {
          ageRange: [31, 55],
          engagementLevel: 'low',
          preferredChannels: ['email', 'sms'],
          digitalLiteracy: 'beginner'
        },
        interventionStrategies: this.getEducationalStrategies()
      },
      // Middle-aged Users (56-65)
      {
        segmentId: 'middle-senior-low-engagement',
        name: 'Middle Senior Low Engagement',
        criteria: {
          ageRange: [56, 65],
          engagementLevel: 'low',
          preferredChannels: ['email', 'sms'],
          digitalLiteracy: 'beginner'
        },
        interventionStrategies: this.getSimplifiedEducationalStrategies()
      },
      {
        segmentId: 'middle-senior-medium-engagement',
        name: 'Middle Senior Medium Engagement',
        criteria: {
          ageRange: [56, 65],
          engagementLevel: 'medium',
          preferredChannels: ['email', 'in_app'],
          digitalLiteracy: 'intermediate'
        },
        interventionStrategies: this.getSupportiveNudgeStrategies()
      },
      // Older Users (66+)
      {
        segmentId: 'senior-low-engagement',
        name: 'Senior Low Engagement',
        criteria: {
          ageRange: [66, 100],
          engagementLevel: 'low',
          preferredChannels: ['email', 'sms'],
          digitalLiteracy: 'beginner'
        },
        interventionStrategies: this.getSimplifiedEducationalStrategies()
      },
      {
        segmentId: 'senior-medium-engagement',
        name: 'Senior Medium Engagement',
        criteria: {
          ageRange: [66, 100],
          engagementLevel: 'medium',
          preferredChannels: ['email', 'in_app'],
          digitalLiteracy: 'intermediate'
        },
        interventionStrategies: this.getSupportiveNudgeStrategies()
      }
    ];

    defaultSegments.forEach(segment => {
      this.segments.set(segment.segmentId, segment);
    });
  }

  /**
   * Segment a user based on their profile and engagement patterns
   * Requirements: 1.2 - Identify common abandonment patterns and bottlenecks in user flows
   */
  public segmentUser(userProfile: UserProfile): UserSegment | null {
    const age = this.calculateAge(userProfile.demographics.ageGroup);
    const engagementLevel = this.calculateEngagementLevel(userProfile);
    const digitalLiteracy = this.assessDigitalLiteracy(userProfile);

    // Find matching segment
    for (const segment of this.segments.values()) {
      if (this.matchesSegmentCriteria(userProfile, segment, age, engagementLevel, digitalLiteracy)) {
        return segment;
      }
    }

    // Return default segment if no match found
    return this.getDefaultSegment(age, engagementLevel, digitalLiteracy);
  }

  /**
   * Get all users in a specific segment
   * Requirements: 6.4 - Provide progressive disclosure and educational content to build confidence
   */
  public getUsersInSegment(segmentId: string, users: UserProfile[]): UserProfile[] {
    const segment = this.segments.get(segmentId);
    if (!segment) {
      return [];
    }

    return users.filter(user => {
      const userSegment = this.segmentUser(user);
      return userSegment?.segmentId === segmentId;
    });
  }

  /**
   * Create a custom segment with specific criteria
   * Requirements: 1.2 - Provide actionable insights about feature adoption rates and user engagement metrics
   */
  public createCustomSegment(segment: UserSegment): void {
    this.segments.set(segment.segmentId, segment);
  }

  /**
   * Get all available segments
   */
  public getAllSegments(): UserSegment[] {
    return Array.from(this.segments.values());
  }

  /**
   * Update intervention strategies for a segment
   * Requirements: 6.1 - Tailor interventions according to age groups
   */
  public updateSegmentStrategies(segmentId: string, strategies: InterventionStrategy[]): boolean {
    const segment = this.segments.get(segmentId);
    if (!segment) {
      return false;
    }

    segment.interventionStrategies = strategies;
    this.segments.set(segmentId, segment);
    return true;
  }

  private calculateAge(ageGroup: string): number {
    const ageRanges: Record<string, number> = {
      '22-30': 26,
      '31-40': 35,
      '41-55': 48,
      '56-65': 60,
      '66+': 70
    };
    return ageRanges[ageGroup] || 35;
  }

  private calculateEngagementLevel(userProfile: UserProfile): 'low' | 'medium' | 'high' {
    const metrics = userProfile.engagementMetrics;
    
    // Calculate engagement score based on multiple factors
    let score = 0;
    
    // Session frequency (30% weight)
    if (metrics.totalSessions > 20) score += 30;
    else if (metrics.totalSessions > 10) score += 20;
    else if (metrics.totalSessions > 5) score += 10;
    
    // Session duration (20% weight)
    if (metrics.averageSessionDuration > 300) score += 20; // 5+ minutes
    else if (metrics.averageSessionDuration > 120) score += 15; // 2+ minutes
    else if (metrics.averageSessionDuration > 60) score += 10; // 1+ minute
    
    // Feature usage diversity (25% weight)
    if (metrics.featuresUsed.length > 5) score += 25;
    else if (metrics.featuresUsed.length > 3) score += 20;
    else if (metrics.featuresUsed.length > 1) score += 15;
    
    // Digital task completion (25% weight)
    if (metrics.digitalTasksCompleted > 10) score += 25;
    else if (metrics.digitalTasksCompleted > 5) score += 20;
    else if (metrics.digitalTasksCompleted > 2) score += 15;
    
    // Traditional channel usage (negative impact)
    const traditionalUsage = metrics.traditionalChannelUsage.phoneCallsLastMonth + 
                           metrics.traditionalChannelUsage.paperFormsLastMonth;
    if (traditionalUsage > 5) score -= 15;
    else if (traditionalUsage > 2) score -= 10;
    
    if (score >= 70) return 'high';
    if (score >= 40) return 'medium';
    return 'low';
  }

  private assessDigitalLiteracy(userProfile: UserProfile): 'beginner' | 'intermediate' | 'advanced' {
    const metrics = userProfile.engagementMetrics;
    const age = this.calculateAge(userProfile.demographics.ageGroup);
    
    // Age-adjusted digital literacy assessment
    let literacyScore = 0;
    
    // Base score by age group
    if (age < 35) literacyScore += 40;
    else if (age < 50) literacyScore += 30;
    else if (age < 65) literacyScore += 20;
    else literacyScore += 10;
    
    // Feature usage complexity
    if (metrics.featuresUsed.length > 5) literacyScore += 30;
    else if (metrics.featuresUsed.length > 2) literacyScore += 20;
    else if (metrics.featuresUsed.length > 0) literacyScore += 10;
    
    // Task completion success rate
    if (metrics.digitalTasksCompleted > 8) literacyScore += 30;
    else if (metrics.digitalTasksCompleted > 4) literacyScore += 20;
    else if (metrics.digitalTasksCompleted >= 1) literacyScore += 10;
    
    if (literacyScore >= 80) return 'advanced';
    if (literacyScore >= 50) return 'intermediate';
    return 'beginner';
  }

  private matchesSegmentCriteria(
    userProfile: UserProfile,
    segment: UserSegment,
    age: number,
    engagementLevel: 'low' | 'medium' | 'high',
    digitalLiteracy: 'beginner' | 'intermediate' | 'advanced'
  ): boolean {
    const criteria = segment.criteria;
    
    // Check age range
    if (criteria.ageRange) {
      const [minAge, maxAge] = criteria.ageRange;
      if (age < minAge || age > maxAge) return false;
    }
    
    // Check engagement level
    if (criteria.engagementLevel !== engagementLevel) return false;
    
    // Check digital literacy
    if (criteria.digitalLiteracy !== digitalLiteracy) return false;
    
    return true;
  }

  private getDefaultSegment(
    age: number,
    engagementLevel: 'low' | 'medium' | 'high',
    digitalLiteracy: 'beginner' | 'intermediate' | 'advanced'
  ): UserSegment {
    // Map age to proper age ranges
    let ageRange: [number, number];
    if (age <= 30) {
      ageRange = [22, 30];
    } else if (age <= 40) {
      ageRange = [31, 40];
    } else if (age <= 55) {
      ageRange = [41, 55];
    } else if (age <= 65) {
      ageRange = [56, 65];
    } else {
      ageRange = [66, 100];
    }

    return {
      segmentId: 'default-segment',
      name: 'Default Segment',
      criteria: {
        ageRange,
        engagementLevel,
        preferredChannels: ['email', 'in_app'],
        digitalLiteracy
      },
      interventionStrategies: this.getNudgeStrategies()
    };
  }

  // Strategy generators for different segment types
  private getGamificationStrategies(): InterventionStrategy[] {
    return [
      {
        strategyId: 'gamification-achievement',
        type: 'gamification',
        trigger: {
          eventType: 'task_completion',
          conditions: { success: true }
        },
        content: {
          title: 'Achievement Unlocked! 🏆',
          message: 'You\'ve completed another digital task. Keep it up!',
          actionButton: 'View Progress'
        },
        channels: ['push', 'in_app'],
        timing: {
          delay: 0,
          frequency: 'immediate'
        }
      }
    ];
  }

  private getIncentiveStrategies(): InterventionStrategy[] {
    return [
      {
        strategyId: 'incentive-reward',
        type: 'incentive',
        trigger: {
          eventType: 'abandonment',
          conditions: { screenName: 'claim_form' }
        },
        content: {
          title: 'Complete Your Claim Online',
          message: 'Finish your claim in the app and get faster processing!',
          actionButton: 'Continue Claim'
        },
        channels: ['push', 'sms'],
        timing: {
          delay: 3600, // 1 hour
          frequency: 'once'
        }
      }
    ];
  }

  private getNudgeStrategies(): InterventionStrategy[] {
    return [
      {
        strategyId: 'nudge-reminder',
        type: 'nudge',
        trigger: {
          eventType: 'page_view',
          conditions: { screenName: 'dashboard' }
        },
        content: {
          title: 'Quick Tip',
          message: 'Did you know you can check your benefits status instantly?',
          actionButton: 'Check Now'
        },
        channels: ['in_app'],
        timing: {
          delay: 30,
          frequency: 'weekly'
        }
      }
    ];
  }

  private getEducationalStrategies(): InterventionStrategy[] {
    return [
      {
        strategyId: 'education-tutorial',
        type: 'education',
        trigger: {
          eventType: 'feature_usage',
          conditions: { success: false }
        },
        content: {
          title: 'Need Help?',
          message: 'Let us guide you through this step-by-step.',
          actionButton: 'Start Tutorial',
          mediaUrl: '/tutorials/basic-navigation'
        },
        channels: ['in_app', 'email'],
        timing: {
          delay: 60,
          frequency: 'as_needed'
        }
      }
    ];
  }

  private getSimplifiedEducationalStrategies(): InterventionStrategy[] {
    return [
      {
        strategyId: 'simple-education',
        type: 'education',
        trigger: {
          eventType: 'page_view',
          conditions: { screenName: 'main_menu' }
        },
        content: {
          title: 'Welcome Back',
          message: 'Here are the most important features for you today.',
          actionButton: 'Show Me',
          mediaUrl: '/tutorials/senior-friendly'
        },
        channels: ['in_app', 'email'],
        timing: {
          delay: 0,
          frequency: 'daily'
        }
      }
    ];
  }

  private getSupportiveNudgeStrategies(): InterventionStrategy[] {
    return [
      {
        strategyId: 'supportive-nudge',
        type: 'nudge',
        trigger: {
          eventType: 'task_completion',
          conditions: { success: true }
        },
        content: {
          title: 'Well Done!',
          message: 'You\'re getting more comfortable with digital services.',
          actionButton: 'Explore More'
        },
        channels: ['in_app', 'email'],
        timing: {
          delay: 0,
          frequency: 'after_success'
        }
      }
    ];
  }
}