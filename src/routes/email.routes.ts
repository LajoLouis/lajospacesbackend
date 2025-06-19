import { Router } from 'express';
import {
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendCustomEmail,
  testEmailService,
  getEmailServiceStatus,
  getEmailTemplates,
  previewEmailTemplate
} from '../controllers/email.controller';
import { authenticate, requireRole } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';
import {
  sendVerificationEmailSchema,
  sendPasswordResetEmailSchema,
  sendCustomEmailSchema,
  previewEmailTemplateSchema
} from '../validators/email.validators';

const router = Router();

/**
 * @route   POST /api/emails/send-verification
 * @desc    Send email verification
 * @access  Private
 */
router.post(
  '/send-verification',
  authenticate,
  validateRequest(sendVerificationEmailSchema, 'body'),
  sendVerificationEmail
);

/**
 * @route   POST /api/emails/send-password-reset
 * @desc    Send password reset email
 * @access  Public
 */
router.post(
  '/send-password-reset',
  validateRequest(sendPasswordResetEmailSchema, 'body'),
  sendPasswordResetEmail
);

/**
 * @route   POST /api/emails/send-custom
 * @desc    Send custom email (admin only)
 * @access  Private (Admin)
 */
router.post(
  '/send-custom',
  authenticate,
  requireRole('admin'),
  validateRequest(sendCustomEmailSchema, 'body'),
  sendCustomEmail
);

/**
 * @route   POST /api/emails/test
 * @desc    Test email service (admin only)
 * @access  Private (Admin)
 */
router.post(
  '/test',
  authenticate,
  requireRole('admin'),
  testEmailService
);

/**
 * @route   GET /api/emails/status
 * @desc    Get email service status (admin only)
 * @access  Private (Admin)
 */
router.get(
  '/status',
  authenticate,
  requireRole('admin'),
  getEmailServiceStatus
);

/**
 * @route   GET /api/emails/templates
 * @desc    Get available email templates
 * @access  Private
 */
router.get(
  '/templates',
  authenticate,
  getEmailTemplates
);

/**
 * @route   POST /api/emails/preview-template
 * @desc    Preview email template
 * @access  Private
 */
router.post(
  '/preview-template',
  authenticate,
  validateRequest(previewEmailTemplateSchema, 'body'),
  previewEmailTemplate
);

/**
 * @route   GET /api/emails/health
 * @desc    Health check for email service
 * @access  Public
 */
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Email service is healthy',
    timestamp: new Date().toISOString(),
    service: 'Zoho SMTP'
  });
});

export default router;
