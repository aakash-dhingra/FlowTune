import { Router } from 'express';
import { MoodBuilderController } from '../controllers/moodBuilder.controller.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { spotifyTokenRefresh } from '../middleware/spotifyTokenRefresh.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

router.post('/generate', requireAuth, spotifyTokenRefresh, asyncHandler(MoodBuilderController.generate));

export default router;
