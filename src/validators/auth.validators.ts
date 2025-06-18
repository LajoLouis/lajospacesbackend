import Joi from 'joi';

// Password validation schema
const passwordSchema = Joi.string()
  .min(8)
  .max(128)
  .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
  .required()
  .messages({
    'string.min': 'Password must be at least 8 characters long',
    'string.max': 'Password cannot exceed 128 characters',
    'string.pattern.base': 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character',
    'any.required': 'Password is required'
  });

// Email validation schema
const emailSchema = Joi.string()
  .email({ tlds: { allow: false } })
  .lowercase()
  .required()
  .messages({
    'string.email': 'Please provide a valid email address',
    'any.required': 'Email is required'
  });

// Nigerian phone number validation
const phoneSchema = Joi.string()
  .pattern(/^(\+234|234|0)?[789][01]\d{8}$/)
  .messages({
    'string.pattern.base': 'Please provide a valid Nigerian phone number (e.g., +2348012345678, 08012345678)'
  });

// Name validation schema
const nameSchema = Joi.string()
  .min(2)
  .max(50)
  .pattern(/^[a-zA-Z\s'-]+$/)
  .trim()
  .required()
  .messages({
    'string.min': 'Name must be at least 2 characters long',
    'string.max': 'Name cannot exceed 50 characters',
    'string.pattern.base': 'Name can only contain letters, spaces, hyphens, and apostrophes',
    'any.required': 'Name is required'
  });

// Date of birth validation (18-100 years old)
const dateOfBirthSchema = Joi.date()
  .max('now')
  .min(new Date(new Date().getFullYear() - 100, 0, 1))
  .custom((value, helpers) => {
    const age = new Date().getFullYear() - value.getFullYear();
    const monthDiff = new Date().getMonth() - value.getMonth();
    const dayDiff = new Date().getDate() - value.getDate();
    
    let actualAge = age;
    if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) {
      actualAge--;
    }
    
    if (actualAge < 18) {
      return helpers.error('date.min');
    }
    
    return value;
  })
  .required()
  .messages({
    'date.max': 'Date of birth cannot be in the future',
    'date.min': 'You must be at least 18 years old',
    'any.required': 'Date of birth is required'
  });

/**
 * User registration validation schema
 */
export const registerSchema = Joi.object({
  email: emailSchema,
  password: passwordSchema,
  firstName: nameSchema,
  lastName: nameSchema,
  dateOfBirth: dateOfBirthSchema,
  gender: Joi.string()
    .valid('male', 'female', 'non-binary', 'prefer-not-to-say')
    .required()
    .messages({
      'any.only': 'Gender must be one of: male, female, non-binary, prefer-not-to-say',
      'any.required': 'Gender is required'
    }),
  phoneNumber: phoneSchema.optional(),
  accountType: Joi.string()
    .valid('seeker', 'owner', 'both')
    .default('seeker')
    .messages({
      'any.only': 'Account type must be one of: seeker, owner, both'
    }),
  location: Joi.object({
    city: Joi.string().trim().max(100).optional(),
    state: Joi.string().trim().max(100).optional(),
    country: Joi.string().trim().max(100).default('Nigeria')
  }).optional(),
  agreeToTerms: Joi.boolean()
    .valid(true)
    .required()
    .messages({
      'any.only': 'You must agree to the terms and conditions',
      'any.required': 'Agreement to terms is required'
    })
});

/**
 * User login validation schema
 */
export const loginSchema = Joi.object({
  email: emailSchema,
  password: Joi.string()
    .required()
    .messages({
      'any.required': 'Password is required'
    }),
  rememberMe: Joi.boolean().default(false)
});

/**
 * Forgot password validation schema
 */
export const forgotPasswordSchema = Joi.object({
  email: emailSchema
});

/**
 * Reset password validation schema
 */
export const resetPasswordSchema = Joi.object({
  token: Joi.string()
    .required()
    .messages({
      'any.required': 'Reset token is required'
    }),
  password: passwordSchema,
  confirmPassword: Joi.string()
    .valid(Joi.ref('password'))
    .required()
    .messages({
      'any.only': 'Passwords do not match',
      'any.required': 'Password confirmation is required'
    })
});

/**
 * Change password validation schema
 */
export const changePasswordSchema = Joi.object({
  currentPassword: Joi.string()
    .required()
    .messages({
      'any.required': 'Current password is required'
    }),
  newPassword: passwordSchema,
  confirmPassword: Joi.string()
    .valid(Joi.ref('newPassword'))
    .required()
    .messages({
      'any.only': 'Passwords do not match',
      'any.required': 'Password confirmation is required'
    })
});

/**
 * Email verification validation schema
 */
export const verifyEmailSchema = Joi.object({
  token: Joi.string()
    .required()
    .messages({
      'any.required': 'Verification token is required'
    })
});

/**
 * Resend verification email schema
 */
export const resendVerificationSchema = Joi.object({
  email: emailSchema
});

/**
 * Refresh token validation schema
 */
export const refreshTokenSchema = Joi.object({
  refreshToken: Joi.string()
    .required()
    .messages({
      'any.required': 'Refresh token is required'
    })
});

/**
 * Update profile validation schema
 */
export const updateProfileSchema = Joi.object({
  firstName: nameSchema.optional(),
  lastName: nameSchema.optional(),
  phoneNumber: phoneSchema.optional().allow(''),
  location: Joi.object({
    city: Joi.string().trim().max(100).optional(),
    state: Joi.string().trim().max(100).optional(),
    country: Joi.string().trim().max(100).optional()
  }).optional(),
  preferences: Joi.object({
    emailNotifications: Joi.boolean().optional(),
    pushNotifications: Joi.boolean().optional(),
    smsNotifications: Joi.boolean().optional(),
    marketingEmails: Joi.boolean().optional()
  }).optional()
});

/**
 * Validation middleware factory
 */
export function validateRequest(schema: Joi.ObjectSchema) {
  return (req: any, res: any, next: any) => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true,
      convert: true
    });

    if (error) {
      const errorMessages = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }));

      return res.status(400).json({
        success: false,
        error: {
          message: 'Validation failed',
          code: 'VALIDATION_ERROR',
          statusCode: 400,
          timestamp: new Date().toISOString(),
          path: req.path,
          method: req.method,
          details: errorMessages
        }
      });
    }

    // Replace req.body with validated and sanitized data
    req.body = value;
    next();
  };
}

export default {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
  verifyEmailSchema,
  resendVerificationSchema,
  refreshTokenSchema,
  updateProfileSchema,
  validateRequest
};
