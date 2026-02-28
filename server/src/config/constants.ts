export const COOKIE_NAMES = {
  session: 'flowtune_session',
  spotifyState: 'flowtune_spotify_state'
} as const;

export const COOKIE_MAX_AGE = {
  sessionMs: 1000 * 60 * 60 * 24 * 30,
  stateMs: 1000 * 60 * 10
} as const;
