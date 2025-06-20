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

// Import routes (all disabled to test basic server startup)
// import authRoutes from './routes/auth.routes';
// import userRoutes from './routes/user.routes';
// import profileRoutes from './routes/profile.routes';
// import photoRoutes from './routes/photo.routes';
// import uploadRoutes from './routes/upload.routes';
// import searchRoutes from './routes/search.routes';
// import propertyRoutes from './routes/property.routes';
// import propertyPhotoRoutes from './routes/propertyPhoto.routes';
// import propertyFavoriteRoutes from './routes/propertyFavorite.routes';
// import propertySearchRoutes from './routes/propertySearch.routes';
// import matchRoutes from './routes/match.routes';
// import messageRoutes from './routes/message.routes';
// import conversationRoutes from './routes/conversation.routes';
// import emailRoutes from './routes/email.routes';
// import notificationRoutes from './routes/notification.routes';
// import adminRoutes from './routes/admin.routes';
// import sessionRoutes from './routes/session.routes';

// Security & Performance imports
import { generalRateLimit } from './middleware/rateLimiting';
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

// Setup routes function (dynamically import routes after database connection)
async function setupRoutes(app: any) {
  try {
    logger.info('🔄 Starting route setup...');
    // Import routes dynamically after database connection (temporarily disabled)
    // logger.info('🔄 Importing auth routes...');
    // const { default: authRoutes } = await import('./routes/auth.routes');
    // logger.info('✅ Auth routes imported successfully');
    // const { default: userRoutes } = await import('./routes/user.routes');
    // const { default: profileRoutes } = await import('./routes/profile.routes');
    // const { default: photoRoutes } = await import('./routes/photo.routes');
    // const { default: uploadRoutes } = await import('./routes/upload.routes');
    // const { default: searchRoutes } = await import('./routes/search.routes');
    const { default: propertyRoutes } = await import('./routes/property.routes');
    // const { default: propertyPhotoRoutes } = await import('./routes/propertyPhoto.routes');
    // const { default: propertyFavoriteRoutes } = await import('./routes/propertyFavorite.routes');
    // const { default: propertySearchRoutes } = await import('./routes/propertySearch.routes');
    const { default: matchRoutes } = await import('./routes/match.routes');
    const { default: messageRoutes } = await import('./routes/message.routes');
    const { default: conversationRoutes } = await import('./routes/conversation.routes');
    const { default: emailRoutes } = await import('./routes/email.routes');
    const { default: notificationRoutes } = await import('./routes/notification.routes');
    // const { default: adminRoutes } = await import('./routes/admin.routes');
    // const { default: sessionRoutes } = await import('./routes/session.routes');

    // Setup API routes (rate limiting will be applied globally)

    // Add a simple test route first
    logger.info('🔄 Mounting test route...');
    app.get('/api/test', (req, res) => {
      res.json({ message: 'Test route working', timestamp: new Date().toISOString() });
    });
    logger.info('✅ Test route mounted successfully');

    // logger.info('🔗 Mounting auth routes...');
    // app.use('/api/auth', authRoutes);
    // logger.info('🔗 Mounting user routes...');
    // app.use('/api/users', userRoutes);
    // logger.info('🔗 Mounting profile routes...');
    // app.use('/api/profiles', profileRoutes);
    // logger.info('🔗 Mounting photo routes...');
    // app.use('/api/photos', photoRoutes);
    // logger.info('🔗 Mounting upload routes...');
    // app.use('/api/uploads', uploadRoutes);
    // logger.info('🔗 Mounting search routes...');
    // app.use('/api/search', searchRoutes);
    logger.info('🔗 Mounting property routes...');
    app.use('/api/properties', propertyRoutes);
    // app.use('/api/properties', propertyPhotoRoutes);
    // app.use('/api/properties', propertySearchRoutes);
    // app.use('/api/favorites', propertyFavoriteRoutes);
    app.use('/api/matches', matchRoutes);
    app.use('/api/messages', messageRoutes);
    app.use('/api/conversations', conversationRoutes);
    app.use('/api/emails', emailRoutes);
    app.use('/api/notifications', notificationRoutes);
    // app.use('/api/admin', adminRoutes);
    // app.use('/api/sessions', sessionRoutes);
    logger.info('🔗 All routes mounted successfully');

    // Apply error handling middleware after routes are mounted (must be last)
    app.use(notFoundHandler);
    app.use(errorHandler);
    logger.info('🔗 Error handlers applied');

  } catch (error) {
    logger.error('Failed to setup routes:', error);
    throw error;
  }
}

