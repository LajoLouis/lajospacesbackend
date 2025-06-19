import { User } from '../models/User.model';
import { PresenceService } from './presenceService';
import { logger } from '../utils/logger';
import {
  Notification,
  NotificationType,
  NotificationPriority,
  NotificationChannel
} from '../models/notification.model';
import { emailService } from './emailService';

export interface NotificationPayload {
  id: string;
  type: 'message' | 'match' | 'system' | 'property' | 'reminder';
  title: string;
  body: string;
  data?: {
    conversationId?: string;
    messageId?: string;
    senderId?: string;
    senderName?: string;
    senderAvatar?: string;
    matchId?: string;
    propertyId?: string;
    [key: string]: any;
  };
  priority: 'high' | 'normal' | 'low';
  createdAt: Date;
  expiresAt?: Date;
}

export interface PushNotificationConfig {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  sound?: string;
  clickAction?: string;
  data?: any;
}

export class NotificationService {
  private static instance: NotificationService;
  private presenceService: PresenceService;

  constructor() {
    this.presenceService = PresenceService.getInstance();
  }

  public static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  /**
   * Send message notification
   */
  public async sendMessageNotification(
    message: any,
    conversation: any,
    recipientId: string
  ): Promise<void> {
    try {
      // Don't send notification if recipient is online and active in the conversation
      if (this.presenceService.isUserOnline(recipientId)) {
        const userActivity = this.presenceService.getUserPresence(recipientId)?.currentActivity;
        if (userActivity?.type === 'messaging' && userActivity.details === conversation._id.toString()) {
          logger.debug(`Skipping notification for ${recipientId} - active in conversation`);
          return;
        }
      }

      // Get recipient and sender info
      const [recipient, sender] = await Promise.all([
        User.findById(recipientId).select('firstName lastName email notificationSettings pushTokens'),
        User.findById(message.senderId).select('firstName lastName avatar')
      ]);

      if (!recipient || !sender) {
        logger.warn(`Missing user data for notification - recipient: ${!!recipient}, sender: ${!!sender}`);
        return;
      }

      // Check if recipient has notifications enabled
      if (!this.shouldSendNotification(recipient, 'message')) {
        logger.debug(`Notifications disabled for user ${recipientId}`);
        return;
      }

      // Check if conversation is muted
      const participantDetail = conversation.participantDetails.find(
        (pd: any) => pd.userId.toString() === recipientId
      );

      if (participantDetail?.isMuted) {
        const now = new Date();
        if (!participantDetail.mutedUntil || participantDetail.mutedUntil > now) {
          logger.debug(`Conversation muted for user ${recipientId}`);
          return;
        }
      }

      // Create notification payload
      const notification: NotificationPayload = {
        id: `msg_${message._id}_${Date.now()}`,
        type: 'message',
        title: this.getMessageNotificationTitle(sender, conversation),
        body: this.getMessageNotificationBody(message),
        data: {
          conversationId: conversation._id.toString(),
          messageId: message._id.toString(),
          senderId: (sender as any)._id.toString(),
          senderName: `${(sender as any).firstName} ${(sender as any).lastName}`,
          senderAvatar: (sender as any).avatar,
          messageType: message.messageType
        },
        priority: 'high',
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
      };

      // Send push notification
      await this.sendPushNotification(recipient, notification);

      // Send email notification if user is offline for more than 30 minutes
      const userPresence = this.presenceService.getUserPresence(recipientId);
      const isOfflineLong = !userPresence || 
        (userPresence.status === 'offline' && 
         Date.now() - userPresence.lastSeen.getTime() > 30 * 60 * 1000);

      if (isOfflineLong && this.shouldSendEmailNotification(recipient, 'message')) {
        await this.sendEmailNotification(recipient, notification, conversation);
      }

      logger.info(`Message notification sent to user ${recipientId} for message ${message._id}`);

    } catch (error) {
      logger.error('Error sending message notification:', error);
    }
  }

  /**
   * Send match notification
   */
  public async sendMatchNotification(
    userId: string,
    matchData: any
  ): Promise<void> {
    try {
      const user = await User.findById(userId).select('firstName lastName email notificationSettings pushTokens');
      
      if (!user || !this.shouldSendNotification(user, 'match')) {
        return;
      }

      const notification: NotificationPayload = {
        id: `match_${matchData.id}_${Date.now()}`,
        type: 'match',
        title: '🎉 New Match!',
        body: `You have a new ${matchData.type} match with ${matchData.compatibilityScore}% compatibility!`,
        data: {
          matchId: matchData.id,
          targetType: matchData.type,
          compatibilityScore: matchData.compatibilityScore
        },
        priority: 'high',
        createdAt: new Date()
      };

      await this.sendPushNotification(user, notification);

      logger.info(`Match notification sent to user ${userId}`);

    } catch (error) {
      logger.error('Error sending match notification:', error);
    }
  }

