import type { NextFunction, Request, Response } from 'express';
import { HttpError } from '../utils/httpError.js';

export const requireAuth = (req: Request, _res: Response, next: NextFunction): void => {
  if (!req.user) {
    return next(new HttpError(401, 'Unauthorized'));
  }

  next();
};
