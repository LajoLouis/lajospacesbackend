import { Request } from 'express';
import mongoose, { Schema, Document } from 'mongoose';
import { logger } from '../utils/logger';
import { cacheService } from './cacheService';

// Audit event types
export enum AuditEventType {
  // Authentication events
  LOGIN_SUCCESS = 'login_success',
  LOGIN_FAILED = 'login_failed',
  LOGOUT = 'logout',
  PASSWORD_RESET_REQUEST = 'password_reset_request',
  PASSWORD_RESET_SUCCESS = 'password_reset_success',
  PASSWORD_CHANGED = 'password_changed',
  EMAIL_VERIFICATION = 'email_verification',
  ACCOUNT_LOCKED = 'account_locked',
  ACCOUNT_UNLOCKED = 'account_unlocked',

  // Authorization events
  ACCESS_GRANTED = 'access_granted',
  ACCESS_DENIED = 'access_denied',
  PERMISSION_ESCALATION = 'permission_escalation',
  ROLE_CHANGED = 'role_changed',

  // Data events
  DATA_CREATED = 'data_created',
  DATA_UPDATED = 'data_updated',
  DATA_DELETED = 'data_deleted',
  DATA_VIEWED = 'data_viewed',
  DATA_EXPORTED = 'data_exported',
  BULK_OPERATION = 'bulk_operation',

  // Security events
  SUSPICIOUS_ACTIVITY = 'suspicious_activity',
  RATE_LIMIT_EXCEEDED = 'rate_limit_exceeded',
  INVALID_INPUT = 'invalid_input',
  SQL_INJECTION_ATTEMPT = 'sql_injection_attempt',
  XSS_ATTEMPT = 'xss_attempt',
  CSRF_ATTEMPT = 'csrf_attempt',
  BRUTE_FORCE_ATTEMPT = 'brute_force_attempt',

  // System events
  SYSTEM_ERROR = 'system_error',
  CONFIGURATION_CHANGED = 'configuration_changed',
  BACKUP_CREATED = 'backup_created',
  MAINTENANCE_MODE = 'maintenance_mode',

  // Business events
  PROPERTY_POSTED = 'property_posted',
  PROPERTY_UPDATED = 'property_updated',
  PROPERTY_DELETED = 'property_deleted',
  MATCH_CREATED = 'match_created',
  MESSAGE_SENT = 'message_sent',
  PAYMENT_PROCESSED = 'payment_processed',
  SUBSCRIPTION_CHANGED = 'subscription_changed'
}

// Risk levels
export enum RiskLevel {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

// Audit log interface
export interface IAuditLog extends Document {
  eventType: AuditEventType;
  riskLevel: RiskLevel;
  userId?: string;
  sessionId?: string;
  ipAddress: string;
  userAgent: string;
  endpoint: string;
  method: string;
  statusCode?: number;
  resource?: string;
  resourceId?: string;
  oldValues?: Record<string, any>;
  newValues?: Record<string, any>;
  metadata?: Record<string, any>;
  geolocation?: {
    country?: string;
    region?: string;
    city?: string;
    coordinates?: {
      latitude: number;
      longitude: number;
    };
  };
  deviceInfo?: {
    browser: string;
    os: string;
    device: string;
    isMobile: boolean;
  };
  success: boolean;
  errorMessage?: string;
  duration?: number;
  timestamp: Date;
  tags?: string[];
}

// Audit log schema
const auditLogSchema = new Schema<IAuditLog>({
  eventType: {
    type: String,
    enum: Object.values(AuditEventType),
    required: true,
    index: true
  },
  riskLevel: {
    type: String,
    enum: Object.values(RiskLevel),
    required: true,
    index: true
  },
  userId: {
    type: String,
    index: true
  },
  sessionId: {
    type: String,
    index: true
  },
  ipAddress: {
    type: String,
    required: true,
    index: true
  },
  userAgent: {
    type: String,
    required: true
  },
  endpoint: {
    type: String,
    required: true,
    index: true
  },
  method: {
    type: String,
    required: true
  },
  statusCode: {
    type: Number,
    index: true
  },
  resource: {
    type: String,
    index: true
  },
  resourceId: {
    type: String,
    index: true
  },
  oldValues: {
    type: Schema.Types.Mixed
  },
  newValues: {
    type: Schema.Types.Mixed
  },
  metadata: {
    type: Schema.Types.Mixed
  },
  geolocation: {
    country: String,
    region: String,
    city: String,
    coordinates: {
      latitude: Number,
      longitude: Number
    }
  },
  deviceInfo: {
    browser: String,
    os: String,
    device: String,
    isMobile: Boolean
  },
  success: {
    type: Boolean,
    required: true,
    index: true
  },
  errorMessage: String,
  duration: Number,
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  },
  tags: [{
    type: String,
    index: true
  }]
}, {
  timestamps: true,
  collection: 'audit_logs'
});