  /**
   * Send system notification
   */
  public async sendSystemNotification(
    userId: string,
    title: string,
    body: string,
    data?: any
  ): Promise<void> {
    try {
      const user = await User.findById(userId).select('firstName lastName email notificationSettings pushTokens');
      
      if (!user || !this.shouldSendNotification(user, 'system')) {
        return;
      }

      const notification: NotificationPayload = {
        id: `system_${userId}_${Date.now()}`,
        type: 'system',
        title,
        body,
        data,
        priority: 'normal',
        createdAt: new Date()
      };

      await this.sendPushNotification(user, notification);

      logger.info(`System notification sent to user ${userId}: ${title}`);

    } catch (error) {
      logger.error('Error sending system notification:', error);
    }
  }

  /**
   * Send bulk notifications
   */
  public async sendBulkNotifications(
    userIds: string[],
    notification: Omit<NotificationPayload, 'id' | 'createdAt'>
  ): Promise<void> {
    try {
      const users = await User.find({
        _id: { $in: userIds }
      }).select('firstName lastName email notificationSettings pushTokens');

      const promises = users.map(user => {
        if (this.shouldSendNotification(user, notification.type)) {
          const fullNotification: NotificationPayload = {
            ...notification,
            id: `bulk_${user._id}_${Date.now()}`,
            createdAt: new Date()
          };
          return this.sendPushNotification(user, fullNotification);
        }
        return Promise.resolve();
      });

      await Promise.allSettled(promises);

      logger.info(`Bulk notification sent to ${users.length} users`);

    } catch (error) {
      logger.error('Error sending bulk notifications:', error);
    }
  }

  /**
   * Send push notification
   */
  private async sendPushNotification(
    user: any,
    notification: NotificationPayload
  ): Promise<void> {
    try {
      // Check if user has push tokens
      if (!user.pushTokens || user.pushTokens.length === 0) {
        logger.debug(`No push tokens for user ${user._id}`);
        return;
      }

      const pushConfig: PushNotificationConfig = {
        title: notification.title,
        body: notification.body,
        icon: '/icons/icon-192x192.png',
        badge: '/icons/badge-72x72.png',
        sound: 'default',
        clickAction: this.getClickAction(notification),
        data: notification.data
      };

      // Here you would integrate with your push notification service
      // Examples: Firebase Cloud Messaging (FCM), Apple Push Notification Service (APNs)
      
      // For now, we'll log the notification
      logger.info(`Push notification would be sent to ${user.pushTokens.length} devices:`, {
        userId: user._id,
        title: pushConfig.title,
        body: pushConfig.body,
        type: notification.type
      });

      // TODO: Implement actual push notification sending
      // await this.fcmService.sendToTokens(user.pushTokens, pushConfig);

    } catch (error) {
      logger.error('Error sending push notification:', error);
    }
  }

  /**
   * Send email notification
   */
  private async sendEmailNotification(
    user: any,
    notification: NotificationPayload,
    conversation?: any
  ): Promise<void> {
    try {
      // Check if user has email notifications enabled
      if (!this.shouldSendEmailNotification(user, notification.type)) {
        return;
      }

      const emailData = {
        to: user.email,
        subject: notification.title,
        template: this.getEmailTemplate(notification.type),
        data: {
          userName: `${user.firstName} ${user.lastName}`,
          notificationTitle: notification.title,
          notificationBody: notification.body,
          conversationTitle: conversation?.title,
          senderName: notification.data?.senderName,
          actionUrl: this.getActionUrl(notification),
          unsubscribeUrl: `${process.env.FRONTEND_URL}/settings/notifications?token=${user._id}`
        }
      };

      // Send email using the email service
      const result = await emailService.sendEmail({
        to: user.email,
        subject: emailData.subject,
        html: `
          <h2>${emailData.data.notificationTitle}</h2>
          <p>Hello ${emailData.data.userName}!</p>
          <p>${emailData.data.notificationBody}</p>
          ${emailData.data.actionUrl ? `<p><a href="${emailData.data.actionUrl}">View Details</a></p>` : ''}
          <p><a href="${emailData.data.unsubscribeUrl}">Unsubscribe</a></p>
        `,
        text: `
          ${emailData.data.notificationTitle}

          Hello ${emailData.data.userName}!

          ${emailData.data.notificationBody}

          ${emailData.data.actionUrl ? `View details: ${emailData.data.actionUrl}` : ''}

          Unsubscribe: ${emailData.data.unsubscribeUrl}
        `
      });

      if (result.success) {
        logger.info(`Email notification sent to ${user.email}:`, {
          subject: emailData.subject,
          messageId: result.messageId
        });
      } else {
        logger.error(`Failed to send email notification to ${user.email}:`, result.error);
      }

    } catch (error) {
      logger.error('Error sending email notification:', error);
    }
  }

