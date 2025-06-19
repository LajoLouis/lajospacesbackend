import handlebars from 'handlebars';
import { logger } from '../utils/logger';
import { config } from '../config/environment';

// Template data interface
export interface TemplateData {
  [key: string]: any;
  // Common fields
  userName?: string;
  userEmail?: string;
  siteName?: string;
  siteUrl?: string;
  supportEmail?: string;
  currentYear?: number;
}

// Email template types
export enum EmailTemplateType {
  WELCOME = 'welcome',
  EMAIL_VERIFICATION = 'email_verification',
  PASSWORD_RESET = 'password_reset',
  PASSWORD_CHANGED = 'password_changed',
  NEW_MESSAGE = 'new_message',
  NEW_MATCH = 'new_match',
  PROPERTY_POSTED = 'property_posted',
  PROPERTY_APPROVED = 'property_approved',
  SYSTEM_NOTIFICATION = 'system_notification',
  NEWSLETTER = 'newsletter',
  SECURITY_ALERT = 'security_alert'
}

class EmailTemplateService {
  private templates: Map<EmailTemplateType, { html: string; text: string; subject: string }> = new Map();

  constructor() {
    this.initializeTemplates();
  }

  /**
   * Initialize email templates
   */
  private initializeTemplates(): void {
    // Welcome email template
    this.templates.set(EmailTemplateType.WELCOME, {
      subject: 'Welcome to LajoSpaces! 🏠',
      html: this.getWelcomeHTMLTemplate(),
      text: this.getWelcomeTextTemplate()
    });

    // Email verification template
    this.templates.set(EmailTemplateType.EMAIL_VERIFICATION, {
      subject: 'Verify Your LajoSpaces Account',
      html: this.getEmailVerificationHTMLTemplate(),
      text: this.getEmailVerificationTextTemplate()
    });

    // Password reset template
    this.templates.set(EmailTemplateType.PASSWORD_RESET, {
      subject: 'Reset Your LajoSpaces Password',
      html: this.getPasswordResetHTMLTemplate(),
      text: this.getPasswordResetTextTemplate()
    });

    // New message template
    this.templates.set(EmailTemplateType.NEW_MESSAGE, {
      subject: 'New Message on LajoSpaces',
      html: this.getNewMessageHTMLTemplate(),
      text: this.getNewMessageTextTemplate()
    });

    // New match template
    this.templates.set(EmailTemplateType.NEW_MATCH, {
      subject: '🎉 New Roommate Match Found!',
      html: this.getNewMatchHTMLTemplate(),
      text: this.getNewMatchTextTemplate()
    });

    // Property posted template
    this.templates.set(EmailTemplateType.PROPERTY_POSTED, {
      subject: 'Property Posted Successfully',
      html: this.getPropertyPostedHTMLTemplate(),
      text: this.getPropertyPostedTextTemplate()
    });

    logger.info('Email templates initialized successfully');
  }

  /**
   * Render email template
   */
  public renderTemplate(
    templateType: EmailTemplateType,
    data: TemplateData,
    format: 'html' | 'text' = 'html'
  ): { subject: string; content: string } {
    const template = this.templates.get(templateType);
    
    if (!template) {
      throw new Error(`Template not found: ${templateType}`);
    }

    // Add common data
    const templateData = {
      ...data,
      siteName: 'LajoSpaces',
      siteUrl: config.FRONTEND_URL,
      supportEmail: 'support@lajospaces.com',
      currentYear: new Date().getFullYear()
    };

    try {
      const compiledTemplate = handlebars.compile(template[format]);
      const compiledSubject = handlebars.compile(template.subject);

      return {
        subject: compiledSubject(templateData),
        content: compiledTemplate(templateData)
      };
    } catch (error) {
      logger.error(`Error rendering template ${templateType}:`, error);
      throw new Error(`Failed to render template: ${templateType}`);
    }
  }