// Compound indexes for common queries
auditLogSchema.index({ userId: 1, timestamp: -1 });
auditLogSchema.index({ eventType: 1, timestamp: -1 });
auditLogSchema.index({ riskLevel: 1, timestamp: -1 });
auditLogSchema.index({ ipAddress: 1, timestamp: -1 });
auditLogSchema.index({ success: 1, timestamp: -1 });

// TTL index for automatic cleanup (keep logs for 1 year)
auditLogSchema.index({ timestamp: 1 }, { expireAfterSeconds: 365 * 24 * 60 * 60 });

export const AuditLog = mongoose.model<IAuditLog>('AuditLog', auditLogSchema);

class AuditService {
  private suspiciousActivityThresholds = {
    failedLogins: 5, // per 15 minutes
    rateLimitExceeded: 10, // per hour
    invalidInputs: 20, // per hour
    differentIPs: 3 // per hour for same user
  };

  /**
   * Log an audit event
   */
  async logEvent(
    eventType: AuditEventType,
    req: Request,
    options: {
      riskLevel?: RiskLevel;
      resource?: string;
      resourceId?: string;
      oldValues?: Record<string, any>;
      newValues?: Record<string, any>;
      metadata?: Record<string, any>;
      success?: boolean;
      errorMessage?: string;
      duration?: number;
      tags?: string[];
    } = {}
  ): Promise<void> {
    try {
      const auditData: Partial<IAuditLog> = {
        eventType,
        riskLevel: options.riskLevel || this.determineRiskLevel(eventType),
        userId: req.user?._id,
        sessionId: req.session?.id,
        ipAddress: this.getClientIP(req),
        userAgent: req.get('User-Agent') || 'unknown',
        endpoint: req.originalUrl || req.url,
        method: req.method,
        statusCode: req.res?.statusCode,
        resource: options.resource,
        resourceId: options.resourceId,
        oldValues: options.oldValues,
        newValues: options.newValues,
        metadata: options.metadata,
        deviceInfo: this.parseUserAgent(req.get('User-Agent')),
        success: options.success !== undefined ? options.success : true,
        errorMessage: options.errorMessage,
        duration: options.duration,
        tags: options.tags || [],
        timestamp: new Date()
      };

      // Create audit log entry
      const auditLog = new AuditLog(auditData);
      await auditLog.save();

      // Log to application logger as well
      logger.info('Audit event logged', {
        eventType,
        userId: auditData.userId,
        ipAddress: auditData.ipAddress,
        endpoint: auditData.endpoint,
        success: auditData.success
      });

      // Check for suspicious activity
      await this.checkSuspiciousActivity(auditData);

    } catch (error) {
      logger.error('Failed to log audit event:', error);
    }
  }

  /**
   * Log authentication events
   */
  async logAuth(
    eventType: AuditEventType.LOGIN_SUCCESS | AuditEventType.LOGIN_FAILED | AuditEventType.LOGOUT,
    req: Request,
    userId?: string,
    errorMessage?: string
  ): Promise<void> {
    await this.logEvent(eventType, req, {
      riskLevel: eventType === AuditEventType.LOGIN_FAILED ? RiskLevel.MEDIUM : RiskLevel.LOW,
      success: eventType !== AuditEventType.LOGIN_FAILED,
      errorMessage,
      metadata: {
        userId: userId || req.user?._id,
        loginMethod: 'email_password' // Could be extended for OAuth, etc.
      },
      tags: ['authentication']
    });
  }

  /**
   * Log data access events
   */
  async logDataAccess(
    eventType: AuditEventType.DATA_VIEWED | AuditEventType.DATA_CREATED | AuditEventType.DATA_UPDATED | AuditEventType.DATA_DELETED,
    req: Request,
    resource: string,
    resourceId: string,
    oldValues?: Record<string, any>,
    newValues?: Record<string, any>
  ): Promise<void> {
    await this.logEvent(eventType, req, {
      riskLevel: eventType === AuditEventType.DATA_DELETED ? RiskLevel.HIGH : RiskLevel.LOW,
      resource,
      resourceId,
      oldValues,
      newValues,
      tags: ['data_access', resource]
    });
  }

