import { Match } from '../models/Match';
import { logger } from '../utils/logger';
import { AppError } from '../utils/appError';

export class MatchExpirationService {
  
  /**
   * Process expired matches and update their status
   */
  static async processExpiredMatches(): Promise<{
    processed: number;
    expired: number;
    extended: number;
    errors: number;
  }> {
    try {
      const now = new Date();
      
      // Find all matches that have expired but are still pending
      const expiredMatches = await Match.find({
        status: 'pending',
        expiresAt: { $lt: now }
      });

      let expired = 0;
      let extended = 0;
      let errors = 0;

      for (const match of expiredMatches) {
        try {
          // Check if match should be extended based on activity
          const shouldExtend = await this.shouldExtendMatch(match);
          
          if (shouldExtend) {
            // Extend match by 3 days
            match.extendExpiration(3);
            await match.save();
            extended++;
            
            logger.info(`Extended match ${match._id} for user ${match.userId}`);
          } else {
            // Mark as expired
            match.status = 'expired';
            await match.save();
            expired++;
            
            logger.info(`Expired match ${match._id} for user ${match.userId}`);
          }
        } catch (error) {
          logger.error(`Error processing expired match ${match._id}:`, error);
          errors++;
        }
      }

      const result = {
        processed: expiredMatches.length,
        expired,
        extended,
        errors
      };

      logger.info('Match expiration processing completed', result);
      
      return result;
    } catch (error) {
      logger.error('Error processing expired matches:', error);
      throw new AppError('Failed to process expired matches', 500);
    }
  }

  /**
   * Check if a match should be extended based on user activity
   */
  private static async shouldExtendMatch(match: any): Promise<boolean> {
    // Extend if match has high compatibility (>85%) and was viewed recently
    if (match.compatibilityScore >= 85 && match.viewedAt) {
      const daysSinceViewed = (new Date().getTime() - match.viewedAt.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceViewed <= 2) {
        return true;
      }
    }

    // Extend if it's a super high compatibility match (>90%)
    if (match.compatibilityScore >= 90) {
      return true;
    }

    // Extend if user has been active recently and this is a good match
    if (match.compatibilityScore >= 80 && match.viewCount > 0) {
      return true;
    }

    return false;
  }

