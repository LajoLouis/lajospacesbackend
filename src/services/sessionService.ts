import { createClient, RedisClientType } from 'redis';
import { Request, Response, NextFunction } from 'express';
import session from 'express-session';
import RedisStore from 'connect-redis';
import { config } from '../config/environment';
import { logger } from '../utils/logger';
import { AppError } from '../utils/appError';
import crypto from 'crypto';

// Session configuration interface
export interface SessionConfig {
  secret: string;
  name: string;
  resave: boolean;
  saveUninitialized: boolean;
  rolling: boolean;
  cookie: {
    secure: boolean;
    httpOnly: boolean;
    maxAge: number;
    sameSite: 'strict' | 'lax' | 'none';
  };
  store?: any;
}

// User session data interface
export interface UserSession {
  userId: string;
  email: string;
  role: string;
  loginTime: Date;
  lastActivity: Date;
  ipAddress: string;
  userAgent: string;
  deviceInfo?: {
    browser: string;
    os: string;
    device: string;
  };
  isActive: boolean;
  sessionData?: Record<string, any>;
}

// Active session tracking
export interface ActiveSession {
  sessionId: string;
  userId: string;
  createdAt: Date;
  lastActivity: Date;
  ipAddress: string;
  userAgent: string;
  isActive: boolean;
}

class SessionService {
  private redisClient: RedisClientType;
  private store: RedisStore | undefined;
  private connected: boolean = false;

  constructor() {
    // Create Redis client for sessions
    this.redisClient = createClient({
      url: config.REDIS_URL,
      socket: {
        connectTimeout: 5000,
        lazyConnect: true
      }
    });

    this.setupEventHandlers();
    // Store will be created after connection is established
  }

  private setupEventHandlers(): void {
    this.redisClient.on('connect', () => {
      logger.info('Redis session client connecting...');
    });

    this.redisClient.on('ready', () => {
      this.connected = true;
      logger.info('Redis session client connected and ready');
    });

    this.redisClient.on('error', (err) => {
      this.connected = false;
      logger.error('Redis session client error:', err);
    });

    this.redisClient.on('end', () => {
      this.connected = false;
      logger.warn('Redis session client connection ended');
    });
  }

  async connect(): Promise<void> {
    try {
      if (!this.connected) {
        await this.redisClient.connect();

        // Create Redis store after connection is established
        this.store = new RedisStore({
          client: this.redisClient,
          prefix: 'sess:',
          ttl: 24 * 60 * 60 // 24 hours
        });
      }
    } catch (error) {
      logger.error('Failed to connect to Redis for sessions:', error);
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
      logger.error('Error disconnecting from Redis sessions:', error);
    }
  }

  /**
   * Get session configuration
   */
  getSessionConfig(): SessionConfig {
    return {
      secret: config.SESSION_SECRET || crypto.randomBytes(32).toString('hex'),
      name: 'lajospaces.sid',
      resave: false,
      saveUninitialized: false,
      rolling: true,
      cookie: {
        secure: config.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        sameSite: config.NODE_ENV === 'production' ? 'strict' : 'lax'
      },
      store: this.store // Will be undefined if Redis is not connected
    };
  }

  /**
   * Create session middleware
   */
  createSessionMiddleware() {
    const sessionConfig = this.getSessionConfig();
    return session(sessionConfig);
  }

  /**
   * Create a new user session
   */
  async createUserSession(
    sessionId: string,
    userId: string,
    email: string,
    role: string,
    req: Request
  ): Promise<UserSession> {
    const userSession: UserSession = {
      userId,
      email,
      role,
      loginTime: new Date(),
      lastActivity: new Date(),
      ipAddress: req.ip || req.connection.remoteAddress || 'unknown',
      userAgent: req.get('User-Agent') || 'unknown',
      deviceInfo: this.parseUserAgent(req.get('User-Agent')),
      isActive: true,
      sessionData: {}
    };

    try {
      // Store user session data
      await this.redisClient.setEx(
        `user_session:${sessionId}`,
        24 * 60 * 60, // 24 hours
        JSON.stringify(userSession)
      );

      // Track active session
      await this.trackActiveSession(sessionId, userId, req);

      logger.info('User session created', {
        sessionId,
        userId,
        email,
        ipAddress: userSession.ipAddress
      });

      return userSession;
    } catch (error) {
      logger.error('Error creating user session:', error);
      throw new AppError('Failed to create session', 500);
    }
  }

