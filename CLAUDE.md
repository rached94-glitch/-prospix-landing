# CLAUDE.md — LeadGen Pro

> Lu automatiquement par Claude Code à chaque conversation. Ne pas supprimer.

---

## PROJET

**LeadGen Pro** — prospection B2B : recherche d'entreprises locales via Google Maps API, enrichissement multi-sources, scoring par profil métier, génération de pitches email.

| Composant | Stack | Port |
|-----------|-------|------|
| Backend | Node.js 20 + Express 4 | **3001** |
| Frontend | React 18 + Vite | **5173** (dev) |

### Commandes de lancement

```bash
# Backend
cd backend && npm run dev        # nodemon — ignore cache/*.json et data/*.json

# Frontend
cd frontend && npm run dev       # http://localhost:5173

# Setup initial
cp .env.example .env             # puis remplir les clés API
```

---

## CONVENTIONS CODE

### Backend — CommonJS strict

```js
const express = require('express')          // ✅
module.exports = { myFunction }             // ✅
import express from 'express'               // ❌ interdit
export function myFunction() {}             // ❌ interdit
```

### Frontend — ESM strict, pas de TypeScript

```js
import { useState } from 'react'            // ✅
export default function MyComp() {}         // ✅
const react = require('react')              // ❌ interdit
```

### Inline styles — règle absolue frontend

**Jamais de Tailwind. Jamais de CSS modules. Jamais de className externe.**
Tout style va dans `style={{ ... }}` directement sur l'élément JSX.
Exception : `App.css` pour les design tokens CSS et les `@keyframes`.

### Logs backend — préfixe obligatoire

```js
console.log('[Places] searchPlaces → lat=48.85 lng=2.35')
console.log('[Scoring] calculateScore profil=photographe')
console.log('[API COST] Appel réel à Google API: Place Details')
console.log('[Enrich] Lead 3/10 terminé : Brasserie Le Marais')
console.log('[Cache] HIT  placeDetails:ChIJ123')
console.log('[Unlock] Brasserie Le Marais (ChIJ123) déverrouillé')
```

### Sons frontend — try/catch obligatoire

```js
import { playClick, playSuccess, playError } from '../utils/sounds'

// Sons dans un try/catch — AudioContext peut être bloqué par le navigateur
try { playClick()   } catch {}
try { playSuccess() } catch {}
try { playError()   } catch {}
```

`sounds.js` gère déjà `window.leadgenSoundEnabled`. Pas besoin de vérifier manuellement.

### Commits git

```bash
git add -p    # staging interactif — jamais git add -A
git commit -m "feat: description courte"
# Toujours committer après chaque feature stable
```

---

## ARCHITECTURE RÉSUMÉE

### Flux SSE — recherche principale

```
SearchPanel → App.onSearch() → useLeads.searchLeads()
  → POST /api/leads/search/stream  [SSE]
    1. searchPlaces()   → Nearby Search (3 pages max, dédupliqué par place_id)
    2. enrichBatch()    → Place Details BASIC par lots de 10 → locked:true
    3. processPlaces()  → buildLead() + calculateScore() (sans social/pappers en phase 1)
    4. applyPostProcessing() → competitorAvg, benchmarkPercentile
  → SSE : page / enrich / cache / done
  → useLeads : applyStatuses() + setLeads()
  → Map + SidebarLeads re-render
```

### Système de lock (2 phases)

```
Phase 1 (search) → données basic : note, avis, photoCount — lead.locked = true
Phase 2 (unlock) → POST /api/leads/unlock/:placeId
                    → Place Details complets + social + Pappers + description + score
                    → Cache 7j dans namespace "unlock"
                    → TODO: déduire 1 crédit Supabase
```

### Cache persistant

- `createCache(name)` → namespace dans `cache/apiCache.json`
- Map en mémoire + flush JSON async debounce 5s (`fs.writeFile`)
- Flush sync sur SIGTERM (`fs.writeFileSync`)
- `nodemonConfig.ignore: ["cache/*.json"]` → empêche restart et ECONNRESET SSE

### Scoring

```
total = googleRating + reviewVolume + digitalPresence + opportunity
      + (isActiveOwner ? +5 : 0) + (newBusinessBadge ? +15 : 0)
      → cap 100
```

12 profils preset dans `useScoringProfiles.js` + profils custom dans `data/scoringProfiles.json`.

---

## FICHIERS CLÉS

