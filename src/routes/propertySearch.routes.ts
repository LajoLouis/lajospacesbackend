import { Router } from 'express';
import {
  searchProperties,
  getNearbyProperties,
  getPropertyFilters,
  getSearchSuggestions,
  saveSearch,
  getSavedSearches,
  deleteSavedSearch
} from '../controllers/propertySearch.controller';
import { authenticate } from '../middleware/auth';
import { validateRequest, validateObjectId } from '../middleware/validation';
import {
  searchPropertiesSchema,
  nearbyPropertiesSchema,
  saveSearchSchema
} from '../validators/propertySearch.validators';

const router = Router();

/**
 * @route   POST /api/properties/search
 * @desc    Advanced property search with filters
 * @access  Public
 */
router.post(
  '/search',
  validateRequest(searchPropertiesSchema, 'body'),
  searchProperties
);

/**
 * @route   GET /api/properties/search/nearby
 * @desc    Find properties near a location
 * @access  Public
 */
router.get(
  '/search/nearby',
  validateRequest(nearbyPropertiesSchema, 'query'),
  getNearbyProperties
);

/**
 * @route   GET /api/properties/search/filters
 * @desc    Get available search filters and their options
 * @access  Public
 */
router.get('/search/filters', getPropertyFilters);

/**
 * @route   GET /api/properties/search/suggestions
 * @desc    Get search suggestions based on query
 * @access  Public
 */
router.get('/search/suggestions', getSearchSuggestions);

/**
 * @route   POST /api/properties/search/save
 * @desc    Save a search query for later
 * @access  Private
 */
router.post(
  '/search/save',
  authenticate,
  validateRequest(saveSearchSchema, 'body'),
  saveSearch
);

/**
 * @route   GET /api/properties/search/saved
 * @desc    Get user's saved searches
 * @access  Private
 */
router.get(
  '/search/saved',
  authenticate,
  getSavedSearches
);

/**
 * @route   DELETE /api/properties/search/saved/:id
 * @desc    Delete a saved search
 * @access  Private
 */
router.delete(
  '/search/saved/:id',
  authenticate,
  validateObjectId('id'),
  deleteSavedSearch
);

export default router;
