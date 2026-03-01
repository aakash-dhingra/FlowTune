import axios from 'axios';
import type { User } from '@prisma/client';
import { HttpError } from '../utils/httpError.js';

const SPOTIFY_API_BASE = 'https://api.spotify.com/v1';

export interface RecommendedTrack {
    track_id: string;
    name: string;
    artist: string;
    score: number;
    explanation: string;
}

interface SpotifyTrack {
    id: string;
    uri: string;
    name: string;
    popularity: number;
    artists: Array<{ id: string; name: string }>;
    album: { release_date: string };
}

interface SpotifyArtist {
    id: string;
    name: string;
    genres: string[];
    popularity: number;
}

interface TasteProfile {
    genres: Map<string, number>;
    artists: Map<string, number>;
    recentTrackIds: Set<string>;
    savedTrackIds: Set<string>; // For filtering
}

export class RecommendationEngine {
    private static async spotifyGet<T>(url: string, accessToken: string, params: Record<string, string | number> = {}): Promise<T> {
        try {
            const { data } = await axios.get<T>(url, {
                headers: { Authorization: `Bearer ${accessToken}` },
                params
            });
            return data;
        } catch (error) {
            console.error(`[Spotify API Error] GET ${url}`, error instanceof Error ? error.message : error);
            throw error;
        }
    }

    private static async fetchTopArtists(accessToken: string): Promise<SpotifyArtist[]> {
        const urls = [
            `${SPOTIFY_API_BASE}/me/top/artists?time_range=short_term&limit=50`,
            `${SPOTIFY_API_BASE}/me/top/artists?time_range=medium_term&limit=50`
        ];

        const artists = new Map<string, SpotifyArtist>();

        for (const url of urls) {
            try {
                const res = await this.spotifyGet<{ items: SpotifyArtist[] }>(url, accessToken);
                res.items.forEach(artist => {
                    if (!artists.has(artist.id)) artists.set(artist.id, artist);
                });
            } catch (err) {
                console.warn(`Failed to fetch top artists from ${url}`);
            }
        }

        return Array.from(artists.values());
    }

    private static async fetchTopTracks(accessToken: string): Promise<SpotifyTrack[]> {
        const urls = [
            `${SPOTIFY_API_BASE}/me/top/tracks?time_range=short_term&limit=50`,
            `${SPOTIFY_API_BASE}/me/top/tracks?time_range=medium_term&limit=50`
        ];

        const tracks = new Map<string, SpotifyTrack>();

        for (const url of urls) {
            try {
                const res = await this.spotifyGet<{ items: SpotifyTrack[] }>(url, accessToken);
                res.items.forEach(track => {
                    if (!tracks.has(track.id)) tracks.set(track.id, track);
                });
            } catch (err) {
                console.warn(`Failed to fetch top tracks from ${url}`);
            }
        }

        return Array.from(tracks.values());
    }

    private static async fetchRecentlyPlayed(accessToken: string): Promise<SpotifyTrack[]> {
        try {
            const res = await this.spotifyGet<{ items: { track: SpotifyTrack }[] }>(
                `${SPOTIFY_API_BASE}/me/player/recently-played?limit=50`,
                accessToken
            );
            return res.items.map(i => i.track);
        } catch (err) {
            console.warn(`Failed to fetch recently played tracks`);
            return [];
        }
    }

    private static async fetchSavedTracks(accessToken: string): Promise<Set<string>> {
        try {
            // Just fetching the most recent 100 for fast filtering.
            const res = await this.spotifyGet<{ items: { track: { id: string } }[] }>(
                `${SPOTIFY_API_BASE}/me/tracks?limit=50`,
                accessToken
            );
            return new Set(res.items.map(i => i.track.id));
        } catch (err) {
            return new Set();
        }
    }

    private static async buildTasteProfile(accessToken: string): Promise<TasteProfile> {
        const [topArtists, topTracks, recentTracks, savedTracks] = await Promise.all([
            this.fetchTopArtists(accessToken),
            this.fetchTopTracks(accessToken),
            this.fetchRecentlyPlayed(accessToken),
            this.fetchSavedTracks(accessToken)
        ]);

        const genreMap = new Map<string, number>();
        const artistMap = new Map<string, number>();
        const recentTrackIds = new Set<string>();

        // Weight artists by appearance in top lists
        topArtists.forEach(artist => {
            artistMap.set(artist.name, (artistMap.get(artist.name) || 0) + 2);
            artist.genres.forEach(genre => {
                genreMap.set(genre, (genreMap.get(genre) || 0) + 1);
            });
        });

        // Extract implicit artist/genre affinity from top tracks + recents
        [...topTracks, ...recentTracks].forEach(track => {
            recentTrackIds.add(track.id);
            track.artists.forEach(artist => {
                artistMap.set(artist.name, (artistMap.get(artist.name) || 0) + 1);
            });
        });

        return {
            genres: genreMap,
            artists: artistMap,
            recentTrackIds,
            savedTrackIds: savedTracks
        };
    }

