import { Router } from 'express';
import {
  addToFavorites,
  removeFromFavorites,
  getUserFavorites,
  checkFavoriteStatus,
  getFavoritesCount,
  getPopularProperties,
  bulkUpdateFavorites
} from '../controllers/propertyFavorite.controller';
import { authenticate } from '../middleware/auth';
import { validateRequest, validateObjectId } from '../middleware/validation';
import { favoritePropertySchema } from '../validators/property.validators';

const router = Router();

// Public routes
router.get('/popular', getPopularProperties);

// Protected routes (authentication required)
router.use(authenticate);

// Favorite management
router.post('/add', validateRequest(favoritePropertySchema), addToFavorites);
router.delete('/:propertyId', validateObjectId('propertyId'), removeFromFavorites);

// User favorites
router.get('/', getUserFavorites);
router.get('/count', getFavoritesCount);

// Check favorite status
router.get('/:propertyId/status', validateObjectId('propertyId'), checkFavoriteStatus);

// Bulk operations
router.post('/bulk', bulkUpdateFavorites);

export default router;