  /**
   * Get user session
   */
  async getUserSession(sessionId: string): Promise<UserSession | null> {
    if (!this.connected) {
      return null;
    }

    try {
      const sessionData = await this.redisClient.get(`user_session:${sessionId}`);
      if (!sessionData) {
        return null;
      }

      const userSession: UserSession = JSON.parse(sessionData);
      
      // Update last activity
      userSession.lastActivity = new Date();
      await this.updateUserSession(sessionId, userSession);

      return userSession;
    } catch (error) {
      logger.error('Error getting user session:', error);
      return null;
    }
  }

  /**
   * Update user session
   */
  async updateUserSession(sessionId: string, sessionData: Partial<UserSession>): Promise<boolean> {
    if (!this.connected) {
      return false;
    }

    try {
      const existingSession = await this.getUserSession(sessionId);
      if (!existingSession) {
        return false;
      }

      const updatedSession = { ...existingSession, ...sessionData };
      
      await this.redisClient.setEx(
        `user_session:${sessionId}`,
        24 * 60 * 60,
        JSON.stringify(updatedSession)
      );

      return true;
    } catch (error) {
      logger.error('Error updating user session:', error);
      return false;
    }
  }

  /**
   * Destroy user session
   */
  async destroyUserSession(sessionId: string): Promise<boolean> {
    if (!this.connected) {
      return false;
    }

    try {
      // Get session data before destroying
      const sessionData = await this.getUserSession(sessionId);
      
      // Remove user session
      await this.redisClient.del(`user_session:${sessionId}`);
      
      // Remove from active sessions
      if (sessionData) {
        await this.removeActiveSession(sessionId, sessionData.userId);
      }

      logger.info('User session destroyed', { sessionId });
      return true;
    } catch (error) {
      logger.error('Error destroying user session:', error);
      return false;
    }
  }

  /**
   * Track active session
   */
  private async trackActiveSession(sessionId: string, userId: string, req: Request): Promise<void> {
    const activeSession: ActiveSession = {
      sessionId,
      userId,
      createdAt: new Date(),
      lastActivity: new Date(),
      ipAddress: req.ip || 'unknown',
      userAgent: req.get('User-Agent') || 'unknown',
      isActive: true
    };

    try {
      // Add to user's active sessions set
      await this.redisClient.sAdd(`active_sessions:${userId}`, sessionId);
      
      // Store session details
      await this.redisClient.setEx(
        `active_session:${sessionId}`,
        24 * 60 * 60,
        JSON.stringify(activeSession)
      );

      // Set expiration for the set
      await this.redisClient.expire(`active_sessions:${userId}`, 24 * 60 * 60);
    } catch (error) {
      logger.error('Error tracking active session:', error);
    }
  }

  /**
   * Remove active session
   */
  private async removeActiveSession(sessionId: string, userId: string): Promise<void> {
    try {
      await this.redisClient.sRem(`active_sessions:${userId}`, sessionId);
      await this.redisClient.del(`active_session:${sessionId}`);
    } catch (error) {
      logger.error('Error removing active session:', error);
    }
  }

  /**
   * Get user's active sessions
   */
  async getUserActiveSessions(userId: string): Promise<ActiveSession[]> {
    if (!this.connected) {
      return [];
    }

    try {
      const sessionIds = await this.redisClient.sMembers(`active_sessions:${userId}`);
      const sessions: ActiveSession[] = [];

      for (const sessionId of sessionIds) {
        const sessionData = await this.redisClient.get(`active_session:${sessionId}`);
        if (sessionData) {
          sessions.push(JSON.parse(sessionData));
        }
      }

      return sessions.filter(session => session.isActive);
    } catch (error) {
      logger.error('Error getting user active sessions:', error);
      return [];
    }
  }

