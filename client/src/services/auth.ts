import { api } from './api';

export type AuthUser = {
  id: string;
  spotifyId: string;
  createdAt: string;
};

export const getAuthUser = async (): Promise<AuthUser | null> => {
  try {
    const response = await api.get<{ success: boolean; data: AuthUser }>('/auth/me');
    return response.data.data;
  } catch {
    return null;
  }
};

export const logout = async (): Promise<void> => {
  await api.post('/auth/logout');
};

export const redirectToSpotifyLogin = (): void => {
  const apiBase = import.meta.env.VITE_API_URL ?? 'http://localhost:5000/api';
  window.location.href = `${apiBase}/auth/login`;
};
