# Architecture complète — LeadGenPro

## Vue d'ensemble

LeadGenPro est un outil de prospection B2B qui cherche des entreprises locales via Google Maps, les enrichit avec des données externes, les score selon un profil métier, et génère des pitches email personnalisés. Stack : **Node.js/Express** + **React/Vite**, communication par **SSE streaming**.

---

## Flux utilisateur complet

```
Utilisateur remplit SearchPanel
        ↓
POST /api/leads/search/stream  (SSE)
        ↓
  ┌─────────────────────────────────────┐
  │         searchPlaces()              │
  │  Google Nearby Search (3 pages max) │
  │  → cache 7j (lat-lng-radius-domain) │
  └──────────────┬──────────────────────┘
                 ↓
  ┌─────────────────────────────────────┐
  │        enrichBatch()                │
  │  Batch de 10 places en parallèle   │
  │  → Place Details (7j cache)        │
  │  → Description scraping (6 sources)│
  │  → Reviews (cache)                  │
  └──────────────┬──────────────────────┘
                 ↓
  ┌─────────────────────────────────────┐
  │       processPlaces()               │
  │  Pour chaque place (timeout 30s) :  │
  │  ├─ enrichSocial() [LinkedIn/FB/IG] │
  │  └─ searchPappers() [CA/effectifs]  │
  │  → buildLead() → computeScore()     │
  │  Log: [Enrich] Lead X/Y terminé    │
  └──────────────┬──────────────────────┘
                 ↓
  ┌─────────────────────────────────────┐
  │     applyPostProcessing()           │
  │  competitorAvg, benchmarkPercentile │
  │  isActiveOwner +5pts, newBusiness+15│
  └──────────────┬──────────────────────┘
                 ↓
  SSE: { type: 'done', leads[], total }
        ↓
  Frontend affiche Map + LeadsList
```

---

## Architecture backend

### `server.js`
Point d'entrée. Monte 5 groupes de routes, CORS localisé sur les ports 5173–5175, handlers crash globaux.

### Routes

| Route | Fichier | Description |
|-------|---------|-------------|
| `POST /api/leads/search/stream` | `routes/leads.js` | **Principal** — SSE streaming |
| `POST /api/leads/search` | `routes/leads.js` | Version synchrone (legacy) |
| `POST /api/leads/analyze/:placeId` | `routes/leads.js` | Analyse IA Claude |
| `POST /api/leads/generate-email` | `routes/leads.js` | Génération email par profil |
| `POST /api/leads/reviews/:placeId` | `routes/leads.js` | Scraping 100 avis Apify |
| `POST /api/leads/pappers` | `routes/leads.js` | Données financières |
| `POST /api/leads/decision-maker` | `routes/leads.js` | LinkedIn + Hunter.io |
| `POST /api/leads/semrush` | `routes/leads.js` | SEO data via Apify |
| `POST /api/leads/visual-analysis` | `routes/visualAnalysis.js` | Screenshots + Vision IA |
| `GET /api/export/csv` | `routes/export.js` | Export CSV UTF-8 BOM |
| `POST /api/sheets/lead` | `routes/sheets.js` | Sauvegarde Google Sheets |
| `GET /api/profiles` | `routes/profiles.js` | CRUD profils de scoring |
| `GET /api/cache/stats` | `routes/cache.js` | Stats hits/miss par namespace |

### Services

```
services/
├── googlePlaces.js       ← Nearby Search, Place Details, TextSearch, description scraping
├── googleReviews.js      ← Reviews via Place Details (cache 7j)
├── apifyReviews.js       ← 100 avis Google via Apify actor
├── socialEnrichment.js   ← Détection LinkedIn/FB/IG/TikTok depuis HTML du site
├── linkedinScraper.js    ← Dirigeant : Google Search → website scrape → Hunter.io
├── pappersService.js     ← Données financières Pappers.fr (7 stratégies de recherche)
├── scoring.js            ← Calcul score 0-100 par profil
├── reviewAnalysis.js     ← Analyse synchrone des avis (keywords, sentiment)
├── aiReviewAnalysis.js   ← Analyse + email via Claude (Anthropic SDK)
├── pagespeedService.js   ← PageSpeed + CrUX + Custom Search + NAP check
├── semrushService.js     ← Authority/trafic/backlinks via Apify radeance~semrush-scraper
├── socialMediaService.js ← Activité FB/IG (followers, dernier post, label activité)
├── visualAnalysisService.js ← Screenshots Puppeteer + Claude Vision
├── visualSocialService.js   ← Photos réseaux via Apify + Claude Vision
└── photoQualityService.js   ← Qualité photos Google + Claude Vision
```

