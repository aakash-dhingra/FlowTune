import { api } from './api';
import type { AutoCleanerAnalysis, AutoCleanerGroupName } from '../types/autoCleaner';

export const analyzeAutoCleaner = async (): Promise<AutoCleanerAnalysis> => {
  const response = await api.post<{ success: boolean; data: AutoCleanerAnalysis }>('/auto-cleaner/analyze');
  return response.data.data;
};

export const createCleanerPlaylist = async (params: { groupName: AutoCleanerGroupName; playlistName?: string }) => {
  const response = await api.post<{
    success: boolean;
    data: { playlistId: string; playlistUrl: string | null; trackCount: number; groupName: AutoCleanerGroupName };
  }>('/auto-cleaner/create-playlist', params);

  return response.data.data;
};

export const removeCleanerDuplicates = async () => {
  const response = await api.post<{ success: boolean; data: { removedCount: number } }>(
    '/auto-cleaner/remove-duplicates'
  );

  return response.data.data;
};

export const archiveCleanerLowPlayed = async (popularityThreshold = 35) => {
  const response = await api.post<{
    success: boolean;
    data: { archivedCount: number; playlistUrl: string | null; playlistId: string | null };
  }>('/auto-cleaner/archive-low-played', { popularityThreshold });

  return response.data.data;
};