  /**
   * Log security events
   */
  async logSecurity(
    eventType: AuditEventType,
    req: Request,
    details: {
      riskLevel?: RiskLevel;
      errorMessage?: string;
      metadata?: Record<string, any>;
    } = {}
  ): Promise<void> {
    await this.logEvent(eventType, req, {
      riskLevel: details.riskLevel || RiskLevel.HIGH,
      success: false,
      errorMessage: details.errorMessage,
      metadata: details.metadata,
      tags: ['security', 'threat']
    });
  }

  /**
   * Get audit logs with filtering and pagination
   */
  async getAuditLogs(filters: {
    userId?: string;
    eventType?: AuditEventType;
    riskLevel?: RiskLevel;
    startDate?: Date;
    endDate?: Date;
    ipAddress?: string;
    success?: boolean;
    page?: number;
    limit?: number;
  } = {}): Promise<{
    logs: IAuditLog[];
    total: number;
    page: number;
    pages: number;
  }> {
    const page = Math.max(1, filters.page || 1);
    const limit = Math.min(100, Math.max(1, filters.limit || 20));
    const skip = (page - 1) * limit;

    // Build query
    const query: any = {};
    
    if (filters.userId) query.userId = filters.userId;
    if (filters.eventType) query.eventType = filters.eventType;
    if (filters.riskLevel) query.riskLevel = filters.riskLevel;
    if (filters.ipAddress) query.ipAddress = filters.ipAddress;
    if (filters.success !== undefined) query.success = filters.success;
    
    if (filters.startDate || filters.endDate) {
      query.timestamp = {};
      if (filters.startDate) query.timestamp.$gte = filters.startDate;
      if (filters.endDate) query.timestamp.$lte = filters.endDate;
    }

    // Execute queries
    const [logs, total] = await Promise.all([
      AuditLog.find(query)
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      AuditLog.countDocuments(query)
    ]);

    return {
      logs,
      total,
      page,
      pages: Math.ceil(total / limit)
    };
  }

