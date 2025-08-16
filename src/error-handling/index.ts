/**
 * Error handling and system monitoring module
 * Provides comprehensive error handling with circuit breaker pattern and system monitoring
 */

export {
  ErrorHandler,
  AppError,
  ErrorType,
  CircuitState,
  errorHandler,
  type ErrorContext,
  type CircuitBreakerConfig,
  type RetryConfig
} from './error-handler';

export {
  SystemMonitor,
  AlertType,
  AlertSeverity,
  ConsoleAlertHandler,
  EmailAlertHandler,
  systemMonitor,
  type Alert,
  type AlertHandler,
  type HealthMetric,
  type SystemHealth,
  type MonitoringConfig
} from './system-monitor';