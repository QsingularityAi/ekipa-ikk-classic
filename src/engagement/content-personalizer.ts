import { UserProfile, PersonalizedContent, InterventionStrategy } from '../types';

/**
 * Configuration for content personalizer
 */
export interface ContentPersonalizerConfig {
  templates: Map<string, any>;
  accessibilityEnabled: boolean;
  multiLanguageSupport: boolean;
}

/**
 * Content personalizer for creating age-appropriate and accessibility-compliant messaging
 * Requirements: 2.1, 6.2, 6.3, 6.4 - Personalized content for different age groups and literacy levels
 */
export class ContentPersonalizer {
  private config: ContentPersonalizerConfig;
  private contentTemplates: Map<string, ContentTemplate> = new Map();
  private accessibilitySettings: Map<string, AccessibilitySettings> = new Map();

  constructor(config: ContentPersonalizerConfig) {
    this.config = config;
    this.initializeContentTemplates();
    this.initializeAccessibilitySettings();
  }

  /**
   * Personalize content based on user profile and intervention strategy
   * Requirements: 2.1 - Provide personalized feature recommendations based on user profile
   */
  public async personalizeContent(
    content: { title: string; message: string; actionButton?: string; mediaUrl?: string },
    userProfile: UserProfile,
    context?: ContentContext
  ): Promise<PersonalizedContent> {
    const ageGroup = userProfile.demographics.ageGroup;
    const digitalLiteracy = this.assessDigitalLiteracy(userProfile);
    const contentComplexity = userProfile.preferences.contentComplexity;

    // Get base content
    const baseContent = content;

    // Apply age-appropriate messaging
    const ageAdaptedContent = this.adaptContentForAge(baseContent, ageGroup, digitalLiteracy);

    // Apply complexity preferences
    const complexityAdaptedContent = this.adaptContentComplexity(
      ageAdaptedContent,
      contentComplexity,
      digitalLiteracy
    );

    // Apply accessibility settings
    const accessibilitySettings = this.getAccessibilitySettings(userProfile);
    
    // Create personalized content
    const personalizedContent: PersonalizedContent = {
      title: complexityAdaptedContent.title,
      message: complexityAdaptedContent.message,
      callToAction: complexityAdaptedContent.actionButton,
      visualElements: this.generateVisualElements(baseContent, ageGroup, context),
      accessibility: accessibilitySettings
    };

    return personalizedContent;
  }

  /**
   * Generate content variations for A/B testing
   * Requirements: 6.2, 6.3 - Test different messaging approaches for different age groups
   */
  public generateContentVariations(
    strategy: InterventionStrategy,
    userProfile: UserProfile,
    variationCount: number = 3
  ): PersonalizedContent[] {
    const variations: PersonalizedContent[] = [];
    const baseContent = this.personalizeContent(strategy, userProfile);

    // Generate base variation
    variations.push(baseContent);

    // Generate tone variations
    if (variationCount > 1) {
      const formalVariation = this.applyToneVariation(baseContent, 'formal', userProfile);
      variations.push(formalVariation);
    }

    if (variationCount > 2) {
      const casualVariation = this.applyToneVariation(baseContent, 'casual', userProfile);
      variations.push(casualVariation);
    }

    // Generate additional variations with different visual elements
    while (variations.length < variationCount) {
      const visualVariation = {
        ...baseContent,
        visualElements: this.generateAlternativeVisualElements(
          strategy,
          userProfile.demographics.ageGroup,
          variations.length
        )
      };
      variations.push(visualVariation);
    }

    return variations.slice(0, variationCount);
  }

