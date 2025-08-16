/**
 * Environment configuration management for different deployment environments
 * Requirements: 4.1, 5.1 - Configuration management and compliance settings
 */

export interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  ssl: boolean;
  connectionTimeout: number;
  maxConnections: number;
}

export interface RedisConfig {
  host: string;
  port: number;
  password?: string;
  database: number;
  keyPrefix: string;
  ttl: number;
}

export interface ComplianceConfig {
  gdprEnabled: boolean;
  gdngEnabled: boolean;
  dataRetentionDays: number;
  auditLogRetentionDays: number;
  consentVersion: string;
  privacyPolicyUrl: string;
  dataProcessingAgreementUrl: string;
}

export interface SecurityConfig {
  jwtSecret: string;
  jwtExpirationTime: string;
  encryptionKey: string;
  hashSalt: string;
  corsOrigins: string[];
  rateLimitWindowMs: number;
  rateLimitMaxRequests: number;
}

export interface MonitoringConfig {
  enableMetrics: boolean;
  enableTracing: boolean;
  enableLogging: boolean;
  logLevel: 'error' | 'warn' | 'info' | 'debug';
  metricsPort: number;
  healthCheckPath: string;
  alertingWebhookUrl?: string;
}

export interface ExternalServicesConfig {
  pushNotificationService: {
    apiKey: string;
    endpoint: string;
    retryAttempts: number;
  };
  emailService: {
    apiKey: string;
    endpoint: string;
    fromEmail: string;
    retryAttempts: number;
  };
  smsService: {
    apiKey: string;
    endpoint: string;
    fromNumber: string;
    retryAttempts: number;
  };
  analyticsService?: {
    endpoint: string;
    apiKey: string;
    batchSize: number;
  };
}

export interface AppConfig {
  environment: 'development' | 'staging' | 'production';
  port: number;
  host: string;
  apiVersion: string;
  database: DatabaseConfig;
  redis: RedisConfig;
  compliance: ComplianceConfig;
  security: SecurityConfig;
  monitoring: MonitoringConfig;
  externalServices: ExternalServicesConfig;
}

/**
 * Load configuration based on environment
 */
