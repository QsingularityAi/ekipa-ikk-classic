/**
 * System monitoring and alerting for performance and health tracking
 * Requirements: 5.1, 5.2 - Monitor privacy violations, system failures, and performance degradation
 */

export enum AlertSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL'
}

export enum AlertType {
  PRIVACY_VIOLATION = 'PRIVACY_VIOLATION',
  SYSTEM_FAILURE = 'SYSTEM_FAILURE',
  PERFORMANCE_DEGRADATION = 'PERFORMANCE_DEGRADATION',
  CIRCUIT_BREAKER_OPEN = 'CIRCUIT_BREAKER_OPEN',
  HIGH_ERROR_RATE = 'HIGH_ERROR_RATE',
  CONSENT_VIOLATION = 'CONSENT_VIOLATION',
  DATA_RETENTION_VIOLATION = 'DATA_RETENTION_VIOLATION',
  ML_MODEL_FAILURE = 'ML_MODEL_FAILURE'
}

export interface Alert {
  id: string;
  type: AlertType;
  severity: AlertSeverity;
  message: string;
  timestamp: Date;
  component: string;
  metadata?: Record<string, unknown>;
  resolved: boolean;
  resolvedAt?: Date;
}

export interface HealthMetric {
  name: string;
  value: number;
  unit: string;
  timestamp: Date;
  threshold?: {
    warning: number;
    critical: number;
  };
}

export interface SystemHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  uptime: number;
  metrics: HealthMetric[];
  activeAlerts: Alert[];
  lastChecked: Date;
}

export interface MonitoringConfig {
  healthCheckInterval: number; // milliseconds
  alertThresholds: {
    errorRate: number; // percentage
    responseTime: number; // milliseconds
    memoryUsage: number; // percentage
    cpuUsage: number; // percentage
  };
  alertingEnabled: boolean;
  retentionPeriod: number; // days
}

export interface AlertHandler {
  canHandle(alert: Alert): boolean;
  handle(alert: Alert): Promise<void>;
}

export class SystemMonitor {
  private alerts: Map<string, Alert> = new Map();
  private metrics: Map<string, HealthMetric[]> = new Map();
  private alertHandlers: AlertHandler[] = [];
  private healthCheckTimer?: NodeJS.Timeout;
  private startTime: Date = new Date();

  private defaultConfig: MonitoringConfig = {
    healthCheckInterval: 30000, // 30 seconds
    alertThresholds: {
      errorRate: 5, // 5%
      responseTime: 2000, // 2 seconds
      memoryUsage: 80, // 80%
      cpuUsage: 80 // 80%
    },
    alertingEnabled: true,
    retentionPeriod: 30 // 30 days
  };

  constructor(private config: MonitoringConfig = {}) {
    this.config = { ...this.defaultConfig, ...config };
  }

  /**
   * Start monitoring system health
   */
  start(): void {
    if (this.healthCheckTimer) {
      return; // Already started
    }

    this.healthCheckTimer = setInterval(() => {
      this.performHealthCheck();
    }, this.config.healthCheckInterval);

    this.recordMetric('system_monitor_started', 1, 'count');
  }

  /**
   * Stop monitoring system health
   */
  stop(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = undefined;
    }

