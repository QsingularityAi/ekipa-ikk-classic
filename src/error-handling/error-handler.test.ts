import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  ErrorHandler,
  AppError,
  ErrorType,
  CircuitState,
  errorHandler
} from './error-handler';

describe('ErrorHandler', () => {
  let handler: ErrorHandler;

  beforeEach(() => {
    handler = new ErrorHandler();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('AppError', () => {
    it('should create AppError with correct properties', () => {
      const context = {
        component: 'TestComponent',
        operation: 'testOperation',
        timestamp: new Date()
      };

      const error = new AppError(
        'Test error message',
        ErrorType.NETWORK_ERROR,
        context,
        true
      );

      expect(error.message).toBe('Test error message');
      expect(error.type).toBe(ErrorType.NETWORK_ERROR);
      expect(error.context).toBe(context);
      expect(error.isRetryable).toBe(true);
      expect(error.timestamp).toBeInstanceOf(Date);
    });
  });

  describe('Circuit Breaker', () => {
    it('should execute operation successfully when circuit is closed', async () => {
      const mockOperation = vi.fn().mockResolvedValue('success');

      const result = await handler.executeWithCircuitBreaker(
        'test-operation',
        mockOperation
      );

      expect(result).toBe('success');
      expect(mockOperation).toHaveBeenCalledTimes(1);
    });

    it('should open circuit after failure threshold is reached', async () => {
      const mockOperation = vi.fn().mockRejectedValue(new Error('Network error'));

      // Execute operation 5 times to reach failure threshold
      for (let i = 0; i < 5; i++) {
        try {
          await handler.executeWithCircuitBreaker('test-operation', mockOperation);
        } catch (error) {
          // Expected to fail
        }
      }

      const status = handler.getCircuitBreakerStatus('test-operation');
      expect(status?.state).toBe(CircuitState.OPEN);
      expect(status?.failureCount).toBe(5);
    });

    it('should reject calls when circuit is open', async () => {
      const mockOperation = vi.fn().mockRejectedValue(new Error('Network error'));

      // Trigger circuit to open
      for (let i = 0; i < 5; i++) {
        try {
          await handler.executeWithCircuitBreaker('test-operation', mockOperation);
        } catch (error) {
          // Expected to fail
        }
      }

      // Next call should be rejected immediately
      await expect(
        handler.executeWithCircuitBreaker('test-operation', mockOperation)
      ).rejects.toThrow('Circuit breaker is OPEN');
    });

    it('should transition to half-open after reset timeout', async () => {
      const mockOperation = vi.fn()
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce('success');

      // Trigger circuit to open
      for (let i = 0; i < 5; i++) {
        try {
          await handler.executeWithCircuitBreaker('test-operation', mockOperation);
        } catch (error) {
          // Expected to fail
        }
      }

      // Advance time past reset timeout
      vi.advanceTimersByTime(61000); // 61 seconds

      // Should allow one call in half-open state
      const result = await handler.executeWithCircuitBreaker('test-operation', mockOperation);
      expect(result).toBe('success');

      const status = handler.getCircuitBreakerStatus('test-operation');
      expect(status?.state).toBe(CircuitState.CLOSED);
    });

    it('should use fallback strategy when circuit is open', async () => {
      const mockOperation = vi.fn().mockRejectedValue(new Error('Network error'));
      const mockFallback = vi.fn().mockResolvedValue('fallback-result');

      // Register fallback strategy
      handler.registerFallbackStrategy('test-operation-fallback', mockFallback);

      // Trigger circuit to open (fallback will be called during failures)
      for (let i = 0; i < 5; i++) {
        const result = await handler.executeWithCircuitBreaker('test-operation-fallback', mockOperation);
        expect(result).toBe('fallback-result');
      }

      // Verify fallback was called for each failure
      expect(mockFallback).toHaveBeenCalledTimes(5);
    });
  });

  describe('Retry Logic', () => {
    it('should retry retryable errors with exponential backoff', async () => {
      const mockOperation = vi.fn()
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce('success');

      const context = {
        component: 'TestComponent',
        operation: 'testOperation',
        timestamp: new Date()
      };

      const promise = handler.executeWithRetry(mockOperation, context);

      // Run all timers to completion
      await vi.runAllTimersAsync();

      const result = await promise;
      expect(result).toBe('success');
      expect(mockOperation).toHaveBeenCalledTimes(3);
    });

    it('should not retry non-retryable errors', async () => {
      const nonRetryableError = new AppError(
        'Validation error',
        ErrorType.VALIDATION_ERROR,
        {
          component: 'TestComponent',
          operation: 'testOperation',
          timestamp: new Date()
        },
        false // Not retryable
      );

      const mockOperation = vi.fn().mockRejectedValue(nonRetryableError);

      const context = {
        component: 'TestComponent',
        operation: 'testOperation',
        timestamp: new Date()
      };

      await expect(
        handler.executeWithRetry(mockOperation, context)
      ).rejects.toThrow('Validation error');

      expect(mockOperation).toHaveBeenCalledTimes(1);
    });

    it('should respect max retry attempts', async () => {
      const mockOperation = vi.fn().mockRejectedValue(new Error('Network error'));

      const context = {
        component: 'TestComponent',
        operation: 'testOperation',
        timestamp: new Date()
      };

      const promise = handler.executeWithRetry(mockOperation, context, { maxAttempts: 2 });
      
      // Run all timers to completion
      await vi.runAllTimersAsync();

      await expect(promise).rejects.toThrow();
      expect(mockOperation).toHaveBeenCalledTimes(2);
    });
  });

  describe('ML Model Failure Handling', () => {
    it('should return fallback value when ML model fails', async () => {
      const mockMLOperation = vi.fn().mockRejectedValue(new Error('ML model error'));
      const fallbackValue = { prediction: 'default', confidence: 0.5 };

      const context = {
        component: 'RecommendationEngine',
        operation: 'generateRecommendation',
        timestamp: new Date()
      };

      const result = await handler.handleMLModelFailure(
        'recommendation-model',
        mockMLOperation,
        fallbackValue,
        context
      );

      expect(result).toBe(fallbackValue);
      expect(mockMLOperation).toHaveBeenCalledTimes(1);
    });

    it('should return actual result when ML model succeeds', async () => {
      const mockMLOperation = vi.fn().mockResolvedValue({ prediction: 'success', confidence: 0.9 });
      const fallbackValue = { prediction: 'default', confidence: 0.5 };

      const context = {
        component: 'RecommendationEngine',
        operation: 'generateRecommendation',
        timestamp: new Date()
      };

      const result = await handler.handleMLModelFailure(
        'recommendation-model',
        mockMLOperation,
        fallbackValue,
        context
      );

      expect(result).toEqual({ prediction: 'success', confidence: 0.9 });
    });
  });

  describe('Error Metrics', () => {
    it('should track error metrics by operation and type', async () => {
      const mockOperation1 = vi.fn().mockRejectedValue(new Error('Network error'));
      const mockOperation2 = vi.fn().mockRejectedValue(new Error('Database error'));

      try {
        await handler.executeWithCircuitBreaker('operation1', mockOperation1);
      } catch (error) {
        // Expected to fail
      }

      try {
        await handler.executeWithCircuitBreaker('operation2', mockOperation2);
      } catch (error) {
        // Expected to fail
      }

      const metrics = handler.getErrorMetrics();
      expect(metrics['operation1_NETWORK_ERROR']).toBe(1);
      expect(metrics['operation2_DATABASE_ERROR']).toBe(1);
    });
  });

  describe('Circuit Breaker Management', () => {
    it('should reset circuit breaker', async () => {
      const mockOperation = vi.fn().mockRejectedValue(new Error('Network error'));

      // Trigger circuit to open
      for (let i = 0; i < 5; i++) {
        try {
          await handler.executeWithCircuitBreaker('test-operation', mockOperation);
        } catch (error) {
          // Expected to fail
        }
      }

      let status = handler.getCircuitBreakerStatus('test-operation');
      expect(status?.state).toBe(CircuitState.OPEN);

      // Reset circuit breaker
      handler.resetCircuitBreaker('test-operation');

      status = handler.getCircuitBreakerStatus('test-operation');
      expect(status).toBeNull();
    });

    it('should return null for non-existent circuit breaker status', () => {
      const status = handler.getCircuitBreakerStatus('non-existent');
      expect(status).toBeNull();
    });
  });

  describe('Error Type Detection', () => {
    it('should correctly identify network errors', async () => {
      const networkError = new Error('Connection failed');
      const mockOperation = vi.fn().mockRejectedValue(networkError);

      try {
        await handler.executeWithCircuitBreaker('test-operation', mockOperation);
      } catch (error) {
        // Expected to fail
      }

      const metrics = handler.getErrorMetrics();
      expect(metrics['test-operation_NETWORK_ERROR']).toBe(1);
    });

    it('should correctly identify timeout errors', async () => {
      const timeoutError = new Error('Request timeout');
      const mockOperation = vi.fn().mockRejectedValue(timeoutError);

      try {
        await handler.executeWithCircuitBreaker('test-operation', mockOperation);
      } catch (error) {
        // Expected to fail
      }

      const metrics = handler.getErrorMetrics();
      expect(metrics['test-operation_TIMEOUT_ERROR']).toBe(1);
    });

    it('should correctly identify database errors', async () => {
      const dbError = new Error('Database connection failed');
      const mockOperation = vi.fn().mockRejectedValue(dbError);

      try {
        await handler.executeWithCircuitBreaker('test-db-operation', mockOperation);
      } catch (error) {
        // Expected to fail
      }

      const metrics = handler.getErrorMetrics();
      expect(metrics['test-db-operation_DATABASE_ERROR']).toBe(1);
    });
  });

  describe('Singleton Instance', () => {
    it('should provide singleton error handler instance', () => {
      expect(errorHandler).toBeInstanceOf(ErrorHandler);
    });
  });

  describe('Graceful Degradation Scenarios', () => {
    it('should handle recommendation engine failure gracefully', async () => {
      const mockRecommendationOperation = vi.fn().mockRejectedValue(
        new Error('Recommendation model unavailable')
      );

      const defaultRecommendations = [
        { type: 'nudge', message: 'Check out our mobile features!' }
      ];

      const context = {
        component: 'RecommendationEngine',
        operation: 'generatePersonalizedRecommendations',
        userId: 'user123',
        timestamp: new Date()
      };

      const result = await handler.handleMLModelFailure(
        'personalization-model',
        mockRecommendationOperation,
        defaultRecommendations,
        context
      );

      expect(result).toBe(defaultRecommendations);
    });

    it('should handle user segmentation failure gracefully', async () => {
      const mockSegmentationOperation = vi.fn().mockRejectedValue(
        new Error('Segmentation model error')
      );

      const defaultSegment = {
        segmentId: 'default',
        name: 'General Users',
        criteria: {
          engagementLevel: 'medium' as const,
          preferredChannels: ['in_app'],
          digitalLiteracy: 'intermediate' as const
        }
      };

      const context = {
        component: 'UserSegmentationEngine',
        operation: 'segmentUser',
        userId: 'user123',
        timestamp: new Date()
      };

      const result = await handler.handleMLModelFailure(
        'segmentation-model',
        mockSegmentationOperation,
        defaultSegment,
        context
      );

      expect(result).toBe(defaultSegment);
    });
  });

  describe('Privacy Error Handling', () => {
    it('should handle privacy violation errors appropriately', async () => {
      const privacyError = new AppError(
        'Consent withdrawn',
        ErrorType.PRIVACY_VIOLATION,
        {
          component: 'ConsentManager',
          operation: 'validateConsent',
          userId: 'user123',
          timestamp: new Date()
        },
        false // Not retryable
      );

      const mockOperation = vi.fn().mockRejectedValue(privacyError);

      const context = {
        component: 'ConsentManager',
        operation: 'validateConsent',
        timestamp: new Date()
      };

      await expect(
        handler.executeWithRetry(mockOperation, context)
      ).rejects.toThrow('Consent withdrawn');

      // Should not retry privacy violations
      expect(mockOperation).toHaveBeenCalledTimes(1);
    });
  });
});