export function loadConfig(): AppConfig {
  const env = process.env.NODE_ENV || 'development';
  
  const baseConfig: AppConfig = {
    environment: env as 'development' | 'staging' | 'production',
    port: parseInt(process.env.PORT || '3000', 10),
    host: process.env.HOST || '0.0.0.0',
    apiVersion: 'v1',
    
    database: {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432', 10),
      database: process.env.DB_NAME || 'app_engagement_intelligence',
      username: process.env.DB_USERNAME || 'postgres',
      password: process.env.DB_PASSWORD || 'password',
      ssl: process.env.DB_SSL === 'true',
      connectionTimeout: parseInt(process.env.DB_CONNECTION_TIMEOUT || '30000', 10),
      maxConnections: parseInt(process.env.DB_MAX_CONNECTIONS || '10', 10)
    },
    
    redis: {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
      password: process.env.REDIS_PASSWORD,
      database: parseInt(process.env.REDIS_DATABASE || '0', 10),
      keyPrefix: process.env.REDIS_KEY_PREFIX || 'aei:',
      ttl: parseInt(process.env.REDIS_TTL || '3600', 10)
    },
    
    compliance: {
      gdprEnabled: process.env.GDPR_ENABLED !== 'false',
      gdngEnabled: process.env.GDNG_ENABLED !== 'false',
      dataRetentionDays: parseInt(process.env.DATA_RETENTION_DAYS || '365', 10),
      auditLogRetentionDays: parseInt(process.env.AUDIT_LOG_RETENTION_DAYS || '2555', 10), // 7 years
      consentVersion: process.env.CONSENT_VERSION || '1.0',
      privacyPolicyUrl: process.env.PRIVACY_POLICY_URL || 'https://ikk-classic.de/privacy',
      dataProcessingAgreementUrl: process.env.DPA_URL || 'https://ikk-classic.de/dpa'
    },
    
    security: {
      jwtSecret: process.env.JWT_SECRET || 'your-secret-key-change-in-production',
      jwtExpirationTime: process.env.JWT_EXPIRATION || '24h',
      encryptionKey: process.env.ENCRYPTION_KEY || 'your-encryption-key-32-chars-long',
      hashSalt: process.env.HASH_SALT || 'your-hash-salt',
      corsOrigins: (process.env.CORS_ORIGINS || 'http://localhost:3000').split(','),
      rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10), // 15 minutes
      rateLimitMaxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10)
    },
    
    monitoring: {
      enableMetrics: process.env.ENABLE_METRICS !== 'false',
      enableTracing: process.env.ENABLE_TRACING === 'true',
      enableLogging: process.env.ENABLE_LOGGING !== 'false',
      logLevel: (process.env.LOG_LEVEL as any) || 'info',
      metricsPort: parseInt(process.env.METRICS_PORT || '9090', 10),
      healthCheckPath: process.env.HEALTH_CHECK_PATH || '/health',
      alertingWebhookUrl: process.env.ALERTING_WEBHOOK_URL
    },
    
    externalServices: {
      pushNotificationService: {
        apiKey: process.env.PUSH_NOTIFICATION_API_KEY || '',
        endpoint: process.env.PUSH_NOTIFICATION_ENDPOINT || 'https://fcm.googleapis.com/fcm/send',
        retryAttempts: parseInt(process.env.PUSH_NOTIFICATION_RETRY_ATTEMPTS || '3', 10)
      },
      emailService: {
        apiKey: process.env.EMAIL_SERVICE_API_KEY || '',
        endpoint: process.env.EMAIL_SERVICE_ENDPOINT || 'https://api.sendgrid.com/v3/mail/send',
        fromEmail: process.env.EMAIL_FROM || 'noreply@ikk-classic.de',
        retryAttempts: parseInt(process.env.EMAIL_RETRY_ATTEMPTS || '3', 10)
      },
      smsService: {
        apiKey: process.env.SMS_SERVICE_API_KEY || '',
        endpoint: process.env.SMS_SERVICE_ENDPOINT || 'https://api.twilio.com/2010-04-01/Accounts/test/Messages.json',
        fromNumber: process.env.SMS_FROM_NUMBER || '+1234567890',
        retryAttempts: parseInt(process.env.SMS_RETRY_ATTEMPTS || '3', 10)
      },
      analyticsService: process.env.ANALYTICS_SERVICE_ENDPOINT ? {
        endpoint: process.env.ANALYTICS_SERVICE_ENDPOINT,
        apiKey: process.env.ANALYTICS_SERVICE_API_KEY || '',
        batchSize: parseInt(process.env.ANALYTICS_BATCH_SIZE || '100', 10)
      } : undefined
    }
  };

  // Environment-specific overrides
  switch (env) {
    case 'development':
      return {
        ...baseConfig,
        monitoring: {
          ...baseConfig.monitoring,
          logLevel: 'debug',
          enableTracing: true
        },
        security: {
          ...baseConfig.security,
          corsOrigins: ['http://localhost:3000', 'http://localhost:3001']
        }
      };
      
    case 'staging':
      return {
        ...baseConfig,
        monitoring: {
          ...baseConfig.monitoring,
          logLevel: 'info',
          enableTracing: true
        }
      };
      
    case 'production':
      // Validate required production environment variables
      const requiredEnvVars = [
        'JWT_SECRET',
        'ENCRYPTION_KEY',
        'HASH_SALT',
        'DB_PASSWORD',
        'PUSH_NOTIFICATION_API_KEY',
        'EMAIL_SERVICE_API_KEY',
        'SMS_SERVICE_API_KEY'
      ];
      
      const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
      if (missingVars.length > 0) {
        throw new Error(`Missing required environment variables for production: ${missingVars.join(', ')}`);
      }
      
      return {
        ...baseConfig,
        monitoring: {
          ...baseConfig.monitoring,
          logLevel: 'warn',
          enableTracing: false
        },
        database: {
          ...baseConfig.database,
          ssl: true
        }
      };
      
    default:
      return baseConfig;
  }
}

/**
 * Validate configuration
 */
export function validateConfig(config: AppConfig): void {
  // Validate port range
  if (config.port < 1 || config.port > 65535) {
    throw new Error(`Invalid port number: ${config.port}`);
  }
  
  // Validate database configuration
  if (!config.database.host || !config.database.database) {
    throw new Error('Database host and database name are required');
  }
  
  // Validate compliance configuration
  if (config.compliance.dataRetentionDays < 1) {
    throw new Error('Data retention days must be at least 1');
  }
  
  // Validate security configuration in production
  if (config.environment === 'production') {
    if (config.security.jwtSecret === 'your-secret-key-change-in-production') {
      throw new Error('JWT secret must be changed in production');
    }
    
    if (config.security.encryptionKey === 'your-encryption-key-32-chars-long') {
      throw new Error('Encryption key must be changed in production');
    }
    
    if (config.security.hashSalt === 'your-hash-salt') {
      throw new Error('Hash salt must be changed in production');
    }
  }
}

// Export singleton instance
export const config = loadConfig();
validateConfig(config);