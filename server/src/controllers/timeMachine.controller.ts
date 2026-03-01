import type { Request, Response } from 'express';
import { TimeMachineService } from '../services/timeMachine.service.js';

export const analyzeTimeMachine = async (req: Request, res: Response) => {
    try {
        const user = req.user;
        if (!user) {
            return res.status(401).json({ success: false, message: 'Unauthorized' });
        }

        const analysis = await TimeMachineService.analyze(user);
        return res.status(200).json({ success: true, analysis });
    } catch (error) {
        console.error('[TimeMachineController] analyze error:', error);
        return res.status(500).json({ success: false, message: 'Failed to analyze liked tracks by era.' });
    }
};

export const createTimeMachinePlaylist = async (req: Request, res: Response) => {
    try {
        const user = req.user;
        if (!user) {
            return res.status(401).json({ success: false, message: 'Unauthorized' });
        }

        const { year, customName } = req.body;
        if (!year || typeof year !== 'string') {
            return res.status(400).json({ success: false, message: 'Missing or invalid year.' });
        }

        const result = await TimeMachineService.createEraPlaylist({
            user,
            year,
            customName
        });

        return res.status(200).json({ success: true, data: result });
    } catch (error: any) {
        console.error('[TimeMachineController] create playlist error:', error);
        const status = error.status || 500;
        return res.status(status).json({
            success: false,
            message: error.message || 'Failed to create era playlist.'
        });
    }
};
