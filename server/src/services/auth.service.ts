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

    const url = `${SPOTIFY_ACCOUNTS_BASE}/authorize?${params.toString()}`;
    
    console.log('[Auth] Building Spotify authorize URL:', {
      client_id: env.spotifyClientId,
      redirect_uri: env.spotifyRedirectUri,
      scopes: scopes.split(' '),
      url: url.substring(0, 100) + '...'
    });

    return url;
  }

  static async exchangeCodeForTokens(code: string): Promise<SpotifyTokenResponse> {
    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: env.spotifyRedirectUri,
      client_id: env.spotifyClientId,
      client_secret: env.spotifyClientSecret
    });

    try {
      console.log('[Auth] Exchanging authorization code for tokens:', {
        redirect_uri: env.spotifyRedirectUri,
        client_id: env.spotifyClientId,
        code: code.substring(0, 10) + '...'
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

      console.log('[Auth] Token exchange successful:', {
        access_token: data.access_token.substring(0, 20) + '...',
        expires_in: data.expires_in,
        has_refresh_token: !!data.refresh_token,
        scope: data.scope,
        scope_array: (data.scope || '').split(' ').filter(Boolean)
      });

      // Check if required scopes are present
      const requiredScopes = ['user-read-private', 'user-read-email', 'user-library-read', 'playlist-modify-private', 'playlist-modify-public'];
      const grantedScopes = (data.scope || '').split(' ').filter(Boolean);
      const missingScopes = requiredScopes.filter(scope => !grantedScopes.includes(scope));
      
      console.log('[Auth] Scopes verification:', {
        required: requiredScopes,
        granted: grantedScopes,
        missing: missingScopes
      });
      
      if (missingScopes.length > 0) {
        throw new Error(`Spotify token missing required scopes: ${missingScopes.join(', ')}.\nCheck your Spotify app settings and make sure all scopes are granted.`);
      }

      if (!data.refresh_token) {
        throw new Error('Spotify did not return a refresh token. Try revoking app access in your Spotify account and re-authenticate.');
      }

      return data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error('[Auth] Token exchange failed:', {
          status: error.response?.status,
          data: error.response?.data,
          message: error.message
        });
      }
      throw error;
    }
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
    try {
      console.log('Fetching Spotify profile with token:', accessToken.substring(0, 20) + '...');
      const { data } = await axios.get<SpotifyMeResponse>(`${SPOTIFY_API_BASE}/me`, {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      });

      console.log('Spotify profile fetched successfully:', data.id);
      return data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error('Spotify API error when fetching profile:', {
          status: error.response?.status,
          statusText: error.response?.statusText,
          data: error.response?.data,
          headers: error.config?.headers
        });
        if (error.response?.status === 403) {
          throw new Error('Spotify permission denied when fetching profile. Token may lack required scopes.');
        }
      }
      throw error;
    }
  }

  static async fetchTokenInfo(accessToken: string) {
    try {
      console.log('[Auth] Fetching token info from Spotify...');
      const { data } = await axios.get<any>(`${SPOTIFY_API_BASE}/me`, {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      });
      console.log('[Auth] Token is valid, fetched user:', data.id);
      return { valid: true, userId: data.id };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error('[Auth] Token validation failed:', {
          status: error.response?.status,
          data: error.response?.data
        });
      }
      return { valid: false };
    }
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
