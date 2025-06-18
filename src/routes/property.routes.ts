import { Router } from 'express';
import {
  createProperty,
  getProperties,
  getProperty,
  updateProperty,
  deleteProperty,
  getOwnerProperties,
  publishProperty,
  getPropertyAnalytics,
  getPropertySuggestions,
  healthCheck
} from '../controllers/property.controller';
import { authenticate } from '../middleware/auth';
import { validateRequest, validateObjectId } from '../middleware/validation';
import {
  createPropertySchema,
  updatePropertySchema,
  propertyQuerySchema
} from '../validators/property.validators';

const router = Router();

/**
 * @route   GET /api/properties/health
 * @desc    Health check for property service
 * @access  Public
 */
router.get('/health', healthCheck);

/**
 * @route   GET /api/properties
 * @desc    Get all properties with filtering and pagination
 * @access  Public
 */
router.get(
  '/',
  validateRequest(propertyQuerySchema, 'query'),
  getProperties
);

/**
 * @route   GET /api/properties/owner
 * @desc    Get properties owned by the authenticated user
 * @access  Private
 */
router.get(
  '/owner',
  authenticate,
  getOwnerProperties
);

/**
 * @route   GET /api/properties/suggestions
 * @desc    Get property suggestions for the authenticated user
 * @access  Private
 */
router.get(
  '/suggestions',
  authenticate,
  getPropertySuggestions
);

/**
 * @route   POST /api/properties
 * @desc    Create a new property listing
 * @access  Private (Property owners only)
 */
router.post(
  '/',
  authenticate,
  validateRequest(createPropertySchema, 'body'),
  createProperty
);

/**
 * @route   GET /api/properties/:id
 * @desc    Get a specific property by ID
 * @access  Public
 */
router.get(
  '/:id',
  validateObjectId('id'),
  getProperty
);

/**
 * @route   PUT /api/properties/:id
 * @desc    Update a property listing
 * @access  Private (Property owner only)
 */
router.put(
  '/:id',
  authenticate,
  validateObjectId('id'),
  validateRequest(updatePropertySchema, 'body'),
  updateProperty
);

/**
 * @route   DELETE /api/properties/:id
 * @desc    Delete a property listing
 * @access  Private (Property owner only)
 */
router.delete(
  '/:id',
  authenticate,
  validateObjectId('id'),
  deleteProperty
);

/**
 * @route   POST /api/properties/:id/publish
 * @desc    Publish a draft property
 * @access  Private (Property owner only)
 */
router.post(
  '/:id/publish',
  authenticate,
  validateObjectId('id'),
  publishProperty
);

/**
 * @route   GET /api/properties/:id/analytics
 * @desc    Get analytics for a specific property
 * @access  Private (Property owner only)
 */
router.get(
  '/:id/analytics',
  authenticate,
  validateObjectId('id'),
  getPropertyAnalytics
);

export default router;
