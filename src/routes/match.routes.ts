import { Router } from 'express';
import {
  getMatches,
  swipeMatch,
  getMatchHistory,
  getMatchById
} from '../controllers/match.controller';
import {
  getMatchPreferences,
  updateMatchPreferences,
  toggleMatchPreferences,
  updatePreferenceSection,
  addDealBreaker,
  removeDealBreaker,
  getPreferencesSummary
} from '../controllers/matchPreferences.controller';
import { authenticate } from '../middleware/auth';
import { validateRequest, validateObjectId } from '../middleware/validation';
import {
  swipeMatchSchema,
  updatePreferencesSchema,
  togglePreferencesSchema,
  dealBreakerSchema
} from '../validators/match.validators';

const router = Router();

// Health check (public)
router.get('/health', (_req, res) => {
  res.json({ message: 'Match routes working', timestamp: new Date().toISOString() });
});

// All other match routes require authentication
router.use(authenticate);

/**
 * @route   GET /api/matches
 * @desc    Get potential matches for the authenticated user
 * @access  Private
 */
router.get(
  '/',
  getMatches
);

/**
 * @route   POST /api/matches/swipe
 * @desc    Swipe on a match (like, pass, super like)
 * @access  Private
 */
router.post(
  '/swipe',
  validateRequest(swipeMatchSchema, 'body'),
  swipeMatch
);

/**
 * @route   GET /api/matches/history
 * @desc    Get user's match history
 * @access  Private
 */
router.get(
  '/history',
  getMatchHistory
);

/**
 * @route   GET /api/matches/preferences
 * @desc    Get user's match preferences
 * @access  Private
 */
router.get(
  '/preferences',
  getMatchPreferences
);

/**
 * @route   PUT /api/matches/preferences
 * @desc    Update user's match preferences
 * @access  Private
 */
router.put(
  '/preferences',
  validateRequest(updatePreferencesSchema, 'body'),
  updateMatchPreferences
);

/**
 * @route   POST /api/matches/preferences/toggle
 * @desc    Toggle match preferences active status
 * @access  Private
 */
router.post(
  '/preferences/toggle',
  validateRequest(togglePreferencesSchema, 'body'),
  toggleMatchPreferences
);

/**
 * @route   PUT /api/matches/preferences/:section
 * @desc    Update specific preference section
 * @access  Private
 */
router.put(
  '/preferences/:section',
  updatePreferenceSection
);

/**
 * @route   GET /api/matches/preferences/summary
 * @desc    Get match preferences summary/stats
 * @access  Private
 */
router.get(
  '/preferences/summary',
  getPreferencesSummary
);

/**
 * @route   POST /api/matches/preferences/deal-breakers
 * @desc    Add a deal breaker
 * @access  Private
 */
router.post(
  '/preferences/deal-breakers',
  validateRequest(dealBreakerSchema, 'body'),
  addDealBreaker
);

/**
 * @route   DELETE /api/matches/preferences/deal-breakers
 * @desc    Remove a deal breaker
 * @access  Private
 */
router.delete(
  '/preferences/deal-breakers',
  validateRequest(dealBreakerSchema, 'body'),
  removeDealBreaker
);

/**
 * @route   GET /api/matches/:id
 * @desc    Get a specific match by ID
 * @access  Private
 */
router.get(
  '/:id',
  validateObjectId('id'),
  getMatchById
);

export default router;
