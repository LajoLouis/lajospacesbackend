import { Router } from 'express';
import { authenticate, optionalAuth } from '../middleware/auth';
import { validateRequest } from '../validators/auth.validators';
import {
  updateProfileSchema,
  privacySettingsSchema,
  housingPreferencesSchema,
  roommatePreferencesSchema,
  userIdParamSchema
} from '../validators/profile.validators';
import {
  getProfile,
  updateProfile,
  getPublicProfile,
  updatePrivacySettings,
  getProfileCompletion,
  deleteProfile
} from '../controllers/profile.controller';

const router = Router();

// Health check
router.get('/health', (_req, res) => {
  res.json({
    message: 'Profile routes working',
    timestamp: new Date().toISOString(),
    endpoints: {
      getProfile: 'GET /',
      updateProfile: 'PATCH /',
      getPublicProfile: 'GET /:userId',
      updatePrivacy: 'PATCH /privacy',
      getCompletion: 'GET /completion'
    }
  });
});

// Public routes (optional authentication)
router.get('/:userId',
  optionalAuth,
  (req, res, next) => {
    const { error } = userIdParamSchema.validate(req.params);
    if (error) {
      res.status(400).json({
        success: false,
        error: {
          message: 'Validation failed',
          code: 'VALIDATION_ERROR',
          details: error.details.map(detail => ({
            field: detail.path.join('.'),
            message: detail.message
          }))
        }
      });
      return;
    }
    next();
  },
  getPublicProfile
);

// Protected routes (authentication required)
router.use(authenticate);

// Get current user's profile
router.get('/', getProfile);

// Update profile
router.patch('/',
  validateRequest(updateProfileSchema),
  updateProfile
);

// Update privacy settings
router.patch('/privacy',
  validateRequest(privacySettingsSchema),
  updatePrivacySettings
);

// Get profile completion status
router.get('/completion', getProfileCompletion);

// Update housing preferences
router.patch('/housing-preferences',
  validateRequest(housingPreferencesSchema),
  updateProfile
);

// Update roommate preferences
router.patch('/roommate-preferences',
  validateRequest(roommatePreferencesSchema),
  updateProfile
);

// Delete profile (soft delete)
router.delete('/', deleteProfile);

export default router;