  /**
   * Welcome email HTML template
   */
  private getWelcomeHTMLTemplate(): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Welcome to {{siteName}}!</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #2563eb, #1d4ed8); color: white; padding: 30px 20px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9fafb; padding: 40px 30px; border-radius: 0 0 10px 10px; }
          .button { display: inline-block; background: #2563eb; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; margin: 20px 0; font-weight: bold; }
          .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
          .logo { font-size: 28px; font-weight: bold; margin-bottom: 10px; }
          .feature { background: white; padding: 20px; margin: 15px 0; border-radius: 8px; border-left: 4px solid #2563eb; }
          .feature-icon { font-size: 24px; margin-right: 10px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">🏠 {{siteName}}</div>
            <h1>Welcome to Nigeria's Premier Housing Platform!</h1>
          </div>
          <div class="content">
            <h2>Hello {{userName}}!</h2>
            <p>🎉 Welcome to {{siteName}}! We're thrilled to have you join our community of housing seekers and providers across Nigeria.</p>
            
            <h3>What you can do now:</h3>
            
            <div class="feature">
              <span class="feature-icon">🔍</span>
              <strong>Search Properties</strong><br>
              Browse thousands of verified properties across Nigeria's major cities
            </div>
            
            <div class="feature">
              <span class="feature-icon">💬</span>
              <strong>Find Roommates</strong><br>
              Connect with compatible roommates using our smart matching system
            </div>
            
            <div class="feature">
              <span class="feature-icon">📝</span>
              <strong>List Your Property</strong><br>
              Post your available rooms and properties to reach thousands of potential tenants
            </div>
            
            <div class="feature">
              <span class="feature-icon">⭐</span>
              <strong>Save Favorites</strong><br>
              Bookmark properties you love and get notified of price changes
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="{{siteUrl}}/dashboard" class="button">Start Exploring</a>
            </div>
            
            <p>Need help getting started? Check out our <a href="{{siteUrl}}/help">Help Center</a> or reply to this email.</p>
            
            <p>Happy house hunting!</p>
            <p><strong>The {{siteName}} Team</strong></p>
          </div>
          <div class="footer">
            <p>© {{currentYear}} {{siteName}}. All rights reserved.</p>
            <p>Nigeria's trusted housing platform</p>
            <p><a href="{{siteUrl}}/unsubscribe?email={{userEmail}}">Unsubscribe</a> | <a href="{{siteUrl}}/privacy">Privacy Policy</a></p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Welcome email text template
   */
  private getWelcomeTextTemplate(): string {
    return `
      Welcome to {{siteName}}!
      
      Hello {{userName}}!
      
      Welcome to {{siteName}}! We're thrilled to have you join our community of housing seekers and providers across Nigeria.
      
      What you can do now:
      
      🔍 Search Properties
      Browse thousands of verified properties across Nigeria's major cities
      
      💬 Find Roommates
      Connect with compatible roommates using our smart matching system
      
      📝 List Your Property
      Post your available rooms and properties to reach thousands of potential tenants
      
      ⭐ Save Favorites
      Bookmark properties you love and get notified of price changes
      
      Start exploring: {{siteUrl}}/dashboard
      
      Need help getting started? Check out our Help Center: {{siteUrl}}/help
      
      Happy house hunting!
      The {{siteName}} Team
      
      © {{currentYear}} {{siteName}}. All rights reserved.
      Nigeria's trusted housing platform
      
      Unsubscribe: {{siteUrl}}/unsubscribe?email={{userEmail}}
    `;
  }

  /**
   * Email verification HTML template
   */
  private getEmailVerificationHTMLTemplate(): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Verify Your {{siteName}} Account</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #2563eb; color: white; padding: 30px 20px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9fafb; padding: 40px 30px; border-radius: 0 0 10px 10px; }
          .button { display: inline-block; background: #2563eb; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; margin: 20px 0; font-weight: bold; }
          .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
          .logo { font-size: 28px; font-weight: bold; margin-bottom: 10px; }
          .warning { background: #fef3c7; border: 1px solid #f59e0b; padding: 15px; border-radius: 8px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">🏠 {{siteName}}</div>
            <h1>Verify Your Account</h1>
          </div>
          <div class="content">
            <h2>Hello {{userName}}!</h2>
            <p>Thank you for joining {{siteName}}! To complete your registration and start finding your perfect home, please verify your email address.</p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="{{verificationUrl}}" class="button">Verify My Account</a>
            </div>
            
            <p>Or copy and paste this link into your browser:</p>
            <p style="word-break: break-all; color: #2563eb; background: #e5f3ff; padding: 10px; border-radius: 5px;">{{verificationUrl}}</p>
            
            <div class="warning">
              <strong>⚠️ Important:</strong>
              <ul>
                <li>This verification link will expire in 24 hours</li>
                <li>If you didn't create an account with {{siteName}}, please ignore this email</li>
              </ul>
            </div>
            
            <p>Once verified, you'll have access to all {{siteName}} features including property search, roommate matching, and more!</p>
          </div>
          <div class="footer">
            <p>© {{currentYear}} {{siteName}}. All rights reserved.</p>
            <p>Nigeria's trusted housing platform</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Email verification text template
   */
  private getEmailVerificationTextTemplate(): string {
    return `
      Verify Your {{siteName}} Account
      
      Hello {{userName}}!
      
      Thank you for joining {{siteName}}! To complete your registration and start finding your perfect home, please verify your email address.
      
      Click here to verify: {{verificationUrl}}
      
      IMPORTANT:
      - This verification link will expire in 24 hours
      - If you didn't create an account with {{siteName}}, please ignore this email
      
      Once verified, you'll have access to all {{siteName}} features including property search, roommate matching, and more!
      
      © {{currentYear}} {{siteName}}. All rights reserved.
      Nigeria's trusted housing platform
    `;
  }

  /**
   * Password reset HTML template
   */
  private getPasswordResetHTMLTemplate(): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Reset Your {{siteName}} Password</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #dc2626; color: white; padding: 30px 20px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9fafb; padding: 40px 30px; border-radius: 0 0 10px 10px; }
          .button { display: inline-block; background: #dc2626; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; margin: 20px 0; font-weight: bold; }
          .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
          .logo { font-size: 28px; font-weight: bold; margin-bottom: 10px; }
          .warning { background: #fef3c7; border: 1px solid #f59e0b; padding: 15px; border-radius: 8px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">🏠 {{siteName}}</div>
            <h1>Password Reset Request</h1>
          </div>
          <div class="content">
            <h2>Hello {{userName}}!</h2>
            <p>We received a request to reset your {{siteName}} account password. If you made this request, click the button below:</p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="{{resetUrl}}" class="button">Reset My Password</a>
            </div>
            
            <p>Or copy and paste this link into your browser:</p>
            <p style="word-break: break-all; color: #dc2626; background: #fee2e2; padding: 10px; border-radius: 5px;">{{resetUrl}}</p>
            
            <div class="warning">
              <strong>⚠️ Security Information:</strong>
              <ul>
                <li>This password reset link will expire in 1 hour</li>
                <li>If you didn't request this reset, please ignore this email</li>
                <li>Your password will remain unchanged until you create a new one</li>
              </ul>
            </div>
            
            <p>For your security, we recommend choosing a strong password with at least 8 characters, including uppercase and lowercase letters, numbers, and special characters.</p>
          </div>
          <div class="footer">
            <p>© {{currentYear}} {{siteName}}. All rights reserved.</p>
            <p>Nigeria's trusted housing platform</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Password reset text template
   */
  private getPasswordResetTextTemplate(): string {
    return `
      Password Reset Request - {{siteName}}
      
      Hello {{userName}}!
      
      We received a request to reset your {{siteName}} account password. If you made this request, use the link below:
      
      {{resetUrl}}
      
      SECURITY INFORMATION:
      - This password reset link will expire in 1 hour
      - If you didn't request this reset, please ignore this email
      - Your password will remain unchanged until you create a new one
      
      For your security, we recommend choosing a strong password with at least 8 characters, including uppercase and lowercase letters, numbers, and special characters.
      
      © {{currentYear}} {{siteName}}. All rights reserved.
      Nigeria's trusted housing platform
    `;
  }

  /**
   * New message HTML template
   */
  private getNewMessageHTMLTemplate(): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>New Message on {{siteName}}</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #059669; color: white; padding: 30px 20px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9fafb; padding: 40px 30px; border-radius: 0 0 10px 10px; }
          .button { display: inline-block; background: #059669; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; margin: 20px 0; font-weight: bold; }
          .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
          .logo { font-size: 28px; font-weight: bold; margin-bottom: 10px; }
          .message-preview { background: white; padding: 20px; border-radius: 8px; border-left: 4px solid #059669; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">🏠 {{siteName}}</div>
            <h1>💬 New Message</h1>
          </div>
          <div class="content">
            <h2>Hello {{userName}}!</h2>
            <p>You have a new message from <strong>{{senderName}}</strong>:</p>
            
            <div class="message-preview">
              <p><strong>{{messagePreview}}</strong></p>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="{{messageUrl}}" class="button">View Message</a>
            </div>
            
            <p>Don't want to receive message notifications? <a href="{{siteUrl}}/settings/notifications">Update your preferences</a>.</p>
          </div>
          <div class="footer">
            <p>© {{currentYear}} {{siteName}}. All rights reserved.</p>
            <p><a href="{{siteUrl}}/unsubscribe?email={{userEmail}}">Unsubscribe</a></p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * New message text template
   */
  private getNewMessageTextTemplate(): string {
    return `
      New Message on {{siteName}}
      
      Hello {{userName}}!
      
      You have a new message from {{senderName}}:
      
      "{{messagePreview}}"
      
      View message: {{messageUrl}}
      
      Don't want to receive message notifications? Update your preferences: {{siteUrl}}/settings/notifications
      
      © {{currentYear}} {{siteName}}. All rights reserved.
      Unsubscribe: {{siteUrl}}/unsubscribe?email={{userEmail}}
    `;
  }

  /**
   * New match HTML template
   */
  private getNewMatchHTMLTemplate(): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>New Roommate Match - {{siteName}}</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #f59e0b, #d97706); color: white; padding: 30px 20px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9fafb; padding: 40px 30px; border-radius: 0 0 10px 10px; }
          .button { display: inline-block; background: #f59e0b; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; margin: 20px 0; font-weight: bold; }
          .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
          .logo { font-size: 28px; font-weight: bold; margin-bottom: 10px; }
          .match-info { background: white; padding: 20px; border-radius: 8px; border-left: 4px solid #f59e0b; margin: 20px 0; }
          .compatibility { font-size: 24px; font-weight: bold; color: #f59e0b; text-align: center; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">🏠 {{siteName}}</div>
            <h1>🎉 New Roommate Match!</h1>
          </div>
          <div class="content">
            <h2>Hello {{userName}}!</h2>
            <p>Great news! We found a potential roommate match for you with high compatibility.</p>
            
            <div class="match-info">
              <div class="compatibility">{{compatibilityScore}}% Compatible</div>
              <p><strong>Match Type:</strong> {{matchType}}</p>
              <p><strong>Location:</strong> {{location}}</p>
              <p><strong>Budget Range:</strong> {{budgetRange}}</p>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="{{matchUrl}}" class="button">View Match</a>
            </div>
            
            <p>Don't miss out on this opportunity to find your perfect roommate!</p>
          </div>
          <div class="footer">
            <p>© {{currentYear}} {{siteName}}. All rights reserved.</p>
            <p><a href="{{siteUrl}}/unsubscribe?email={{userEmail}}">Unsubscribe</a></p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * New match text template
   */
  private getNewMatchTextTemplate(): string {
    return `
      🎉 New Roommate Match! - {{siteName}}
      
      Hello {{userName}}!
      
      Great news! We found a potential roommate match for you with {{compatibilityScore}}% compatibility.
      
      Match Details:
      - Type: {{matchType}}
      - Location: {{location}}
      - Budget Range: {{budgetRange}}
      
      View match: {{matchUrl}}
      
      Don't miss out on this opportunity to find your perfect roommate!
      
      © {{currentYear}} {{siteName}}. All rights reserved.
      Unsubscribe: {{siteUrl}}/unsubscribe?email={{userEmail}}
    `;
  }

  /**
   * Property posted HTML template
   */
  private getPropertyPostedHTMLTemplate(): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Property Posted Successfully - {{siteName}}</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #059669; color: white; padding: 30px 20px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9fafb; padding: 40px 30px; border-radius: 0 0 10px 10px; }
          .button { display: inline-block; background: #059669; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; margin: 20px 0; font-weight: bold; }
          .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
          .logo { font-size: 28px; font-weight: bold; margin-bottom: 10px; }
          .property-info { background: white; padding: 20px; border-radius: 8px; border-left: 4px solid #059669; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">🏠 {{siteName}}</div>
            <h1>✅ Property Posted Successfully!</h1>
          </div>
          <div class="content">
            <h2>Hello {{userName}}!</h2>
            <p>Great news! Your property listing has been successfully posted on {{siteName}} and is now visible to thousands of potential tenants.</p>
            
            <div class="property-info">
              <p><strong>Property:</strong> {{propertyTitle}}</p>
              <p><strong>Location:</strong> {{propertyLocation}}</p>
              <p><strong>Price:</strong> {{propertyPrice}}</p>
              <p><strong>Status:</strong> Active</p>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="{{propertyUrl}}" class="button">View Listing</a>
            </div>
            
            <p>Your listing is now being promoted to relevant users. You'll receive notifications when users show interest in your property.</p>
            
            <p><strong>Tips to get more inquiries:</strong></p>
            <ul>
              <li>Add high-quality photos</li>
              <li>Write a detailed description</li>
              <li>Respond quickly to inquiries</li>
              <li>Keep your listing updated</li>
            </ul>
          </div>
          <div class="footer">
            <p>© {{currentYear}} {{siteName}}. All rights reserved.</p>
            <p><a href="{{siteUrl}}/unsubscribe?email={{userEmail}}">Unsubscribe</a></p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Property posted text template
   */
  private getPropertyPostedTextTemplate(): string {
    return `
      Property Posted Successfully - {{siteName}}
      
      Hello {{userName}}!
      
      Great news! Your property listing has been successfully posted on {{siteName}} and is now visible to thousands of potential tenants.
      
      Property Details:
      - Property: {{propertyTitle}}
      - Location: {{propertyLocation}}
      - Price: {{propertyPrice}}
      - Status: Active
      
      View listing: {{propertyUrl}}
      
      Your listing is now being promoted to relevant users. You'll receive notifications when users show interest in your property.
      
      Tips to get more inquiries:
      - Add high-quality photos
      - Write a detailed description
      - Respond quickly to inquiries
      - Keep your listing updated
      
      © {{currentYear}} {{siteName}}. All rights reserved.
      Unsubscribe: {{siteUrl}}/unsubscribe?email={{userEmail}}
    `;
  }
}

// Create and export singleton instance
export const emailTemplateService = new EmailTemplateService();

export default emailTemplateService;
