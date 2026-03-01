import { Router } from 'express';
import { requireAuth } from '../middleware/requireAuth.js';
import { analyzeTimeMachine, createTimeMachinePlaylist } from '../controllers/timeMachine.controller.js';

const router = Router();

router.use(requireAuth);

router.get('/analyze', analyzeTimeMachine);
router.post('/create-playlist', createTimeMachinePlaylist);

export default router;
