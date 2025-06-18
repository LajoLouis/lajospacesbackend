import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { config } from '../config/environment';

// Custom error class
export class AppError extends Error {
  public statusCode: number;
  public isOperational: boolean;
  public code: string | undefined;

  constructor(message: string, statusCode: number, isOperational = true, code?: string) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.code = code;

    Error.captureStackTrace(this, this.constructor);
  }
}

// Error response interface
interface ErrorResponse {
  success: false;
  error: {
    message: string;
    code?: string | undefined;
    statusCode: number;
    timestamp: string;
    path: string;
    method: string;
    stack?: string | undefined;
    details?: any;
  };
}

/**
 * Handle MongoDB validation errors
 */
function handleValidationError(error: any): AppError {
  const errors = Object.values(error.errors).map((err: any) => err.message);
  const message = `Validation Error: ${errors.join('. ')}`;
  return new AppError(message, 400, true, 'VALIDATION_ERROR');
}

/**
 * Handle MongoDB duplicate key errors
 */
function handleDuplicateKeyError(error: any): AppError {
  const field = Object.keys(error.keyValue)[0];
  const value = error.keyValue[field];
  const message = `Duplicate value for field '${field}': ${value}. Please use another value.`;
  return new AppError(message, 409, true, 'DUPLICATE_KEY_ERROR');
}

/**
 * Handle MongoDB cast errors
 */
function handleCastError(error: any): AppError {
  const message = `Invalid ${error.path}: ${error.value}`;
  return new AppError(message, 400, true, 'CAST_ERROR');
}

/**
 * Handle JWT errors
 */
function handleJWTError(): AppError {
  return new AppError('Invalid token. Please log in again.', 401, true, 'INVALID_TOKEN');
}

/**
 * Handle JWT expired errors
 */
function handleJWTExpiredError(): AppError {
  return new AppError('Your token has expired. Please log in again.', 401, true, 'TOKEN_EXPIRED');
}

/**
 * Send error response in development
 */
function sendErrorDev(err: AppError, req: Request, res: Response): void {
  const errorResponse: ErrorResponse = {
    success: false,
    error: {
      message: err.message,
      code: err.code,
      statusCode: err.statusCode,
      timestamp: new Date().toISOString(),
      path: req.path,
      method: req.method,
      stack: err.stack,
      details: err
    }
  };

  res.status(err.statusCode).json(errorResponse);
}

/**
 * Send error response in production
 */
function sendErrorProd(err: AppError, req: Request, res: Response): void {
  // Operational, trusted error: send message to client
  if (err.isOperational) {
    const errorResponse: ErrorResponse = {
      success: false,
      error: {
        message: err.message,
        code: err.code,
        statusCode: err.statusCode,
        timestamp: new Date().toISOString(),
        path: req.path,
        method: req.method
      }
    };

    res.status(err.statusCode).json(errorResponse);
  } else {
    // Programming or other unknown error: don't leak error details
    logger.error('Unknown error occurred:', err);

    const errorResponse: ErrorResponse = {
      success: false,
      error: {
        message: 'Something went wrong!',
        statusCode: 500,
        timestamp: new Date().toISOString(),
        path: req.path,
        method: req.method
      }
    };

    res.status(500).json(errorResponse);
  }
}

/**
 * Global error handling middleware
 */
export function errorHandler(
  err: any,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  let error = { ...err };
  error.message = err.message;

  // Log error
  logger.error(`Error ${err.statusCode || 500}: ${err.message}`, {
    error: {
      name: err.name,
      message: err.message,
      stack: err.stack
    },
    request: {
      method: req.method,
      url: req.url,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    },
    user: (req as any).user ? { id: (req as any).user.id, email: (req as any).user.email } : null
  });

  // MongoDB validation error
  if (err.name === 'ValidationError') {
    error = handleValidationError(err);
  }

  // MongoDB duplicate key error
  if (err.code === 11000) {
    error = handleDuplicateKeyError(err);
  }

  // MongoDB cast error
  if (err.name === 'CastError') {
    error = handleCastError(err);
  }

  // JWT invalid signature
  if (err.name === 'JsonWebTokenError') {
    error = handleJWTError();
  }

  // JWT expired
  if (err.name === 'TokenExpiredError') {
    error = handleJWTExpiredError();
  }

  // Multer file upload errors
  if (err.code === 'LIMIT_FILE_SIZE') {
    error = new AppError('File too large', 413, true, 'FILE_TOO_LARGE');
  }

  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    error = new AppError('Unexpected file field', 400, true, 'UNEXPECTED_FILE');
  }

  // Set default values
  error.statusCode = error.statusCode || 500;
  error.isOperational = error.isOperational !== undefined ? error.isOperational : false;

  // Send error response
  if (config.NODE_ENV === 'development') {
    sendErrorDev(error, req, res);
  } else {
    sendErrorProd(error, req, res);
  }
}

/**
 * Catch async errors wrapper
 */
export function catchAsync(fn: Function) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Create operational error
 */
export function createError(message: string, statusCode: number, code?: string): AppError {
  return new AppError(message, statusCode, true, code);
}

export default errorHandler;
