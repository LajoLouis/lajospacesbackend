
import { User } from '../models/User.model';
import { logger } from '../utils/logger';

export interface UserPresence {
  userId: string;
  status: 'online' | 'away' | 'busy' | 'offline';
  lastSeen: Date;
  socketIds: string[];
  currentActivity?: {
    type: 'browsing' | 'messaging' | 'viewing_property' | 'matching';
    details?: string;
    startedAt: Date;
  };
}

export interface TypingStatus {
  userId: string;
  conversationId: string;
  isTyping: boolean;
  startedAt: Date;
}

export class PresenceService {
  private static instance: PresenceService;
  private onlineUsers: Map<string, UserPresence> = new Map();
  private typingStatuses: Map<string, TypingStatus> = new Map(); // key: userId_conversationId
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    // Start cleanup interval for stale data
    this.cleanupInterval = setInterval(() => {
      this.cleanupStaleData();
    }, 30000); // Every 30 seconds
  }

  public static getInstance(): PresenceService {
    if (!PresenceService.instance) {
      PresenceService.instance = new PresenceService();
    }
    return PresenceService.instance;
  }

  /**
   * Set user online status
   */
  public setUserOnline(userId: string, socketId: string, status: 'online' | 'away' | 'busy' = 'online'): void {
    const existingPresence = this.onlineUsers.get(userId);
    
    if (existingPresence) {
      // Add socket ID if not already present
      if (!existingPresence.socketIds.includes(socketId)) {
        existingPresence.socketIds.push(socketId);
      }
      existingPresence.status = status;
      existingPresence.lastSeen = new Date();
    } else {
      // Create new presence record
      this.onlineUsers.set(userId, {
        userId,
        status,
        lastSeen: new Date(),
        socketIds: [socketId]
      });
    }

    // Update user's last active time in database
    this.updateUserLastActive(userId);

    logger.debug(`User ${userId} set to ${status} with socket ${socketId}`);
  }

  /**
   * Set user offline
   */
  public setUserOffline(userId: string, socketId?: string): void {
    const presence = this.onlineUsers.get(userId);
    
    if (presence) {
      if (socketId) {
        // Remove specific socket
        presence.socketIds = presence.socketIds.filter(id => id !== socketId);
        
        // If no more sockets, set offline
        if (presence.socketIds.length === 0) {
          presence.status = 'offline';
          presence.lastSeen = new Date();
          this.updateUserLastActive(userId);
        }
      } else {
        // Remove all sockets and set offline
        presence.status = 'offline';
        presence.lastSeen = new Date();
        presence.socketIds = [];
        this.updateUserLastActive(userId);
      }
    }

    // Clear typing status for this user
    this.clearUserTypingStatus(userId);

    logger.debug(`User ${userId} set offline${socketId ? ` (socket ${socketId})` : ''}`);
  }

  /**
   * Update user status
   */
  public updateUserStatus(userId: string, status: 'online' | 'away' | 'busy'): void {
    const presence = this.onlineUsers.get(userId);
    
    if (presence) {
      presence.status = status;
      presence.lastSeen = new Date();
      this.updateUserLastActive(userId);
    }

    logger.debug(`User ${userId} status updated to ${status}`);
  }

  /**
   * Set user activity
   */
  public setUserActivity(
    userId: string, 
    activityType: 'browsing' | 'messaging' | 'viewing_property' | 'matching',
    details?: string
  ): void {
    const presence = this.onlineUsers.get(userId);
    
    if (presence) {
      const activity: any = {
        type: activityType,
        startedAt: new Date()
      };
      if (details) {
        activity.details = details;
      }
      presence.currentActivity = activity;
      presence.lastSeen = new Date();
    }

    logger.debug(`User ${userId} activity set to ${activityType}${details ? `: ${details}` : ''}`);
  }

  /**
   * Clear user activity
   */
  public clearUserActivity(userId: string): void {
    const presence = this.onlineUsers.get(userId);
    
    if (presence) {
      delete presence.currentActivity;
      presence.lastSeen = new Date();
    }
  }

  /**
   * Get user presence
   */
  public getUserPresence(userId: string): UserPresence | null {
    return this.onlineUsers.get(userId) || null;
  }

  /**
   * Get user status
   */
  public getUserStatus(userId: string): 'online' | 'away' | 'busy' | 'offline' {
    const presence = this.onlineUsers.get(userId);
    return presence ? presence.status : 'offline';
  }

  /**
   * Check if user is online
   */
  public isUserOnline(userId: string): boolean {
    const presence = this.onlineUsers.get(userId);
    return presence ? presence.status !== 'offline' && presence.socketIds.length > 0 : false;
  }

  /**
   * Get all online users
   */
  public getOnlineUsers(): UserPresence[] {
    return Array.from(this.onlineUsers.values()).filter(presence => 
      presence.status !== 'offline' && presence.socketIds.length > 0
    );
  }

  /**
   * Get online users count
   */
  public getOnlineUsersCount(): number {
    return this.getOnlineUsers().length;
  }

  /**
   * Get user's socket IDs
   */
  public getUserSocketIds(userId: string): string[] {
    const presence = this.onlineUsers.get(userId);
    return presence ? presence.socketIds : [];
  }

  /**
   * Set typing status
   */
  public setTypingStatus(userId: string, conversationId: string, isTyping: boolean): void {
    const key = `${userId}_${conversationId}`;
    
    if (isTyping) {
      this.typingStatuses.set(key, {
        userId,
        conversationId,
        isTyping: true,
        startedAt: new Date()
      });
    } else {
      this.typingStatuses.delete(key);
    }

    logger.debug(`User ${userId} ${isTyping ? 'started' : 'stopped'} typing in conversation ${conversationId}`);
  }

  /**
   * Get typing status for conversation
   */
  public getTypingUsersInConversation(conversationId: string): TypingStatus[] {
    return Array.from(this.typingStatuses.values()).filter(
      status => status.conversationId === conversationId && status.isTyping
    );
  }

  /**
   * Clear all typing status for a user
   */
  public clearUserTypingStatus(userId: string): void {
    const keysToDelete: string[] = [];
    
    for (const [key, status] of this.typingStatuses.entries()) {
      if (status.userId === userId) {
        keysToDelete.push(key);
      }
    }
    
    keysToDelete.forEach(key => this.typingStatuses.delete(key));
  }

  /**
   * Get users who were recently online
   */
  public getRecentlyOnlineUsers(minutesAgo: number = 15): UserPresence[] {
    const cutoffTime = new Date(Date.now() - minutesAgo * 60 * 1000);
    
    return Array.from(this.onlineUsers.values()).filter(presence => 
      presence.lastSeen >= cutoffTime
    );
  }

  /**
   * Get presence statistics
   */
  public getPresenceStats(): {
    totalOnline: number;
    totalAway: number;
    totalBusy: number;
    totalOffline: number;
    totalTyping: number;
    averageSessionDuration: number;
  } {
    const presences = Array.from(this.onlineUsers.values());
    
    const stats = {
      totalOnline: presences.filter(p => p.status === 'online' && p.socketIds.length > 0).length,
      totalAway: presences.filter(p => p.status === 'away').length,
      totalBusy: presences.filter(p => p.status === 'busy').length,
      totalOffline: presences.filter(p => p.status === 'offline' || p.socketIds.length === 0).length,
      totalTyping: this.typingStatuses.size,
      averageSessionDuration: 0
    };

    // Calculate average session duration (simplified)
    const activeSessions = presences.filter(p => p.socketIds.length > 0);
    if (activeSessions.length > 0) {
      const totalDuration = activeSessions.reduce((sum, presence) => {
        const sessionDuration = Date.now() - presence.lastSeen.getTime();
        return sum + sessionDuration;
      }, 0);
      stats.averageSessionDuration = Math.round(totalDuration / activeSessions.length / 1000 / 60); // in minutes
    }

    return stats;
  }

  /**
   * Cleanup stale data
   */
  private cleanupStaleData(): void {
    const now = new Date();
    const staleThreshold = 5 * 60 * 1000; // 5 minutes
    const typingThreshold = 30 * 1000; // 30 seconds

    // Clean up stale presence data
    for (const [userId, presence] of this.onlineUsers.entries()) {
      const timeSinceLastSeen = now.getTime() - presence.lastSeen.getTime();
      
      if (timeSinceLastSeen > staleThreshold && presence.status !== 'offline') {
        presence.status = 'offline';
        presence.socketIds = [];
        this.updateUserLastActive(userId);
        logger.debug(`Marked user ${userId} as offline due to inactivity`);
      }
    }

    // Clean up stale typing indicators
    for (const [key, typingStatus] of this.typingStatuses.entries()) {
      const timeSinceStarted = now.getTime() - typingStatus.startedAt.getTime();
      
      if (timeSinceStarted > typingThreshold) {
        this.typingStatuses.delete(key);
        logger.debug(`Cleared stale typing status for user ${typingStatus.userId} in conversation ${typingStatus.conversationId}`);
      }
    }
  }

  /**
   * Update user's last active time in database
   */
  private async updateUserLastActive(userId: string): Promise<void> {
    try {
      await User.findByIdAndUpdate(userId, {
        lastActiveAt: new Date()
      });
    } catch (error) {
      logger.error(`Error updating last active time for user ${userId}:`, error);
    }
  }

  /**
   * Bulk update user statuses from database
   */
  public async syncWithDatabase(): Promise<void> {
    try {
      // Get users who were active in the last hour
      const recentlyActiveUsers = await User.find({
        lastActiveAt: { $gte: new Date(Date.now() - 60 * 60 * 1000) }
      }).select('_id lastActiveAt').lean();

      // Update presence data
      for (const user of recentlyActiveUsers) {
        const presence = this.onlineUsers.get(user._id.toString());
        if (presence) {
          // Update last seen from database if it's more recent
          if (user.lastActiveAt > presence.lastSeen) {
            presence.lastSeen = user.lastActiveAt;
          }
        }
      }

      logger.debug(`Synced presence data for ${recentlyActiveUsers.length} users`);
    } catch (error) {
      logger.error('Error syncing presence with database:', error);
    }
  }

  /**
   * Cleanup on service shutdown
   */
  public cleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    
    // Mark all users as offline
    for (const [userId, presence] of this.onlineUsers.entries()) {
      presence.status = 'offline';
      presence.socketIds = [];
      this.updateUserLastActive(userId);
    }
    
    this.onlineUsers.clear();
    this.typingStatuses.clear();
    
    logger.info('Presence service cleaned up');
  }
}
