import { Request, Response, NextFunction } from 'express';
import { AppError, catchAsync } from '../middleware/errorHandler';
import { logger, logHelpers } from '../utils/logger';
import { generateTokenPair, verifyRefreshToken, revokeRefreshToken, revokeAllRefreshTokens, generateEmailVerificationToken, verifyEmailVerificationToken, generatePasswordResetToken, verifyPasswordResetToken } from '../utils/jwt';
import { sendWelcomeEmail, sendVerificationEmail, sendPasswordResetEmail, sendPasswordChangedEmail } from '../services/emailService';
import { clearAuthRateLimit } from '../middleware/auth';
import User, { IUser } from '../models/User.model';
import Profile from '../models/Profile.model';

/**
 * Register new user
 */
export const register = catchAsync(async (req: Request, res: Response, __next: NextFunction) => {
  const { email, password, firstName, lastName, dateOfBirth, gender, phoneNumber, accountType, location } = req.body;

  // Check if user already exists
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    throw new AppError('User with this email already exists', 409, true, 'USER_EXISTS');
  }

  // Create new user
  const userData: Partial<IUser> = {
    email,
    password,
    firstName,
    lastName,
    dateOfBirth: new Date(dateOfBirth),
    gender,
    phoneNumber,
    accountType: accountType || 'seeker',
    location: location || { country: 'Nigeria' }
  };

  const user = new User(userData);
  await user.save();

  // Create empty profile
  const profile = new Profile({ userId: user._id });
  await profile.save();

  // Generate email verification token
  const verificationToken = generateEmailVerificationToken((user._id as any).toString(), user.email);

  // Send welcome and verification emails
  try {
    await Promise.all([
      sendWelcomeEmail(user.email, user.firstName, user.lastName),
      sendVerificationEmail(user.email, user.firstName, verificationToken)
    ]);
  } catch (emailError) {
    logger.error('Failed to send registration emails:', emailError);
    // Don't fail registration if email fails
  }

  // Generate tokens
  const tokenPair = await generateTokenPair({
    userId: (user._id as any).toString(),
    email: user.email,
    accountType: user.accountType,
    isEmailVerified: user.isEmailVerified
  });

  // Clear any rate limiting for this IP
  await clearAuthRateLimit(req);

  // Log successful registration
  logHelpers.authEvent('user_registered', (user._id as any).toString(), req.ip, {
    email: user.email,
    accountType: user.accountType
  });

  res.status(201).json({
    success: true,
    message: 'User registered successfully',
    data: {
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        accountType: user.accountType,
        isEmailVerified: user.isEmailVerified,
        profileCompletionScore: user.profileCompletionScore
      },
      tokens: tokenPair
    }
  });
});

/**
 * Login user
 */
export const login = catchAsync(async (req: Request, res: Response, _next: NextFunction) => {
  const { email, password, rememberMe } = req.body;

  // Find user and include password for comparison
  const user = await User.findOne({ email }).select('+password');
  
  if (!user || !(await user.comparePassword(password))) {
    logHelpers.authEvent('login_failed', undefined, req.ip, { email });
    throw new AppError('Invalid email or password', 401, true, 'INVALID_CREDENTIALS');
  }

  // Check if account is active
  if (!user.isActive) {
    throw new AppError('Account has been deactivated', 401, true, 'ACCOUNT_DEACTIVATED');
  }

  // Update last login
  user.lastLoginAt = new Date();
  user.lastActiveAt = new Date();
  await user.save();

  // Generate tokens (longer expiry if remember me)
  const tokenPair = await generateTokenPair({
    userId: (user._id as any).toString(),
    email: user.email,
    accountType: user.accountType,
    isEmailVerified: user.isEmailVerified
  });

  // Clear any rate limiting for this IP
  await clearAuthRateLimit(req);

  // Log successful login
  logHelpers.authEvent('login_success', (user._id as any).toString(), req.ip, {
    email: user.email,
    rememberMe
  });

  res.json({
    success: true,
    message: 'Login successful',
    data: {
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        accountType: user.accountType,
        isEmailVerified: user.isEmailVerified,
        profileCompletionScore: user.profileCompletionScore,
        lastLoginAt: user.lastLoginAt
      },
      tokens: tokenPair
    }
  });
});

/**
 * Refresh access token
 */
export const refreshToken = catchAsync(async (req: Request, res: Response, _next: NextFunction) => {
  const { refreshToken } = req.body;

  // Verify refresh token
  const payload = await verifyRefreshToken(refreshToken);

  // Get user
  const user = await User.findById(payload.userId);
  if (!user || !user.isActive) {
    throw new AppError('User not found or inactive', 401, true, 'USER_NOT_FOUND');
  }

  // Revoke old refresh token
  await revokeRefreshToken(refreshToken);

  // Generate new token pair
  const tokenPair = await generateTokenPair({
    userId: (user._id as any).toString(),
    email: user.email,
    accountType: user.accountType,
    isEmailVerified: user.isEmailVerified
  });

  logHelpers.authEvent('token_refreshed', (user._id as any).toString(), req.ip);

  res.json({
    success: true,
    message: 'Token refreshed successfully',
    data: {
      tokens: tokenPair
    }
  });
});

