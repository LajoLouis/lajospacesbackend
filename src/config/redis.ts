import { createClient, RedisClientType } from 'redis';
import { config } from './environment';
import { logger } from '../utils/logger';

// Redis client instance
let redisClient: RedisClientType | null = null;

/**
 * Connect to Redis
 */
export async function connectRedis(): Promise<RedisClientType> {
  try {
    if (redisClient && redisClient.isOpen) {
      logger.info('🔴 Redis already connected');
      return redisClient;
    }

    logger.info('🔴 Connecting to Redis...');

    // Create Redis client
    redisClient = createClient({
      url: config.REDIS_URL,
      socket: {
        connectTimeout: 5000,
      },
    });

    // Error handling
    redisClient.on('error', (error) => {
      logger.error('❌ Redis connection error:', error);
    });

    redisClient.on('connect', () => {
      logger.info('🔴 Redis client connected');
    });

    redisClient.on('ready', () => {
      logger.info('✅ Redis client ready');
    });

    redisClient.on('end', () => {
      logger.info('🔴 Redis client disconnected');
    });

    // Connect to Redis
    await redisClient.connect();
    
    // Test connection
    await redisClient.ping();
    logger.info('✅ Redis connected successfully');

    return redisClient;
  } catch (error) {
    logger.error('❌ Redis connection failed:', error);
    throw error;
  }
}

/**
 * Disconnect from Redis
 */
export async function disconnectRedis(): Promise<void> {
  try {
    if (redisClient && redisClient.isOpen) {
      await redisClient.quit();
      logger.info('🔴 Redis disconnected successfully');
    }
  } catch (error) {
    logger.error('❌ Redis disconnection failed:', error);
    throw error;
  }
}

/**
 * Get Redis client instance
 */
export function getRedisClient(): RedisClientType {
  if (!redisClient || !redisClient.isOpen) {
    throw new Error('Redis client is not connected');
  }
  return redisClient;
}

/**
 * Redis utility functions
 */
export const redisUtils = {
  /**
   * Set a key-value pair with optional expiration
   */
  async set(key: string, value: string, expirationInSeconds?: number): Promise<void> {
    const client = getRedisClient();
    if (expirationInSeconds) {
      await client.setEx(key, expirationInSeconds, value);
    } else {
      await client.set(key, value);
    }
  },

  /**
   * Get value by key
   */
  async get(key: string): Promise<string | null> {
    const client = getRedisClient();
    return await client.get(key);
  },

  /**
   * Delete a key
   */
  async del(key: string): Promise<number> {
    const client = getRedisClient();
    return await client.del(key);
  },

  /**
   * Check if key exists
   */
  async exists(key: string): Promise<boolean> {
    const client = getRedisClient();
    const result = await client.exists(key);
    return result === 1;
  },

  /**
   * Set expiration for a key
   */
  async expire(key: string, seconds: number): Promise<boolean> {
    const client = getRedisClient();
    const result = await client.expire(key, seconds);
    return Boolean(result);
  },

  /**
   * Get time to live for a key
   */
  async ttl(key: string): Promise<number> {
    const client = getRedisClient();
    return await client.ttl(key);
  },

  /**
   * Increment a numeric value
   */
  async incr(key: string): Promise<number> {
    const client = getRedisClient();
    return await client.incr(key);
  },

  /**
   * Set multiple key-value pairs
   */
  async mset(keyValuePairs: Record<string, string>): Promise<void> {
    const client = getRedisClient();
    await client.mSet(keyValuePairs);
  },

  /**
   * Get multiple values by keys
   */
  async mget(keys: string[]): Promise<(string | null)[]> {
    const client = getRedisClient();
    return await client.mGet(keys);
  },

  /**
   * Add to a set
   */
  async sadd(key: string, ...members: string[]): Promise<number> {
    const client = getRedisClient();
    return await client.sAdd(key, members);
  },

  /**
   * Remove from a set
   */
  async srem(key: string, ...members: string[]): Promise<number> {
    const client = getRedisClient();
    return await client.sRem(key, members);
  },

  /**
   * Check if member exists in set
   */
  async sismember(key: string, member: string): Promise<boolean> {
    const client = getRedisClient();
    const result = await client.sIsMember(key, member);
    return Boolean(result);
  },

  /**
   * Get all members of a set
   */
  async smembers(key: string): Promise<string[]> {
    const client = getRedisClient();
    return await client.sMembers(key);
  }
};

/**
 * Redis key generators for different data types
 */
export const redisKeys = {
  // User sessions
  userSession: (userId: string) => `session:user:${userId}`,
  
  // Refresh tokens
  refreshToken: (tokenId: string) => `refresh_token:${tokenId}`,
  
  // Email verification tokens
  emailVerification: (token: string) => `email_verification:${token}`,
  
  // Password reset tokens
  passwordReset: (token: string) => `password_reset:${token}`,
  
  // Rate limiting
  rateLimit: (ip: string) => `rate_limit:${ip}`,
  
  // User cache
  userCache: (userId: string) => `cache:user:${userId}`,
  
  // Profile cache
  profileCache: (userId: string) => `cache:profile:${userId}`,
  
  // Property cache
  propertyCache: (propertyId: string) => `cache:property:${propertyId}`,
  
  // Search cache
  searchCache: (query: string) => `cache:search:${Buffer.from(query).toString('base64')}`,
  
  // Online users
  onlineUsers: () => 'online_users',
  
  // Socket sessions
  socketSession: (socketId: string) => `socket:${socketId}`,
  
  // User sockets
  userSockets: (userId: string) => `user_sockets:${userId}`
};

// Handle application termination
process.on('SIGINT', async () => {
  try {
    await disconnectRedis();
    logger.info('🔴 Redis connection closed through app termination');
  } catch (error) {
    logger.error('❌ Error during Redis disconnection:', error);
  }
});

export default {
  connect: connectRedis,
  disconnect: disconnectRedis,
  getClient: getRedisClient,
  utils: redisUtils,
  keys: redisKeys
};
