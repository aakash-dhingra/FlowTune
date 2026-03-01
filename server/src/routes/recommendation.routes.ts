import { Router } from 'express';
import { getRecommendations } from '../controllers/recommendation.controller.js';
import { requireAuth } from '../middleware/requireAuth.js';

const router = Router();

// Protect all routes with auth middleware
router.use(requireAuth);

router.get('/', getRecommendations);

export default router;
