import { UserEvent } from '../types';
import { EventEmitter } from 'events';

/**
 * Configuration interface for StreamProcessor
 */
export interface StreamProcessorConfig {
  batchSize: number;
  flushInterval: number;
  maxRetries: number;
  retryDelay: number;
  maxBufferSize: number;
  enableDeadLetterQueue: boolean;
  processingTimeout: number;
}

/**
 * Event processing result interface
 */
export interface ProcessingResult {
  success: boolean;
  processedCount: number;
  failedCount: number;
  errors: Error[];
}

/**
 * Event processor function type
 */
export type EventProcessor = (events: UserEvent[]) => Promise<ProcessingResult>;

/**
 * StreamProcessor class for real-time event handling
 * Requirements: 1.1 - Real-time event processing with reliability
 * Requirements: 1.3 - Event buffering and retry mechanisms
 */
export class StreamProcessor extends EventEmitter {
  private config: StreamProcessorConfig;
  private eventBuffer: UserEvent[] = [];
  private deadLetterQueue: UserEvent[] = [];
  private flushTimer: NodeJS.Timeout | null = null;
  private isProcessing = false;
  private isShuttingDown = false;
  private processors: Map<string, EventProcessor> = new Map();
  private processingStats = {
    totalProcessed: 0,
    totalFailed: 0,
    lastProcessedAt: new Date(),
    averageProcessingTime: 0
  };

  constructor(config: StreamProcessorConfig) {
    super();
    this.config = config;
    this.startFlushTimer();
  }

  /**
   * Register an event processor for specific event types
   * Requirements: 1.1 - Support different processing strategies for different event types
   */
  registerProcessor(eventType: string, processor: EventProcessor): void {
    this.processors.set(eventType, processor);
    this.emit('processorRegistered', { eventType });
  }

  /**
   * Unregister an event processor
   */
  unregisterProcessor(eventType: string): void {
    this.processors.delete(eventType);
    this.emit('processorUnregistered', { eventType });
  }

  /**
   * Process a single event
   * Requirements: 1.1 - Real-time event processing
   */
  async processEvent(event: UserEvent): Promise<boolean> {
    if (this.isShuttingDown) {
      console.warn('StreamProcessor is shutting down, rejecting new events');
      return false;
    }

    try {
      // Validate event before processing
      if (!this.validateEvent(event)) {
        this.emit('eventValidationFailed', { event });
        return false;
      }

      // Add to buffer
      this.eventBuffer.push(event);
      this.emit('eventBuffered', { event, bufferSize: this.eventBuffer.length });

      // Check if buffer is full
      if (this.eventBuffer.length >= this.config.batchSize) {
        await this.flush();
      }

      // Check if buffer exceeds maximum size
      if (this.eventBuffer.length >= this.config.maxBufferSize) {
        console.warn(`Buffer size exceeded maximum (${this.config.maxBufferSize}), forcing flush`);
        await this.flush();
      }

      return true;
    } catch (error) {
      console.error('Error processing event:', error);
      this.emit('eventProcessingError', { event, error });
      return false;
    }
  }

  /**
   * Process multiple events (alias for processBatch for test compatibility)
   * Requirements: 1.1 - Process multiple events efficiently
   */
  async processEvents(events: UserEvent[]): Promise<ProcessingResult> {
    return this.processBatch(events);
  }

  /**
   * Process multiple events in batch
   * Requirements: 1.1 - Batch processing for efficiency
   */
  async processBatch(events: UserEvent[]): Promise<ProcessingResult> {
    if (this.isShuttingDown) {
      return {
        success: false,
        processedCount: 0,
        failedCount: events.length,
        errors: [new Error('StreamProcessor is shutting down')]
      };
    }

    const validEvents = events.filter(event => this.validateEvent(event));
    const invalidCount = events.length - validEvents.length;

    if (invalidCount > 0) {
      console.warn(`Filtered out ${invalidCount} invalid events from batch`);
    }

    // Add valid events to buffer
    this.eventBuffer.push(...validEvents);

    // Always flush when processing a batch
    const result = await this.flush();
    
    return {
      success: result.success,
      processedCount: result.processedCount,
      failedCount: result.failedCount + invalidCount,
      errors: result.errors
    };
  }

