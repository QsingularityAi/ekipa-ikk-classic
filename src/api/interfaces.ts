// API module interfaces
export interface DashboardMetrics {
  totalUsers: number;
  activeUsers: number;
  engagementRate: number;
  digitalAdoptionRate: number;
  callVolumeReduction: number;
  costSavings: number;
  topFeatures: {
    featureId: string;
    usageCount: number;
    adoptionRate: number;
  }[];
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
  timestamp: Date;
}

export interface WebhookPayload {
  eventType: string;
  userId: string;
  timestamp: Date;
  data: Record<string, unknown>;
}

export interface DashboardApiConfig {
  port: number;
  corsOrigins: string[];
  rateLimitWindowMs: number;
  rateLimitMaxRequests: number;
}