  /**
   * Validate content for accessibility compliance
   * Requirements: 6.2, 6.3, 6.4 - Ensure accessibility compliance for all content
   */
  public validateAccessibilityCompliance(content: PersonalizedContent): AccessibilityValidationResult {
    const issues: string[] = [];
    const warnings: string[] = [];

    // Check title length and clarity
    if (content.title.length > 60) {
      warnings.push('Title may be too long for screen readers');
    }

    if (content.title.length < 5) {
      issues.push('Title is too short to be meaningful');
    }

    // Check message readability
    const readabilityScore = this.calculateReadabilityScore(content.message);
    if (readabilityScore < 60) {
      issues.push('Message may be too complex for general audience');
    }

    // Check accessibility settings
    if (!content.accessibility.screenReaderText && content.visualElements?.imageUrl) {
      issues.push('Missing screen reader text for visual elements');
    }

    // Check color contrast (if high contrast is not enabled)
    if (!content.accessibility.highContrast && content.visualElements?.color) {
      warnings.push('Consider enabling high contrast for better accessibility');
    }

    // Check font size appropriateness
    if (content.accessibility.fontSize === 'normal' && content.message.length > 200) {
      warnings.push('Consider larger font size for lengthy messages');
    }

    return {
      isCompliant: issues.length === 0,
      issues,
      warnings,
      score: Math.max(0, 100 - (issues.length * 20) - (warnings.length * 5))
    };
  }

  /**
   * Get content template for specific strategy and age group
   * Requirements: 6.1 - Segment users by age groups and tailor interventions accordingly
   */
  public getContentTemplate(strategyType: string, ageGroup: string): ContentTemplate | null {
    const templateKey = `${strategyType}-${ageGroup}`;
    return this.contentTemplates.get(templateKey) || this.contentTemplates.get(strategyType) || null;
  }

  /**
   * Update content template for specific strategy and age group
   */
  public updateContentTemplate(strategyType: string, ageGroup: string, template: ContentTemplate): void {
    const templateKey = `${strategyType}-${ageGroup}`;
    this.contentTemplates.set(templateKey, template);
  }

  private initializeContentTemplates(): void {
    // Nudge templates by age group
    this.contentTemplates.set('nudge-22-30', {
      titlePatterns: ['Quick tip! 💡', 'Hey! Did you know?', 'Pro tip:'],
      messagePatterns: [
        'You can {action} right from your phone! 📱',
        'Save time by using {feature} - it takes just seconds!',
        'Skip the wait and {action} instantly!'
      ],
      actionButtonPatterns: ['Try it now', 'Let\'s go!', 'Show me how'],
      tone: 'casual',
      useEmojis: true
    });

    this.contentTemplates.set('nudge-31-55', {
      titlePatterns: ['Helpful tip', 'Did you know?', 'Quick reminder'],
      messagePatterns: [
        'You can {action} conveniently through the app.',
        'Save time by using {feature} - it\'s quick and secure.',
        'Manage your {service} digitally for faster results.'
      ],
      actionButtonPatterns: ['Learn more', 'Get started', 'Try now'],
      tone: 'professional',
      useEmojis: false
    });

    this.contentTemplates.set('nudge-56+', {
      titlePatterns: ['Helpful information', 'Important notice', 'Convenient option'],
      messagePatterns: [
        'You can now {action} using this app for your convenience.',
        'The {feature} feature makes it easy to {action} from home.',
        'This digital option can save you time and effort.'
      ],
      actionButtonPatterns: ['Learn how', 'Get help', 'Start here'],
      tone: 'respectful',
      useEmojis: false
    });

    // Education templates by age group
    this.contentTemplates.set('education-22-30', {
      titlePatterns: ['Master this feature! 🎯', 'Level up your skills', 'Quick tutorial'],
      messagePatterns: [
        'Let\'s walk through {feature} step by step!',
        'Here\'s how to {action} like a pro:',
        'Unlock the full potential of {feature}!'
      ],
      actionButtonPatterns: ['Start tutorial', 'Show me', 'Let\'s learn'],
      tone: 'enthusiastic',
      useEmojis: true
    });

    this.contentTemplates.set('education-56+', {
      titlePatterns: ['Step-by-step guide', 'How to use {feature}', 'Getting started'],
      messagePatterns: [
        'We\'ll guide you through {feature} at your own pace.',
        'Here\'s a simple way to {action}:',
        'Let us help you get comfortable with {feature}.'
      ],
      actionButtonPatterns: ['Begin guide', 'Show me step-by-step', 'Get help'],
      tone: 'supportive',
      useEmojis: false
    });

    // Gamification templates
    this.contentTemplates.set('gamification', {
      titlePatterns: ['Achievement unlocked! 🏆', 'Great job! ⭐', 'You\'re on fire! 🔥'],
      messagePatterns: [
        'You\'ve completed {achievement}! Keep it up!',
        'Awesome! You\'re becoming a digital pro!',
        'You\'re making great progress with digital services!'
      ],
      actionButtonPatterns: ['View progress', 'Next challenge', 'Keep going'],
      tone: 'celebratory',
      useEmojis: true
    });

    // Incentive templates
    this.contentTemplates.set('incentive', {
      titlePatterns: ['Special offer', 'Save time and effort', 'Exclusive benefit'],
      messagePatterns: [
        'Complete {action} digitally and get faster processing!',
        'Use {feature} now and skip the waiting time.',
        'Digital completion means quicker results for you.'
      ],
      actionButtonPatterns: ['Claim benefit', 'Get started', 'Take advantage'],
      tone: 'motivational',
      useEmojis: false
    });
  }