  /**
   * Get audit statistics
   */
  async getAuditStats(timeframe: 'hour' | 'day' | 'week' | 'month' = 'day'): Promise<any> {
    const now = new Date();
    let startDate: Date;

    switch (timeframe) {
      case 'hour':
        startDate = new Date(now.getTime() - 60 * 60 * 1000);
        break;
      case 'day':
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
    }

    const [
      totalEvents,
      securityEvents,
      failedEvents,
      eventsByType,
      eventsByRisk,
      topIPs,
      topUsers
    ] = await Promise.all([
      AuditLog.countDocuments({ timestamp: { $gte: startDate } }),
      AuditLog.countDocuments({ 
        timestamp: { $gte: startDate },
        tags: 'security'
      }),
      AuditLog.countDocuments({ 
        timestamp: { $gte: startDate },
        success: false
      }),
      AuditLog.aggregate([
        { $match: { timestamp: { $gte: startDate } } },
        { $group: { _id: '$eventType', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 }
      ]),
      AuditLog.aggregate([
        { $match: { timestamp: { $gte: startDate } } },
        { $group: { _id: '$riskLevel', count: { $sum: 1 } } }
      ]),
      AuditLog.aggregate([
        { $match: { timestamp: { $gte: startDate } } },
        { $group: { _id: '$ipAddress', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 }
      ]),
      AuditLog.aggregate([
        { $match: { timestamp: { $gte: startDate }, userId: { $exists: true } } },
        { $group: { _id: '$userId', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 }
      ])
    ]);

    return {
      timeframe,
      period: {
        start: startDate,
        end: now
      },
      summary: {
        totalEvents,
        securityEvents,
        failedEvents,
        successRate: totalEvents > 0 ? ((totalEvents - failedEvents) / totalEvents * 100).toFixed(2) : 0
      },
      breakdown: {
        byType: eventsByType,
        byRisk: eventsByRisk,
        topIPs,
        topUsers
      }
    };
  }

  /**
   * Check for suspicious activity patterns
   */
  private async checkSuspiciousActivity(auditData: Partial<IAuditLog>): Promise<void> {
    const now = new Date();
    const oneHour = new Date(now.getTime() - 60 * 60 * 1000);
    const fifteenMinutes = new Date(now.getTime() - 15 * 60 * 1000);

    try {
      // Check for failed login attempts
      if (auditData.eventType === AuditEventType.LOGIN_FAILED) {
        const recentFailures = await AuditLog.countDocuments({
          eventType: AuditEventType.LOGIN_FAILED,
          ipAddress: auditData.ipAddress,
          timestamp: { $gte: fifteenMinutes }
        });

        if (recentFailures >= this.suspiciousActivityThresholds.failedLogins) {
          await this.logSuspiciousActivity('Multiple failed login attempts', auditData);
        }
      }

      // Check for rate limit exceeded events
      if (auditData.eventType === AuditEventType.RATE_LIMIT_EXCEEDED) {
        const recentRateLimits = await AuditLog.countDocuments({
          eventType: AuditEventType.RATE_LIMIT_EXCEEDED,
          ipAddress: auditData.ipAddress,
          timestamp: { $gte: oneHour }
        });

        if (recentRateLimits >= this.suspiciousActivityThresholds.rateLimitExceeded) {
          await this.logSuspiciousActivity('Excessive rate limiting', auditData);
        }
      }

      // Check for multiple IPs for same user
      if (auditData.userId) {
        const distinctIPs = await AuditLog.distinct('ipAddress', {
          userId: auditData.userId,
          timestamp: { $gte: oneHour }
        });

        if (distinctIPs.length >= this.suspiciousActivityThresholds.differentIPs) {
          await this.logSuspiciousActivity('Multiple IP addresses for user', auditData);
        }
      }

    } catch (error) {
      logger.error('Error checking suspicious activity:', error);
    }
  }

  /**
   * Log suspicious activity
   */
  private async logSuspiciousActivity(reason: string, originalEvent: Partial<IAuditLog>): Promise<void> {
    try {
      const suspiciousLog = new AuditLog({
        eventType: AuditEventType.SUSPICIOUS_ACTIVITY,
        riskLevel: RiskLevel.CRITICAL,
        userId: originalEvent.userId,
        sessionId: originalEvent.sessionId,
        ipAddress: originalEvent.ipAddress,
        userAgent: originalEvent.userAgent,
        endpoint: originalEvent.endpoint,
        method: originalEvent.method,
        success: false,
        errorMessage: reason,
        metadata: {
          originalEvent: originalEvent.eventType,
          detectionReason: reason,
          timestamp: originalEvent.timestamp
        },
        tags: ['suspicious', 'security', 'automated_detection'],
        timestamp: new Date()
      });

      await suspiciousLog.save();

      // Also log to application logger with high priority
      logger.warn('Suspicious activity detected', {
        reason,
        userId: originalEvent.userId,
        ipAddress: originalEvent.ipAddress,
        originalEvent: originalEvent.eventType
      });

    } catch (error) {
      logger.error('Failed to log suspicious activity:', error);
    }
  }

  /**
   * Determine risk level based on event type
   */
  private determineRiskLevel(eventType: AuditEventType): RiskLevel {
    const highRiskEvents = [
      AuditEventType.DATA_DELETED,
      AuditEventType.PERMISSION_ESCALATION,
      AuditEventType.ROLE_CHANGED,
      AuditEventType.CONFIGURATION_CHANGED,
      AuditEventType.ACCOUNT_LOCKED
    ];

    const mediumRiskEvents = [
      AuditEventType.LOGIN_FAILED,
      AuditEventType.ACCESS_DENIED,
      AuditEventType.PASSWORD_RESET_REQUEST,
      AuditEventType.DATA_UPDATED,
      AuditEventType.RATE_LIMIT_EXCEEDED
    ];

    const criticalRiskEvents = [
      AuditEventType.SUSPICIOUS_ACTIVITY,
      AuditEventType.SQL_INJECTION_ATTEMPT,
      AuditEventType.XSS_ATTEMPT,
      AuditEventType.BRUTE_FORCE_ATTEMPT
    ];

    if (criticalRiskEvents.includes(eventType)) return RiskLevel.CRITICAL;
    if (highRiskEvents.includes(eventType)) return RiskLevel.HIGH;
    if (mediumRiskEvents.includes(eventType)) return RiskLevel.MEDIUM;
    return RiskLevel.LOW;
  }

  /**
   * Get client IP address
   */
  private getClientIP(req: Request): string {
    return req.ip || 
           req.connection.remoteAddress || 
           req.socket.remoteAddress || 
           (req.connection as any)?.socket?.remoteAddress || 
           'unknown';
  }

  /**
   * Parse user agent for device info
   */
  private parseUserAgent(userAgent?: string): any {
    if (!userAgent) {
      return { browser: 'unknown', os: 'unknown', device: 'unknown', isMobile: false };
    }

    const browser = this.detectBrowser(userAgent);
    const os = this.detectOS(userAgent);
    const device = this.detectDevice(userAgent);
    const isMobile = /Mobile|Android|iPhone|iPad/.test(userAgent);

    return { browser, os, device, isMobile };
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
}

// Create and export singleton instance
export const auditService = new AuditService();

export default auditService;
