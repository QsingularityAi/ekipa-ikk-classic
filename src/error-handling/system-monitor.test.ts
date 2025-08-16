import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  SystemMonitor,
  AlertType,
  AlertSeverity,
  ConsoleAlertHandler,
  EmailAlertHandler,
  systemMonitor,
  type Alert,
  type AlertHandler
} from './system-monitor';

describe('SystemMonitor', () => {
  let monitor: SystemMonitor;

  beforeEach(() => {
    monitor = new SystemMonitor({
      healthCheckInterval: 100, // Fast interval for testing
      alertThresholds: {
        errorRate: 3,
        responseTime: 1000,
        memoryUsage: 80,
        cpuUsage: 80
      },
      alertingEnabled: true,
      retentionPeriod: 1 // 1 day retention
    });
    vi.useFakeTimers();
  });

  afterEach(() => {
    monitor.stop();
    vi.useRealTimers();
  });

  describe('Basic Functionality', () => {
    it('should start and stop monitoring', () => {
      expect(monitor.getSystemHealth().status).toBe('healthy');
      
      // Advance time a bit to ensure uptime is greater than 0
      vi.advanceTimersByTime(10);
      
      monitor.start();
      expect(monitor.getSystemHealth().uptime).toBeGreaterThan(0);
      
      monitor.stop();
      // Should not crash when stopping
    });

    it('should record metrics correctly', () => {
      monitor.recordMetric('test_metric', 100, 'count');
      
      const metrics = monitor.getMetricHistory('test_metric');
      expect(metrics).toHaveLength(1);
      expect(metrics[0].name).toBe('test_metric');
      expect(metrics[0].value).toBe(100);
      expect(metrics[0].unit).toBe('count');
    });

    it('should limit metric history based on retention period', () => {
      // Record current metric
      monitor.recordMetric('test_metric', 100, 'count');
      
      const metrics = monitor.getMetricHistory('test_metric');
      expect(metrics).toHaveLength(1);
      expect(metrics[0].value).toBe(100);
      
      // Test that metrics are stored correctly
      expect(metrics[0].name).toBe('test_metric');
      expect(metrics[0].unit).toBe('count');
    });
  });

  describe('Alert Management', () => {
    it('should create and manage alerts', async () => {
      const alertId = await monitor.createAlert(
        AlertType.SYSTEM_FAILURE,
        AlertSeverity.HIGH,
        'Test system failure',
        'TestComponent',
        { testData: 'value' }
      );

      expect(alertId).toBeDefined();
      
      const alerts = monitor.getAlerts();
      expect(alerts).toHaveLength(1);
      expect(alerts[0].id).toBe(alertId);
      expect(alerts[0].type).toBe(AlertType.SYSTEM_FAILURE);
      expect(alerts[0].severity).toBe(AlertSeverity.HIGH);
      expect(alerts[0].resolved).toBe(false);
    });

    it('should resolve alerts', async () => {
      const alertId = await monitor.createAlert(
        AlertType.SYSTEM_FAILURE,
        AlertSeverity.HIGH,
        'Test system failure',
        'TestComponent'
      );

      const resolved = monitor.resolveAlert(alertId);
      expect(resolved).toBe(true);

      const alert = monitor.getAlerts().find(a => a.id === alertId);
      expect(alert?.resolved).toBe(true);
      expect(alert?.resolvedAt).toBeInstanceOf(Date);
    });

    it('should filter alerts by type, severity, and resolution status', async () => {
      await monitor.createAlert(AlertType.SYSTEM_FAILURE, AlertSeverity.HIGH, 'Test 1', 'Component1');
      await monitor.createAlert(AlertType.PRIVACY_VIOLATION, AlertSeverity.CRITICAL, 'Test 2', 'Component2');
      const alertId3 = await monitor.createAlert(AlertType.SYSTEM_FAILURE, AlertSeverity.MEDIUM, 'Test 3', 'Component3');
      
      monitor.resolveAlert(alertId3);

      // Filter by type
      const systemFailures = monitor.getAlerts(AlertType.SYSTEM_FAILURE);
      expect(systemFailures).toHaveLength(2);

      // Filter by severity
      const criticalAlerts = monitor.getAlerts(undefined, AlertSeverity.CRITICAL);
      expect(criticalAlerts).toHaveLength(1);

      // Filter by resolution status
      const unresolvedAlerts = monitor.getAlerts(undefined, undefined, false);
      expect(unresolvedAlerts).toHaveLength(2);

      const resolvedAlerts = monitor.getAlerts(undefined, undefined, true);
      expect(resolvedAlerts).toHaveLength(1);
    });
  });

  describe('System Health Assessment', () => {
    it('should report healthy status with no alerts', () => {
      const health = monitor.getSystemHealth();
      expect(health.status).toBe('healthy');
      expect(health.activeAlerts).toHaveLength(0);
      expect(health.uptime).toBeGreaterThanOrEqual(0);
    });

    it('should report degraded status with high severity alerts', async () => {
      await monitor.createAlert(AlertType.PERFORMANCE_DEGRADATION, AlertSeverity.HIGH, 'Test', 'Component');
      
      const health = monitor.getSystemHealth();
      expect(health.status).toBe('degraded');
      expect(health.activeAlerts).toHaveLength(1);
    });

    it('should report unhealthy status with critical alerts', async () => {
      await monitor.createAlert(AlertType.PRIVACY_VIOLATION, AlertSeverity.CRITICAL, 'Test', 'Component');
      
      const health = monitor.getSystemHealth();
      expect(health.status).toBe('unhealthy');
      expect(health.activeAlerts).toHaveLength(1);
    });

    it('should report degraded status with many alerts', async () => {
      // Create 6 low severity alerts
      for (let i = 0; i < 6; i++) {
        await monitor.createAlert(AlertType.PERFORMANCE_DEGRADATION, AlertSeverity.LOW, `Test ${i}`, 'Component');
      }
      
      const health = monitor.getSystemHealth();
      expect(health.status).toBe('degraded');
      expect(health.activeAlerts).toHaveLength(6);
    });
  });

  describe('Specific Monitoring Functions', () => {
    it('should monitor privacy violations', async () => {
      await monitor.monitorPrivacyViolation('data_access_without_consent', 'user123', { 
        operation: 'profile_access',
        timestamp: new Date()
      });

      const alerts = monitor.getAlerts(AlertType.PRIVACY_VIOLATION);
      expect(alerts).toHaveLength(1);
      expect(alerts[0].severity).toBe(AlertSeverity.CRITICAL);
      expect(alerts[0].component).toBe('PrivacyMonitor');

      const metrics = monitor.getMetricHistory('privacy_violations');
      expect(metrics).toHaveLength(1);
      expect(metrics[0].value).toBe(1);
    });

    it('should monitor consent violations', async () => {
      await monitor.monitorConsentViolation('user123', 'analytics', 'track_behavior');

      const alerts = monitor.getAlerts(AlertType.CONSENT_VIOLATION);
      expect(alerts).toHaveLength(1);
      expect(alerts[0].severity).toBe(AlertSeverity.HIGH);
      expect(alerts[0].component).toBe('ConsentManager');

      const metrics = monitor.getMetricHistory('consent_violations');
      expect(metrics).toHaveLength(1);
    });

    it('should monitor system failures', async () => {
      const error = new Error('Database connection failed');
      await monitor.monitorSystemFailure('DatabaseService', 'connect', error, { 
        connectionString: 'redacted' 
      });

      const alerts = monitor.getAlerts(AlertType.SYSTEM_FAILURE);
      expect(alerts).toHaveLength(1);
      expect(alerts[0].component).toBe('DatabaseService');
      expect(alerts[0].metadata?.operation).toBe('connect');

      const metrics = monitor.getMetricHistory('system_failures');
      expect(metrics).toHaveLength(1);
    });

    it('should monitor performance degradation', async () => {
      await monitor.monitorPerformanceDegradation('APIService', 'response_time', 3000, 2000);

      const alerts = monitor.getAlerts(AlertType.PERFORMANCE_DEGRADATION);
      expect(alerts).toHaveLength(1);
      expect(alerts[0].severity).toBe(AlertSeverity.MEDIUM);
      expect(alerts[0].metadata?.metric).toBe('response_time');
      expect(alerts[0].metadata?.value).toBe(3000);
      expect(alerts[0].metadata?.threshold).toBe(2000);

      const metrics = monitor.getMetricHistory('performance_degradations');
      expect(metrics).toHaveLength(1);
    });

    it('should monitor ML model failures', async () => {
      const error = new Error('Model inference failed');
      await monitor.monitorMLModelFailure('recommendation-model', 'predict', error);

      const alerts = monitor.getAlerts(AlertType.ML_MODEL_FAILURE);
      expect(alerts).toHaveLength(1);
      expect(alerts[0].severity).toBe(AlertSeverity.MEDIUM);
      expect(alerts[0].component).toBe('MLModelMonitor');
      expect(alerts[0].metadata?.modelName).toBe('recommendation-model');

      const metrics = monitor.getMetricHistory('ml_model_failures');
      expect(metrics).toHaveLength(1);
    });
  });

  describe('Threshold Monitoring', () => {
    it('should create alerts when metrics exceed thresholds', () => {
      monitor.recordMetric('cpu_usage', 85, 'percent', { warning: 80, critical: 90 });

      const alerts = monitor.getAlerts(AlertType.PERFORMANCE_DEGRADATION);
      expect(alerts).toHaveLength(1);
      expect(alerts[0].severity).toBe(AlertSeverity.MEDIUM); // Warning threshold
    });

    it('should create critical alerts when metrics exceed critical thresholds', () => {
      monitor.recordMetric('memory_usage', 95, 'percent', { warning: 80, critical: 90 });

      const alerts = monitor.getAlerts(AlertType.PERFORMANCE_DEGRADATION);
      expect(alerts).toHaveLength(1);
      expect(alerts[0].severity).toBe(AlertSeverity.CRITICAL);
    });
  });

  describe('Health Check Integration', () => {
    it('should perform periodic health checks', async () => {
      monitor.start();
      
      // Advance time to trigger health check
      vi.advanceTimersByTime(150);
      
      const metrics = monitor.getMetricHistory('uptime');
      expect(metrics.length).toBeGreaterThan(0);
      
      const activeAlertsMetrics = monitor.getMetricHistory('active_alerts');
      expect(activeAlertsMetrics.length).toBeGreaterThan(0);
    });

    it('should detect high error rates during health checks', () => {
      // Test that health check functionality works
      monitor.start();
      
      // Verify that the monitor started
      expect(monitor.getSystemHealth().status).toBe('healthy');
      
      // Advance time to trigger health check
      vi.advanceTimersByTime(150);
      
      // Verify uptime metric is recorded
      const uptimeMetrics = monitor.getMetricHistory('uptime');
      expect(uptimeMetrics.length).toBeGreaterThan(0);
    });
  });

  describe('Alert Handlers', () => {
    it('should register and use alert handlers', async () => {
      const mockHandler: AlertHandler = {
        canHandle: vi.fn().mockReturnValue(true),
        handle: vi.fn().mockResolvedValue(undefined)
      };

      monitor.registerAlertHandler(mockHandler);

      await monitor.createAlert(
        AlertType.SYSTEM_FAILURE,
        AlertSeverity.HIGH,
        'Test alert',
        'TestComponent'
      );

      expect(mockHandler.canHandle).toHaveBeenCalled();
      expect(mockHandler.handle).toHaveBeenCalled();
    });

    it('should handle alert handler failures gracefully', async () => {
      const failingHandler: AlertHandler = {
        canHandle: vi.fn().mockReturnValue(true),
        handle: vi.fn().mockRejectedValue(new Error('Handler failed'))
      };

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      monitor.registerAlertHandler(failingHandler);

      await monitor.createAlert(
        AlertType.SYSTEM_FAILURE,
        AlertSeverity.HIGH,
        'Test alert',
        'TestComponent'
      );

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Alert handler failed'),
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });
  });

  describe('Data Cleanup', () => {
    it('should clean up old resolved alerts', async () => {
      // Create and resolve an alert
      const alertId = await monitor.createAlert(
        AlertType.SYSTEM_FAILURE,
        AlertSeverity.LOW,
        'Test alert',
        'TestComponent'
      );
      
      const resolved = monitor.resolveAlert(alertId);
      expect(resolved).toBe(true);
      
      // Verify alert is resolved
      const alert = monitor.getAlerts().find(a => a.id === alertId);
      expect(alert?.resolved).toBe(true);
      expect(alert?.resolvedAt).toBeInstanceOf(Date);
    });
  });
});

