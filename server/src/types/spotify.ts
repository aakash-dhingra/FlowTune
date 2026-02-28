export type SpotifyTokenResponse = {
  access_token: string;
  token_type: string;
  scope: string;
  expires_in: number;
  refresh_token?: string;
};

export type SpotifyMeResponse = {
  id: string;
  display_name: string | null;
  email?: string;
};
