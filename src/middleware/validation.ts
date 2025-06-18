import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { AppError } from '../utils/appError';

/**
 * Validation middleware factory
 * @param schema - Joi validation schema
 * @param source - Where to validate (body, query, params)
 */
export const validateRequest = (
  schema: Joi.ObjectSchema,
  source: 'body' | 'query' | 'params' = 'body'
) => {
  return (req: Request, _res: Response, next: NextFunction) => {
    const dataToValidate = req[source];
    
    const { error, value } = schema.validate(dataToValidate, {
      abortEarly: false, // Return all validation errors
      allowUnknown: false, // Don't allow unknown fields
      stripUnknown: true // Remove unknown fields
    });

    if (error) {
      const validationErrors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
        value: detail.context?.value
      }));

      return next(new AppError('Validation failed', 400, {
        type: 'VALIDATION_ERROR',
        details: validationErrors
      }));
    }

    // Replace the original data with validated and sanitized data
    req[source] = value;
    next();
  };
};

/**
 * Validate multiple sources (body, query, params)
 */
export const validateMultiple = (schemas: {
  body?: Joi.ObjectSchema;
  query?: Joi.ObjectSchema;
  params?: Joi.ObjectSchema;
}) => {
  return (req: Request, _res: Response, next: NextFunction) => {
    const errors: any[] = [];

    // Validate each source
    Object.entries(schemas).forEach(([source, schema]) => {
      if (schema) {
        const { error, value } = schema.validate(req[source as keyof Request], {
          abortEarly: false,
          allowUnknown: false,
          stripUnknown: true
        });

        if (error) {
          const sourceErrors = error.details.map(detail => ({
            source,
            field: detail.path.join('.'),
            message: detail.message,
            value: detail.context?.value
          }));
          errors.push(...sourceErrors);
        } else {
          // Replace with validated data
          (req as any)[source] = value;
        }
      }
    });

    if (errors.length > 0) {
      return next(new AppError('Validation failed', 400, {
        type: 'VALIDATION_ERROR',
        details: errors
      }));
    }

    next();
  };
};

/**
 * Validate file uploads
 */
export const validateFileUpload = (options: {
  maxSize?: number; // in bytes
  allowedTypes?: string[];
  required?: boolean;
  maxFiles?: number;
}) => {
  return (req: Request, _res: Response, next: NextFunction) => {
    const {
      maxSize = 10 * 1024 * 1024, // 10MB default
      allowedTypes = ['image/jpeg', 'image/png', 'image/webp'],
      required = false,
      maxFiles = 1
    } = options;

    const files = req.files as Express.Multer.File[] | undefined;
    const file = req.file as Express.Multer.File | undefined;

    // Check if file is required
    if (required && !file && (!files || files.length === 0)) {
      return next(new AppError('File upload is required', 400));
    }

    // If no files and not required, continue
    if (!file && (!files || files.length === 0)) {
      return next();
    }

    const filesToValidate = files || (file ? [file] : []);

    // Check number of files
    if (filesToValidate.length > maxFiles) {
      return next(new AppError(`Cannot upload more than ${maxFiles} files`, 400));
    }

    // Validate each file
    for (const uploadedFile of filesToValidate) {
      // Check file size
      if (uploadedFile.size > maxSize) {
        return next(new AppError(
          `File ${uploadedFile.originalname} is too large. Maximum size is ${Math.round(maxSize / 1024 / 1024)}MB`,
          400
        ));
      }

      // Check file type
      if (!allowedTypes.includes(uploadedFile.mimetype)) {
        return next(new AppError(
          `File ${uploadedFile.originalname} has invalid type. Allowed types: ${allowedTypes.join(', ')}`,
          400
        ));
      }
    }

    next();
  };
};

/**
 * Validate MongoDB ObjectId
 */
export const validateObjectId = (paramName: string = 'id') => {
  return (req: Request, _res: Response, next: NextFunction) => {
    const id = req.params[paramName];
    
    if (!id) {
      return next(new AppError(`${paramName} parameter is required`, 400));
    }

    // MongoDB ObjectId validation regex
    const objectIdRegex = /^[0-9a-fA-F]{24}$/;
    
    if (!objectIdRegex.test(id)) {
      return next(new AppError(`Invalid ${paramName} format`, 400));
    }

    next();
  };
};

/**
 * Sanitize input to prevent XSS and injection attacks
 */
export const sanitizeInput = (req: Request, _res: Response, next: NextFunction) => {
  const sanitizeValue = (value: any): any => {
    if (typeof value === 'string') {
      // Remove potentially dangerous characters
      return value
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove script tags
        .replace(/javascript:/gi, '') // Remove javascript: protocol
        .replace(/on\w+\s*=/gi, '') // Remove event handlers
        .trim();
    }
    
    if (Array.isArray(value)) {
      return value.map(sanitizeValue);
    }
    
    if (value && typeof value === 'object') {
      const sanitized: any = {};
      for (const [key, val] of Object.entries(value)) {
        sanitized[key] = sanitizeValue(val);
      }
      return sanitized;
    }
    
    return value;
  };

  // Sanitize body, query, and params
  if (req.body) {
    req.body = sanitizeValue(req.body);
  }
  
  if (req.query) {
    req.query = sanitizeValue(req.query);
  }
  
  if (req.params) {
    req.params = sanitizeValue(req.params);
  }

  next();
};

/**
 * Rate limiting validation
 */
export const validateRateLimit = (options: {
  windowMs: number;
  maxRequests: number;
  message?: string;
}) => {
  const requests = new Map<string, { count: number; resetTime: number }>();
  
  return (req: Request, _res: Response, next: NextFunction) => {
    const identifier = req.ip || req.connection.remoteAddress || 'unknown';
    const now = Date.now();
    const windowStart = now - options.windowMs;
    
    // Clean up old entries
    for (const [key, value] of requests.entries()) {
      if (value.resetTime < windowStart) {
        requests.delete(key);
      }
    }
    
    const userRequests = requests.get(identifier);
    
    if (!userRequests) {
      requests.set(identifier, { count: 1, resetTime: now });
      return next();
    }
    
    if (userRequests.resetTime < windowStart) {
      requests.set(identifier, { count: 1, resetTime: now });
      return next();
    }
    
    if (userRequests.count >= options.maxRequests) {
      return next(new AppError(
        options.message || 'Too many requests, please try again later',
        429
      ));
    }
    
    userRequests.count++;
    next();
  };
};
