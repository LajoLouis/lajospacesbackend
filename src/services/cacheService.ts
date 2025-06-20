import { createClient, RedisClientType } from 'redis';
import { config } from '../config/environment';
import { logger } from '../utils/logger';

// Cache configuration
export interface CacheConfig {
  ttl: number; // Time to live in seconds
  prefix: string;
  compress?: boolean;
  serialize?: boolean;
}

// Default cache configurations for different data types
export const cacheConfigs = {
  // User data - moderate TTL
  user: {
    ttl: 15 * 60, // 15 minutes
    prefix: 'user:',
    serialize: true
  },
  
  // Property data - longer TTL as it changes less frequently
  property: {
    ttl: 30 * 60, // 30 minutes
    prefix: 'property:',
    serialize: true
  },
  
  // Search results - shorter TTL as they need to be fresh
  search: {
    ttl: 5 * 60, // 5 minutes
    prefix: 'search:',
    serialize: true,
    compress: true
  },
  
  // Static data - very long TTL
  static: {
    ttl: 24 * 60 * 60, // 24 hours
    prefix: 'static:',
    serialize: true
  },
  
  // Session data - short TTL
  session: {
    ttl: 60 * 60, // 1 hour
    prefix: 'session:',
    serialize: true
  },
  
  // Temporary data - very short TTL
  temp: {
    ttl: 5 * 60, // 5 minutes
    prefix: 'temp:',
    serialize: true
  },
  
  // Analytics data - medium TTL
  analytics: {
    ttl: 60 * 60, // 1 hour
    prefix: 'analytics:',
    serialize: true
  },
  
  // Notification data - short TTL
  notification: {
    ttl: 10 * 60, // 10 minutes
    prefix: 'notification:',
    serialize: true
  }
};

class CacheService {
  private client: RedisClientType;
  private connected: boolean = false;
  private retryAttempts: number = 0;
  private maxRetries: number = 5;

  constructor() {
    this.client = createClient({
      url: config.REDIS_URL,
      socket: {
        connectTimeout: 5000,
        reconnectStrategy: (retries) => {
          if (retries > this.maxRetries) {
            logger.error('Redis cache: Max reconnection attempts reached');
            return false;
          }
          return Math.min(retries * 100, 3000);
        }
      }
    });

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.client.on('connect', () => {
      logger.info('Redis cache client connecting...');
    });

    this.client.on('ready', () => {
      this.connected = true;
      this.retryAttempts = 0;
      logger.info('Redis cache client connected and ready');
    });

    this.client.on('error', (err) => {
      this.connected = false;
      logger.error('Redis cache client error:', err);
    });

    this.client.on('end', () => {
      this.connected = false;
      logger.warn('Redis cache client connection ended');
    });

    this.client.on('reconnecting', () => {
      this.retryAttempts++;
      logger.info(`Redis cache client reconnecting... (attempt ${this.retryAttempts})`);
    });
  }