    this.recordMetric('system_monitor_stopped', 1, 'count');
  }

  /**
   * Record a system metric
   */
  recordMetric(name: string, value: number, unit: string, threshold?: { warning: number; critical: number }): void {
    const metric: HealthMetric = {
      name,
      value,
      unit,
      timestamp: new Date(),
      threshold
    };

    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }

    const metricHistory = this.metrics.get(name)!;
    metricHistory.push(metric);

    // Keep only recent metrics based on retention period
    const cutoffTime = new Date(Date.now() - (this.config.retentionPeriod * 24 * 60 * 60 * 1000));
    this.metrics.set(name, metricHistory.filter(m => m.timestamp > cutoffTime));

    // Check if metric exceeds thresholds
    if (threshold) {
      this.checkMetricThresholds(metric);
    }
  }

  /**
   * Create and process an alert
   */
  async createAlert(
    type: AlertType,
    severity: AlertSeverity,
    message: string,
    component: string,
    metadata?: Record<string, unknown>
  ): Promise<string> {
    const alert: Alert = {
      id: this.generateAlertId(),
      type,
      severity,
      message,
      timestamp: new Date(),
      component,
      metadata,
      resolved: false
    };

    this.alerts.set(alert.id, alert);

    // Process alert through handlers if alerting is enabled
    if (this.config.alertingEnabled) {
      await this.processAlert(alert);
    }

    return alert.id;
  }

  /**
   * Resolve an alert
   */
  resolveAlert(alertId: string): boolean {
    const alert = this.alerts.get(alertId);
    if (!alert || alert.resolved) {
      return false;
    }

    alert.resolved = true;
    alert.resolvedAt = new Date();
    return true;
  }

  /**
   * Get current system health status
   */
  getSystemHealth(): SystemHealth {
    const activeAlerts = Array.from(this.alerts.values()).filter(alert => !alert.resolved);
    const criticalAlerts = activeAlerts.filter(alert => alert.severity === AlertSeverity.CRITICAL);
    const highAlerts = activeAlerts.filter(alert => alert.severity === AlertSeverity.HIGH);

    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    if (criticalAlerts.length > 0) {
      status = 'unhealthy';
    } else if (highAlerts.length > 0 || activeAlerts.length > 5) {
      status = 'degraded';
    }

    const currentMetrics: HealthMetric[] = [];
    for (const [name, metricHistory] of this.metrics.entries()) {
      if (metricHistory.length > 0) {
        currentMetrics.push(metricHistory[metricHistory.length - 1]);
      }
    }

    return {
      status,
      uptime: Date.now() - this.startTime.getTime(),
      metrics: currentMetrics,
      activeAlerts,
      lastChecked: new Date()
    };
  }

  /**
   * Get alerts by type and severity
   */
  getAlerts(type?: AlertType, severity?: AlertSeverity, resolved?: boolean): Alert[] {
    let alerts = Array.from(this.alerts.values());

    if (type !== undefined) {
      alerts = alerts.filter(alert => alert.type === type);
    }

    if (severity !== undefined) {
      alerts = alerts.filter(alert => alert.severity === severity);
    }

    if (resolved !== undefined) {
      alerts = alerts.filter(alert => alert.resolved === resolved);
    }

    return alerts.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  /**
   * Get metric history
   */
  getMetricHistory(name: string, limit?: number): HealthMetric[] {
    const metrics = this.metrics.get(name) || [];
    return limit ? metrics.slice(-limit) : metrics;
  }

  /**
   * Register alert handler
   */
  registerAlertHandler(handler: AlertHandler): void {
    this.alertHandlers.push(handler);
  }

  /**
   * Monitor privacy violations
   */
  async monitorPrivacyViolation(
    violationType: string,
    userId: string,
    details: Record<string, unknown>
  ): Promise<void> {
    await this.createAlert(
      AlertType.PRIVACY_VIOLATION,
      AlertSeverity.CRITICAL,
      `Privacy violation detected: ${violationType}`,
      'PrivacyMonitor',
      { violationType, userId, ...details }
    );

    this.recordMetric('privacy_violations', 1, 'count');
  }

  /**
   * Monitor consent violations
   */
  async monitorConsentViolation(
    userId: string,
    consentType: string,
    operation: string
  ): Promise<void> {
    await this.createAlert(
      AlertType.CONSENT_VIOLATION,
      AlertSeverity.HIGH,
      `Consent violation: ${operation} attempted without ${consentType} consent`,
      'ConsentManager',
      { userId, consentType, operation }
    );

    this.recordMetric('consent_violations', 1, 'count');
  }

  /**
   * Monitor system failures
   */
  async monitorSystemFailure(
    component: string,
    operation: string,
    error: Error,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    const severity = this.determineSeverityFromError(error);
    
    await this.createAlert(
      AlertType.SYSTEM_FAILURE,
      severity,
      `System failure in ${component}: ${error.message}`,
      component,
      { operation, error: error.message, stack: error.stack, ...metadata }
    );

    this.recordMetric('system_failures', 1, 'count');
  }

  /**
   * Monitor performance degradation
   */
  async monitorPerformanceDegradation(
    component: string,
    metric: string,
    value: number,
    threshold: number
  ): Promise<void> {
    await this.createAlert(
      AlertType.PERFORMANCE_DEGRADATION,
      AlertSeverity.MEDIUM,
      `Performance degradation in ${component}: ${metric} is ${value}, exceeds threshold of ${threshold}`,
      component,
      { metric, value, threshold }
    );

    this.recordMetric('performance_degradations', 1, 'count');
  }

  /**
   * Monitor ML model failures
   */
  async monitorMLModelFailure(
    modelName: string,
    operation: string,
    error: Error
  ): Promise<void> {
    await this.createAlert(
      AlertType.ML_MODEL_FAILURE,
      AlertSeverity.MEDIUM,
      `ML model failure: ${modelName} failed during ${operation}`,
      'MLModelMonitor',
      { modelName, operation, error: error.message }
    );

    this.recordMetric('ml_model_failures', 1, 'count');
  }

  private async performHealthCheck(): Promise<void> {
    try {
      // Record basic system metrics
      this.recordMetric('uptime', Date.now() - this.startTime.getTime(), 'milliseconds');
      this.recordMetric('active_alerts', this.getAlerts(undefined, undefined, false).length, 'count');
      
      // Check for high error rates
      await this.checkErrorRates();
      
      // Clean up old alerts and metrics
      this.cleanupOldData();
      
    } catch (error) {
      console.error('Health check failed:', error);
    }
  }

  private async checkErrorRates(): Promise<void> {
    const errorMetrics = this.getMetricHistory('system_failures', 10);
    if (errorMetrics.length >= 5) {
      const recentErrors = errorMetrics.slice(-5);
      const errorRate = recentErrors.reduce((sum, metric) => sum + metric.value, 0);
      
      if (errorRate > this.config.alertThresholds.errorRate) {
        await this.createAlert(
          AlertType.HIGH_ERROR_RATE,
          AlertSeverity.HIGH,
          `High error rate detected: ${errorRate} errors in recent period`,
          'SystemMonitor',
          { errorRate, threshold: this.config.alertThresholds.errorRate }
        );
      }
    }
  }

  private checkMetricThresholds(metric: HealthMetric): void {
    if (!metric.threshold) return;

    if (metric.value >= metric.threshold.critical) {
      this.createAlert(
        AlertType.PERFORMANCE_DEGRADATION,
        AlertSeverity.CRITICAL,
        `Critical threshold exceeded for ${metric.name}: ${metric.value} ${metric.unit}`,
        'SystemMonitor',
        { metric: metric.name, value: metric.value, threshold: metric.threshold.critical }
      );
    } else if (metric.value >= metric.threshold.warning) {
      this.createAlert(
        AlertType.PERFORMANCE_DEGRADATION,
        AlertSeverity.MEDIUM,
        `Warning threshold exceeded for ${metric.name}: ${metric.value} ${metric.unit}`,
        'SystemMonitor',
        { metric: metric.name, value: metric.value, threshold: metric.threshold.warning }
      );
    }
  }

  private async processAlert(alert: Alert): Promise<void> {
    for (const handler of this.alertHandlers) {
      if (handler.canHandle(alert)) {
        try {
          await handler.handle(alert);
        } catch (error) {
          console.error(`Alert handler failed for alert ${alert.id}:`, error);
        }
      }
    }
  }

  private determineSeverityFromError(error: Error): AlertSeverity {
    const message = error.message.toLowerCase();
    
    if (message.includes('critical') || message.includes('fatal')) {
      return AlertSeverity.CRITICAL;
    }
    if (message.includes('privacy') || message.includes('consent')) {
      return AlertSeverity.HIGH;
    }
    if (message.includes('timeout') || message.includes('network')) {
      return AlertSeverity.MEDIUM;
    }
    
    return AlertSeverity.LOW;
  }

  private cleanupOldData(): void {
    const cutoffTime = new Date(Date.now() - (this.config.retentionPeriod * 24 * 60 * 60 * 1000));
    
    // Clean up old alerts
    for (const [id, alert] of this.alerts.entries()) {
      if (alert.resolved && alert.resolvedAt && alert.resolvedAt < cutoffTime) {
        this.alerts.delete(id);
      }
    }
  }

  private generateAlertId(): string {
    return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Default alert handlers

export class ConsoleAlertHandler implements AlertHandler {
  canHandle(alert: Alert): boolean {
    return true; // Handle all alerts
  }

  async handle(alert: Alert): Promise<void> {
    const timestamp = alert.timestamp.toISOString();
    const prefix = `[${timestamp}] [${alert.severity}] [${alert.component}]`;
    
    switch (alert.severity) {
      case AlertSeverity.CRITICAL:
        console.error(`${prefix} CRITICAL: ${alert.message}`);
        break;
      case AlertSeverity.HIGH:
        console.warn(`${prefix} HIGH: ${alert.message}`);
        break;
      case AlertSeverity.MEDIUM:
        console.warn(`${prefix} MEDIUM: ${alert.message}`);
        break;
      case AlertSeverity.LOW:
        console.info(`${prefix} LOW: ${alert.message}`);
        break;
    }
    
    if (alert.metadata) {
      console.log('Alert metadata:', alert.metadata);
    }
  }
}

export class EmailAlertHandler implements AlertHandler {
  constructor(
    private emailService: { sendAlert: (alert: Alert) => Promise<void> },
    private severityThreshold: AlertSeverity = AlertSeverity.HIGH
  ) {}

  canHandle(alert: Alert): boolean {
    const severityLevels = [AlertSeverity.LOW, AlertSeverity.MEDIUM, AlertSeverity.HIGH, AlertSeverity.CRITICAL];
    const alertLevel = severityLevels.indexOf(alert.severity);
    const thresholdLevel = severityLevels.indexOf(this.severityThreshold);
    
    return alertLevel >= thresholdLevel;
  }

  async handle(alert: Alert): Promise<void> {
    try {
      await this.emailService.sendAlert(alert);
    } catch (error) {
      console.error('Failed to send email alert:', error);
    }
  }
}

// Singleton instance
export const systemMonitor = new SystemMonitor();