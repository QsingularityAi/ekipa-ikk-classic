// Analytics module interfaces
export interface AnalyticsEvent {
  eventId: string;
  userId: string;
  sessionId: string;
  timestamp: Date;
  eventType: string;
  properties: {
    screenName?: string;
    featureId?: string;
    actionType?: string;
    duration?: number;
    success?: boolean;
    errorCode?: string;
  };
  context: {
    appVersion: string;
    deviceType: string;
    osVersion: string;
    networkType: string;
  };
}

export interface EventCollectorConfig {
  apiEndpoint: string;
  batchSize: number;
  flushInterval: number;
  retryAttempts: number;
}

export interface StreamProcessorConfig {
  kafkaBootstrapServers: string[];
  topicName: string;
  consumerGroupId: string;
  batchSize: number;
}
