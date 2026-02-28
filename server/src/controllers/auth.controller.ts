import crypto from 'node:crypto';
import type { Request, Response } from 'express';
import { COOKIE_MAX_AGE, COOKIE_NAMES } from '../config/constants.js';
import { env } from '../config/env.js';
import { HttpError } from '../utils/httpError.js';
import { AuthService } from '../services/auth.service.js';

const isProd = env.nodeEnv === 'production';

const buildCookieOptions = (maxAge: number) => ({
  httpOnly: true,
  secure: isProd,
  sameSite: 'lax' as const,
  signed: true,
  maxAge
});

const clearCookieOptions = {
  httpOnly: true,
  secure: isProd,
  sameSite: 'lax' as const,
  signed: true
};

export class AuthController {
  static login(_req: Request, res: Response): void {
    const state = crypto.randomBytes(24).toString('hex');

    res.cookie(COOKIE_NAMES.spotifyState, state, buildCookieOptions(COOKIE_MAX_AGE.stateMs));
    res.redirect(AuthService.buildSpotifyAuthorizeUrl(state));
  }

  static async callback(req: Request, res: Response): Promise<void> {
    const code = req.query.code;
    const state = req.query.state;
    const expectedState = req.signedCookies?.[COOKIE_NAMES.spotifyState] as string | undefined;

    if (typeof code !== 'string' || typeof state !== 'string') {
      throw new HttpError(400, 'Invalid Spotify callback parameters');
    }

    if (!expectedState || expectedState !== state) {
      throw new HttpError(400, 'OAuth state mismatch');
    }

    const tokenResult = await AuthService.exchangeCodeForTokens(code);

    if (!tokenResult.refresh_token) {
      throw new HttpError(400, 'Missing refresh token from Spotify');
    }

    const spotifyProfile = await AuthService.fetchCurrentSpotifyUser(tokenResult.access_token);

    const user = await AuthService.upsertUserTokens({
      spotifyId: spotifyProfile.id,
      accessToken: tokenResult.access_token,
      refreshToken: tokenResult.refresh_token,
      expiresIn: tokenResult.expires_in
    });

    res.clearCookie(COOKIE_NAMES.spotifyState, clearCookieOptions);
    res.cookie(COOKIE_NAMES.session, user.id, buildCookieOptions(COOKIE_MAX_AGE.sessionMs));

    res.redirect(`${env.clientUrl}/`);
  }

  static me(req: Request, res: Response): void {
    if (!req.user) {
      throw new HttpError(401, 'Unauthorized');
    }

    res.json({
      success: true,
      data: {
        id: req.user.id,
        spotifyId: req.user.spotifyId,
        createdAt: req.user.createdAt
      }
    });
  }

  static logout(_req: Request, res: Response): void {
    res.clearCookie(COOKIE_NAMES.session, clearCookieOptions);
    res.clearCookie(COOKIE_NAMES.spotifyState, clearCookieOptions);
    res.json({ success: true });
  }
}
