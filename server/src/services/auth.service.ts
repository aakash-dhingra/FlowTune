import axios from 'axios';
import { prisma } from '../config/prisma.js';
import { env } from '../config/env.js';
import type { SpotifyMeResponse, SpotifyTokenResponse } from '../types/spotify.js';

const SPOTIFY_ACCOUNTS_BASE = 'https://accounts.spotify.com';
const SPOTIFY_API_BASE = 'https://api.spotify.com/v1';

export class AuthService {
  static buildSpotifyAuthorizeUrl(state: string): string {
    const scopes = [
      'user-library-read',
      'playlist-modify-private',
      'playlist-modify-public',
      'user-read-email',
      'user-read-private'
    ].join(' ');

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: env.spotifyClientId,
      scope: scopes,
      redirect_uri: env.spotifyRedirectUri,
      state
    });

    return `${SPOTIFY_ACCOUNTS_BASE}/authorize?${params.toString()}`;
  }

  static async exchangeCodeForTokens(code: string): Promise<SpotifyTokenResponse> {
    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: env.spotifyRedirectUri,
      client_id: env.spotifyClientId,
      client_secret: env.spotifyClientSecret
    });

    const { data } = await axios.post<SpotifyTokenResponse>(
      `${SPOTIFY_ACCOUNTS_BASE}/api/token`,
      params,
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );

    return data;
  }

  static async refreshAccessToken(refreshToken: string): Promise<SpotifyTokenResponse> {
    const params = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: env.spotifyClientId,
      client_secret: env.spotifyClientSecret
    });

    const { data } = await axios.post<SpotifyTokenResponse>(
      `${SPOTIFY_ACCOUNTS_BASE}/api/token`,
      params,
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );

    return data;
  }

  static async fetchCurrentSpotifyUser(accessToken: string): Promise<SpotifyMeResponse> {
    const { data } = await axios.get<SpotifyMeResponse>(`${SPOTIFY_API_BASE}/me`, {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });

    return data;
  }

  static async upsertUserTokens(params: {
    spotifyId: string;
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
  }) {
    const tokenExpiry = new Date(Date.now() + params.expiresIn * 1000);

    const user = await prisma.user.upsert({
      where: { spotifyId: params.spotifyId },
      update: {
        accessToken: params.accessToken,
        refreshToken: params.refreshToken,
        tokenExpiry
      },
      create: {
        spotifyId: params.spotifyId,
        accessToken: params.accessToken,
        refreshToken: params.refreshToken,
        tokenExpiry
      }
    });

    return user;
  }

  static async refreshUserTokenIfNeeded(userId: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return null;
    }

    const isExpired = user.tokenExpiry.getTime() <= Date.now() + 30 * 1000;
    if (!isExpired) {
      return user;
    }

    const refreshed = await AuthService.refreshAccessToken(user.refreshToken);
    const nextRefreshToken = refreshed.refresh_token ?? user.refreshToken;

    return prisma.user.update({
      where: { id: user.id },
      data: {
        accessToken: refreshed.access_token,
        refreshToken: nextRefreshToken,
        tokenExpiry: new Date(Date.now() + refreshed.expires_in * 1000)
      }
    });
  }
}
