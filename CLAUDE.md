# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Backend (Node.js + Express)
```bash
cd backend
npm install          # install dependencies
npm run dev          # start with nodemon (auto-reload)
npm start            # start without auto-reload
```

### Frontend (React + Vite)
```bash
cd frontend
npm install          # install dependencies
npm run dev          # start dev server at http://localhost:5173
npm run build        # production build
npm run lint         # run ESLint
npm run preview      # preview production build
```

### Environment setup
```bash
cp .env.example .env   # then fill in API keys
```

Required: `GOOGLE_MAPS_API_KEY` and `VITE_GOOGLE_MAPS_KEY`
Optional: `APIFY_API_TOKEN`, `FACEBOOK_ACCESS_TOKEN`
Set `VITE_MOCK=true` to run frontend without real API calls.

## Architecture

### Overview
Full-stack lead generation app: users search for local businesses via Google Maps, backend enriches them with social presence (LinkedIn/Facebook/Instagram/TikTok) and computes an opportunity score 0–100.

### Backend (`backend/`)
- **Entry point**: `server.js` — Express app with CORS locked to `localhost:5173`
- **Routes**:
  - `POST /api/leads/search` (`routes/leads.js`) — main search endpoint
  - `GET /api/export` (`routes/export.js`) — CSV export
  - `routes/sheets.js` — Google Sheets export
- **Services pipeline** (called in sequence per search):
  1. `googlePlaces.js` — Nearby Search + Place Details via Google Maps Services JS
  2. `googleReviews.js` — fetches reviews per place; `apifyReviews.js` as alternate source
  3. `socialEnrichment.js` — detects LinkedIn/FB/IG/TikTok presence; `linkedinScraper.js` for LinkedIn
  4. `scoring.js` — computes score (Google rating 30pts + review volume 25pts + digital presence 25pts + opportunity 20pts)
  5. `reviewAnalysis.js` / `aiReviewAnalysis.js` — optional AI-powered review analysis using `@anthropic-ai/sdk`

### Frontend (`frontend/src/`)
- **State**: `App.jsx` holds global leads state; results flow down to `Map.jsx` and `LeadsList.jsx` simultaneously
- **Layout**: 3-column — SearchPanel (left, 350px) | Map (center, flex) | LeadDetail overlay (right)
- **Map**: Uses `react-map-gl` + `maplibre-gl` (not Leaflet as originally documented — docs are outdated)
- **Hooks**:
  - `useLeads.js` — POSTs to `/api/leads/search`, manages loading/error state
  - `useMap.js` — geocoding, map center
  - `useExport.js` — CSV download logic
- **Lead statuses** (`new`/`contacted`/`favorite`/`ignored`) are persisted in `localStorage`
- **PDF export**: Uses `@react-pdf/renderer`

### Data model
Each lead contains: place metadata (id, name, address, phone, website, lat/lng, distance), `google` object (rating, totalReviews, priceLevel, openNow, reviews[]), `social` object (linkedin/facebook/instagram/tiktok URLs), and `score` object (total + breakdown).

### Key architectural note
The frontend proxies all `/api/*` requests to `localhost:3001` via Vite's dev proxy (`vite.config.js`). In production, you'd need a reverse proxy or env-based URL configuration.

## Dernières modifications
- `2026-04-03 18:15:00` — modifié `frontend/src/components/ScoringProfileDrawer.jsx`
- `2026-04-03 18:14:56` — modifié `frontend/src/components/ScoringProfileDrawer.jsx`
- `2026-04-03 18:14:52` — modifié `frontend/src/components/ScoringProfileDrawer.jsx`
- `2026-04-03 18:14:48` — modifié `frontend/src/components/ScoringProfileDrawer.jsx`
- `2026-04-03 18:14:43` — modifié `frontend/src/components/ScoringProfileDrawer.jsx`


## Dernières modifications
- `2026-04-03 22:06:26` — modifié `frontend/src/components/LeadDetail.jsx`
- `2026-04-03 22:01:58` — modifié `frontend/src/components/LeadDetail.jsx`
- `2026-04-03 21:59:23` — modifié `frontend/src/components/LeadDetail.jsx`
- `2026-04-03 21:57:40` — modifié `frontend/src/components/LeadDetail.jsx`
- `2026-04-03 21:52:45` — modifié `frontend/src/components/LeadDetail.jsx`