  /**
   * Flush buffered events to processors
   * Requirements: 1.3 - Reliable event processing with retry mechanisms
   */
  async flush(): Promise<ProcessingResult> {
    if (this.isProcessing || this.eventBuffer.length === 0) {
      return {
        success: true,
        processedCount: 0,
        failedCount: 0,
        errors: []
      };
    }

    this.isProcessing = true;
    const startTime = Date.now();
    const eventsToProcess = [...this.eventBuffer];
    this.eventBuffer = [];

    try {
      const result = await this.processEventsWithRetry(eventsToProcess);
      
      // Update processing statistics
      this.updateProcessingStats(result, Date.now() - startTime);
      
      this.emit('batchProcessed', {
        processedCount: result.processedCount,
        failedCount: result.failedCount,
        processingTime: Date.now() - startTime
      });

      return result;
    } catch (error) {
      console.error('Error during flush:', error);
      
      // Re-add events to buffer for retry
      this.eventBuffer.unshift(...eventsToProcess);
      
      this.emit('flushError', { error, eventCount: eventsToProcess.length });
      
      return {
        success: false,
        processedCount: 0,
        failedCount: eventsToProcess.length,
        errors: [error as Error]
      };
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Process events with retry logic
   * Requirements: 1.3 - Implement retry mechanisms for reliability
   */
  private async processEventsWithRetry(events: UserEvent[]): Promise<ProcessingResult> {
    let attempt = 0;
    let lastError: Error | null = null;
    let totalProcessed = 0;
    let totalFailed = 0;
    const allErrors: Error[] = [];

    while (attempt < this.config.maxRetries) {
      try {
        // Group events by type for targeted processing
        const eventsByType = this.groupEventsByType(events);
        let batchProcessed = 0;
        let batchFailed = 0;

        for (const [eventType, typeEvents] of eventsByType.entries()) {
          const processor = this.processors.get(eventType) || this.processors.get('default');
          
          if (!processor) {
            console.warn(`No processor found for event type: ${eventType}`);
            batchFailed += typeEvents.length;
            continue;
          }

          try {
            const result = await this.executeWithTimeout(
              () => processor(typeEvents),
              this.config.processingTimeout
            );

            batchProcessed += result.processedCount;
            batchFailed += result.failedCount;
            allErrors.push(...result.errors);
          } catch (error) {
            console.error(`Error processing ${eventType} events:`, error);
            batchFailed += typeEvents.length;
            allErrors.push(error as Error);
          }
        }

        totalProcessed += batchProcessed;
        totalFailed += batchFailed;

        // If all events processed successfully, return
        if (batchFailed === 0) {
          return {
            success: true,
            processedCount: totalProcessed,
            failedCount: totalFailed,
            errors: allErrors
          };
        }

        // If some events failed, prepare for retry
        if (batchFailed > 0) {
          // Keep only the failed events for retry
          events = events.slice(-batchFailed);
        } else {
          events = [];
        }
        lastError = allErrors[allErrors.length - 1] || new Error('Unknown processing error');

      } catch (error) {
        lastError = error as Error;
        allErrors.push(lastError);
      }

      attempt++;
      
      if (attempt < this.config.maxRetries) {
        // Exponential backoff
        const delay = this.config.retryDelay * Math.pow(2, attempt - 1);
        
        this.emit('retryAttempt', { 
          attempt, 
          delay, 
          remainingEvents: events.length,
          error: lastError 
        });
        
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    // If we reach here, all retries failed
    if (this.config.enableDeadLetterQueue) {
      this.deadLetterQueue.push(...events);
      this.emit('eventsMovedToDeadLetter', { eventCount: events.length });
    }

    return {
      success: false,
      processedCount: totalProcessed,
      failedCount: totalFailed + events.length,
      errors: allErrors
    };
  }

  /**
   * Execute a function with timeout
   */
  private async executeWithTimeout<T>(
    fn: () => Promise<T>,
    timeoutMs: number
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Operation timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      fn()
        .then(result => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timer);
          reject(error);
        });
    });
  }