/**
 * Logout user
 */
export const logout = catchAsync(async (req: Request, res: Response, _next: NextFunction) => {
  const { refreshToken } = req.body;

  if (refreshToken) {
    try {
      await revokeRefreshToken(refreshToken);
    } catch (error) {
      // Log but don't fail logout
      logger.warn('Failed to revoke refresh token during logout:', error);
    }
  }

  if (req.user) {
    logHelpers.authEvent('logout', req.user.userId, req.ip);
  }

  res.json({
    success: true,
    message: 'Logged out successfully'
  });
});

/**
 * Logout from all devices
 */
export const logoutAll = catchAsync(async (req: Request, res: Response, _next: NextFunction) => {
  if (!req.user) {
    throw new AppError('Authentication required', 401, true, 'AUTH_REQUIRED');
  }

  // Revoke all refresh tokens
  await revokeAllRefreshTokens(req.user.userId);

  logHelpers.authEvent('logout_all', req.user.userId, req.ip);

  res.json({
    success: true,
    message: 'Logged out from all devices successfully'
  });
});

/**
 * Send email verification
 */
export const sendEmailVerification = catchAsync(async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
  const { email } = req.body;

  const user = await User.findOne({ email });
  if (!user) {
    // Don't reveal if email exists
    res.json({
      success: true,
      message: 'If the email exists, a verification link has been sent'
    });
    return;
  }

  if (user.isEmailVerified) {
    throw new AppError('Email is already verified', 400, true, 'EMAIL_ALREADY_VERIFIED');
  }

  // Generate verification token
  const verificationToken = generateEmailVerificationToken((user._id as any).toString(), user.email);

  // Send verification email
  try {
    await sendVerificationEmail(user.email, user.firstName, verificationToken);
  } catch (emailError) {
    logger.error('Failed to send verification email:', emailError);
    throw new AppError('Failed to send verification email', 500, true, 'EMAIL_SEND_FAILED');
  }

  logHelpers.authEvent('verification_email_sent', (user._id as any).toString(), req.ip);

  res.json({
    success: true,
    message: 'Verification email sent successfully'
  });
});

/**
 * Verify email
 */
export const verifyEmail = catchAsync(async (req: Request, res: Response, _next: NextFunction) => {
  const { token } = req.body;

  // Verify token
  const { userId, email } = verifyEmailVerificationToken(token);

  // Find and update user
  const user = await User.findById(userId);
  if (!user || user.email !== email) {
    throw new AppError('Invalid verification token', 400, true, 'INVALID_TOKEN');
  }

  if (user.isEmailVerified) {
    throw new AppError('Email is already verified', 400, true, 'EMAIL_ALREADY_VERIFIED');
  }

  // Update user
  user.isEmailVerified = true;
  await user.save();

  logHelpers.authEvent('email_verified', (user._id as any).toString(), req.ip);

  res.json({
    success: true,
    message: 'Email verified successfully',
    data: {
      user: {
        id: user._id,
        email: user.email,
        isEmailVerified: user.isEmailVerified,
        profileCompletionScore: user.profileCompletionScore
      }
    }
  });
});

/**
 * Forgot password
 */
export const forgotPassword = catchAsync(async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
  const { email } = req.body;

  const user = await User.findOne({ email });
  if (!user) {
    // Don't reveal if email exists
    res.json({
      success: true,
      message: 'If the email exists, a password reset link has been sent'
    });
    return;
  }

  // Generate reset token
  const resetToken = generatePasswordResetToken((user._id as any).toString(), user.email);

  // Send reset email
  try {
    await sendPasswordResetEmail(user.email, user.firstName, resetToken);
  } catch (emailError) {
    logger.error('Failed to send password reset email:', emailError);
    throw new AppError('Failed to send password reset email', 500, true, 'EMAIL_SEND_FAILED');
  }

  logHelpers.authEvent('password_reset_requested', (user._id as any).toString(), req.ip);

  res.json({
    success: true,
    message: 'Password reset email sent successfully'
  });
});

/**
 * Reset password
 */
export const resetPassword = catchAsync(async (req: Request, res: Response, _next: NextFunction) => {
  const { token, password } = req.body;

  // Verify reset token
  const { userId, email } = verifyPasswordResetToken(token);

  // Find user
  const user = await User.findById(userId);
  if (!user || user.email !== email) {
    throw new AppError('Invalid or expired reset token', 400, true, 'INVALID_TOKEN');
  }

  // Update password
  user.password = password;
  await user.save();

  // Revoke all refresh tokens for security
  await revokeAllRefreshTokens((user._id as any).toString());

  // Send confirmation email
  try {
    await sendPasswordChangedEmail(user.email, user.firstName);
  } catch (emailError) {
    logger.error('Failed to send password changed email:', emailError);
    // Don't fail the password reset
  }

  logHelpers.authEvent('password_reset_completed', (user._id as any).toString(), req.ip);

  res.json({
    success: true,
    message: 'Password reset successfully'
  });
});

