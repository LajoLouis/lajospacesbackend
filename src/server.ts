import express from 'express';
import { createServer } from 'http';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
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

// Rate limiting
const limiter = rateLimit({
  windowMs: config.RATE_LIMIT_WINDOW_MS,
  max: config.RATE_LIMIT_MAX_REQUESTS,
  message: {
    error: 'Too many requests from this IP, please try again later.',
    retryAfter: Math.ceil(config.RATE_LIMIT_WINDOW_MS / 1000)
  },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api', limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Compression middleware
app.use(compression());

// Logging middleware
if (config.NODE_ENV !== 'test') {
  app.use(morgan('combined', {
    stream: { write: (message) => logger.info(message.trim()) }
  }));
}

// Health check endpoint
app.get('/health', (_req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    environment: config.NODE_ENV,
    version: process.env.npm_package_version || '1.0.0'
  });
});

// API routes
app.use('/api/auth', authRoutes);
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
      conversations: '/api/conversations'
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