// Initialize services function (will be called during server startup)
async function initializeServices() {
  try {
    logger.info('🔄 Connecting cache service...');
    await cacheService.connect();
    logger.info('✅ Cache service connected');

    logger.info('🔄 Connecting session service...');
    await sessionService.connect();
    logger.info('✅ Session service connected');

    logger.info('🔄 Connecting token service...');
    await tokenService.connect();
    logger.info('✅ Token service connected');

    logger.info('All services initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize services:', error);
    throw error; // Re-throw to prevent server from starting with broken services
  }
}

// Security & Performance Middleware (applied after services are initialized)
app.use(sanitizeRequest()); // Apply input sanitization first

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Session middleware will be added after services are initialized

// Compression middleware
app.use(compression());

// Logging middleware
if (config.NODE_ENV !== 'test') {
  app.use(morgan('combined', {
    stream: { write: (message) => logger.info(message.trim()) }
  }));
}

// Audit middleware for all requests (temporarily disabled)
// app.use((req, res, next) => {
//   const startTime = Date.now();

//   res.on('finish', () => {
//     const duration = Date.now() - startTime;

//     // Log audit event for all requests (only for API endpoints)
//     if (req.path.startsWith('/api/')) {
//       auditService.logEvent(
//         AuditEventType.DATA_VIEWED,
//         req,
//         {
//           success: res.statusCode < 400,
//           duration,
//           metadata: {
//             statusCode: res.statusCode,
//             responseTime: duration
//           }
//         }
//       ).catch(error => {
//         logger.error('Failed to log audit event:', error);
//       });
//     }
//   });

//   next();
// });

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

// API routes (all disabled for testing)
// app.use('/api/auth', authRateLimit, authRoutes);
// app.use('/api/users', generalRateLimit, userRoutes);
// app.use('/api/profiles', generalRateLimit, profileRoutes);
// app.use('/api/photos', generalRateLimit, photoRoutes);
// app.use('/api/uploads', generalRateLimit, uploadRoutes);
// app.use('/api/search', generalRateLimit, searchRoutes);
// app.use('/api/properties', generalRateLimit, propertyRoutes);
// app.use('/api/properties', generalRateLimit, propertyPhotoRoutes); // Property photo routes
// app.use('/api/properties', generalRateLimit, propertySearchRoutes); // Property search routes
// app.use('/api/favorites', generalRateLimit, propertyFavoriteRoutes); // Property favorites routes
// app.use('/api/matches', generalRateLimit, matchRoutes);
// app.use('/api/messages', generalRateLimit, messageRoutes);
// app.use('/api/conversations', generalRateLimit, conversationRoutes);
// app.use('/api/emails', generalRateLimit, emailRoutes);
// app.use('/api/notifications', generalRateLimit, notificationRoutes);
// app.use('/api/admin', generalRateLimit, adminRoutes);
// app.use('/api/sessions', generalRateLimit, sessionRoutes);

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

// Error handling middleware will be applied after routes are mounted

// Start server function
async function startServer() {
  try {
    logger.info('🚀 Starting LajoSpaces Backend Server...');

    // Connect to databases (temporarily disabled for debugging)
    // logger.info('📊 Connecting to MongoDB...');
    // await connectDatabase();
    // logger.info('✅ MongoDB connection completed');

    // logger.info('🔴 Connecting to Redis...');
    // await connectRedis();
    // logger.info('✅ Redis connection completed');

    // Initialize security and performance services (temporarily disabled)
    // logger.info('⚙️ Initializing services...');
    // await initializeServices();
    // logger.info('✅ Services initialization completed');

    // Setup session middleware after services are initialized (temporarily disabled)
    // logger.info('🔐 Setting up session middleware...');
    // app.use(sessionService.createSessionMiddleware());

    // Apply rate limiting before routes are mounted (temporarily disabled)
    // logger.info('🛡️ Setting up rate limiting...');
    // app.use(generalRateLimit);

    // Now that middleware is set up, dynamically import and setup routes
    logger.info('📋 Setting up API routes...');
    await setupRoutes(app);
    logger.info('✅ API routes configured');

    // Initialize Socket.IO service (temporarily disabled)
    // logger.info('💬 Initializing Socket.IO service...');
    // const { SocketService } = await import('./services/socketService');
    // const socketService = new SocketService(httpServer);

    // Make socket service available globally
    // (global as any).socketService = socketService;
    // logger.info('✅ Socket.IO service initialized');

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
  logger.info('🚀 Starting server initialization...');
  startServer().catch(error => {
    logger.error('Server startup failed:', error);
    process.exit(1);
  });
}

export { app, httpServer, startServer };
