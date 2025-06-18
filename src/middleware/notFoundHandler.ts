import { Request, Response, NextFunction } from 'express';
import { AppError } from './errorHandler';

/**
 * Handle 404 Not Found errors
 */
export function notFoundHandler(req: Request, _res: Response, next: NextFunction): void {
  const message = `Route ${req.originalUrl} not found on this server`;
  const error = new AppError(message, 404, true, 'ROUTE_NOT_FOUND');
  next(error);
}

export default notFoundHandler;
