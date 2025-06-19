import { Request, Response } from 'express';
import { Types } from 'mongoose';
import { catchAsync } from '../utils/catchAsync';
import { AppError } from '../utils/appError';
import { logger } from '../utils/logger';
import { 
  Notification, 
  NotificationType, 
  NotificationPriority, 
  NotificationChannel 
} from '../models/notification.model';
import { EmailPreferences } from '../models/emailPreferences.model';
import { User } from '../models/User.model';

/**
 * Get user notifications
 */
export const getUserNotifications = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?._id;
  const { 
    page = 1, 
    limit = 20, 
    unreadOnly = false, 
    type 
  } = req.query;

  if (!userId) {
    throw new AppError('User not authenticated', 401);
  }

  const options = {
    page: parseInt(page as string),
    limit: Math.min(parseInt(limit as string), 50), // Max 50 per page
    unreadOnly: unreadOnly === 'true',
    type: type as NotificationType
  };

  // Build query
  const query: any = { 
    userId,
    dismissed: false,
    $or: [
      { expiresAt: { $exists: false } },
      { expiresAt: { $gt: new Date() } }
    ]
  };

  if (options.unreadOnly) {
    query.read = false;
  }

  if (options.type && Object.values(NotificationType).includes(options.type)) {
    query.type = options.type;
  }

  const skip = (options.page - 1) * options.limit;

  // Get notifications
  const notifications = await Notification.find(query)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(options.limit)
    .lean();

  // Get total count
  const total = await Notification.countDocuments(query);

  // Get unread count
  const unreadCount = await Notification.countDocuments({
    userId,
    read: false,
    dismissed: false,
    $or: [
      { expiresAt: { $exists: false } },
      { expiresAt: { $gt: new Date() } }
    ]
  });

  return res.json({
    success: true,
    data: {
      notifications,
      pagination: {
        page: options.page,
        limit: options.limit,
        total,
        pages: Math.ceil(total / options.limit),
        hasMore: total > skip + notifications.length
      },
      unreadCount
    }
  });
});

/**
 * Mark notification as read
 */
export const markNotificationAsRead = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?._id;
  const { notificationId } = req.params;

  if (!userId) {
    throw new AppError('User not authenticated', 401);
  }

  if (!Types.ObjectId.isValid(notificationId)) {
    throw new AppError('Invalid notification ID', 400);
  }

  const notification = await Notification.findOne({
    _id: notificationId,
    userId
  });

  if (!notification) {
    throw new AppError('Notification not found', 404);
  }

  await notification.markAsRead();

  logger.info('Notification marked as read', {
    userId,
    notificationId
  });

  return res.json({
    success: true,
    message: 'Notification marked as read',
    data: {
      notification
    }
  });
});

/**
 * Mark all notifications as read
 */
export const markAllNotificationsAsRead = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?._id;

  if (!userId) {
    throw new AppError('User not authenticated', 401);
  }

  const result = await Notification.updateMany(
    {
      userId,
      read: false,
      dismissed: false
    },
    {
      $set: {
        read: true,
        readAt: new Date()
      }
    }
  );

  logger.info('All notifications marked as read', {
    userId,
    modifiedCount: result.modifiedCount
  });

  return res.json({
    success: true,
    message: 'All notifications marked as read',
    data: {
      modifiedCount: result.modifiedCount
    }
  });
});

/**
 * Dismiss notification
 */
export const dismissNotification = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?._id;
  const { notificationId } = req.params;

  if (!userId) {
    throw new AppError('User not authenticated', 401);
  }

  if (!Types.ObjectId.isValid(notificationId)) {
    throw new AppError('Invalid notification ID', 400);
  }

  const notification = await Notification.findOne({
    _id: notificationId,
    userId
  });

  if (!notification) {
    throw new AppError('Notification not found', 404);
  }

  await notification.dismiss();

  logger.info('Notification dismissed', {
    userId,
    notificationId
  });

  return res.json({
    success: true,
    message: 'Notification dismissed',
    data: {
      notification
    }
  });
});

/**
 * Get notification statistics
 */