```
backend/
  server.js                    Point d'entrée Express — CORS, routes, crash handlers
  routes/leads.js              TOUTES les routes /api/leads/* + buildLead + processPlaces + unlock
  routes/visualAnalysis.js     POST /api/leads/visual-analysis
  services/googlePlaces.js     Nearby Search, Place Details basic+full, cleanWebsiteUrl, scrapeDescription
  services/scoring.js          calculateScore() — 4 critères, 12 profils, bonus
  services/aiReviewAnalysis.js analyzeWithAI(), generateEmail*(), generateAuditSEO()
  services/socialEnrichment.js Détection LinkedIn/FB/IG/TikTok/chatbot depuis HTML
  services/pappersService.js   Données financières Pappers.fr (7 stratégies en cascade)
  services/pagespeedService.js PageSpeed + CrUX + Custom Search + NAP
  services/linkedinScraper.js  Dirigeant : Google Search → scraping → Hunter.io
  services/benchmarkService.js Percentile sectoriel en mémoire (cross-recherches)
  cache/searchCache.js         Factory createCache(name) — SEUL système de cache autorisé
  cache/apiCache.json          Données persistées (ignoré git)
  data/scoringProfiles.json    Profils custom utilisateur — NE PAS SUPPRIMER

frontend/src/
  App.jsx                      État global, layout 3 colonnes, handlers, SSE consumer
  App.css                      Design tokens CSS — seul fichier CSS à toucher
  hooks/useLeads.js            Streaming SSE, statuts localStorage, updateLeadData
  hooks/useScoringProfiles.js  12 profils preset + CRUD profils custom
  components/LeadDetail.jsx    Panel droit complet (~3000 lignes) — toute l'interactivité
  components/SidebarSearch.jsx Formulaire de recherche ACTIF (PAS SearchPanel.jsx — inutilisé)
  components/Map.jsx           MapLibre GL, markers couleur-codés, cercle rayon
  components/LeadsList.jsx     Liste triable + LeadCard
  utils/sounds.js              Web Audio API — playClick / playSuccess / playError
  utils/exportPDF.js           jsPDF + html2canvas — 3 pages A4
  utils/exportAuditPDF.js      PDF rapport SEO dédié
  vite.config.js               Proxy /api → localhost:3001 (proxyTimeout:0 — intentionnel SSE)
```

---

## RÈGLES STRICTES

| Règle | Raison |
|-------|--------|
| Ne jamais modifier `server.js` sans demander | CORS, montage routes — impact global |
| Ne jamais modifier `App.jsx` sans demander | État global, layout — impact global |
| Ne jamais modifier `data/scoringProfiles.json` sans demander | Profils utilisateur sauvegardés |
| Ne jamais supprimer le cache ou modifier les TTL sans demander | Cœur de la persistance |
| Ne jamais ajouter Tailwind, Bootstrap, ou CSS externe | Convention inline styles |
| Toujours `withTimeout()` sur les appels API externes | Évite les blocages SSE |
| Toujours `console.log('[NomService]')` dans les services | Debug et traçabilité |
| Toujours `try/catch` autour de `sounds.js` | AudioContext peut être bloqué |
| Ne pas modifier la structure de l'objet `lead` sans synchroniser `buildLead()` ET `LeadDetail.jsx` | Cohérence frontend/backend |
| `SearchPanel.jsx` est inutilisé — ne pas modifier | Le composant actif est `SidebarSearch.jsx` |
| `proxyTimeout: 0` dans vite.config.js est intentionnel | Requis pour SSE long-polling |

---

## NAMESPACES DE CACHE

| Namespace | Fichier | TTL |
|-----------|---------|-----|
| `search` | googlePlaces.js | 7j |
| `placeDetails` | googlePlaces.js | 7j — champs complets (unlock) |
| `placeDetailsBasic` | googlePlaces.js | 7j — champs basic (search) |
| `localRank` | googlePlaces.js | 7j |
| `reviews` | googleReviews.js | 7j |
| `pagespeed` | pagespeedService.js | 7j |
| `crux` | pagespeedService.js | 7j |
| `indexedPages` | pagespeedService.js | 7j |
| `socialMedia` | socialMediaService.js | 48h |
| `unlock` | routes/leads.js | 7j |
| `pappers` | pappersService.js | 1h + pappers-cache.json séparé |

---

## PROBLÈMES CONNUS — ne pas corriger sans demande

1. `server.js:13` CORS hardcodé `localhost` → bloque tout déploiement
2. `scoring.js` `presenceScore()` crash si `social = null` → fix : `social ?? {}`
3. `LeadDetail.jsx` `aiCache`/`auditCache` illimités → LRU à implémenter
4. `LeadDetail.jsx` ~3000 lignes → candidats à extraire : AuditPanel, ReviewsSection, AIEmailGenerator
5. `SearchPanel.jsx` (962 lignes) inutilisé dans `App.jsx` → à supprimer ou brancher

## Dernières modifications
- `2026-04-04 15:37:26` — modifié `frontend/src/components/LeadDetail.jsx`
- `2026-04-04 15:37:05` — modifié `frontend/src/components/LeadDetail.jsx`
- `2026-04-04 15:36:19` — modifié `backend/routes/leads.js`
- `2026-04-04 15:36:11` — modifié `backend/routes/leads.js`
- `2026-04-04 15:36:03` — modifié `backend/routes/leads.js`