  /**
   * Clean up old expired matches (older than 30 days)
   */
  static async cleanupOldMatches(): Promise<{
    deleted: number;
    errors: number;
  }> {
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const result = await Match.deleteMany({
        status: 'expired',
        updatedAt: { $lt: thirtyDaysAgo }
      });

      logger.info(`Cleaned up ${result.deletedCount} old expired matches`);

      return {
        deleted: result.deletedCount || 0,
        errors: 0
      };
    } catch (error) {
      logger.error('Error cleaning up old matches:', error);
      return {
        deleted: 0,
        errors: 1
      };
    }
  }

  /**
   * Get match expiration statistics
   */
  static async getExpirationStats(): Promise<{
    totalMatches: number;
    pendingMatches: number;
    expiredMatches: number;
    expiringToday: number;
    expiringSoon: number; // within 24 hours
    averageMatchDuration: number; // in hours
  }> {
    try {
      const now = new Date();
      const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      const [
        totalMatches,
        pendingMatches,
        expiredMatches,
        expiringToday,
        expiringSoon,
        matchDurations
      ] = await Promise.all([
        Match.countDocuments({}),
        Match.countDocuments({ status: 'pending' }),
        Match.countDocuments({ status: 'expired' }),
        Match.countDocuments({
          status: 'pending',
          expiresAt: {
            $gte: now,
            $lt: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
          }
        }),
        Match.countDocuments({
          status: 'pending',
          expiresAt: {
            $gte: now,
            $lt: tomorrow
          }
        }),
        Match.aggregate([
          {
            $match: {
              status: { $in: ['matched', 'expired', 'rejected'] },
              createdAt: { $exists: true },
              lastInteractionAt: { $exists: true }
            }
          },
          {
            $project: {
              duration: {
                $divide: [
                  { $subtract: ['$lastInteractionAt', '$createdAt'] },
                  1000 * 60 * 60 // Convert to hours
                ]
              }
            }
          },
          {
            $group: {
              _id: null,
              averageDuration: { $avg: '$duration' }
            }
          }
        ])
      ]);

      const averageMatchDuration = matchDurations.length > 0 
        ? Math.round(matchDurations[0].averageDuration * 100) / 100 
        : 0;

      return {
        totalMatches,
        pendingMatches,
        expiredMatches,
        expiringToday,
        expiringSoon,
        averageMatchDuration
      };
    } catch (error) {
      logger.error('Error getting expiration stats:', error);
      throw new AppError('Failed to get expiration statistics', 500);
    }
  }

  /**
   * Extend a specific match
   */
  static async extendMatch(
    matchId: string,
    userId: string,
    days: number = 7
  ): Promise<any> {
    try {
      if (days < 1 || days > 30) {
        throw new AppError('Extension days must be between 1 and 30', 400);
      }

      const match = await Match.findOne({
        _id: matchId,
        userId,
        status: { $in: ['pending', 'expired'] }
      });

      if (!match) {
        throw new AppError('Match not found or cannot be extended', 404);
      }

      // Extend the match
      match.extendExpiration(days);
      
      // If match was expired, reactivate it
      if (match.status === 'expired') {
        match.status = 'pending';
      }

      await match.save();

      logger.info(`Extended match ${matchId} by ${days} days for user ${userId}`);

      return match;
    } catch (error) {
      logger.error('Error extending match:', error);
      throw error instanceof AppError ? error : new AppError('Failed to extend match', 500);
    }
  }

  /**
   * Get matches expiring soon for a user
   */
  static async getExpiringSoonForUser(
    userId: string,
    hoursAhead: number = 24
  ): Promise<any[]> {
    try {
      const now = new Date();
      const futureTime = new Date(now.getTime() + hoursAhead * 60 * 60 * 1000);

      const expiringSoon = await Match.find({
        userId,
        status: 'pending',
        expiresAt: {
          $gte: now,
          $lt: futureTime
        }
      })
      .populate('targetId', 'firstName lastName title propertyType location')
      .sort({ expiresAt: 1 })
      .lean();

      return expiringSoon.map(match => ({
        id: match._id,
        targetId: match.targetId,
        targetType: match.targetType,
        matchType: match.matchType,
        compatibilityScore: match.compatibilityScore,
        expiresAt: match.expiresAt,
        hoursUntilExpiry: Math.round((match.expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60))
      }));
    } catch (error) {
      logger.error('Error getting expiring matches for user:', error);
      throw new AppError('Failed to get expiring matches', 500);
    }
  }

  /**
   * Schedule automatic match expiration processing
   * This would typically be called by a cron job or scheduler
   */
  static async scheduleExpirationProcessing(): Promise<void> {
    try {
      // Process expired matches
      const expirationResult = await this.processExpiredMatches();
      
      // Clean up old matches (run less frequently)
      const now = new Date();
      if (now.getHours() === 2) { // Run cleanup at 2 AM
        const cleanupResult = await this.cleanupOldMatches();
        logger.info('Scheduled cleanup completed', cleanupResult);
      }

      logger.info('Scheduled expiration processing completed', expirationResult);
    } catch (error) {
      logger.error('Error in scheduled expiration processing:', error);
    }
  }

  /**
   * Send expiration notifications (placeholder for notification service)
   */
  static async sendExpirationNotifications(): Promise<void> {
    try {
      // Get all users with matches expiring in the next 6 hours
      const sixHoursFromNow = new Date(Date.now() + 6 * 60 * 60 * 1000);
      
      const expiringMatches = await Match.find({
        status: 'pending',
        expiresAt: {
          $gte: new Date(),
          $lt: sixHoursFromNow
        },
        // Only send notification if match hasn't been viewed recently
        $or: [
          { viewedAt: { $exists: false } },
          { viewedAt: { $lt: new Date(Date.now() - 2 * 60 * 60 * 1000) } } // Not viewed in last 2 hours
        ]
      })
      .populate('userId', 'email firstName')
      .populate('targetId', 'firstName title')
      .lean();

      // Group by user
      const userNotifications = new Map();
      
      expiringMatches.forEach(match => {
        const userId = match.userId._id.toString();
        if (!userNotifications.has(userId)) {
          userNotifications.set(userId, {
            user: match.userId,
            matches: []
          });
        }
        userNotifications.get(userId).matches.push(match);
      });

      // Send notifications (this would integrate with your notification service)
      for (const [userId, notification] of userNotifications) {
        logger.info(`Would send expiration notification to user ${userId} for ${notification.matches.length} matches`);
        // TODO: Integrate with notification service
        // await NotificationService.sendMatchExpirationNotification(notification.user, notification.matches);
      }

      logger.info(`Processed expiration notifications for ${userNotifications.size} users`);
    } catch (error) {
      logger.error('Error sending expiration notifications:', error);
    }
  }
}
