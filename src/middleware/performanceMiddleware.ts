import { Request, Response, NextFunction } from 'express';
import { performance } from 'perf_hooks';
import { performanceMonitoringService } from '../services/performanceMonitoringService';
import { errorTrackingService, ErrorSeverity, ErrorCategory } from '../services/errorTrackingService';
import { logger } from '../utils/logger';

/**
 * Performance monitoring middleware
 * Tracks request performance and integrates with monitoring services
 */

interface ExtendedRequest extends Request {
  startTime?: number;
  requestId?: string;
}

/**
 * Generate unique request ID
 */
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Performance tracking middleware
 */
export function performanceTrackingMiddleware(
  req: ExtendedRequest,
  res: Response,
  next: NextFunction
): void {
  // Skip health checks and static files
  if (req.path === '/health' || req.path.startsWith('/static')) {
    return next();
  }

  const startTime = performance.now();
  const requestId = generateRequestId();
  
  req.startTime = startTime;
  req.requestId = requestId;

  // Add request ID to response headers
  res.setHeader('X-Request-ID', requestId);

  // Track when response finishes
  res.on('finish', () => {
    const endTime = performance.now();
    const responseTime = endTime - startTime;

    // Extract user info if available
    const userId = (req as any).user?.id || (req as any).user?._id;
    const userAgent = req.get('User-Agent') || 'unknown';
    const ip = req.ip || req.connection.remoteAddress || 'unknown';

    // Create performance metrics
    const metrics = {
      method: req.method,
      endpoint: req.route?.path || req.path,
      statusCode: res.statusCode,
      responseTime,
      timestamp: new Date(),
      userId,
      ip,
      userAgent
    };

    // Track the request
    performanceMonitoringService.trackRequest(metrics);

    // Log performance data
    const logLevel = responseTime > 2000 ? 'warn' : responseTime > 1000 ? 'info' : 'debug';
    logger[logLevel]('Request completed', {
      requestId,
      method: req.method,
      endpoint: metrics.endpoint,
      statusCode: res.statusCode,
      responseTime: `${responseTime.toFixed(2)}ms`,
      userId,
      ip,
      userAgent: userAgent.substring(0, 100) // Truncate long user agents
    });

    // Track errors if status code indicates failure
    if (res.statusCode >= 500) {
      errorTrackingService.trackError(
        new Error(`Server error: ${res.statusCode}`),
        {
          requestId,
          endpoint: metrics.endpoint,
          method: req.method,
          ip,
          userAgent,
          userId
        },
        ErrorSeverity.HIGH,
        ErrorCategory.SYSTEM
      );
    } else if (res.statusCode >= 400) {
      errorTrackingService.trackError(
        new Error(`Client error: ${res.statusCode}`),
        {
          requestId,
          endpoint: metrics.endpoint,
          method: req.method,
          ip,
          userAgent,
          userId
        },
        ErrorSeverity.LOW,
        ErrorCategory.VALIDATION
      );
    }
  });

  next();
}

/**
 * Request timeout middleware
 */
export function requestTimeoutMiddleware(timeoutMs: number = 30000) {
  return (req: ExtendedRequest, res: Response, next: NextFunction): void => {
    const timeout = setTimeout(() => {
      if (!res.headersSent) {
        const error = new Error('Request timeout');
        
        errorTrackingService.trackError(
          error,
          {
            requestId: req.requestId,
            endpoint: req.route?.path || req.path,
            method: req.method,
            ip: req.ip,
            userAgent: req.get('User-Agent'),
            timeout: timeoutMs
          },
          ErrorSeverity.HIGH,
          ErrorCategory.PERFORMANCE
        );

        res.status(408).json({
          success: false,
          error: 'Request timeout',
          requestId: req.requestId,
          timeout: timeoutMs
        });
      }
    }, timeoutMs);

    res.on('finish', () => {
      clearTimeout(timeout);
    });

    res.on('close', () => {
      clearTimeout(timeout);
    });

    next();
  };
}

/**
 * Memory monitoring middleware
 */
