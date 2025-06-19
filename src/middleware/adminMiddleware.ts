import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/appError';
import { auditService, AuditEventType } from '../services/auditService';
import { logger } from '../utils/logger';

/**
 * Middleware to check if user has admin privileges
 */
export const adminMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Check if user is authenticated
    if (!req.user) {
      throw new AppError('Authentication required', 401, true, 'UNAUTHORIZED');
    }

    // Check if user has admin role
    if (req.user.role !== 'admin') {
      // Log unauthorized admin access attempt
      await auditService.logEvent(AuditEventType.ACCESS_DENIED, req, {
        riskLevel: 'high',
        metadata: {
          attemptedResource: 'admin_panel',
          userRole: req.user.role,
          reason: 'insufficient_privileges'
        }
      });

      throw new AppError('Admin privileges required', 403, true, 'FORBIDDEN');
    }

    // Log successful admin access
    await auditService.logEvent(AuditEventType.ACCESS_GRANTED, req, {
      metadata: {
        resource: 'admin_panel',
        userRole: req.user.role
      }
    });

    next();
  } catch (error) {
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({
        success: false,
        error: error.message,
        code: error.code
      });
    }

    logger.error('Admin middleware error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

/**
 * Middleware to check if user has super admin privileges
 */
export const superAdminMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Check if user is authenticated
    if (!req.user) {
      throw new AppError('Authentication required', 401, true, 'UNAUTHORIZED');
    }

    // Check if user has super admin role
    if (req.user.role !== 'super_admin') {
      // Log unauthorized super admin access attempt
      await auditService.logEvent(AuditEventType.ACCESS_DENIED, req, {
        riskLevel: 'critical',
        metadata: {
          attemptedResource: 'super_admin_panel',
          userRole: req.user.role,
          reason: 'insufficient_privileges'
        }
      });

      throw new AppError('Super admin privileges required', 403, true, 'FORBIDDEN');
    }

    // Log successful super admin access
    await auditService.logEvent(AuditEventType.ACCESS_GRANTED, req, {
      metadata: {
        resource: 'super_admin_panel',
        userRole: req.user.role
      }
    });

    next();
  } catch (error) {
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({
        success: false,
        error: error.message,
        code: error.code
      });
    }

    logger.error('Super admin middleware error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

export default { adminMiddleware, superAdminMiddleware };
