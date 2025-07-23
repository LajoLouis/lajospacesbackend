import nodemailer from 'nodemailer';
import { config } from '../config/environment';
import { logger } from '../utils/logger';

// Email template interface
interface EmailTemplate {
  subject: string;
  html: string;
  text: string;
}

// Email options interface
interface EmailOptions {
  to: string;
  subject: string;
  html?: string;
  text?: string;
  template?: 'welcome' | 'verification' | 'password-reset' | 'password-changed';
  data?: Record<string, any>;
}

// Create transporter
const transporter = nodemailer.createTransport({
  host: config.SMTP_HOST,
  port: config.SMTP_PORT,
  secure: false, // false for 587 (STARTTLS), true for 465 (SSL)
  auth: {
    user: config.SMTP_USER,
    pass: config.SMTP_PASS
  },
  tls: {
    rejectUnauthorized: false
  },
  requireTLS: true
});

// Verify transporter configuration (temporarily disabled to isolate startup issues)
// transporter.verify((error: any, _success: any) => {
//   if (error) {
//     logger.error('Email transporter configuration error:', error);
//   } else {
//     logger.info('✅ Email service ready');
//   }
// });

// Log immediate readiness for startup
logger.info('📧 Email service initialized (verification disabled for testing)');

/**
 * Email templates
 */
