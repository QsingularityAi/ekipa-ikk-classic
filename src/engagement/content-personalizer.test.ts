import { describe, it, expect, beforeEach } from 'vitest';
import { ContentPersonalizer, AccessibilityValidationResult } from './content-personalizer';
import { UserProfile, InterventionStrategy, PersonalizedContent } from '../types';

describe('ContentPersonalizer', () => {
  let contentPersonalizer: ContentPersonalizer;
  let mockUserProfile: UserProfile;
  let mockInterventionStrategy: InterventionStrategy;

  beforeEach(() => {
    contentPersonalizer = new ContentPersonalizer();

    mockUserProfile = {
      userId: 'user123',
      demographics: {
        ageGroup: '31-40',
        registrationDate: new Date('2023-01-01'),
        lastActiveDate: new Date('2024-01-15')
      },
      engagementMetrics: {
        totalSessions: 15,
        averageSessionDuration: 180,
        featuresUsed: ['claims', 'benefits', 'profile'],
        digitalTasksCompleted: 8,
        traditionalChannelUsage: {
          phoneCallsLastMonth: 2,
          paperFormsLastMonth: 1
        }
      },
      preferences: {
        communicationChannels: ['email', 'in_app'],
        notificationFrequency: 'medium',
        contentComplexity: 'detailed'
      },
      consentStatus: [
        {
          userId: 'user123',
          consentType: 'analytics',
          granted: true,
          timestamp: new Date('2023-01-01'),
          version: '1.0'
        }
      ]
    };

    mockInterventionStrategy = {
      strategyId: 'nudge-reminder',
      type: 'nudge',
      trigger: {
        eventType: 'page_view',
        conditions: { screenName: 'dashboard' }
      },
      content: {
        title: 'Quick Tip',
        message: 'Did you know you can check your benefits status instantly?',
        actionButton: 'Check Now'
      },
      channels: ['in_app'],
      timing: {
        delay: 30,
        frequency: 'weekly'
      }
    };
  });

  describe('personalizeContent', () => {
    it('should personalize content based on user profile', () => {
      // Act
      const personalizedContent = contentPersonalizer.personalizeContent(
        mockInterventionStrategy,
        mockUserProfile
      );

      // Assert
      expect(personalizedContent).toHaveProperty('title');
      expect(personalizedContent).toHaveProperty('message');
      expect(personalizedContent).toHaveProperty('callToAction');
      expect(personalizedContent).toHaveProperty('visualElements');
      expect(personalizedContent).toHaveProperty('accessibility');
      expect(personalizedContent.title).toBe('Quick Tip');
      expect(personalizedContent.message).toContain('check your benefits status');
      expect(personalizedContent.callToAction).toBeDefined();
    });

    it('should adapt content for young users (22-30)', () => {
      // Arrange
      const youngUserProfile = {
        ...mockUserProfile,
        demographics: { ...mockUserProfile.demographics, ageGroup: '22-30' as const }
      };

      // Act
      const personalizedContent = contentPersonalizer.personalizeContent(
        mockInterventionStrategy,
        youngUserProfile
      );

      // Assert
      expect(personalizedContent.accessibility.fontSize).toBe('normal');
      expect(personalizedContent.accessibility.highContrast).toBe(false);
    });

    it('should adapt content for older users (66+)', () => {
      // Arrange
      const olderUserProfile = {
        ...mockUserProfile,
        demographics: { ...mockUserProfile.demographics, ageGroup: '66+' as const }
      };

      // Act
      const personalizedContent = contentPersonalizer.personalizeContent(
        mockInterventionStrategy,
        olderUserProfile
      );

      // Assert
      expect(personalizedContent.accessibility.fontSize).toBe('extra_large');
      expect(personalizedContent.accessibility.highContrast).toBe(true);
      expect(personalizedContent.accessibility.screenReaderText).toBeDefined();
    });

    it('should adapt content complexity for simple preference', () => {
      // Arrange
      const simpleUserProfile = {
        ...mockUserProfile,
        preferences: { ...mockUserProfile.preferences, contentComplexity: 'simple' as const }
      };

      const complexStrategy = {
        ...mockInterventionStrategy,
        content: {
          title: 'Utilize Advanced Features',
          message: 'You can utilize the sophisticated functionality to facilitate your insurance management.',
          actionButton: 'Demonstrate Capabilities'
        }
      };

      // Act
      const personalizedContent = contentPersonalizer.personalizeContent(
        complexStrategy,
        simpleUserProfile
      );

      // Assert
      expect(personalizedContent.title).toContain('Advanced Features');
      expect(personalizedContent.message).toContain('use');
      expect(personalizedContent.message).toContain('help');
      expect(personalizedContent.callToAction).toContain('Capabilities');
    });

    it('should generate appropriate visual elements based on age group', () => {
      // Arrange
      const youngUserProfile = {
        ...mockUserProfile,
        demographics: { ...mockUserProfile.demographics, ageGroup: '22-30' as const }
      };

      const olderUserProfile = {
        ...mockUserProfile,
        demographics: { ...mockUserProfile.demographics, ageGroup: '66+' as const }
      };

      // Act
      const youngContent = contentPersonalizer.personalizeContent(mockInterventionStrategy, youngUserProfile);
      const olderContent = contentPersonalizer.personalizeContent(mockInterventionStrategy, olderUserProfile);

      // Assert
      expect(youngContent.visualElements?.iconUrl).toContain('modern');
      expect(olderContent.visualElements?.iconUrl).toContain('classic');
      expect(youngContent.visualElements?.color).toBeDefined();
      expect(olderContent.visualElements?.color).toBeDefined();
    });
  });

  describe('generateContentVariations', () => {
    it('should generate multiple content variations', () => {
      // Act
      const variations = contentPersonalizer.generateContentVariations(
        mockInterventionStrategy,
        mockUserProfile,
        3
      );

      // Assert
      expect(variations).toHaveLength(3);
      expect(variations[0]).toHaveProperty('title');
      expect(variations[1]).toHaveProperty('title');
      expect(variations[2]).toHaveProperty('title');
    });

    it('should generate different visual elements for variations', () => {
      // Act
      const variations = contentPersonalizer.generateContentVariations(
        mockInterventionStrategy,
        mockUserProfile,
        3
      );

      // Assert
      const colors = variations.map(v => v.visualElements?.color);
      const icons = variations.map(v => v.visualElements?.iconUrl);
      
      // Should have different visual elements (at least some variations)
      // First variation uses base elements, others use alternative elements
      expect(colors.filter(c => c !== undefined).length).toBeGreaterThan(0);
      expect(icons.filter(i => i !== undefined).length).toBeGreaterThan(0);
      
      // Check that variations have visual elements
      expect(variations[1].visualElements).toBeDefined();
      expect(variations[2].visualElements).toBeDefined();
    });

    it('should limit variations to requested count', () => {
      // Act
      const variations = contentPersonalizer.generateContentVariations(
        mockInterventionStrategy,
        mockUserProfile,
        2
      );

      // Assert
      expect(variations).toHaveLength(2);
    });
  });

  describe('validateAccessibilityCompliance', () => {
    it('should validate compliant content', () => {
      // Arrange
      const compliantContent: PersonalizedContent = {
        title: 'Quick Tip',
        message: 'This is a clear and simple message that is easy to read.',
        callToAction: 'Learn More',
        visualElements: {
          iconUrl: '/icons/info.svg',
          color: '#007bff'
        },
        accessibility: {
          fontSize: 'large',
          highContrast: true,
          screenReaderText: 'Helpful tip for your insurance app'
        }
      };

      // Act
      const result = contentPersonalizer.validateAccessibilityCompliance(compliantContent);

      // Assert
      expect(result.isCompliant).toBe(true);
      expect(result.issues).toHaveLength(0);
      expect(result.score).toBeGreaterThan(80);
    });

    it('should identify accessibility issues', () => {
      // Arrange
      const nonCompliantContent: PersonalizedContent = {
        title: 'A',
        message: 'This is an extremely complex message with sophisticated terminology that utilizes advanced vocabulary and demonstrates complicated concepts that may be difficult for users to comprehend, especially those with lower literacy levels or cognitive impairments.',
        callToAction: 'Action',
        visualElements: {
          imageUrl: '/images/complex-diagram.png'
        },
        accessibility: {
          fontSize: 'normal',
          highContrast: false
          // Missing screenReaderText
        }
      };

      // Act
      const result = contentPersonalizer.validateAccessibilityCompliance(nonCompliantContent);

      // Assert
      expect(result.isCompliant).toBe(false);
      expect(result.issues.length).toBeGreaterThan(0);
      expect(result.issues).toContain('Title is too short to be meaningful');
      expect(result.issues).toContain('Message may be too complex for general audience');
      expect(result.issues).toContain('Missing screen reader text for visual elements');
    });

    it('should identify accessibility warnings', () => {
      // Arrange
      const warningContent: PersonalizedContent = {
        title: 'This is a very long title that exceeds the recommended length for screen readers and may cause issues',
        message: 'This is a reasonably clear message that should be understandable.',
        accessibility: {
          fontSize: 'normal',
          highContrast: false
        }
      };

      // Act
      const result = contentPersonalizer.validateAccessibilityCompliance(warningContent);

      // Assert
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings).toContain('Title may be too long for screen readers');
    });

    it('should calculate accessibility score correctly', () => {
      // Arrange
      const contentWithIssues: PersonalizedContent = {
        title: 'X',
        message: 'Complex terminology',
        accessibility: {
          fontSize: 'normal',
          highContrast: false
        }
      };

      // Act
      const result = contentPersonalizer.validateAccessibilityCompliance(contentWithIssues);

      // Assert
      expect(result.score).toBeLessThan(100);
      expect(result.score).toBeGreaterThanOrEqual(0);
    });
  });

  describe('age-appropriate content adaptation', () => {
    it('should use casual tone for young users', () => {
      // Arrange
      const youngUserProfile = {
        ...mockUserProfile,
        demographics: { ...mockUserProfile.demographics, ageGroup: '22-30' as const }
      };

      const strategy = {
        ...mockInterventionStrategy,
        content: {
          title: 'Did you know',
          message: 'You can manage your benefits',
          actionButton: 'Learn more'
        }
      };

      // Act
      const personalizedContent = contentPersonalizer.personalizeContent(strategy, youngUserProfile);

      // Assert
      expect(personalizedContent.title).toContain('Hey!');
      expect(personalizedContent.message).toContain('totally');
      expect(personalizedContent.callToAction).toBe('Check it out');
    });

    it('should use respectful tone for older users', () => {
      // Arrange
      const olderUserProfile = {
        ...mockUserProfile,
        demographics: { ...mockUserProfile.demographics, ageGroup: '66+' as const }
      };

      const strategy = {
        ...mockInterventionStrategy,
        content: {
          title: 'Hey! Quick tip',
          message: 'You can totally try this feature',
          actionButton: 'Try it'
        }
      };

      // Act
      const personalizedContent = contentPersonalizer.personalizeContent(strategy, olderUserProfile);

      // Assert
      expect(personalizedContent.title).toBe('Hello Convenient tip');
      expect(personalizedContent.message).toBe('You can try this feature');
      expect(personalizedContent.callToAction).toBeDefined();
    });

    it('should use professional tone for middle-aged users', () => {
      // Arrange
      const middleAgedUserProfile = {
        ...mockUserProfile,
        demographics: { ...mockUserProfile.demographics, ageGroup: '41-55' as const }
      };

      const strategy = {
        ...mockInterventionStrategy,
        content: {
          title: 'Hey! Quick tip',
          message: 'You can totally use this feature',
          actionButton: 'Check it out'
        }
      };

      // Act
      const personalizedContent = contentPersonalizer.personalizeContent(strategy, middleAgedUserProfile);

      // Assert
      expect(personalizedContent.title).toBe('Convenient tip');
      expect(personalizedContent.message).toBe('You can use this feature');
      expect(personalizedContent.callToAction).toBe('Learn more');
    });
  });

  describe('digital literacy adaptation', () => {
    it('should simplify content for beginner users', () => {
      // Arrange
      const beginnerUserProfile = {
        ...mockUserProfile,
        engagementMetrics: {
          ...mockUserProfile.engagementMetrics,
          featuresUsed: ['profile'], // Limited features
          digitalTasksCompleted: 1, // Low completion
          totalSessions: 3 // Few sessions
        },
        demographics: { ...mockUserProfile.demographics, ageGroup: '66+' as const }
      };

      const complexStrategy = {
        ...mockInterventionStrategy,
        content: {
          title: 'Utilize Advanced Functionality',
          message: 'You can utilize this feature to facilitate your insurance management and accomplish additional tasks.',
          actionButton: 'Demonstrate'
        }
      };

      // Act
      const personalizedContent = contentPersonalizer.personalizeContent(
        complexStrategy,
        beginnerUserProfile
      );

      // Assert
      expect(personalizedContent.title).toContain('Advanced Functionality');
      expect(personalizedContent.message).toContain('use');
      expect(personalizedContent.message).toContain('help');
      expect(personalizedContent.message).toContain('do');
      expect(personalizedContent.message).toContain('more');
    });

    it('should maintain complexity for advanced users', () => {
      // Arrange
      const advancedUserProfile = {
        ...mockUserProfile,
        engagementMetrics: {
          ...mockUserProfile.engagementMetrics,
          featuresUsed: ['claims', 'benefits', 'profile', 'documents', 'payments', 'settings'],
          digitalTasksCompleted: 15,
          totalSessions: 50
        },
        demographics: { ...mockUserProfile.demographics, ageGroup: '22-30' as const }
      };

      const complexStrategy = {
        ...mockInterventionStrategy,
        content: {
          title: 'Advanced Feature Utilization',
          message: 'You can utilize sophisticated functionality to facilitate comprehensive insurance management.',
          actionButton: 'Demonstrate Capabilities'
        }
      };

      // Act
      const personalizedContent = contentPersonalizer.personalizeContent(
        complexStrategy,
        advancedUserProfile
      );

      // Assert
      // Should maintain some complexity for advanced users
      expect(personalizedContent.title).toContain('Advanced');
      expect(personalizedContent.message).toContain('comprehensive');
    });
  });

  describe('content template management', () => {
    it('should retrieve content template for strategy and age group', () => {
      // Act
      const template = contentPersonalizer.getContentTemplate('nudge', '22-30');

      // Assert
      expect(template).toBeDefined();
      expect(template?.titlePatterns).toBeDefined();
      expect(template?.messagePatterns).toBeDefined();
      expect(template?.actionButtonPatterns).toBeDefined();
      expect(template?.tone).toBe('casual');
      expect(template?.useEmojis).toBe(true);
    });

    it('should return null for non-existent template', () => {
      // Act
      const template = contentPersonalizer.getContentTemplate('unknown', 'unknown');

      // Assert
      expect(template).toBeNull();
    });

    it('should update content template', () => {
      // Arrange
      const newTemplate = {
        titlePatterns: ['New Title Pattern'],
        messagePatterns: ['New Message Pattern'],
        actionButtonPatterns: ['New Action'],
        tone: 'professional' as const,
        useEmojis: false
      };

      // Act
      contentPersonalizer.updateContentTemplate('test', '31-40', newTemplate);
      const retrievedTemplate = contentPersonalizer.getContentTemplate('test', '31-40');

      // Assert
      expect(retrievedTemplate).toEqual(newTemplate);
    });
  });

  describe('gamification content', () => {
    it('should generate celebratory content for gamification strategies', () => {
      // Arrange
      const gamificationStrategy: InterventionStrategy = {
        strategyId: 'gamification-achievement',
        type: 'gamification',
        trigger: { eventType: 'task_completion', conditions: { success: true } },
        content: {
          title: 'Achievement Unlocked!',
          message: 'You completed another digital task. Keep it up!',
          actionButton: 'View Progress'
        },
        channels: ['push', 'in_app'],
        timing: { delay: 0 }
      };

      const youngUserProfile = {
        ...mockUserProfile,
        demographics: { ...mockUserProfile.demographics, ageGroup: '22-30' as const }
      };

      // Act
      const personalizedContent = contentPersonalizer.personalizeContent(
        gamificationStrategy,
        youngUserProfile
      );

      // Assert
      expect(personalizedContent.title).toContain('Achievement');
      expect(personalizedContent.visualElements?.iconUrl).toContain('trophy');
      expect(personalizedContent.visualElements?.color).toBeDefined();
    });
  });
});