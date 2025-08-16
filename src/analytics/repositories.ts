import { UserProfile, UserEvent } from '../types';

/**
 * Repository interface for UserProfile CRUD operations
 * Requirements: 1.3 - Data persistence and retrieval
 * Requirements: 5.2 - Data minimization and privacy compliance
 */
export interface UserProfileRepository {
  create(profile: UserProfile): Promise<UserProfile>;
  findById(userId: string): Promise<UserProfile | null>;
  update(userId: string, updates: Partial<UserProfile>): Promise<UserProfile | null>;
  delete(userId: string): Promise<boolean>;
  findByAgeGroup(ageGroup: string): Promise<UserProfile[]>;
  findByEngagementLevel(level: 'low' | 'medium' | 'high'): Promise<UserProfile[]>;
  findInactive(daysSinceLastActive: number): Promise<UserProfile[]>;
  bulkUpdate(updates: Array<{ userId: string; updates: Partial<UserProfile> }>): Promise<number>;
}

/**
 * Repository interface for AnalyticsEvent storage with time-series optimization
 * Requirements: 1.3 - Time-series data storage and retrieval
 * Requirements: 5.2 - Data retention and privacy compliance
 */
export interface AnalyticsEventRepository {
  store(event: UserEvent): Promise<void>;
  storeBatch(events: UserEvent[]): Promise<void>;
  findByUserId(userId: string, startDate?: Date, endDate?: Date): Promise<UserEvent[]>;
  findByEventType(eventType: string, startDate?: Date, endDate?: Date): Promise<UserEvent[]>;
  findBySessionId(sessionId: string): Promise<UserEvent[]>;
  findByDateRange(startDate: Date, endDate: Date): Promise<UserEvent[]>;
  aggregateByEventType(startDate: Date, endDate: Date): Promise<Record<string, number>>;
  aggregateByUser(userId: string, startDate: Date, endDate: Date): Promise<{
    totalEvents: number;
    eventTypes: Record<string, number>;
    averageSessionDuration: number;
    uniqueSessions: number;
  }>;
  deleteOldEvents(cutoffDate: Date): Promise<number>;
  getEventCount(startDate?: Date, endDate?: Date): Promise<number>;
}

/**
 * In-memory implementation of UserProfileRepository for development/testing
 * Requirements: 1.3 - CRUD operations for user profiles
 */
export class InMemoryUserProfileRepository implements UserProfileRepository {
  private profiles: Map<string, UserProfile> = new Map();

  async create(profile: UserProfile): Promise<UserProfile> {
    if (this.profiles.has(profile.userId)) {
      throw new Error(`User profile already exists for userId: ${profile.userId}`);
    }

    const newProfile = {
      ...profile,
      demographics: {
        ...profile.demographics,
        registrationDate: profile.demographics.registrationDate || new Date(),
        lastActiveDate: profile.demographics.lastActiveDate || new Date()
      }
    };

    this.profiles.set(profile.userId, newProfile);
    return newProfile;
  }

  async findById(userId: string): Promise<UserProfile | null> {
    return this.profiles.get(userId) || null;
  }

  async update(userId: string, updates: Partial<UserProfile>): Promise<UserProfile | null> {
    const existingProfile = this.profiles.get(userId);
    if (!existingProfile) {
      return null;
    }

    const updatedProfile: UserProfile = {
      ...existingProfile,
      ...updates,
      demographics: {
        ...existingProfile.demographics,
        ...(updates.demographics || {}),
        lastActiveDate: new Date()
      },
      engagementMetrics: {
        ...existingProfile.engagementMetrics,
        ...(updates.engagementMetrics || {})
      },
      preferences: {
        ...existingProfile.preferences,
        ...(updates.preferences || {})
      },
      consentStatus: updates.consentStatus || existingProfile.consentStatus
    };

    this.profiles.set(userId, updatedProfile);
    return updatedProfile;
  }

  async delete(userId: string): Promise<boolean> {
    return this.profiles.delete(userId);
  }

  async findByAgeGroup(ageGroup: string): Promise<UserProfile[]> {
    const profiles: UserProfile[] = [];
    for (const profile of this.profiles.values()) {
      if (profile.demographics.ageGroup === ageGroup) {
        profiles.push(profile);
      }
    }
    return profiles;
  }

  async findByEngagementLevel(level: 'low' | 'medium' | 'high'): Promise<UserProfile[]> {
    const profiles: UserProfile[] = [];
    for (const profile of this.profiles.values()) {
      const engagementLevel = this.calculateEngagementLevel(profile);
      if (engagementLevel === level) {
        profiles.push(profile);
      }
    }
    return profiles;
  }

