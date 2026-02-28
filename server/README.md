# FlowTune Server

Backend service for FlowTune (Spotify intelligence SaaS).

## Stack
- Node.js + Express
- TypeScript
- Prisma ORM
- PostgreSQL

## Setup
1. Install dependencies:
   - `npm install`
2. Copy environment file:
   - `cp .env.example .env`
3. Update `.env` values with your credentials.
4. Generate Prisma client:
   - `npm run prisma:generate`
5. Run migrations:
   - `npm run prisma:migrate`
6. Start dev server:
   - `npm run dev`

## Scripts
- `npm run dev`
- `npm run build`
- `npm run start`
- `npm run prisma:generate`
- `npm run prisma:migrate`
- `npm run prisma:studio`

## Current status
- Backend architecture scaffolded.
- Spotify OAuth implemented with secure HTTP-only signed cookie session.
- Auto token refresh middleware implemented for authenticated Spotify calls.
- Playlist Auto-Cleaner implemented (analyze, create playlist by cluster, remove duplicates, archive low-played songs).
- Mood and Time Builder endpoints are still stubbed and will be implemented in subsequent phases.

## OAuth endpoints
- `GET /api/auth/login` redirects to Spotify authorization.
- `GET /api/auth/callback` exchanges code, stores tokens in database, sets session cookie, redirects to client.
- `GET /api/auth/me` returns current authenticated user from cookie session.
- `POST /api/auth/logout` clears session cookie.

## Auto-Cleaner endpoints
- `POST /api/auto-cleaner/analyze`
- `POST /api/auto-cleaner/create-playlist` with body `{ "groupName": "High Energy|Chill|Emotional|Mixed", "playlistName": "optional" }`
- `POST /api/auto-cleaner/remove-duplicates`
- `POST /api/auto-cleaner/archive-low-played` with optional body `{ "popularityThreshold": 35 }`
