export class AppError extends Error {
  public statusCode: number;
  public isOperational: boolean;
  public details?: any;

  constructor(
    message: string,
    statusCode: number = 500,
    details?: any,
    isOperational: boolean = true
  ) {
    super(message);
    
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.details = details;

    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AppError);
    }

    // Set the prototype explicitly
    Object.setPrototypeOf(this, AppError.prototype);
  }

  /**
   * Create a validation error
   */
  static validationError(message: string, details?: any) {
    return new AppError(message, 400, details);
  }

  /**
   * Create an unauthorized error
   */
  static unauthorized(message: string = 'Unauthorized access') {
    return new AppError(message, 401);
  }

  /**
   * Create a forbidden error
   */
  static forbidden(message: string = 'Access forbidden') {
    return new AppError(message, 403);
  }

  /**
   * Create a not found error
   */
  static notFound(message: string = 'Resource not found') {
    return new AppError(message, 404);
  }

  /**
   * Create a conflict error
   */
  static conflict(message: string = 'Resource conflict') {
    return new AppError(message, 409);
  }

  /**
   * Create an internal server error
   */
  static internal(message: string = 'Internal server error') {
    return new AppError(message, 500);
  }

  /**
   * Create a bad request error
   */
  static badRequest(message: string = 'Bad request') {
    return new AppError(message, 400);
  }

  /**
   * Create a too many requests error
   */
  static tooManyRequests(message: string = 'Too many requests') {
    return new AppError(message, 429);
  }
}
