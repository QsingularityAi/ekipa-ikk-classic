/**
 * Comprehensive error handling system with circuit breaker pattern
 * Requirements: 1.1, 2.2, 4.4 - Implement error handling for system resilience
 */

export enum ErrorType {
  NETWORK_ERROR = 'NETWORK_ERROR',
  ML_MODEL_ERROR = 'ML_MODEL_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  PRIVACY_VIOLATION = 'PRIVACY_VIOLATION',
  RATE_LIMIT_ERROR = 'RATE_LIMIT_ERROR',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}

export enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN'
}

export interface ErrorContext {
  component: string;
  operation: string;
  userId?: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

export interface CircuitBreakerConfig {
  failureThreshold: number;
  resetTimeout: number;
  monitoringPeriod: number;
  halfOpenMaxCalls: number;
}

export interface RetryConfig {
  maxAttempts: number;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
}

export class AppError extends Error {
  public readonly type: ErrorType;
  public readonly context: ErrorContext;
  public readonly isRetryable: boolean;
  public readonly timestamp: Date;

  constructor(
    message: string,
    type: ErrorType,
    context: ErrorContext,
    isRetryable: boolean = false
  ) {
    super(message);
    this.name = 'AppError';
    this.type = type;
    this.context = context;
    this.isRetryable = isRetryable;
    this.timestamp = new Date();
  }
}

class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount: number = 0;
  private lastFailureTime: number = 0;
  private halfOpenCalls: number = 0;

  constructor(private config: CircuitBreakerConfig) {}

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === CircuitState.OPEN) {
      if (Date.now() - this.lastFailureTime > this.config.resetTimeout) {
        this.state = CircuitState.HALF_OPEN;
        this.halfOpenCalls = 0;
      } else {
        throw new AppError(
          'Circuit breaker is OPEN',
          ErrorType.NETWORK_ERROR,
          {
            component: 'CircuitBreaker',
            operation: 'execute',
            timestamp: new Date()
          }
        );
      }
    }

    if (this.state === CircuitState.HALF_OPEN && this.halfOpenCalls >= this.config.halfOpenMaxCalls) {
      throw new AppError(
        'Circuit breaker HALF_OPEN call limit exceeded',
        ErrorType.NETWORK_ERROR,
        {
          component: 'CircuitBreaker',
          operation: 'execute',
          timestamp: new Date()
        }
      );
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    this.failureCount = 0;
    if (this.state === CircuitState.HALF_OPEN) {
      this.state = CircuitState.CLOSED;
    }
  }

  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.state === CircuitState.HALF_OPEN) {
      this.state = CircuitState.OPEN;
    } else if (this.failureCount >= this.config.failureThreshold) {
      this.state = CircuitState.OPEN;
    }

    if (this.state === CircuitState.HALF_OPEN) {
      this.halfOpenCalls++;
    }
  }

  getState(): CircuitState {
    return this.state;
  }

  getFailureCount(): number {
    return this.failureCount;
  }
}

export class ErrorHandler {
  private circuitBreakers: Map<string, CircuitBreaker> = new Map();
  private errorMetrics: Map<string, number> = new Map();
  private fallbackStrategies: Map<string, () => Promise<unknown>> = new Map();

  private defaultCircuitBreakerConfig: CircuitBreakerConfig = {
    failureThreshold: 5,
    resetTimeout: 60000, // 1 minute
    monitoringPeriod: 300000, // 5 minutes
    halfOpenMaxCalls: 3
  };

  private defaultRetryConfig: RetryConfig = {
    maxAttempts: 3,
    baseDelay: 1000,
    maxDelay: 10000,
    backoffMultiplier: 2
  };

  /**
   * Execute operation with circuit breaker protection
   */
  async executeWithCircuitBreaker<T>(
    operationName: string,
    operation: () => Promise<T>,
    config?: Partial<CircuitBreakerConfig>
  ): Promise<T> {
    const circuitBreaker = this.getOrCreateCircuitBreaker(operationName, config);
    
    try {
      return await circuitBreaker.execute(operation);
    } catch (error) {
      this.recordError(operationName, error);
      
      // Try fallback strategy if available
      const fallback = this.fallbackStrategies.get(operationName);
      if (fallback) {
        return await fallback() as T;
      }
      
      throw error;
    }
  }

