// Core type definitions for the App Engagement Intelligence system

/**
 * User event interface for tracking user interactions
 * Requirements: 1.1 - Track user navigation paths, session duration, feature usage, and drop-off points
 */
export interface UserEvent {
  eventId: string;
  userId: string; // pseudonymized
  sessionId: string;
  timestamp: Date;
  eventType: 'page_view' | 'feature_usage' | 'task_completion' | 'abandonment';
  metadata: {
    screenName?: string;
    featureId?: string;
    duration?: number;
    success?: boolean;
  };
  userContext: {
    ageGroup: string;
    digitalLiteracyScore?: number;
    preferredChannel?: string;
  };
}

/**
 * Consent record interface for GDPR/GDNG compliance
 * Requirements: 5.1 - Obtain explicit consent and provide clear opt-out mechanisms
 */
export interface ConsentRecord {
  userId: string;
  consentType: 'analytics' | 'personalization' | 'marketing';
  granted: boolean;
  timestamp: Date;
  version: string;
}

/**
 * User profile interface for storing user demographics and engagement metrics
 * Requirements: 1.1, 5.1 - Track user behavior while maintaining privacy compliance
 */
export interface UserProfile {
  userId: string; // pseudonymized identifier
  demographics: {
    ageGroup: '22-30' | '31-40' | '41-55' | '56-65' | '66+';
    registrationDate: Date;
    lastActiveDate: Date;
  };
  engagementMetrics: {
    totalSessions: number;
    averageSessionDuration: number;
    featuresUsed: string[];
    digitalTasksCompleted: number;
    traditionalChannelUsage: {
      phoneCallsLastMonth: number;
      paperFormsLastMonth: number;
    };
  };
  preferences: {
    communicationChannels: string[];
    notificationFrequency: 'high' | 'medium' | 'low';
    contentComplexity: 'simple' | 'detailed';
  };
  consentStatus: ConsentRecord[];
}

/**
 * Intervention strategy interface for personalized engagement
 * Requirements: 1.1 - Provide personalized feature recommendations and contextual nudges
 */
export interface InterventionStrategy {
  strategyId: string;
  type: 'nudge' | 'incentive' | 'education' | 'gamification';
  trigger: {
    eventType: string;
    conditions: Record<string, unknown>;
  };
  content: {
    title: string;
    message: string;
    actionButton?: string;
    mediaUrl?: string;
  };
  channels: ('push' | 'in_app' | 'sms' | 'email')[];
  timing: {
    delay?: number;
    frequency?: string;
    expiresAfter?: number;
  };
}

// Additional supporting interfaces

export interface UserSegment {
  segmentId: string;
  name: string;
  criteria: {
    ageRange?: [number, number];
    engagementLevel: 'low' | 'medium' | 'high';
    preferredChannels: string[];
    digitalLiteracy: 'beginner' | 'intermediate' | 'advanced';
  };
  interventionStrategies: InterventionStrategy[];
}

export interface PersonalizedContent {
  title: string;
  message: string;
  callToAction?: string;
  visualElements?: {
    iconUrl?: string;
    imageUrl?: string;
    color?: string;
  };
  accessibility: {
    fontSize?: 'normal' | 'large' | 'extra_large';
    highContrast?: boolean;
    screenReaderText?: string;
  };
}

export interface DeliveryRequest {
  userId: string;
  interventionId: string;
  channel: 'push' | 'in_app' | 'sms' | 'email';
  content: PersonalizedContent;
  scheduledFor: Date;
  expiresAt: Date;
}
