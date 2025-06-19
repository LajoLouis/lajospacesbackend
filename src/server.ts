import express from 'express';
import { createServer } from 'http';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import mongoose from 'mongoose';
import 'express-async-errors';

import { config } from './config/environment';
import { connectDatabase } from './config/database';
import { connectRedis } from './config/redis';
import { logger } from './utils/logger';
import { errorHandler } from './middleware/errorHandler';
import { notFoundHandler } from './middleware/notFoundHandler';

// Import routes
import authRoutes from './routes/auth.routes';
import userRoutes from './routes/user.routes';
import profileRoutes from './routes/profile.routes';
import photoRoutes from './routes/photo.routes';
import searchRoutes from './routes/search.routes';
import propertyRoutes from './routes/property.routes';
import propertyPhotoRoutes from './routes/propertyPhoto.routes';
import propertyFavoriteRoutes from './routes/propertyFavorite.routes';
import propertySearchRoutes from './routes/propertySearch.routes';
import matchRoutes from './routes/match.routes';
import messageRoutes from './routes/message.routes';
import conversationRoutes from './routes/conversation.routes';
import uploadRoutes from './routes/upload.routes';
import emailRoutes from './routes/email.routes';
import notificationRoutes from './routes/notification.routes';
import adminRoutes from './routes/admin.routes';
import sessionRoutes from './routes/session.routes';

// Security & Performance imports
import { generalRateLimit, authRateLimit } from './middleware/rateLimiting';
import { sanitizeRequest } from './middleware/sanitization';
import { setupSwagger } from './config/swagger';
import { cacheService } from './services/cacheService';
import { sessionService } from './services/sessionService';
import { tokenService } from './services/tokenService';
import { auditService, AuditEventType } from './services/auditService';

const app = express();
const httpServer = createServer(app);

// Trust proxy for rate limiting
app.set('trust proxy', 1);

// Security middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// CORS configuration
app.use(cors({
  origin: config.FRONTEND_URL,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Initialize services function (will be called during server startup)
async function initializeServices() {
  try {
    await cacheService.connect();
    await sessionService.connect();
    await tokenService.connect();
    logger.info('All services initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize services:', error);
  }
}

// Security & Performance Middleware (applied after services are initialized)
app.use(sanitizeRequest()); // Apply input sanitization first

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Session middleware
app.use(sessionService.createSessionMiddleware());

// Compression middleware
app.use(compression());

// Logging middleware
if (config.NODE_ENV !== 'test') {
  app.use(morgan('combined', {
    stream: { write: (message) => logger.info(message.trim()) }
  }));
}

// Audit middleware for all requests
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

// Health check endpoint
app.get('/health', (_req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    environment: config.NODE_ENV,
    version: process.env.npm_package_version || '1.0.0',
    services: {
      database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
      redis: cacheService.isConnected() ? 'connected' : 'disconnected',
      sessions: sessionService.isConnected() ? 'connected' : 'disconnected',
      tokens: tokenService.isConnected() ? 'connected' : 'disconnected',
      email: 'configured'
    }
  });
});

// API routes with specific rate limiting
app.use('/api/auth', authRateLimit, authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/profiles', profileRoutes);
app.use('/api/photos', photoRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/properties', propertyRoutes);
app.use('/api/properties', propertyPhotoRoutes); // Property photo routes
app.use('/api/properties', propertySearchRoutes); // Property search routes
app.use('/api/favorites', propertyFavoriteRoutes); // Property favorites routes
app.use('/api/matches', matchRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/conversations', conversationRoutes);
app.use('/api/uploads', uploadRoutes);
app.use('/api/emails', emailRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/sessions', sessionRoutes);

// Setup Swagger documentation
setupSwagger(app);

// API documentation endpoint
app.get('/api', (_req, res) => {
  res.json({
    message: 'LajoSpaces API',
    version: '1.0.0',
    documentation: '/api/docs',
    endpoints: {
      auth: '/api/auth',
      users: '/api/users',
      profiles: '/api/profiles',
      photos: '/api/photos',
      search: '/api/search',
      properties: '/api/properties',
      favorites: '/api/favorites',
      matches: '/api/matches',
      messages: '/api/messages',
      conversations: '/api/conversations',
      uploads: '/api/uploads',
      emails: '/api/emails',
      notifications: '/api/notifications',
      admin: '/api/admin',
      sessions: '/api/sessions',
      docs: '/api/docs'
    }
  });
});

// Error handling middleware (must be last)
app.use(notFoundHandler);
app.use(errorHandler);

// Start server function
async function startServer() {
  try {
    // Connect to databases
    await connectDatabase();
    await connectRedis();

    // Initialize security and performance services
    await initializeServices();

    // Apply rate limiting after services are initialized
    app.use(generalRateLimit);

    // Initialize Socket.IO service
    const { SocketService } = await import('./services/socketService');
    const socketService = new SocketService(httpServer);

    // Make socket service available globally
    (global as any).socketService = socketService;

    // Start HTTP server
    const server = httpServer.listen(config.PORT, () => {
      logger.info(`🚀 LajoSpaces Backend Server running on port ${config.PORT}`);
      logger.info(`🌍 Environment: ${config.NODE_ENV}`);
      logger.info(`📊 Health check: http://localhost:${config.PORT}/health`);
      logger.info(`🔗 API Base URL: http://localhost:${config.PORT}/api`);
      logger.info(`💬 Socket.IO enabled for real-time messaging`);
    });

    // Graceful shutdown
    process.on('SIGTERM', () => {
      logger.info('SIGTERM received, shutting down gracefully');
      server.close(() => {
        logger.info('Process terminated');
        process.exit(0);
      });
    });

    process.on('SIGINT', () => {
      logger.info('SIGINT received, shutting down gracefully');
      server.close(() => {
        logger.info('Process terminated');
        process.exit(0);
      });
    });

    return server;
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Start the server if this file is run directly
if (require.main === module) {
  startServer();
}

export { app, httpServer, startServer };
