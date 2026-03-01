import { Request, Response } from 'express';
import { RecommendationEngine } from '../services/recommendation.engine.js';
import type { User } from '@prisma/client';

export const getRecommendations = async (req: Request, res: Response) => {
    try {
        const user = (req as any).user as User;

        if (!user) {
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }

        const recommendations = await RecommendationEngine.getRecommendations(user);

        return res.status(200).json({
            success: true,
            data: recommendations
        });
    } catch (error) {
        console.error('[RecommendationController] Error generating recommendations:', error instanceof Error ? error.message : error);
        return res.status(500).json({
            success: false,
            error: 'Failed to generate recommendations'
        });
    }
};