/**
 * Change password (authenticated user)
 */
export const changePassword = catchAsync(async (req: Request, res: Response, _next: NextFunction) => {
  if (!req.user) {
    throw new AppError('Authentication required', 401, true, 'AUTH_REQUIRED');
  }

  const { currentPassword, newPassword } = req.body;

  // Get user with password
  const user = await User.findById(req.user.userId).select('+password');
  if (!user) {
    throw new AppError('User not found', 404, true, 'USER_NOT_FOUND');
  }

  // Verify current password
  if (!(await user.comparePassword(currentPassword))) {
    throw new AppError('Current password is incorrect', 400, true, 'INVALID_CURRENT_PASSWORD');
  }

  // Update password
  user.password = newPassword;
  await user.save();

  // Revoke all refresh tokens except current session
  await revokeAllRefreshTokens((user._id as any).toString());

  // Send confirmation email
  try {
    await sendPasswordChangedEmail(user.email, user.firstName);
  } catch (emailError) {
    logger.error('Failed to send password changed email:', emailError);
  }

  logHelpers.authEvent('password_changed', (user._id as any).toString(), req.ip);

  res.json({
    success: true,
    message: 'Password changed successfully'
  });
});

/**
 * Get current user profile
 */
export const getProfile = catchAsync(async (req: Request, res: Response, _next: NextFunction) => {
  if (!req.user) {
    throw new AppError('Authentication required', 401, true, 'AUTH_REQUIRED');
  }

  const user = await User.findById(req.user.userId).populate('profile');
  if (!user) {
    throw new AppError('User not found', 404, true, 'USER_NOT_FOUND');
  }

  res.json({
    success: true,
    data: {
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        dateOfBirth: user.dateOfBirth,
        gender: user.gender,
        phoneNumber: user.phoneNumber,
        accountType: user.accountType,
        isEmailVerified: user.isEmailVerified,
        isPhoneVerified: user.isPhoneVerified,
        profileCompletionScore: user.profileCompletionScore,
        location: user.location,
        preferences: user.preferences,
        lastLoginAt: user.lastLoginAt,
        createdAt: user.createdAt
      }
    }
  });
});

/**
 * Update user profile
 */
export const updateProfile = catchAsync(async (req: Request, res: Response, _next: NextFunction) => {
  if (!req.user) {
    throw new AppError('Authentication required', 401, true, 'AUTH_REQUIRED');
  }

  const { firstName, lastName, phoneNumber, location, preferences } = req.body;

  const user = await User.findById(req.user.userId);
  if (!user) {
    throw new AppError('User not found', 404, true, 'USER_NOT_FOUND');
  }

  // Update allowed fields
  if (firstName !== undefined) user.firstName = firstName;
  if (lastName !== undefined) user.lastName = lastName;
  if (phoneNumber !== undefined) user.phoneNumber = phoneNumber;
  if (location !== undefined) user.location = { ...user.location, ...location };
  if (preferences !== undefined) user.preferences = { ...user.preferences, ...preferences };

  await user.save();

  logHelpers.userAction((user._id as any).toString(), 'profile_updated', { updatedFields: Object.keys(req.body) });

  res.json({
    success: true,
    message: 'Profile updated successfully',
    data: {
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        phoneNumber: user.phoneNumber,
        accountType: user.accountType,
        isEmailVerified: user.isEmailVerified,
        profileCompletionScore: user.profileCompletionScore,
        location: user.location,
        preferences: user.preferences
      }
    }
  });
});

/**
 * Deactivate account
 */
export const deactivateAccount = catchAsync(async (req: Request, res: Response, _next: NextFunction) => {
  if (!req.user) {
    throw new AppError('Authentication required', 401, true, 'AUTH_REQUIRED');
  }

  const user = await User.findById(req.user.userId);
  if (!user) {
    throw new AppError('User not found', 404, true, 'USER_NOT_FOUND');
  }

  // Deactivate account
  user.isActive = false;
  await user.save();

  // Revoke all refresh tokens
  await revokeAllRefreshTokens((user._id as any).toString());

  logHelpers.authEvent('account_deactivated', (user._id as any).toString(), req.ip);

  res.json({
    success: true,
    message: 'Account deactivated successfully'
  });
});

export default {
  register,
  login,
  refreshToken,
  logout,
  logoutAll,
  sendEmailVerification,
  verifyEmail,
  forgotPassword,
  resetPassword,
  changePassword,
  getProfile,
  updateProfile,
  deactivateAccount
};
