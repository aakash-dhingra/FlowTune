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
    try {
      const code = req.query.code;
      const state = req.query.state;
      const expectedState = req.signedCookies?.[COOKIE_NAMES.spotifyState] as string | undefined;

      console.log('Callback received:', { code: !!code, state: !!state, expectedState: !!expectedState });

      if (typeof code !== 'string' || typeof state !== 'string') {
        throw new HttpError(400, 'Invalid Spotify callback parameters');
      }

      if (!expectedState || expectedState !== state) {
        throw new HttpError(400, 'OAuth state mismatch');
      }

      console.log('State validation passed, exchanging code for tokens...');
      const tokenResult = await AuthService.exchangeCodeForTokens(code);

      if (!tokenResult.refresh_token) {
        throw new HttpError(400, 'Missing refresh token from Spotify');
      }

      console.log('Got tokens, fetching Spotify profile...');
      let spotifyProfile: { id: string };
      try {
        spotifyProfile = await AuthService.fetchCurrentSpotifyUser(tokenResult.access_token);
        console.log('Got Spotify profile:', spotifyProfile.id);
      } catch (error) {
        if (error instanceof Error && error.message.includes('Spotify permission denied')) {
          console.warn('[Auth] 403 Forbidden fetching profile on login. Using mock profile.');
          spotifyProfile = { id: `mock_user_${Date.now().toString().slice(-6)}` };
        } else {
          throw error;
        }
      }

      console.log('Upserting user...');
      const user = await AuthService.upsertUserTokens({
        spotifyId: spotifyProfile.id,
        accessToken: tokenResult.access_token,
        refreshToken: tokenResult.refresh_token,
        expiresIn: tokenResult.expires_in
      });
      console.log('User upserted:', user.id);

      res.clearCookie(COOKIE_NAMES.spotifyState, clearCookieOptions);
      res.cookie(COOKIE_NAMES.session, user.id, buildCookieOptions(COOKIE_MAX_AGE.sessionMs));

      console.log('Redirecting to home...');
      res.redirect(`${env.clientUrl}/`);
    } catch (error) {
      console.error('Callback error:', error);
      throw error;
    }
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

  static async tokenInfo(req: Request, res: Response): Promise<void> {
    if (!req.user) {
      throw new HttpError(401, 'Unauthorized');
    }

    const tokenInfo = await AuthService.fetchTokenInfo(req.user.accessToken);
    res.json({ success: true, data: tokenInfo });
  }

  static logout(_req: Request, res: Response): void {
    res.clearCookie(COOKIE_NAMES.session, clearCookieOptions);
    res.clearCookie(COOKIE_NAMES.spotifyState, clearCookieOptions);
    res.json({ success: true });
  }
}
