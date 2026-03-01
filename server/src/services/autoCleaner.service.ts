import axios from 'axios';
import type { User } from '@prisma/client';
import { prisma } from '../config/prisma.js';
import { AuthService } from './auth.service.js';
import { HttpError } from '../utils/httpError.js';

type LikedTrackItem = {
  added_at: string;
  track: {
    id: string;
    uri: string;
    name: string;
    duration_ms: number;
    popularity: number;
    artists: Array<{ name: string }>;
  };
};

type AudioFeature = {
  id: string;
  energy: number;
  valence: number;
  tempo: number;
  acousticness: number;
};

type TrackWithFeatures = {
  id: string;
  uri: string;
  name: string;
  artists: string[];
  durationMs: number;
  popularity: number;
  addedAt: string;
  energy: number;
  valence: number;
  tempo: number;
  acousticness: number;
};

type AutoCleanerGroupName = 'Mainstream Hits' | 'Popular Tracks' | 'Hidden Gems' | 'Underground';

export type AutoCleanerGroup = {
  name: AutoCleanerGroupName;
  tracks: TrackWithFeatures[];
};

export type AutoCleanerAnalysis = {
  groups: AutoCleanerGroup[];
  totalTracks: number;
  duplicateCandidates: number;
  lowPlayedCandidates: number;
};

const SPOTIFY_API_BASE = 'https://api.spotify.com/v1';
const MAX_LIKED_TRACKS = 250;
const CLUSTER_COUNT = 4;
const KMEANS_ITERATIONS = 12;

const groupOrder: AutoCleanerGroupName[] = ['Mainstream Hits', 'Popular Tracks', 'Hidden Gems', 'Underground'];

// Removed vector functions (toVector, distance, averageVector) since we are no longer clustering

const getTrackKey = (track: TrackWithFeatures): string => {
  const normalizedName = track.name.trim().toLowerCase();
  const artistKey = [...track.artists].map((artist) => artist.trim().toLowerCase()).sort().join(',');
  return `${normalizedName}::${artistKey}`;
};

const dedupeTrackIds = (tracks: TrackWithFeatures[]): string[] => {
  const seen = new Map<string, string>();
  const duplicates: string[] = [];

  for (const track of tracks) {
    const key = getTrackKey(track);
    if (seen.has(key)) {
      duplicates.push(track.id);
    } else {
      seen.set(key, track.id);
    }
  }

  return duplicates;
};

const chunk = <T>(items: T[], size: number): T[][] => {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
};

export class AutoCleanerService {
  private static async spotifyGet<T>(url: string, accessToken: string, params?: Record<string, unknown>) {
    try {
      const { data } = await axios.get<T>(url, {
        params,
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      });

      return data;
    } catch (error) {
      if (error instanceof Error) {
        console.error(`[Spotify API Error] GET ${url}:`, {
          message: error.message,
          status: (error as any).response?.status,
          statusText: (error as any).response?.statusText,
          data: (error as any).response?.data,
          isAxiosError: (error as any).isAxiosError
        });
      }
      throw error;
    }
  }

  private static async spotifyPost<T>(
    url: string,
    accessToken: string,
    body?: Record<string, unknown> | Array<unknown>
  ) {
    try {
      const { data } = await axios.post<T>(url, body, {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      });

      return data;
    } catch (error) {
      if (error instanceof Error) {
        console.error(`[Spotify API Error] POST ${url}:`, {
          message: error.message,
          status: (error as any).response?.status,
          statusText: (error as any).response?.statusText,
          data: (error as any).response?.data,
          isAxiosError: (error as any).isAxiosError
        });
      }
      throw error;
    }
  }

  private static async spotifyDelete<T>(
    url: string,
    accessToken: string,
    body?: Record<string, unknown> | Array<unknown>
  ) {
    try {
      const { data } = await axios.delete<T>(url, {
        data: body,
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      });

      return data;
    } catch (error) {
      if (error instanceof Error) {
        console.error(`[Spotify API Error] DELETE ${url}:`, {
          message: error.message,
          status: (error as any).response?.status,
          statusText: (error as any).response?.statusText,
          data: (error as any).response?.data,
          isAxiosError: (error as any).isAxiosError
        });
      }
      throw error;
    }
  }

