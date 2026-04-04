# Architecture — LeadGenPro

Stack : **Node.js 20 / Express 4** (backend) + **React 18 / Vite** (frontend)
Communication : **SSE streaming** pour la recherche, REST JSON pour les actions on-demand.

---

## Arborescence réelle

```
leadgen-project/
├── backend/
│   ├── server.js                        ← Point d'entrée Express
│   ├── package.json                     ← nodemonConfig: ignore cache/*.json
│   ├── .env                             ← Clés API (non committé)
│   ├── routes/
│   │   ├── leads.js                     ← Toutes les routes /api/leads/*
│   │   ├── export.js                    ← GET /api/export/csv
│   │   ├── sheets.js                    ← POST /api/sheets/lead
│   │   ├── profiles.js                  ← CRUD /api/profiles
│   │   ├── cache.js                     ← GET /api/cache/stats
│   │   └── visualAnalysis.js            ← POST /api/leads/visual-analysis
│   ├── services/
│   │   ├── googlePlaces.js              ← Nearby Search, Place Details, description scraping
│   │   ├── googleReviews.js             ← Reviews via Place Details (cache 7j)
│   │   ├── apifyReviews.js              ← 100 avis via Apify (compass/google-maps-reviews-scraper)
│   │   ├── socialEnrichment.js          ← Détection LinkedIn/FB/IG/TikTok depuis HTML du site
│   │   ├── linkedinScraper.js           ← Dirigeant : Google Search → scraping → Hunter.io
│   │   ├── pappersService.js            ← Données financières Pappers.fr
│   │   ├── scoring.js                   ← calculateScore() — 4 critères + bonus
│   │   ├── reviewAnalysis.js            ← Analyse synchrone avis (sentiment, keywords)
│   │   ├── aiReviewAnalysis.js          ← analyzeWithAI(), generateEmail*(), generateAuditSEO()
│   │   ├── pagespeedService.js          ← PageSpeed + CrUX + Custom Search + NAP
│   │   ├── semrushService.js            ← Authority/trafic/backlinks via Apify
│   │   ├── socialMediaService.js        ← Activité FB/IG (followers, dernier post)
│   │   ├── benchmarkService.js          ← Percentile sectoriel en mémoire
│   │   ├── visualAnalysisService.js     ← Screenshots Puppeteer + Claude Vision
│   │   ├── visualSocialService.js       ← Photos réseaux via Apify + Claude Vision
│   │   ├── photoQualityService.js       ← Qualité photos Google + Claude Vision
│   │   └── googleSheets.js             ← Écriture Google Sheets (service account)
│   ├── cache/
│   │   ├── searchCache.js               ← Factory createCache(name) — persistance JSON
│   │   ├── apiCache.json                ← Données persistées sur disque (ignoré git)
│   │   └── pappers-cache.json           ← Cache Pappers séparé (ignoré git)
│   └── data/
│       └── scoringProfiles.json         ← Profils custom créés par l'utilisateur
└── frontend/
    ├── vite.config.js                   ← Proxy /api → localhost:3001, proxyTimeout: 0
    ├── index.html
    └── src/
        ├── App.jsx                      ← État global, layout, SSE consumer, LoadingOverlay
        ├── App.css                      ← Design tokens CSS
        ├── main.jsx
        ├── hooks/
        │   ├── useLeads.js              ← Streaming SSE, statuts localStorage, export CSV
        │   └── useScoringProfiles.js    ← 12 profils preset + CRUD profils custom
        ├── components/
        │   ├── NavBar.jsx               ← 5 onglets verticaux (52px)
        │   ├── SidebarSearch.jsx        ← Formulaire recherche + recherches sauvegardées
        │   ├── SidebarLeads.jsx         ← Liste leads + filtres
        │   ├── SidebarFavorites.jsx     ← Leads favoris
        │   ├── SidebarHistory.jsx       ← Historique + pin
        │   ├── ScoringProfileDrawer.jsx ← Sliders poids, création profil custom
        │   ├── Map.jsx                  ← MapLibre GL, markers couleur-codés, cercle rayon
        │   ├── LeadDetail.jsx           ← Panel droit complet (~1000 lignes)
        │   ├── LeadsList.jsx            ← LeadCard triable
        │   ├── LeadPDF.jsx              ← @react-pdf/renderer
        │   ├── Header.jsx
        │   └── SearchPanel.jsx
        └── utils/
            ├── exportPDF.js             ← jsPDF + html2canvas (3 pages)
            ├── exportAuditPDF.js        ← PDF rapport SEO dédié
            └── sounds.js               ← Web Audio API oscillator
```

