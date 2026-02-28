# Railway Deployment Guide

## Prerequisites
- GitHub account with your repo pushed
- Railway account (free at railway.app)
- Spotify Developer credentials (register after getting callback URI)

## Step-by-Step Deployment

### 1. Create a Railway Project
1. Go to [railway.app](https://railway.app)
2. Sign in with GitHub
3. Click "Create New Project"
4. Select "Deploy from GitHub repo"
5. Connect your MusicAI repository

### 2. Configure Environment Variables
Railway will automatically detect your project structure. Add these environment variables:

**Required (Get from Spotify after registration):**
```
SPOTIFY_CLIENT_ID=your_spotify_client_id
SPOTIFY_CLIENT_SECRET=your_spotify_client_secret
SPOTIFY_REDIRECT_URI=https://your-railway-app.up.railway.app/api/auth/callback
```

**Database (Railway will create automatically):**
```
DATABASE_URL=postgresql://[user]:[password]@[host]:[port]/[database]
```

**Server Configuration:**
```
NODE_ENV=production
PORT=5000
CLIENT_URL=https://your-railway-app.up.railway.app
COOKIE_SECRET=generate_a_strong_32_character_secret_here
```

### 3. Add PostgreSQL Database
1. In your Railway project, click "Add Service"
2. Select "PostgreSQL"
3. Railway will auto-populate the `DATABASE_URL` env variable

### 4. Deploy
Once you push to GitHub, Railway will automatically:
1. Build the client (`npm run build` in client/)
2. Build the server (`tsc` in server/)
3. Run the server which serves the built client

### 5. Get Your Callback URI
After deployment succeeds:
1. Go to your Railway project's "Deployments" tab
2. Click the deployed service
3. Your app URL will be shown (e.g., `https://musicai-production.railway.app`)
4. Your **Callback URI for Spotify** is: `https://your-app-url.railway.app/api/auth/callback`

### 6. Register on Spotify Developer Dashboard
1. Go to [developer.spotify.com](https://developer.spotify.com)
2. Create/Login to your app
3. Set Redirect URI to your callback URI from step 5
4. Copy your Client ID and Client Secret
5. Update them in Railway environment variables
6. Redeploy

## Troubleshooting

**Build fails with "client not found":**
- Make sure you're at the MusicAI root directory
- Check that client/dist exists after local build

**Database connection error:**
- Verify DATABASE_URL is set correctly in Railway
- Run migrations: `npx prisma migrate deploy`

**CORS errors:**
- Make sure CLIENT_URL matches your Railway app URL
- No trailing slashes in CLIENT_URL

**Callback URI mismatch:**
- Make sure SPOTIFY_REDIRECT_URI exactly matches what's registered in Spotify Dashboard
- Include the full path: `/api/auth/callback`

## Useful Commands

Once deployed, you can ssh into Railway and run:
```bash
# Run migrations
npx prisma migrate deploy

# View database
npx prisma studio
```

## Local Testing Before Deploy
```bash
# Build both client and server
cd server && npm run build

# Test locally
cd server && npm run start
# Visit http://localhost:5000
```