export const getNotificationStats = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?._id;

  if (!userId) {
    throw new AppError('User not authenticated', 401);
  }

  // Get various counts
  const [
    totalNotifications,
    unreadNotifications,
    dismissedNotifications,
    notificationsByType,
    notificationsByPriority,
    recentNotifications
  ] = await Promise.all([
    // Total notifications
    Notification.countDocuments({ userId }),
    
    // Unread notifications
    Notification.countDocuments({
      userId,
      read: false,
      dismissed: false,
      $or: [
        { expiresAt: { $exists: false } },
        { expiresAt: { $gt: new Date() } }
      ]
    }),
    
    // Dismissed notifications
    Notification.countDocuments({
      userId,
      dismissed: true
    }),
    
    // Notifications by type
    Notification.aggregate([
      { $match: { userId: new Types.ObjectId(userId) } },
      { $group: { _id: '$type', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]),
    
    // Notifications by priority
    Notification.aggregate([
      { $match: { userId: new Types.ObjectId(userId) } },
      { $group: { _id: '$priority', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]),
    
    // Recent notifications (last 7 days)
    Notification.countDocuments({
      userId,
      createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
    })
  ]);

  return res.json({
    success: true,
    data: {
      total: totalNotifications,
      unread: unreadNotifications,
      dismissed: dismissedNotifications,
      recent: recentNotifications,
      byType: notificationsByType.reduce((acc, item) => {
        acc[item._id] = item.count;
        return acc;
      }, {}),
      byPriority: notificationsByPriority.reduce((acc, item) => {
        acc[item._id] = item.count;
        return acc;
      }, {})
    }
  });
});

/**
 * Get email preferences
 */
export const getEmailPreferences = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?._id;

  if (!userId) {
    throw new AppError('User not authenticated', 401);
  }

  let preferences = await EmailPreferences.findOne({ userId });

  // Create default preferences if they don't exist
  if (!preferences) {
    preferences = await EmailPreferences.create({
      userId,
      preferences: {
        accountSecurity: {
          loginAlerts: true,
          passwordChanges: true,
          emailChanges: true,
          securityAlerts: true
        },
        propertyUpdates: {
          newListings: true,
          priceChanges: true,
          statusUpdates: true,
          favoriteUpdates: true,
          nearbyProperties: false
        },
        roommateMatching: {
          newMatches: true,
          matchRequests: true,
          matchAcceptance: true,
          profileViews: false,
          compatibilityUpdates: true
        },
        messaging: {
          newMessages: true,
          messageRequests: true,
          conversationUpdates: false,
          offlineMessages: true
        },
        marketing: {
          newsletters: true,
          promotions: false,
          tips: true,
          surveys: false,
          productUpdates: true
        },
        system: {
          maintenanceAlerts: true,
          systemUpdates: true,
          policyChanges: true,
          featureAnnouncements: true
        }
      }
    });
  }

  return res.json({
    success: true,
    data: {
      preferences
    }
  });
});

/**
 * Update email preferences
 */
export const updateEmailPreferences = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?._id;
  const { preferences, globalSettings, deliverySettings } = req.body;

  if (!userId) {
    throw new AppError('User not authenticated', 401);
  }

  let emailPreferences = await EmailPreferences.findOne({ userId });

  if (!emailPreferences) {
    // Create new preferences
    emailPreferences = new EmailPreferences({
      userId,
      preferences: preferences || {},
      globalSettings: globalSettings || {},
      deliverySettings: deliverySettings || {}
    });
  } else {
    // Update existing preferences
    if (preferences) {
      emailPreferences.preferences = { ...emailPreferences.preferences, ...preferences };
    }
    if (globalSettings) {
      emailPreferences.globalSettings = { ...emailPreferences.globalSettings, ...globalSettings };
    }
    if (deliverySettings) {
      emailPreferences.deliverySettings = { ...emailPreferences.deliverySettings, ...deliverySettings };
    }
    emailPreferences.lastUpdated = new Date();
    emailPreferences.updatedBy = 'user';
  }

  await emailPreferences.save();

  logger.info('Email preferences updated', {
    userId,
    updatedFields: Object.keys(req.body)
  });

  return res.json({
    success: true,
    message: 'Email preferences updated successfully',
    data: {
      preferences: emailPreferences
    }
  });
});

/**
 * Unsubscribe from all emails
 */
export const unsubscribeFromAllEmails = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?._id;

  if (!userId) {
    throw new AppError('User not authenticated', 401);
  }

  let emailPreferences = await EmailPreferences.findOne({ userId });

  if (!emailPreferences) {
    emailPreferences = await EmailPreferences.createDefault(new Types.ObjectId(userId));
  }

  await emailPreferences.unsubscribeAll();

  logger.info('User unsubscribed from all emails', { userId });

  return res.json({
    success: true,
    message: 'Successfully unsubscribed from all emails',
    data: {
      unsubscribed: true,
      timestamp: new Date().toISOString()
    }
  });
});

/**
 * Resubscribe to emails
 */
export const resubscribeToEmails = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?._id;

  if (!userId) {
    throw new AppError('User not authenticated', 401);
  }

  let emailPreferences = await EmailPreferences.findOne({ userId });

  if (!emailPreferences) {
    emailPreferences = await EmailPreferences.createDefault(new Types.ObjectId(userId));
  } else {
    await emailPreferences.resubscribe();
  }

  logger.info('User resubscribed to emails', { userId });

  return res.json({
    success: true,
    message: 'Successfully resubscribed to emails',
    data: {
      resubscribed: true,
      timestamp: new Date().toISOString()
    }
  });
});