---

## Système de scoring

```
Score final (0–100) = somme pondérée de 4 critères

┌──────────────────────┬──────────┬────────────────────────────────────┐
│ Critère              │ Défaut   │ Logique                            │
├──────────────────────┼──────────┼────────────────────────────────────┤
│ googleRating         │ 30 pts   │ 4.5→100, 4.0→73, 3.5→47, <3.5→17 │
│ reviewVolume         │ 25 pts   │ 500+→100, 100+→60, 20+→20, <20→0  │
│ digitalPresence      │ 25 pts   │ site+40, FB+20, IG+20, LI+12, TK+8│
│ opportunity          │ 20 pts   │ Variable selon le profil actif     │
├──────────────────────┼──────────┼────────────────────────────────────┤
│ Bonus isActiveOwner  │ +5 pts   │ ≥3 réponses owner sur 5 derniers   │
│ Bonus newBusiness    │ +15 pts  │ <6 mois OU <10 avis                │
└──────────────────────┴──────────┴────────────────────────────────────┘
```

**12 profils preset** (dont 4 avec opportunité custom) :
- **Chatbot** : opportunity×70% — pénalise les avis négatifs sans réponse
- **Photographe** : opportunity×45% — pénalise les photos existantes, récompense l'absence d'IG/TikTok
- **SEO** : digitalPresence×60% — pénalise les mauvaises métriques PageSpeed
- **Social Media** : digitalPresence×55%

---

## Système de cache

```
backend/cache/
├── searchCache.js      ← Factory createCache(name) — UNIQUE fichier JSON
├── apiCache.json       ← Toutes les données persistées (ignoré par git)
└── pappers-cache.json  ← Cache Pappers séparé (ignoré par git)

Architecture :
  createCache('places')      → namespace "places" dans apiCache.json
  createCache('reviews')     → namespace "reviews"
  createCache('crux')        → namespace "crux"
  createCache('pagespeed')   → namespace "pagespeed"
  createCache('socialMedia') → namespace "socialMedia"
  createCache('indexedPages')→ namespace "indexedPages"

Cycle de vie :
  set() → Map en mémoire + scheduleSave() (debounce 5s)
  scheduleSave() → fs.writeFile() async (NON-BLOQUANT)
  SIGTERM → fs.writeFileSync() synchrone avant extinction
  Démarrage → lecture apiCache.json, restauration entrées non-expirées

TTLs :
  Places / Details / Rank  → 7 jours
  Reviews                  → 7 jours
  PageSpeed / CrUX         → 7 jours
  Social media activity    → 48 heures
  Pappers                  → 1 heure (+ persistance disque)
  Screenshots Puppeteer    → 30 minutes
```

---

## Streaming SSE

```
Frontend                          Backend
   │                                 │
   ├─ fetch POST /search/stream ────►│
   │                                 ├─ res.setHeader('text/event-stream')
   │                                 ├─ res.flushHeaders()
   │                                 │
   │◄── {type:'page', page:1} ───────┤ ← après chaque page Google
   │◄── {type:'enrich', done:3} ─────┤ ← après chaque lead enrichi
   │◄── {type:'cache', key:...} ─────┤ ← cache HIT détecté
   │◄── {type:'done', leads:[...]} ──┤ ← fin du traitement
   │                                 │
   └─ reader.read() loop ────────────┘

Gestion robustesse :
  withTimeout(promise, 30_000, fallback) → jamais bloqué par un service lent
  res.writableEnded check avant chaque write
  nodemon ignore cache/*.json → plus de restart qui tue le SSE
```

---

## Analyse IA (Claude)

