import type { Request, Response } from 'express';
import { HttpError } from '../utils/httpError.js';
import { AutoCleanerService } from '../services/autoCleaner.service.js';

type GroupName = 'High Energy' | 'Chill' | 'Emotional' | 'Mixed';

const isGroupName = (value: unknown): value is GroupName => {
  return ['High Energy', 'Chill', 'Emotional', 'Mixed'].includes(String(value));
};

export class AutoCleanerController {
  static async analyze(req: Request, res: Response): Promise<void> {
    if (!req.user) {
      throw new HttpError(401, 'Unauthorized');
    }

    const data = await AutoCleanerService.analyze(req.user);
    res.json({ success: true, data });
  }

  static async createPlaylist(req: Request, res: Response): Promise<void> {
    if (!req.user) {
      throw new HttpError(401, 'Unauthorized');
    }

    const groupName = req.body?.groupName;
    const customName = req.body?.playlistName;

    if (!isGroupName(groupName)) {
      throw new HttpError(400, 'Invalid groupName. Use High Energy, Chill, Emotional, or Mixed.');
    }

    const data = await AutoCleanerService.createPlaylistFromGroup({
      user: req.user,
      groupName,
      customName: typeof customName === 'string' ? customName : undefined
    });

    res.json({ success: true, data });
  }

  static async removeDuplicates(req: Request, res: Response): Promise<void> {
    if (!req.user) {
      throw new HttpError(401, 'Unauthorized');
    }

    const data = await AutoCleanerService.removeDuplicates(req.user);
    res.json({ success: true, data });
  }

  static async archiveLowPlayed(req: Request, res: Response): Promise<void> {
    if (!req.user) {
      throw new HttpError(401, 'Unauthorized');
    }

    const thresholdRaw = req.body?.popularityThreshold;
    const parsedThreshold = Number.isFinite(Number(thresholdRaw)) ? Number(thresholdRaw) : 35;
    const popularityThreshold = Math.max(0, Math.min(100, parsedThreshold));

    const data = await AutoCleanerService.archiveLowPlayed(req.user, popularityThreshold);
    res.json({ success: true, data });
  }
}
