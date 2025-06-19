import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken, JWTPayload } from '../utils/jwt';
import { AppError } from './errorHandler';
import { logger } from '../utils/logger';
import User from '../models/User.model';

// Extend Request interface to include user
declare global {
  namespace Express {
    interface Request {
      user?: JWTPayload & { _id: string };
    }
  }
}

/**
 * Authentication middleware - Verify JWT token
 */
export async function authenticate(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    // Get token from header
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AppError('Access token required', 401, true, 'MISSING_TOKEN');
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Verify token
    const payload = verifyAccessToken(token);

    // Check if user still exists and is active
    const user = await User.findById(payload.userId).select('+isActive');
    
    if (!user) {
      throw new AppError('User no longer exists', 401, true, 'USER_NOT_FOUND');
    }

    if (!user.isActive) {
      throw new AppError('Account has been deactivated', 401, true, 'ACCOUNT_DEACTIVATED');
    }

    // Update last active time
    user.lastActiveAt = new Date();
    await user.save();

    // Add user to request object
    req.user = {
      ...payload,
      _id: (user._id as any).toString()
    };

    logger.info(`User authenticated: ${user.email}`);
    next();

  } catch (error) {
    if (error instanceof AppError) {
      next(error);
    } else {
      logger.error('Authentication error:', error);
      next(new AppError('Authentication failed', 401, true, 'AUTH_FAILED'));
    }
  }
}

/**
 * Optional authentication middleware - Don't fail if no token
 */
export async function optionalAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next(); // Continue without authentication
    }

    const token = authHeader.substring(7);
    const payload = verifyAccessToken(token);

    const user = await User.findById(payload.userId).select('+isActive');
    
    if (user && user.isActive) {
      user.lastActiveAt = new Date();
      await user.save();

      req.user = {
        ...payload,
        _id: (user._id as any).toString()
      };
    }

    next();

  } catch (error) {
    // Log error but don't fail the request
    logger.warn('Optional authentication failed:', error);
    next();
  }
}

/**
 * Authorization middleware - Check user roles/permissions
 */
export function authorize(...accountTypes: ('seeker' | 'owner' | 'both')[]): (req: Request, _res: Response, next: NextFunction) => void {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      if (!req.user) {
        throw new AppError('Authentication required', 401, true, 'AUTH_REQUIRED');
      }

      const userAccountType = req.user.accountType;
      
      // 'both' account type has access to everything
      if (userAccountType === 'both') {
        return next();
      }

      // Check if user's account type is in allowed types
      if (!accountTypes.includes(userAccountType)) {
        throw new AppError('Insufficient permissions', 403, true, 'INSUFFICIENT_PERMISSIONS');
      }

      next();

    } catch (error) {
      next(error);
    }
  };
}

/**
 * Email verification middleware - Check if email is verified
 */
export function requireEmailVerification(req: Request, _res: Response, next: NextFunction): void {
  try {
    if (!req.user) {
      throw new AppError('Authentication required', 401, true, 'AUTH_REQUIRED');
    }

    if (!req.user.isEmailVerified) {
      throw new AppError('Email verification required', 403, true, 'EMAIL_NOT_VERIFIED');
    }

    next();

  } catch (error) {
    next(error);
  }
}

/**
 * Rate limiting middleware for authentication endpoints
 */
export function authRateLimit(maxAttempts: number = 5, windowMs: number = 15 * 60 * 1000): (req: Request, _res: Response, next: NextFunction) => Promise<void> {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      const { redisUtils, redisKeys } = await import('../config/redis');
      
      const ip = req.ip || req.connection.remoteAddress || 'unknown';
      const key = redisKeys.rateLimit(`auth:${ip}`);
      
      const current = await redisUtils.get(key);
      const attempts = current ? parseInt(current) : 0;

      if (attempts >= maxAttempts) {
        const ttl = await redisUtils.ttl(key);
        throw new AppError(
          `Too many authentication attempts. Try again in ${Math.ceil(ttl / 60)} minutes.`,
          429,
          true,
          'RATE_LIMIT_EXCEEDED'
        );
      }

      // Increment attempts
      await redisUtils.incr(key);
      await redisUtils.expire(key, Math.ceil(windowMs / 1000));

      next();

    } catch (error) {
      if (error instanceof AppError) {
        next(error);
      } else {
        logger.error('Rate limiting error:', error);
        next(); // Continue on Redis errors
      }
    }
  };
}

/**
 * Clear rate limit on successful authentication
 */
export async function clearAuthRateLimit(req: Request): Promise<void> {
  try {
    const { redisUtils, redisKeys } = await import('../config/redis');
    
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    const key = redisKeys.rateLimit(`auth:${ip}`);
    
    await redisUtils.del(key);
    
  } catch (error) {
    logger.error('Error clearing auth rate limit:', error);
    // Don't throw - this is not critical
  }
}

/**
 * Middleware to check if user owns the resource
 */
export function requireOwnership(resourceUserIdField: string = 'userId'): (req: Request, _res: Response, next: NextFunction) => void {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      if (!req.user) {
        throw new AppError('Authentication required', 401, true, 'AUTH_REQUIRED');
      }

      // Get resource user ID from request params, body, or query
      const resourceUserId = req.params[resourceUserIdField] || 
                           req.body[resourceUserIdField] || 
                           req.query[resourceUserIdField];

      if (!resourceUserId) {
        throw new AppError('Resource user ID not found', 400, true, 'RESOURCE_USER_ID_MISSING');
      }

      if (req.user.userId !== resourceUserId) {
        throw new AppError('Access denied - not resource owner', 403, true, 'NOT_RESOURCE_OWNER');
      }

      next();

    } catch (error) {
      next(error);
    }
  };
}

/**
 * Role-based authorization middleware
 */
export function requireRole(...roles: string[]): (req: Request, _res: Response, next: NextFunction) => void {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      if (!req.user) {
        throw new AppError('Authentication required', 401, true, 'AUTH_REQUIRED');
      }

      // Check if user has required role
      const userRole = req.user.role || 'user'; // Default to 'user' if no role specified

      if (!roles.includes(userRole)) {
        throw new AppError('Insufficient permissions', 403, true, 'INSUFFICIENT_PERMISSIONS');
      }

      next();

    } catch (error) {
      next(error);
    }
  };
}

/**
 * Middleware to validate API key (for external integrations)
 */
export function validateApiKey(req: Request, _res: Response, next: NextFunction): void {
  try {
    const apiKey = req.headers['x-api-key'] as string;

    if (!apiKey) {
      throw new AppError('API key required', 401, true, 'API_KEY_REQUIRED');
    }

    // In a real application, you would validate against a database
    // For now, we'll use a simple check
    const validApiKeys = process.env.VALID_API_KEYS?.split(',') || [];

    if (!validApiKeys.includes(apiKey)) {
      throw new AppError('Invalid API key', 401, true, 'INVALID_API_KEY');
    }

    next();

  } catch (error) {
    next(error);
  }
}

export default {
  authenticate,
  optionalAuth,
  authorize,
  requireEmailVerification,
  authRateLimit,
  clearAuthRateLimit,
  requireOwnership,
  requireRole,
  validateApiKey
};
