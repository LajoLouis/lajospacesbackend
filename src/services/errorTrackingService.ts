import { logger } from '../utils/logger';
import { config } from '../config/environment';

/**
 * Error Tracking Service for LajoSpaces Backend
 * Provides comprehensive error tracking, categorization, and alerting
 */

export interface ErrorContext {
  userId?: string;
  requestId?: string;
  endpoint?: string;
  method?: string;
  ip?: string;
  userAgent?: string;
  timestamp?: string;
  environment?: string;
  version?: string;
  additionalData?: any;
}

export interface ErrorMetrics {
  errorCount: number;
  errorRate: number;
  lastError: Date;
  errorsByType: Record<string, number>;
  errorsByEndpoint: Record<string, number>;
  criticalErrors: number;
}

export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export enum ErrorCategory {
  AUTHENTICATION = 'authentication',
  AUTHORIZATION = 'authorization',
  VALIDATION = 'validation',
  DATABASE = 'database',
  EXTERNAL_SERVICE = 'external_service',
  NETWORK = 'network',
  SYSTEM = 'system',
  BUSINESS_LOGIC = 'business_logic',
  SECURITY = 'security',
  PERFORMANCE = 'performance'
}

class ErrorTrackingService {
  private errorMetrics: ErrorMetrics = {
    errorCount: 0,
    errorRate: 0,
    lastError: new Date(),
    errorsByType: {},
    errorsByEndpoint: {},
    criticalErrors: 0
  };

  private errorHistory: Array<{
    error: Error;
    context: ErrorContext;
    severity: ErrorSeverity;
    category: ErrorCategory;
    timestamp: Date;
  }> = [];

  private readonly MAX_HISTORY_SIZE = 1000;
  private readonly CRITICAL_ERROR_THRESHOLD = 10; // per hour
  private readonly ERROR_RATE_WINDOW = 60 * 1000; // 1 minute

  /**
   * Track an error with context and categorization
   */
  trackError(
    error: Error,
    context: ErrorContext = {},
    severity: ErrorSeverity = ErrorSeverity.MEDIUM,
    category: ErrorCategory = ErrorCategory.SYSTEM
  ): void {
    const timestamp = new Date();
    const enhancedContext: ErrorContext = {
      ...context,
      timestamp: timestamp.toISOString(),
      environment: config.NODE_ENV,
      version: process.env.npm_package_version || '1.0.0'
    };

    // Add to history
    this.errorHistory.push({
      error,
      context: enhancedContext,
      severity,
      category,
      timestamp
    });

    // Maintain history size
    if (this.errorHistory.length > this.MAX_HISTORY_SIZE) {
      this.errorHistory.shift();
    }

    // Update metrics
    this.updateMetrics(error, context, severity, category);

    // Log the error
    this.logError(error, enhancedContext, severity, category);

    // Check for critical conditions
    this.checkCriticalConditions(severity);

    // Send alerts if necessary
    this.sendAlerts(error, enhancedContext, severity, category);
  }

  /**
   * Update error metrics
   */
  private updateMetrics(
    error: Error,
    context: ErrorContext,
    severity: ErrorSeverity,
    category: ErrorCategory
  ): void {
    this.errorMetrics.errorCount++;
    this.errorMetrics.lastError = new Date();

    // Count by type
    const errorType = error.constructor.name;
    this.errorMetrics.errorsByType[errorType] = (this.errorMetrics.errorsByType[errorType] || 0) + 1;

    // Count by endpoint
    if (context.endpoint) {
      this.errorMetrics.errorsByEndpoint[context.endpoint] = 
        (this.errorMetrics.errorsByEndpoint[context.endpoint] || 0) + 1;
    }

    // Count critical errors
    if (severity === ErrorSeverity.CRITICAL) {
      this.errorMetrics.criticalErrors++;
    }

    // Calculate error rate
    this.calculateErrorRate();
  }

  /**
   * Calculate error rate per minute
   */
  private calculateErrorRate(): void {
    const oneMinuteAgo = new Date(Date.now() - this.ERROR_RATE_WINDOW);
    const recentErrors = this.errorHistory.filter(
      entry => entry.timestamp > oneMinuteAgo
    );
    this.errorMetrics.errorRate = recentErrors.length;
  }

  /**
   * Log error with appropriate level
   */
  private logError(
    error: Error,
    context: ErrorContext,
    severity: ErrorSeverity,
    category: ErrorCategory
  ): void {
    const logData = {
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack
      },
      context,
      severity,
      category,
      metrics: {
        totalErrors: this.errorMetrics.errorCount,
        errorRate: this.errorMetrics.errorRate,
        criticalErrors: this.errorMetrics.criticalErrors
      }
    };

