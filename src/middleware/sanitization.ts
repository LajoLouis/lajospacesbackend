import { Request, Response, NextFunction } from 'express';
import DOMPurify from 'isomorphic-dompurify';
import validator from 'validator';
import { logger } from '../utils/logger';
import { AppError } from '../utils/appError';

// Sanitization options
export interface SanitizationOptions {
  allowedTags?: string[];
  allowedAttributes?: { [key: string]: string[] };
  stripTags?: boolean;
  escapeHtml?: boolean;
  normalizeEmail?: boolean;
  trimWhitespace?: boolean;
  removeNullBytes?: boolean;
  maxLength?: number;
}

// Default sanitization options
const defaultOptions: SanitizationOptions = {
  allowedTags: ['b', 'i', 'em', 'strong', 'p', 'br'],
  allowedAttributes: {},
  stripTags: true,
  escapeHtml: true,
  normalizeEmail: true,
  trimWhitespace: true,
  removeNullBytes: true,
  maxLength: 10000
};

// Dangerous patterns to detect and block
const dangerousPatterns = [
  // SQL Injection patterns
  /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION|SCRIPT)\b)/gi,
  // XSS patterns
  /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
  /javascript:/gi,
  /on\w+\s*=/gi,
  // NoSQL Injection patterns
  /\$where/gi,
  /\$ne/gi,
  /\$gt/gi,
  /\$lt/gi,
  // Command injection patterns
  /[;&|`$()]/g,
  // Path traversal patterns
  /\.\.\//g,
  /\.\.\\/g
];

// Nigerian-specific validation patterns
const nigerianPatterns = {
  phoneNumber: /^(\+234|234|0)[789][01]\d{8}$/,
  bankAccount: /^\d{10}$/,
  bvn: /^\d{11}$/,
  nin: /^\d{11}$/,
  postalCode: /^\d{6}$/
};

/**
 * Sanitize a string value
 */
export function sanitizeString(value: string, options: SanitizationOptions = {}): string {
  if (typeof value !== 'string') {
    return String(value);
  }

  const opts = { ...defaultOptions, ...options };
  let sanitized = value;

  // Remove null bytes
  if (opts.removeNullBytes) {
    sanitized = sanitized.replace(/\0/g, '');
  }

  // Trim whitespace
  if (opts.trimWhitespace) {
    sanitized = sanitized.trim();
  }

  // Check length
  if (opts.maxLength && sanitized.length > opts.maxLength) {
    sanitized = sanitized.substring(0, opts.maxLength);
  }

  // Strip or escape HTML
  if (opts.stripTags) {
    sanitized = DOMPurify.sanitize(sanitized, {
      ALLOWED_TAGS: opts.allowedTags || [],
      ALLOWED_ATTR: opts.allowedAttributes || {},
      KEEP_CONTENT: true
    });
  } else if (opts.escapeHtml) {
    sanitized = validator.escape(sanitized);
  }

  return sanitized;
}

/**
 * Sanitize email address
 */
export function sanitizeEmail(email: string, normalize: boolean = true): string {
  if (!email || typeof email !== 'string') {
    return '';
  }

  let sanitized = email.trim().toLowerCase();

  if (normalize) {
    try {
      sanitized = validator.normalizeEmail(sanitized) || sanitized;
    } catch (error) {
      // If normalization fails, continue with basic sanitization
    }
  }

  return sanitized;
}

/**
 * Sanitize phone number (Nigerian format)
 */
export function sanitizePhoneNumber(phone: string): string {
  if (!phone || typeof phone !== 'string') {
    return '';
  }

  // Remove all non-digit characters except +
  let sanitized = phone.replace(/[^\d+]/g, '');

  // Normalize Nigerian phone numbers
  if (sanitized.startsWith('0')) {
    sanitized = '+234' + sanitized.substring(1);
  } else if (sanitized.startsWith('234')) {
    sanitized = '+' + sanitized;
  } else if (!sanitized.startsWith('+234')) {
    // Assume it's a local number without country code
    if (sanitized.length === 10) {
      sanitized = '+234' + sanitized;
    }
  }

  return sanitized;
}

/**
 * Validate Nigerian-specific data
 */
export function validateNigerianData(type: string, value: string): boolean {
  if (!value || typeof value !== 'string') {
    return false;
  }

  const pattern = nigerianPatterns[type as keyof typeof nigerianPatterns];
  return pattern ? pattern.test(value) : false;
}

/**
 * Detect dangerous patterns in input
 */
export function detectDangerousPatterns(input: string): string[] {
  const detected: string[] = [];

  for (const pattern of dangerousPatterns) {
    if (pattern.test(input)) {
      detected.push(pattern.source);
    }
  }

  return detected;
}

/**
 * Sanitize object recursively
 */
export function sanitizeObject(obj: any, options: SanitizationOptions = {}): any {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj === 'string') {
    return sanitizeString(obj, options);
  }

  if (typeof obj === 'number' || typeof obj === 'boolean') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item, options));
  }

  if (typeof obj === 'object') {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(obj)) {
      // Sanitize the key as well
      const sanitizedKey = sanitizeString(key, { stripTags: true, maxLength: 100 });
      sanitized[sanitizedKey] = sanitizeObject(value, options);
    }
    return sanitized;
  }

  return obj;
}

/**
 * Middleware for request sanitization
 */
export function sanitizeRequest(options: SanitizationOptions = {}) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      // Sanitize request body
      if (req.body && typeof req.body === 'object') {
        req.body = sanitizeObject(req.body, options);
      }

      // Sanitize query parameters
      if (req.query && typeof req.query === 'object') {
        req.query = sanitizeObject(req.query, options);
      }

      // Sanitize URL parameters
      if (req.params && typeof req.params === 'object') {
        req.params = sanitizeObject(req.params, options);
      }

      // Check for dangerous patterns in critical fields
      const criticalFields = [
        ...(req.body ? Object.values(req.body) : []),
        ...(req.query ? Object.values(req.query) : []),
        ...(req.params ? Object.values(req.params) : [])
      ];

      for (const field of criticalFields) {
        if (typeof field === 'string') {
          const dangerous = detectDangerousPatterns(field);
          if (dangerous.length > 0) {
            logger.warn('Dangerous patterns detected in request', {
              ip: req.ip,
              userAgent: req.get('User-Agent'),
              path: req.path,
              method: req.method,
              patterns: dangerous,
              userId: req.user?._id
            });

            // Optionally block the request
            if (options.stripTags) {
              throw new AppError('Invalid input detected', 400, true, 'INVALID_INPUT');
            }
          }
        }
      }

      next();
    } catch (error) {
      logger.error('Request sanitization error:', error);
      next(error);
    }
  };
}

/**
 * Strict sanitization for sensitive operations
 */
export function strictSanitization() {
  return sanitizeRequest({
    allowedTags: [],
    allowedAttributes: {},
    stripTags: true,
    escapeHtml: true,
    normalizeEmail: true,
    trimWhitespace: true,
    removeNullBytes: true,
    maxLength: 1000
  });
}

/**
 * Lenient sanitization for content that may contain formatting
 */
export function lenientSanitization() {
  return sanitizeRequest({
    allowedTags: ['b', 'i', 'em', 'strong', 'p', 'br', 'ul', 'ol', 'li'],
    allowedAttributes: {},
    stripTags: false,
    escapeHtml: false,
    normalizeEmail: true,
    trimWhitespace: true,
    removeNullBytes: true,
    maxLength: 50000
  });
}

/**
 * Email-specific sanitization
 */
export function emailSanitization() {
  return (req: Request, res: Response, next: NextFunction) => {
    if (req.body.email) {
      req.body.email = sanitizeEmail(req.body.email);
    }
    if (req.query.email) {
      req.query.email = sanitizeEmail(req.query.email as string);
    }
    next();
  };
}

/**
 * Phone number sanitization for Nigerian numbers
 */
export function phoneNumberSanitization() {
  return (req: Request, res: Response, next: NextFunction) => {
    const phoneFields = ['phone', 'phoneNumber', 'mobile', 'contact'];
    
    for (const field of phoneFields) {
      if (req.body[field]) {
        req.body[field] = sanitizePhoneNumber(req.body[field]);
      }
    }
    
    next();
  };
}

/**
 * File upload sanitization
 */
export function fileUploadSanitization() {
  return (req: Request, res: Response, next: NextFunction) => {
    if (req.file) {
      // Sanitize filename
      req.file.originalname = sanitizeString(req.file.originalname, {
        stripTags: true,
        maxLength: 255
      });
    }

    if (req.files && Array.isArray(req.files)) {
      req.files.forEach(file => {
        file.originalname = sanitizeString(file.originalname, {
          stripTags: true,
          maxLength: 255
        });
      });
    }

    next();
  };
}

/**
 * Search query sanitization
 */
export function searchQuerySanitization() {
  return (req: Request, res: Response, next: NextFunction) => {
    const searchFields = ['q', 'query', 'search', 'term', 'keyword'];
    
    for (const field of searchFields) {
      if (req.query[field]) {
        req.query[field] = sanitizeString(req.query[field] as string, {
          stripTags: true,
          maxLength: 500
        });
      }
    }
    
    next();
  };
}

/**
 * Nigerian data validation middleware
 */
export function nigerianDataValidation() {
  return (req: Request, res: Response, next: NextFunction) => {
    const validationRules = {
      phoneNumber: 'phoneNumber',
      phone: 'phoneNumber',
      mobile: 'phoneNumber',
      bankAccount: 'bankAccount',
      accountNumber: 'bankAccount',
      bvn: 'bvn',
      nin: 'nin',
      postalCode: 'postalCode',
      zipCode: 'postalCode'
    };

    for (const [field, type] of Object.entries(validationRules)) {
      if (req.body[field]) {
        const isValid = validateNigerianData(type, req.body[field]);
        if (!isValid) {
          throw new AppError(`Invalid ${field} format for Nigerian data`, 400, true, 'INVALID_FORMAT');
        }
      }
    }

    next();
  };
}

/**
 * Content sanitization for user-generated content
 */
export function contentSanitization() {
  return sanitizeRequest({
    allowedTags: ['p', 'br', 'b', 'i', 'em', 'strong', 'ul', 'ol', 'li'],
    allowedAttributes: {},
    stripTags: false,
    escapeHtml: false,
    trimWhitespace: true,
    removeNullBytes: true,
    maxLength: 10000
  });
}

export default {
  sanitizeString,
  sanitizeEmail,
  sanitizePhoneNumber,
  validateNigerianData,
  detectDangerousPatterns,
  sanitizeObject,
  sanitizeRequest,
  strictSanitization,
  lenientSanitization,
  emailSanitization,
  phoneNumberSanitization,
  fileUploadSanitization,
  searchQuerySanitization,
  nigerianDataValidation,
  contentSanitization
};
