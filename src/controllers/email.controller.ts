import { Request, Response } from 'express';
import { Types } from 'mongoose';
import crypto from 'crypto';
import { catchAsync } from '../utils/catchAsync';
import { AppError } from '../utils/appError';
import { logger } from '../utils/logger';
import { emailService } from '../services/emailService';
import { emailTemplateService, EmailTemplateType } from '../services/emailTemplateService';
import { EmailPreferences } from '../models/emailPreferences.model';
import { User } from '../models/User.model';

/**
 * Send verification email
 */
export const sendVerificationEmail = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?._id;
  const { email } = req.body;

  if (!userId) {
    throw new AppError('User not authenticated', 401);
  }

  // Get user details
  const user = await User.findById(userId).select('firstName lastName email emailVerified');
  
  if (!user) {
    throw new AppError('User not found', 404);
  }

  if (user.emailVerified) {
    throw new AppError('Email already verified', 400);
  }

  // Generate secure verification token
  const verificationToken = crypto.randomBytes(32).toString('hex');

  // Send verification email
  const result = await emailService.sendVerificationEmail(
    email || user.email,
    user.firstName,
    verificationToken
  );

  if (!result.success) {
    throw new AppError('Failed to send verification email', 500);
  }

  logger.info('Verification email sent', {
    userId,
    email: email || user.email,
    messageId: result.messageId
  });

  return res.json({
    success: true,
    message: 'Verification email sent successfully',
    data: {
      email: email || user.email,
      messageId: result.messageId
    }
  });
});

/**
 * Send password reset email
 */
export const sendPasswordResetEmail = catchAsync(async (req: Request, res: Response) => {
  const { email } = req.body;

  if (!email) {
    throw new AppError('Email is required', 400);
  }

  // Find user by email
  const user = await User.findOne({ email }).select('firstName lastName email');
  
  if (!user) {
    // Don't reveal if email exists for security
    return res.json({
      success: true,
      message: 'If an account with that email exists, a password reset link has been sent'
    });
  }

  // Generate secure reset token
  const resetToken = crypto.randomBytes(32).toString('hex');

  // Send password reset email
  const result = await emailService.sendPasswordResetEmail(
    user.email,
    user.firstName,
    resetToken
  );

  if (!result.success) {
    logger.error('Failed to send password reset email', {
      email,
      error: result.error
    });
    
    // Don't reveal the error for security
    return res.json({
      success: true,
      message: 'If an account with that email exists, a password reset link has been sent'
    });
  }

  logger.info('Password reset email sent', {
    email,
    messageId: result.messageId
  });

  return res.json({
    success: true,
    message: 'If an account with that email exists, a password reset link has been sent',
    data: {
      messageId: result.messageId
    }
  });
});

/**
 * Send custom email
 */
export const sendCustomEmail = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?._id;
  const { 
    templateType, 
    recipientEmail, 
    templateData, 
    subject,
    customContent 
  } = req.body;

  if (!userId) {
    throw new AppError('User not authenticated', 401);
  }

  // Check if user has permission to send custom emails (admin only)
  const user = await User.findById(userId).select('role');
  if (!user || user.role !== 'admin') {
    throw new AppError('Insufficient permissions', 403);
  }

  let emailContent;
  let emailSubject;

  if (templateType && Object.values(EmailTemplateType).includes(templateType)) {
    // Use template
    const rendered = emailTemplateService.renderTemplate(
      templateType as EmailTemplateType,
      templateData || {},
      'html'
    );
    emailContent = rendered.content;
    emailSubject = subject || rendered.subject;
  } else if (customContent) {
    // Use custom content
    emailContent = customContent;
    emailSubject = subject || 'Message from LajoSpaces';
  } else {
    throw new AppError('Either templateType or customContent is required', 400);
  }

  // Send email
  const result = await emailService.sendEmail({
    to: recipientEmail,
    subject: emailSubject,
    html: emailContent
  });

  if (!result.success) {
    throw new AppError('Failed to send email', 500);
  }

  logger.info('Custom email sent', {
    userId,
    recipientEmail,
    templateType,
    messageId: result.messageId
  });

  return res.json({
    success: true,
    message: 'Email sent successfully',
    data: {
      messageId: result.messageId
    }
  });
});

/**
 * Test email service
 */