const emailTemplates = {
  welcome: (data: { firstName: string; lastName: string }): EmailTemplate => ({
    subject: 'Welcome to LajoSpaces! 🏠',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Welcome to LajoSpaces</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .button { display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Welcome to LajoSpaces! 🏠</h1>
          </div>
          <div class="content">
            <h2>Hello ${data.firstName} ${data.lastName}!</h2>
            <p>Welcome to LajoSpaces, Nigeria's premier roommate matching platform! We're excited to help you find your perfect living situation.</p>
            
            <h3>What's Next?</h3>
            <ul>
              <li>✅ Complete your profile to get better matches</li>
              <li>🔍 Browse available rooms and roommates</li>
              <li>💬 Start connecting with potential roommates</li>
              <li>🏠 Find your perfect home in Nigeria</li>
            </ul>
            
            <p>Our platform is designed specifically for the Nigerian market, covering all major cities from Lagos to Abuja, Port Harcourt to Kano.</p>
            
            <div style="text-align: center;">
              <a href="${config.FRONTEND_URL}/dashboard" class="button">Complete Your Profile</a>
            </div>
            
            <p>If you have any questions, our support team is here to help!</p>
            
            <p>Best regards,<br>The LajoSpaces Team</p>
          </div>
          <div class="footer">
            <p>LajoSpaces - Connecting Roommates Across Nigeria</p>
            <p>This email was sent to you because you created an account on LajoSpaces.</p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `
      Welcome to LajoSpaces, ${data.firstName} ${data.lastName}!
      
      We're excited to help you find your perfect living situation in Nigeria.
      
      What's Next?
      - Complete your profile to get better matches
      - Browse available rooms and roommates
      - Start connecting with potential roommates
      - Find your perfect home in Nigeria
      
      Visit ${config.FRONTEND_URL}/dashboard to get started.
      
      Best regards,
      The LajoSpaces Team
    `
  }),

  verification: (data: { firstName: string; verificationLink: string }): EmailTemplate => ({
    subject: 'Verify Your LajoSpaces Account 📧',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Verify Your Account</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .button { display: inline-block; background: #28a745; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; font-weight: bold; }
          .warning { background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 5px; margin: 20px 0; }
          .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Verify Your Account 📧</h1>
          </div>
          <div class="content">
            <h2>Hello ${data.firstName}!</h2>
            <p>Thank you for joining LajoSpaces! To complete your registration and start finding roommates, please verify your email address.</p>
            
            <div style="text-align: center;">
              <a href="${data.verificationLink}" class="button">Verify Email Address</a>
            </div>
            
            <div class="warning">
              <strong>⚠️ Important:</strong> This verification link will expire in 24 hours for security reasons.
            </div>
            
            <p>If the button doesn't work, copy and paste this link into your browser:</p>
            <p style="word-break: break-all; background: #f1f1f1; padding: 10px; border-radius: 5px;">${data.verificationLink}</p>
            
            <p>If you didn't create an account with LajoSpaces, please ignore this email.</p>
            
            <p>Best regards,<br>The LajoSpaces Team</p>
          </div>
          <div class="footer">
            <p>LajoSpaces - Connecting Roommates Across Nigeria</p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `
      Hello ${data.firstName}!
      
      Thank you for joining LajoSpaces! To complete your registration, please verify your email address by clicking the link below:
      
      ${data.verificationLink}
      
      This link will expire in 24 hours for security reasons.
      
      If you didn't create an account with LajoSpaces, please ignore this email.
      
      Best regards,
      The LajoSpaces Team
    `
  }),

  'password-reset': (data: { firstName: string; resetLink: string }): EmailTemplate => ({
    subject: 'Reset Your LajoSpaces Password 🔐',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Reset Your Password</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .button { display: inline-block; background: #dc3545; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; font-weight: bold; }
          .warning { background: #f8d7da; border: 1px solid #f5c6cb; padding: 15px; border-radius: 5px; margin: 20px 0; }
          .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Reset Your Password 🔐</h1>
          </div>
          <div class="content">
            <h2>Hello ${data.firstName}!</h2>
            <p>We received a request to reset your LajoSpaces account password. Click the button below to create a new password:</p>
            
            <div style="text-align: center;">
              <a href="${data.resetLink}" class="button">Reset Password</a>
            </div>
            
            <div class="warning">
              <strong>⚠️ Security Notice:</strong> This password reset link will expire in 1 hour for your security.
            </div>
            
            <p>If the button doesn't work, copy and paste this link into your browser:</p>
            <p style="word-break: break-all; background: #f1f1f1; padding: 10px; border-radius: 5px;">${data.resetLink}</p>
            
            <p><strong>If you didn't request this password reset, please ignore this email.</strong> Your password will remain unchanged.</p>
            
            <p>For security reasons, we recommend:</p>
            <ul>
              <li>Using a strong, unique password</li>
              <li>Not sharing your password with anyone</li>
              <li>Logging out of shared devices</li>
            </ul>
            
            <p>Best regards,<br>The LajoSpaces Team</p>
          </div>
          <div class="footer">
            <p>LajoSpaces - Connecting Roommates Across Nigeria</p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `
      Hello ${data.firstName}!
      
      We received a request to reset your LajoSpaces account password. Click the link below to create a new password:
      
      ${data.resetLink}
      
      This link will expire in 1 hour for your security.
      
      If you didn't request this password reset, please ignore this email.
      
      Best regards,
      The LajoSpaces Team
    `
  }),

  'password-changed': (data: { firstName: string }): EmailTemplate => ({
    subject: 'Your LajoSpaces Password Has Been Changed ✅',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Password Changed</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #28a745 0%, #20c997 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .alert { background: #d1ecf1; border: 1px solid #bee5eb; padding: 15px; border-radius: 5px; margin: 20px 0; }
          .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Password Changed Successfully ✅</h1>
          </div>
          <div class="content">
            <h2>Hello ${data.firstName}!</h2>
            <p>This email confirms that your LajoSpaces account password has been successfully changed.</p>
            
            <div class="alert">
              <strong>🔐 Security Confirmation:</strong> Your password was changed on ${new Date().toLocaleString('en-NG', { timeZone: 'Africa/Lagos' })} (WAT).
            </div>
            
            <p><strong>If you made this change:</strong> No further action is required. Your account is secure.</p>
            
            <p><strong>If you didn't make this change:</strong> Please contact our support team immediately at support@lajospaces.com or log into your account to secure it.</p>
            
            <p>For your security, we recommend:</p>
            <ul>
              <li>Using a unique password for your LajoSpaces account</li>
              <li>Enabling two-factor authentication when available</li>
              <li>Regularly reviewing your account activity</li>
            </ul>
            
            <p>Best regards,<br>The LajoSpaces Team</p>
          </div>
          <div class="footer">
            <p>LajoSpaces - Connecting Roommates Across Nigeria</p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `
      Hello ${data.firstName}!
      
      This email confirms that your LajoSpaces account password has been successfully changed on ${new Date().toLocaleString('en-NG', { timeZone: 'Africa/Lagos' })} (WAT).
      
      If you made this change: No further action is required.
      
      If you didn't make this change: Please contact our support team immediately.
      
      Best regards,
      The LajoSpaces Team
    `
  })
};

/**
 * Send email
 */
export async function sendEmail(options: EmailOptions): Promise<void> {
  try {
    let emailContent: EmailTemplate;

    if (options.template && options.data) {
      // Use template
      const templateFunction = emailTemplates[options.template];
      if (!templateFunction) {
        throw new Error(`Email template '${options.template}' not found`);
      }
      emailContent = templateFunction(options.data as any);
    } else {
      // Use custom content
      emailContent = {
        subject: options.subject,
        html: options.html || '',
        text: options.text || ''
      };
    }

    const mailOptions = {
      from: `${config.FROM_NAME} <${config.FROM_EMAIL}>`,
      to: options.to,
      subject: emailContent.subject,
      html: emailContent.html,
      text: emailContent.text
    };

    const result = await transporter.sendMail(mailOptions);
    
    logger.info(`Email sent successfully to ${options.to}`, {
      messageId: result.messageId,
      template: options.template || 'custom'
    });

  } catch (error) {
    logger.error(`Failed to send email to ${options.to}:`, error);
    throw new Error('Failed to send email');
  }
}

/**
 * Send welcome email
 */
export async function sendWelcomeEmail(to: string, firstName: string, lastName: string): Promise<void> {
  await sendEmail({
    to,
    template: 'welcome',
    subject: '', // Will be overridden by template
    data: { firstName, lastName }
  });
}

/**
 * Send email verification
 */
export async function sendVerificationEmail(to: string, firstName: string, verificationToken: string): Promise<void> {
  const verificationLink = `${config.FRONTEND_URL}/verify-email?token=${verificationToken}`;
  
  await sendEmail({
    to,
    template: 'verification',
    subject: '', // Will be overridden by template
    data: { firstName, verificationLink }
  });
}

/**
 * Send password reset email
 */
export async function sendPasswordResetEmail(to: string, firstName: string, resetToken: string): Promise<void> {
  const resetLink = `${config.FRONTEND_URL}/reset-password?token=${resetToken}`;
  
  await sendEmail({
    to,
    template: 'password-reset',
    subject: '', // Will be overridden by template
    data: { firstName, resetLink }
  });
}

/**
 * Send password changed confirmation
 */
export async function sendPasswordChangedEmail(to: string, firstName: string): Promise<void> {
  await sendEmail({
    to,
    template: 'password-changed',
    subject: '', // Will be overridden by template
    data: { firstName }
  });
}

export default {
  sendEmail,
  sendWelcomeEmail,
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendPasswordChangedEmail
};
