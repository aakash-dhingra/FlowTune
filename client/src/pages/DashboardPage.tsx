import { useEffect, useState } from 'react';
import AutoCleanerPanel from '../components/AutoCleanerPanel';
import FeatureCard from '../components/FeatureCard';
import Header from '../components/Header';
import { getAuthUser, logout, redirectToSpotifyLogin, type AuthUser } from '../services/auth';
import type { FeatureCard as FeatureCardType } from '../types/dashboard';

const features: FeatureCardType[] = [
  {
    id: 'cleaner',
    title: 'Playlist Auto-Cleaner',
    description:
      'Cluster liked tracks into high energy, chill, emotional, and mixed groups. Create focused playlists and prune noisy libraries.',
    status: 'Ready'
  },
  {
    id: 'mood',
    title: 'Mood Playlist Generator',
    description:
      'Generate playlists from energy, mood, and duration targets with a smooth progression curve powered by Spotify recommendations.',
    status: 'Upcoming'
  },
  {
    id: 'time',
    title: 'Time-Based Playlist Builder',
    description:
      'Assemble playlists to match exact activity time windows while balancing BPM flow and artist variety.',
    status: 'Upcoming'
  }
];

const DashboardPage = () => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoadingUser, setIsLoadingUser] = useState(true);

  useEffect(() => {
    const loadAuth = async () => {
      const authUser = await getAuthUser();
      setUser(authUser);
      setIsLoadingUser(false);
    };

    void loadAuth();
  }, []);

  const handleLogin = () => {
    redirectToSpotifyLogin();
  };

  const handleLogout = async () => {
    await logout();
    setUser(null);
  };

  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl px-4 py-8 md:px-8 md:py-12">
      <Header
        isAuthenticated={Boolean(user)}
        spotifyId={user?.spotifyId}
        onLogin={handleLogin}
        onLogout={() => {
          void handleLogout();
        }}
      />

      {isLoadingUser ? (
        <div className="mb-6 rounded-xl border border-borderSoft bg-card/50 p-4 text-sm text-slate-300">
          Checking Spotify session...
        </div>
      ) : user ? (
        <div className="mb-6 rounded-xl border border-emerald-400/30 bg-emerald-500/10 p-4 text-sm text-emerald-200">
          Authenticated. Your FlowTune session is stored in an HTTP-only cookie.
        </div>
      ) : (
        <div className="mb-6 rounded-xl border border-amber-400/30 bg-amber-500/10 p-4 text-sm text-amber-100">
          Sign in with Spotify to start generating and cleaning playlists.
        </div>
      )}

      <section className="grid gap-4 md:grid-cols-3">
        {features.map((feature) => (
          <FeatureCard key={feature.id} feature={feature} />
        ))}
      </section>

      <AutoCleanerPanel enabled={Boolean(user)} />
    </main>
  );
};

export default DashboardPage;
