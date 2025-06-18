import winston from 'winston';
import path from 'path';
import { config } from '../config/environment';

// Define log levels
const logLevels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

// Define log colors
const logColors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'white',
};

// Add colors to winston
winston.addColors(logColors);

// Create log format
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.colorize({ all: true }),
  winston.format.printf(
    (info) => `${info.timestamp} ${info.level}: ${info.message}`
  )
);

// Create file format (without colors)
const fileFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// Define transports
const transports: winston.transport[] = [];

// Console transport (always enabled in development)
if (config.NODE_ENV === 'development') {
  transports.push(
    new winston.transports.Console({
      format: logFormat,
      level: 'debug'
    })
  );
} else {
  transports.push(
    new winston.transports.Console({
      format: logFormat,
      level: config.LOG_LEVEL
    })
  );
}

// File transports (for production and development)
if (config.NODE_ENV !== 'test') {
  // Ensure logs directory exists
  const logsDir = path.dirname(config.LOG_FILE);
  
  // Combined logs
  transports.push(
    new winston.transports.File({
      filename: config.LOG_FILE,
      format: fileFormat,
      level: config.LOG_LEVEL,
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    })
  );

  // Error logs
  transports.push(
    new winston.transports.File({
      filename: path.join(logsDir, 'error.log'),
      format: fileFormat,
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    })
  );

  // HTTP logs
  transports.push(
    new winston.transports.File({
      filename: path.join(logsDir, 'http.log'),
      format: fileFormat,
      level: 'http',
      maxsize: 5242880, // 5MB
      maxFiles: 3,
    })
  );
}

// Create logger instance
export const logger = winston.createLogger({
  level: config.LOG_LEVEL,
  levels: logLevels,
  format: fileFormat,
  transports,
  exceptionHandlers: [
    new winston.transports.File({
      filename: path.join(path.dirname(config.LOG_FILE), 'exceptions.log'),
      format: fileFormat,
      maxsize: 5242880, // 5MB
      maxFiles: 2,
    })
  ],
  rejectionHandlers: [
    new winston.transports.File({
      filename: path.join(path.dirname(config.LOG_FILE), 'rejections.log'),
      format: fileFormat,
      maxsize: 5242880, // 5MB
      maxFiles: 2,
    })
  ],
  exitOnError: false,
});

// Create a stream object for Morgan HTTP logging
export const morganStream = {
  write: (message: string) => {
    logger.http(message.trim());
  },
};

// Helper functions for structured logging
export const logHelpers = {
  /**
   * Log user action
   */
  userAction: (userId: string, action: string, details?: any) => {
    logger.info(`User Action: ${action}`, {
      userId,
      action,
      details,
      timestamp: new Date().toISOString()
    });
  },

  /**
   * Log API request
   */
  apiRequest: (method: string, url: string, userId?: string, ip?: string) => {
    logger.http(`API Request: ${method} ${url}`, {
      method,
      url,
      userId,
      ip,
      timestamp: new Date().toISOString()
    });
  },

  /**
   * Log database operation
   */
  dbOperation: (operation: string, collection: string, details?: any) => {
    logger.debug(`DB Operation: ${operation} on ${collection}`, {
      operation,
      collection,
      details,
      timestamp: new Date().toISOString()
    });
  },

  /**
   * Log authentication event
   */
  authEvent: (event: string, userId?: string, ip?: string, details?: any) => {
    logger.info(`Auth Event: ${event}`, {
      event,
      userId,
      ip,
      details,
      timestamp: new Date().toISOString()
    });
  },

  /**
   * Log security event
   */
  securityEvent: (event: string, severity: 'low' | 'medium' | 'high', details?: any) => {
    const logLevel = severity === 'high' ? 'error' : severity === 'medium' ? 'warn' : 'info';
    logger[logLevel](`Security Event: ${event}`, {
      event,
      severity,
      details,
      timestamp: new Date().toISOString()
    });
  },

  /**
   * Log performance metric
   */
  performance: (metric: string, value: number, unit: string, details?: any) => {
    logger.info(`Performance: ${metric} = ${value}${unit}`, {
      metric,
      value,
      unit,
      details,
      timestamp: new Date().toISOString()
    });
  },

  /**
   * Log error with context
   */
  errorWithContext: (error: Error, context: string, details?: any) => {
    logger.error(`Error in ${context}: ${error.message}`, {
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack
      },
      context,
      details,
      timestamp: new Date().toISOString()
    });
  }
};

export default logger;
