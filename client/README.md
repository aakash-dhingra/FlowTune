# FlowTune Client

Frontend for FlowTune built with Vite + React + TypeScript + TailwindCSS.

## Setup
1. Install dependencies:
   - `npm install`
2. Copy environment file:
   - `cp .env.example .env`
3. Start development server:
   - `npm run dev`

## Scripts
- `npm run dev`
- `npm run build`
- `npm run preview`

## Auth flow
- Click `Login with Spotify` in the dashboard.
- Browser is redirected to backend `/api/auth/login`.
- After Spotify consent, backend sets HTTP-only session cookie and redirects back to client.

## Auto-Cleaner
- Open the dashboard and run `Analyze Liked Tracks`.
- Review grouped clusters (`High Energy`, `Chill`, `Emotional`, `Mixed`).
- Use action buttons to create a playlist from a group, remove duplicate liked tracks, or archive low-played songs.
