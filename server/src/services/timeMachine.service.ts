import axios from 'axios';
import type { User, GeneratedPlaylistType } from '@prisma/client';
import { prisma } from '../config/prisma.js';
import { HttpError } from '../utils/httpError.js';

const SPOTIFY_API_BASE = 'https://api.spotify.com/v1';

// Same interface as AutoCleaner, but tailored to track the added timestamp
interface LikedTrackItem {
    added_at: string;
    track: {
        id: string;
        uri: string;
        name: string;
        duration_ms: number;
        artists: Array<{ name: string }>;
    } | null;
}

export interface TimeMachineTrack {
    id: string;
    uri: string;
    name: string;
    artists: string[];
    durationMs: number;
    addedAt: string;
}

export interface TimeMachineEra {
    year: string;
    tracks: TimeMachineTrack[];
}

export interface TimeMachineAnalysis {
    userId: string;
    totalTracksAnalyzed: number;
    eras: TimeMachineEra[];
}

function chunk<T>(array: T[], size: number): T[][] {
    return Array.from({ length: Math.ceil(array.length / size) }, (_, i) =>
        array.slice(i * size, i * size + size)
    );
}

export class TimeMachineService {
    /** Helper wrapper for Spotify GET requests */
    private static async spotifyGet<T>(url: string, accessToken: string, params: Record<string, string | number> = {}): Promise<T> {
        const { data } = await axios.get<T>(url, {
            headers: { Authorization: `Bearer ${accessToken}` },
            params
        });
        return data;
    }

    /** Helper wrapper for Spotify POST requests */
    private static async spotifyPost<T>(url: string, accessToken: string, payload: unknown = {}): Promise<T> {
        const { data } = await axios.post<T>(url, payload, {
            headers: { Authorization: `Bearer ${accessToken}` }
        });
        return data;
    }

    /**
     * Fetches the user's liked tracks.
     * We cap it at 1000 tracks (20 pages of 50) so the analysis won't timeout for users with huge libraries.
     */
    private static async fetchLikedTracks(accessToken: string, limit = 1000): Promise<LikedTrackItem[]> {
        const tracks: LikedTrackItem[] = [];
        let url: string | null = `${SPOTIFY_API_BASE}/me/tracks?limit=50`;

        while (url && tracks.length < limit) {
            const response: { items: LikedTrackItem[]; next: string | null } = await TimeMachineService.spotifyGet<{
                items: LikedTrackItem[];
                next: string | null;
            }>(url, accessToken);

            tracks.push(...response.items);
            url = response.next;
        }

        return tracks;
    }

    /**
     * Analyzes the liked tracks and groups them by the year they were added to the user's library.
     */
    static async analyze(user: User): Promise<TimeMachineAnalysis> {
        const items = await TimeMachineService.fetchLikedTracks(user.accessToken);

        const eraMap = new Map<string, TimeMachineTrack[]>();

        for (const item of items) {
            const track = item.track;
            if (!track?.id || !track.uri || !item.added_at) continue;

            const year = new Date(item.added_at).getFullYear().toString();

            const timeMachineTrack: TimeMachineTrack = {
                id: track.id,
                uri: track.uri,
                name: track.name,
                artists: track.artists.map((a) => a.name),
                durationMs: track.duration_ms,
                addedAt: item.added_at
            };

            if (!eraMap.has(year)) {
                eraMap.set(year, []);
            }
            eraMap.get(year)!.push(timeMachineTrack);
        }

        const eras: TimeMachineEra[] = Array.from(eraMap.entries())
            .map(([year, tracks]) => ({
                year,
                // Sort newest added first within the era
                tracks: tracks.sort((a, b) => new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime())
            }))
            // Sort eras from newest year to oldest year
            .sort((a, b) => parseInt(b.year) - parseInt(a.year));

        return {
            userId: user.id,
            totalTracksAnalyzed: items.length,
            eras
        };
    }

    /**
     * Creates a new playlist for the specified era (year) and populates it with tracks.
     */
    static async createEraPlaylist(params: { user: User; year: string; customName?: string }) {
        const analysis = await TimeMachineService.analyze(params.user);
        const era = analysis.eras.find((e) => e.year === params.year);

        if (!era || era.tracks.length === 0) {
            throw new HttpError(400, `No tracks available in the ${params.year} era.`);
        }

        const playlistName = params.customName?.trim() || `FlowTune: ${params.year} Era`;

        // 1. Create the empty playlist
        const createdPlaylist = await TimeMachineService.spotifyPost<{ id: string; external_urls?: { spotify?: string } }>(
            `${SPOTIFY_API_BASE}/me/playlists`,
            params.user.accessToken,
            {
                name: playlistName,
                description: `Your favorite discoveries from ${params.year}, generated by FlowTune's Time Machine.`,
                public: false
            }
        );

        // 2. Add the items in chunks of 100
        for (const uriChunk of chunk(era.tracks.map((track) => track.uri), 100)) {
            await TimeMachineService.spotifyPost(
                `${SPOTIFY_API_BASE}/playlists/${createdPlaylist.id}/items`,
                params.user.accessToken,
                {
                    uris: uriChunk
                }
            );
        }

        // 3. Log it in the DB
        await prisma.generatedPlaylist.create({
            data: {
                userId: params.user.id,
                type: 'time_machine' as GeneratedPlaylistType
            }
        });

        return {
            playlistId: createdPlaylist.id,
            playlistUrl: createdPlaylist.external_urls?.spotify ?? null,
            trackCount: era.tracks.length,
            year: params.year
        };
    }
}