  private initializeAccessibilitySettings(): void {
    // Default accessibility settings by age group
    this.accessibilitySettings.set('22-30', {
      fontSize: 'normal',
      highContrast: false,
      screenReaderOptimized: false
    });

    this.accessibilitySettings.set('31-40', {
      fontSize: 'normal',
      highContrast: false,
      screenReaderOptimized: false
    });

    this.accessibilitySettings.set('41-55', {
      fontSize: 'large',
      highContrast: false,
      screenReaderOptimized: true
    });

    this.accessibilitySettings.set('56-65', {
      fontSize: 'large',
      highContrast: true,
      screenReaderOptimized: true
    });

    this.accessibilitySettings.set('66+', {
      fontSize: 'extra_large',
      highContrast: true,
      screenReaderOptimized: true
    });
  }

  private assessDigitalLiteracy(userProfile: UserProfile): 'beginner' | 'intermediate' | 'advanced' {
    const metrics = userProfile.engagementMetrics;
    const age = this.getAgeFromGroup(userProfile.demographics.ageGroup);
    
    let literacyScore = 0;
    
    // Age factor
    if (age < 35) literacyScore += 40;
    else if (age < 50) literacyScore += 30;
    else if (age < 65) literacyScore += 20;
    else literacyScore += 10;
    
    // Usage complexity
    if (metrics.featuresUsed.length > 5) literacyScore += 30;
    else if (metrics.featuresUsed.length > 2) literacyScore += 20;
    else if (metrics.featuresUsed.length > 0) literacyScore += 10;
    
    // Task completion
    if (metrics.digitalTasksCompleted > 8) literacyScore += 30;
    else if (metrics.digitalTasksCompleted > 4) literacyScore += 20;
    else if (metrics.digitalTasksCompleted > 1) literacyScore += 10;
    
    if (literacyScore >= 80) return 'advanced';
    if (literacyScore >= 50) return 'intermediate';
    return 'beginner';
  }

  private adaptContentForAge(
    content: { title: string; message: string; actionButton?: string },
    ageGroup: string,
    digitalLiteracy: 'beginner' | 'intermediate' | 'advanced'
  ): { title: string; message: string; actionButton?: string } {
    const age = this.getAgeFromGroup(ageGroup);
    
    // Younger users (22-40) - casual, energetic tone
    if (age < 40) {
      return {
        title: this.makeContentCasual(content.title),
        message: this.makeContentCasual(content.message),
        actionButton: content.actionButton ? this.makeActionCasual(content.actionButton) : undefined
      };
    }
    
    // Older users (56+) - respectful, clear tone
    if (age > 55) {
      return {
        title: this.makeContentRespectful(content.title),
        message: this.makeContentRespectful(content.message),
        actionButton: content.actionButton ? this.makeActionRespectful(content.actionButton) : undefined
      };
    }
    
    // Middle-aged users (41-55) - professional tone
    return {
      title: this.makeContentProfessional(content.title),
      message: this.makeContentProfessional(content.message),
      actionButton: content.actionButton ? this.makeActionProfessional(content.actionButton) : undefined
    };
  }

  private adaptContentComplexity(
    content: { title: string; message: string; actionButton?: string },
    complexity: 'simple' | 'detailed',
    digitalLiteracy: 'beginner' | 'intermediate' | 'advanced'
  ): { title: string; message: string; actionButton?: string } {
    if (complexity === 'simple' || digitalLiteracy === 'beginner') {
      return {
        title: this.simplifyText(content.title),
        message: this.simplifyText(content.message),
        actionButton: content.actionButton ? this.simplifyText(content.actionButton) : undefined
      };
    }
    
    return content;
  }