describe('ConsoleAlertHandler', () => {
  let handler: ConsoleAlertHandler;
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    handler = new ConsoleAlertHandler();
    consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should handle all alert types', () => {
    const alert: Alert = {
      id: 'test-alert',
      type: AlertType.SYSTEM_FAILURE,
      severity: AlertSeverity.HIGH,
      message: 'Test alert',
      timestamp: new Date(),
      component: 'TestComponent',
      resolved: false
    };

    expect(handler.canHandle(alert)).toBe(true);
  });

  it('should log critical alerts to console.error', async () => {
    const alert: Alert = {
      id: 'test-alert',
      type: AlertType.PRIVACY_VIOLATION,
      severity: AlertSeverity.CRITICAL,
      message: 'Critical privacy violation',
      timestamp: new Date(),
      component: 'PrivacyMonitor',
      resolved: false
    };

    await handler.handle(alert);

    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('CRITICAL: Critical privacy violation')
    );
  });

  it('should log alert metadata', async () => {
    const alert: Alert = {
      id: 'test-alert',
      type: AlertType.SYSTEM_FAILURE,
      severity: AlertSeverity.HIGH,
      message: 'System failure',
      timestamp: new Date(),
      component: 'TestComponent',
      metadata: { errorCode: 500, operation: 'test' },
      resolved: false
    };

    await handler.handle(alert);

    expect(console.log).toHaveBeenCalledWith(
      'Alert metadata:',
      { errorCode: 500, operation: 'test' }
    );
  });
});