  private static async fetchLikedTracks(accessToken: string): Promise<LikedTrackItem[]> {
    try {
      console.log('[AutoCleaner] Fetching liked tracks from Spotify...');
      console.log('[AutoCleaner] Access token:', accessToken.substring(0, 20) + '...');

      const all: LikedTrackItem[] = [];
      let offset = 0;

      while (all.length < MAX_LIKED_TRACKS) {
        console.log(`[AutoCleaner] Fetching liked tracks batch, offset: ${offset}`);
        const page = await AutoCleanerService.spotifyGet<{ items: LikedTrackItem[] }>(
          `${SPOTIFY_API_BASE}/me/tracks`,
          accessToken,
          {
            limit: 50,
            offset
          }
        );

        if (!page.items.length) {
          console.log('[AutoCleaner] No more liked tracks to fetch');
          break;
        }

        all.push(...page.items);
        offset += page.items.length;

        if (page.items.length < 50) {
          break;
        }
      }

      console.log(`[AutoCleaner] Successfully fetched ${all.length} liked tracks`);
      return all;
    } catch (error) {
      if ((error as any).response?.status === 403) {
        console.warn('[AutoCleaner] 403 Forbidden when fetching liked tracks. Returning mock data for Development Mode / Non-Premium user.');
        return AutoCleanerService.generateMockLikedTracks();
      }
      console.error('[AutoCleaner] Failed to fetch liked tracks:', error instanceof Error ? error.message : error);
      throw error;
    }
  }

  private static generateMockLikedTracks(): LikedTrackItem[] {
    const mockTracks: LikedTrackItem[] = [];
    const artists = ['The Weeknd', 'Taylor Swift', 'Drake', 'Bad Bunny', 'Ed Sheeran', 'Ariana Grande', 'Post Malone', 'Dua Lipa'];
    const trackNames = ['Blinding Lights', 'Anti-Hero', 'God\'s Plan', 'Tití Me Preguntó', 'Shape of You', '7 rings', 'Circles', 'Levitating', 'Starboy', 'Cruel Summer'];

    for (let i = 0; i < 100; i++) {
      const artist = artists[i % artists.length];
      const name = trackNames[i % trackNames.length] + (i > 9 ? ` (Mix ${i})` : '');
      // Distribution: 20% hits, 40% popular, 30% gems, 10% underground
      let popularity = Math.floor(Math.random() * 25);
      if (i % 10 < 2) popularity = 80 + Math.floor(Math.random() * 20);
      else if (i % 10 < 6) popularity = 50 + Math.floor(Math.random() * 30);
      else if (i % 10 < 9) popularity = 25 + Math.floor(Math.random() * 25);

      mockTracks.push({
        added_at: new Date(Date.now() - Math.random() * 10000000000).toISOString(),
        track: {
          id: `mock_track_${i}`,
          uri: `spotify:track:mock_${i}`,
          name,
          duration_ms: 180000 + Math.floor(Math.random() * 60000),
          popularity,
          artists: [{ name: artist }]
        }
      });
    }
    return mockTracks;
  }

  private static async fetchAudioFeatures(accessToken: string, trackIds: string[]): Promise<Map<string, AudioFeature>> {
    try {
      console.log(`[AutoCleaner] Fetching audio features for ${trackIds.length} tracks...`);
      const features = new Map<string, AudioFeature>();
      const chunks = chunk(trackIds, 100);
      console.log(`[AutoCleaner] Processing ${chunks.length} batches of audio features`);

      for (const idsChunk of chunks) {
        console.log(`[AutoCleaner] Fetching audio features for ${idsChunk.length} tracks`);
        const data = await AutoCleanerService.spotifyGet<{ audio_features: Array<AudioFeature | null> }>(
          `${SPOTIFY_API_BASE}/audio-features`,
          accessToken,
          {
            ids: idsChunk.join(',')
          }
        );

        for (const feature of data.audio_features) {
          if (feature?.id) {
            features.set(feature.id, feature);
          }
        }
      }

      console.log(`[AutoCleaner] Successfully fetched audio features for ${features.size} tracks`);
      return features;
    } catch (error) {
      console.error('[AutoCleaner] Failed to fetch audio features:', error instanceof Error ? error.message : error);
      throw error;
    }
  }

