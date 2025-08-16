import { describe, it, expect, beforeEach } from 'vitest';
import { 
  ResponseTracker, 
  InterventionResponse, 
  ConversionEvent,
  InterventionEffectivenessMetrics,
  ChannelConversionMetrics 
} from './response-tracker';

describe('ResponseTracker', () => {
  let tracker: ResponseTracker;
  let mockInterventionResponse: InterventionResponse;
  let mockConversionEvent: ConversionEvent;

  beforeEach(() => {
    tracker = new ResponseTracker();

    mockInterventionResponse = {
      interventionId: 'intervention123',
      userId: 'user123',
      channel: 'push',
      responseType: 'clicked',
      timestamp: new Date(),
      responseTime: 300000, // 5 minutes
      userSegment: '31-40',
      metadata: { source: 'test' }
    };

    mockConversionEvent = {
      userId: 'user123',
      fromChannel: 'phone',
      toChannel: 'app',
      taskType: 'claim_submission',
      timestamp: new Date(),
      conversionTime: 600000, // 10 minutes
      interventionId: 'intervention123'
    };
  });

  describe('recordInterventionResponse', () => {
    it('should record intervention response', () => {
      tracker.recordInterventionResponse(mockInterventionResponse);
      
      const metrics = tracker.measureInterventionEffectiveness('intervention123');
      expect(metrics.totalDeliveries).toBe(1);
      expect(metrics.totalResponses).toBe(1);
      expect(metrics.responseRate).toBe(1);
    });

    it('should handle multiple responses for same intervention', () => {
      const response1 = { ...mockInterventionResponse, userId: 'user1', responseType: 'clicked' as const };
      const response2 = { ...mockInterventionResponse, userId: 'user2', responseType: 'converted' as const };
      const response3 = { ...mockInterventionResponse, userId: 'user3', responseType: 'no_response' as const };

      tracker.recordInterventionResponse(response1);
      tracker.recordInterventionResponse(response2);
      tracker.recordInterventionResponse(response3);

      const metrics = tracker.measureInterventionEffectiveness('intervention123');
      expect(metrics.totalDeliveries).toBe(3);
      expect(metrics.totalResponses).toBe(2); // clicked + converted
      expect(metrics.responseRate).toBe(2/3);
      expect(metrics.conversionRate).toBe(1/3); // only converted
    });

    it('should update channel performance metrics', () => {
      tracker.recordInterventionResponse(mockInterventionResponse);
      
      const performanceMetrics = tracker.getPerformanceMetrics();
      expect(performanceMetrics.channelMetrics['push']).toBeDefined();
      expect(performanceMetrics.channelMetrics['push'].totalDeliveries).toBe(1);
      expect(performanceMetrics.channelMetrics['push'].totalResponses).toBe(1);
    });
  });

  describe('recordConversionEvent', () => {
    it('should record conversion event', () => {
      tracker.recordConversionEvent(mockConversionEvent);
      
      const conversionMetrics = tracker.measureChannelConversion('user123');
      expect(conversionMetrics.totalConversions).toBe(1);
      expect(conversionMetrics.phoneToDigitalConversions).toBe(1);
    });

    it('should track different conversion types', () => {
      const phoneConversion = { ...mockConversionEvent, fromChannel: 'phone' as const };
      const paperConversion = { ...mockConversionEvent, fromChannel: 'paper' as const, userId: 'user2' };

      tracker.recordConversionEvent(phoneConversion);
      tracker.recordConversionEvent(paperConversion);

      const metrics = tracker.measureChannelConversion();
      expect(metrics.totalConversions).toBe(2);
      expect(metrics.phoneToDigitalConversions).toBe(1);
      expect(metrics.paperToDigitalConversions).toBe(1);
    });

    it('should calculate cost savings', () => {
      const phoneConversion = { ...mockConversionEvent, fromChannel: 'phone' as const };
      const paperConversion = { ...mockConversionEvent, fromChannel: 'paper' as const, userId: 'user2' };

      tracker.recordConversionEvent(phoneConversion);
      tracker.recordConversionEvent(paperConversion);

      const metrics = tracker.measureChannelConversion();
      // Phone call saving: €8.50, Paper processing saving: €3.20
      expect(metrics.estimatedCostSavings).toBe(8.50 + 3.20);
    });
  });

  describe('measureInterventionEffectiveness', () => {
    it('should return empty metrics for non-existent intervention', () => {
      const metrics = tracker.measureInterventionEffectiveness('nonexistent');
      
      expect(metrics.interventionId).toBe('nonexistent');
      expect(metrics.totalDeliveries).toBe(0);
      expect(metrics.responseRate).toBe(0);
      expect(metrics.conversionRate).toBe(0);
      expect(metrics.effectivenessScore).toBe(0);
    });

    it('should calculate response and conversion rates correctly', () => {
      const responses = [
        { ...mockInterventionResponse, userId: 'user1', responseType: 'opened' as const },
        { ...mockInterventionResponse, userId: 'user2', responseType: 'clicked' as const },
        { ...mockInterventionResponse, userId: 'user3', responseType: 'converted' as const },
        { ...mockInterventionResponse, userId: 'user4', responseType: 'no_response' as const }
      ];

      responses.forEach(response => tracker.recordInterventionResponse(response));

      const metrics = tracker.measureInterventionEffectiveness('intervention123');
      expect(metrics.totalDeliveries).toBe(4);
      expect(metrics.totalResponses).toBe(3); // opened, clicked, converted
      expect(metrics.responseRate).toBe(0.75);
      expect(metrics.conversionRate).toBe(0.25); // only converted
    });

    it('should calculate average response time', () => {
      const responses = [
        { ...mockInterventionResponse, userId: 'user1', responseTime: 300000 }, // 5 minutes
        { ...mockInterventionResponse, userId: 'user2', responseTime: 600000 }, // 10 minutes
        { ...mockInterventionResponse, userId: 'user3', responseTime: 900000 }  // 15 minutes
      ];

      responses.forEach(response => tracker.recordInterventionResponse(response));

      const metrics = tracker.measureInterventionEffectiveness('intervention123');
      expect(metrics.averageResponseTime).toBe(600000); // 10 minutes average
    });

    it('should provide channel breakdown', () => {
      const responses = [
        { ...mockInterventionResponse, userId: 'user1', channel: 'push' as const, responseType: 'converted' as const },
        { ...mockInterventionResponse, userId: 'user2', channel: 'email' as const, responseType: 'clicked' as const },
        { ...mockInterventionResponse, userId: 'user3', channel: 'push' as const, responseType: 'no_response' as const }
      ];

      responses.forEach(response => tracker.recordInterventionResponse(response));

      const metrics = tracker.measureInterventionEffectiveness('intervention123');
      
      expect(metrics.channelBreakdown['push']).toBeDefined();
      expect(metrics.channelBreakdown['push'].deliveries).toBe(2);
      expect(metrics.channelBreakdown['push'].conversions).toBe(1);
      expect(metrics.channelBreakdown['push'].conversionRate).toBe(0.5);

      expect(metrics.channelBreakdown['email']).toBeDefined();
      expect(metrics.channelBreakdown['email'].deliveries).toBe(1);
      expect(metrics.channelBreakdown['email'].conversions).toBe(0);
    });

    it('should calculate effectiveness score', () => {
      const highPerformingResponses = [
        { ...mockInterventionResponse, userId: 'user1', responseType: 'converted' as const, responseTime: 60000 },
        { ...mockInterventionResponse, userId: 'user2', responseType: 'converted' as const, responseTime: 120000 }
      ];

      highPerformingResponses.forEach(response => tracker.recordInterventionResponse(response));

      const metrics = tracker.measureInterventionEffectiveness('intervention123');
      expect(metrics.effectivenessScore).toBeGreaterThan(0.5); // High conversion rate should give good score
    });
  });

  describe('measureChannelConversion', () => {
    it('should measure conversion for specific user', () => {
      const userConversions = [
        { ...mockConversionEvent, fromChannel: 'phone' as const },
        { ...mockConversionEvent, fromChannel: 'paper' as const, taskType: 'appointment_booking' }
      ];

      userConversions.forEach(conversion => tracker.recordConversionEvent(conversion));

      const metrics = tracker.measureChannelConversion('user123');
      expect(metrics.totalConversions).toBe(2);
      expect(metrics.phoneToDigitalConversions).toBe(1);
      expect(metrics.paperToDigitalConversions).toBe(1);
    });

    it('should measure overall conversion metrics', () => {
      const conversions = [
        { ...mockConversionEvent, userId: 'user1', fromChannel: 'phone' as const },
        { ...mockConversionEvent, userId: 'user2', fromChannel: 'paper' as const },
        { ...mockConversionEvent, userId: 'user3', fromChannel: 'phone' as const }
      ];

      conversions.forEach(conversion => tracker.recordConversionEvent(conversion));

      const metrics = tracker.measureChannelConversion();
      expect(metrics.totalConversions).toBe(3);
      expect(metrics.phoneToDigitalConversions).toBe(2);
      expect(metrics.paperToDigitalConversions).toBe(1);
    });

    it('should calculate recent conversions', () => {
      const now = new Date();
      const oldConversion = {
        ...mockConversionEvent,
        userId: 'user1',
        timestamp: new Date(now.getTime() - 40 * 24 * 60 * 60 * 1000) // 40 days ago
      };
      const recentConversion = {
        ...mockConversionEvent,
        userId: 'user2',
        timestamp: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000) // 10 days ago
      };

      tracker.recordConversionEvent(oldConversion);
      tracker.recordConversionEvent(recentConversion);

      const metrics = tracker.measureChannelConversion();
      expect(metrics.totalConversions).toBe(2);
      expect(metrics.recentConversions).toBe(1); // Only the recent one
    });

    it('should calculate average conversion time', () => {
      const conversions = [
        { ...mockConversionEvent, userId: 'user1', conversionTime: 300000 }, // 5 minutes
        { ...mockConversionEvent, userId: 'user2', conversionTime: 900000 }  // 15 minutes
      ];

      conversions.forEach(conversion => tracker.recordConversionEvent(conversion));

      const metrics = tracker.measureChannelConversion();
      expect(metrics.averageConversionTime).toBe(600000); // 10 minutes average
    });
  });

  describe('getPerformanceMetrics', () => {
    it('should provide comprehensive performance metrics', () => {
      // Add some responses across different channels
      const responses = [
        { ...mockInterventionResponse, channel: 'push' as const, responseType: 'converted' as const },
        { ...mockInterventionResponse, channel: 'email' as const, responseType: 'clicked' as const },
        { ...mockInterventionResponse, channel: 'sms' as const, responseType: 'opened' as const }
      ];

      responses.forEach(response => tracker.recordInterventionResponse(response));

      const metrics = tracker.getPerformanceMetrics();
      
      expect(metrics.totalDeliveries).toBe(3);
      expect(metrics.totalResponses).toBe(3);
      expect(metrics.totalConversions).toBe(1);
      expect(metrics.overallResponseRate).toBe(1);
      expect(metrics.overallConversionRate).toBe(1/3);
      
      expect(metrics.channelMetrics).toHaveProperty('push');
      expect(metrics.channelMetrics).toHaveProperty('email');
      expect(metrics.channelMetrics).toHaveProperty('sms');
    });

    it('should handle empty metrics gracefully', () => {
      const metrics = tracker.getPerformanceMetrics();
      
      expect(metrics.totalDeliveries).toBe(0);
      expect(metrics.overallResponseRate).toBe(0);
      expect(metrics.overallConversionRate).toBe(0);
      expect(Object.keys(metrics.channelMetrics)).toHaveLength(0);
    });
  });

  describe('generateAttributionReport', () => {
    it('should generate attribution report for time range', () => {
      const now = new Date();
      const start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); // 7 days ago
      const end = now;

      // Add responses within time range
      const responses = [
        { 
          ...mockInterventionResponse, 
          interventionId: 'intervention1',
          responseType: 'converted' as const,
          channel: 'push' as const,
          timestamp: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000) // 3 days ago
        },
        { 
          ...mockInterventionResponse, 
          interventionId: 'intervention2',
          responseType: 'converted' as const,
          channel: 'email' as const,
          timestamp: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000) // 1 day ago
        }
      ];

      responses.forEach(response => tracker.recordInterventionResponse(response));

      const report = tracker.generateAttributionReport({ start, end });
      
      expect(report.timeRange.start).toEqual(start);
      expect(report.timeRange.end).toEqual(end);
      expect(report.totalAttributedConversions).toBe(2);
      expect(report.channelAttribution['push']).toBe(0.5);
      expect(report.channelAttribution['email']).toBe(0.5);
    });

    it('should identify top performing interventions', () => {
      // Create interventions with different performance levels
      const highPerformingResponses = [
        { ...mockInterventionResponse, interventionId: 'high_perf', responseType: 'converted' as const },
        { ...mockInterventionResponse, interventionId: 'high_perf', responseType: 'converted' as const, userId: 'user2' }
      ];
      
      const lowPerformingResponses = [
        { ...mockInterventionResponse, interventionId: 'low_perf', responseType: 'no_response' as const, userId: 'user3' },
        { ...mockInterventionResponse, interventionId: 'low_perf', responseType: 'dismissed' as const, userId: 'user4' }
      ];

      [...highPerformingResponses, ...lowPerformingResponses].forEach(response => 
        tracker.recordInterventionResponse(response)
      );

      const now = new Date();
      const report = tracker.generateAttributionReport({
        start: new Date(now.getTime() - 24 * 60 * 60 * 1000),
        end: now
      });

      expect(report.topPerformingInterventions).toHaveLength(2);
      expect(report.topPerformingInterventions[0].interventionId).toBe('high_perf');
      expect(report.topPerformingInterventions[0].effectivenessScore).toBeGreaterThan(
        report.topPerformingInterventions[1].effectivenessScore
      );
    });

    it('should analyze conversions by time of day', () => {
      const morningResponse = {
        ...mockInterventionResponse,
        responseType: 'converted' as const,
        timestamp: new Date(2024, 0, 1, 9, 0, 0) // 9 AM
      };
      
      const eveningResponse = {
        ...mockInterventionResponse,
        responseType: 'converted' as const,
        userId: 'user2',
        timestamp: new Date(2024, 0, 1, 18, 0, 0) // 6 PM
      };

      tracker.recordInterventionResponse(morningResponse);
      tracker.recordInterventionResponse(eveningResponse);

      const report = tracker.generateAttributionReport({
        start: new Date(2024, 0, 1),
        end: new Date(2024, 0, 2)
      });

      expect(report.conversionsByTimeOfDay[9]).toBe(1);
      expect(report.conversionsByTimeOfDay[18]).toBe(1);
      expect(report.conversionsByTimeOfDay[12]).toBe(0); // No conversions at noon
    });

    it('should analyze user segment performance', () => {
      const youngUserResponse = {
        ...mockInterventionResponse,
        responseType: 'converted' as const,
        userSegment: '22-30'
      };
      
      const olderUserResponse = {
        ...mockInterventionResponse,
        responseType: 'clicked' as const,
        userSegment: '56-65',
        userId: 'user2'
      };

      tracker.recordInterventionResponse(youngUserResponse);
      tracker.recordInterventionResponse(olderUserResponse);

      const now = new Date();
      const report = tracker.generateAttributionReport({
        start: new Date(now.getTime() - 24 * 60 * 60 * 1000),
        end: now
      });

      expect(report.userSegmentPerformance['22-30']).toBeDefined();
      expect(report.userSegmentPerformance['22-30'].conversionRate).toBe(1);
      expect(report.userSegmentPerformance['56-65']).toBeDefined();
      expect(report.userSegmentPerformance['56-65'].conversionRate).toBe(0);
    });
  });

  describe('edge cases', () => {
    it('should handle responses without response time', () => {
      const responseWithoutTime = {
        ...mockInterventionResponse,
        responseTime: undefined
      };

      tracker.recordInterventionResponse(responseWithoutTime);

      const metrics = tracker.measureInterventionEffectiveness('intervention123');
      expect(metrics.averageResponseTime).toBe(0);
    });

    it('should handle conversions without conversion time', () => {
      const conversionWithoutTime = {
        ...mockConversionEvent,
        conversionTime: undefined
      };

      tracker.recordConversionEvent(conversionWithoutTime);

      const metrics = tracker.measureChannelConversion();
      expect(metrics.averageConversionTime).toBe(0);
    });

    it('should handle responses without user segment', () => {
      const responseWithoutSegment = {
        ...mockInterventionResponse,
        userSegment: undefined
      };

      tracker.recordInterventionResponse(responseWithoutSegment);

      const now = new Date();
      const report = tracker.generateAttributionReport({
        start: new Date(now.getTime() - 24 * 60 * 60 * 1000),
        end: now
      });

      expect(report.userSegmentPerformance['unknown']).toBeDefined();
    });
  });
});