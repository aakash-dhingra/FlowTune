import { api } from './api';
import type { RecommendedTrack } from '../types/recommendation';

export const getRecommendations = async (): Promise<RecommendedTrack[]> => {
    const { data } = await api.get<{ success: boolean; data: RecommendedTrack[] }>('/recommendations');
    return data.data;
};
