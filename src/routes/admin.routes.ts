import { Router } from 'express';
import { authenticate as authMiddleware } from '../middleware/auth';
import { adminMiddleware } from '../middleware/adminMiddleware';
import { auditService, AuditEventType, RiskLevel } from '../services/auditService';
import { cacheService } from '../services/cacheService';
import { sessionService } from '../services/sessionService';
import { tokenService } from '../services/tokenService';
import { queryOptimizer } from '../utils/queryOptimization';
import { getRateLimitStats, cleanupRateLimitData } from '../middleware/rateLimiting';
import { adminRateLimit } from '../middleware/rateLimiting';
import { strictSanitization } from '../middleware/sanitization';

const router = Router();

// Apply admin-specific middleware
router.use(adminRateLimit);
router.use(authMiddleware);
router.use(adminMiddleware);
router.use(strictSanitization());

/**
 * @swagger
 * /api/admin/audit/logs:
 *   get:
 *     summary: Get audit logs with filtering
 *     tags: [Admin, Security]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: userId
 *         schema:
 *           type: string
 *         description: Filter by user ID
 *       - in: query
 *         name: eventType
 *         schema:
 *           type: string
 *         description: Filter by event type
 *       - in: query
 *         name: riskLevel
 *         schema:
 *           type: string
 *           enum: [low, medium, high, critical]
 *         description: Filter by risk level
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Start date for filtering
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: End date for filtering
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Items per page
 *     responses:
 *       200:
 *         description: Audit logs retrieved successfully
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 */
router.get('/audit/logs', async (req, res) => {
  try {
    const filters = {
      userId: req.query.userId as string,
      eventType: req.query.eventType as AuditEventType,
      riskLevel: req.query.riskLevel as RiskLevel,
      startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
      endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined,
      page: parseInt(req.query.page as string) || 1,
      limit: parseInt(req.query.limit as string) || 20
    };

    const result = await auditService.getAuditLogs(filters);

    // Log admin access to audit logs
    await auditService.logEvent(AuditEventType.DATA_VIEWED, req, {
      resource: 'audit_logs',
      metadata: { filters }
    });

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve audit logs'
    });
  }
});

/**
 * @swagger
 * /api/admin/audit/stats:
 *   get:
 *     summary: Get audit statistics
 *     tags: [Admin, Security]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: timeframe
 *         schema:
 *           type: string
 *           enum: [hour, day, week, month]
 *           default: day
 *         description: Timeframe for statistics
 *     responses:
 *       200:
 *         description: Audit statistics retrieved successfully
 */
router.get('/audit/stats', async (req, res) => {
  try {
    const timeframe = (req.query.timeframe as 'hour' | 'day' | 'week' | 'month') || 'day';
    const stats = await auditService.getAuditStats(timeframe);

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve audit statistics'
    });
  }
});

/**
 * @swagger
 * /api/admin/performance/cache:
 *   get:
 *     summary: Get cache statistics
 *     tags: [Admin, Performance]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Cache statistics retrieved successfully
 */
router.get('/performance/cache', async (req, res) => {
  try {
    const stats = await cacheService.getStats();

    res.json({
      success: true,
      data: {
        ...stats,
        isConnected: cacheService.isConnected()
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve cache statistics'
    });
  }
});

/**
 * @swagger
 * /api/admin/performance/queries:
 *   get:
 *     summary: Get query performance statistics
 *     tags: [Admin, Performance]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Query statistics retrieved successfully
 */
router.get('/performance/queries', async (req, res) => {
  try {
    const stats = queryOptimizer.getQueryStats();

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve query statistics'
    });
  }
});

/**
 * @swagger
 * /api/admin/security/rate-limits:
 *   get:
 *     summary: Get rate limiting statistics
 *     tags: [Admin, Security]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: timeframe
 *         schema:
 *           type: string
 *           enum: [hour, day, week]
 *           default: hour
 *         description: Timeframe for rate limit statistics
 *     responses:
 *       200:
 *         description: Rate limit statistics retrieved successfully
 */
router.get('/security/rate-limits', async (req, res) => {
  try {
    const timeframe = (req.query.timeframe as 'hour' | 'day' | 'week') || 'hour';
    const stats = await getRateLimitStats(timeframe);

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve rate limit statistics'
    });
  }
});

/**
 * @swagger
 * /api/admin/security/sessions:
 *   get:
 *     summary: Get session statistics
 *     tags: [Admin, Security]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Session statistics retrieved successfully
 */
router.get('/security/sessions', async (req, res) => {
  try {
    const stats = await sessionService.getSessionStats();

    res.json({
      success: true,
      data: {
        ...stats,
        isConnected: sessionService.isConnected()
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve session statistics'
    });
  }
});

/**
 * @swagger
 * /api/admin/security/tokens:
 *   get:
 *     summary: Get token statistics
 *     tags: [Admin, Security]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Token statistics retrieved successfully
 */
router.get('/security/tokens', async (req, res) => {
  try {
    const stats = await tokenService.getTokenStats();

    res.json({
      success: true,
      data: {
        ...stats,
        isConnected: tokenService.isConnected()
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve token statistics'
    });
  }
});

/**
 * @swagger
 * /api/admin/maintenance/cleanup:
 *   post:
 *     summary: Perform system cleanup
 *     tags: [Admin, Maintenance]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               cleanupType:
 *                 type: string
 *                 enum: [rate-limits, expired-tokens, expired-sessions, query-metrics]
 *                 description: Type of cleanup to perform
 *             required:
 *               - cleanupType
 *     responses:
 *       200:
 *         description: Cleanup completed successfully
 */
router.post('/maintenance/cleanup', async (req, res) => {
  try {
    const { cleanupType } = req.body;
    let result;

    switch (cleanupType) {
      case 'rate-limits':
        await cleanupRateLimitData();
        result = 'Rate limit data cleaned up';
        break;
      case 'expired-tokens':
        const tokenCount = await tokenService.cleanupExpiredTokens();
        result = `${tokenCount} expired tokens cleaned up`;
        break;
      case 'expired-sessions':
        const sessionCount = await sessionService.cleanupExpiredSessions();
        result = `${sessionCount} expired sessions cleaned up`;
        break;
      case 'query-metrics':
        queryOptimizer.clearMetrics();
        result = 'Query metrics cleared';
        break;
      default:
        return res.status(400).json({
          success: false,
          error: 'Invalid cleanup type'
        });
    }

    // Log maintenance action
    await auditService.logEvent(AuditEventType.MAINTENANCE_MODE, req, {
      metadata: { cleanupType, result }
    });

    res.json({
      success: true,
      message: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to perform cleanup'
    });
  }
});

/**
 * @swagger
 * /api/admin/system/health:
 *   get:
 *     summary: Get detailed system health status
 *     tags: [Admin, System]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: System health status retrieved successfully
 */
router.get('/system/health', async (req, res) => {
  try {
    const health = {
      timestamp: new Date().toISOString(),
      services: {
        cache: {
          connected: cacheService.isConnected(),
          stats: await cacheService.getStats()
        },
        sessions: {
          connected: sessionService.isConnected(),
          stats: await sessionService.getSessionStats()
        },
        tokens: {
          connected: tokenService.isConnected(),
          stats: await tokenService.getTokenStats()
        },
        rateLimiting: {
          stats: await getRateLimitStats('hour')
        },
        queries: {
          stats: queryOptimizer.getQueryStats()
        }
      }
    };

    res.json({
      success: true,
      data: health
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve system health'
    });
  }
});

export default router;
