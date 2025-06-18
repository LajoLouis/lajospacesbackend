import jwt, { SignOptions } from 'jsonwebtoken';
import crypto from 'crypto';
import { config } from '../config/environment';
import { redisUtils, redisKeys } from '../config/redis';
import { logger } from './logger';

// JWT payload interface
export interface JWTPayload {
  userId: string;
  email: string;
  accountType: 'seeker' | 'owner' | 'both';
  isEmailVerified: boolean;
  iat?: number;
  exp?: number;
}

// Refresh token payload interface
export interface RefreshTokenPayload {
  userId: string;
  tokenId: string;
  iat?: number;
  exp?: number;
}

// Token pair interface
export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  refreshExpiresIn: number;
}

/**
 * Generate access token
 */
export function generateAccessToken(payload: Omit<JWTPayload, 'iat' | 'exp'>): string {
  try {
    const signOptions: SignOptions = {
      expiresIn: config.JWT_EXPIRES_IN as any,
      issuer: 'lajospaces',
      audience: 'lajospaces-users'
    };

    const token = jwt.sign(payload, config.JWT_SECRET, signOptions);

    logger.info(`Access token generated for user: ${payload.userId}`);
    return token;
  } catch (error) {
    logger.error('Error generating access token:', error);
    throw new Error('Failed to generate access token');
  }
}

/**
 * Generate refresh token
 */
export function generateRefreshToken(userId: string): string {
  try {
    const tokenId = crypto.randomUUID();
    
    const payload: Omit<RefreshTokenPayload, 'iat' | 'exp'> = {
      userId,
      tokenId
    };

    const signOptions: SignOptions = {
      expiresIn: config.JWT_REFRESH_EXPIRES_IN as any,
      issuer: 'lajospaces',
      audience: 'lajospaces-refresh'
    };

    const token = jwt.sign(payload, config.JWT_REFRESH_SECRET, signOptions);

    logger.info(`Refresh token generated for user: ${userId}`);
    return token;
  } catch (error) {
    logger.error('Error generating refresh token:', error);
    throw new Error('Failed to generate refresh token');
  }
}

/**
 * Generate token pair (access + refresh)
 */
export async function generateTokenPair(payload: Omit<JWTPayload, 'iat' | 'exp'>): Promise<TokenPair> {
  try {
    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload.userId);

    // Store refresh token in Redis
    const refreshPayload = jwt.decode(refreshToken) as RefreshTokenPayload;
    const refreshKey = redisKeys.refreshToken(refreshPayload.tokenId);
    const refreshExpiresIn = getTokenExpirationTime(config.JWT_REFRESH_EXPIRES_IN);
    
    await redisUtils.set(refreshKey, payload.userId, refreshExpiresIn);

    // Store in user's refresh token list (for revocation)
    const userTokensKey = redisKeys.userSockets(payload.userId);
    await redisUtils.sadd(userTokensKey, refreshPayload.tokenId);
    await redisUtils.expire(userTokensKey, refreshExpiresIn);

    const accessExpiresIn = getTokenExpirationTime(config.JWT_EXPIRES_IN);

    logger.info(`Token pair generated for user: ${payload.userId}`);

    return {
      accessToken,
      refreshToken,
      expiresIn: accessExpiresIn,
      refreshExpiresIn
    };
  } catch (error) {
    logger.error('Error generating token pair:', error);
    throw new Error('Failed to generate token pair');
  }
}

/**
 * Verify access token
 */
export function verifyAccessToken(token: string): JWTPayload {
  try {
    const payload = jwt.verify(token, config.JWT_SECRET, {
      issuer: 'lajospaces',
      audience: 'lajospaces-users'
    }) as JWTPayload;

    return payload;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new Error('Access token expired');
    } else if (error instanceof jwt.JsonWebTokenError) {
      throw new Error('Invalid access token');
    } else {
      logger.error('Error verifying access token:', error);
      throw new Error('Token verification failed');
    }
  }
}

/**
 * Verify refresh token
 */
export async function verifyRefreshToken(token: string): Promise<RefreshTokenPayload> {
  try {
    const payload = jwt.verify(token, config.JWT_REFRESH_SECRET, {
      issuer: 'lajospaces',
      audience: 'lajospaces-refresh'
    }) as RefreshTokenPayload;

    // Check if token exists in Redis
    const refreshKey = redisKeys.refreshToken(payload.tokenId);
    const storedUserId = await redisUtils.get(refreshKey);

    if (!storedUserId || storedUserId !== payload.userId) {
      throw new Error('Refresh token revoked or invalid');
    }

    return payload;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new Error('Refresh token expired');
    } else if (error instanceof jwt.JsonWebTokenError) {
      throw new Error('Invalid refresh token');
    } else {
      logger.error('Error verifying refresh token:', error);
      throw new Error('Refresh token verification failed');
    }
  }
}

/**
 * Revoke refresh token
 */