```
POST /api/leads/analyze/:placeId
  → aiReviewAnalysis.analyzeWithAI()
      ├─ Sélection 30 avis max (15 récents + 10 négatifs + 5 likés)
      ├─ Contexte injecté : audit Google, PageSpeed, FB/IG activity
      ├─ System prompt adapté au profil (photographe/seo/chatbot/...)
      └─ Retourne rapport Markdown structuré

POST /api/leads/generate-email
  → generateEmail*() par profil
      ├─ Templates intro/preuve/activité par profil (11 profils)
      ├─ Données injectées : note, avis, photos, métriques SEO...
      └─ Retourne { subject, body }

POST /api/leads/visual-analysis
  → visualAnalysisService.captureScreenshot() (Puppeteer)
  → analyzeVisual() (Claude Vision)
      └─ Prompts par profil : designer=cohérence, photo=authenticité, copy=CTA

Modèle : claude-sonnet-4-6 (Anthropic SDK)
```

---

## Architecture frontend

```
frontend/src/
├── App.jsx                    ← État global, layout 3 colonnes, SSE consumer
├── hooks/
│   ├── useLeads.js            ← POST stream, parsing SSE, localStorage statuses
│   └── useScoringProfiles.js  ← CRUD profils, 11 presets, persistance active profile
├── components/
│   ├── NavBar.jsx             ← 5 onglets verticaux (Search/Leads/Favorites/History/Scoring)
│   ├── SearchPanel.jsx        ← Formulaire recherche + recherches sauvegardées
│   ├── LeadsList.jsx          ← Liste triable + LeadCard (score badge, badges sociaux)
│   ├── Map.jsx                ← MapLibre GL, markers couleur-codés, cercle rayon
│   ├── LeadDetail.jsx         ← Panel droit : ~1000 lignes, toutes les actions on-demand
│   ├── ScoringProfileDrawer.jsx ← Sliders poids, création profil custom
│   ├── LeadPDF.jsx            ← @react-pdf/renderer
│   └── SidebarFavorites/History/Leads/Search.jsx
└── utils/
    ├── exportPDF.js           ← jsPDF + html2canvas (3 pages)
    ├── exportAuditPDF.js      ← PDF rapport SEO
    └── sounds.js              ← Web Audio API (click/success/error)
```

**LeadDetail** concentre toute l'interactivité on-demand :
- Analyse IA, email, décisionnaire, Pappers, PageSpeed, SEMrush, visuels réseaux — tous chargés à la demande (idle → loading → done/error)

---

## Modèle de données d'un lead

```javascript
{
  id, name, address, phone, website, lat, lng, distance, domain,
  google:       { rating, totalReviews, priceLevel, openNow, reviews[] },
  social:       { linkedin, facebook, instagram, tiktok, googleBusiness },
  googleAudit:  { hasPhotos, photoCount, hasDescription, descriptionText, hasHours },
  chatbotDetection: { hasChatbot, chatbotsDetected[] },
  pappers:      { dirigeant, chiffreAffaires, effectifs, dateCreation, caEvolution[] },
  score:        { total, breakdown: { googleRating, reviewVolume, digitalPresence, opportunity } },
  reviewAnalysis: { byStars, positive, negative, chatbotOpportunity },
  newBusinessBadge: 'confirmed'|'probable'|null,
  isActiveOwner: boolean,
  competitorAvg, competitorDelta, benchmarkPercentile   // post-processing
}
```

---

## Intégrations externes

| Service | Usage | Cache |
|---------|-------|-------|
| Google Places API | Recherche + détails business | 7j |
| Google PageSpeed | Métriques perf + CrUX | 7j |
| Google Custom Search | Pages indexées | 7j |
| Pappers.fr API | CA, effectifs, dirigeant | 1h |
| Anthropic Claude | Analyse, emails, Vision | Non |
| Apify (reviews) | 100 avis Google Maps | Non |
| Apify (social) | FB/IG/TikTok/Pinterest/YT | 48h |
| Apify (SEMrush) | Authority, trafic, backlinks | Non |
| Hunter.io | Email dirigeant | Non |
| Puppeteer | Screenshots website | 30min |

---

## Design tokens (frontend)

```css
--bg:            #0D1410        /* Dark navy */
--surface:       #111813
--card:          #161D18
--accent:        #1D6E55        /* Forest green */
--accent-yellow: #EDFA36        /* Bright yellow */
--success:       #22c55e
--warning:       #f59e0b
--danger:        #ef4444
--text:          #F5F5F0

--font-display: 'Clash Display'
--font-body:    'Cabinet Grotesk'
--font-mono:    'DM Mono'
```

---

*Généré le 2026-04-04*