  /**
   * Execute operation with retry logic and exponential backoff
   */
  async executeWithRetry<T>(
    operation: () => Promise<T>,
    context: ErrorContext,
    config?: Partial<RetryConfig>
  ): Promise<T> {
    const retryConfig = { ...this.defaultRetryConfig, ...config };
    let lastError: Error;

    for (let attempt = 1; attempt <= retryConfig.maxAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        
        if (attempt === retryConfig.maxAttempts || !this.isRetryableError(error)) {
          break;
        }

        const delay = Math.min(
          retryConfig.baseDelay * Math.pow(retryConfig.backoffMultiplier, attempt - 1),
          retryConfig.maxDelay
        );

        await this.sleep(delay);
      }
    }

    throw this.wrapError(lastError!, context);
  }

  /**
   * Handle ML model failures with graceful degradation
   */
  async handleMLModelFailure<T>(
    modelName: string,
    operation: () => Promise<T>,
    fallbackValue: T,
    context: ErrorContext
  ): Promise<T> {
    try {
      return await this.executeWithCircuitBreaker(`ml_model_${modelName}`, operation);
    } catch (error) {
      // Log ML model failure
      this.recordError(`ml_model_${modelName}`, error);
      
      // Return fallback value for graceful degradation
      return fallbackValue;
    }
  }

  /**
   * Register fallback strategy for specific operations
   */
  registerFallbackStrategy(operationName: string, fallback: () => Promise<unknown>): void {
    this.fallbackStrategies.set(operationName, fallback);
  }

  /**
   * Get error metrics for monitoring
   */
  getErrorMetrics(): Record<string, number> {
    return Object.fromEntries(this.errorMetrics);
  }

  /**
   * Get circuit breaker status
   */
  getCircuitBreakerStatus(operationName: string): { state: CircuitState; failureCount: number } | null {
    const circuitBreaker = this.circuitBreakers.get(operationName);
    if (!circuitBreaker) {
      return null;
    }

    return {
      state: circuitBreaker.getState(),
      failureCount: circuitBreaker.getFailureCount()
    };
  }

  /**
   * Reset circuit breaker for specific operation
   */
  resetCircuitBreaker(operationName: string): void {
    this.circuitBreakers.delete(operationName);
  }

  private getOrCreateCircuitBreaker(
    operationName: string,
    config?: Partial<CircuitBreakerConfig>
  ): CircuitBreaker {
    if (!this.circuitBreakers.has(operationName)) {
      const circuitBreakerConfig = { ...this.defaultCircuitBreakerConfig, ...config };
      this.circuitBreakers.set(operationName, new CircuitBreaker(circuitBreakerConfig));
    }
    return this.circuitBreakers.get(operationName)!;
  }

  private recordError(operationName: string, error: unknown): void {
    const errorType = this.getErrorType(error);
    const errorKey = `${operationName}_${errorType}`;
    const currentCount = this.errorMetrics.get(errorKey) || 0;
    this.errorMetrics.set(errorKey, currentCount + 1);
  }

  private getErrorType(error: unknown): ErrorType {
    if (error instanceof AppError) {
      return error.type;
    }

    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      
      // Check database errors first (more specific)
      if (message.includes('database') || message.includes('sql') || message.includes('db')) {
        return ErrorType.DATABASE_ERROR;
      }
      if (message.includes('timeout')) {
        return ErrorType.TIMEOUT_ERROR;
      }
      if (message.includes('rate limit')) {
        return ErrorType.RATE_LIMIT_ERROR;
      }
      if (message.includes('validation')) {
        return ErrorType.VALIDATION_ERROR;
      }
      if (message.includes('network') || message.includes('connection')) {
        return ErrorType.NETWORK_ERROR;
      }
    }

    return ErrorType.UNKNOWN_ERROR;
  }

  private isRetryableError(error: unknown): boolean {
    if (error instanceof AppError) {
      return error.isRetryable;
    }

    const errorType = this.getErrorType(error);
    return [
      ErrorType.NETWORK_ERROR,
      ErrorType.TIMEOUT_ERROR,
      ErrorType.DATABASE_ERROR
    ].includes(errorType);
  }

  private wrapError(error: Error, context: ErrorContext): AppError {
    if (error instanceof AppError) {
      return error;
    }

    return new AppError(
      error.message,
      this.getErrorType(error),
      context,
      this.isRetryableError(error)
    );
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Singleton instance
export const errorHandler = new ErrorHandler();