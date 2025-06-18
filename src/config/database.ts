import mongoose from 'mongoose';
import { config } from './environment';
import { logger } from '../utils/logger';

// MongoDB connection options
const mongoOptions: mongoose.ConnectOptions = {
  maxPoolSize: 10, // Maintain up to 10 socket connections
  serverSelectionTimeoutMS: 5000, // Keep trying to send operations for 5 seconds
  socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
};

// Database connection state
let isConnected = false;

/**
 * Connect to MongoDB database
 */
export async function connectDatabase(): Promise<void> {
  try {
    if (isConnected) {
      logger.info('📊 Database already connected');
      return;
    }

    const mongoUri = config.NODE_ENV === 'test' ? config.MONGODB_TEST_URI : config.MONGODB_URI;
    
    logger.info('📊 Connecting to MongoDB...');
    
    await mongoose.connect(mongoUri, mongoOptions);
    
    isConnected = true;
    logger.info('✅ MongoDB connected successfully');
    
    // Log database name
    const dbName = mongoose.connection.db?.databaseName;
    logger.info(`📊 Connected to database: ${dbName}`);
    
  } catch (error) {
    logger.error('❌ MongoDB connection failed:', error);
    throw error;
  }
}

/**
 * Disconnect from MongoDB database
 */
export async function disconnectDatabase(): Promise<void> {
  try {
    if (!isConnected) {
      logger.info('📊 Database already disconnected');
      return;
    }

    await mongoose.disconnect();
    isConnected = false;
    logger.info('📊 MongoDB disconnected successfully');
  } catch (error) {
    logger.error('❌ MongoDB disconnection failed:', error);
    throw error;
  }
}

/**
 * Get database connection status
 */
export function getDatabaseStatus(): {
  isConnected: boolean;
  readyState: number;
  host?: string;
  name?: string;
} {
  return {
    isConnected,
    readyState: mongoose.connection.readyState,
    host: mongoose.connection.host,
    name: mongoose.connection.name
  };
}

/**
 * Clear database (for testing purposes only)
 */
export async function clearDatabase(): Promise<void> {
  if (config.NODE_ENV !== 'test') {
    throw new Error('clearDatabase can only be used in test environment');
  }

  const collections = mongoose.connection.collections;
  
  for (const key in collections) {
    const collection = collections[key];
    await collection.deleteMany({});
  }
  
  logger.info('🧹 Test database cleared');
}

// Connection event handlers
mongoose.connection.on('connected', () => {
  logger.info('📊 Mongoose connected to MongoDB');
});

mongoose.connection.on('error', (error) => {
  logger.error('❌ Mongoose connection error:', error);
  isConnected = false;
});

mongoose.connection.on('disconnected', () => {
  logger.info('📊 Mongoose disconnected from MongoDB');
  isConnected = false;
});

// Handle application termination
process.on('SIGINT', async () => {
  try {
    await disconnectDatabase();
    logger.info('📊 MongoDB connection closed through app termination');
    process.exit(0);
  } catch (error) {
    logger.error('❌ Error during MongoDB disconnection:', error);
    process.exit(1);
  }
});

export default {
  connect: connectDatabase,
  disconnect: disconnectDatabase,
  getStatus: getDatabaseStatus,
  clear: clearDatabase
};
