import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

router.get('/login', AuthController.login);
router.get('/callback', asyncHandler(AuthController.callback));
router.get('/me', requireAuth, AuthController.me);
router.post('/logout', AuthController.logout);

export default router;
