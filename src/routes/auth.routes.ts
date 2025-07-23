import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { validateRequest } from '../validators/auth.validators';
import {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
  verifyEmailSchema,
  resendVerificationSchema,
  refreshTokenSchema,
  updateProfileSchema
} from '../validators/auth.validators';
import {
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
} from '../controllers/auth.controller';

const router = Router();

// Health check
router.get('/health', (_req, res) => {
  res.json({
    message: 'Auth routes working',
    timestamp: new Date().toISOString(),
    endpoints: {
      register: 'POST /register',
      login: 'POST /login',
      refresh: 'POST /refresh',
      logout: 'POST /logout',
      profile: 'GET /profile'
    }
  });
});

// Public routes (no authentication required) - temporarily without rate limiting
router.post('/register',
  // authRateLimit(5, 15 * 60 * 1000), // 5 attempts per 15 minutes
  validateRequest(registerSchema),
  register
);

router.post('/login',
  // authRateLimit(5, 15 * 60 * 1000), // 5 attempts per 15 minutes
  validateRequest(loginSchema),
  login
);

router.post('/refresh',
  // authRateLimit(10, 15 * 60 * 1000), // 10 attempts per 15 minutes
  validateRequest(refreshTokenSchema),
  refreshToken
);

router.post('/forgot-password',
  // authRateLimit(3, 15 * 60 * 1000), // 3 attempts per 15 minutes
  validateRequest(forgotPasswordSchema),
  forgotPassword
);

router.post('/reset-password',
  // authRateLimit(5, 15 * 60 * 1000), // 5 attempts per 15 minutes
  validateRequest(resetPasswordSchema),
  resetPassword
);

router.post('/verify-email',
  validateRequest(verifyEmailSchema),
  verifyEmail
);

router.post('/resend-verification',
  // authRateLimit(3, 15 * 60 * 1000), // 3 attempts per 15 minutes
  validateRequest(resendVerificationSchema),
  sendEmailVerification
);

// Protected routes (authentication required)
router.use(authenticate); // All routes below require authentication

router.post('/logout', logout);

router.post('/logout-all', logoutAll);

router.post('/change-password',
  validateRequest(changePasswordSchema),
  changePassword
);

router.get('/profile', getProfile);

router.patch('/profile',
  validateRequest(updateProfileSchema),
  updateProfile
);

router.delete('/deactivate', deactivateAccount);

export default router;
