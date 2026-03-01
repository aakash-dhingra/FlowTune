import { useState } from 'react';
import { getRecommendations } from '../services/recommendation';
import type { RecommendedTrack } from '../types/recommendation';

interface RecommendationPanelProps {
    enabled: boolean;
}

export default function RecommendationPanel({ enabled }: RecommendationPanelProps) {
    const [tracks, setTracks] = useState<RecommendedTrack[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleDiscover = async () => {
        if (!enabled) return;
        try {
            setIsLoading(true);
            setError(null);
            const data = await getRecommendations();
            setTracks(data);
        } catch (err: any) {
            console.error('Failed to fetch recommendations:', err);
            setError(err.response?.data?.error || 'Failed to generate recommendations. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="rounded-2xl border border-borderSoft bg-card p-6 shadow-sm">
            <div className="mb-6 flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight text-white mb-1">Recommendation Engine</h2>
                    <p className="text-sm text-slate-400">
                        Generate personalized track recommendations based on your listening history, top artists, and recent vibe.
                    </p>
                </div>
                <button
                    onClick={handleDiscover}
                    disabled={!enabled || isLoading}
                    className="flex h-10 min-w-[140px] items-center justify-center rounded-full bg-emerald-500 px-6 text-sm font-semibold text-white transition-all hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
                >
                    {isLoading ? (
                        <div className="flex items-center gap-2">
                            <svg className="h-4 w-4 animate-spin text-white" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                            <span>Analyzing...</span>
                        </div>
                    ) : (
                        'Discover New Tracks'
                    )}
                </button>
            </div>

            {!enabled && (
                <div className="rounded-xl border border-amber-400/30 bg-amber-500/10 p-4 text-center text-sm text-amber-200">
                    Please sign in with Spotify to access recommendations.
                </div>
            )}

            {error && (
                <div className="mb-6 rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200">
                    {error}
                </div>
            )}

            {tracks.length > 0 && (
                <div className="mt-6 space-y-4">
                    <h3 className="text-lg font-semibold text-slate-200">Your Personalized Picks</h3>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {tracks.map((track) => (
                            <div
                                key={track.track_id}
                                className="flex flex-col rounded-xl border border-borderSoft bg-background/50 p-4 transition-colors hover:border-emerald-500/30 hover:bg-emerald-500/5 group"
                            >
                                <div className="flex items-start justify-between">
                                    <div className="min-w-0 pr-2">
                                        <h4 className="truncate font-semibold text-white group-hover:text-emerald-400 transition-colors">
                                            {track.name}
                                        </h4>
                                        <p className="truncate text-sm text-slate-400">{track.artist}</p>
                                    </div>
                                    <div className="flex h-7 items-center justify-center rounded-full bg-emerald-500/10 px-2.5 text-xs font-medium text-emerald-400 ring-1 ring-inset ring-emerald-500/20">
                                        {track.score.toFixed(2)}
                                    </div>
                                </div>

                                <div className="mt-4 pt-3 border-t border-borderSoft/50">
                                    <p className="text-xs text-slate-400 leading-relaxed italic">
                                        "{track.explanation}"
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