---

## Flux de données — recherche complète

```
Utilisateur soumet SearchPanel
         │
         ▼
App.onSearch(params)
  → searchLeads({ ...params, weights, profileId })    [useLeads.js]
         │
         ▼
fetch POST /api/leads/search/stream                   [SSE]
         │
         ▼ [routes/leads.js]
─────────────────────────────────────────────────────
1. searchPlaces({ lat, lng, radius, keywords, domain })
     → Google Nearby Search (jusqu'à 3 pages)
     → Déduplique par place_id
     → enrichBatch() par lots de 10 :
         • Place Details API  (7j cache)
         • Description scraping en cascade :
             1. editorial_summary Google
             2. <meta name="description">
             3. og:description / twitter:description
             4. schema.org JSON-LD
             5. zones sémantiques (hero, about, intro)
             6. premier paragraphe visible
         • isActiveOwner : ≥3 réponses owner sur 5 derniers avis
         • ownerReplyRatio : replies / min(totalReviews, 5)
     → SSE: { type:'page', page:N, message }

2. processPlaces(places, { sources, city, weights, profileId })
     Pour chaque place (Promise.all, timeout 30s par appel) :
     ├─ enrichSocial()   → détecte LinkedIn/FB/IG/TikTok/chatbot depuis HTML
     └─ searchPappers()  → CA, effectifs, dirigeant, date création
     → buildLead()       → construit l'objet lead complet
     → calculateScore()  → score 0-100
     → SSE: { type:'enrich', done:N, total:M, message }
     → Log: [Enrich] Lead N/M terminé : NomBusiness

3. applyPostProcessing(leads, { city, domain })
     • competitorAvg   = moyenne des scores du batch
     • competitorDelta = score lead − competitorAvg
     • benchmarkPercentile = percentile sectoriel (benchmarkService)

4. SSE: { type:'done', leads:[], total, fromCache, searchParams }
─────────────────────────────────────────────────────
         │
         ▼ [useLeads.js]
applyStatuses(leads)     ← restaure status + decisionMaker depuis localStorage
setLeads(leads)
setIsLoading(false) après délai 2s
         │
         ▼
App → Map + SidebarLeads re-render
```

---

## Routes backend — tableau complet

| Méthode | Route | Fichier | Description |
|---------|-------|---------|-------------|
| POST | `/api/leads/search/stream` | leads.js | **Principal** — SSE streaming |
| POST | `/api/leads/search` | leads.js | Version synchrone (legacy) |
| POST | `/api/leads/analyze/:placeId` | leads.js | Analyse IA Claude (analyzeWithAI) |
| POST | `/api/leads/generate-email` | leads.js | Email cold — délégation par profileId |
| POST | `/api/leads/reviews/:placeId` | leads.js | 100 avis via Apify |
| POST | `/api/leads/pappers` | leads.js | Données financières Pappers.fr |
| POST | `/api/leads/decision-maker` | leads.js | Dirigeant LinkedIn + Hunter.io |
| POST | `/api/leads/semrush` | leads.js | SEO data via Apify actor |
| POST | `/api/leads/audit` | leads.js | PageSpeed + social + NAP + rang local |
| POST | `/api/leads/visual-analysis` | visualAnalysis.js | Screenshot + Claude Vision |
| GET  | `/api/export/csv` | export.js | CSV UTF-8 BOM |
| POST | `/api/sheets/lead` | sheets.js | Sauvegarde Google Sheets |
| GET  | `/api/profiles` | profiles.js | Liste profils |
| POST | `/api/profiles` | profiles.js | Créer profil custom |
| PUT  | `/api/profiles/:id` | profiles.js | Modifier profil custom |
| DELETE | `/api/profiles/:id` | profiles.js | Supprimer profil custom |
| GET  | `/api/cache/stats` | cache.js | Stats hits/miss par namespace |

