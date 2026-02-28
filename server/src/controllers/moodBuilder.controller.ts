import type { Request, Response } from 'express';

export class MoodBuilderController {
  static async generate(_req: Request, res: Response): Promise<void> {
    res.status(501).json({
      success: false,
      message: 'Mood Playlist Builder not implemented yet. Scheduled for next phase.'
    });
  }
}
