import type { Request, Response, NextFunction } from 'express';
import { logger } from '../config/logger.js';
import { HttpError } from '../utils/httpError.js';

export const errorHandler = (
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  const statusCode = err instanceof HttpError ? err.statusCode : 500;
  const message = err.message || 'Internal server error';

  logger.error({ err, statusCode, stack: err.stack }, message);
  console.error('Full error:', err);

  res.status(statusCode).json({
    success: false,
    message
  });
};
