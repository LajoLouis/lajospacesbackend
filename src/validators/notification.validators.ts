import Joi from 'joi';

/**
 * Get user notifications validation schema
 */
export const getUserNotificationsSchema = Joi.object({
  page: Joi.number()
    .integer()
    .min(1)
    .default(1)
    .optional()
    .messages({
      'number.integer': 'Page must be an integer',
      'number.min': 'Page must be at least 1'
    }),
  
  limit: Joi.number()
    .integer()
    .min(1)
    .max(50)
    .default(20)
    .optional()
    .messages({
      'number.integer': 'Limit must be an integer',
      'number.min': 'Limit must be at least 1',
      'number.max': 'Limit cannot exceed 50'
    }),
  
  unreadOnly: Joi.boolean()
    .default(false)
    .optional(),
  
  type: Joi.string()
    .valid(
      'welcome',
      'email_verified',
      'profile_updated',
      'property_posted',
      'property_approved',
      'property_rejected',
      'property_expired',
      'property_favorited',
      'new_match',
      'match_request',
      'match_accepted',
      'match_declined',
      'new_message',
      'message_request',
      'system_announcement',
      'maintenance',
      'security_alert',
      'payment_success',
      'payment_failed',
      'subscription_expiring'
    )
    .optional()
    .messages({
      'any.only': 'Invalid notification type'
    })
});

/**
 * Create notification validation schema
 */
export const createNotificationSchema = Joi.object({
  userId: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .required()
    .messages({
      'string.pattern.base': 'Invalid user ID format',
      'any.required': 'User ID is required'
    }),
  
  type: Joi.string()
    .valid(
      'welcome',
      'email_verified',
      'profile_updated',
      'property_posted',
      'property_approved',
      'property_rejected',
      'property_expired',
      'property_favorited',
      'new_match',
      'match_request',
      'match_accepted',
      'match_declined',
      'new_message',
      'message_request',
      'system_announcement',
      'maintenance',
      'security_alert',
      'payment_success',
      'payment_failed',
      'subscription_expiring'
    )
    .required()
    .messages({
      'any.only': 'Invalid notification type',
      'any.required': 'Notification type is required'
    }),
  
  title: Joi.string()
    .trim()
    .min(1)
    .max(200)
    .required()
    .messages({
      'string.min': 'Title must be at least 1 character',
      'string.max': 'Title cannot exceed 200 characters',
      'any.required': 'Title is required'
    }),
  
  message: Joi.string()
    .trim()
    .min(1)
    .max(1000)
    .required()
    .messages({
      'string.min': 'Message must be at least 1 character',
      'string.max': 'Message cannot exceed 1000 characters',
      'any.required': 'Message is required'
    }),
  
  priority: Joi.string()
    .valid('low', 'medium', 'high', 'urgent')
    .default('medium')
    .optional()
    .messages({
      'any.only': 'Priority must be low, medium, high, or urgent'
    }),
  
  channels: Joi.array()
    .items(
      Joi.string().valid('in_app', 'email', 'push', 'sms')
    )
    .min(1)
    .default(['in_app'])
    .optional()
    .messages({
      'array.min': 'At least one notification channel is required',
      'any.only': 'Invalid notification channel'
    }),
  
  relatedEntity: Joi.object({
    type: Joi.string()
      .valid('user', 'property', 'match', 'message', 'conversation')
      .required()
      .messages({
        'any.only': 'Invalid related entity type',
        'any.required': 'Related entity type is required'
      }),
    
    id: Joi.string()
      .pattern(/^[0-9a-fA-F]{24}$/)
      .required()
      .messages({
        'string.pattern.base': 'Invalid related entity ID format',
        'any.required': 'Related entity ID is required'
      })
  }).optional(),
  
  data: Joi.object()
    .optional()
    .default({}),
  
  expiresAt: Joi.date()
    .iso()
    .min('now')
    .optional()
    .messages({
      'date.min': 'Expiration date cannot be in the past'
    }),
  
  sendImmediately: Joi.boolean()
    .default(true)
    .optional()
});

/**
 * Update email preferences validation schema
 */
export const updateEmailPreferencesSchema = Joi.object({
  preferences: Joi.object({
    accountSecurity: Joi.object({
      loginAlerts: Joi.boolean().optional(),
      passwordChanges: Joi.boolean().optional(),
      emailChanges: Joi.boolean().optional(),
      securityAlerts: Joi.boolean().optional()
    }).optional(),
    
    propertyUpdates: Joi.object({
      newListings: Joi.boolean().optional(),
      priceChanges: Joi.boolean().optional(),
      statusUpdates: Joi.boolean().optional(),
      favoriteUpdates: Joi.boolean().optional(),
      nearbyProperties: Joi.boolean().optional()
    }).optional(),
    
    roommateMatching: Joi.object({
      newMatches: Joi.boolean().optional(),
      matchRequests: Joi.boolean().optional(),
      matchAcceptance: Joi.boolean().optional(),
      profileViews: Joi.boolean().optional(),
      compatibilityUpdates: Joi.boolean().optional()
    }).optional(),
    
    messaging: Joi.object({
      newMessages: Joi.boolean().optional(),
      messageRequests: Joi.boolean().optional(),
      conversationUpdates: Joi.boolean().optional(),
      offlineMessages: Joi.boolean().optional()
    }).optional(),
    
    marketing: Joi.object({
      newsletters: Joi.boolean().optional(),
      promotions: Joi.boolean().optional(),
      tips: Joi.boolean().optional(),
      surveys: Joi.boolean().optional(),
      productUpdates: Joi.boolean().optional()
    }).optional(),
    
    system: Joi.object({
      maintenanceAlerts: Joi.boolean().optional(),
      systemUpdates: Joi.boolean().optional(),
      policyChanges: Joi.boolean().optional(),
      featureAnnouncements: Joi.boolean().optional()
    }).optional()
  }).optional(),
  
  globalSettings: Joi.object({
    emailEnabled: Joi.boolean().optional(),
    
    frequency: Joi.string()
      .valid('immediate', 'daily', 'weekly', 'monthly', 'never')
      .optional()
      .messages({
        'any.only': 'Frequency must be immediate, daily, weekly, monthly, or never'
      }),
    
    quietHours: Joi.object({
      enabled: Joi.boolean().optional(),
      
      startTime: Joi.string()
        .pattern(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/)
        .optional()
        .messages({
          'string.pattern.base': 'Start time must be in HH:MM format'
        }),
      
      endTime: Joi.string()
        .pattern(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/)
        .optional()
        .messages({
          'string.pattern.base': 'End time must be in HH:MM format'
        }),
      
      timezone: Joi.string()
        .optional()
        .default('Africa/Lagos')
    }).optional(),
    
    unsubscribeAll: Joi.boolean().optional()
  }).optional(),
  
  deliverySettings: Joi.object({
    format: Joi.string()
      .valid('html', 'text', 'both')
      .optional()
      .messages({
        'any.only': 'Format must be html, text, or both'
      }),
    
    language: Joi.string()
      .length(2)
      .optional()
      .default('en')
      .messages({
        'string.length': 'Language must be a 2-character code'
      }),
    
    timezone: Joi.string()
      .optional()
      .default('Africa/Lagos')
  }).optional()
});

