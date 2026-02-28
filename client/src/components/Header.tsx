type Props = {
  isAuthenticated: boolean;
  spotifyId?: string;
  onLogin: () => void;
  onLogout: () => void;
};

const Header = ({ isAuthenticated, spotifyId, onLogin, onLogout }: Props) => {
  return (
    <header className="mb-8 flex flex-col gap-6 rounded-2xl border border-borderSoft bg-card/70 p-6 shadow-glow backdrop-blur md:flex-row md:items-center md:justify-between">
      <div>
        <p className="text-xs uppercase tracking-[0.24em] text-cyan-300">FlowTune Dashboard</p>
        <h1 className="mt-2 text-3xl font-semibold text-white">Spotify Intelligence Layer</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-300">
          Build playlists that fit intent, mood, and time with cleaner audio clustering and smart generation.
        </p>
        {isAuthenticated && spotifyId ? (
          <p className="mt-3 text-xs uppercase tracking-[0.18em] text-slate-400">Connected: {spotifyId}</p>
        ) : null}
      </div>

      {isAuthenticated ? (
        <button
          className="inline-flex items-center justify-center rounded-xl border border-slate-400/30 bg-slate-500/20 px-5 py-3 text-sm font-medium text-slate-100 transition hover:bg-slate-500/30"
          type="button"
          onClick={onLogout}
        >
          Logout
        </button>
      ) : (
        <button
          className="inline-flex items-center justify-center rounded-xl border border-cyan-300/30 bg-cyan-500/20 px-5 py-3 text-sm font-medium text-cyan-100 transition hover:bg-cyan-500/30"
          type="button"
          onClick={onLogin}
        >
          Login with Spotify
        </button>
      )}
    </header>
  );
};

export default Header;
