import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { StreamProcessor, StreamProcessorConfig, EventProcessor } from './stream-processor';
import { UserEvent } from '../types';

describe('StreamProcessor', () => {
  let streamProcessor: StreamProcessor;
  let config: StreamProcessorConfig;
  let mockProcessor: EventProcessor;

  const mockUserEvent: UserEvent = {
    eventId: 'test-event-123',
    userId: 'pseudo-user-456',
    sessionId: 'session-789',
    timestamp: new Date('2024-01-15T10:00:00Z'),
    eventType: 'page_view',
    metadata: {
      screenName: 'dashboard',
      featureId: 'main-nav',
      duration: 5000,
      success: true
    },
    userContext: {
      ageGroup: '31-40',
      digitalLiteracyScore: 75,
      preferredChannel: 'push'
    }
  };

  beforeEach(() => {
    config = {
      batchSize: 5,
      flushInterval: 1000,
      maxRetries: 3,
      retryDelay: 100,
      maxBufferSize: 100,
      enableDeadLetterQueue: true,
      processingTimeout: 5000
    };

    mockProcessor = vi.fn().mockImplementation((events) => Promise.resolve({
      success: true,
      processedCount: events.length,
      failedCount: 0,
      errors: []
    }));

    streamProcessor = new StreamProcessor(config);
    streamProcessor.registerProcessor('page_view', mockProcessor);
    streamProcessor.registerProcessor('default', mockProcessor);
  });

  afterEach(async () => {
    await streamProcessor.shutdown();
    vi.clearAllMocks();
  });

  describe('event processing', () => {
    it('should process a single event successfully', async () => {
      const result = await streamProcessor.processEvent(mockUserEvent);

      expect(result).toBe(true);
      expect(streamProcessor.getBufferSize()).toBe(1);
    });

    it('should reject invalid events', async () => {
      const invalidEvent = { ...mockUserEvent, eventId: '' };

      const result = await streamProcessor.processEvent(invalidEvent);

      expect(result).toBe(false);
      expect(streamProcessor.getBufferSize()).toBe(0);
    });

    it('should flush buffer when batch size is reached', async () => {
      const events = Array.from({ length: 5 }, (_, i) => ({
        ...mockUserEvent,
        eventId: `event-${i}`
      }));

      for (const event of events) {
        await streamProcessor.processEvent(event);
      }

      // Buffer should be empty after automatic flush
      expect(streamProcessor.getBufferSize()).toBe(0);
      expect(mockProcessor).toHaveBeenCalledWith(events);
    });

    it('should process batch of events', async () => {
      const events = Array.from({ length: 3 }, (_, i) => ({
        ...mockUserEvent,
        eventId: `event-${i}`
      }));

      const result = await streamProcessor.processBatch(events);

      expect(result.success).toBe(true);
      expect(result.processedCount).toBe(3);
      expect(result.failedCount).toBe(0);
      expect(mockProcessor).toHaveBeenCalled();
    });

    it('should filter out invalid events from batch', async () => {
      const events = [
        mockUserEvent,
        { ...mockUserEvent, eventId: '' }, // Invalid
        { ...mockUserEvent, eventId: 'valid-2' }
      ];

      const result = await streamProcessor.processBatch(events);

      expect(result.processedCount).toBe(2);
      expect(result.failedCount).toBe(1);
    });
  });

  describe('processor registration', () => {
    it('should register and unregister processors', () => {
      const customProcessor = vi.fn();
      
      streamProcessor.registerProcessor('custom_event', customProcessor);
      expect(streamProcessor['processors'].has('custom_event')).toBe(true);

      streamProcessor.unregisterProcessor('custom_event');
      expect(streamProcessor['processors'].has('custom_event')).toBe(false);
    });

    it('should emit events when processors are registered/unregistered', () => {
      const registeredSpy = vi.fn();
      const unregisteredSpy = vi.fn();
      
      streamProcessor.on('processorRegistered', registeredSpy);
      streamProcessor.on('processorUnregistered', unregisteredSpy);

      streamProcessor.registerProcessor('test_event', vi.fn());
      streamProcessor.unregisterProcessor('test_event');

      expect(registeredSpy).toHaveBeenCalledWith({ eventType: 'test_event' });
      expect(unregisteredSpy).toHaveBeenCalledWith({ eventType: 'test_event' });
    });
  });

  describe('retry mechanism', () => {
    it('should retry failed processing', async () => {
      const failingProcessor = vi.fn()
        .mockRejectedValueOnce(new Error('First attempt failed'))
        .mockRejectedValueOnce(new Error('Second attempt failed'))
        .mockResolvedValueOnce({
          success: true,
          processedCount: 1,
          failedCount: 0,
          errors: []
        });

      streamProcessor.registerProcessor('page_view', failingProcessor);

      const result = await streamProcessor.processEvent(mockUserEvent);
      expect(result).toBe(true);

      // Trigger flush to test retry mechanism
      await streamProcessor.flush();

      expect(failingProcessor).toHaveBeenCalledTimes(3);
    });

    it('should move events to dead letter queue after max retries', async () => {
      const alwaysFailingProcessor = vi.fn().mockRejectedValue(new Error('Always fails'));
      streamProcessor.registerProcessor('page_view', alwaysFailingProcessor);

      await streamProcessor.processEvent(mockUserEvent);
      await streamProcessor.flush();

      expect(streamProcessor.getDeadLetterQueueSize()).toBe(1);
      expect(alwaysFailingProcessor).toHaveBeenCalledTimes(config.maxRetries);
    });

    it('should emit retry attempt events', async () => {
      const retrySpy = vi.fn();
      streamProcessor.on('retryAttempt', retrySpy);

      const failingProcessor = vi.fn()
        .mockRejectedValueOnce(new Error('First attempt failed'))
        .mockResolvedValueOnce({
          success: true,
          processedCount: 1,
          failedCount: 0,
          errors: []
        });

      streamProcessor.registerProcessor('page_view', failingProcessor);

      await streamProcessor.processEvent(mockUserEvent);
      await streamProcessor.flush();

      expect(retrySpy).toHaveBeenCalledWith(
        expect.objectContaining({
          attempt: 1,
          delay: expect.any(Number),
          remainingEvents: 1,
          error: expect.any(Error)
        })
      );
    });
  });

  describe('dead letter queue', () => {
    it('should reprocess events from dead letter queue', async () => {
      // First, add events to dead letter queue by failing processing
      const failingProcessor = vi.fn().mockRejectedValue(new Error('Always fails'));
      streamProcessor.registerProcessor('page_view', failingProcessor);

      await streamProcessor.processEvent(mockUserEvent);
      await streamProcessor.flush();

      expect(streamProcessor.getDeadLetterQueueSize()).toBe(1);

      // Now register a working processor and reprocess
      const workingProcessor = vi.fn().mockResolvedValue({
        success: true,
        processedCount: 1,
        failedCount: 0,
        errors: []
      });
      streamProcessor.registerProcessor('page_view', workingProcessor);

      const result = await streamProcessor.reprocessDeadLetterEvents();

      expect(result.success).toBe(true);
      expect(result.processedCount).toBe(1);
      expect(streamProcessor.getDeadLetterQueueSize()).toBe(0);
    });

    it('should clear dead letter queue', async () => {
      // Add events to dead letter queue
      const failingProcessor = vi.fn().mockRejectedValue(new Error('Always fails'));
      streamProcessor.registerProcessor('page_view', failingProcessor);

      await streamProcessor.processEvent(mockUserEvent);
      await streamProcessor.flush();

      expect(streamProcessor.getDeadLetterQueueSize()).toBe(1);

      const clearedEvents = streamProcessor.clearDeadLetterQueue();
      expect(clearedEvents).toHaveLength(1);
      expect(streamProcessor.getDeadLetterQueueSize()).toBe(0);
    });

    it('should emit dead letter queue events', async () => {
      const deadLetterSpy = vi.fn();
      const clearSpy = vi.fn();
      
      streamProcessor.on('eventsMovedToDeadLetter', deadLetterSpy);
      streamProcessor.on('deadLetterQueueCleared', clearSpy);

      // Add events to dead letter queue
      const failingProcessor = vi.fn().mockRejectedValue(new Error('Always fails'));
      streamProcessor.registerProcessor('page_view', failingProcessor);

      await streamProcessor.processEvent(mockUserEvent);
      await streamProcessor.flush();

      expect(deadLetterSpy).toHaveBeenCalledWith({ eventCount: 1 });

      streamProcessor.clearDeadLetterQueue();
      expect(clearSpy).toHaveBeenCalledWith({ eventCount: 1 });
    });
  });

  describe('event grouping', () => {
    it('should process different event types with appropriate processors', async () => {
      const pageViewProcessor = vi.fn().mockResolvedValue({
        success: true,
        processedCount: 1,
        failedCount: 0,
        errors: []
      });

      const featureUsageProcessor = vi.fn().mockResolvedValue({
        success: true,
        processedCount: 1,
        failedCount: 0,
        errors: []
      });

      streamProcessor.registerProcessor('page_view', pageViewProcessor);
      streamProcessor.registerProcessor('feature_usage', featureUsageProcessor);

      const pageViewEvent = { ...mockUserEvent, eventType: 'page_view' as const };
      const featureEvent = { ...mockUserEvent, eventType: 'feature_usage' as const, eventId: 'feature-event' };

      await streamProcessor.processBatch([pageViewEvent, featureEvent]);

      expect(pageViewProcessor).toHaveBeenCalledWith([pageViewEvent]);
      expect(featureUsageProcessor).toHaveBeenCalledWith([featureEvent]);
    });

    it('should use default processor for unregistered event types', async () => {
      const defaultProcessor = vi.fn().mockResolvedValue({
        success: true,
        processedCount: 1,
        failedCount: 0,
        errors: []
      });

      streamProcessor.registerProcessor('default', defaultProcessor);

      const unknownEvent = { ...mockUserEvent, eventType: 'unknown_type' as any };
      await streamProcessor.processBatch([unknownEvent]);

      expect(defaultProcessor).toHaveBeenCalledWith([unknownEvent]);
    });
  });

  describe('timeout handling', () => {
    it('should timeout long-running processors', async () => {
      const slowProcessor = vi.fn().mockImplementation(() => 
        new Promise(resolve => setTimeout(resolve, 10000)) // 10 second delay
      );

      const fastConfig = { ...config, processingTimeout: 100 }; // 100ms timeout
      const fastProcessor = new StreamProcessor(fastConfig);
      fastProcessor.registerProcessor('page_view', slowProcessor);

      await fastProcessor.processEvent(mockUserEvent);
      const result = await fastProcessor.flush();

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].message).toContain('timed out');

      await fastProcessor.shutdown();
    });
  });

  describe('statistics and monitoring', () => {
    it('should track processing statistics', async () => {
      await streamProcessor.processEvent(mockUserEvent);
      await streamProcessor.flush();

      const stats = streamProcessor.getProcessingStats();
      expect(stats.totalProcessed).toBe(1);
      expect(stats.totalFailed).toBe(0);
      expect(stats.lastProcessedAt).toBeInstanceOf(Date);
      expect(stats.averageProcessingTime).toBeGreaterThanOrEqual(0);
    });

    it('should report health status', () => {
      expect(streamProcessor.isHealthy()).toBe(true);

      // Fill buffer to max capacity
      const events = Array.from({ length: config.maxBufferSize }, (_, i) => ({
        ...mockUserEvent,
        eventId: `event-${i}`
      }));

      // Manually add to buffer to test health check
      streamProcessor['eventBuffer'] = events;
      expect(streamProcessor.isHealthy()).toBe(false);
    });

    it('should emit processing events', async () => {
      const bufferedSpy = vi.fn();
      const processedSpy = vi.fn();
      
      streamProcessor.on('eventBuffered', bufferedSpy);
      streamProcessor.on('batchProcessed', processedSpy);

      await streamProcessor.processEvent(mockUserEvent);
      await streamProcessor.flush();

      expect(bufferedSpy).toHaveBeenCalledWith({
        event: mockUserEvent,
        bufferSize: 1
      });

      expect(processedSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          processedCount: 1,
          failedCount: 0,
          processingTime: expect.any(Number)
        })
      );
    });
  });

  describe('shutdown', () => {
    it('should gracefully shutdown and process remaining events', async () => {
      const shutdownSpy = vi.fn();
      streamProcessor.on('shutdown', shutdownSpy);

      await streamProcessor.processEvent(mockUserEvent);
      expect(streamProcessor.getBufferSize()).toBe(1);

      await streamProcessor.shutdown();

      expect(streamProcessor.getBufferSize()).toBe(0);
      expect(shutdownSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          finalStats: expect.any(Object),
          deadLetterQueueSize: expect.any(Number)
        })
      );
    });

    it('should reject new events after shutdown', async () => {
      await streamProcessor.shutdown();

      const result = await streamProcessor.processEvent(mockUserEvent);
      expect(result).toBe(false);
    });
  });

  describe('automatic flush', () => {
    it('should automatically flush events based on timer', async () => {
      const quickFlushConfig = { ...config, flushInterval: 50 }; // 50ms interval
      const quickProcessor = new StreamProcessor(quickFlushConfig);
      quickProcessor.registerProcessor('page_view', mockProcessor);

      await quickProcessor.processEvent(mockUserEvent);
      expect(quickProcessor.getBufferSize()).toBe(1);

      // Wait for automatic flush
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(quickProcessor.getBufferSize()).toBe(0);
      expect(mockProcessor).toHaveBeenCalled();

      await quickProcessor.shutdown();
    });
  });

  describe('error handling', () => {
    it('should handle processor errors gracefully', async () => {
      const errorSpy = vi.fn();
      streamProcessor.on('eventProcessingError', errorSpy);

      // Mock a processor that throws during registration
      const errorProcessor = vi.fn().mockImplementation(() => {
        throw new Error('Processing error');
      });

      streamProcessor.registerProcessor('page_view', errorProcessor);

      const result = await streamProcessor.processEvent(mockUserEvent);
      expect(result).toBe(true); // Event should still be buffered

      await streamProcessor.flush();
      // Error should be handled gracefully
    });

    it('should handle flush errors', async () => {
      const flushErrorSpy = vi.fn();
      streamProcessor.on('flushError', flushErrorSpy);

      // Add an event first
      await streamProcessor.processEvent(mockUserEvent);
      
      // Create a scenario that causes flush to fail by making processor throw
      const errorProcessor = vi.fn().mockRejectedValue(new Error('Flush error'));
      streamProcessor.registerProcessor('page_view', errorProcessor);
      
      const result = await streamProcessor.flush();
      expect(result.success).toBe(false);
    });
  });
});