export type AutoCleanerGroupName = 'Mainstream Hits' | 'Popular Tracks' | 'Hidden Gems' | 'Underground';

export type AutoCleanerTrack = {
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

export type AutoCleanerGroup = {
  name: AutoCleanerGroupName;
  tracks: AutoCleanerTrack[];
};

export type AutoCleanerAnalysis = {
  groups: AutoCleanerGroup[];
  totalTracks: number;
  duplicateCandidates: number;
  lowPlayedCandidates: number;
};
