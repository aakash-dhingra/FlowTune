import { Router } from 'express';
import { AutoCleanerController } from '../controllers/autoCleaner.controller.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { spotifyTokenRefresh } from '../middleware/spotifyTokenRefresh.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

router.post('/analyze', requireAuth, spotifyTokenRefresh, asyncHandler(AutoCleanerController.analyze));
router.post(
  '/create-playlist',
  requireAuth,
  spotifyTokenRefresh,
  asyncHandler(AutoCleanerController.createPlaylist)
);
router.post(
  '/remove-duplicates',
  requireAuth,
  spotifyTokenRefresh,
  asyncHandler(AutoCleanerController.removeDuplicates)
);
router.post(
  '/archive-low-played',
  requireAuth,
  spotifyTokenRefresh,
  asyncHandler(AutoCleanerController.archiveLowPlayed)
);

export default router;