  /**
   * Group events by type for targeted processing
   */
  private groupEventsByType(events: UserEvent[]): Map<string, UserEvent[]> {
    const grouped = new Map<string, UserEvent[]>();

    for (const event of events) {
      const eventType = event.eventType;
      if (!grouped.has(eventType)) {
        grouped.set(eventType, []);
      }
      grouped.get(eventType)!.push(event);
    }

    return grouped;
  }

  /**
   * Validate event structure
   */
  private validateEvent(event: UserEvent): boolean {
    return !!(
      event &&
      event.eventId &&
      event.userId &&
      event.sessionId &&
      event.timestamp &&
      event.eventType
    );
  }

  /**
   * Update processing statistics
   */
  private updateProcessingStats(result: ProcessingResult, processingTime: number): void {
    this.processingStats.totalProcessed += result.processedCount;
    this.processingStats.totalFailed += result.failedCount;
    this.processingStats.lastProcessedAt = new Date();
    
    // Calculate moving average of processing time
    const alpha = 0.1; // Smoothing factor
    this.processingStats.averageProcessingTime = 
      (1 - alpha) * this.processingStats.averageProcessingTime + alpha * processingTime;
  }

  /**
   * Start the automatic flush timer
   */
  private startFlushTimer(): void {
    this.flushTimer = setInterval(async () => {
      if (!this.isProcessing && this.eventBuffer.length > 0) {
        try {
          await this.flush();
        } catch (error) {
          console.error('Error in automatic flush:', error);
          this.emit('automaticFlushError', { error });
        }
      }
    }, this.config.flushInterval);
  }

  /**
   * Get current buffer size
   */
  getBufferSize(): number {
    return this.eventBuffer.length;
  }

  /**
   * Get dead letter queue size
   */
  getDeadLetterQueueSize(): number {
    return this.deadLetterQueue.length;
  }

  /**
   * Get processing statistics
   */
  getProcessingStats(): typeof this.processingStats {
    return { ...this.processingStats };
  }

  /**
   * Get events from dead letter queue
   */
  getDeadLetterEvents(): UserEvent[] {
    return [...this.deadLetterQueue];
  }

  /**
   * Clear dead letter queue
   */
  clearDeadLetterQueue(): UserEvent[] {
    const events = [...this.deadLetterQueue];
    this.deadLetterQueue = [];
    this.emit('deadLetterQueueCleared', { eventCount: events.length });
    return events;
  }

  /**
   * Reprocess events from dead letter queue
   */
  async reprocessDeadLetterEvents(): Promise<ProcessingResult> {
    const events = this.clearDeadLetterQueue();
    if (events.length === 0) {
      return {
        success: true,
        processedCount: 0,
        failedCount: 0,
        errors: []
      };
    }

    this.emit('reprocessingDeadLetterEvents', { eventCount: events.length });
    return await this.processBatch(events);
  }

  /**
   * Check if processor is healthy
   */
  isHealthy(): boolean {
    return !this.isShuttingDown && 
           this.eventBuffer.length < this.config.maxBufferSize &&
           this.deadLetterQueue.length < this.config.maxBufferSize;
  }

  /**
   * Gracefully shutdown the stream processor
   */
  async shutdown(): Promise<void> {
    this.isShuttingDown = true;
    
    // Stop the flush timer
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }

    // Process remaining events
    if (this.eventBuffer.length > 0) {
      console.log(`Flushing ${this.eventBuffer.length} remaining events before shutdown`);
      await this.flush();
    }

    // Wait for any ongoing processing to complete
    while (this.isProcessing) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    this.emit('shutdown', { 
      finalStats: this.getProcessingStats(),
      deadLetterQueueSize: this.getDeadLetterQueueSize()
    });
  }
}
