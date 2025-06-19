import { Router } from 'express';
import { auth } from '../middleware/auth';
import { adminAuth } from '../middleware/adminAuth';
import { errorTrackingService } from '../services/errorTrackingService';
import { performanceMonitoringService } from '../services/performanceMonitoringService';
import { backupService } from '../services/backupService';
import { logger } from '../utils/logger';

const router = Router();

/**
 * @route GET /api/monitoring/metrics
 * @desc Get performance metrics (admin only)
 * @access Private/Admin
 */
router.get('/metrics', auth, adminAuth, async (req, res) => {
  try {
    const performanceMetrics = performanceMonitoringService.getMetrics();
    const errorMetrics = errorTrackingService.getMetrics();
    const performanceHealth = performanceMonitoringService.getHealthStatus();
    const errorHealth = errorTrackingService.getHealthSummary();

    res.json({
      success: true,
      data: {
        performance: performanceMetrics,
        errors: errorMetrics,
        health: {
          performance: performanceHealth,
          errors: errorHealth
        },
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    logger.error('Failed to get monitoring metrics', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve monitoring metrics'
    });
  }
});

/**
 * @route GET /api/monitoring/performance
 * @desc Get detailed performance report (admin only)
 * @access Private/Admin
 */
router.get('/performance', auth, adminAuth, async (req, res) => {
  try {
    const report = performanceMonitoringService.generateReport();
    const slowEndpoints = performanceMonitoringService.getSlowEndpoints(10);

    res.json({
      success: true,
      data: {
        report,
        slowEndpoints,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    logger.error('Failed to get performance report', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve performance report'
    });
  }
});

/**
 * @route GET /api/monitoring/errors
 * @desc Get error tracking information (admin only)
 * @access Private/Admin
 */
router.get('/errors', auth, adminAuth, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const category = req.query.category as string;

    const metrics = errorTrackingService.getMetrics();
    const recentErrors = category 
      ? errorTrackingService.getErrorsByCategory(category as any, limit)
      : errorTrackingService.getRecentErrors(limit);

    res.json({
      success: true,
      data: {
        metrics,
        recentErrors: recentErrors.map(error => ({
          id: error.error.name + '_' + error.timestamp.getTime(),
          message: error.error.message,
          severity: error.severity,
          category: error.category,
          timestamp: error.timestamp,
          context: error.context
        })),
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    logger.error('Failed to get error tracking data', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve error tracking data'
    });
  }
});

/**
 * @route GET /api/monitoring/system
 * @desc Get system information (admin only)
 * @access Private/Admin
 */
router.get('/system', auth, adminAuth, async (req, res) => {
  try {
    const memoryUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    const uptime = process.uptime();

    res.json({
      success: true,
      data: {
        memory: {
          heapUsed: `${(memoryUsage.heapUsed / 1024 / 1024).toFixed(2)} MB`,
          heapTotal: `${(memoryUsage.heapTotal / 1024 / 1024).toFixed(2)} MB`,
          rss: `${(memoryUsage.rss / 1024 / 1024).toFixed(2)} MB`,
          external: `${(memoryUsage.external / 1024 / 1024).toFixed(2)} MB`,
          heapUsedPercent: ((memoryUsage.heapUsed / memoryUsage.heapTotal) * 100).toFixed(2)
        },
        cpu: {
          user: cpuUsage.user,
          system: cpuUsage.system
        },
        system: {
          uptime: `${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m`,
          platform: process.platform,
          nodeVersion: process.version,
          pid: process.pid
        },
        environment: {
          nodeEnv: process.env.NODE_ENV,
          port: process.env.PORT,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
        },
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    logger.error('Failed to get system information', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve system information'
    });
  }
});

/**
 * @route GET /api/monitoring/backups
 * @desc Get backup status and history (admin only)
 * @access Private/Admin
 */
router.get('/backups', auth, adminAuth, async (req, res) => {
  try {
    const backupStatus = backupService.getBackupStatus();

    res.json({
      success: true,
      data: {
        ...backupStatus,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    logger.error('Failed to get backup status', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve backup status'
    });
  }
});

/**
 * @route POST /api/monitoring/backups/create
 * @desc Create a new backup (admin only)
 * @access Private/Admin
 */
router.post('/backups/create', auth, adminAuth, async (req, res) => {
  try {
    const { type } = req.body;

    let result;
    switch (type) {
      case 'mongodb':
        result = await backupService.createMongoDBBackup();
        break;
      case 'files':
        result = await backupService.createFilesBackup();
        break;
      case 'full':
        result = await backupService.createFullBackup();
        break;
      default:
        return res.status(400).json({
          success: false,
          error: 'Invalid backup type. Use: mongodb, files, or full'
        });
    }

    res.json({
      success: true,
      data: result,
      message: `${type} backup created successfully`
    });
  } catch (error) {
    logger.error('Failed to create backup', { error: error.message, type: req.body.type });
    res.status(500).json({
      success: false,
      error: 'Failed to create backup'
    });
  }
});

/**
 * @route POST /api/monitoring/backups/cleanup
 * @desc Clean up old backups (admin only)
 * @access Private/Admin
 */
router.post('/backups/cleanup', auth, adminAuth, async (req, res) => {
  try {
    await backupService.cleanupOldBackups();

    res.json({
      success: true,
      message: 'Backup cleanup completed successfully'
    });
  } catch (error) {
    logger.error('Failed to cleanup backups', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to cleanup backups'
    });
  }
});

/**
 * @route GET /api/monitoring/logs
 * @desc Get recent log entries (admin only)
 * @access Private/Admin
 */
router.get('/logs', auth, adminAuth, async (req, res) => {
  try {
    const level = req.query.level as string || 'info';
    const limit = parseInt(req.query.limit as string) || 100;

    // This is a simplified implementation
    // In production, you might want to use a log aggregation service
    res.json({
      success: true,
      data: {
        message: 'Log retrieval not implemented in this version',
        suggestion: 'Use log files directly or implement log aggregation service',
        logFiles: [
          '/logs/app.log',
          '/logs/error.log',
          '/logs/http.log',
          '/logs/exceptions.log'
        ]
      }
    });
  } catch (error) {
    logger.error('Failed to get logs', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve logs'
    });
  }
});

/**
 * @route GET /api/monitoring/dashboard
 * @desc Get monitoring dashboard data (admin only)
 * @access Private/Admin
 */
router.get('/dashboard', auth, adminAuth, async (req, res) => {
  try {
    const performanceMetrics = performanceMonitoringService.getMetrics();
    const errorMetrics = errorTrackingService.getMetrics();
    const performanceHealth = performanceMonitoringService.getHealthStatus();
    const errorHealth = errorTrackingService.getHealthSummary();
    const backupStatus = backupService.getBackupStatus();
    const memoryUsage = process.memoryUsage();

    // Calculate key metrics
    const uptime = process.uptime();
    const memoryUsagePercent = (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100;
    const errorRate = performanceMetrics.requests.total > 0 
      ? (performanceMetrics.requests.failed / performanceMetrics.requests.total) * 100 
      : 0;

    res.json({
      success: true,
      data: {
        overview: {
          status: performanceHealth.status === 'healthy' && errorHealth.status === 'healthy' ? 'healthy' : 'warning',
          uptime: `${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m`,
          memoryUsage: `${memoryUsagePercent.toFixed(1)}%`,
          errorRate: `${errorRate.toFixed(2)}%`,
          requestRate: `${performanceMetrics.requests.rate}/min`,
          averageResponseTime: `${performanceMetrics.responseTime.average.toFixed(0)}ms`
        },
        performance: {
          health: performanceHealth,
          metrics: performanceMetrics
        },
        errors: {
          health: errorHealth,
          metrics: errorMetrics
        },
        backups: {
          summary: backupStatus.summary,
          lastBackup: backupStatus.summary.lastBackup
        },
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    logger.error('Failed to get dashboard data', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve dashboard data'
    });
  }
});

export default router;
