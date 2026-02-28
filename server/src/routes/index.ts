import { Router } from 'express';
import healthRoutes from './health.routes.js';
import authRoutes from './auth.routes.js';
import autoCleanerRoutes from './autoCleaner.routes.js';
import moodBuilderRoutes from './moodBuilder.routes.js';
import timeBuilderRoutes from './timeBuilder.routes.js';

const router = Router();

router.use('/health', healthRoutes);
router.use('/auth', authRoutes);
router.use('/auto-cleaner', autoCleanerRoutes);
router.use('/mood-builder', moodBuilderRoutes);
router.use('/time-builder', timeBuilderRoutes);

export default router;
