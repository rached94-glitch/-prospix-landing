# CLAUDE.md — LeadGen Pro / Prospix

> Lu automatiquement par Claude Code à chaque conversation. Ne pas supprimer.

---

## PROJET

**LeadGen Pro (app) + Prospix (landing page)** — prospection B2B : recherche d'entreprises locales via Google Maps API, enrichissement multi-sources, scoring par profil métier, génération de pitches email.

| Composant | Stack | Port |
|-----------|-------|------|
| Backend | Node.js 20 + Express 4 | **3001** |
| Frontend (app) | React 18 + Vite | **5173** (dev) |
| Landing page | React 18 + Vite + framer-motion | **5174** (dev) |

**GitHub landing page** : `https://github.com/rached94-glitch/-prospix-landing.git` → branche `master`

### Commandes de lancement

```bash
# Backend
cd backend && npm run dev        # nodemon — ignore cache/*.json et data/*.json

# Frontend app
cd frontend && npm run dev       # http://localhost:5173

# Landing page
cd landing-page && npm run dev   # http://localhost:5174

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

### Inline styles — règle absolue frontend (app ET landing page)

**Jamais de Tailwind. Jamais de CSS modules. Jamais de className externe.**
Tout style va dans `style={{ ... }}` directement sur l'élément JSX.
Exception : `App.css` / `index.css` pour les design tokens CSS et les `@keyframes`.

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
  services/aiReviewAnalysis.js analyzeWithAI(), generateEmail*(), generateAudit*() — 7 audits IA structurés
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
  components/LeadDetail.jsx    Panel droit — interactivité principale (refactorisé)
  components/AIEmailGenerator.jsx  Générateur email IA (extrait de LeadDetail)
  components/AuditPanel.jsx        Panel audits IA (extrait de LeadDetail)
  components/ReviewsSection.jsx    Section avis Google (extrait de LeadDetailReviews)
  components/SidebarSearch.jsx Formulaire de recherche ACTIF (PAS SearchPanel.jsx — inutilisé)
  components/Map.jsx           MapLibre GL, markers couleur-codés, cercle rayon
  components/LeadsList.jsx     Liste triable + LeadCard
  utils/sounds.js              Web Audio API — playClick / playSuccess / playError
  utils/exportPDF.js           jsPDF + html2canvas — 3 pages A4
  utils/exportAuditPDF.js      8 fonctions PDF audit (SEO, Chatbot, Photo, Social, Designer, WebDev, Email, Ads)
  utils/caches.js              Helpers cache frontend
  vite.config.js               Proxy /api → localhost:3001 (proxyTimeout:0 — intentionnel SSE)

landing-page/src/
  App.jsx                      Layout principal, useEffect scrollTo(0,0) au montage
  index.css                    Design tokens, @keyframes (marquee, gradientMove, floatParticle…)
  components/AnimatedBackground.jsx  Fixed — gradient mesh 3 radials + 35 particules + grain SVG
  components/Header.jsx        Logo "Prospix" transparent absolu — pas de nav
  components/Hero.jsx          H1 gradient, stats, ticker villes, boutons waitlist/démo
  components/ProfilesSection.jsx  10 profils freelance avec glow coloré par profil
  components/Sectors.jsx       Bandeau défilant marquee — 15 secteurs glassmorphism
  components/Features.jsx      Grille features (inline styles)
  components/HowItWorks.jsx    3 étapes alternées L/R + maquettes UI + paragraphe pitch (id="how-it-works")
  components/Pricing.jsx       4 plans (Essai/Starter/Pro/Business) orientés volume prospects
  components/WaitlistForm.jsx  7 champs + RGPD + envoi webhook n8n (no-cors)
  components/CTABanner.jsx     Section waitlist finale (id="cta-waitlist")
  components/PrivacyModal.jsx  Modal RGPD partagée (WaitlistForm + Footer)
  components/Footer.jsx        Logo + liens + politique de confidentialité
  components/StickyButtons.jsx Boutons flottants persistants
  hooks/useClickSound.js       Son de clic Web Audio
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

## SYSTÈME D'AUDIT IA — generateAudit*()

7 fonctions dans `aiReviewAnalysis.js`, toutes avec le même schéma de sortie :

```js
{
  accroche, score, niveau, forces[], faiblesses[], opportunites[], recommandations[],
  comparaison_concurrents: { position, avantages[], retards[] },  // nouveau
  timeline: { semaine_1, semaine_2_3, mois_2_3 },                 // nouveau
  titre_audit: "Audit Chatbot & IA Conversationnelle"              // nouveau
}
```

`enrichAuditResult(parsed)` — helper qui normalise ces 3 nouveaux champs (fallback null/défaut).

`AUDIT_RULES_BLOCK` — bloc de règles injecté dans tous les prompts generateAudit*.
`EMAIL_STATS_NOTE` — bloc de statistiques injecté dans tous les prompts generateEmail*.

### Dépendance pagespeedData — forme duale (IMPORTANT)

`getSiteSignals()` (profil chatbot) retourne un objet **flat** :
```js
{ chatbotDetected, chatbotTool, bookingPlatform, hasFAQ, hasContactForm, ... }
```

`getPageSpeed()` (profil SEO/autres) retourne avec **siteSignals imbriqué** :
```js
{ performance, seo, ..., siteSignals: { chatbotDetected, bookingPlatform, ... } }
```

→ Toujours gérer les deux formes quand on lit des champs siteSignals :
```js
const bp = pagespeedData?.bookingPlatform ?? pagespeedData?.siteSignals?.bookingPlatform ?? null
```

---

## LANDING PAGE — DÉTAILS TECHNIQUES

### Webhook n8n (WaitlistForm)
- URL : `https://kimrach.app.n8n.cloud/webhook/a26655a1-9b69-45f0-893c-de8c1561870e`
- Mode : `no-cors`, `Content-Type: text/plain`, body JSON stringifié
- Champs envoyés : `email, prenom, nom, metier, ville, statut, code_parrainage, date`
- Pas de vérification `response.ok` (réponse opaque en no-cors)