---

## Modèle de données — objet lead complet

```js
{
  // Identité
  id:       string,          // place_id Google
  name:     string,
  address:  string,          // vicinity
  phone:    string | null,
  website:  string | null,
  lat:      number,
  lng:      number,
  distance: number,          // km depuis l'origine de recherche (haversine)
  domain:   string | null,   // 'restaurant' | 'beaute' | 'sante' | ...
  keyword:  string | null,   // premier keyword utilisé
  status:   'new' | 'contacted' | 'favorite' | 'rejected',

  // Données Google
  google: {
    rating:       number,    // 0–5
    totalReviews: number,
    priceLevel:   number,    // 1–4
    openNow:      boolean | null,
    reviews: [{
      author:      string,
      rating:      number,
      text:        string,
      time:        string,   // ISO date
      author_reply: string | null,
    }],
  },

  // Présence digitale
  social: {
    linkedin:       string | null,  // URL
    facebook:       string | null,
    instagram:      string | null,
    tiktok:         string | null,
    googleBusiness: string,         // https://maps.google.com/?cid=...
  },

  // Audit fiche Google (sans appel API supplémentaire)
  googleAudit: {
    hasPhotos:         boolean,
    photoCount:        number,
    hasDescription:    boolean,
    descriptionText:   string | null,
    descriptionSource: 'Google' | 'meta SEO' | 'réseaux sociaux' | 'schema.org' | 'contenu page' | null,
    hasHours:          boolean,
  },

  // Détection chatbot (depuis socialEnrichment)
  chatbotDetection: {
    hasChatbot:         boolean,
    chatbotsDetected:   string[],   // ['intercom', 'tidio', ...]
  } | null,

  // Données financières Pappers.fr
  pappers: {
    nom:               string,
    siret:             string,
    siren:             string,
    formeJuridique:    string,
    dateCreation:      string,      // ISO date
    anciennete:        number,      // années
    dirigeant:         string,
    chiffreAffaires:   number,
    resultatNet:       number,
    effectifs:         number,
    anneeFinances:     number,
    caEvolution: [{ annee: number, evolution: number }],
  } | null,

  // Score calculé
  score: {
    total: number,                  // 0–100 (cap)
    breakdown: {
      googleRating:    number,      // ≤ poids googleRating
      reviewVolume:    number,      // ≤ poids reviewVolume
      digitalPresence: number,      // ≤ poids digitalPresence
      opportunity:     number,      // ≤ poids opportunity
      financialCapacity: number,    // affichage uniquement, non additionné
    },
  },

  // Analyse avis (synchrone, reviewAnalysis.js)
  reviewAnalysis: {
    total:         number,
    byStars:       { 5, 4, 3, 2, 1 },
    positiveScore: number,          // %
    negativeScore: number,
    positive: { count, keywords: string[], bestReview },
    negative: { count, keywords: string[], unanswered, worstReview },
    chatbotOpportunity: { score, reasons: string[], urgency: 'critical'|'high'|'medium'|'low' },
  },

  // Post-processing (applyPostProcessing)
  newBusinessBadge:    'confirmed' | 'probable' | null,
  isActiveOwner:       boolean,
  ownerReplyRatio:     number,      // 0–1
  competitorAvg:       number | null,
  competitorDelta:     number | null,
  benchmarkPercentile: number | null,

  // Enrichi on-demand dans LeadDetail (non présent à la recherche)
  decisionMaker?: {
    name:       string | null,
    title:      string | null,
    linkedin:   string | null,
    email:      string | null,
    emailGuess: string[],
    source:     'google' | 'website' | 'hunter',
  },
}
```