  /**
   * Terminate all user sessions except current
   */
  async terminateOtherSessions(userId: string, currentSessionId: string): Promise<number> {
    if (!this.connected) {
      return 0;
    }

    try {
      const activeSessions = await this.getUserActiveSessions(userId);
      let terminatedCount = 0;

      for (const session of activeSessions) {
        if (session.sessionId !== currentSessionId) {
          await this.destroyUserSession(session.sessionId);
          terminatedCount++;
        }
      }

      logger.info('Terminated other user sessions', {
        userId,
        currentSessionId,
        terminatedCount
      });

      return terminatedCount;
    } catch (error) {
      logger.error('Error terminating other sessions:', error);
      return 0;
    }
  }

  /**
   * Clean up expired sessions
   */
  async cleanupExpiredSessions(): Promise<number> {
    if (!this.connected) {
      return 0;
    }

    try {
      const pattern = 'user_session:*';
      const keys = await this.redisClient.keys(pattern);
      let cleanedCount = 0;

      for (const key of keys) {
        const ttl = await this.redisClient.ttl(key);
        if (ttl <= 0) {
          await this.redisClient.del(key);
          cleanedCount++;
        }
      }

      logger.info(`Cleaned up ${cleanedCount} expired sessions`);
      return cleanedCount;
    } catch (error) {
      logger.error('Error cleaning up expired sessions:', error);
      return 0;
    }
  }

  /**
   * Get session statistics
   */
  async getSessionStats(): Promise<any> {
    if (!this.connected) {
      return { connected: false };
    }

    try {
      const userSessionKeys = await this.redisClient.keys('user_session:*');
      const activeSessionKeys = await this.redisClient.keys('active_session:*');
      
      return {
        connected: this.connected,
        totalUserSessions: userSessionKeys.length,
        totalActiveSessions: activeSessionKeys.length,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.error('Error getting session stats:', error);
      return { connected: false, error: error.message };
    }
  }

  /**
   * Parse user agent for device info
   */
  private parseUserAgent(userAgent?: string): any {
    if (!userAgent) {
      return { browser: 'unknown', os: 'unknown', device: 'unknown' };
    }

    // Simple user agent parsing (you might want to use a library like 'ua-parser-js')
    const browser = this.detectBrowser(userAgent);
    const os = this.detectOS(userAgent);
    const device = this.detectDevice(userAgent);

    return { browser, os, device };
  }

  private detectBrowser(userAgent: string): string {
    if (userAgent.includes('Chrome')) return 'Chrome';
    if (userAgent.includes('Firefox')) return 'Firefox';
    if (userAgent.includes('Safari')) return 'Safari';
    if (userAgent.includes('Edge')) return 'Edge';
    if (userAgent.includes('Opera')) return 'Opera';
    return 'unknown';
  }

  private detectOS(userAgent: string): string {
    if (userAgent.includes('Windows')) return 'Windows';
    if (userAgent.includes('Mac OS')) return 'macOS';
    if (userAgent.includes('Linux')) return 'Linux';
    if (userAgent.includes('Android')) return 'Android';
    if (userAgent.includes('iOS')) return 'iOS';
    return 'unknown';
  }

  private detectDevice(userAgent: string): string {
    if (userAgent.includes('Mobile')) return 'mobile';
    if (userAgent.includes('Tablet')) return 'tablet';
    return 'desktop';
  }

  /**
   * Session middleware for tracking user activity
   */
  trackUserActivity() {
    return async (req: Request, res: Response, next: NextFunction) => {
      if (req.session && req.session.id && req.user) {
        try {
          await this.updateUserSession(req.session.id, {
            lastActivity: new Date()
          });
        } catch (error) {
          logger.error('Error tracking user activity:', error);
        }
      }
      next();
    };
  }

  /**
   * Check if user has multiple active sessions
   */
  async hasMultipleSessions(userId: string): Promise<boolean> {
    const activeSessions = await this.getUserActiveSessions(userId);
    return activeSessions.length > 1;
  }

  isConnected(): boolean {
    return this.connected;
  }
}

// Create and export singleton instance
export const sessionService = new SessionService();

export default sessionService;
