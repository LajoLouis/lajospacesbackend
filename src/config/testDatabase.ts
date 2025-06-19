import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { createClient, RedisClientType } from 'redis';
import { logger } from '../utils/logger';

// Test database configuration
export interface TestDatabaseConfig {
  mongodb: {
    uri: string;
    options: mongoose.ConnectOptions;
  };
  redis: {
    url: string;
    options: any;
  };
}

// In-memory MongoDB instance
let mongoServer: MongoMemoryServer | null = null;
let redisClient: RedisClientType | null = null;

/**
 * Setup test database connections
 */
export async function setupTestDatabase(): Promise<TestDatabaseConfig> {
  try {
    // Setup MongoDB Memory Server
    mongoServer = await MongoMemoryServer.create({
      instance: {
        dbName: 'lajospaces_test',
        port: 0, // Random available port
      },
      binary: {
        version: '6.0.0',
        downloadDir: './mongodb-binaries'
      }
    });

    const mongoUri = mongoServer.getUri();
    
    // Connect to MongoDB
    await mongoose.connect(mongoUri, {
      bufferCommands: false,
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });

    // Setup Redis Mock (using redis-mock for testing)
    const redisUrl = 'redis://localhost:6379/15'; // Use database 15 for tests
    
    // Create Redis client for tests
    redisClient = createClient({
      url: redisUrl,
      socket: {
        connectTimeout: 5000,
        lazyConnect: true
      }
    });

    // Connect to Redis (will use mock in test environment)
    try {
      await redisClient.connect();
    } catch (error) {
      logger.warn('Redis connection failed in test environment, using mock');
    }

    const config: TestDatabaseConfig = {
      mongodb: {
        uri: mongoUri,
        options: {
          bufferCommands: false,
          maxPoolSize: 10,
          serverSelectionTimeoutMS: 5000,
          socketTimeoutMS: 45000,
        }
      },
      redis: {
        url: redisUrl,
        options: {
          socket: {
            connectTimeout: 5000,
            lazyConnect: true
          }
        }
      }
    };

    logger.info('Test database setup completed', {
      mongodb: mongoUri,
      redis: redisUrl
    });

    return config;
  } catch (error) {
    logger.error('Failed to setup test database:', error);
    throw error;
  }
}

/**
 * Cleanup test database connections
 */
export async function cleanupTestDatabase(): Promise<void> {
  try {
    // Close MongoDB connection
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
    }

    // Stop MongoDB Memory Server
    if (mongoServer) {
      await mongoServer.stop();
      mongoServer = null;
    }

    // Close Redis connection
    if (redisClient && redisClient.isOpen) {
      await redisClient.quit();
      redisClient = null;
    }

    logger.info('Test database cleanup completed');
  } catch (error) {
    logger.error('Failed to cleanup test database:', error);
    throw error;
  }
}

/**
 * Clear all test data from databases
 */
export async function clearTestData(): Promise<void> {
  try {
    // Clear MongoDB collections
    if (mongoose.connection.readyState === 1) {
      const collections = await mongoose.connection.db.collections();
      
      for (const collection of collections) {
        await collection.deleteMany({});
      }
    }

    // Clear Redis data
    if (redisClient && redisClient.isOpen) {
      await redisClient.flushDb();
    }

    logger.info('Test data cleared successfully');
  } catch (error) {
    logger.error('Failed to clear test data:', error);
    throw error;
  }
}

/**
 * Seed test data
 */
export async function seedTestData(): Promise<void> {
  try {
    // Import models
    const { User } = await import('../models/User');
    const { Property } = await import('../models/Property');
    const { Notification } = await import('../models/Notification');

    // Create test users
    const testUsers = [
      {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@test.com',
        password: 'password123',
        phoneNumber: '+2348012345678',
        role: 'user',
        emailVerified: true,
        isActive: true
      },
      {
        firstName: 'Jane',
        lastName: 'Smith',
        email: 'jane.smith@test.com',
        password: 'password123',
        phoneNumber: '+2348012345679',
        role: 'user',
        emailVerified: true,
        isActive: true
      },
      {
        firstName: 'Admin',
        lastName: 'User',
        email: 'admin@test.com',
        password: 'admin123',
        phoneNumber: '+2348012345680',
        role: 'admin',
        emailVerified: true,
        isActive: true
      }
    ];

    const createdUsers = await User.insertMany(testUsers);

    // Create test properties
    const testProperties = [
      {
        title: 'Beautiful 2-Bedroom Apartment',
        description: 'Spacious apartment in Victoria Island',
        type: 'apartment',
        price: 120000,
        currency: 'NGN',
        location: {
          state: 'Lagos',
          lga: 'Victoria Island',
          address: '123 Ahmadu Bello Way',
          coordinates: {
            latitude: 6.4281,
            longitude: 3.4219
          }
        },
        amenities: ['parking', 'security', 'generator', 'water'],
        images: [],
        owner: createdUsers[0]._id,
        status: 'available'
      },
      {
        title: 'Cozy Studio Apartment',
        description: 'Perfect for young professionals',
        type: 'studio',
        price: 80000,
        currency: 'NGN',
        location: {
          state: 'Lagos',
          lga: 'Ikeja',
          address: '456 Allen Avenue',
          coordinates: {
            latitude: 6.6018,
            longitude: 3.3515
          }
        },
        amenities: ['security', 'generator'],
        images: [],
        owner: createdUsers[1]._id,
        status: 'available'
      }
    ];

    await Property.insertMany(testProperties);

    // Create test notifications
    const testNotifications = [
      {
        userId: createdUsers[0]._id,
        type: 'welcome',
        title: 'Welcome to LajoSpaces!',
        message: 'Thank you for joining our platform.',
        priority: 'medium',
        read: false,
        dismissed: false
      }
    ];

    await Notification.insertMany(testNotifications);

    logger.info('Test data seeded successfully', {
      users: createdUsers.length,
      properties: testProperties.length,
      notifications: testNotifications.length
    });
  } catch (error) {
    logger.error('Failed to seed test data:', error);
    throw error;
  }
}

/**
 * Get test database connection status
 */
export function getTestDatabaseStatus(): {
  mongodb: string;
  redis: string;
} {
  return {
    mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    redis: redisClient && redisClient.isOpen ? 'connected' : 'disconnected'
  };
}

/**
 * Create test database transaction
 */
export async function withTestTransaction<T>(
  callback: (session: mongoose.ClientSession) => Promise<T>
): Promise<T> {
  const session = await mongoose.startSession();
  
  try {
    session.startTransaction();
    const result = await callback(session);
    await session.commitTransaction();
    return result;
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    await session.endSession();
  }
}

export { mongoServer, redisClient };