  /**
   * Check if notification should be sent
   */
  private shouldSendNotification(user: any, type: string): boolean {
    if (!user.notificationSettings) {
      return true; // Default to enabled
    }

    const settings = user.notificationSettings;
    
    switch (type) {
      case 'message':
        return settings.messages !== false;
      case 'match':
        return settings.matches !== false;
      case 'system':
        return settings.system !== false;
      default:
        return true;
    }
  }

  /**
   * Check if email notification should be sent
   */
  private shouldSendEmailNotification(user: any, type: string): boolean {
    if (!user.notificationSettings?.email) {
      return false;
    }

    const emailSettings = user.notificationSettings.email;
    
    switch (type) {
      case 'message':
        return emailSettings.messages !== false;
      case 'match':
        return emailSettings.matches !== false;
      case 'system':
        return emailSettings.system !== false;
      default:
        return false;
    }
  }

  /**
   * Get message notification title
   */
  private getMessageNotificationTitle(sender: any, conversation: any): string {
    if (conversation.conversationType === 'direct') {
      return `${sender.firstName} ${sender.lastName}`;
    } else {
      return conversation.title || 'Group Message';
    }
  }

  /**
   * Get message notification body
   */
  private getMessageNotificationBody(message: any): string {
    switch (message.messageType) {
      case 'text':
        return message.content.length > 100 
          ? `${message.content.substring(0, 100)}...`
          : message.content;
      case 'image':
        return '📷 Sent a photo';
      case 'file':
        return '📎 Sent a file';
      case 'location':
        return '📍 Shared location';
      case 'property_share':
        return '🏠 Shared a property';
      case 'system':
        return message.content;
      default:
        return 'Sent a message';
    }
  }

  /**
   * Get click action URL
   */
  private getClickAction(notification: NotificationPayload): string {
    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    
    switch (notification.type) {
      case 'message':
        return `${baseUrl}/messages/${notification.data?.conversationId}`;
      case 'match':
        return `${baseUrl}/matches`;
      case 'system':
        return `${baseUrl}/notifications`;
      default:
        return baseUrl;
    }
  }

  /**
   * Get action URL for emails
   */
  private getActionUrl(notification: NotificationPayload): string {
    return this.getClickAction(notification);
  }

  /**
   * Get email template name
   */
  private getEmailTemplate(type: string): string {
    switch (type) {
      case 'message':
        return 'new-message';
      case 'match':
        return 'new-match';
      case 'system':
        return 'system-notification';
      default:
        return 'general-notification';
    }
  }

  /**
   * Schedule notification cleanup
   */
  public async cleanupExpiredNotifications(): Promise<void> {
    try {
      // This would clean up stored notifications from database
      // For now, we'll just log
      logger.info('Cleaning up expired notifications');
      
      // Clean up expired notifications using the new model
      const result = await Notification.deleteMany({ expiresAt: { $lt: new Date() } });
      logger.info(`Cleaned up ${result.deletedCount} expired notifications`);
      
    } catch (error) {
      logger.error('Error cleaning up notifications:', error);
    }
  }

  /**
   * Get notification statistics
   */
  public async getNotificationStats(_userId: string): Promise<{
    totalSent: number;
    totalRead: number;
    totalUnread: number;
    byType: { [key: string]: number };
  }> {
    try {
      // Get notification statistics from the new model
      const [totalSent, totalRead, totalUnread, byType] = await Promise.all([
        Notification.countDocuments({ userId }),
        Notification.countDocuments({ userId, read: true }),
        Notification.countDocuments({ userId, read: false, dismissed: false }),
        Notification.aggregate([
          { $match: { userId } },
          { $group: { _id: '$type', count: { $sum: 1 } } }
        ])
      ]);

      const typeStats = byType.reduce((acc: any, item: any) => {
        acc[item._id] = item.count;
        return acc;
      }, {});

      return {
        totalSent,
        totalRead,
        totalUnread,
        byType: typeStats
      };
    } catch (error) {
      logger.error('Error getting notification stats:', error);
      return {
        totalSent: 0,
        totalRead: 0,
        totalUnread: 0,
        byType: {}
      };
    }
  }
}