export const testEmailService = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?._id;

  if (!userId) {
    throw new AppError('User not authenticated', 401);
  }

  // Check if user is admin
  const user = await User.findById(userId).select('role email firstName');
  if (!user || user.role !== 'admin') {
    throw new AppError('Insufficient permissions', 403);
  }

  // Test email service connection
  const isConnected = await emailService.verifyConnection();

  if (!isConnected) {
    throw new AppError('Email service connection failed', 500);
  }

  // Send test email
  const result = await emailService.sendEmail({
    to: user.email,
    subject: 'LajoSpaces Email Service Test',
    html: `
      <h2>Email Service Test</h2>
      <p>Hello ${user.firstName}!</p>
      <p>This is a test email to verify that the LajoSpaces email service is working correctly.</p>
      <p>If you received this email, the service is functioning properly.</p>
      <p>Test performed at: ${new Date().toISOString()}</p>
      <p>Best regards,<br>LajoSpaces System</p>
    `,
    text: `
      Email Service Test
      
      Hello ${user.firstName}!
      
      This is a test email to verify that the LajoSpaces email service is working correctly.
      
      If you received this email, the service is functioning properly.
      
      Test performed at: ${new Date().toISOString()}
      
      Best regards,
      LajoSpaces System
    `
  });

  if (!result.success) {
    throw new AppError('Failed to send test email', 500);
  }

  logger.info('Test email sent successfully', {
    userId,
    email: user.email,
    messageId: result.messageId
  });

  return res.json({
    success: true,
    message: 'Test email sent successfully',
    data: {
      connectionStatus: 'connected',
      testEmailSent: true,
      messageId: result.messageId,
      timestamp: new Date().toISOString()
    }
  });
});

/**
 * Get email service status
 */
export const getEmailServiceStatus = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?._id;

  if (!userId) {
    throw new AppError('User not authenticated', 401);
  }

  // Check if user is admin
  const user = await User.findById(userId).select('role');
  if (!user || user.role !== 'admin') {
    throw new AppError('Insufficient permissions', 403);
  }

  // Check email service connection
  const isConnected = await emailService.verifyConnection();

  return res.json({
    success: true,
    data: {
      status: isConnected ? 'connected' : 'disconnected',
      timestamp: new Date().toISOString(),
      service: 'Zoho SMTP'
    }
  });
});

/**
 * Get available email templates
 */
export const getEmailTemplates = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?._id;

  if (!userId) {
    throw new AppError('User not authenticated', 401);
  }

  const templates = Object.values(EmailTemplateType).map(type => ({
    type,
    name: type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
    description: getTemplateDescription(type)
  }));

  return res.json({
    success: true,
    data: {
      templates,
      total: templates.length
    }
  });
});

/**
 * Preview email template
 */
export const previewEmailTemplate = catchAsync(async (req: Request, res: Response) => {
  const { templateType, templateData, format = 'html' } = req.body;

  if (!templateType || !Object.values(EmailTemplateType).includes(templateType)) {
    throw new AppError('Invalid template type', 400);
  }

  const sampleData = {
    userName: 'John Doe',
    userEmail: 'john@example.com',
    verificationUrl: 'https://lajospaces.com/verify?token=sample',
    resetUrl: 'https://lajospaces.com/reset?token=sample',
    senderName: 'Jane Smith',
    messagePreview: 'Hello! I saw your property listing and I\'m interested...',
    messageUrl: 'https://lajospaces.com/messages/123',
    compatibilityScore: 85,
    matchType: 'Roommate',
    location: 'Lagos, Nigeria',
    budgetRange: '₦50,000 - ₦80,000',
    matchUrl: 'https://lajospaces.com/matches/456',
    propertyTitle: 'Beautiful 2-Bedroom Apartment',
    propertyLocation: 'Victoria Island, Lagos',
    propertyPrice: '₦120,000/month',
    propertyUrl: 'https://lajospaces.com/properties/789',
    ...templateData
  };

  const rendered = emailTemplateService.renderTemplate(
    templateType as EmailTemplateType,
    sampleData,
    format as 'html' | 'text'
  );

  return res.json({
    success: true,
    data: {
      subject: rendered.subject,
      content: rendered.content,
      format,
      templateType
    }
  });
});

/**
 * Get template description
 */
function getTemplateDescription(type: EmailTemplateType): string {
  const descriptions = {
    [EmailTemplateType.WELCOME]: 'Welcome email sent to new users after registration',
    [EmailTemplateType.EMAIL_VERIFICATION]: 'Email verification link sent to users',
    [EmailTemplateType.PASSWORD_RESET]: 'Password reset link sent to users',
    [EmailTemplateType.PASSWORD_CHANGED]: 'Confirmation email sent after password change',
    [EmailTemplateType.NEW_MESSAGE]: 'Notification email for new messages',
    [EmailTemplateType.NEW_MATCH]: 'Notification email for new roommate matches',
    [EmailTemplateType.PROPERTY_POSTED]: 'Confirmation email when property is posted',
    [EmailTemplateType.PROPERTY_APPROVED]: 'Notification when property is approved',
    [EmailTemplateType.SYSTEM_NOTIFICATION]: 'General system notifications',
    [EmailTemplateType.NEWSLETTER]: 'Newsletter and promotional emails',
    [EmailTemplateType.SECURITY_ALERT]: 'Security-related notifications'
  };

  return descriptions[type] || 'Email template';
}
