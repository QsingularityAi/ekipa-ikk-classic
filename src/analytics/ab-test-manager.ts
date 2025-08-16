import { InterventionStrategy } from '../types';

/**
 * A/B Test Experiment Configuration
 * Requirements: 4.2 - A/B testing capabilities for different nudge strategies
 */
export interface ABTestExperiment {
  experimentId: string;
  name: string;
  description: string;
  status: 'draft' | 'active' | 'paused' | 'completed';
  startDate: Date;
  endDate: Date;
  targetSegments: string[];
  variants: ABTestVariant[];
  trafficAllocation: number; // Percentage of users to include in test (0-100)
  successMetric: 'conversion_rate' | 'engagement_rate' | 'task_completion_rate' | 'cost_savings';
  minimumSampleSize: number;
  confidenceLevel: number; // e.g., 0.95 for 95% confidence
  statisticalPower: number; // e.g., 0.8 for 80% power
}

/**
 * A/B Test Variant Configuration
 */
export interface ABTestVariant {
  variantId: string;
  name: string;
  trafficSplit: number; // Percentage of test traffic (sum should equal 100)
  interventionStrategy: InterventionStrategy;
  isControl: boolean;
}

/**
 * A/B Test Assignment for a user
 */
export interface ABTestAssignment {
  userId: string;
  experimentId: string;
  variantId: string;
  assignedAt: Date;
}

/**
 * A/B Test Results and Statistics
 */
export interface ABTestResults {
  experimentId: string;
  variantResults: VariantResults[];
  overallStatistics: {
    totalParticipants: number;
    testDuration: number; // in days
    statisticalSignificance: boolean;
    pValue: number;
    confidenceInterval: [number, number];
  };
  recommendation: 'continue_test' | 'declare_winner' | 'stop_test' | 'inconclusive';
  winningVariant?: string;
}

/**
 * Individual variant performance results
 */
export interface VariantResults {
  variantId: string;
  participants: number;
  conversions: number;
  conversionRate: number;
  standardError: number;
  confidenceInterval: [number, number];
}

/**
 * A/B Test Manager for creating, managing, and analyzing experiments
 * Requirements: 4.2, 4.4 - A/B testing with statistical significance validation
 */
export class ABTestManager {
  private experiments: Map<string, ABTestExperiment> = new Map();
  private assignments: Map<string, ABTestAssignment[]> = new Map();
  private results: Map<string, Map<string, number>> = new Map(); // experimentId -> variantId -> conversions

  /**
   * Create a new A/B test experiment
   * Requirements: 4.2 - A/B testing capabilities for different nudge strategies
   */
  createExperiment(config: Omit<ABTestExperiment, 'experimentId'>): ABTestExperiment {
    const experimentId = this.generateExperimentId();
    
    // Validate experiment configuration
    this.validateExperimentConfig(config);
    
    const experiment: ABTestExperiment = {
      ...config,
      experimentId,
    };
    
    this.experiments.set(experimentId, experiment);
    this.results.set(experimentId, new Map());
    
    return experiment;
  }

  /**
   * Assign a user to an experiment variant
   * Requirements: 4.2 - Traffic splitting logic for A/B testing
   */
  assignUserToExperiment(userId: string, experimentId: string): ABTestAssignment | null {
    const experiment = this.experiments.get(experimentId);
    if (!experiment || experiment.status !== 'active') {
      return null;
    }

    // Check if user is already assigned
    const existingAssignment = this.getUserAssignment(userId, experimentId);
    if (existingAssignment) {
      return existingAssignment;
    }

    // Check if user should be included in the test (traffic allocation)
    if (!this.shouldIncludeUser(userId, experiment.trafficAllocation)) {
      return null;
    }

    // Assign user to variant based on traffic split
    const variantId = this.selectVariant(userId, experiment.variants);
    
    const assignment: ABTestAssignment = {
      userId,
      experimentId,
      variantId,
      assignedAt: new Date(),
    };

    // Store assignment
    if (!this.assignments.has(userId)) {
      this.assignments.set(userId, []);
    }
    this.assignments.get(userId)!.push(assignment);

    return assignment;
  }

