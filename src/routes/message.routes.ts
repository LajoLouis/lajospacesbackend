import { Router } from 'express';

const router = Router();

// Placeholder routes - will be implemented in Phase 2
router.get('/health', (_req, res) => {
  res.json({ message: 'Message routes working', timestamp: new Date().toISOString() });
});

export default router;
