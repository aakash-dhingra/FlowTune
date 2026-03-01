import type { Request, Response } from 'express';
import { HttpError } from '../utils/httpError.js';
import { AutoCleanerService } from '../services/autoCleaner.service.js';

type GroupName = 'Mainstream Hits' | 'Popular Tracks' | 'Hidden Gems' | 'Underground';

const isGroupName = (value: unknown): value is GroupName => {
  return ['Mainstream Hits', 'Popular Tracks', 'Hidden Gems', 'Underground'].includes(String(value));
};

export class AutoCleanerController {
  static async analyze(req: Request, res: Response): Promise<void> {
    if (!req.user) {
      throw new HttpError(401, 'Unauthorized');
    }

    try {
      const data = await AutoCleanerService.analyze(req.user);
      res.json({ success: true, data });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error during analysis';
      console.error('[AutoCleanerController] Analyze failed:', errorMessage);

      if ((error as any)?.response?.status === 401) {
        throw new HttpError(401, 'Spotify authentication failed. Please login again.');
      }
      if ((error as any)?.response?.status === 403) {
        throw new HttpError(403, 'Spotify permission denied. Please check your app permissions.');
      }
      if ((error as any)?.response?.status >= 500) {
        throw new HttpError(502, 'Spotify API is temporarily unavailable. Please try again.');
      }
      throw new HttpError(500, `Failed to analyze tracks: ${errorMessage}`);
    }
  }

  static async createPlaylist(req: Request, res: Response): Promise<void> {
    if (!req.user) {
      throw new HttpError(401, 'Unauthorized');
    }

    const groupName = req.body?.groupName;
    const customName = req.body?.playlistName;

    if (!isGroupName(groupName)) {
      throw new HttpError(400, 'Invalid groupName. Use Mainstream Hits, Popular Tracks, Hidden Gems, or Underground.');
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
