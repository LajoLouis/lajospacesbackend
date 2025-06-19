import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import { createClient } from 'redis';
import { config } from '../config/environment';
import { logger } from '../utils/logger';
import { AppError } from '../utils/appError';

// Create Redis client for rate limiting
const redisClient = createClient({
  url: config.REDIS_URL,
  socket: {
    connectTimeout: 5000,
    lazyConnect: true
  }
});

redisClient.on('error', (err) => {
  logger.error('Redis rate limiting client error:', err);
});

redisClient.on('connect', () => {
  logger.info('Redis rate limiting client connected');
});

// Initialize Redis connection
let redisConnected = false;
const initializeRedis = async () => {
  try {
    if (!redisConnected) {
      await redisClient.connect();
      redisConnected = true;
      logger.info('Redis rate limiting initialized successfully');
    }
  } catch (error) {
    logger.error('Failed to initialize Redis for rate limiting:', error);
  }
};

// Initialize Redis connection
initializeRedis();

// Rate limiting configurations
export const rateLimitConfigs = {
  // General API rate limiting
  general: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000, // Limit each IP to 1000 requests per windowMs
    message: {
      error: 'Too many requests from this IP, please try again later.',
      retryAfter: '15 minutes'
    },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req: Request) => {
      // Skip rate limiting for health checks
      return req.path === '/api/health' || req.path === '/health';
    }
  },

  // Authentication endpoints (stricter)
  auth: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 20, // Limit each IP to 20 auth requests per windowMs
    message: {
      error: 'Too many authentication attempts, please try again later.',
      retryAfter: '15 minutes'
    },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true // Don't count successful requests
  },

  // Password reset (very strict)
  passwordReset: {
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 5, // Limit each IP to 5 password reset requests per hour
    message: {
      error: 'Too many password reset attempts, please try again later.',
      retryAfter: '1 hour'
    },
    standardHeaders: true,
    legacyHeaders: false
  },

  // Email sending (strict)
  email: {
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 50, // Limit each IP to 50 email requests per hour
    message: {
      error: 'Too many email requests, please try again later.',
      retryAfter: '1 hour'
    },
    standardHeaders: true,
    legacyHeaders: false
  },

  // File uploads (moderate)
  upload: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 upload requests per windowMs
    message: {
      error: 'Too many upload requests, please try again later.',
      retryAfter: '15 minutes'
    },
    standardHeaders: true,
    legacyHeaders: false
  },

  // Search endpoints (moderate)
  search: {
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 60, // Limit each IP to 60 search requests per minute
    message: {
      error: 'Too many search requests, please slow down.',
      retryAfter: '1 minute'
    },
    standardHeaders: true,
    legacyHeaders: false
  },

  // Admin endpoints (very strict)
  admin: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 admin requests per windowMs
    message: {
      error: 'Too many admin requests, please try again later.',
      retryAfter: '15 minutes'
    },
    standardHeaders: true,
    legacyHeaders: false
  }
};

// Create rate limiter with Redis store
function createRateLimiter(config: any, name: string) {
  // Create store factory that checks connection at runtime
  const getStore = () => {
    if (redisConnected) {
      try {
        return new RedisStore({
          sendCommand: (...args: string[]) => redisClient.sendCommand(args),
          prefix: `rl:${name}:`,
        });
      } catch (error) {
        logger.warn(`Failed to create Redis store for ${name}, falling back to memory store:`, error);
        return undefined;
      }
    }
    return undefined;
  };

  return rateLimit({
    ...config,
    store: getStore(),
    keyGenerator: (req: Request) => {
      // Use user ID if authenticated, otherwise use IP
      const userId = req.user?._id;
      const ip = req.ip || req.connection.remoteAddress || 'unknown';
      return userId ? `user:${userId}` : `ip:${ip}`;
    },
    handler: (req: Request, res: Response) => {
      logger.warn(`Rate limit exceeded for ${name}`, {
        ip: req.ip,
        userId: req.user?._id,
        path: req.path,
        method: req.method,
        userAgent: req.get('User-Agent')
      });

      res.status(429).json({
        success: false,
        error: config.message.error,
        retryAfter: config.message.retryAfter,
        timestamp: new Date().toISOString()
      });
    },
    onLimitReached: (req: Request) => {
      logger.warn(`Rate limit reached for ${name}`, {
        ip: req.ip,
        userId: req.user?._id,
        path: req.path,
        method: req.method
      });
    }
  });
}

// Export rate limiters
export const generalRateLimit = createRateLimiter(rateLimitConfigs.general, 'general');
export const authRateLimit = createRateLimiter(rateLimitConfigs.auth, 'auth');
export const passwordResetRateLimit = createRateLimiter(rateLimitConfigs.passwordReset, 'password-reset');
export const emailRateLimit = createRateLimiter(rateLimitConfigs.email, 'email');
export const uploadRateLimit = createRateLimiter(rateLimitConfigs.upload, 'upload');
export const searchRateLimit = createRateLimiter(rateLimitConfigs.search, 'search');
export const adminRateLimit = createRateLimiter(rateLimitConfigs.admin, 'admin');

// Sliding window rate limiter for more sophisticated rate limiting
export class SlidingWindowRateLimit {
  private redisClient: any;
  private windowSize: number;
  private maxRequests: number;
  private keyPrefix: string;

  constructor(windowSize: number, maxRequests: number, keyPrefix: string) {
    this.redisClient = redisClient;
    this.windowSize = windowSize;
    this.maxRequests = maxRequests;
    this.keyPrefix = keyPrefix;
  }

