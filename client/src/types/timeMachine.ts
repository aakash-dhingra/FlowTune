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