    private static async fetchRelatedArtists(artistId: string, accessToken: string): Promise<SpotifyArtist[]> {
        try {
            const res = await this.spotifyGet<{ artists: SpotifyArtist[] }>(
                `${SPOTIFY_API_BASE}/artists/${artistId}/related-artists`,
                accessToken
            );
            return res.artists.slice(0, 5); // Limit to top 5 related to keep request volume low
        } catch {
            return [];
        }
    }

    private static async fetchArtistTopTracks(artistId: string, accessToken: string): Promise<SpotifyTrack[]> {
        try {
            const res = await this.spotifyGet<{ tracks: SpotifyTrack[] }>(
                `${SPOTIFY_API_BASE}/artists/${artistId}/top-tracks?market=from_token`,
                accessToken
            );
            return res.tracks;
        } catch {
            return [];
        }
    }

    private static async generateCandidates(accessToken: string, tasteProfile: TasteProfile): Promise<SpotifyTrack[]> {
        // 1. Get Top Artists directly to find related ones
        const topArtists = await this.fetchTopArtists(accessToken);
        // Take the absolute top 5
        const seedArtists = topArtists.slice(0, 5);

        // 2. Fetch related artists
        const relatedArtistPool = new Map<string, SpotifyArtist>();
        for (const seed of seedArtists) {
            const related = await this.fetchRelatedArtists(seed.id, accessToken);
            related.forEach(a => {
                if (!relatedArtistPool.has(a.id)) {
                    relatedArtistPool.set(a.id, a);
                }
            });
        }

        // 3. Fetch top tracks for related artists (+ seed artists to ensure some good baseline hits)
        const tracksToConsider = new Map<string, SpotifyTrack>();
        const allArtistsToProbe = [...seedArtists, ...Array.from(relatedArtistPool.values())];

        // Batch requesting sequentially to avoid rate limits since these loops are small (max ~30 iterations)
        for (const artist of allArtistsToProbe.slice(0, 15)) {
            const tracks = await this.fetchArtistTopTracks(artist.id, accessToken);
            tracks.forEach(t => {
                // Filter out obvious ones: saved tracks or recently played
                if (!tasteProfile.savedTrackIds.has(t.id) && !tasteProfile.recentTrackIds.has(t.id)) {
                    tracksToConsider.set(t.id, t);
                }
            });
        }

        return Array.from(tracksToConsider.values());
    }

    private static scoreTrack(track: SpotifyTrack, tasteProfile: TasteProfile): RecommendedTrack {
        let score = 0;
        let rankReasons: string[] = [];

        // 1. Artist Affinity (Weight: 0.3)
        let artistMatches = 0;
        track.artists.forEach(artist => {
            const affinity = tasteProfile.artists.get(artist.name) || 0;
            if (affinity > 0) {
                artistMatches += 1;
                score += Math.min(affinity * 0.1, 0.3); // Max contribution 0.3
            }
        });
        if (artistMatches > 0) {
            rankReasons.push(`because you frequently listen to ${track.artists[0]?.name}`);
        }

        // 2. Popularity Normalization (Weight: 0.1)
        // Favors obscure tracks slightly if we assume recommendation engine is for discovery,
        // but here we just give a small boost to generally solid tracks
        const popScore = (track.popularity / 100) * 0.1;
        score += popScore;

        // 3. Recency Bias (Weight: 0.2)
        // Give bump to newer tracks
        if (track.album?.release_date) {
            const releaseYear = new Date(track.album.release_date).getFullYear();
            const currentYear = new Date().getFullYear();
            if (currentYear - releaseYear <= 2) {
                score += 0.2;
                rankReasons.push("as a recent release");
            } else if (currentYear - releaseYear <= 5) {
                score += 0.1;
            }
        }

        // Combine reasons
        const explanation = rankReasons.length > 0
            ? `Recommended ${rankReasons.join(' and ')}`
            : "Based on artists related to your favorites";

        return {
            track_id: track.id,
            name: track.name,
            artist: track.artists.map(a => a.name).join(', '),
            score: parseFloat(score.toFixed(3)),
            explanation
        };
    }

    static async getRecommendations(user: User): Promise<RecommendedTrack[]> {
        console.log(`[Recommendation Engine] Starting for user ${user.id}`);

        // 1. Build Taste Profile
        const tasteProfile = await this.buildTasteProfile(user.accessToken);
        console.log(`[Recommendation Engine] Taste Profile built. Top Artists: ${tasteProfile.artists.size}`);

        // 2. Generate Candidate Pool
        const candidates = await this.generateCandidates(user.accessToken, tasteProfile);
        console.log(`[Recommendation Engine] Generated ${candidates.length} candidates from related artists`);

        // 3. Score and Rank candidates
        const scoredCandidates: RecommendedTrack[] = candidates.map(c => this.scoreTrack(c, tasteProfile));

        // Sort descending by score
        scoredCandidates.sort((a, b) => b.score - a.score);

        // Limit to Top 30
        return scoredCandidates.slice(0, 30);
    }
}