### Background animé (index.css + AnimatedBackground.jsx)
- `body` : `linear-gradient(-45deg, #0d2b1f, #1D6E55, #1a3a2a, #3a5225)` animé via `gradientMove 15s`
- `AnimatedBackground` : 3 radials ellipses fixes animés (`gradientMove1/2/3`) + 35 particules + grain SVG
- Keyframes dans `index.css` : `marquee`, `gradientMove`, `gradientMove1/2/3`, `floatParticle`, `badgePulseRing`…

### Navigation interne
- "Rejoindre la waitlist" → scroll vers `#cta-waitlist`
- "Voir la démo" → scroll vers `#how-it-works`
- Section HowItWorks : `id="how-it-works"`
- Section Pricing : `id="tarifs"`

---

## PROBLÈMES CONNUS — ne pas corriger sans demande

1. `server.js:13` CORS hardcodé `localhost` → bloque tout déploiement
2. `scoring.js` `presenceScore()` crash si `social = null` → fix : `social ?? {}`
3. `LeadDetail.jsx` `aiCache`/`auditCache` illimités → LRU à implémenter
4. `SearchPanel.jsx` (962 lignes) inutilisé dans `App.jsx` → à supprimer ou brancher

## Dernières modifications
- `2026-04-08` — landing page Prospix complète — GitHub rached94-glitch/-prospix-landing
- `2026-04-08` — WaitlistForm → webhook n8n (no-cors)
- `2026-04-08` — background animé gradient vert oscilant sur body
- `2026-04-08` — bouton "Voir la démo" → scroll #how-it-works
- `2026-04-07` — mots clés HowItWorks en vert uniforme #2A9D74
- `2026-04-06` — LeadDetail refactorisé : AIEmailGenerator, AuditPanel, ReviewsSection extraits

