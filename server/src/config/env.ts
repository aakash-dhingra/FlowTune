import dotenv from 'dotenv';

dotenv.config();

const required = ['PORT', 'DATABASE_URL', 'COOKIE_SECRET'] as const;

for (const key of required) {
  if (!process.env[key]) {
    throw new Error(`Missing required env var: ${key}`);
  }
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'production',
  port: Number(process.env.PORT ?? 5000),
  clientUrl: process.env.CLIENT_URL ?? 'http://localhost:3000',
  databaseUrl: process.env.DATABASE_URL as string,
  spotifyClientId: process.env.SPOTIFY_CLIENT_ID ?? 'not_configured_yet',
  spotifyClientSecret: process.env.SPOTIFY_CLIENT_SECRET ?? 'not_configured_yet',
  spotifyRedirectUri: process.env.SPOTIFY_REDIRECT_URI ?? 'http://localhost:5000/api/auth/callback',
  cookieSecret: process.env.COOKIE_SECRET as string
};