  /**
   * Record a conversion event for a user in an experiment
   * Requirements: 4.4 - Track conversion rates and effectiveness
   */
  recordConversion(userId: string, experimentId: string): void {
    const assignment = this.getUserAssignment(userId, experimentId);
    if (!assignment) {
      return;
    }

    const experimentResults = this.results.get(experimentId);
    if (!experimentResults) {
      return;
    }

    const currentConversions = experimentResults.get(assignment.variantId) || 0;
    experimentResults.set(assignment.variantId, currentConversions + 1);
  }

  /**
   * Calculate statistical results for an experiment
   * Requirements: 4.2, 4.4 - Statistical significance validation
   */
  calculateResults(experimentId: string): ABTestResults | null {
    const experiment = this.experiments.get(experimentId);
    if (!experiment) {
      return null;
    }

    const variantResults = this.calculateVariantResults(experimentId, experiment);
    const overallStatistics = this.calculateOverallStatistics(variantResults, experiment);
    
    return {
      experimentId,
      variantResults,
      overallStatistics,
      recommendation: this.generateRecommendation(overallStatistics, experiment),
      winningVariant: this.determineWinningVariant(variantResults, overallStatistics),
    };
  }

  /**
   * Get user's assignment for a specific experiment
   */
  getUserAssignment(userId: string, experimentId: string): ABTestAssignment | null {
    const userAssignments = this.assignments.get(userId) || [];
    return userAssignments.find(a => a.experimentId === experimentId) || null;
  }

  /**
   * Get all active experiments
   */
  getActiveExperiments(): ABTestExperiment[] {
    return Array.from(this.experiments.values()).filter(exp => exp.status === 'active');
  }

  /**
   * Update experiment status
   */
  updateExperimentStatus(experimentId: string, status: ABTestExperiment['status']): boolean {
    const experiment = this.experiments.get(experimentId);
    if (!experiment) {
      return false;
    }

    experiment.status = status;
    return true;
  }

  // Private helper methods

