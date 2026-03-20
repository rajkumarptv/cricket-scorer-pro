# 🏏 Cricket Scorer Pro

Green-themed live cricket scoring app with YouTube & Facebook Live integration.

## Features

- ✅ Ball-by-ball scoring (runs, wide, no ball, bye, leg bye, wicket)
- ✅ Free hit auto-detection
- ✅ Strike rotation logic
- ✅ Full scorecard (batting + bowling stats)
- ✅ YouTube Live — auto-updates broadcast title with live score
- ✅ Facebook Live — posts score updates as comments on every over & wicket
- ✅ OBS Stream Overlay at `/overlay/{matchId}`
- ✅ Undo last ball
- ✅ Target & required runs (2nd innings)
- ✅ Green theme UI

## Setup

### 1. Install dependencies
```bash
npm install
```

### 2. Create `.env` file
```
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
APP_URL=http://localhost:3000
FACEBOOK_PAGE_ACCESS_TOKEN=your_fb_page_token
FACEBOOK_PAGE_ID=your_fb_page_id
```

### 3. Run locally
```bash
npm run dev
```

### 4. Deploy to Railway
- Push to GitHub
- Connect repo in Railway
- Add environment variables in Railway dashboard
- Update Google OAuth redirect URI to your Railway URL

## Google OAuth Setup

In Google Cloud Console → OAuth Client → Authorized redirect URIs:
```
https://your-app.railway.app/auth/google/callback
```

## Facebook Live Setup

1. Go to Facebook Live dashboard
2. Create a Live video
3. Copy the Video ID from the URL
4. Paste it in the Match Setup form
5. Get Page Access Token from Meta Developer Console

## OBS Overlay

Add a Browser Source in OBS:
```
URL: https://your-app.railway.app/overlay/{matchId}
Width: 1920, Height: 1080
Custom CSS: body { background: transparent !important; }
```

## Tech Stack

- Frontend: React + TypeScript + Tailwind CSS
- Backend: Express.js + Node.js
- Database: SQLite (better-sqlite3)
- YouTube: Google APIs
- Facebook: Graph API v19
- Build: Vite