    switch (severity) {
      case ErrorSeverity.CRITICAL:
        logger.error(`CRITICAL ERROR [${category}]: ${error.message}`, logData);
        break;
      case ErrorSeverity.HIGH:
        logger.error(`HIGH SEVERITY ERROR [${category}]: ${error.message}`, logData);
        break;
      case ErrorSeverity.MEDIUM:
        logger.warn(`MEDIUM SEVERITY ERROR [${category}]: ${error.message}`, logData);
        break;
      case ErrorSeverity.LOW:
        logger.info(`LOW SEVERITY ERROR [${category}]: ${error.message}`, logData);
        break;
    }
  }

  /**
   * Check for critical error conditions
   */
  private checkCriticalConditions(severity: ErrorSeverity): void {
    // Check critical error threshold
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const criticalErrorsLastHour = this.errorHistory.filter(
      entry => entry.timestamp > oneHourAgo && entry.severity === ErrorSeverity.CRITICAL
    ).length;

    if (criticalErrorsLastHour >= this.CRITICAL_ERROR_THRESHOLD) {
      logger.error('ALERT: Critical error threshold exceeded', {
        criticalErrorsLastHour,
        threshold: this.CRITICAL_ERROR_THRESHOLD,
        timestamp: new Date().toISOString()
      });
    }

    // Check error rate spike
    if (this.errorMetrics.errorRate > 50) { // More than 50 errors per minute
      logger.error('ALERT: High error rate detected', {
        errorRate: this.errorMetrics.errorRate,
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Send alerts for critical errors
   */
  private sendAlerts(
    error: Error,
    context: ErrorContext,
    severity: ErrorSeverity,
    category: ErrorCategory
  ): void {
    // In production, this would integrate with alerting services
    // For now, we'll use enhanced logging
    if (severity === ErrorSeverity.CRITICAL || category === ErrorCategory.SECURITY) {
      logger.error('ALERT TRIGGERED', {
        alertType: 'critical_error',
        error: error.message,
        severity,
        category,
        context,
        timestamp: new Date().toISOString(),
        requiresImmediateAttention: true
      });
    }
  }

  /**
   * Get error metrics
   */
  getMetrics(): ErrorMetrics {
    this.calculateErrorRate();
    return { ...this.errorMetrics };
  }

  /**
   * Get recent errors
   */
  getRecentErrors(limit: number = 50): Array<{
    error: Error;
    context: ErrorContext;
    severity: ErrorSeverity;
    category: ErrorCategory;
    timestamp: Date;
  }> {
    return this.errorHistory
      .slice(-limit)
      .reverse(); // Most recent first
  }

  /**
   * Get errors by category
   */
  getErrorsByCategory(category: ErrorCategory, limit: number = 20): Array<any> {
    return this.errorHistory
      .filter(entry => entry.category === category)
      .slice(-limit)
      .reverse();
  }

  /**
   * Get error summary for health checks
   */
  getHealthSummary(): {
    status: 'healthy' | 'warning' | 'critical';
    errorCount: number;
    errorRate: number;
    criticalErrors: number;
    lastError: Date;
  } {
    const { errorCount, errorRate, criticalErrors, lastError } = this.errorMetrics;
    
    let status: 'healthy' | 'warning' | 'critical' = 'healthy';
    
    if (criticalErrors > 0 || errorRate > 50) {
      status = 'critical';
    } else if (errorRate > 20) {
      status = 'warning';
    }

    return {
      status,
      errorCount,
      errorRate,
      criticalErrors,
      lastError
    };
  }

  /**
   * Clear old error history (cleanup)
   */
  cleanup(): void {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    this.errorHistory = this.errorHistory.filter(
      entry => entry.timestamp > oneDayAgo
    );
  }
}

// Create singleton instance
export const errorTrackingService = new ErrorTrackingService();

// Helper functions for common error scenarios
export const trackError = {
  authentication: (error: Error, context: ErrorContext = {}) => {
    errorTrackingService.trackError(
      error,
      context,
      ErrorSeverity.HIGH,
      ErrorCategory.AUTHENTICATION
    );
  },

  authorization: (error: Error, context: ErrorContext = {}) => {
    errorTrackingService.trackError(
      error,
      context,
      ErrorSeverity.HIGH,
      ErrorCategory.AUTHORIZATION
    );
  },

  validation: (error: Error, context: ErrorContext = {}) => {
    errorTrackingService.trackError(
      error,
      context,
      ErrorSeverity.LOW,
      ErrorCategory.VALIDATION
    );
  },

  database: (error: Error, context: ErrorContext = {}) => {
    errorTrackingService.trackError(
      error,
      context,
      ErrorSeverity.HIGH,
      ErrorCategory.DATABASE
    );
  },

  security: (error: Error, context: ErrorContext = {}) => {
    errorTrackingService.trackError(
      error,
      context,
      ErrorSeverity.CRITICAL,
      ErrorCategory.SECURITY
    );
  },

  externalService: (error: Error, context: ErrorContext = {}) => {
    errorTrackingService.trackError(
      error,
      context,
      ErrorSeverity.MEDIUM,
      ErrorCategory.EXTERNAL_SERVICE
    );
  }
};

export default errorTrackingService;
