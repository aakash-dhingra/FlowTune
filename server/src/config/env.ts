import dotenv from 'dotenv';

dotenv.config();

const required = [
  'PORT',
  'CLIENT_URL',
  'DATABASE_URL',
  'SPOTIFY_CLIENT_ID',
  'SPOTIFY_CLIENT_SECRET',
  'SPOTIFY_REDIRECT_URI',
  'COOKIE_SECRET'
] as const;

for (const key of required) {
  if (!process.env[key]) {
    throw new Error(`Missing required env var: ${key}`);
  }
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 5000),
  clientUrl: process.env.CLIENT_URL as string,
  databaseUrl: process.env.DATABASE_URL as string,
  spotifyClientId: process.env.SPOTIFY_CLIENT_ID as string,
  spotifyClientSecret: process.env.SPOTIFY_CLIENT_SECRET as string,
  spotifyRedirectUri: process.env.SPOTIFY_REDIRECT_URI as string,
  cookieSecret: process.env.COOKIE_SECRET as string
};
