import express, { Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import mongoose from 'mongoose';
import 'express-async-errors';

import { config } from './config/environment';
import { logger } from './utils/logger';
import { errorHandler } from './middleware/errorHandler';

// Import routes
import authRoutes from './routes/auth.routes';
import userRoutes from './routes/user.routes';
import propertyRoutes from './routes/property.routes';
import searchRoutes from './routes/search.routes';
import matchRoutes from './routes/match.routes';
import messageRoutes from './routes/message.routes';
import uploadRoutes from './routes/upload.routes';
import emailRoutes from './routes/email.routes';
import notificationRoutes from './routes/notification.routes';
import adminRoutes from './routes/admin.routes';
import sessionRoutes from './routes/session.routes';
import monitoringRoutes from './routes/monitoring.routes';

// Security & Performance imports
import { generalRateLimit, authRateLimit } from './middleware/rateLimiting';
import { sanitizeRequest } from './middleware/sanitization';
import { setupSwagger } from './config/swagger';
import { cacheService } from './services/cacheService';
import { sessionService } from './services/sessionService';
import { tokenService } from './services/tokenService';
import { auditService, AuditEventType } from './services/auditService';
import { monitoringMiddleware } from './middleware/performanceMiddleware';

/**
 * Create Express application
 */
export function createApp(): Express {
  const app = express();

  // Trust proxy for accurate IP addresses
  app.set('trust proxy', 1);

  // CORS configuration
  const corsOptions = {
    origin: config.CORS_ORIGIN || 'http://localhost:3000',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    exposedHeaders: ['X-Total-Count', 'X-Page-Count']
  };

  // Initialize services function (will be called during server startup)
  async function initializeServices() {
    try {
      if (config.NODE_ENV !== 'test') {
        await cacheService.connect();
        await sessionService.connect();
        await tokenService.connect();

        // Initialize monitoring services
        const { performanceMonitoringService } = await import('./services/performanceMonitoringService');
        performanceMonitoringService.startMonitoring();

        logger.info('All services initialized successfully');
      }
    } catch (error) {
      logger.error('Failed to initialize services:', error);
    }
  }

  // Security & Performance Middleware (applied conditionally)
  if (config.NODE_ENV !== 'test') {
    app.use(sanitizeRequest()); // Apply input sanitization first
  }

  // Standard Middleware
  app.use(helmet());
  app.use(cors(corsOptions));
  app.use(compression());
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));
  app.use(cookieParser());

  // Session middleware (only in non-test environment)
  if (config.NODE_ENV !== 'test') {
    app.use(sessionService.createSessionMiddleware());
  }

  // Performance monitoring middleware (only in non-test environment)
  if (config.NODE_ENV !== 'test') {
    app.use(monitoringMiddleware);
  }

  // Logging middleware
  if (config.NODE_ENV !== 'test') {
    app.use(morgan('combined', {
      stream: { write: (message) => logger.info(message.trim()) }
    }));
  }

  // Audit middleware for all requests (only in non-test environment)
  if (config.NODE_ENV !== 'test') {
    app.use((req, res, next) => {
      const startTime = Date.now();
      
      res.on('finish', () => {
        const duration = Date.now() - startTime;
        
        // Log audit event for all requests (only for API endpoints)
        if (req.path.startsWith('/api/')) {
          auditService.logEvent(
            AuditEventType.DATA_VIEWED,
            req,
            {
              success: res.statusCode < 400,
              duration,
              metadata: {
                statusCode: res.statusCode,
                responseTime: duration
              }
            }
          ).catch(error => {
            logger.error('Failed to log audit event:', error);
          });
        }
      });
      
      next();
    });
  }

  // Health check endpoints
  app.get('/health', async (_req, res) => {
    try {
      const { errorTrackingService } = await import('./services/errorTrackingService');
      const { performanceMonitoringService } = await import('./services/performanceMonitoringService');

      const errorHealth = errorTrackingService.getHealthSummary();
      const performanceHealth = performanceMonitoringService.getHealthStatus();
      const memoryUsage = process.memoryUsage();

      const overallStatus =
        errorHealth.status === 'critical' || performanceHealth.status === 'critical'
          ? 'critical'
          : errorHealth.status === 'warning' || performanceHealth.status === 'warning'
          ? 'warning'
          : 'healthy';

      res.status(overallStatus === 'critical' ? 503 : 200).json({
        status: overallStatus.toUpperCase(),
        timestamp: new Date().toISOString(),
        environment: config.NODE_ENV,
        version: process.env.npm_package_version || '1.0.0',
        uptime: process.uptime(),
        services: {
          database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
          redis: cacheService.isConnected() ? 'connected' : 'disconnected',
          sessions: sessionService.isConnected() ? 'connected' : 'disconnected',
          tokens: tokenService.isConnected() ? 'connected' : 'disconnected',
          email: 'configured'
        },
        health: {
          errors: errorHealth,
          performance: performanceHealth
        },
        memory: {
          heapUsed: `${(memoryUsage.heapUsed / 1024 / 1024).toFixed(2)} MB`,
          heapTotal: `${(memoryUsage.heapTotal / 1024 / 1024).toFixed(2)} MB`,
          rss: `${(memoryUsage.rss / 1024 / 1024).toFixed(2)} MB`
        }
      });
    } catch (error) {
      res.status(503).json({
        status: 'ERROR',
        timestamp: new Date().toISOString(),
        error: 'Health check failed',
        services: {
          database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
          redis: cacheService.isConnected() ? 'connected' : 'disconnected'
        }
      });
    }
  });

  // Detailed health check for monitoring systems
  app.get('/health/detailed', async (_req, res) => {
    try {
      const { errorTrackingService } = await import('./services/errorTrackingService');
      const { performanceMonitoringService } = await import('./services/performanceMonitoringService');

      const performanceReport = performanceMonitoringService.generateReport();
      const errorMetrics = errorTrackingService.getMetrics();
      const recentErrors = errorTrackingService.getRecentErrors(10);

      res.json({
        timestamp: new Date().toISOString(),
        performance: performanceReport,
        errors: {
          metrics: errorMetrics,
          recent: recentErrors.map(e => ({
            message: e.error.message,
            severity: e.severity,
            category: e.category,
            timestamp: e.timestamp,
            context: e.context
          }))
        },
        system: {
          uptime: process.uptime(),
          memory: process.memoryUsage(),
          cpu: process.cpuUsage(),
          platform: process.platform,
          nodeVersion: process.version
        }
      });
    } catch (error) {
      res.status(500).json({
        error: 'Failed to generate detailed health report',
        timestamp: new Date().toISOString()
      });
    }
  });

  // API routes with specific rate limiting
  app.use('/api/auth', config.NODE_ENV !== 'test' ? authRateLimit : (req, res, next) => next(), authRoutes);
  app.use('/api/users', config.NODE_ENV !== 'test' ? generalRateLimit : (req, res, next) => next(), userRoutes);
  app.use('/api/properties', config.NODE_ENV !== 'test' ? generalRateLimit : (req, res, next) => next(), propertyRoutes);
  app.use('/api/search', config.NODE_ENV !== 'test' ? generalRateLimit : (req, res, next) => next(), searchRoutes);
  app.use('/api/matches', config.NODE_ENV !== 'test' ? generalRateLimit : (req, res, next) => next(), matchRoutes);
  app.use('/api/messages', config.NODE_ENV !== 'test' ? generalRateLimit : (req, res, next) => next(), messageRoutes);
  app.use('/api/uploads', config.NODE_ENV !== 'test' ? generalRateLimit : (req, res, next) => next(), uploadRoutes);
  app.use('/api/emails', config.NODE_ENV !== 'test' ? generalRateLimit : (req, res, next) => next(), emailRoutes);
  app.use('/api/notifications', config.NODE_ENV !== 'test' ? generalRateLimit : (req, res, next) => next(), notificationRoutes);
  app.use('/api/admin', config.NODE_ENV !== 'test' ? generalRateLimit : (req, res, next) => next(), adminRoutes);
  app.use('/api/sessions', config.NODE_ENV !== 'test' ? generalRateLimit : (req, res, next) => next(), sessionRoutes);
  app.use('/api/monitoring', config.NODE_ENV !== 'test' ? generalRateLimit : (req, res, next) => next(), monitoringRoutes);

  // Setup Swagger documentation (only in non-test environment)
  if (config.NODE_ENV !== 'test') {
    setupSwagger(app);
  }

  // API documentation endpoint
  app.get('/api', (_req, res) => {
    res.json({
      message: 'LajoSpaces API',
      version: '1.0.0',
      environment: config.NODE_ENV,
      documentation: '/api/docs',
      endpoints: {
        auth: '/api/auth',
        users: '/api/users',
        properties: '/api/properties',
        search: '/api/search',
        matches: '/api/matches',
        messages: '/api/messages',
        uploads: '/api/uploads',
        emails: '/api/emails',
        notifications: '/api/notifications',
        admin: '/api/admin',
        sessions: '/api/sessions',
        monitoring: '/api/monitoring',
        docs: '/api/docs'
      }
    });
  });

  // 404 handler
  app.use('*', (req, res) => {
    res.status(404).json({
      success: false,
      error: 'Route not found',
      path: req.originalUrl,
      method: req.method
    });
  });

  // Global error handler
  app.use(errorHandler);

  // Store initialization function on app for server startup
  (app as any).initializeServices = initializeServices;

  return app;
}

export default createApp;