export function memoryMonitoringMiddleware(
  req: ExtendedRequest,
  res: Response,
  next: NextFunction
): void {
  const memoryBefore = process.memoryUsage();

  res.on('finish', () => {
    const memoryAfter = process.memoryUsage();
    const memoryDelta = {
      heapUsed: memoryAfter.heapUsed - memoryBefore.heapUsed,
      heapTotal: memoryAfter.heapTotal - memoryBefore.heapTotal,
      rss: memoryAfter.rss - memoryBefore.rss,
      external: memoryAfter.external - memoryBefore.external
    };

    // Log significant memory increases
    if (memoryDelta.heapUsed > 10 * 1024 * 1024) { // 10MB increase
      logger.warn('Significant memory increase detected', {
        requestId: req.requestId,
        endpoint: req.route?.path || req.path,
        method: req.method,
        memoryDelta: {
          heapUsed: `${(memoryDelta.heapUsed / 1024 / 1024).toFixed(2)} MB`,
          rss: `${(memoryDelta.rss / 1024 / 1024).toFixed(2)} MB`
        },
        memoryAfter: {
          heapUsed: `${(memoryAfter.heapUsed / 1024 / 1024).toFixed(2)} MB`,
          heapTotal: `${(memoryAfter.heapTotal / 1024 / 1024).toFixed(2)} MB`,
          rss: `${(memoryAfter.rss / 1024 / 1024).toFixed(2)} MB`
        }
      });
    }
  });

  next();
}

/**
 * Rate limiting monitoring middleware
 */
export function rateLimitMonitoringMiddleware(
  req: ExtendedRequest,
  res: Response,
  next: NextFunction
): void {
  // Check if request was rate limited
  res.on('finish', () => {
    if (res.statusCode === 429) {
      errorTrackingService.trackError(
        new Error('Rate limit exceeded'),
        {
          requestId: req.requestId,
          endpoint: req.route?.path || req.path,
          method: req.method,
          ip: req.ip,
          userAgent: req.get('User-Agent')
        },
        ErrorSeverity.MEDIUM,
        ErrorCategory.SECURITY
      );

      logger.warn('Rate limit exceeded', {
        requestId: req.requestId,
        endpoint: req.route?.path || req.path,
        method: req.method,
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });
    }
  });

  next();
}

/**
 * Database query monitoring middleware
 */
export function databaseMonitoringMiddleware(
  req: ExtendedRequest,
  res: Response,
  next: NextFunction
): void {
  const originalQuery = req.query;
  let queryCount = 0;
  let totalQueryTime = 0;

  // Mock query tracking (in real implementation, this would hook into Mongoose)
  const trackQuery = (queryTime: number) => {
    queryCount++;
    totalQueryTime += queryTime;
  };

  // Add query tracker to request
  (req as any).trackQuery = trackQuery;

  res.on('finish', () => {
    if (queryCount > 10) {
      logger.warn('High database query count detected', {
        requestId: req.requestId,
        endpoint: req.route?.path || req.path,
        method: req.method,
        queryCount,
        totalQueryTime: `${totalQueryTime.toFixed(2)}ms`,
        averageQueryTime: `${(totalQueryTime / queryCount).toFixed(2)}ms`
      });
    }

    if (totalQueryTime > 1000) {
      logger.warn('Slow database queries detected', {
        requestId: req.requestId,
        endpoint: req.route?.path || req.path,
        method: req.method,
        queryCount,
        totalQueryTime: `${totalQueryTime.toFixed(2)}ms`
      });
    }
  });

  next();
}

/**
 * Combined monitoring middleware
 */
export function monitoringMiddleware(
  req: ExtendedRequest,
  res: Response,
  next: NextFunction
): void {
  // Apply all monitoring middlewares
  performanceTrackingMiddleware(req, res, () => {
    memoryMonitoringMiddleware(req, res, () => {
      rateLimitMonitoringMiddleware(req, res, () => {
        databaseMonitoringMiddleware(req, res, next);
      });
    });
  });
}

export default {
  performanceTrackingMiddleware,
  requestTimeoutMiddleware,
  memoryMonitoringMiddleware,
  rateLimitMonitoringMiddleware,
  databaseMonitoringMiddleware,
  monitoringMiddleware
};
