import { Router } from 'express';
import { TimeBuilderController } from '../controllers/timeBuilder.controller.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { spotifyTokenRefresh } from '../middleware/spotifyTokenRefresh.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

router.post('/generate', requireAuth, spotifyTokenRefresh, asyncHandler(TimeBuilderController.generate));

export default router;
