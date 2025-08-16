import { describe, it, expect, beforeEach } from 'vitest';
import { ABTestManager, ABTestExperiment, ABTestVariant } from './ab-test-manager';
import { InterventionStrategy } from '../types';

describe('ABTestManager', () => {
  let abTestManager: ABTestManager;
  let mockInterventionStrategy: InterventionStrategy;

  beforeEach(() => {
    abTestManager = new ABTestManager();
    mockInterventionStrategy = {
      strategyId: 'strategy_1',
      type: 'nudge',
      trigger: {
        eventType: 'page_view',
        conditions: { screenName: 'dashboard' },
      },
      content: {
        title: 'Test Title',
        message: 'Test Message',
      },
      channels: ['push'],
      timing: {
        delay: 0,
      },
    };
  });

  describe('createExperiment', () => {
    it('should create a valid A/B test experiment', () => {
      const experimentConfig = {
        name: 'Test Experiment',
        description: 'Testing nudge effectiveness',
        status: 'draft' as const,
        startDate: new Date(),
        endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
        targetSegments: ['segment_1'],
        variants: [
          {
            variantId: 'control',
            name: 'Control',
            trafficSplit: 50,
            interventionStrategy: mockInterventionStrategy,
            isControl: true,
          },
          {
            variantId: 'variant_a',
            name: 'Variant A',
            trafficSplit: 50,
            interventionStrategy: { ...mockInterventionStrategy, strategyId: 'strategy_2' },
            isControl: false,
          },
        ] as ABTestVariant[],
        trafficAllocation: 100,
        successMetric: 'conversion_rate' as const,
        minimumSampleSize: 100,
        confidenceLevel: 0.95,
        statisticalPower: 0.8,
      };

      const experiment = abTestManager.createExperiment(experimentConfig);

      expect(experiment).toBeDefined();
      expect(experiment.experimentId).toMatch(/^exp_\d+_[a-z0-9]+$/);
      expect(experiment.name).toBe('Test Experiment');
      expect(experiment.variants).toHaveLength(2);
    });

    it('should throw error when traffic splits do not sum to 100', () => {
      const experimentConfig = {
        name: 'Invalid Experiment',
        description: 'Testing invalid traffic split',
        status: 'draft' as const,
        startDate: new Date(),
        endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        targetSegments: ['segment_1'],
        variants: [
          {
            variantId: 'control',
            name: 'Control',
            trafficSplit: 40, // Invalid: doesn't sum to 100
            interventionStrategy: mockInterventionStrategy,
            isControl: true,
          },
          {
            variantId: 'variant_a',
            name: 'Variant A',
            trafficSplit: 50, // Invalid: doesn't sum to 100
            interventionStrategy: mockInterventionStrategy,
            isControl: false,
          },
        ] as ABTestVariant[],
        trafficAllocation: 100,
        successMetric: 'conversion_rate' as const,
        minimumSampleSize: 100,
        confidenceLevel: 0.95,
        statisticalPower: 0.8,
      };

      expect(() => abTestManager.createExperiment(experimentConfig)).toThrow(
        'Variant traffic splits must sum to 100%'
      );
    });

    it('should throw error when no control variant is specified', () => {
      const experimentConfig = {
        name: 'No Control Experiment',
        description: 'Testing without control',
        status: 'draft' as const,
        startDate: new Date(),
        endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        targetSegments: ['segment_1'],
        variants: [
          {
            variantId: 'variant_a',
            name: 'Variant A',
            trafficSplit: 50,
            interventionStrategy: mockInterventionStrategy,
            isControl: false, // No control variant
          },
          {
            variantId: 'variant_b',
            name: 'Variant B',
            trafficSplit: 50,
            interventionStrategy: mockInterventionStrategy,
            isControl: false, // No control variant
          },
        ] as ABTestVariant[],
        trafficAllocation: 100,
        successMetric: 'conversion_rate' as const,
        minimumSampleSize: 100,
        confidenceLevel: 0.95,
        statisticalPower: 0.8,
      };

      expect(() => abTestManager.createExperiment(experimentConfig)).toThrow(
        'Experiment must have at least one control variant'
      );
    });

    it('should throw error for invalid confidence level', () => {
      const experimentConfig = {
        name: 'Invalid Confidence Experiment',
        description: 'Testing invalid confidence level',
        status: 'draft' as const,
        startDate: new Date(),
        endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        targetSegments: ['segment_1'],
        variants: [
          {
            variantId: 'control',
            name: 'Control',
            trafficSplit: 100,
            interventionStrategy: mockInterventionStrategy,
            isControl: true,
          },
        ] as ABTestVariant[],
        trafficAllocation: 100,
        successMetric: 'conversion_rate' as const,
        minimumSampleSize: 100,
        confidenceLevel: 1.5, // Invalid: > 1
        statisticalPower: 0.8,
      };

      expect(() => abTestManager.createExperiment(experimentConfig)).toThrow(
        'Confidence level must be between 0 and 1'
      );
    });
  });

  describe('assignUserToExperiment', () => {
    let experiment: ABTestExperiment;

    beforeEach(() => {
      experiment = abTestManager.createExperiment({
        name: 'Assignment Test',
        description: 'Testing user assignment',
        status: 'active',
        startDate: new Date(),
        endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        targetSegments: ['segment_1'],
        variants: [
          {
            variantId: 'control',
            name: 'Control',
            trafficSplit: 50,
            interventionStrategy: mockInterventionStrategy,
            isControl: true,
          },
          {
            variantId: 'variant_a',
            name: 'Variant A',
            trafficSplit: 50,
            interventionStrategy: mockInterventionStrategy,
            isControl: false,
          },
        ] as ABTestVariant[],
        trafficAllocation: 100,
        successMetric: 'conversion_rate' as const,
        minimumSampleSize: 100,
        confidenceLevel: 0.95,
        statisticalPower: 0.8,
      });
    });

    it('should assign user to experiment variant', () => {
      const userId = 'user_123';
      const assignment = abTestManager.assignUserToExperiment(userId, experiment.experimentId);

      expect(assignment).toBeDefined();
      expect(assignment!.userId).toBe(userId);
      expect(assignment!.experimentId).toBe(experiment.experimentId);
      expect(['control', 'variant_a']).toContain(assignment!.variantId);
      expect(assignment!.assignedAt).toBeInstanceOf(Date);
    });

    it('should return same assignment for repeated calls', () => {
      const userId = 'user_123';
      const assignment1 = abTestManager.assignUserToExperiment(userId, experiment.experimentId);
      const assignment2 = abTestManager.assignUserToExperiment(userId, experiment.experimentId);

      expect(assignment1).toEqual(assignment2);
    });

    it('should return null for inactive experiment', () => {
      abTestManager.updateExperimentStatus(experiment.experimentId, 'paused');
      const userId = 'user_123';
      const assignment = abTestManager.assignUserToExperiment(userId, experiment.experimentId);

      expect(assignment).toBeNull();
    });

    it('should return null for non-existent experiment', () => {
      const userId = 'user_123';
      const assignment = abTestManager.assignUserToExperiment(userId, 'non_existent_experiment');

      expect(assignment).toBeNull();
    });

    it('should consistently assign users to same variant', () => {
      const userId = 'consistent_user';
      const assignments = [];
      
      // Assign same user multiple times
      for (let i = 0; i < 10; i++) {
        const assignment = abTestManager.assignUserToExperiment(userId, experiment.experimentId);
        assignments.push(assignment?.variantId);
      }

      // All assignments should be the same
      const uniqueVariants = new Set(assignments);
      expect(uniqueVariants.size).toBe(1);
    });
  });

  describe('recordConversion', () => {
    let experiment: ABTestExperiment;

    beforeEach(() => {
      experiment = abTestManager.createExperiment({
        name: 'Conversion Test',
        description: 'Testing conversion recording',
        status: 'active',
        startDate: new Date(),
        endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        targetSegments: ['segment_1'],
        variants: [
          {
            variantId: 'control',
            name: 'Control',
            trafficSplit: 100,
            interventionStrategy: mockInterventionStrategy,
            isControl: true,
          },
        ] as ABTestVariant[],
        trafficAllocation: 100,
        successMetric: 'conversion_rate' as const,
        minimumSampleSize: 100,
        confidenceLevel: 0.95,
        statisticalPower: 0.8,
      });
    });

    it('should record conversion for assigned user', () => {
      const userId = 'user_123';
      
      // Assign user first
      abTestManager.assignUserToExperiment(userId, experiment.experimentId);
      
      // Record conversion
      abTestManager.recordConversion(userId, experiment.experimentId);
      
      // Verify conversion was recorded
      const results = abTestManager.calculateResults(experiment.experimentId);
      expect(results).toBeDefined();
      expect(results!.variantResults[0].conversions).toBe(1);
    });

    it('should not record conversion for unassigned user', () => {
      const userId = 'unassigned_user';
      
      // Record conversion without assignment
      abTestManager.recordConversion(userId, experiment.experimentId);
      
      // Verify no conversion was recorded
      const results = abTestManager.calculateResults(experiment.experimentId);
      expect(results!.variantResults[0].conversions).toBe(0);
    });

    it('should handle multiple conversions for same user', () => {
      const userId = 'user_123';
      
      // Assign user first
      abTestManager.assignUserToExperiment(userId, experiment.experimentId);
      
      // Record multiple conversions
      abTestManager.recordConversion(userId, experiment.experimentId);
      abTestManager.recordConversion(userId, experiment.experimentId);
      
      // Verify both conversions were recorded
      const results = abTestManager.calculateResults(experiment.experimentId);
      expect(results!.variantResults[0].conversions).toBe(2);
    });
  });

  describe('calculateResults', () => {
    let experiment: ABTestExperiment;

    beforeEach(() => {
      experiment = abTestManager.createExperiment({
        name: 'Results Test',
        description: 'Testing results calculation',
        status: 'active',
        startDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
        endDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // 2 days from now
        targetSegments: ['segment_1'],
        variants: [
          {
            variantId: 'control',
            name: 'Control',
            trafficSplit: 50,
            interventionStrategy: mockInterventionStrategy,
            isControl: true,
          },
          {
            variantId: 'variant_a',
            name: 'Variant A',
            trafficSplit: 50,
            interventionStrategy: mockInterventionStrategy,
            isControl: false,
          },
        ] as ABTestVariant[],
        trafficAllocation: 100,
        successMetric: 'conversion_rate' as const,
        minimumSampleSize: 10,
        confidenceLevel: 0.95,
        statisticalPower: 0.8,
      });
    });

    it('should calculate results with proper statistics', () => {
      // Assign users and record conversions
      const users = ['user_1', 'user_2', 'user_3', 'user_4', 'user_5'];
      users.forEach(userId => {
        abTestManager.assignUserToExperiment(userId, experiment.experimentId);
        // Record conversion for some users
        if (userId === 'user_1' || userId === 'user_3') {
          abTestManager.recordConversion(userId, experiment.experimentId);
        }
      });

      const results = abTestManager.calculateResults(experiment.experimentId);

      expect(results).toBeDefined();
      expect(results!.experimentId).toBe(experiment.experimentId);
      expect(results!.variantResults).toHaveLength(2);
      expect(results!.overallStatistics.totalParticipants).toBeGreaterThan(0);
      expect(results!.overallStatistics.testDuration).toBeGreaterThan(0);
      expect(results!.overallStatistics.pValue).toBeGreaterThanOrEqual(0);
      expect(results!.overallStatistics.pValue).toBeLessThanOrEqual(1);
    });

    it('should calculate conversion rates correctly', () => {
      // Create controlled scenario
      const controlUsers = ['control_1', 'control_2'];
      const variantUsers = ['variant_1', 'variant_2'];

      // Manually assign users to specific variants for testing
      controlUsers.forEach(userId => {
        abTestManager.assignUserToExperiment(userId, experiment.experimentId);
        abTestManager.recordConversion(userId, experiment.experimentId); // 100% conversion for control
      });

      variantUsers.forEach(userId => {
        abTestManager.assignUserToExperiment(userId, experiment.experimentId);
        // Only convert first user (50% conversion for variant)
        if (userId === 'variant_1') {
          abTestManager.recordConversion(userId, experiment.experimentId);
        }
      });

      const results = abTestManager.calculateResults(experiment.experimentId);
      
      expect(results).toBeDefined();
      expect(results!.variantResults.length).toBe(2);
      
      // Check that conversion rates are calculated
      results!.variantResults.forEach(variantResult => {
        expect(variantResult.conversionRate).toBeGreaterThanOrEqual(0);
        expect(variantResult.conversionRate).toBeLessThanOrEqual(1);
        expect(variantResult.standardError).toBeGreaterThanOrEqual(0);
        expect(variantResult.confidenceInterval).toHaveLength(2);
        expect(variantResult.confidenceInterval[0]).toBeLessThanOrEqual(variantResult.confidenceInterval[1]);
      });
    });

    it('should return null for non-existent experiment', () => {
      const results = abTestManager.calculateResults('non_existent_experiment');
      expect(results).toBeNull();
    });

    it('should provide appropriate recommendations', () => {
      // Test with minimal sample size
      const results = abTestManager.calculateResults(experiment.experimentId);
      expect(results).toBeDefined();
      expect(['continue_test', 'declare_winner', 'stop_test', 'inconclusive']).toContain(results!.recommendation);
    });
  });

  describe('traffic allocation and variant selection', () => {
    it('should respect traffic allocation percentage', () => {
      const experiment = abTestManager.createExperiment({
        name: 'Traffic Allocation Test',
        description: 'Testing traffic allocation',
        status: 'active',
        startDate: new Date(),
        endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        targetSegments: ['segment_1'],
        variants: [
          {
            variantId: 'control',
            name: 'Control',
            trafficSplit: 100,
            interventionStrategy: mockInterventionStrategy,
            isControl: true,
          },
        ] as ABTestVariant[],
        trafficAllocation: 50, // Only 50% of users should be included
        successMetric: 'conversion_rate' as const,
        minimumSampleSize: 100,
        confidenceLevel: 0.95,
        statisticalPower: 0.8,
      });

      // Try to assign many users
      const totalUsers = 100;
      let assignedUsers = 0;

      for (let i = 0; i < totalUsers; i++) {
        const assignment = abTestManager.assignUserToExperiment(`user_${i}`, experiment.experimentId);
        if (assignment) {
          assignedUsers++;
        }
      }

      // Should be approximately 50% (allowing for some variance due to hashing)
      expect(assignedUsers).toBeGreaterThan(30);
      expect(assignedUsers).toBeLessThan(70);
    });

    it('should distribute users according to traffic split', () => {
      const experiment = abTestManager.createExperiment({
        name: 'Traffic Split Test',
        description: 'Testing traffic split distribution',
        status: 'active',
        startDate: new Date(),
        endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        targetSegments: ['segment_1'],
        variants: [
          {
            variantId: 'control',
            name: 'Control',
            trafficSplit: 25,
            interventionStrategy: mockInterventionStrategy,
            isControl: true,
          },
          {
            variantId: 'variant_a',
            name: 'Variant A',
            trafficSplit: 75,
            interventionStrategy: mockInterventionStrategy,
            isControl: false,
          },
        ] as ABTestVariant[],
        trafficAllocation: 100,
        successMetric: 'conversion_rate' as const,
        minimumSampleSize: 100,
        confidenceLevel: 0.95,
        statisticalPower: 0.8,
      });

      const assignments = { control: 0, variant_a: 0 };
      const totalUsers = 1000;

      for (let i = 0; i < totalUsers; i++) {
        const assignment = abTestManager.assignUserToExperiment(`user_${i}`, experiment.experimentId);
        if (assignment) {
          assignments[assignment.variantId as keyof typeof assignments]++;
        }
      }

      // Should be approximately 25/75 split (allowing for variance)
      const controlPercentage = (assignments.control / totalUsers) * 100;
      const variantPercentage = (assignments.variant_a / totalUsers) * 100;

      expect(controlPercentage).toBeGreaterThan(20);
      expect(controlPercentage).toBeLessThan(30);
      expect(variantPercentage).toBeGreaterThan(70);
      expect(variantPercentage).toBeLessThan(80);
    });
  });

  describe('experiment management', () => {
    it('should get active experiments', () => {
      const activeExperiment = abTestManager.createExperiment({
        name: 'Active Experiment',
        description: 'Active test',
        status: 'active',
        startDate: new Date(),
        endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        targetSegments: ['segment_1'],
        variants: [
          {
            variantId: 'control',
            name: 'Control',
            trafficSplit: 100,
            interventionStrategy: mockInterventionStrategy,
            isControl: true,
          },
        ] as ABTestVariant[],
        trafficAllocation: 100,
        successMetric: 'conversion_rate' as const,
        minimumSampleSize: 100,
        confidenceLevel: 0.95,
        statisticalPower: 0.8,
      });

      const draftExperiment = abTestManager.createExperiment({
        name: 'Draft Experiment',
        description: 'Draft test',
        status: 'draft',
        startDate: new Date(),
        endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        targetSegments: ['segment_1'],
        variants: [
          {
            variantId: 'control',
            name: 'Control',
            trafficSplit: 100,
            interventionStrategy: mockInterventionStrategy,
            isControl: true,
          },
        ] as ABTestVariant[],
        trafficAllocation: 100,
        successMetric: 'conversion_rate' as const,
        minimumSampleSize: 100,
        confidenceLevel: 0.95,
        statisticalPower: 0.8,
      });

      const activeExperiments = abTestManager.getActiveExperiments();
      
      expect(activeExperiments).toHaveLength(1);
      expect(activeExperiments[0].experimentId).toBe(activeExperiment.experimentId);
    });

    it('should update experiment status', () => {
      const experiment = abTestManager.createExperiment({
        name: 'Status Update Test',
        description: 'Testing status updates',
        status: 'draft',
        startDate: new Date(),
        endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        targetSegments: ['segment_1'],
        variants: [
          {
            variantId: 'control',
            name: 'Control',
            trafficSplit: 100,
            interventionStrategy: mockInterventionStrategy,
            isControl: true,
          },
        ] as ABTestVariant[],
        trafficAllocation: 100,
        successMetric: 'conversion_rate' as const,
        minimumSampleSize: 100,
        confidenceLevel: 0.95,
        statisticalPower: 0.8,
      });

      const updated = abTestManager.updateExperimentStatus(experiment.experimentId, 'active');
      expect(updated).toBe(true);

      const activeExperiments = abTestManager.getActiveExperiments();
      expect(activeExperiments).toHaveLength(1);
      expect(activeExperiments[0].status).toBe('active');
    });

    it('should return false when updating non-existent experiment', () => {
      const updated = abTestManager.updateExperimentStatus('non_existent', 'active');
      expect(updated).toBe(false);
    });
  });
});