/**
 * Bulk notification validation schema
 */
export const bulkNotificationSchema = Joi.object({
  userIds: Joi.array()
    .items(
      Joi.string().pattern(/^[0-9a-fA-F]{24}$/)
    )
    .min(1)
    .max(1000)
    .required()
    .messages({
      'array.min': 'At least one user ID is required',
      'array.max': 'Maximum 1000 users allowed',
      'string.pattern.base': 'Invalid user ID format',
      'any.required': 'User IDs are required'
    }),
  
  type: Joi.string()
    .valid(
      'welcome',
      'email_verified',
      'profile_updated',
      'property_posted',
      'property_approved',
      'property_rejected',
      'property_expired',
      'property_favorited',
      'new_match',
      'match_request',
      'match_accepted',
      'match_declined',
      'new_message',
      'message_request',
      'system_announcement',
      'maintenance',
      'security_alert',
      'payment_success',
      'payment_failed',
      'subscription_expiring'
    )
    .required()
    .messages({
      'any.only': 'Invalid notification type',
      'any.required': 'Notification type is required'
    }),
  
  title: Joi.string()
    .trim()
    .min(1)
    .max(200)
    .required()
    .messages({
      'string.min': 'Title must be at least 1 character',
      'string.max': 'Title cannot exceed 200 characters',
      'any.required': 'Title is required'
    }),
  
  message: Joi.string()
    .trim()
    .min(1)
    .max(1000)
    .required()
    .messages({
      'string.min': 'Message must be at least 1 character',
      'string.max': 'Message cannot exceed 1000 characters',
      'any.required': 'Message is required'
    }),
  
  priority: Joi.string()
    .valid('low', 'medium', 'high', 'urgent')
    .default('medium')
    .optional()
    .messages({
      'any.only': 'Priority must be low, medium, high, or urgent'
    }),
  
  channels: Joi.array()
    .items(
      Joi.string().valid('in_app', 'email', 'push', 'sms')
    )
    .min(1)
    .default(['in_app'])
    .optional()
    .messages({
      'array.min': 'At least one notification channel is required',
      'any.only': 'Invalid notification channel'
    }),
  
  data: Joi.object()
    .optional()
    .default({}),
  
  scheduleAt: Joi.date()
    .iso()
    .min('now')
    .optional()
    .messages({
      'date.min': 'Schedule date cannot be in the past'
    })
});

/**
 * Notification analytics query validation schema
 */
export const notificationAnalyticsSchema = Joi.object({
  startDate: Joi.date()
    .iso()
    .optional()
    .messages({
      'date.base': 'Start date must be a valid date'
    }),
  
  endDate: Joi.date()
    .iso()
    .min(Joi.ref('startDate'))
    .optional()
    .messages({
      'date.base': 'End date must be a valid date',
      'date.min': 'End date must be after start date'
    }),
  
  type: Joi.string()
    .valid(
      'welcome',
      'email_verified',
      'profile_updated',
      'property_posted',
      'property_approved',
      'property_rejected',
      'property_expired',
      'property_favorited',
      'new_match',
      'match_request',
      'match_accepted',
      'match_declined',
      'new_message',
      'message_request',
      'system_announcement',
      'maintenance',
      'security_alert',
      'payment_success',
      'payment_failed',
      'subscription_expiring'
    )
    .optional()
    .messages({
      'any.only': 'Invalid notification type'
    }),
  
  channel: Joi.string()
    .valid('in_app', 'email', 'push', 'sms')
    .optional()
    .messages({
      'any.only': 'Invalid notification channel'
    }),
  
  priority: Joi.string()
    .valid('low', 'medium', 'high', 'urgent')
    .optional()
    .messages({
      'any.only': 'Invalid priority level'
    }),
  
  groupBy: Joi.string()
    .valid('day', 'week', 'month', 'type', 'channel', 'priority')
    .default('day')
    .optional()
    .messages({
      'any.only': 'Group by must be day, week, month, type, channel, or priority'
    })
});

export default {
  getUserNotificationsSchema,
  createNotificationSchema,
  updateEmailPreferencesSchema,
  bulkNotificationSchema,
  notificationAnalyticsSchema
};