  async isAllowed(identifier: string): Promise<{ allowed: boolean; remaining: number; resetTime: number }> {
    if (!redisConnected) {
      // Fallback to allowing requests if Redis is not available
      return { allowed: true, remaining: this.maxRequests, resetTime: Date.now() + this.windowSize };
    }

    const now = Date.now();
    const windowStart = now - this.windowSize;
    const key = `${this.keyPrefix}:${identifier}`;

    try {
      // Remove expired entries and count current requests
      await this.redisClient.zRemRangeByScore(key, 0, windowStart);
      const currentRequests = await this.redisClient.zCard(key);

      if (currentRequests >= this.maxRequests) {
        const oldestRequest = await this.redisClient.zRange(key, 0, 0, { withScores: true });
        const resetTime = oldestRequest.length > 0 ? 
          parseInt(oldestRequest[0].score) + this.windowSize : 
          now + this.windowSize;

        return {
          allowed: false,
          remaining: 0,
          resetTime
        };
      }

      // Add current request
      await this.redisClient.zAdd(key, { score: now, value: `${now}-${Math.random()}` });
      await this.redisClient.expire(key, Math.ceil(this.windowSize / 1000));

      return {
        allowed: true,
        remaining: this.maxRequests - currentRequests - 1,
        resetTime: now + this.windowSize
      };
    } catch (error) {
      logger.error('Sliding window rate limit error:', error);
      // Fallback to allowing requests if Redis operation fails
      return { allowed: true, remaining: this.maxRequests, resetTime: now + this.windowSize };
    }
  }

  middleware() {
    return async (req: Request, res: Response, next: NextFunction) => {
      const identifier = req.user?._id || req.ip || 'unknown';
      const result = await this.isAllowed(identifier);

      // Set rate limit headers
      res.set({
        'X-RateLimit-Limit': this.maxRequests.toString(),
        'X-RateLimit-Remaining': result.remaining.toString(),
        'X-RateLimit-Reset': new Date(result.resetTime).toISOString()
      });

      if (!result.allowed) {
        logger.warn('Sliding window rate limit exceeded', {
          identifier,
          path: req.path,
          method: req.method,
          remaining: result.remaining,
          resetTime: result.resetTime
        });

        return res.status(429).json({
          success: false,
          error: 'Rate limit exceeded',
          retryAfter: Math.ceil((result.resetTime - Date.now()) / 1000),
          timestamp: new Date().toISOString()
        });
      }

      next();
    };
  }
}

// Create sliding window rate limiters for specific use cases
export const criticalOperationsRateLimit = new SlidingWindowRateLimit(
  60 * 1000, // 1 minute window
  10, // 10 requests per minute
  'critical-ops'
);

export const userActionsRateLimit = new SlidingWindowRateLimit(
  5 * 60 * 1000, // 5 minute window
  100, // 100 requests per 5 minutes
  'user-actions'
);

// Rate limit bypass for trusted IPs (admin panel, monitoring services)
export const trustedIPs = new Set([
  '127.0.0.1',
  '::1',
  // Add your trusted IPs here
]);

export function bypassRateLimitForTrustedIPs(req: Request, res: Response, next: NextFunction) {
  const clientIP = req.ip || req.connection.remoteAddress;
  
  if (clientIP && trustedIPs.has(clientIP)) {
    logger.info('Rate limit bypassed for trusted IP', { ip: clientIP });
    return next();
  }
  
  next();
}

// Rate limit monitoring and analytics
export async function getRateLimitStats(timeframe: 'hour' | 'day' | 'week' = 'hour'): Promise<any> {
  if (!redisConnected) {
    return { error: 'Redis not connected' };
  }

  const now = Date.now();
  let windowStart: number;

  switch (timeframe) {
    case 'hour':
      windowStart = now - (60 * 60 * 1000);
      break;
    case 'day':
      windowStart = now - (24 * 60 * 60 * 1000);
      break;
    case 'week':
      windowStart = now - (7 * 24 * 60 * 60 * 1000);
      break;
    default:
      windowStart = now - (60 * 60 * 1000);
  }

  try {
    const keys = await redisClient.keys('rl:*');
    const stats: any = {};

    for (const key of keys) {
      const count = await redisClient.get(key);
      if (count) {
        const [, limiterName] = key.split(':');
        stats[limiterName] = (stats[limiterName] || 0) + parseInt(count);
      }
    }

    return {
      timeframe,
      windowStart: new Date(windowStart).toISOString(),
      windowEnd: new Date(now).toISOString(),
      stats
    };
  } catch (error) {
    logger.error('Error getting rate limit stats:', error);
    return { error: 'Failed to get stats' };
  }
}

// Cleanup function
export async function cleanupRateLimitData(): Promise<void> {
  if (!redisConnected) return;

  try {
    const keys = await redisClient.keys('rl:*');
    if (keys.length > 0) {
      await redisClient.del(keys);
      logger.info(`Cleaned up ${keys.length} rate limit keys`);
    }
  } catch (error) {
    logger.error('Error cleaning up rate limit data:', error);
  }
}

export { redisClient as rateLimitRedisClient };

export default {
  generalRateLimit,
  authRateLimit,
  passwordResetRateLimit,
  emailRateLimit,
  uploadRateLimit,
  searchRateLimit,
  adminRateLimit,
  SlidingWindowRateLimit,
  criticalOperationsRateLimit,
  userActionsRateLimit,
  bypassRateLimitForTrustedIPs,
  getRateLimitStats,
  cleanupRateLimitData
};
