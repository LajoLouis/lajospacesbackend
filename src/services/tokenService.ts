import { createClient, RedisClientType } from 'redis';
import crypto from 'crypto';
import { config } from '../config/environment';
import { logger } from '../utils/logger';
import { AppError } from '../utils/appError';

// Token types and their configurations
export enum TokenType {
  EMAIL_VERIFICATION = 'email_verification',
  PASSWORD_RESET = 'password_reset',
  PHONE_VERIFICATION = 'phone_verification',
  TWO_FACTOR_AUTH = 'two_factor_auth',
  API_ACCESS = 'api_access',
  REFRESH_TOKEN = 'refresh_token',
  MAGIC_LINK = 'magic_link',
  ACCOUNT_ACTIVATION = 'account_activation',
  EMAIL_CHANGE = 'email_change',
  PHONE_CHANGE = 'phone_change'
}

// Token configuration interface
export interface TokenConfig {
  ttl: number; // Time to live in seconds
  length: number; // Token length
  prefix: string;
  format: 'hex' | 'base64' | 'numeric' | 'alphanumeric';
  caseSensitive: boolean;
  allowReuse: boolean; // Whether the same token can be used multiple times
}

// Token data interface
export interface TokenData {
  token: string;
  type: TokenType;
  userId: string;
  email?: string;
  phoneNumber?: string;
  data?: Record<string, any>;
  createdAt: Date;
  expiresAt: Date;
  usedAt?: Date;
  usageCount: number;
  maxUsage: number;
  isActive: boolean;
  metadata?: {
    ipAddress?: string;
    userAgent?: string;
    purpose?: string;
  };
}

// Default token configurations
const tokenConfigs: Record<TokenType, TokenConfig> = {
  [TokenType.EMAIL_VERIFICATION]: {
    ttl: 24 * 60 * 60, // 24 hours
    length: 32,
    prefix: 'ev_',
    format: 'hex',
    caseSensitive: false,
    allowReuse: false
  },
  [TokenType.PASSWORD_RESET]: {
    ttl: 60 * 60, // 1 hour
    length: 32,
    prefix: 'pr_',
    format: 'hex',
    caseSensitive: false,
    allowReuse: false
  },
  [TokenType.PHONE_VERIFICATION]: {
    ttl: 10 * 60, // 10 minutes
    length: 6,
    prefix: 'pv_',
    format: 'numeric',
    caseSensitive: false,
    allowReuse: false
  },
  [TokenType.TWO_FACTOR_AUTH]: {
    ttl: 5 * 60, // 5 minutes
    length: 6,
    prefix: '2fa_',
    format: 'numeric',
    caseSensitive: false,
    allowReuse: false
  },
  [TokenType.API_ACCESS]: {
    ttl: 30 * 24 * 60 * 60, // 30 days
    length: 40,
    prefix: 'api_',
    format: 'hex',
    caseSensitive: true,
    allowReuse: true
  },
  [TokenType.REFRESH_TOKEN]: {
    ttl: 7 * 24 * 60 * 60, // 7 days
    length: 32,
    prefix: 'rt_',
    format: 'hex',
    caseSensitive: true,
    allowReuse: true
  },
  [TokenType.MAGIC_LINK]: {
    ttl: 15 * 60, // 15 minutes
    length: 32,
    prefix: 'ml_',
    format: 'hex',
    caseSensitive: false,
    allowReuse: false
  },
  [TokenType.ACCOUNT_ACTIVATION]: {
    ttl: 7 * 24 * 60 * 60, // 7 days
    length: 32,
    prefix: 'aa_',
    format: 'hex',
    caseSensitive: false,
    allowReuse: false
  },
  [TokenType.EMAIL_CHANGE]: {
    ttl: 60 * 60, // 1 hour
    length: 32,
    prefix: 'ec_',
    format: 'hex',
    caseSensitive: false,
    allowReuse: false
  },
  [TokenType.PHONE_CHANGE]: {
    ttl: 10 * 60, // 10 minutes
    length: 6,
    prefix: 'pc_',
    format: 'numeric',
    caseSensitive: false,
    allowReuse: false
  }
};

class TokenService {
  private redisClient: RedisClientType;
  private connected: boolean = false;

  constructor() {
    this.redisClient = createClient({
      url: config.REDIS_URL,
      socket: {
        connectTimeout: 5000,
        lazyConnect: true
      }
    });

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.redisClient.on('connect', () => {
      logger.info('Redis token client connecting...');
    });

    this.redisClient.on('ready', () => {
      this.connected = true;
      logger.info('Redis token client connected and ready');
    });

    this.redisClient.on('error', (err) => {
      this.connected = false;
      logger.error('Redis token client error:', err);
    });

    this.redisClient.on('end', () => {
      this.connected = false;
      logger.warn('Redis token client connection ended');
    });
  }

