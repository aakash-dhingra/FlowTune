import type { NextFunction, Request, Response } from 'express';
import { AuthService } from '../services/auth.service.js';
import { HttpError } from '../utils/httpError.js';

export const spotifyTokenRefresh = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      return next(new HttpError(401, 'Unauthorized'));
    }

    const updated = await AuthService.refreshUserTokenIfNeeded(req.user.id);

    if (!updated) {
      return next(new HttpError(401, 'Unauthorized'));
    }

    req.user = updated;
    next();
  } catch (error) {
    next(error);
  }
};