  private generateExperimentId(): string {
    return `exp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private validateExperimentConfig(config: Omit<ABTestExperiment, 'experimentId'>): void {
    // Validate traffic splits sum to 100
    const totalTrafficSplit = config.variants.reduce((sum, variant) => sum + variant.trafficSplit, 0);
    if (Math.abs(totalTrafficSplit - 100) > 0.01) {
      throw new Error('Variant traffic splits must sum to 100%');
    }

    // Validate at least one control variant
    const hasControl = config.variants.some(variant => variant.isControl);
    if (!hasControl) {
      throw new Error('Experiment must have at least one control variant');
    }

    // Validate confidence level and statistical power
    if (config.confidenceLevel <= 0 || config.confidenceLevel >= 1) {
      throw new Error('Confidence level must be between 0 and 1');
    }

    if (config.statisticalPower <= 0 || config.statisticalPower >= 1) {
      throw new Error('Statistical power must be between 0 and 1');
    }
  }

  private shouldIncludeUser(userId: string, trafficAllocation: number): boolean {
    // Use consistent hashing based on userId to ensure stable assignment
    const hash = this.hashUserId(userId);
    return (hash % 100) < trafficAllocation;
  }

  private selectVariant(userId: string, variants: ABTestVariant[]): string {
    // Use consistent hashing to assign users to variants
    const hash = this.hashUserId(userId);
    const normalizedHash = hash % 100;
    
    let cumulativeWeight = 0;
    for (const variant of variants) {
      cumulativeWeight += variant.trafficSplit;
      if (normalizedHash < cumulativeWeight) {
        return variant.variantId;
      }
    }
    
    // Fallback to first variant (should not happen with proper validation)
    return variants[0].variantId;
  }

  private hashUserId(userId: string): number {
    // Simple hash function for consistent user assignment
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      const char = userId.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  private calculateVariantResults(experimentId: string, experiment: ABTestExperiment): VariantResults[] {
    const experimentResults = this.results.get(experimentId) || new Map();
    
    return experiment.variants.map(variant => {
      const conversions = experimentResults.get(variant.variantId) || 0;
      const participants = this.getVariantParticipants(experimentId, variant.variantId);
      const conversionRate = participants > 0 ? conversions / participants : 0;
      const standardError = this.calculateStandardError(conversionRate, participants);
      const confidenceInterval = this.calculateConfidenceInterval(
        conversionRate, 
        standardError, 
        experiment.confidenceLevel
      );

      return {
        variantId: variant.variantId,
        participants,
        conversions,
        conversionRate,
        standardError,
        confidenceInterval,
      };
    });
  }

  private calculateOverallStatistics(
    variantResults: VariantResults[], 
    experiment: ABTestExperiment
  ): ABTestResults['overallStatistics'] {
    const totalParticipants = variantResults.reduce((sum, result) => sum + result.participants, 0);
    const testDuration = Math.ceil((Date.now() - experiment.startDate.getTime()) / (1000 * 60 * 60 * 24));
    
    // Calculate p-value using chi-square test for multiple variants
    const pValue = this.calculatePValue(variantResults);
    const statisticalSignificance = pValue < (1 - experiment.confidenceLevel);
    
    // Calculate overall confidence interval (using control variant as baseline)
    const controlVariant = variantResults.find(result => 
      experiment.variants.find(v => v.variantId === result.variantId)?.isControl
    );
    const confidenceInterval: [number, number] = controlVariant 
      ? controlVariant.confidenceInterval 
      : [0, 0];

    return {
      totalParticipants,
      testDuration,
      statisticalSignificance,
      pValue,
      confidenceInterval,
    };
  }

  private calculateStandardError(conversionRate: number, sampleSize: number): number {
    if (sampleSize === 0) return 0;
    return Math.sqrt((conversionRate * (1 - conversionRate)) / sampleSize);
  }

  private calculateConfidenceInterval(
    conversionRate: number, 
    standardError: number, 
    confidenceLevel: number
  ): [number, number] {
    // Z-score for given confidence level (approximation)
    const zScore = this.getZScore(confidenceLevel);
    const margin = zScore * standardError;
    
    return [
      Math.max(0, conversionRate - margin),
      Math.min(1, conversionRate + margin)
    ];
  }

  private getZScore(confidenceLevel: number): number {
    // Common z-scores for confidence levels
    const zScores: Record<number, number> = {
      0.90: 1.645,
      0.95: 1.96,
      0.99: 2.576,
    };
    
    return zScores[confidenceLevel] || 1.96; // Default to 95% confidence
  }

  private calculatePValue(variantResults: VariantResults[]): number {
    // Simplified chi-square test for independence
    // In a real implementation, you'd use a proper statistical library
    if (variantResults.length < 2) return 1;
    
    const totalConversions = variantResults.reduce((sum, result) => sum + result.conversions, 0);
    const totalParticipants = variantResults.reduce((sum, result) => sum + result.participants, 0);
    
    if (totalParticipants === 0) return 1;
    
    const expectedRate = totalConversions / totalParticipants;
    let chiSquare = 0;
    
    for (const result of variantResults) {
      const expected = result.participants * expectedRate;
      if (expected > 0) {
        chiSquare += Math.pow(result.conversions - expected, 2) / expected;
      }
    }
    
    // Simplified p-value calculation (in practice, use proper chi-square distribution)
    // This is a rough approximation
    const degreesOfFreedom = variantResults.length - 1;
    return Math.exp(-chiSquare / (2 * degreesOfFreedom));
  }

  private getVariantParticipants(experimentId: string, variantId: string): number {
    // Count users assigned to this variant
    let count = 0;
    for (const userAssignments of this.assignments.values()) {
      for (const assignment of userAssignments) {
        if (assignment.experimentId === experimentId && assignment.variantId === variantId) {
          count++;
        }
      }
    }
    return count;
  }

  private generateRecommendation(
    statistics: ABTestResults['overallStatistics'], 
    experiment: ABTestExperiment
  ): ABTestResults['recommendation'] {
    // Check if minimum sample size is reached
    if (statistics.totalParticipants < experiment.minimumSampleSize) {
      return 'continue_test';
    }
    
    // Check if test has statistical significance
    if (statistics.statisticalSignificance) {
      return 'declare_winner';
    }
    
    // Check if test has run long enough
    const maxTestDuration = 30; // days
    if (statistics.testDuration >= maxTestDuration) {
      return 'stop_test';
    }
    
    return 'continue_test';
  }

  private determineWinningVariant(
    variantResults: VariantResults[], 
    statistics: ABTestResults['overallStatistics']
  ): string | undefined {
    if (!statistics.statisticalSignificance) {
      return undefined;
    }
    
    // Find variant with highest conversion rate
    const winner = variantResults.reduce((best, current) => 
      current.conversionRate > best.conversionRate ? current : best
    );
    
    return winner.variantId;
  }
}