import { api } from './api';
import type { TimeMachineAnalysis } from '../types/timeMachine';

export const analyzeTimeMachine = async (): Promise<TimeMachineAnalysis> => {
    const { data } = await api.get<{ success: boolean; analysis: TimeMachineAnalysis }>('/time-machine/analyze');
    return data.analysis;
};

export const createTimeMachinePlaylist = async (params: { year: string; customName?: string }) => {
    const { data } = await api.post<{
        success: boolean;
        data: {
            playlistId: string;
            playlistUrl: string | null;
            trackCount: number;
            year: string;
        };
    }>('/time-machine/create-playlist', params);
    return data.data;
};