  async connect(): Promise<void> {
    try {
      if (!this.connected) {
        await this.client.connect();
      }
    } catch (error) {
      logger.error('Failed to connect to Redis cache:', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    try {
      if (this.connected) {
        await this.client.quit();
        this.connected = false;
      }
    } catch (error) {
      logger.error('Error disconnecting from Redis cache:', error);
    }
  }

  private generateKey(key: string, config: CacheConfig): string {
    return `${config.prefix}${key}`;
  }

  private serialize(data: any): string {
    try {
      return JSON.stringify(data);
    } catch (error) {
      logger.error('Cache serialization error:', error);
      return '';
    }
  }

  private deserialize(data: string): any {
    try {
      return JSON.parse(data);
    } catch (error) {
      logger.error('Cache deserialization error:', error);
      return null;
    }
  }

  /**
   * Get data from cache
   */
  async get<T>(key: string, configType: keyof typeof cacheConfigs = 'temp'): Promise<T | null> {
    if (!this.connected) {
      logger.warn('Redis cache not connected, skipping get operation');
      return null;
    }

    try {
      const config = cacheConfigs[configType];
      const cacheKey = this.generateKey(key, config);
      const data = await this.client.get(cacheKey);

      if (!data) {
        return null;
      }

      if (config.serialize) {
        return this.deserialize(data);
      }

      return data as T;
    } catch (error) {
      logger.error('Cache get error:', error);
      return null;
    }
  }

  /**
   * Set data in cache
   */
  async set(
    key: string, 
    value: any, 
    configType: keyof typeof cacheConfigs = 'temp',
    customTTL?: number
  ): Promise<boolean> {
    if (!this.connected) {
      logger.warn('Redis cache not connected, skipping set operation');
      return false;
    }

    try {
      const config = cacheConfigs[configType];
      const cacheKey = this.generateKey(key, config);
      const ttl = customTTL || config.ttl;

      let dataToStore: string;
      if (config.serialize) {
        dataToStore = this.serialize(value);
      } else {
        dataToStore = String(value);
      }

      await this.client.setEx(cacheKey, ttl, dataToStore);
      return true;
    } catch (error) {
      logger.error('Cache set error:', error);
      return false;
    }
  }

  /**
   * Delete data from cache
   */
  async del(key: string, configType: keyof typeof cacheConfigs = 'temp'): Promise<boolean> {
    if (!this.connected) {
      return false;
    }

    try {
      const config = cacheConfigs[configType];
      const cacheKey = this.generateKey(key, config);
      const result = await this.client.del(cacheKey);
      return result > 0;
    } catch (error) {
      logger.error('Cache delete error:', error);
      return false;
    }
  }

  /**
   * Check if key exists in cache
   */
  async exists(key: string, configType: keyof typeof cacheConfigs = 'temp'): Promise<boolean> {
    if (!this.connected) {
      return false;
    }

    try {
      const config = cacheConfigs[configType];
      const cacheKey = this.generateKey(key, config);
      const result = await this.client.exists(cacheKey);
      return result > 0;
    } catch (error) {
      logger.error('Cache exists error:', error);
      return false;
    }
  }

  /**
   * Set expiration for a key
   */
  async expire(key: string, ttl: number, configType: keyof typeof cacheConfigs = 'temp'): Promise<boolean> {
    if (!this.connected) {
      return false;
    }

    try {
      const config = cacheConfigs[configType];
      const cacheKey = this.generateKey(key, config);
      const result = await this.client.expire(cacheKey, ttl);
      return result;
    } catch (error) {
      logger.error('Cache expire error:', error);
      return false;
    }
  }

  /**
   * Get multiple keys at once
   */
  async mget<T>(keys: string[], configType: keyof typeof cacheConfigs = 'temp'): Promise<(T | null)[]> {
    if (!this.connected || keys.length === 0) {
      return keys.map(() => null);
    }

    try {
      const config = cacheConfigs[configType];
      const cacheKeys = keys.map(key => this.generateKey(key, config));
      const results = await this.client.mGet(cacheKeys);

      return results.map(data => {
        if (!data) return null;
        return config.serialize ? this.deserialize(data) : data as T;
      });
    } catch (error) {
      logger.error('Cache mget error:', error);
      return keys.map(() => null);
    }
  }

  /**
   * Set multiple keys at once
   */
  async mset(
    keyValuePairs: Array<{ key: string; value: any }>, 
    configType: keyof typeof cacheConfigs = 'temp',
    customTTL?: number
  ): Promise<boolean> {
    if (!this.connected || keyValuePairs.length === 0) {
      return false;
    }

    try {
      const config = cacheConfigs[configType];
      const ttl = customTTL || config.ttl;

      // Use pipeline for better performance
      const pipeline = this.client.multi();

      for (const { key, value } of keyValuePairs) {
        const cacheKey = this.generateKey(key, config);
        const dataToStore = config.serialize ? this.serialize(value) : String(value);
        pipeline.setEx(cacheKey, ttl, dataToStore);
      }

      await pipeline.exec();
      return true;
    } catch (error) {
      logger.error('Cache mset error:', error);
      return false;
    }
  }

  /**
   * Delete keys by pattern
   */
  async delPattern(pattern: string, configType: keyof typeof cacheConfigs = 'temp'): Promise<number> {
    if (!this.connected) {
      return 0;
    }

    try {
      const config = cacheConfigs[configType];
      const searchPattern = this.generateKey(pattern, config);
      const keys = await this.client.keys(searchPattern);

      if (keys.length === 0) {
        return 0;
      }

      const result = await this.client.del(keys);
      return result;
    } catch (error) {
      logger.error('Cache delete pattern error:', error);
      return 0;
    }
  }

  /**
   * Increment a numeric value
   */
  async incr(key: string, configType: keyof typeof cacheConfigs = 'temp'): Promise<number> {
    if (!this.connected) {
      return 0;
    }

    try {
      const config = cacheConfigs[configType];
      const cacheKey = this.generateKey(key, config);
      return await this.client.incr(cacheKey);
    } catch (error) {
      logger.error('Cache increment error:', error);
      return 0;
    }
  }

  /**
   * Decrement a numeric value
   */
  async decr(key: string, configType: keyof typeof cacheConfigs = 'temp'): Promise<number> {
    if (!this.connected) {
      return 0;
    }

    try {
      const config = cacheConfigs[configType];
      const cacheKey = this.generateKey(key, config);
      return await this.client.decr(cacheKey);
    } catch (error) {
      logger.error('Cache decrement error:', error);
      return 0;
    }
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<any> {
    if (!this.connected) {
      return { connected: false };
    }

    try {
      const info = await this.client.info('memory');
      const keyspace = await this.client.info('keyspace');
      
      return {
        connected: this.connected,
        memory: info,
        keyspace: keyspace,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.error('Cache stats error:', error);
      return { connected: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Clear all cache data (use with caution)
   */
  async flushAll(): Promise<boolean> {
    if (!this.connected) {
      return false;
    }

    try {
      await this.client.flushAll();
      logger.warn('All cache data has been cleared');
      return true;
    } catch (error) {
      logger.error('Cache flush error:', error);
      return false;
    }
  }

  /**
   * Get connection status
   */
  isConnected(): boolean {
    return this.connected;
  }

  /**
   * Get Redis client (for advanced operations)
   */
  getClient(): RedisClientType {
    return this.client;
  }
}

// Create and export singleton instance
export const cacheService = new CacheService();

// Helper functions for common caching patterns
export const cacheHelpers = {
  /**
   * Cache wrapper for database queries
   */
  async cacheQuery<T>(
    key: string,
    queryFn: () => Promise<T>,
    configType: keyof typeof cacheConfigs = 'temp',
    customTTL?: number
  ): Promise<T> {
    // Try to get from cache first
    const cached = await cacheService.get<T>(key, configType);
    if (cached !== null) {
      return cached;
    }

    // Execute query and cache result
    const result = await queryFn();
    await cacheService.set(key, result, configType, customTTL);
    return result;
  },

  /**
   * Invalidate cache for a specific pattern
   */
  async invalidatePattern(pattern: string, configType: keyof typeof cacheConfigs = 'temp'): Promise<number> {
    return await cacheService.delPattern(pattern, configType);
  },

  /**
   * Cache user data
   */
  async cacheUser(userId: string, userData: any): Promise<boolean> {
    return await cacheService.set(userId, userData, 'user');
  },

  /**
   * Get cached user data
   */
  async getCachedUser(userId: string): Promise<any> {
    return await cacheService.get(userId, 'user');
  },

  /**
   * Cache property data
   */
  async cacheProperty(propertyId: string, propertyData: any): Promise<boolean> {
    return await cacheService.set(propertyId, propertyData, 'property');
  },

  /**
   * Get cached property data
   */
  async getCachedProperty(propertyId: string): Promise<any> {
    return await cacheService.get(propertyId, 'property');
  },

  /**
   * Cache search results
   */
  async cacheSearchResults(searchKey: string, results: any): Promise<boolean> {
    return await cacheService.set(searchKey, results, 'search');
  },

  /**
   * Get cached search results
   */
  async getCachedSearchResults(searchKey: string): Promise<any> {
    return await cacheService.get(searchKey, 'search');
  }
};

export default cacheService;