  private getAccessibilitySettings(userProfile: UserProfile): {
    fontSize: 'normal' | 'large' | 'extra_large';
    highContrast: boolean;
    screenReaderText?: string;
  } {
    const ageGroup = userProfile.demographics.ageGroup;
    const defaultSettings = this.accessibilitySettings.get(ageGroup) || {
      fontSize: 'normal',
      highContrast: false,
      screenReaderOptimized: false
    };

    return {
      fontSize: defaultSettings.fontSize,
      highContrast: defaultSettings.highContrast,
      screenReaderText: defaultSettings.screenReaderOptimized ? 
        'Personalized recommendation for your IKK classic app experience' : undefined
    };
  }

  private generateVisualElements(
    strategy: InterventionStrategy,
    ageGroup: string,
    context?: ContentContext
  ): PersonalizedContent['visualElements'] {
    const age = this.getAgeFromGroup(ageGroup);
    const useModernDesign = age < 50;
    
    const baseElements = {
      iconUrl: this.getIconForStrategy(strategy.type, useModernDesign),
      color: this.getColorForStrategy(strategy.type, ageGroup)
    };

    // Add contextual image if appropriate
    if (context?.featureId) {
      baseElements.imageUrl = `/images/features/${context.featureId}-${useModernDesign ? 'modern' : 'classic'}.png`;
    }

    return baseElements;
  }

  private generateAlternativeVisualElements(
    strategy: InterventionStrategy,
    ageGroup: string,
    variationIndex: number
  ): PersonalizedContent['visualElements'] {
    const colorVariations = ['#007bff', '#28a745', '#ffc107', '#dc3545', '#6f42c1', '#e83e8c'];
    const iconVariations = ['info', 'star', 'bell', 'check', 'heart', 'thumbs-up'];
    
    // Ensure we get different variations by using the variation index
    const colorIndex = (variationIndex + 1) % colorVariations.length;
    const iconIndex = (variationIndex + 1) % iconVariations.length;
    
    return {
      iconUrl: `/icons/${iconVariations[iconIndex]}.svg`,
      color: colorVariations[colorIndex]
    };
  }

  private applyToneVariation(
    content: PersonalizedContent,
    tone: 'formal' | 'casual',
    userProfile: UserProfile
  ): PersonalizedContent {
    const variation = { ...content };
    
    if (tone === 'formal') {
      variation.title = this.makeContentProfessional(content.title);
      variation.message = this.makeContentProfessional(content.message);
      if (variation.callToAction) {
        variation.callToAction = this.makeActionProfessional(variation.callToAction);
      }
    } else {
      variation.title = this.makeContentCasual(content.title);
      variation.message = this.makeContentCasual(content.message);
      if (variation.callToAction) {
        variation.callToAction = this.makeActionCasual(variation.callToAction);
      }
    }
    
    return variation;
  }

  private calculateReadabilityScore(text: string): number {
    // Simplified Flesch Reading Ease calculation
    const sentences = text.split(/[.!?]+/).length - 1;
    const words = text.split(/\s+/).length;
    const syllables = this.countSyllables(text);
    
    if (sentences === 0 || words === 0) return 0;
    
    const avgSentenceLength = words / sentences;
    const avgSyllablesPerWord = syllables / words;
    
    const score = 206.835 - (1.015 * avgSentenceLength) - (84.6 * avgSyllablesPerWord);
    return Math.max(0, Math.min(100, score));
  }

  private countSyllables(text: string): number {
    return text.toLowerCase()
      .replace(/[^a-z]/g, '')
      .replace(/[aeiou]{2,}/g, 'a')
      .replace(/[^aeiou]/g, '')
      .length || 1;
  }

  private getAgeFromGroup(ageGroup: string): number {
    const ageRanges: Record<string, number> = {
      '22-30': 26,
      '31-40': 35,
      '41-55': 48,
      '56-65': 60,
      '66+': 70
    };
    return ageRanges[ageGroup] || 35;
  }

  private makeContentCasual(text: string): string {
    return text
      .replace(/\bDid you know\b/gi, 'Hey! Did you know')
      .replace(/\bYou can\b/gi, 'You can totally')
      .replace(/\bPlease\b/gi, 'Just')
      .replace(/\bThank you\b/gi, 'Thanks');
  }