  async findInactive(daysSinceLastActive: number): Promise<UserProfile[]> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysSinceLastActive);

    const profiles: UserProfile[] = [];
    for (const profile of this.profiles.values()) {
      if (profile.demographics.lastActiveDate < cutoffDate) {
        profiles.push(profile);
      }
    }
    return profiles;
  }

  async bulkUpdate(updates: Array<{ userId: string; updates: Partial<UserProfile> }>): Promise<number> {
    let updatedCount = 0;
    for (const { userId, updates: profileUpdates } of updates) {
      const result = await this.update(userId, profileUpdates);
      if (result) {
        updatedCount++;
      }
    }
    return updatedCount;
  }

  /**
   * Calculate engagement level based on user metrics
   */
  private calculateEngagementLevel(profile: UserProfile): 'low' | 'medium' | 'high' {
    const metrics = profile.engagementMetrics;
    
    // Simple scoring algorithm
    let score = 0;
    
    // Session frequency (sessions per month)
    const daysSinceRegistration = Math.max(1, 
      (Date.now() - profile.demographics.registrationDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    const sessionsPerMonth = (metrics.totalSessions / daysSinceRegistration) * 30;
    
    if (sessionsPerMonth >= 10) score += 3;
    else if (sessionsPerMonth >= 5) score += 2;
    else if (sessionsPerMonth >= 1) score += 1;
    
    // Session duration
    if (metrics.averageSessionDuration >= 300) score += 2; // 5+ minutes
    else if (metrics.averageSessionDuration >= 120) score += 1; // 2+ minutes
    
    // Feature usage diversity
    if (metrics.featuresUsed.length >= 5) score += 2;
    else if (metrics.featuresUsed.length >= 3) score += 1;
    
    // Digital task completion
    if (metrics.digitalTasksCompleted >= 10) score += 2;
    else if (metrics.digitalTasksCompleted >= 3) score += 1;
    
    // Traditional channel usage (negative indicator)
    const traditionalUsage = metrics.traditionalChannelUsage.phoneCallsLastMonth + 
                           metrics.traditionalChannelUsage.paperFormsLastMonth;
    if (traditionalUsage === 0) score += 1;
    else if (traditionalUsage >= 5) score -= 1;
    
    // Classify based on score
    if (score >= 7) return 'high';
    if (score >= 4) return 'medium';
    return 'low';
  }

  /**
   * Get all profiles (for testing/debugging)
   */
  async getAllProfiles(): Promise<UserProfile[]> {
    return Array.from(this.profiles.values());
  }

  /**
   * Clear all profiles (for testing)
   */
  async clear(): Promise<void> {
    this.profiles.clear();
  }

  /**
   * Get profile count
   */
  async getCount(): Promise<number> {
    return this.profiles.size;
  }
}

/**
 * In-memory implementation of AnalyticsEventRepository with time-series optimization
 * Requirements: 1.3 - Time-series event storage and aggregation
 */
export class InMemoryAnalyticsEventRepository implements AnalyticsEventRepository {
  private events: UserEvent[] = [];
  private eventsByUser: Map<string, UserEvent[]> = new Map();
  private eventsByType: Map<string, UserEvent[]> = new Map();
  private eventsBySession: Map<string, UserEvent[]> = new Map();

  async store(event: UserEvent): Promise<void> {
    // Store in main array
    this.events.push(event);
    
    // Index by user
    if (!this.eventsByUser.has(event.userId)) {
      this.eventsByUser.set(event.userId, []);
    }
    this.eventsByUser.get(event.userId)!.push(event);
    
    // Index by event type
    if (!this.eventsByType.has(event.eventType)) {
      this.eventsByType.set(event.eventType, []);
    }
    this.eventsByType.get(event.eventType)!.push(event);
    
    // Index by session
    if (!this.eventsBySession.has(event.sessionId)) {
      this.eventsBySession.set(event.sessionId, []);
    }
    this.eventsBySession.get(event.sessionId)!.push(event);
    
    // Keep events sorted by timestamp for time-series queries
    this.events.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  async storeBatch(events: UserEvent[]): Promise<void> {
    for (const event of events) {
      await this.store(event);
    }
  }

  async findByUserId(userId: string, startDate?: Date, endDate?: Date): Promise<UserEvent[]> {
    const userEvents = this.eventsByUser.get(userId) || [];
    return this.filterByDateRange(userEvents, startDate, endDate);
  }

  async findByEventType(eventType: string, startDate?: Date, endDate?: Date): Promise<UserEvent[]> {
    const typeEvents = this.eventsByType.get(eventType) || [];
    return this.filterByDateRange(typeEvents, startDate, endDate);
  }

  async findBySessionId(sessionId: string): Promise<UserEvent[]> {
    return this.eventsBySession.get(sessionId) || [];
  }

  async findByDateRange(startDate: Date, endDate: Date): Promise<UserEvent[]> {
    return this.events.filter(event => 
      event.timestamp >= startDate && event.timestamp <= endDate
    );
  }

  async aggregateByEventType(startDate: Date, endDate: Date): Promise<Record<string, number>> {
    const events = await this.findByDateRange(startDate, endDate);
    const aggregation: Record<string, number> = {};
    
    for (const event of events) {
      aggregation[event.eventType] = (aggregation[event.eventType] || 0) + 1;
    }
    
    return aggregation;
  }

  async aggregateByUser(userId: string, startDate: Date, endDate: Date): Promise<{
    totalEvents: number;
    eventTypes: Record<string, number>;
    averageSessionDuration: number;
    uniqueSessions: number;
  }> {
    const userEvents = await this.findByUserId(userId, startDate, endDate);
    const eventTypes: Record<string, number> = {};
    const sessions = new Set<string>();
    let totalDuration = 0;
    let durationCount = 0;
    
    for (const event of userEvents) {
      // Count event types
      eventTypes[event.eventType] = (eventTypes[event.eventType] || 0) + 1;
      
      // Track unique sessions
      sessions.add(event.sessionId);
      
      // Calculate average duration
      if (event.metadata?.duration) {
        totalDuration += event.metadata.duration;
        durationCount++;
      }
    }
    
    return {
      totalEvents: userEvents.length,
      eventTypes,
      averageSessionDuration: durationCount > 0 ? totalDuration / durationCount : 0,
      uniqueSessions: sessions.size
    };
  }

  async deleteOldEvents(cutoffDate: Date): Promise<number> {
    const initialCount = this.events.length;
    
    // Filter out old events
    this.events = this.events.filter(event => event.timestamp >= cutoffDate);
    
    // Rebuild indexes
    this.eventsByUser.clear();
    this.eventsByType.clear();
    this.eventsBySession.clear();
    
    for (const event of this.events) {
      // Rebuild user index
      if (!this.eventsByUser.has(event.userId)) {
        this.eventsByUser.set(event.userId, []);
      }
      this.eventsByUser.get(event.userId)!.push(event);
      
      // Rebuild type index
      if (!this.eventsByType.has(event.eventType)) {
        this.eventsByType.set(event.eventType, []);
      }
      this.eventsByType.get(event.eventType)!.push(event);
      
      // Rebuild session index
      if (!this.eventsBySession.has(event.sessionId)) {
        this.eventsBySession.set(event.sessionId, []);
      }
      this.eventsBySession.get(event.sessionId)!.push(event);
    }
    
    return initialCount - this.events.length;
  }

  async getEventCount(startDate?: Date, endDate?: Date): Promise<number> {
    if (!startDate && !endDate) {
      return this.events.length;
    }
    
    const filteredEvents = this.filterByDateRange(this.events, startDate, endDate);
    return filteredEvents.length;
  }

  /**
   * Filter events by date range
   */
  private filterByDateRange(events: UserEvent[], startDate?: Date, endDate?: Date): UserEvent[] {
    return events.filter(event => {
      if (startDate && event.timestamp < startDate) return false;
      if (endDate && event.timestamp > endDate) return false;
      return true;
    });
  }

  /**
   * Get all events (for testing/debugging)
   */
  async getAllEvents(): Promise<UserEvent[]> {
    return [...this.events];
  }

  /**
   * Clear all events (for testing)
   */
  async clear(): Promise<void> {
    this.events = [];
    this.eventsByUser.clear();
    this.eventsByType.clear();
    this.eventsBySession.clear();
  }

  /**
   * Get storage statistics
   */
  async getStats(): Promise<{
    totalEvents: number;
    uniqueUsers: number;
    uniqueSessions: number;
    eventTypes: string[];
    dateRange: { earliest: Date | null; latest: Date | null };
  }> {
    return {
      totalEvents: this.events.length,
      uniqueUsers: this.eventsByUser.size,
      uniqueSessions: this.eventsBySession.size,
      eventTypes: Array.from(this.eventsByType.keys()),
      dateRange: {
        earliest: this.events.length > 0 ? this.events[0].timestamp : null,
        latest: this.events.length > 0 ? this.events[this.events.length - 1].timestamp : null
      }
    };
  }
}