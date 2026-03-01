import { useMemo, useState } from 'react';
import {
  analyzeAutoCleaner,
  archiveCleanerLowPlayed,
  createCleanerPlaylist,
  removeCleanerDuplicates
} from '../services/autoCleaner';
import type { AutoCleanerAnalysis, AutoCleanerGroupName } from '../types/autoCleaner';

type Props = {
  enabled: boolean;
};

const formatMinutes = (durationMs: number) => {
  const totalSeconds = Math.floor(durationMs / 1000);
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins}:${String(secs).padStart(2, '0')}`;
};

const AutoCleanerPanel = ({ enabled }: Props) => {
  const [analysis, setAnalysis] = useState<AutoCleanerAnalysis | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [message, setMessage] = useState<string>('');
  const [error, setError] = useState<string>('');

  const groupCounts = useMemo(() => {
    if (!analysis) {
      return '';
    }

    return analysis.groups.map((group) => `${group.name}: ${group.tracks.length}`).join(' | ');
  }, [analysis]);

  const fetchAnalysis = async () => {
    const data = await analyzeAutoCleaner();
    setAnalysis(data);
    return data;
  };

  const runAnalyze = async () => {
    if (!enabled) {
      return;
    }

    try {
      setBusyAction('analyze');
      setError('');
      setMessage('');
      await fetchAnalysis();
      setMessage('Auto-cleaner analysis complete.');
    } catch {
      setError('Failed to analyze liked tracks. Check your Spotify connection and try again.');
    } finally {
      setBusyAction(null);
    }
  };

  const handleCreatePlaylist = async (groupName: AutoCleanerGroupName) => {
    try {
      setBusyAction(`create-${groupName}`);
      setError('');
      const result = await createCleanerPlaylist({ groupName });
      setMessage(
        result.playlistUrl
          ? `Created ${groupName} playlist with ${result.trackCount} tracks: ${result.playlistUrl}`
          : `Created ${groupName} playlist with ${result.trackCount} tracks.`
      );
    } catch {
      setError(`Failed to create playlist for ${groupName}.`);
    } finally {
      setBusyAction(null);
    }
  };

  const handleRemoveDuplicates = async () => {
    try {
      setBusyAction('remove-duplicates');
      setError('');
      const result = await removeCleanerDuplicates();
      setMessage(`Removed ${result.removedCount} duplicate liked tracks.`);
      await fetchAnalysis();
    } catch {
      setError('Failed to remove duplicates.');
    } finally {
      setBusyAction(null);
    }
  };

  const handleArchiveLowPlayed = async () => {
    try {
      setBusyAction('archive-low-played');
      setError('');
      const result = await archiveCleanerLowPlayed(35);
      setMessage(
        result.archivedCount > 0
          ? result.playlistUrl
            ? `Archived ${result.archivedCount} low-played songs: ${result.playlistUrl}`
            : `Archived ${result.archivedCount} low-played songs.`
          : 'No low-played songs found to archive.'
      );
      await fetchAnalysis();
    } catch {
      setError('Failed to archive low-played songs.');
    } finally {
      setBusyAction(null);
    }
  };

  return (
    <section className="mt-8 rounded-2xl border border-borderSoft bg-card/70 p-5 md:p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-100">Playlist Auto-Cleaner</h2>
          <p className="mt-1 text-sm text-slate-300">
            Analyze liked tracks by audio features and take cleanup actions directly from FlowTune.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            void runAnalyze();
          }}
          disabled={!enabled || busyAction !== null}
          className="rounded-xl border border-cyan-300/30 bg-cyan-500/20 px-4 py-2 text-sm font-medium text-cyan-100 transition enabled:hover:bg-cyan-500/30 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busyAction === 'analyze' ? 'Analyzing...' : 'Analyze Liked Tracks'}
        </button>
      </div>

      {analysis ? (
        <div className="mt-4 rounded-xl border border-borderSoft bg-slate-900/60 p-4 text-sm text-slate-300">
          <p>Total tracks analyzed: {analysis.totalTracks}</p>
          <p>Duplicate candidates: {analysis.duplicateCandidates}</p>
          <p>Low-played candidates: {analysis.lowPlayedCandidates}</p>
          <p className="mt-1 text-xs uppercase tracking-[0.14em] text-slate-400">{groupCounts}</p>
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-3">
        <button
          type="button"
          disabled={!enabled || !analysis || busyAction !== null}
          onClick={() => {
            void handleRemoveDuplicates();
          }}
          className="rounded-lg border border-slate-400/30 bg-slate-500/20 px-3 py-2 text-sm text-slate-100 transition enabled:hover:bg-slate-500/30 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busyAction === 'remove-duplicates' ? 'Removing...' : 'Remove Duplicates'}
        </button>

        <button
          type="button"
          disabled={!enabled || !analysis || busyAction !== null}
          onClick={() => {
            void handleArchiveLowPlayed();
          }}
          className="rounded-lg border border-amber-300/30 bg-amber-500/20 px-3 py-2 text-sm text-amber-100 transition enabled:hover:bg-amber-500/30 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busyAction === 'archive-low-played' ? 'Archiving...' : 'Archive Low-Played Songs'}
        </button>
      </div>

      {message ? (
        <div className="mt-4 rounded-lg border border-emerald-400/30 bg-emerald-500/10 p-3 text-sm text-emerald-200">
          {message}
        </div>
      ) : null}

      {error ? (
        <div className="mt-4 rounded-lg border border-rose-400/30 bg-rose-500/10 p-3 text-sm text-rose-200">{error}</div>
      ) : null}

      {analysis ? (
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {analysis.groups.map((group) => (
            <article key={group.name} className="rounded-xl border border-borderSoft bg-slate-900/40 p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h3 className="text-base font-semibold text-slate-100">{group.name}</h3>
                <button
                  type="button"
                  disabled={busyAction !== null || group.tracks.length === 0}
                  onClick={() => {
                    void handleCreatePlaylist(group.name);
                  }}
                  className="rounded-md border border-cyan-300/30 bg-cyan-500/20 px-2.5 py-1.5 text-xs text-cyan-100 transition enabled:hover:bg-cyan-500/30 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {busyAction === `create-${group.name}` ? 'Creating...' : 'Create Playlist'}
                </button>
              </div>

              {group.tracks.length === 0 ? (
                <p className="text-sm text-slate-400">No tracks in this cluster.</p>
              ) : (
                <ul className="space-y-2">
                  {group.tracks.slice(0, 6).map((track) => (
                    <li key={`${group.name}-${track.id}`} className="rounded-md border border-borderSoft bg-slate-950/40 p-2.5">
                      <p className="text-sm font-medium text-slate-100">{track.name}</p>
                      <p className="text-xs text-slate-400">{track.artists.join(', ')}</p>
                      <p className="mt-1 text-[11px] uppercase tracking-[0.12em] text-slate-500">
                        {formatMinutes(track.durationMs)}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
};

export default AutoCleanerPanel;
