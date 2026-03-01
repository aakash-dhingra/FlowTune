import { useMemo, useState } from 'react';
import { analyzeTimeMachine, createTimeMachinePlaylist } from '../services/timeMachine';
import type { TimeMachineAnalysis, TimeMachineEra, TimeMachineTrack } from '../types/timeMachine';

type Props = {
    enabled: boolean;
};

const formatMinutes = (durationMs: number) => {
    const totalSeconds = Math.floor(durationMs / 1000);
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins}:${String(secs).padStart(2, '0')}`;
};

const TimeMachinePanel = ({ enabled }: Props) => {
    const [analysis, setAnalysis] = useState<TimeMachineAnalysis | null>(null);
    const [busyAction, setBusyAction] = useState<string | null>(null);
    const [message, setMessage] = useState<string>('');
    const [error, setError] = useState<string>('');
    const [expandedEra, setExpandedEra] = useState<string | null>(null);

    const eraSummary = useMemo(() => {
        if (!analysis) {
            return '';
        }
        return analysis.eras.map((era) => `${era.year}: ${era.tracks.length}`).join(' | ');
    }, [analysis]);

    const runAnalyze = async () => {
        if (!enabled) return;

        try {
            setBusyAction('analyze');
            setError('');
            setMessage('');
            const data = await analyzeTimeMachine();
            setAnalysis(data);
            setMessage(`Analysis complete. Found ${data.eras.length} eras.`);
        } catch {
            setError('Failed to analyze library. Check your Spotify connection and try again.');
        } finally {
            setBusyAction(null);
        }
    };

    const handleCreatePlaylist = async (year: string) => {
        if (!enabled) return;

        try {
            setBusyAction(`create-${year}`);
            setError('');
            setMessage('');

            const result = await createTimeMachinePlaylist({ year });

            setMessage(`Created ${year} Era playlist with ${result.trackCount} tracks!`);
            if (result.playlistUrl) {
                window.open(result.playlistUrl, '_blank');
            }
        } catch (err: any) {
            console.error(err);
            setError(err?.response?.data?.message || `Failed to create a playlist for ${year}.`);
        } finally {
            setBusyAction(null);
        }
    };

    const toggleEra = (year: string) => {
        setExpandedEra((prev) => (prev === year ? null : year));
    };

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-6 border-b border-gray-100 bg-gradient-to-r from-purple-50 to-fuchsia-50">
                <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                    ⏰ Time Machine
                </h2>
                <p className="text-gray-600 mt-2 text-sm leading-relaxed">
                    Journey back through your musical history. We'll scan your Liked Songs and cluster them by the exact year you
                    saved them, creating highly nostalgic "Era" playlists so you can relive your past obsessions.
                </p>
            </div>

            <div className="p-6">
                <div className="flex flex-col sm:flex-row gap-4 mb-8">
                    <button
                        onClick={runAnalyze}
                        disabled={!enabled || busyAction !== null}
                        className={`
              flex-1 py-3 px-4 rounded-lg font-medium transition-all
              ${!enabled
                                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                : 'bg-purple-600 hover:bg-purple-700 text-white shadow-sm'
                            }
              ${busyAction === 'analyze' && 'opacity-70 cursor-wait'}
            `}
                    >
                        {busyAction === 'analyze' ? 'Analyzing Timeline...' : 'Travel Back in Time'}
                    </button>
                </div>

                {error && (
                    <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-lg text-sm border border-red-100">
                        {error}
                    </div>
                )}

                {message && !error && (
                    <div className="mb-6 p-4 bg-green-50 text-green-700 rounded-lg text-sm border border-green-100">
                        {message}
                    </div>
                )}

                {analysis && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="bg-gray-50 rounded-lg p-4 border border-gray-100">
                            <h3 className="font-semibold text-gray-900 mb-2">Timeline Summary</h3>
                            <p className="text-sm text-gray-600 font-mono bg-white p-3 rounded border border-gray-200 overflow-x-auto">
                                {eraSummary}
                            </p>
                            <p className="text-xs text-gray-500 mt-3 flex items-center gap-1">
                                <span className="w-2 h-2 rounded-full bg-purple-400 inline-block"></span>
                                Analyzed {analysis.totalTracksAnalyzed} tracks down to {analysis.eras.length} eras
                            </p>
                        </div>

                        <div className="space-y-4">
                            <h3 className="font-bold text-gray-900 text-lg border-b pb-2">Your Eras</h3>

                            {analysis.eras.map((era: TimeMachineEra) => (
                                <div key={era.year} className="border border-gray-200 rounded-lg overflow-hidden transition-all">
                                    <div
                                        className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-4 bg-white hover:bg-gray-50 cursor-pointer"
                                        onClick={() => toggleEra(era.year)}
                                    >
                                        <div>
                                            <h4 className="font-semibold text-gray-900 text-lg flex items-center gap-2">
                                                {era.year} Era
                                            </h4>
                                            <p className="text-sm text-gray-500 mt-1">
                                                {era.tracks.length} tracks discovered
                                            </p>
                                        </div>

                                        <div className="mt-3 sm:mt-0 flex items-center gap-3 w-full sm:w-auto">
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleCreatePlaylist(era.year);
                                                }}
                                                disabled={busyAction !== null}
                                                className={`
                          py-2 px-4 rounded-md text-sm font-medium transition-colors w-full sm:w-auto
                          ${busyAction === `create-${era.year}`
                                                        ? 'bg-gray-100 text-gray-400 cursor-wait'
                                                        : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                                                    }
                        `}
                                            >
                                                {busyAction === `create-${era.year}` ? 'Generating...' : 'Generate Playlist'}
                                            </button>

                                            <svg
                                                className={`w-5 h-5 text-gray-400 transition-transform ${expandedEra === era.year ? 'rotate-180' : ''}`}
                                                fill="none"
                                                viewBox="0 0 24 24"
                                                stroke="currentColor"
                                            >
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                            </svg>
                                        </div>
                                    </div>

                                    {expandedEra === era.year && (
                                        <div className="bg-gray-50 border-t border-gray-200">
                                            <div className="p-4 max-h-[400px] overflow-y-auto">
                                                <ul className="space-y-2">
                                                    {era.tracks.map((track: TimeMachineTrack, idx: number) => (
                                                        <li
                                                            key={`${track.id}-${idx}`}
                                                            className="flex justify-between items-center p-3 bg-white rounded border border-gray-100 shadow-sm hover:border-purple-200 transition-colors"
                                                        >
                                                            <div className="flex-1 min-w-0 pr-4">
                                                                <p className="text-sm font-medium text-gray-900 truncate">
                                                                    {track.name}
                                                                </p>
                                                                <p className="text-xs text-gray-500 truncate mt-0.5">
                                                                    {track.artists.join(', ')}
                                                                </p>
                                                            </div>
                                                            <div className="text-right flex-shrink-0">
                                                                <span className="text-xs font-mono text-gray-400">
                                                                    {formatMinutes(track.durationMs)}
                                                                </span>
                                                            </div>
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default TimeMachinePanel;