  async connect(): Promise<void> {
    try {
      if (!this.connected) {
        await this.redisClient.connect();
      }
    } catch (error) {
      logger.error('Failed to connect to Redis for tokens:', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    try {
      if (this.connected) {
        await this.redisClient.quit();
        this.connected = false;
      }
    } catch (error) {
      logger.error('Error disconnecting from Redis tokens:', error);
    }
  }

  /**
   * Generate a token based on type configuration
   */
  private generateToken(type: TokenType): string {
    const config = tokenConfigs[type];
    let token: string;

    switch (config.format) {
      case 'hex':
        token = crypto.randomBytes(config.length / 2).toString('hex');
        break;
      case 'base64':
        token = crypto.randomBytes(config.length).toString('base64').slice(0, config.length);
        break;
      case 'numeric':
        token = '';
        for (let i = 0; i < config.length; i++) {
          token += Math.floor(Math.random() * 10).toString();
        }
        break;
      case 'alphanumeric':
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        token = '';
        for (let i = 0; i < config.length; i++) {
          token += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        break;
      default:
        token = crypto.randomBytes(16).toString('hex');
    }

    return config.caseSensitive ? token : token.toLowerCase();
  }

  /**
   * Create a new token
   */
  async createToken(
    type: TokenType,
    userId: string,
    options: {
      email?: string;
      phoneNumber?: string;
      data?: Record<string, any>;
      customTTL?: number;
      maxUsage?: number;
      metadata?: {
        ipAddress?: string;
        userAgent?: string;
        purpose?: string;
      };
    } = {}
  ): Promise<string> {
    if (!this.connected) {
      throw new AppError('Token service not available', 503);
    }

    const config = tokenConfigs[type];
    const token = this.generateToken(type);
    const now = new Date();
    const ttl = options.customTTL || config.ttl;

    const tokenData: TokenData = {
      token,
      type,
      userId,
      email: options.email,
      phoneNumber: options.phoneNumber,
      data: options.data || {},
      createdAt: now,
      expiresAt: new Date(now.getTime() + ttl * 1000),
      usageCount: 0,
      maxUsage: options.maxUsage || (config.allowReuse ? 10 : 1),
      isActive: true,
      metadata: options.metadata
    };

    try {
      const key = `token:${config.prefix}${token}`;
      
      // Store token data
      await this.redisClient.setEx(key, ttl, JSON.stringify(tokenData));
      
      // Index by user for easy lookup
      await this.redisClient.sAdd(`user_tokens:${userId}:${type}`, token);
      await this.redisClient.expire(`user_tokens:${userId}:${type}`, ttl);

      logger.info('Token created', {
        type,
        userId,
        tokenPrefix: token.substring(0, 8) + '...',
        ttl
      });

      return token;
    } catch (error) {
      logger.error('Error creating token:', error);
      throw new AppError('Failed to create token', 500);
    }
  }

  /**
   * Verify and consume a token
   */
  async verifyToken(
    token: string,
    type: TokenType,
    consume: boolean = true
  ): Promise<TokenData | null> {
    if (!this.connected) {
      throw new AppError('Token service not available', 503);
    }

    const config = tokenConfigs[type];
    const normalizedToken = config.caseSensitive ? token : token.toLowerCase();
    const key = `token:${config.prefix}${normalizedToken}`;

    try {
      const tokenDataStr = await this.redisClient.get(key);
      if (!tokenDataStr) {
        return null;
      }

      const tokenData: TokenData = JSON.parse(tokenDataStr);

      // Check if token is active
      if (!tokenData.isActive) {
        return null;
      }

      // Check if token has expired
      if (new Date() > new Date(tokenData.expiresAt)) {
        await this.invalidateToken(token, type);
        return null;
      }

      // Check usage limits
      if (tokenData.usageCount >= tokenData.maxUsage) {
        await this.invalidateToken(token, type);
        return null;
      }

      // Consume token if requested
      if (consume) {
        tokenData.usageCount++;
        tokenData.usedAt = new Date();

        // If max usage reached, mark as inactive
        if (tokenData.usageCount >= tokenData.maxUsage) {
          tokenData.isActive = false;
        }

        // Update token data
        const remainingTTL = await this.redisClient.ttl(key);
        if (remainingTTL > 0) {
          await this.redisClient.setEx(key, remainingTTL, JSON.stringify(tokenData));
        }

        logger.info('Token consumed', {
          type,
          userId: tokenData.userId,
          usageCount: tokenData.usageCount,
          maxUsage: tokenData.maxUsage
        });
      }

      return tokenData;
    } catch (error) {
      logger.error('Error verifying token:', error);
      return null;
    }
  }

  /**
   * Invalidate a specific token
   */
  async invalidateToken(token: string, type: TokenType): Promise<boolean> {
    if (!this.connected) {
      return false;
    }

    const config = tokenConfigs[type];
    const normalizedToken = config.caseSensitive ? token : token.toLowerCase();
    const key = `token:${config.prefix}${normalizedToken}`;

    try {
      // Get token data to remove from user index
      const tokenDataStr = await this.redisClient.get(key);
      if (tokenDataStr) {
        const tokenData: TokenData = JSON.parse(tokenDataStr);
        await this.redisClient.sRem(`user_tokens:${tokenData.userId}:${type}`, token);
      }

      // Delete token
      const result = await this.redisClient.del(key);
      
      logger.info('Token invalidated', {
        type,
        tokenPrefix: token.substring(0, 8) + '...'
      });

      return result > 0;
    } catch (error) {
      logger.error('Error invalidating token:', error);
      return false;
    }
  }

  /**
   * Invalidate all tokens of a specific type for a user
   */
  async invalidateUserTokens(userId: string, type: TokenType): Promise<number> {
    if (!this.connected) {
      return 0;
    }

    try {
      const tokens = await this.redisClient.sMembers(`user_tokens:${userId}:${type}`);
      let invalidatedCount = 0;

      for (const token of tokens) {
        const success = await this.invalidateToken(token, type);
        if (success) {
          invalidatedCount++;
        }
      }

      // Clean up the user tokens set
      await this.redisClient.del(`user_tokens:${userId}:${type}`);

      logger.info('User tokens invalidated', {
        userId,
        type,
        count: invalidatedCount
      });

      return invalidatedCount;
    } catch (error) {
      logger.error('Error invalidating user tokens:', error);
      return 0;
    }
  }

  /**
   * Get user's active tokens of a specific type
   */
  async getUserTokens(userId: string, type: TokenType): Promise<TokenData[]> {
    if (!this.connected) {
      return [];
    }

    try {
      const tokens = await this.redisClient.sMembers(`user_tokens:${userId}:${type}`);
      const tokenDataList: TokenData[] = [];
      const config = tokenConfigs[type];

      for (const token of tokens) {
        const key = `token:${config.prefix}${token}`;
        const tokenDataStr = await this.redisClient.get(key);
        
        if (tokenDataStr) {
          const tokenData: TokenData = JSON.parse(tokenDataStr);
          if (tokenData.isActive && new Date() <= new Date(tokenData.expiresAt)) {
            tokenDataList.push(tokenData);
          }
        }
      }

      return tokenDataList;
    } catch (error) {
      logger.error('Error getting user tokens:', error);
      return [];
    }
  }

  /**
   * Clean up expired tokens
   */
  async cleanupExpiredTokens(): Promise<number> {
    if (!this.connected) {
      return 0;
    }

    try {
      const pattern = 'token:*';
      const keys = await this.redisClient.keys(pattern);
      let cleanedCount = 0;

      for (const key of keys) {
        const ttl = await this.redisClient.ttl(key);
        if (ttl <= 0) {
          await this.redisClient.del(key);
          cleanedCount++;
        }
      }

      logger.info(`Cleaned up ${cleanedCount} expired tokens`);
      return cleanedCount;
    } catch (error) {
      logger.error('Error cleaning up expired tokens:', error);
      return 0;
    }
  }

  /**
   * Get token statistics
   */
  async getTokenStats(): Promise<any> {
    if (!this.connected) {
      return { connected: false };
    }

    try {
      const stats: any = {
        connected: this.connected,
        totalTokens: 0,
        byType: {},
        timestamp: new Date().toISOString()
      };

      for (const type of Object.values(TokenType)) {
        const config = tokenConfigs[type];
        const pattern = `token:${config.prefix}*`;
        const keys = await this.redisClient.keys(pattern);
        stats.byType[type] = keys.length;
        stats.totalTokens += keys.length;
      }

      return stats;
    } catch (error) {
      logger.error('Error getting token stats:', error);
      return { connected: false, error: error.message };
    }
  }

  /**
   * Check if token exists without consuming it
   */
  async tokenExists(token: string, type: TokenType): Promise<boolean> {
    const tokenData = await this.verifyToken(token, type, false);
    return tokenData !== null;
  }

  /**
   * Extend token expiration
   */
  async extendToken(token: string, type: TokenType, additionalSeconds: number): Promise<boolean> {
    if (!this.connected) {
      return false;
    }

    const config = tokenConfigs[type];
    const normalizedToken = config.caseSensitive ? token : token.toLowerCase();
    const key = `token:${config.prefix}${normalizedToken}`;

    try {
      const currentTTL = await this.redisClient.ttl(key);
      if (currentTTL > 0) {
        const newTTL = currentTTL + additionalSeconds;
        await this.redisClient.expire(key, newTTL);
        
        logger.info('Token expiration extended', {
          type,
          tokenPrefix: token.substring(0, 8) + '...',
          additionalSeconds,
          newTTL
        });
        
        return true;
      }
      return false;
    } catch (error) {
      logger.error('Error extending token:', error);
      return false;
    }
  }

  isConnected(): boolean {
    return this.connected;
  }
}

// Create and export singleton instance
export const tokenService = new TokenService();

export default tokenService;
