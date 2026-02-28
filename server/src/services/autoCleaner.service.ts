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

type AutoCleanerGroupName = 'High Energy' | 'Chill' | 'Emotional' | 'Mixed';

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

const groupOrder: AutoCleanerGroupName[] = ['High Energy', 'Chill', 'Emotional', 'Mixed'];

const toVector = (track: TrackWithFeatures): number[] => {
  const tempoNormalized = Math.min(track.tempo / 200, 1);
  return [track.energy, track.valence, tempoNormalized, track.acousticness];
};

const distance = (a: number[], b: number[]): number => {
  let sum = 0;
  for (let i = 0; i < a.length; i += 1) {
    const d = a[i] - b[i];
    sum += d * d;
  }
  return Math.sqrt(sum);
};

const averageVector = (vectors: number[][], fallback: number[]): number[] => {
  if (vectors.length === 0) {
    return fallback;
  }

  const dims = fallback.length;
  const result = new Array(dims).fill(0);

  for (const vector of vectors) {
    for (let i = 0; i < dims; i += 1) {
      result[i] += vector[i];
    }
  }

  for (let i = 0; i < dims; i += 1) {
    result[i] /= vectors.length;
  }

  return result;
};

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
      console.error('[AutoCleaner] Failed to fetch liked tracks:', error instanceof Error ? error.message : error);
      throw error;
    }
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
    likedTracks: LikedTrackItem[],
    audioFeatures: Map<string, AudioFeature>
  ): TrackWithFeatures[] {
    const tracks: TrackWithFeatures[] = [];

    for (const item of likedTracks) {
      const track = item.track;
      if (!track?.id || !track.uri) {
        continue;
      }

      const feature = audioFeatures.get(track.id);
      if (!feature) {
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
        energy: feature.energy,
        valence: feature.valence,
        tempo: feature.tempo,
        acousticness: feature.acousticness
      });
    }

    return tracks;
  }

  private static runKMeans(tracks: TrackWithFeatures[]): Array<{ centroid: number[]; tracks: TrackWithFeatures[] }> {
    if (tracks.length === 0) {
      return [];
    }

    const vectors = tracks.map(toVector);
    const seedCount = Math.min(CLUSTER_COUNT, tracks.length);
    const centroids = Array.from({ length: seedCount }, (_unused, i) => {
      const idx = Math.floor((i * tracks.length) / seedCount);
      return vectors[idx];
    });
    while (centroids.length < CLUSTER_COUNT) {
      centroids.push(vectors[vectors.length - 1]);
    }

    let assignments = new Array(tracks.length).fill(0);

    for (let iteration = 0; iteration < KMEANS_ITERATIONS; iteration += 1) {
      assignments = vectors.map((vector) => {
        let best = 0;
        let bestDistance = Number.POSITIVE_INFINITY;

        for (let i = 0; i < centroids.length; i += 1) {
          const d = distance(vector, centroids[i]);
          if (d < bestDistance) {
            bestDistance = d;
            best = i;
          }
        }

        return best;
      });

      for (let i = 0; i < centroids.length; i += 1) {
        const clusterVectors = vectors.filter((_v, idx) => assignments[idx] === i);
        centroids[i] = averageVector(clusterVectors, centroids[i]);
      }
    }

    return centroids.map((centroid, i) => ({
      centroid,
      tracks: tracks.filter((_track, idx) => assignments[idx] === i)
    }));
  }

  private static labelClusters(
    clusters: Array<{ centroid: number[]; tracks: TrackWithFeatures[] }>
  ): AutoCleanerGroup[] {
    if (clusters.length === 0) {
      return groupOrder.map((name) => ({ name, tracks: [] }));
    }

    const descriptors = clusters.map((cluster, idx) => {
      const [energy, valence, tempoNormalized, acousticness] = cluster.centroid;
      return {
        idx,
        cluster,
        highEnergyScore: energy * 0.7 + tempoNormalized * 0.3,
        chillScore: acousticness * 0.7 + (1 - energy) * 0.3,
        emotionalScore: (1 - valence) * 0.7 + acousticness * 0.3
      };
    });

    const used = new Set<number>();
    const assignments = new Map<AutoCleanerGroupName, number>();

    const takeBest = (label: AutoCleanerGroupName, scoreSelector: (d: (typeof descriptors)[number]) => number) => {
      const candidate = descriptors
        .filter((d) => !used.has(d.idx))
        .sort((a, b) => scoreSelector(b) - scoreSelector(a))[0];

      if (candidate) {
        assignments.set(label, candidate.idx);
        used.add(candidate.idx);
      }
    };

    takeBest('High Energy', (d) => d.highEnergyScore);
    takeBest('Chill', (d) => d.chillScore);
    takeBest('Emotional', (d) => d.emotionalScore);

    const remaining = descriptors.find((d) => !used.has(d.idx));
    if (remaining) {
      assignments.set('Mixed', remaining.idx);
      used.add(remaining.idx);
    }

    for (const label of groupOrder) {
      if (!assignments.has(label)) {
        const fallback = descriptors.find((d) => !used.has(d.idx));
        if (fallback) {
          assignments.set(label, fallback.idx);
          used.add(fallback.idx);
        }
      }
    }

    return groupOrder.map((name) => {
      const idx = assignments.get(name);
      const cluster = clusters[idx ?? -1];
      const sortedTracks = [...(cluster?.tracks ?? [])].sort((a, b) => b.energy - a.energy);
      return {
        name,
        tracks: sortedTracks
      };
    });
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

      console.log(`[AutoCleaner] Fetching audio features for ${trackIds.length} tracks`);
      const audioFeatures = await AutoCleanerService.fetchAudioFeatures(user.accessToken, trackIds);
      console.log(`[AutoCleaner] Got audio features for ${audioFeatures.size} tracks`);
      
      const tracks = AutoCleanerService.toTrackWithFeatures(likedTracks, audioFeatures);
      console.log(`[AutoCleaner] Created ${tracks.length} tracks with features`);
      
      const clusters = AutoCleanerService.runKMeans(tracks);
      console.log(`[AutoCleaner] Clustered into ${clusters.length} groups`);
      
      const groups = AutoCleanerService.labelClusters(clusters);
      console.log('[AutoCleaner] Labeled clusters');

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

    const profile = await AuthService.fetchCurrentSpotifyUser(params.user.accessToken);
    const playlistName = params.customName?.trim() || `FlowTune ${params.groupName}`;

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
  }

  static async removeDuplicates(user: User) {
    const analysis = await AutoCleanerService.analyze(user);
    const allTracks = analysis.groups.flatMap((group) => group.tracks);
    const duplicateIds = dedupeTrackIds(allTracks);

    for (const idsChunk of chunk(duplicateIds, 50)) {
      await AutoCleanerService.spotifyDelete(`${SPOTIFY_API_BASE}/me/tracks`, user.accessToken, {
        ids: idsChunk
      });
    }

    return {
      removedCount: duplicateIds.length
    };
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

    const profile = await AuthService.fetchCurrentSpotifyUser(user.accessToken);
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
  }
}