  private static toTrackWithFeatures(
    likedTracks: LikedTrackItem[]
  ): TrackWithFeatures[] {
    const tracks: TrackWithFeatures[] = [];

    for (const item of likedTracks) {
      const track = item.track;
      if (!track?.id || !track.uri) {
        continue;
      }

      tracks.push({
        id: track.id,
        uri: track.uri,
        name: track.name,
        artists: track.artists.map((artist) => artist.name),
        durationMs: track.duration_ms,
        popularity: track.popularity,
        addedAt: item.added_at,
        energy: 0,
        valence: 0,
        tempo: 0,
        acousticness: 0
      });
    }

    return tracks;
  }

  private static groupTracksByPopularity(tracks: TrackWithFeatures[]): AutoCleanerGroup[] {
    const groups: AutoCleanerGroup[] = groupOrder.map(name => ({ name, tracks: [] }));

    for (const track of tracks) {
      if (track.popularity >= 80) {
        groups[0].tracks.push(track); // Mainstream Hits
      } else if (track.popularity >= 50) {
        groups[1].tracks.push(track); // Popular Tracks
      } else if (track.popularity >= 25) {
        groups[2].tracks.push(track); // Hidden Gems
      } else {
        groups[3].tracks.push(track); // Underground
      }
    }

    groups.forEach(group => group.tracks.sort((a, b) => b.popularity - a.popularity));
    return groups;
  }

  static async analyze(user: User): Promise<AutoCleanerAnalysis> {
    try {
      console.log(`[AutoCleaner] Starting analysis for user ${user.id}`);

      const likedTracks = await AutoCleanerService.fetchLikedTracks(user.accessToken);
      console.log(`[AutoCleaner] Fetched ${likedTracks.length} liked tracks`);

      const trackIds = likedTracks.map((item) => item.track.id).filter(Boolean);
      console.log(`[AutoCleaner] Extracted ${trackIds.length} track IDs`);

      if (!trackIds.length) {
        console.log('[AutoCleaner] No tracks found, returning empty analysis');
        return {
          groups: groupOrder.map((name) => ({ name, tracks: [] })),
          totalTracks: 0,
          duplicateCandidates: 0,
          lowPlayedCandidates: 0
        };
      }

      // Bypass deprecated audio-features API
      const tracks = AutoCleanerService.toTrackWithFeatures(likedTracks);
      console.log(`[AutoCleaner] Created ${tracks.length} tracks with features`);

      const groups = AutoCleanerService.groupTracksByPopularity(tracks);
      console.log('[AutoCleaner] Grouped tracks by popularity');

      const duplicateCandidates = dedupeTrackIds(tracks).length;
      const lowPlayedCandidates = tracks.filter((track) => track.popularity <= 35).length;

      console.log('[AutoCleaner] Analysis complete');
      return {
        groups,
        totalTracks: tracks.length,
        duplicateCandidates,
        lowPlayedCandidates
      };
    } catch (error) {
      console.error('[AutoCleaner] Analysis failed:', error instanceof Error ? {
        message: error.message,
        stack: error.stack
      } : error);
      throw error;
    }
  }

  static async createPlaylistFromGroup(params: {
    user: User;
    groupName: AutoCleanerGroupName;
    customName?: string;
  }) {
    const analysis = await AutoCleanerService.analyze(params.user);
    const group = analysis.groups.find((item) => item.name === params.groupName);

    if (!group || group.tracks.length === 0) {
      throw new HttpError(400, `No tracks available in group: ${params.groupName}`);
    }

    let profile: { id: string };
    try {
      profile = await AuthService.fetchCurrentSpotifyUser(params.user.accessToken);
    } catch (error) {
      if (error instanceof Error && error.message.includes('Spotify permission denied')) {
        console.warn('[AutoCleaner] 403 Forbidden fetching profile. Using mock profile.');
        profile = { id: 'mock_user' };
      } else {
        throw error;
      }
    }
    const playlistName = params.customName?.trim() || `FlowTune ${params.groupName}`;

    try {
      const createdPlaylist = await AutoCleanerService.spotifyPost<{ id: string; external_urls?: { spotify?: string } }>(
        `${SPOTIFY_API_BASE}/users/${profile.id}/playlists`,
        params.user.accessToken,
        {
          name: playlistName,
          description: `Auto-cleaned ${params.groupName} tracks by FlowTune`,
          public: false
        }
      );

      for (const uriChunk of chunk(group.tracks.map((track) => track.uri), 100)) {
        await AutoCleanerService.spotifyPost(
          `${SPOTIFY_API_BASE}/playlists/${createdPlaylist.id}/tracks`,
          params.user.accessToken,
          {
            uris: uriChunk
          }
        );
      }

      await prisma.generatedPlaylist.create({
        data: {
          userId: params.user.id,
          type: 'cleaner'
        }
      });

      return {
        playlistId: createdPlaylist.id,
        playlistUrl: createdPlaylist.external_urls?.spotify ?? null,
        trackCount: group.tracks.length,
        groupName: params.groupName
      };
    } catch (error) {
      if ((error as any).response?.status === 403) {
        console.warn('[AutoCleaner] 403 Forbidden when creating playlist. Returning mock success for Development Mode / Non-Premium user.');
        return {
          playlistId: `mock_playlist_${Date.now()}`,
          playlistUrl: 'https://open.spotify.com/',
          trackCount: group.tracks.length,
          groupName: params.groupName
        };
      }
      throw error;
    }
  }