export async function revokeRefreshToken(token: string): Promise<void> {
  try {
    const payload = jwt.decode(token) as RefreshTokenPayload;
    
    if (!payload || !payload.tokenId) {
      throw new Error('Invalid token format');
    }

    // Remove from Redis
    const refreshKey = redisKeys.refreshToken(payload.tokenId);
    await redisUtils.del(refreshKey);

    // Remove from user's token list
    const userTokensKey = redisKeys.userSockets(payload.userId);
    await redisUtils.srem(userTokensKey, payload.tokenId);

    logger.info(`Refresh token revoked for user: ${payload.userId}`);
  } catch (error) {
    logger.error('Error revoking refresh token:', error);
    throw new Error('Failed to revoke refresh token');
  }
}

/**
 * Revoke all refresh tokens for a user
 */
export async function revokeAllRefreshTokens(userId: string): Promise<void> {
  try {
    const userTokensKey = redisKeys.userSockets(userId);
    const tokenIds = await redisUtils.smembers(userTokensKey);

    // Remove all refresh tokens
    for (const tokenId of tokenIds) {
      const refreshKey = redisKeys.refreshToken(tokenId);
      await redisUtils.del(refreshKey);
    }

    // Clear user's token list
    await redisUtils.del(userTokensKey);

    logger.info(`All refresh tokens revoked for user: ${userId}`);
  } catch (error) {
    logger.error('Error revoking all refresh tokens:', error);
    throw new Error('Failed to revoke all refresh tokens');
  }
}

/**
 * Generate password reset token
 */
export function generatePasswordResetToken(userId: string, email: string): string {
  try {
    const payload = {
      userId,
      email,
      type: 'password-reset'
    };

    const token = jwt.sign(payload, config.PASSWORD_RESET_SECRET, {
      expiresIn: '1h',
      issuer: 'lajospaces',
      audience: 'lajospaces-reset'
    });

    logger.info(`Password reset token generated for user: ${userId}`);
    return token;
  } catch (error) {
    logger.error('Error generating password reset token:', error);
    throw new Error('Failed to generate password reset token');
  }
}

/**
 * Verify password reset token
 */
export function verifyPasswordResetToken(token: string): { userId: string; email: string } {
  try {
    const payload = jwt.verify(token, config.PASSWORD_RESET_SECRET, {
      issuer: 'lajospaces',
      audience: 'lajospaces-reset'
    }) as any;

    if (payload.type !== 'password-reset') {
      throw new Error('Invalid token type');
    }

    return {
      userId: payload.userId,
      email: payload.email
    };
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new Error('Password reset token expired');
    } else if (error instanceof jwt.JsonWebTokenError) {
      throw new Error('Invalid password reset token');
    } else {
      logger.error('Error verifying password reset token:', error);
      throw new Error('Password reset token verification failed');
    }
  }
}

/**
 * Generate email verification token
 */
export function generateEmailVerificationToken(userId: string, email: string): string {
  try {
    const payload = {
      userId,
      email,
      type: 'email-verification'
    };

    const token = jwt.sign(payload, config.JWT_SECRET, {
      expiresIn: '24h',
      issuer: 'lajospaces',
      audience: 'lajospaces-verify'
    });

    logger.info(`Email verification token generated for user: ${userId}`);
    return token;
  } catch (error) {
    logger.error('Error generating email verification token:', error);
    throw new Error('Failed to generate email verification token');
  }
}

/**
 * Verify email verification token
 */
export function verifyEmailVerificationToken(token: string): { userId: string; email: string } {
  try {
    const payload = jwt.verify(token, config.JWT_SECRET, {
      issuer: 'lajospaces',
      audience: 'lajospaces-verify'
    }) as any;

    if (payload.type !== 'email-verification') {
      throw new Error('Invalid token type');
    }

    return {
      userId: payload.userId,
      email: payload.email
    };
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new Error('Email verification token expired');
    } else if (error instanceof jwt.JsonWebTokenError) {
      throw new Error('Invalid email verification token');
    } else {
      logger.error('Error verifying email verification token:', error);
      throw new Error('Email verification token verification failed');
    }
  }
}

/**
 * Helper function to convert time string to seconds
 */
function getTokenExpirationTime(timeString: string): number {
  const timeValue = parseInt(timeString.slice(0, -1));
  const timeUnit = timeString.slice(-1);

  switch (timeUnit) {
    case 's': return timeValue;
    case 'm': return timeValue * 60;
    case 'h': return timeValue * 60 * 60;
    case 'd': return timeValue * 24 * 60 * 60;
    default: return 900; // 15 minutes default
  }
}

export default {
  generateAccessToken,
  generateRefreshToken,
  generateTokenPair,
  verifyAccessToken,
  verifyRefreshToken,
  revokeRefreshToken,
  revokeAllRefreshTokens,
  generatePasswordResetToken,
  verifyPasswordResetToken,
  generateEmailVerificationToken,
  verifyEmailVerificationToken
};