---

## Système de scoring — `services/scoring.js`

### Formule générale

```
total = googleRating + reviewVolume + digitalPresence + opportunity
      + (isActiveOwner ? +5 : 0)
      + (newBusinessBadge ? +15 : 0)
      = min(100, résultat)
```

Chaque critère brut est calculé sur 100, puis multiplié par son poids et capé à ce poids :
```js
googleRating = min(poids, round(ratingScore(rating) / 100 * poids))
```

### Barèmes des critères de base

| Critère | Logique |
|---------|---------|
| `ratingScore` | ≥4.5→100, ≥4.0→73, ≥3.5→47, <3.5→17, absent→0 |
| `reviewScore` | ≥500→100, ≥200→80, ≥100→60, ≥50→40, ≥20→20, <20→0 |
| `presenceScore` | site+40, facebook+20, instagram+20, linkedin+12, tiktok+8 (max 100) |

### Opportunité par profil (critère variable)

| profileId | Fonction | Logique principale |
|-----------|----------|--------------------|
| `default`, tous les autres | `opportunityScore` | Pas de site→100, 0 réseau→70, 1→40, 2+→15 |
| `photographe` | `photographeOpportunityScore` | Inverse photos (0→100, 1-5→85, 6-15→65, 16-30→35, 30+→10) + bonus absences IG/TikTok/Pinterest/YT |
| `seo`, `consultant-seo` | `seoOpportunityScore` | Score 50 base + bonus si SEO<50 (+25), perf<50 (+20), LCP>4s (+15), pas HTTPS (+15), pas mobile (+10)... |
| `chatbot`, `dev-chatbot` | `chatbotOpportunityScore` | Base par catégorie (restaurant→80, fleuriste→60, plombier→20) + signaux (CMS, isActiveOwner, effectifs, avis sans réponse) |

### Bonus post-calcul

