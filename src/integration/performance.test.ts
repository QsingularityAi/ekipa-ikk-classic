import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { EventCollector, EventCollectorConfig } from '../analytics/event-collector';
import { StreamProcessor } from '../analytics/stream-processor';
import { UserSegmentationEngine } from '../engagement/user-segmentation-engine';
import { RecommendationEngine } from '../engagement/recommendation-engine';
import { InterventionOrchestrator } from '../engagement/intervention-orchestrator';
import { ContentPersonalizer } from '../engagement/content-personalizer';
import { ConsentManager } from '../compliance/consent-manager';
import { DataAnonymizer } from '../compliance/data-anonymizer';
import { PushNotificationHandler } from '../engagement/delivery/push-notification-handler';
import { InAppNotificationHandler } from '../engagement/delivery/in-app-notification-handler';
import { SMSHandler } from '../engagement/delivery/sms-handler';
import { EmailHandler } from '../engagement/delivery/email-handler';
import { ResponseTracker } from '../engagement/response-tracker';
import { UserEvent, UserProfile, InterventionStrategy } from '../types';

/**
 * Performance and Load Testing Suite
 * Requirements: 1.1, 2.2, 4.4 - Test system scalability and latency requirements
 */
describe('Performance and Load Testing', () => {
  let eventCollector: EventCollector;
  let streamProcessor: StreamProcessor;
  let userSegmentationEngine: UserSegmentationEngine;
  let recommendationEngine: RecommendationEngine;
  let interventionOrchestrator: InterventionOrchestrator;
  let contentPersonalizer: ContentPersonalizer;
  let consentManager: ConsentManager;
  let dataAnonymizer: DataAnonymizer;
  let responseTracker: ResponseTracker;
  
  // Delivery handlers
  let pushHandler: PushNotificationHandler;
  let inAppHandler: InAppNotificationHandler;
  let smsHandler: SMSHandler;
  let emailHandler: EmailHandler;

  beforeEach(async () => {
    // Initialize components with performance-optimized configurations
    consentManager = new ConsentManager({
      consentVersion: '1.0',
      retentionPeriod: 365,
      auditLogEnabled: true
    });

    dataAnonymizer = new DataAnonymizer({
      hashSalt: 'test-salt',
      pseudonymizationKey: 'test-key',
      retentionPolicies: {
        analytics: 365,
        personalization: 180,
        marketing: 90
      }
    });

    const eventCollectorConfig: EventCollectorConfig = {
      apiEndpoint: 'http://localhost:3000/events',
      batchSize: 100, // Larger batch size for performance
      flushInterval: 1000, // Faster flush for load testing
      retryAttempts: 3,
      enableValidation: true,
      enableSanitization: true
    };

    eventCollector = new EventCollector(eventCollectorConfig, consentManager, dataAnonymizer);

    streamProcessor = new StreamProcessor({
      batchSize: 500, // Larger batch size for high throughput
      flushInterval: 1000,
      maxRetries: 3,
      retryDelay: 500,
      maxBufferSize: 5000, // Larger buffer for load testing
      enableDeadLetterQueue: true,
      processingTimeout: 10000
    });

    userSegmentationEngine = new UserSegmentationEngine({
      segmentationRules: [],
      refreshInterval: 3600000,
      minSegmentSize: 10
    });

    recommendationEngine = new RecommendationEngine(userSegmentationEngine);

    interventionOrchestrator = new InterventionOrchestrator({
      channels: {
        push: true,
        inApp: true,
        sms: true,
        email: true
      },
      rateLimits: {
        perUser: 10, // Higher rate limits for load testing
        perHour: 20
      }
    });

    contentPersonalizer = new ContentPersonalizer({
      templates: new Map(),
      accessibilityEnabled: true,
      multiLanguageSupport: false
    });

    responseTracker = new ResponseTracker({
      trackingWindow: 24 * 60 * 60 * 1000,
      conversionEvents: ['task_completion', 'feature_usage'],
      attributionModel: 'last_click'
    });

    // Initialize delivery handlers
    pushHandler = new PushNotificationHandler({
      apiKey: 'test-push-key',
      endpoint: 'https://fcm.googleapis.com/fcm/send',
      retryAttempts: 3
    });

    inAppHandler = new InAppNotificationHandler({
      maxActiveNotifications: 10, // Higher limit for load testing
      displayDuration: 5000,
      priority: 'normal'
    });

    smsHandler = new SMSHandler({
      apiKey: 'test-sms-key',
      endpoint: 'https://api.twilio.com/2010-04-01/Accounts/test/Messages.json',
      fromNumber: '+1234567890',
      retryAttempts: 3
    });

    emailHandler = new EmailHandler({
      apiKey: 'test-email-key',
      endpoint: 'https://api.sendgrid.com/v3/mail/send',
      fromEmail: 'noreply@ikk-classic.de',
      retryAttempts: 3
    });
  });

  afterEach(async () => {
    await eventCollector.stop();
  });

  /**
   * Test high-volume event processing performance
   * Requirements: 1.1 - Test system behavior under varying user loads
   */
  it('should handle high-volume event processing within latency requirements', async () => {
    const eventCount = 1000;
    const maxLatencyMs = 5000; // 5 second max latency requirement
    const events: UserEvent[] = [];

    // Generate test events
    for (let i = 0; i < eventCount; i++) {
      const userId = `load_test_user_${i % 100}`; // 100 unique users
      
      // Grant consent for each user (only once per user)
      if (i < 100) {
        await consentManager.collectConsent(userId, 'analytics', true);
        await consentManager.collectConsent(userId, 'personalization', true);
      }

      events.push({
        eventId: `load_test_event_${i}`,
        userId,
        sessionId: `session_${Math.floor(i / 10)}`,
        timestamp: new Date(Date.now() + i * 10), // Spread events over time
        eventType: i % 4 === 0 ? 'page_view' : 
                  i % 4 === 1 ? 'feature_usage' : 
                  i % 4 === 2 ? 'task_completion' : 'abandonment',
        metadata: {
          screenName: `screen_${i % 10}`,
          featureId: `feature_${i % 5}`,
          duration: Math.floor(Math.random() * 30000) + 1000,
          success: Math.random() > 0.3 // 70% success rate
        },
        userContext: {
          ageGroup: ['22-30', '31-40', '41-55', '56-65', '66+'][i % 5] as any,
          digitalLiteracyScore: Math.floor(Math.random() * 100),
          preferredChannel: ['push', 'sms', 'email', 'in_app'][i % 4]
        }
      });
    }

    // Measure event collection performance
    const collectionStartTime = Date.now();
    
    const collectionPromises = events.map(event => eventCollector.collectEvent(event));
    const collectionResults = await Promise.all(collectionPromises);
    
    const collectionEndTime = Date.now();
    const collectionLatency = collectionEndTime - collectionStartTime;

    // Verify all events were collected successfully
    const successfulCollections = collectionResults.filter(result => result === true).length;
    expect(successfulCollections).toBeGreaterThan(eventCount * 0.95); // At least 95% success rate

    // Verify collection latency is within requirements
    expect(collectionLatency).toBeLessThan(maxLatencyMs);
    console.log(`Event collection: ${eventCount} events in ${collectionLatency}ms (${(eventCount / collectionLatency * 1000).toFixed(2)} events/sec)`);

    // Measure stream processing performance
    const processingStartTime = Date.now();
    
    await streamProcessor.processEvents(events);
    
    const processingEndTime = Date.now();
    const processingLatency = processingEndTime - processingStartTime;

    // Verify processing latency is within requirements
    expect(processingLatency).toBeLessThan(maxLatencyMs);
    console.log(`Stream processing: ${eventCount} events in ${processingLatency}ms (${(eventCount / processingLatency * 1000).toFixed(2)} events/sec)`);
  }, 30000); // 30 second timeout for load test

  /**
   * Test real-time intervention delivery performance
   * Requirements: 2.2 - Validate latency requirements for real-time personalization and delivery
   */
  it('should deliver interventions within real-time latency requirements', async () => {
    const userCount = 100;
    const maxDeliveryLatencyMs = 2000; // 2 second max latency for real-time delivery
    const users: UserProfile[] = [];

    // Create test user profiles
    for (let i = 0; i < userCount; i++) {
      const userId = `perf_test_user_${i}`;
      
      // Grant consent
      await consentManager.collectConsent(userId, 'analytics', true);
      await consentManager.collectConsent(userId, 'personalization', true);

      users.push({
        userId,
        demographics: {
          ageGroup: ['22-30', '31-40', '41-55', '56-65', '66+'][i % 5] as any,
          registrationDate: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000),
          lastActiveDate: new Date()
        },
        engagementMetrics: {
          totalSessions: Math.floor(Math.random() * 50) + 1,
          averageSessionDuration: Math.floor(Math.random() * 600) + 60,
          featuresUsed: [`feature_${i % 3}`, `feature_${(i + 1) % 3}`],
          digitalTasksCompleted: Math.floor(Math.random() * 20),
          traditionalChannelUsage: {
            phoneCallsLastMonth: Math.floor(Math.random() * 10),
            paperFormsLastMonth: Math.floor(Math.random() * 5)
          }
        },
        preferences: {
          communicationChannels: [['push', 'in_app'], ['sms', 'email'], ['email', 'in_app']][i % 3],
          notificationFrequency: ['high', 'medium', 'low'][i % 3] as any,
          contentComplexity: ['simple', 'detailed'][i % 2] as any
        },
        consentStatus: []
      });
    }

    // Test intervention generation and delivery performance
    const deliveryStartTime = Date.now();
    const deliveryPromises: Promise<any>[] = [];

    for (const user of users) {
      const deliveryPromise = (async () => {
        // Segment user
        const userSegment = userSegmentationEngine.segmentUser(user);
        if (!userSegment) return null;

        // Create trigger event
        const triggerEvent: UserEvent = {
          eventId: `trigger_${user.userId}`,
          userId: user.userId,
          sessionId: `session_${user.userId}`,
          timestamp: new Date(),
          eventType: 'page_view',
          metadata: {
            screenName: 'dashboard',
            duration: 5000
          },
          userContext: {
            ageGroup: user.demographics.ageGroup,
            digitalLiteracyScore: 70,
            preferredChannel: user.preferences.communicationChannels[0]
          }
        };

        // Generate intervention strategy
        const strategy = recommendationEngine.getStrategyForTrigger(user, triggerEvent);
        if (!strategy) return null;

        // Personalize content
        const personalizedContent = await contentPersonalizer.personalizeContent(
          strategy.content,
          user
        );

        // Orchestrate delivery
        const deliveryRequest = await interventionOrchestrator.orchestrateIntervention(
          user.userId,
          user,
          strategy,
          personalizedContent
        );

        if (!deliveryRequest) return null;

        // Deliver intervention
        let deliveryResult;
        switch (deliveryRequest.channel) {
          case 'push':
            deliveryResult = await pushHandler.deliver(deliveryRequest);
            break;
          case 'in_app':
            deliveryResult = await inAppHandler.deliver(deliveryRequest);
            break;
          case 'sms':
            deliveryResult = await smsHandler.deliver(deliveryRequest);
            break;
          case 'email':
            deliveryResult = await emailHandler.deliver(deliveryRequest);
            break;
          default:
            return null;
        }

        return deliveryResult;
      })();

      deliveryPromises.push(deliveryPromise);
    }

    const deliveryResults = await Promise.all(deliveryPromises);
    const deliveryEndTime = Date.now();
    const totalDeliveryLatency = deliveryEndTime - deliveryStartTime;

    // Verify delivery performance
    const successfulDeliveries = deliveryResults.filter(result => result && result.success).length;
    expect(successfulDeliveries).toBeGreaterThan(userCount * 0.8); // At least 80% success rate

    // Verify average delivery latency per user is within requirements
    const averageLatencyPerUser = totalDeliveryLatency / userCount;
    expect(averageLatencyPerUser).toBeLessThan(maxDeliveryLatencyMs);

    console.log(`Intervention delivery: ${userCount} users in ${totalDeliveryLatency}ms (avg ${averageLatencyPerUser.toFixed(2)}ms per user)`);
    console.log(`Successful deliveries: ${successfulDeliveries}/${userCount} (${(successfulDeliveries/userCount*100).toFixed(1)}%)`);
  }, 30000); // 30 second timeout

  /**
   * Test system scalability under varying user loads
   * Requirements: 1.1, 4.4 - Test system scalability under varying user loads and engagement patterns
   */
  it('should maintain performance across different load levels', async () => {
    const loadLevels = [10, 50, 100, 200]; // Different user load levels
    const maxLatencyIncrease = 3; // Max 3x latency increase from baseline
    let baselineLatency = 0;

    for (const userCount of loadLevels) {
      console.log(`Testing load level: ${userCount} users`);
      
      const startTime = Date.now();
      const promises: Promise<any>[] = [];

      // Generate concurrent user sessions
      for (let i = 0; i < userCount; i++) {
        const userId = `scale_test_user_${i}`;
        
        const sessionPromise = (async () => {
          // Grant consent
          await consentManager.collectConsent(userId, 'analytics', true);
          
          // Generate multiple events per user
          const events: UserEvent[] = [];
          for (let j = 0; j < 5; j++) {
            events.push({
              eventId: `scale_event_${i}_${j}`,
              userId,
              sessionId: `scale_session_${i}`,
              timestamp: new Date(Date.now() + j * 1000),
              eventType: ['page_view', 'feature_usage', 'task_completion'][j % 3] as any,
              metadata: {
                screenName: `screen_${j}`,
                duration: Math.random() * 10000 + 1000,
                success: Math.random() > 0.2
              },
              userContext: {
                ageGroup: '31-40',
                digitalLiteracyScore: 60,
                preferredChannel: 'email'
              }
            });
          }

          // Collect events
          const collectionPromises = events.map(event => eventCollector.collectEvent(event));
          await Promise.all(collectionPromises);

          // Process events
          await streamProcessor.processEvents(events);

          return true;
        })();

        promises.push(sessionPromise);
      }

      // Wait for all sessions to complete
      const results = await Promise.all(promises);
      const endTime = Date.now();
      const latency = endTime - startTime;

      // Verify all sessions completed successfully
      const successfulSessions = results.filter(result => result === true).length;
      expect(successfulSessions).toBe(userCount);

      // Record baseline latency for comparison
      if (userCount === loadLevels[0]) {
        baselineLatency = latency;
      }

      // Verify latency doesn't increase excessively with load
      if (baselineLatency > 0) {
        const latencyIncrease = latency / baselineLatency;
        expect(latencyIncrease).toBeLessThan(maxLatencyIncrease);
      }

      console.log(`Load ${userCount}: ${latency}ms total, ${(latency/userCount).toFixed(2)}ms per user`);
    }
  }, 60000); // 60 second timeout for scalability test

  /**
   * Test memory usage and resource optimization
   * Requirements: 4.4 - Monitor and optimize resource usage
   */
  it('should maintain reasonable memory usage under load', async () => {
    const initialMemory = process.memoryUsage();
    const eventCount = 5000;
    const maxMemoryIncreaseMB = 100; // Max 100MB memory increase

    // Generate and process large number of events
    const events: UserEvent[] = [];
    for (let i = 0; i < eventCount; i++) {
      const userId = `memory_test_user_${i % 50}`; // 50 unique users
      
      if (i < 50) {
        await consentManager.collectConsent(userId, 'analytics', true);
      }

      events.push({
        eventId: `memory_test_event_${i}`,
        userId,
        sessionId: `memory_session_${Math.floor(i / 100)}`,
        timestamp: new Date(),
        eventType: 'page_view',
        metadata: {
          screenName: 'dashboard',
          duration: 5000
        },
        userContext: {
          ageGroup: '31-40',
          digitalLiteracyScore: 60,
          preferredChannel: 'email'
        }
      });
    }

    // Process events in batches to simulate real-world usage
    const batchSize = 500;
    for (let i = 0; i < events.length; i += batchSize) {
      const batch = events.slice(i, i + batchSize);
      
      // Collect events
      const collectionPromises = batch.map(event => eventCollector.collectEvent(event));
      await Promise.all(collectionPromises);
      
      // Process events
      await streamProcessor.processEvents(batch);
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }
    }

    const finalMemory = process.memoryUsage();
    const memoryIncreaseMB = (finalMemory.heapUsed - initialMemory.heapUsed) / 1024 / 1024;

    console.log(`Memory usage: Initial ${(initialMemory.heapUsed / 1024 / 1024).toFixed(2)}MB, Final ${(finalMemory.heapUsed / 1024 / 1024).toFixed(2)}MB`);
    console.log(`Memory increase: ${memoryIncreaseMB.toFixed(2)}MB for ${eventCount} events`);

    // Verify memory usage is within acceptable limits
    expect(memoryIncreaseMB).toBeLessThan(maxMemoryIncreaseMB);
  }, 45000); // 45 second timeout

  /**
   * Test concurrent user engagement patterns
   * Requirements: 1.1, 2.2 - Test system behavior with realistic concurrent usage patterns
   */
  it('should handle concurrent user engagement patterns efficiently', async () => {
    const concurrentUsers = 50;
    const sessionsPerUser = 3;
    const eventsPerSession = 10;
    const maxConcurrentLatency = 10000; // 10 second max for concurrent operations

    const startTime = Date.now();
    const userPromises: Promise<any>[] = [];

    // Simulate concurrent user engagement
    for (let userId = 0; userId < concurrentUsers; userId++) {
      const userPromise = (async () => {
        const userIdStr = `concurrent_user_${userId}`;
        
        // Grant consent
        await consentManager.collectConsent(userIdStr, 'analytics', true);
        await consentManager.collectConsent(userIdStr, 'personalization', true);

        // Create user profile
        const userProfile: UserProfile = {
          userId: userIdStr,
          demographics: {
            ageGroup: ['22-30', '31-40', '41-55'][userId % 3] as any,
            registrationDate: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000),
            lastActiveDate: new Date()
          },
          engagementMetrics: {
            totalSessions: Math.floor(Math.random() * 20) + 5,
            averageSessionDuration: Math.floor(Math.random() * 300) + 120,
            featuresUsed: [`feature_${userId % 5}`, `feature_${(userId + 1) % 5}`],
            digitalTasksCompleted: Math.floor(Math.random() * 15),
            traditionalChannelUsage: {
              phoneCallsLastMonth: Math.floor(Math.random() * 5),
              paperFormsLastMonth: Math.floor(Math.random() * 3)
            }
          },
          preferences: {
            communicationChannels: [['push'], ['email'], ['sms']][userId % 3],
            notificationFrequency: 'medium',
            contentComplexity: 'detailed'
          },
          consentStatus: []
        };

        // Simulate multiple sessions per user
        for (let session = 0; session < sessionsPerUser; session++) {
          const sessionId = `concurrent_session_${userId}_${session}`;
          const sessionEvents: UserEvent[] = [];

          // Generate events for this session
          for (let event = 0; event < eventsPerSession; event++) {
            sessionEvents.push({
              eventId: `concurrent_event_${userId}_${session}_${event}`,
              userId: userIdStr,
              sessionId,
              timestamp: new Date(Date.now() + session * 60000 + event * 5000),
              eventType: ['page_view', 'feature_usage', 'task_completion', 'abandonment'][event % 4] as any,
              metadata: {
                screenName: `screen_${event % 5}`,
                featureId: `feature_${event % 3}`,
                duration: Math.random() * 20000 + 2000,
                success: Math.random() > 0.25
              },
              userContext: {
                ageGroup: userProfile.demographics.ageGroup,
                digitalLiteracyScore: Math.floor(Math.random() * 100),
                preferredChannel: userProfile.preferences.communicationChannels[0]
              }
            });
          }

          // Process session events
          const eventPromises = sessionEvents.map(event => eventCollector.collectEvent(event));
          await Promise.all(eventPromises);
          await streamProcessor.processEvents(sessionEvents);

          // Generate intervention for some sessions
          if (session % 2 === 0) {
            const triggerEvent = sessionEvents.find(e => e.eventType === 'page_view');
            if (triggerEvent) {
              const strategy = recommendationEngine.getStrategyForTrigger(userProfile, triggerEvent);
              if (strategy) {
                const personalizedContent = await contentPersonalizer.personalizeContent(
                  strategy.content,
                  userProfile
                );
                
                const deliveryRequest = await interventionOrchestrator.orchestrateIntervention(
                  userIdStr,
                  userProfile,
                  strategy,
                  personalizedContent
                );

                if (deliveryRequest) {
                  await inAppHandler.deliver(deliveryRequest);
                }
              }
            }
          }
        }

        return userIdStr;
      })();

      userPromises.push(userPromise);
    }

    // Wait for all concurrent users to complete
    const completedUsers = await Promise.all(userPromises);
    const endTime = Date.now();
    const totalLatency = endTime - startTime;

    // Verify all users completed successfully
    expect(completedUsers.length).toBe(concurrentUsers);

    // Verify concurrent processing latency is within requirements
    expect(totalLatency).toBeLessThan(maxConcurrentLatency);

    const totalEvents = concurrentUsers * sessionsPerUser * eventsPerSession;
    console.log(`Concurrent processing: ${concurrentUsers} users, ${totalEvents} events in ${totalLatency}ms`);
    console.log(`Throughput: ${(totalEvents / totalLatency * 1000).toFixed(2)} events/sec`);
  }, 60000); // 60 second timeout
});