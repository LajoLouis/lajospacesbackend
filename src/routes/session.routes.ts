import { Router } from 'express';
import { authenticate as authMiddleware } from '../middleware/auth';
import { sessionService } from '../services/sessionService';
import { auditService, AuditEventType } from '../services/auditService';
import { generalRateLimit } from '../middleware/rateLimiting';
import { sanitizeRequest } from '../middleware/sanitization';

const router = Router();

// Apply middleware
router.use(generalRateLimit);
router.use(authMiddleware);
router.use(sanitizeRequest());

/**
 * @swagger
 * /api/sessions/active:
 *   get:
 *     summary: Get user's active sessions
 *     tags: [Sessions]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Active sessions retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       sessionId:
 *                         type: string
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *                       lastActivity:
 *                         type: string
 *                         format: date-time
 *                       ipAddress:
 *                         type: string
 *                       userAgent:
 *                         type: string
 *                       deviceInfo:
 *                         type: object
 *                         properties:
 *                           browser:
 *                             type: string
 *                           os:
 *                             type: string
 *                           device:
 *                             type: string
 *                           isMobile:
 *                             type: boolean
 *                       isActive:
 *                         type: boolean
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.get('/active', async (req, res) => {
  try {
    const userId = req.user._id;
    const activeSessions = await sessionService.getUserActiveSessions(userId);

    // Log session access
    await auditService.logEvent(AuditEventType.DATA_VIEWED, req, {
      resource: 'user_sessions',
      resourceId: userId,
      metadata: { sessionCount: activeSessions.length }
    });

    res.json({
      success: true,
      data: activeSessions
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve active sessions'
    });
  }
});

/**
 * @swagger
 * /api/sessions/terminate-others:
 *   post:
 *     summary: Terminate all other sessions except current
 *     tags: [Sessions]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Other sessions terminated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "3 sessions terminated successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     terminatedCount:
 *                       type: number
 *                       example: 3
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.post('/terminate-others', async (req, res) => {
  try {
    const userId = req.user._id;
    const currentSessionId = req.session?.id;

    if (!currentSessionId) {
      return res.status(400).json({
        success: false,
        error: 'No active session found'
      });
    }

    const terminatedCount = await sessionService.terminateOtherSessions(userId, currentSessionId);

    // Log session termination
    await auditService.logEvent(AuditEventType.LOGOUT, req, {
      metadata: { 
        action: 'terminate_other_sessions',
        terminatedCount,
        currentSessionId 
      }
    });

    res.json({
      success: true,
      message: `${terminatedCount} sessions terminated successfully`,
      data: { terminatedCount }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to terminate other sessions'
    });
  }
});

/**
 * @swagger
 * /api/sessions/terminate/{sessionId}:
 *   delete:
 *     summary: Terminate a specific session
 *     tags: [Sessions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *         description: Session ID to terminate
 *     responses:
 *       200:
 *         description: Session terminated successfully
 *       400:
 *         description: Cannot terminate current session
 *       404:
 *         description: Session not found
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.delete('/terminate/:sessionId', async (req, res) => {
  try {
    const userId = req.user._id;
    const sessionIdToTerminate = req.params.sessionId;
    const currentSessionId = req.session?.id;

    // Prevent terminating current session
    if (sessionIdToTerminate === currentSessionId) {
      return res.status(400).json({
        success: false,
        error: 'Cannot terminate current session. Use logout instead.'
      });
    }

    // Verify session belongs to user
    const userSessions = await sessionService.getUserActiveSessions(userId);
    const sessionExists = userSessions.some(session => session.sessionId === sessionIdToTerminate);

    if (!sessionExists) {
      return res.status(404).json({
        success: false,
        error: 'Session not found or does not belong to user'
      });
    }

    const success = await sessionService.destroyUserSession(sessionIdToTerminate);

    if (success) {
      // Log session termination
      await auditService.logEvent(AuditEventType.LOGOUT, req, {
        metadata: { 
          action: 'terminate_specific_session',
          terminatedSessionId: sessionIdToTerminate 
        }
      });

      res.json({
        success: true,
        message: 'Session terminated successfully'
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Failed to terminate session'
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to terminate session'
    });
  }
});

/**
 * @swagger
 * /api/sessions/current:
 *   get:
 *     summary: Get current session information
 *     tags: [Sessions]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Current session information retrieved successfully
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.get('/current', async (req, res) => {
  try {
    const sessionId = req.session?.id;

    if (!sessionId) {
      return res.status(400).json({
        success: false,
        error: 'No active session found'
      });
    }

    const sessionData = await sessionService.getUserSession(sessionId);

    if (!sessionData) {
      return res.status(404).json({
        success: false,
        error: 'Session not found'
      });
    }

    // Remove sensitive data before sending
    const safeSessionData = {
      sessionId,
      userId: sessionData.userId,
      email: sessionData.email,
      role: sessionData.role,
      loginTime: sessionData.loginTime,
      lastActivity: sessionData.lastActivity,
      deviceInfo: sessionData.deviceInfo,
      isActive: sessionData.isActive
    };

    res.json({
      success: true,
      data: safeSessionData
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve session information'
    });
  }
});

/**
 * @swagger
 * /api/sessions/security-check:
 *   get:
 *     summary: Check for security issues with user sessions
 *     tags: [Sessions, Security]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Security check completed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     hasMultipleSessions:
 *                       type: boolean
 *                     sessionCount:
 *                       type: number
 *                     uniqueIPs:
 *                       type: number
 *                     suspiciousActivity:
 *                       type: boolean
 *                     recommendations:
 *                       type: array
 *                       items:
 *                         type: string
 */
router.get('/security-check', async (req, res) => {
  try {
    const userId = req.user._id;
    const activeSessions = await sessionService.getUserActiveSessions(userId);
    
    const uniqueIPs = new Set(activeSessions.map(session => session.ipAddress)).size;
    const hasMultipleSessions = activeSessions.length > 1;
    const suspiciousActivity = uniqueIPs > 2 || activeSessions.length > 5;
    
    const recommendations = [];
    if (hasMultipleSessions) {
      recommendations.push('Consider terminating unused sessions for better security');
    }
    if (uniqueIPs > 2) {
      recommendations.push('Multiple IP addresses detected - verify all sessions are yours');
    }
    if (activeSessions.length > 5) {
      recommendations.push('Many active sessions detected - consider session cleanup');
    }

    // Log security check
    await auditService.logEvent(AuditEventType.DATA_VIEWED, req, {
      resource: 'session_security_check',
      metadata: { 
        sessionCount: activeSessions.length,
        uniqueIPs,
        suspiciousActivity 
      }
    });

    res.json({
      success: true,
      data: {
        hasMultipleSessions,
        sessionCount: activeSessions.length,
        uniqueIPs,
        suspiciousActivity,
        recommendations
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to perform security check'
    });
  }
});

export default router;