- `isActiveOwner` : ≥3 réponses owner sur les 5 derniers avis → **+5 pts**
- `newBusinessBadge` : dateCreation Pappers < 6 mois (`'confirmed'`) OU totalReviews < 10 (`'probable'`) → **+15 pts**
- Pénalité `digitalPresence` : fiche incomplète (pas de photos ET pas d'horaires) → **−3 pts**

### Poids des 12 profils preset

| Profil | googleRating | reviewVolume | digitalPresence | opportunity |
|--------|-------------|-------------|----------------|-------------|
| Défaut | 30 | 25 | 25 | 20 |
| Dev Chatbot IA | 10 | 10 | 10 | 70 |
| SEO | 15 | 15 | 60 | 10 |
| Pub Google | 50 | 20 | 20 | 10 |
| Social Media | 10 | 15 | 55 | 20 |
| Photographe | 20 | 15 | 20 | 45 |
| Vidéaste | 15 | 10 | 40 | 35 |
| Designer / Branding | 15 | 10 | 35 | 40 |
| Copywriter / SEO | 20 | 30 | 25 | 25 |
| Développeur Web | 15 | 10 | 45 | 30 |
| Consultant SEO | 10 | 40 | 30 | 20 |
| Email Marketing | 15 | 20 | 30 | 35 |

---

## Système de cache — `cache/searchCache.js`

### Architecture

```
createCache(name)  →  instance Map en mémoire  +  namespace dans apiCache.json

Namespaces actifs :
  'places'       → résultats Nearby Search (7j)
  'details'      → Place Details (7j)
  'reviews'      → avis Google (7j)
  'crux'         → Chrome UX Report (7j)
  'pagespeed'    → PageSpeed Insights (7j)
  'socialMedia'  → activité FB/IG (48h)
  'indexedPages' → Custom Search (7j)
  'localRank'    → rang TextSearch (7j)
```

### Cycle de vie

```
set(key, value, ttlMs)
  → store.set(key, { value, expiresAt: Date.now() + ttlMs })
  → scheduleSave()                  ← debounce 5 secondes

scheduleSave()
  → setTimeout 5s → fs.writeFile() async  ← NON-BLOQUANT

Démarrage (module init)
  → fs.readFileSync(apiCache.json)
  → restaure toutes les entrées non-expirées par namespace

SIGTERM / SIGINT
  → clearTimeout(writeTimer)
  → fs.writeFileSync() synchrone   ← flush avant extinction
  → (pas de process.exit — nodemon gère)

nodemon (package.json)
  → "ignore": ["cache/*.json"]     ← évite restart sur écriture cache → plus d'ECONNRESET SSE
```

### API publique d'une instance

```js
cache.get(key)        // valeur ou null (purge l'entrée expirée)
cache.set(key, v, ms) // stocke + programme flush
cache.has(key)        // boolean, purge si expiré
cache.delete(key)     // supprime + programme flush
cache.clear()         // vide tout + reset compteurs
cache.stats()         // { name, entries, hits, misses, sets, hitRate% }
```

---

## Streaming SSE — protocole complet

### Backend (`routes/leads.js`)

```js
// Headers obligatoires
res.setHeader('Content-Type',  'text/event-stream')
res.setHeader('Cache-Control', 'no-cache')
res.setHeader('Connection',    'keep-alive')
res.flushHeaders()

// Envoi d'un événement
const send = data => {
  if (res.writableEnded) return
  res.write(`data: ${JSON.stringify(data)}\n\n`)
}
```

### Événements émis

| type | Émis quand | Champs |
|------|-----------|--------|
| `page` | Après chaque page Google | `{ page, message }` |
| `progress` | Début du scoring | `{ message }` |
| `enrich` | Après chaque lead enrichi | `{ done, total, message }` |
| `cache` | Cache HIT détecté | `{ message }` |
| `done` | Fin complète | `{ leads[], total, fromCache, searchParams }` |
| `error` | Exception non catchée | `{ message }` |

### Frontend (`hooks/useLeads.js`)

```js
const response = await fetch('/api/leads/search/stream', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(params),
})
const reader  = response.body.getReader()
const decoder = new TextDecoder()
let buffer    = ''

while (true) {
  const { done, value } = await reader.read()
  if (done) break
  buffer += decoder.decode(value, { stream: true })
  const lines = buffer.split('\n')
  buffer = lines.pop()                    // garde la ligne incomplète

  for (const line of lines) {
    if (!line.startsWith('data: ')) continue
    const event = JSON.parse(line.slice(6))
    if (event.type === 'done') {
      setLeads(applyStatuses(event.leads))
      await new Promise(r => setTimeout(r, 2000))  // overlay visible 2s
      break
    }
    if (event.type === 'page' || event.type === 'enrich') {
      setProgress({ message: event.message, current: event.current, total: event.total })
    }
  }
}
```

### Protection contre les timeouts SSE

- Vite proxy : `proxyTimeout: 0, timeout: 0` (vite.config.js)
- Par lead : `withTimeout(promise, 30_000, fallback)` — jamais bloquant
- nodemon : ignore `cache/*.json` — plus de restart intempestif

---

## Analyse IA — fonctions exportées de `aiReviewAnalysis.js`

### `analyzeWithAI(reviews, businessName, profileId, meta, auditData)`

Sélection des avis (max 30) :
- 15 plus récents
- 10 plus négatifs (≤2 étoiles)
- 5 les plus likés
- Dédupliqués par `author|date`

Contexte injecté dans le prompt (`buildContextBlock`) :
- Fiche Google : note, avis, photos, horaires, description
- Site web + PageSpeed : perf, SEO, loadTime, issues
- Réseaux sociaux : FB/IG label activité, followers, dernier post

Retourne : `{ report: string (Markdown), totalReviews, avgRating, unanswered }`

Structure du rapport :
```
🟢 Points forts
🔴 Problèmes critiques
💡 Opportunités d'amélioration
📧 Accroche d'email
```

### `generateEmailPhotographe({ leadData, reviewsData, photoQuality, socialActivity })`

Email spécialisé : met en avant l'absence/qualité des photos Google + réseaux visuels manquants.

### `generateEmailSEO({ leadData, pagespeedData, reviewsData, localRank })`

Email spécialisé : met en avant les métriques PageSpeed faibles, rang local, absence HTTPS/sitemap.

### `generateEmailChatbot({ leadData, pagespeedData, reviewsData })`

Email spécialisé : met en avant les avis négatifs sans réponse, charge d'appels, questions récurrentes.

### `generateAuditSEO({ businessName, websiteUrl, pagespeedData, localRank, napData, indexedPages })`

Rapport SEO complet Markdown : performance, SEO on-page, signaux locaux, NAP, indexation, recommandations priorisées.

### Génération email générique (`POST /api/leads/generate-email`)

Pour tous les autres profils (social-media, videaste, designer, copywriter, dev-web, email-marketing, pub-google) :
- Prompt unique avec injection de `PROFILE_INTRO`, `PROFILE_PROOF`, `PROFILE_ACTIVITY` par profileId
- Extrait les "Problèmes critiques" du rapport IA (2 500 premiers caractères)
- Retourne `{ subject, body }` en JSON strict

---

## Intégrations externes

| Service | Variable env | Utilisé dans | Cache |
|---------|-------------|-------------|-------|
| Google Places API | `GOOGLE_MAPS_API_KEY` | googlePlaces.js | 7j |
| Google PageSpeed Insights | `PAGESPEED_API_KEY` | pagespeedService.js | 7j |
| Google CrUX | `PAGESPEED_API_KEY` | pagespeedService.js | 7j |
| Google Custom Search | `GOOGLE_CSE_KEY` + `GOOGLE_CSE_CX` | pagespeedService.js | 7j |
| Pappers.fr | `PAPPERS_API_KEY` | pappersService.js | 1h + disque |
| Anthropic Claude | `ANTHROPIC_API_KEY` | aiReviewAnalysis.js, visualAnalysisService.js | Non |
| Apify (avis) | `APIFY_API_TOKEN` | apifyReviews.js | Non |
| Apify (social) | `APIFY_API_TOKEN` | socialMediaService.js, visualSocialService.js | 48h |
| Apify (SEMrush) | `APIFY_API_TOKEN` | semrushService.js (radeance~semrush-scraper) | Non |
| Hunter.io | `HUNTER_API_KEY` | linkedinScraper.js | Non |
| Google Sheets | `GOOGLE_SERVICE_ACCOUNT_EMAIL` + `GOOGLE_PRIVATE_KEY` | googleSheets.js | — |
| Puppeteer (local) | — | visualAnalysisService.js | 30min |

---

## Frontend — composants et état

### Hiérarchie et responsabilités

```
App.jsx
 ├─ État global : leads[], selectedLead, activeTab, filters, searchParams,
 │               savedSearches, soundOn
 ├─ useLeads()           → searchLeads, updateLeadStatus, updateLeadDecisionMaker
 ├─ useScoringProfiles() → profiles[], activeProfile, CRUD
 │
 ├─ NavBar               → 5 onglets (search / leads / favorites / history / scoring)
 ├─ Sidebar (260px)
 │   ├─ [search]   → SidebarSearch  → SidebarSearch → onSearch(params)
 │   ├─ [leads]    → SidebarLeads   → affiche filteredLeads, onSelectLead
 │   ├─ [favorites]→ SidebarFavorites
 │   ├─ [history]  → SidebarHistory → recherches sauvegardées (pin, delete, load)
 │   └─ [scoring]  → ScoringProfileDrawer → sliders poids, création profils
 │
 └─ Zone principale (flex-grow)
     ├─ MainHeader (44px) — breadcrumb, compteur leads, indicateur session
     ├─ MapErrorBoundary
     │   └─ Map (MapLibre GL, markers couleur-codés, cercle rayon, popup)
     ├─ LoadingOverlay (fixed, SSE progress, barre %, force-close ✕)
     └─ LeadDetail (panel droit, on-demand)
```

### LeadDetail — actions on-demand

Chaque section suit le cycle : `idle → loading → done | error`

| Action | Endpoint appelé | Déclenché par |
|--------|----------------|--------------|
| Charger 100 avis | `POST /reviews/:placeId` | Bouton "Charger les avis" |
| Analyser avec IA | `POST /analyze/:placeId` | Bouton "Analyser" |
| Générer email | `POST /generate-email` | Bouton "Générer email" |
| Trouver décisionnaire | `POST /decision-maker` | Bouton "Trouver le dirigeant" |
| Données Pappers | `POST /pappers` | Bouton "Données financières" |
| Audit complet | `POST /audit` | Bouton "Lancer l'audit" |
| SEMrush | `POST /semrush` | Bouton "SEMrush" (profils seo/consultant-seo) |
| Analyse visuelle site | `POST /visual-analysis` | Bouton "Analyser le site" |
| Qualité photos Google | `POST /visual-analysis` | Bouton "Qualité photos" |
| Analyse réseaux visuels | `POST /visual-analysis` | Par réseau (IG, FB, TikTok…) |

---

## Utilitaires frontend

### `utils/sounds.js`

Oscillateur Web Audio API (singleton `AudioContext`) :

| Fonction | Fréquence | Durée | Volume |
|----------|-----------|-------|--------|
| `playClick()` | 600→400 Hz | 80ms | 0.08 |
| `playSuccess()` | 800→1200 Hz | 200ms | 0.10 |
| `playError()` | 300→200 Hz | 150ms | 0.08 |
| `toggleSound()` | — | — | — |
| `isSoundEnabled()` | — | — | — |

Stocké sur `window.leadgenSoundEnabled` (booléen global).

### `utils/exportPDF.js`

jsPDF + html2canvas — 3 pages A4 :
- **Page 1** : Couverture dark (nom, adresse, score en anneau SVG, profil actif, date)
- **Page 2** : Rapport (identité complète, breakdown score, Google, réseaux, Pappers, avis, keywords)
- **Page 3** : Analyse IA (rapport Markdown converti) + email cold généré

Échappement HTML systématique via `esc(s)` avant injection dans le template.

### `utils/exportAuditPDF.js`

PDF spécialisé pour le rapport SEO (`generateAuditSEO`) — mise en page dédiée.

---

## Design tokens — `App.css`

```css
--bg:            #0D1410   /* Fond principal */
--surface:       #111813
--card:          #161D18
--accent:        #1D6E55   /* Vert forêt (primaire) */
--accent-yellow: #EDFA36   /* Jaune vif (secondaire) */
--success:       #22c55e
--warning:       #f59e0b
--danger:        #ef4444
--text:          #F5F5F0
--muted:         rgba(245,245,240,0.40)
--faint:         rgba(245,245,240,0.18)

--font-display: 'Clash Display', sans-serif
--font-body:    'Cabinet Grotesk', sans-serif
--font-mono:    'DM Mono', monospace
```

---

## Persistance des données

| Donnée | Stockage | TTL |
|--------|---------|-----|
| Statuts leads (new/contacted/favorite/rejected) | `localStorage: leadgen_statuses` | Permanent |
| Statut individuel par lead | `localStorage: lead_status_{id}` | Permanent |
| Décisionnaire trouvé | `localStorage: dm_{id}` | Permanent |
| Recherches sauvegardées | `localStorage: leadgen_saved_searches` | Permanent |
| Profil scoring actif | `localStorage: activeProfileId` | Permanent |
| Son activé/désactivé | `window.leadgenSoundEnabled` | Session |
| Profils custom | `backend/data/scoringProfiles.json` | Permanent |
| Cache API | `backend/cache/apiCache.json` | Par TTL (7j max) |
| Cache Pappers | `backend/cache/pappers-cache.json` | 1h |

---

*Mis à jour le 2026-04-04 — généré depuis le code source réel*
