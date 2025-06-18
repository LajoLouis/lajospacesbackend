import { Router } from 'express';
import { optionalAuth } from '../middleware/auth';
import {
  searchUsers,
  getSearchSuggestions,
  getPopularFilters
} from '../controllers/search.controller';

const router = Router();

// Health check
router.get('/health', (_req, res) => {
  res.json({ 
    message: 'Search routes working', 
    timestamp: new Date().toISOString(),
    endpoints: {
      searchUsers: 'GET /users',
      getSuggestions: 'GET /suggestions',
      getPopularFilters: 'GET /popular-filters'
    }
  });
});

// Public routes (optional authentication for personalization)
router.get('/users', optionalAuth, searchUsers);

router.get('/suggestions', getSearchSuggestions);

router.get('/popular-filters', getPopularFilters);

export default router;