  private makeContentProfessional(text: string): string {
    return text
      .replace(/\bHey!\s*/gi, '')
      .replace(/\btotally\s*/gi, '')
      .replace(/\bJust\b/gi, 'Please')
      .replace(/\bThanks\b/gi, 'Thank you')
      .replace(/\bQuick\b/gi, 'Convenient')
      .trim();
  }

  private makeContentRespectful(text: string): string {
    return text
      .replace(/\bHey!\s*/gi, 'Hello ')
      .replace(/\bQuick\b/gi, 'Convenient')
      .replace(/\bTry it\b/gi, 'Consider using')
      .replace(/\bLet\'s\b/gi, 'You can')
      .replace(/\btotally\s*/gi, '')
      .trim();
  }

  private makeActionCasual(action: string): string {
    const casualActions: Record<string, string> = {
      'Learn more': 'Check it out',
      'Get started': 'Let\'s go!',
      'Try now': 'Give it a try',
      'Continue': 'Keep going'
    };
    return casualActions[action] || action;
  }

  private makeActionProfessional(action: string): string {
    const professionalActions: Record<string, string> = {
      'Check it out': 'Learn more',
      'Let\'s go!': 'Get started',
      'Give it a try': 'Try now',
      'Keep going': 'Continue'
    };
    return professionalActions[action] || action;
  }

  private makeActionRespectful(action: string): string {
    const respectfulActions: Record<string, string> = {
      'Try now': 'Learn how',
      'Let\'s go!': 'Get started',
      'Check it out': 'View details',
      'Give it a try': 'Consider this option'
    };
    return respectfulActions[action] || action;
  }

  private simplifyText(text: string): string {
    return text
      .replace(/\butilize\b/g, 'use')
      .replace(/\bfacilitate\b/g, 'help')
      .replace(/\bdemonstrate\b/g, 'show')
      .replace(/\baccomplish\b/g, 'do')
      .replace(/\badditional\b/g, 'more')
      .replace(/\bassistance\b/g, 'help');
  }

  private getIconForStrategy(strategyType: string, useModernDesign: boolean): string {
    const iconMap: Record<string, string> = {
      nudge: useModernDesign ? '/icons/lightbulb-modern.svg' : '/icons/lightbulb-classic.svg',
      education: useModernDesign ? '/icons/book-modern.svg' : '/icons/book-classic.svg',
      gamification: useModernDesign ? '/icons/trophy-modern.svg' : '/icons/trophy-classic.svg',
      incentive: useModernDesign ? '/icons/gift-modern.svg' : '/icons/gift-classic.svg'
    };
    return iconMap[strategyType] || '/icons/info.svg';
  }

  private getColorForStrategy(strategyType: string, ageGroup: string): string {
    const age = this.getAgeFromGroup(ageGroup);
    
    // Older users prefer more conservative colors
    if (age > 55) {
      const conservativeColors: Record<string, string> = {
        nudge: '#0056b3',
        education: '#28a745',
        gamification: '#ffc107',
        incentive: '#17a2b8'
      };
      return conservativeColors[strategyType] || '#6c757d';
    }
    
    // Younger users can handle more vibrant colors
    const vibrantColors: Record<string, string> = {
      nudge: '#007bff',
      education: '#20c997',
      gamification: '#fd7e14',
      incentive: '#e83e8c'
    };
    return vibrantColors[strategyType] || '#6f42c1';
  }
}

// Supporting interfaces
interface ContentTemplate {
  titlePatterns: string[];
  messagePatterns: string[];
  actionButtonPatterns: string[];
  tone: 'casual' | 'professional' | 'respectful' | 'enthusiastic' | 'supportive' | 'celebratory' | 'motivational';
  useEmojis: boolean;
}

interface AccessibilitySettings {
  fontSize: 'normal' | 'large' | 'extra_large';
  highContrast: boolean;
  screenReaderOptimized: boolean;
}

interface ContentContext {
  featureId?: string;
  userJourney?: string;
  previousInteractions?: string[];
}

export interface AccessibilityValidationResult {
  isCompliant: boolean;
  issues: string[];
  warnings: string[];
  score: number;
}