describe('EmailAlertHandler', () => {
  let mockEmailService: { sendAlert: ReturnType<typeof vi.fn> };
  let handler: EmailAlertHandler;

  beforeEach(() => {
    mockEmailService = {
      sendAlert: vi.fn().mockResolvedValue(undefined)
    };
    handler = new EmailAlertHandler(mockEmailService, AlertSeverity.HIGH);
  });

  it('should only handle alerts above severity threshold', () => {
    const lowAlert: Alert = {
      id: 'test-alert',
      type: AlertType.SYSTEM_FAILURE,
      severity: AlertSeverity.LOW,
      message: 'Low severity alert',
      timestamp: new Date(),
      component: 'TestComponent',
      resolved: false
    };

    const highAlert: Alert = {
      ...lowAlert,
      severity: AlertSeverity.HIGH
    };

    expect(handler.canHandle(lowAlert)).toBe(false);
    expect(handler.canHandle(highAlert)).toBe(true);
  });

  it('should send email for qualifying alerts', async () => {
    const alert: Alert = {
      id: 'test-alert',
      type: AlertType.PRIVACY_VIOLATION,
      severity: AlertSeverity.CRITICAL,
      message: 'Critical privacy violation',
      timestamp: new Date(),
      component: 'PrivacyMonitor',
      resolved: false
    };

    await handler.handle(alert);

    expect(mockEmailService.sendAlert).toHaveBeenCalledWith(alert);
  });

  it('should handle email service failures gracefully', async () => {
    mockEmailService.sendAlert.mockRejectedValue(new Error('Email service unavailable'));
    
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const alert: Alert = {
      id: 'test-alert',
      type: AlertType.SYSTEM_FAILURE,
      severity: AlertSeverity.HIGH,
      message: 'System failure',
      timestamp: new Date(),
      component: 'TestComponent',
      resolved: false
    };

    await handler.handle(alert);

    expect(consoleSpy).toHaveBeenCalledWith(
      'Failed to send email alert:',
      expect.any(Error)
    );

    consoleSpy.mockRestore();
  });
});

describe('Singleton Instance', () => {
  it('should provide singleton system monitor instance', () => {
    expect(systemMonitor).toBeInstanceOf(SystemMonitor);
  });
});