// Engagement module interfaces
export interface InterventionCampaign {
  campaignId: string;
  name: string;
  targetSegments: string[];
  strategy: import('../types').InterventionStrategy;
  schedule: {
    startDate: Date;
    endDate: Date;
    frequency: string;
  };
  performance: {
    sent: number;
    delivered: number;
    opened: number;
    clicked: number;
    converted: number;
    costSavings: number;
  };
  abTestConfig?: {
    variants: import('../types').InterventionStrategy[];
    trafficSplit: number[];
    successMetric: string;
  };
}

export interface RecommendationEngineConfig {
  modelEndpoint: string;
  confidenceThreshold: number;
  maxRecommendations: number;
}

export interface InterventionOrchestratorConfig {
  channels: {
    push: boolean;
    inApp: boolean;
    sms: boolean;
    email: boolean;
  };
  rateLimits: {
    perUser: number;
    perHour: number;
  };
}
