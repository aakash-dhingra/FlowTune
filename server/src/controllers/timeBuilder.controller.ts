import type { Request, Response } from 'express';

export class TimeBuilderController {
  static async generate(_req: Request, res: Response): Promise<void> {
    res.status(501).json({
      success: false,
      message: 'Time-Based Playlist Builder not implemented yet. Scheduled for next phase.'
    });
  }
}
