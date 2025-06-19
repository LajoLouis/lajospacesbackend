import Joi from 'joi';

/**
 * Send verification email validation schema
 */
export const sendVerificationEmailSchema = Joi.object({
  email: Joi.string()
    .email()
    .optional()
    .messages({
      'string.email': 'Please provide a valid email address'
    })
});

/**
 * Send password reset email validation schema
 */
export const sendPasswordResetEmailSchema = Joi.object({
  email: Joi.string()
    .email()
    .required()
    .messages({
      'string.email': 'Please provide a valid email address',
      'any.required': 'Email is required'
    })
});

/**
 * Send custom email validation schema
 */
export const sendCustomEmailSchema = Joi.object({
  recipientEmail: Joi.string()
    .email()
    .required()
    .messages({
      'string.email': 'Please provide a valid recipient email address',
      'any.required': 'Recipient email is required'
    }),
  
  templateType: Joi.string()
    .valid(
      'welcome',
      'email_verification',
      'password_reset',
      'password_changed',
      'new_message',
      'new_match',
      'property_posted',
      'property_approved',
      'system_notification',
      'newsletter',
      'security_alert'
    )
    .optional()
    .messages({
      'any.only': 'Invalid template type'
    }),
  
  templateData: Joi.object()
    .optional()
    .default({}),
  
  subject: Joi.string()
    .trim()
    .min(1)
    .max(200)
    .optional()
    .messages({
      'string.min': 'Subject must be at least 1 character',
      'string.max': 'Subject cannot exceed 200 characters'
    }),
  
  customContent: Joi.string()
    .trim()
    .min(1)
    .max(50000)
    .optional()
    .messages({
      'string.min': 'Custom content must be at least 1 character',
      'string.max': 'Custom content cannot exceed 50,000 characters'
    })
}).custom((value, helpers) => {
  // Either templateType or customContent must be provided
  if (!value.templateType && !value.customContent) {
    return helpers.error('custom.missingContent');
  }
  return value;
}).messages({
  'custom.missingContent': 'Either templateType or customContent must be provided'
});

/**
 * Preview email template validation schema
 */
export const previewEmailTemplateSchema = Joi.object({
  templateType: Joi.string()
    .valid(
      'welcome',
      'email_verification',
      'password_reset',
      'password_changed',
      'new_message',
      'new_match',
      'property_posted',
      'property_approved',
      'system_notification',
      'newsletter',
      'security_alert'
    )
    .required()
    .messages({
      'any.only': 'Invalid template type',
      'any.required': 'Template type is required'
    }),
  
  templateData: Joi.object()
    .optional()
    .default({}),
  
  format: Joi.string()
    .valid('html', 'text')
    .default('html')
    .optional()
    .messages({
      'any.only': 'Format must be either html or text'
    })
});

/**
 * Email configuration validation schema
 */
export const emailConfigSchema = Joi.object({
  host: Joi.string()
    .hostname()
    .required()
    .messages({
      'string.hostname': 'Please provide a valid SMTP host',
      'any.required': 'SMTP host is required'
    }),
  
  port: Joi.number()
    .integer()
    .min(1)
    .max(65535)
    .required()
    .messages({
      'number.integer': 'Port must be an integer',
      'number.min': 'Port must be at least 1',
      'number.max': 'Port cannot exceed 65535',
      'any.required': 'SMTP port is required'
    }),
  
  secure: Joi.boolean()
    .default(false)
    .optional(),
  
  user: Joi.string()
    .email()
    .required()
    .messages({
      'string.email': 'Please provide a valid email address for SMTP user',
      'any.required': 'SMTP user is required'
    }),
  
  password: Joi.string()
    .min(1)
    .required()
    .messages({
      'string.min': 'SMTP password cannot be empty',
      'any.required': 'SMTP password is required'
    }),
  
  fromName: Joi.string()
    .trim()
    .min(1)
    .max(100)
    .default('LajoSpaces')
    .optional()
    .messages({
      'string.min': 'From name must be at least 1 character',
      'string.max': 'From name cannot exceed 100 characters'
    }),
  
  fromAddress: Joi.string()
    .email()
    .required()
    .messages({
      'string.email': 'Please provide a valid from email address',
      'any.required': 'From email address is required'
    })
});