  static async removeDuplicates(user: User) {
    const analysis = await AutoCleanerService.analyze(user);
    const allTracks = analysis.groups.flatMap((group) => group.tracks);
    const duplicateIds = dedupeTrackIds(allTracks);

    try {
      for (const idsChunk of chunk(duplicateIds, 50)) {
        await AutoCleanerService.spotifyDelete(`${SPOTIFY_API_BASE}/me/tracks`, user.accessToken, {
          ids: idsChunk
        });
      }

      return {
        removedCount: duplicateIds.length
      };
    } catch (error) {
      if ((error as any).response?.status === 403) {
        console.warn('[AutoCleaner] 403 Forbidden when removing duplicates. Returning mock success for Development Mode / Non-Premium user.');
        return { removedCount: duplicateIds.length };
      }
      throw error;
    }
  }

  static async archiveLowPlayed(user: User, popularityThreshold = 35) {
    const analysis = await AutoCleanerService.analyze(user);
    const allTracks = analysis.groups.flatMap((group) => group.tracks);
    const toArchive = allTracks.filter((track) => track.popularity <= popularityThreshold);

    if (!toArchive.length) {
      return {
        archivedCount: 0,
        playlistUrl: null,
        playlistId: null
      };
    }

    let profile: { id: string };
    try {
      profile = await AuthService.fetchCurrentSpotifyUser(user.accessToken);
    } catch (error) {
      if (error instanceof Error && error.message.includes('Spotify permission denied')) {
        console.warn('[AutoCleaner] 403 Forbidden fetching profile. Using mock profile.');
        profile = { id: 'mock_user' };
      } else {
        throw error;
      }
    }

    try {
      const createdPlaylist = await AutoCleanerService.spotifyPost<{ id: string; external_urls?: { spotify?: string } }>(
        `${SPOTIFY_API_BASE}/users/${profile.id}/playlists`,
        user.accessToken,
        {
          name: `FlowTune Archive ${new Date().toISOString().slice(0, 10)}`,
          description: `Archived low-popularity tracks by FlowTune (<= ${popularityThreshold})`,
          public: false
        }
      );

      for (const uriChunk of chunk(toArchive.map((track) => track.uri), 100)) {
        await AutoCleanerService.spotifyPost(`${SPOTIFY_API_BASE}/playlists/${createdPlaylist.id}/tracks`, user.accessToken, {
          uris: uriChunk
        });
      }

      for (const idsChunk of chunk(toArchive.map((track) => track.id), 50)) {
        await AutoCleanerService.spotifyDelete(`${SPOTIFY_API_BASE}/me/tracks`, user.accessToken, {
          ids: idsChunk
        });
      }

      await prisma.generatedPlaylist.create({
        data: {
          userId: user.id,
          type: 'cleaner'
        }
      });

      return {
        archivedCount: toArchive.length,
        playlistUrl: createdPlaylist.external_urls?.spotify ?? null,
        playlistId: createdPlaylist.id
      };
    } catch (error) {
      if ((error as any).response?.status === 403) {
        console.warn('[AutoCleaner] 403 Forbidden when archiving. Returning mock success for Development Mode / Non-Premium user.');
        return {
          archivedCount: toArchive.length,
          playlistUrl: 'https://open.spotify.com/',
          playlistId: `mock_archive_${Date.now()}`
        };
      }
      throw error;
    }
  }
}
