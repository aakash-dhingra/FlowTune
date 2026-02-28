import type { NextFunction, Request, Response } from 'express';
import { prisma } from '../config/prisma.js';
import { COOKIE_NAMES } from '../config/constants.js';

export const sessionAuth = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const sessionUserId = req.signedCookies?.[COOKIE_NAMES.session] as string | undefined;

    if (!sessionUserId) {
      return next();
    }

    const user = await prisma.user.findUnique({ where: { id: sessionUserId } });
    if (user) {
      req.user = user;
    }

    next();
  } catch (error) {
    next(error);
  }
};
