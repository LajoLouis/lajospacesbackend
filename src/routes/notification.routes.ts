import { Router } from 'express';
import {
  getUserNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  dismissNotification,
  getNotificationStats,
  getEmailPreferences,
  updateEmailPreferences,
  unsubscribeFromAllEmails,
  resubscribeToEmails
} from '../controllers/notification.controller';
import { authenticate } from '../middleware/auth';
import { validateRequest, validateObjectId } from '../middleware/validation';
import {
  getUserNotificationsSchema,
  updateEmailPreferencesSchema
} from '../validators/notification.validators';

const router = Router();

// All notification routes require authentication
router.use(authenticate);

/**
 * @route   GET /api/notifications
 * @desc    Get user notifications with pagination
 * @access  Private
 */
router.get(
  '/',
  validateRequest(getUserNotificationsSchema, 'query'),
  getUserNotifications
);

/**
 * @route   PUT /api/notifications/:notificationId/read
 * @desc    Mark notification as read
 * @access  Private
 */
router.put(
  '/:notificationId/read',
  validateObjectId('notificationId'),
  markNotificationAsRead
);

/**
 * @route   PUT /api/notifications/read-all
 * @desc    Mark all notifications as read
 * @access  Private
 */
router.put(
  '/read-all',
  markAllNotificationsAsRead
);

/**
 * @route   DELETE /api/notifications/:notificationId
 * @desc    Dismiss notification
 * @access  Private
 */
router.delete(
  '/:notificationId',
  validateObjectId('notificationId'),
  dismissNotification
);

/**
 * @route   GET /api/notifications/stats
 * @desc    Get notification statistics
 * @access  Private
 */
router.get(
  '/stats',
  getNotificationStats
);

/**
 * @route   GET /api/notifications/email-preferences
 * @desc    Get user email preferences
 * @access  Private
 */
router.get(
  '/email-preferences',
  getEmailPreferences
);

/**
 * @route   PUT /api/notifications/email-preferences
 * @desc    Update user email preferences
 * @access  Private
 */
router.put(
  '/email-preferences',
  validateRequest(updateEmailPreferencesSchema, 'body'),
  updateEmailPreferences
);

/**
 * @route   POST /api/notifications/unsubscribe-all
 * @desc    Unsubscribe from all emails
 * @access  Private
 */
router.post(
  '/unsubscribe-all',
  unsubscribeFromAllEmails
);

/**
 * @route   POST /api/notifications/resubscribe
 * @desc    Resubscribe to emails
 * @access  Private
 */
router.post(
  '/resubscribe',
  resubscribeToEmails
);

/**
 * @route   GET /api/notifications/health
 * @desc    Health check for notification service
 * @access  Private
 */
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Notification service is healthy',
    timestamp: new Date().toISOString(),
    features: {
      inAppNotifications: 'active',
      emailNotifications: 'active',
      pushNotifications: 'planned',
      smsNotifications: 'planned'
    }
  });
});

export default router;