/**
 * Bulk email validation schema
 */
export const bulkEmailSchema = Joi.object({
  recipients: Joi.array()
    .items(
      Joi.object({
        email: Joi.string().email().required(),
        name: Joi.string().trim().min(1).max(100).optional(),
        templateData: Joi.object().optional()
      })
    )
    .min(1)
    .max(1000)
    .required()
    .messages({
      'array.min': 'At least one recipient is required',
      'array.max': 'Maximum 1000 recipients allowed',
      'any.required': 'Recipients list is required'
    }),
  
  templateType: Joi.string()
    .valid(
      'welcome',
      'email_verification',
      'password_reset',
      'password_changed',
      'new_message',
      'new_match',
      'property_posted',
      'property_approved',
      'system_notification',
      'newsletter',
      'security_alert'
    )
    .required()
    .messages({
      'any.only': 'Invalid template type',
      'any.required': 'Template type is required'
    }),
  
  globalTemplateData: Joi.object()
    .optional()
    .default({}),
  
  subject: Joi.string()
    .trim()
    .min(1)
    .max(200)
    .optional()
    .messages({
      'string.min': 'Subject must be at least 1 character',
      'string.max': 'Subject cannot exceed 200 characters'
    }),
  
  sendAt: Joi.date()
    .iso()
    .min('now')
    .optional()
    .messages({
      'date.min': 'Send date cannot be in the past'
    }),
  
  priority: Joi.string()
    .valid('high', 'normal', 'low')
    .default('normal')
    .optional()
    .messages({
      'any.only': 'Priority must be high, normal, or low'
    })
});

/**
 * Email delivery status validation schema
 */
export const emailDeliveryStatusSchema = Joi.object({
  messageId: Joi.string()
    .trim()
    .min(1)
    .required()
    .messages({
      'string.min': 'Message ID cannot be empty',
      'any.required': 'Message ID is required'
    }),
  
  status: Joi.string()
    .valid('sent', 'delivered', 'bounced', 'complained', 'rejected')
    .required()
    .messages({
      'any.only': 'Invalid delivery status',
      'any.required': 'Delivery status is required'
    }),
  
  timestamp: Joi.date()
    .iso()
    .default(() => new Date())
    .optional(),
  
  errorMessage: Joi.string()
    .trim()
    .max(1000)
    .optional()
    .messages({
      'string.max': 'Error message cannot exceed 1000 characters'
    }),
  
  recipientEmail: Joi.string()
    .email()
    .required()
    .messages({
      'string.email': 'Please provide a valid recipient email',
      'any.required': 'Recipient email is required'
    })
});

/**
 * Email analytics query validation schema
 */
export const emailAnalyticsQuerySchema = Joi.object({
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
  
  templateType: Joi.string()
    .valid(
      'welcome',
      'email_verification',
      'password_reset',
      'password_changed',
      'new_message',
      'new_match',
      'property_posted',
      'property_approved',
      'system_notification',
      'newsletter',
      'security_alert'
    )
    .optional()
    .messages({
      'any.only': 'Invalid template type'
    }),
  
  status: Joi.string()
    .valid('sent', 'delivered', 'bounced', 'complained', 'rejected')
    .optional()
    .messages({
      'any.only': 'Invalid status filter'
    }),
  
  groupBy: Joi.string()
    .valid('day', 'week', 'month', 'template', 'status')
    .default('day')
    .optional()
    .messages({
      'any.only': 'Group by must be day, week, month, template, or status'
    })
});

export default {
  sendVerificationEmailSchema,
  sendPasswordResetEmailSchema,
  sendCustomEmailSchema,
  previewEmailTemplateSchema,
  emailConfigSchema,
  bulkEmailSchema,
  emailDeliveryStatusSchema,
  emailAnalyticsQuerySchema
};
