# Enrichissement Leads — 4 Signaux Universels — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter 4 signaux de qualification (Comparaison Concurrents, Gérant Actif, Nouveau Business, Benchmark Sectoriel) visibles dans la liste de leads et dans LeadDetail, pour tous les profils de scoring.

**Architecture:** Backend : deux nouveaux champs calculés dans `enrichBatch` (googlePlaces.js) + modifications scoring (scoring.js) + nouveau service en mémoire (benchmarkService.js) + post-processing partagé entre les deux routes dans leads.js. Frontend : badges dans LeadCard.jsx (liste) + section dédiée dans LeadDetail.jsx.

**Tech Stack:** Node.js/Express (backend), React/Vite (frontend), pas de nouvelles dépendances npm.

**Spec:** `docs/superpowers/specs/2026-03-24-enrichissement-leads-design.md`

---

## Chunk 1 — Backend services

### Task 1 — googlePlaces.js : `isActiveOwner` + `ownerReplyRatio`

**Files:**
- Modify: `backend/services/googlePlaces.js` (fonction `enrichBatch`, return object ~line 283)

Contexte : `enrichBatch` retourne un objet par place. Les reviews arrivent déjà avec un champ `author_reply`. `user_ratings_total` est le vrai total (non limité à 5), contrairement à `details.reviews.length`.

- [ ] **Step 1 — Ajouter les calculs avant le return dans `batch.map`**

Dans `enrichBatch`, à l'intérieur du `batch.map(async place => { ... })`, juste avant le `return { ... }`, ajouter :

```js
const totalRatings    = details.user_ratings_total ?? place.user_ratings_total ?? 0
const repliedCount    = (details.reviews ?? []).filter(r => r.author_reply).length
const isActiveOwner   = totalRatings >= 5 && repliedCount >= 3
const ownerReplyRatio = totalRatings > 0 ? repliedCount / Math.min(totalRatings, 5) : 0
```

- [ ] **Step 2 — Ajouter les champs au return**

Dans le même return object (actuellement se termine par `hasHours: !!(details.opening_hours),`), ajouter après `hasHours` :

```js
isActiveOwner,
ownerReplyRatio,
```

- [ ] **Step 3 — Vérification rapide**

Ouvrir le fichier et confirmer visuellement que les 2 nouvelles lignes sont bien dans l'objet retourné, à la suite de `hasHours`.

- [ ] **Step 4 — Commit**

```bash
cd backend
git add services/googlePlaces.js
git commit -m "feat: add isActiveOwner + ownerReplyRatio to enrichBatch"
```

---

### Task 2 — scoring.js : bonus +5/+15 + `newBusinessBadge` dans le retour

**Files:**
- Modify: `backend/services/scoring.js` (fonction `calculateScore`, ligne contenant `const total = Math.min(100, ...)`)

Contexte : `pappersData` est déjà le 5e paramètre de `calculateScore` — aucune modification de signature. `placeData` est le 1er paramètre (il contient `isActiveOwner` via le spread `{ ...place, openNow }` fait dans `buildLead`).

- [ ] **Step 1 — Ajouter la logique `newBusinessBadge` avant le calcul du total**

Identifier la ligne `const total = Math.min(100, Math.max(...))` dans `calculateScore`. Juste **avant** cette ligne, insérer :

```js
const SIX_MONTHS_MS = 180 * 24 * 3600 * 1000
let newBusinessBadge = null
if (pappersData?.dateCreation) {
  const d = new Date(pappersData.dateCreation)
  if (!isNaN(d.getTime())) {
    const age = Date.now() - d.getTime()
    if (age < SIX_MONTHS_MS) newBusinessBadge = 'confirmed'
  }
} else if ((placeData.user_ratings_total ?? 99) < 10) {
  newBusinessBadge = 'probable'
}
```

- [ ] **Step 2 — Migrer `const total` → `let total` avec les bonus**

Remplacer la ligne `const total = Math.min(100, Math.max(..., 0))` par :

```js
let total = Math.max(googleRating + reviewVolume + digitalPresence + opportunity, 0)
if (placeData.isActiveOwner) total += 5
if (newBusinessBadge)        total += 15
total = Math.min(100, total)
```

- [ ] **Step 3 — Étendre le return pour exposer `newBusinessBadge`**

Modifier le `return { total, breakdown: { ... } }` pour ajouter `newBusinessBadge` :

```js
return {
  total,
  breakdown: {
    googleRating,
    reviewVolume,
    digitalPresence,
    opportunity,
    financialCapacity,
  },
  newBusinessBadge,
}
```

- [ ] **Step 4 — Vérification rapide**

Ouvrir le fichier et confirmer : (a) `newBusinessBadge` déclaré avant le bloc total, (b) `let total` avec les deux `if`, (c) `newBusinessBadge` dans le return.

- [ ] **Step 5 — Commit**

```bash
git add services/scoring.js
git commit -m "feat: add newBusinessBadge + isActiveOwner/newBusiness bonus scoring"
```

---

### Task 3 — Nouveau fichier `benchmarkService.js`

**Files:**
- Create: `backend/services/benchmarkService.js`

Contexte : cache en mémoire `Map<"domain:city" → number[]>`. Deux fonctions exportées : `addScore` (alimente le cache) et `getPercentile` (retourne percentile 0-100 ou null si < 5 données). Le cache est réinitialisé à chaque redémarrage serveur — comportement normal et documenté.

- [ ] **Step 1 — Créer le fichier**

```js
// backend/services/benchmarkService.js
const cache = new Map()  // Map<"domain:city" → number[]>

function addScore(domain, city, score) {
  if (!domain || !city) return
  const key = `${domain}:${city}`
  if (!cache.has(key)) cache.set(key, [])
  cache.get(key).push(score)
  // Tech debt : cache non borné — ajouter un cap à 200 scores/clé si besoin
}

function getPercentile(domain, city, score) {
  if (!domain || !city) return null
  const key = `${domain}:${city}`
  const scores = cache.get(key) ?? []
  if (scores.length < 5) return null
  const below = scores.filter(s => s < score).length
  return Math.round((below / scores.length) * 100)
}

module.exports = { addScore, getPercentile }
```

- [ ] **Step 2 — Commit**

```bash
git add services/benchmarkService.js
git commit -m "feat: add benchmarkService (in-memory percentile cache)"
```

---

## Chunk 2 — Backend routes

### Task 4 — leads.js : promotion des champs + post-processing partagé

**Files:**
- Modify: `backend/routes/leads.js`

Contexte :
- `buildLead` retourne l'objet lead. `score` est le retour de `calculateScore` (contient maintenant `newBusinessBadge`).
- `isActiveOwner` est sur `place` (depuis `enrichBatch`) et survive le spread `{ ...place, openNow }` dans `placeData`, mais n'est **pas** dans le return explicite de `buildLead` → à ajouter.
- Les deux routes (`POST /search/stream` et `POST /search`) appellent `processPlaces` puis répondent. Le post-processing (competitor avg + benchmark) doit être appliqué dans les deux.

- [ ] **Step 1 — Importer `benchmarkService`**

En haut du fichier, après les imports existants, ajouter :

```js
const benchmarkService = require('../services/benchmarkService');
```

- [ ] **Step 2 — Ajouter les champs dans le return de `buildLead`**

Dans la fonction `buildLead`, dans l'objet retourné, après le **dernier champ** `keyword: keywords?.[0] || null,` (ligne ~79), ajouter :

```js
newBusinessBadge: score.newBusinessBadge ?? null,
isActiveOwner:    place.isActiveOwner ?? false,
ownerReplyRatio:  place.ownerReplyRatio ?? 0,
```

- [ ] **Step 3 — Créer la fonction `applyPostProcessing`**

Insérer cette fonction entre la fermeture de `buildLead` (accolade ligne ~81) et la déclaration `async function processPlaces` (ligne ~83). La fonction mute les leads en place (pas de valeur de retour) :


```js
function applyPostProcessing(leads, { city, domain }) {
  // Feature 1 — Comparaison Concurrents
  const scores = leads.map(l => l.score?.total ?? 0)
  const avg = scores.length > 1
    ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
    : null
  for (const lead of leads) {
    lead.competitorAvg   = avg
    lead.competitorDelta = avg !== null ? (lead.score?.total ?? 0) - avg : null
  }

  // Feature 4 — Benchmark Sectoriel (2 passes)
  const d = domain ?? ''
  const c = city   ?? ''
  for (const lead of leads) {
    benchmarkService.addScore(d, c, lead.score?.total ?? 0)
  }
  for (const lead of leads) {
    lead.benchmarkPercentile = benchmarkService.getPercentile(d, c, lead.score?.total ?? 0)
  }
}
```

- [ ] **Step 4 — Appeler `applyPostProcessing` dans la route SSE (`/search/stream`)**

Dans la route `POST /search/stream`, après `const leads = await processPlaces(...)` et avant `send({ type: 'done', ... })`, ajouter :

```js
applyPostProcessing(leads, { city, domain })
```

- [ ] **Step 5 — Appeler `applyPostProcessing` dans la route classique (`/search`)**

Dans la route `POST /search`, après `const leads = await processPlaces(...)` et avant `res.json({ ... })`, ajouter :

```js
applyPostProcessing(leads, { city, domain })
```

- [ ] **Step 6 — Vérification rapide**

Confirmer que :
- Import `benchmarkService` présent en haut
- `newBusinessBadge`, `isActiveOwner`, `ownerReplyRatio` dans le return de `buildLead`
- `applyPostProcessing` défini une fois et appelé dans les deux routes

- [ ] **Step 7 — Smoke test manuel (si serveur accessible)**

Lancer le backend (`npm run dev` dans `backend/`), puis tester avec un outil HTTP (Postman, Insomnia, ou curl sur Linux/macOS) :

```
POST http://localhost:3001/api/leads/search
Content-Type: application/json

{"lat":45.748,"lng":4.847,"radius":1,"city":"Lyon","domain":"restaurant","keywords":[],"sources":[]}
```

Vérifier dans la réponse que `leads[0]` contient les champs `newBusinessBadge`, `isActiveOwner`, `competitorAvg`, `competitorDelta`, `benchmarkPercentile`. `benchmarkPercentile` sera `null` au 1er appel (cache vide) — c'est normal.

- [ ] **Step 8 — Commit**

```bash
cd backend
git add routes/leads.js
git commit -m "feat: promote isActiveOwner/newBusinessBadge, add competitor avg + benchmark post-processing"
```

---

## Chunk 3 — Frontend

### Task 5 — LeadCard.jsx : badges `isActiveOwner` + `newBusinessBadge`

**Files:**
- Modify: `frontend/src/components/LeadCard.jsx`

Contexte : `LeadCard` est le composant qui affiche chaque lead dans la liste. Les badges existants (chatbot, décideur, statut) se trouvent dans "Row 4" vers la ligne 183. Les 2 nouveaux badges se placent dans cette même rangée, avant les badges existants.

- [ ] **Step 1 — Ajouter le badge `isActiveOwner`**

Dans le `<div style={{ marginLeft: 'auto', display: 'flex', gap: 4, ...}}>` qui commence à la ligne ~228 (Row 4, zone droite — **à l'intérieur** de ce div, avant le bloc `{lead.chatbotDetection && ...}`), ajouter :

```jsx
{lead.isActiveOwner && (
  <span style={{
    fontSize: 9,
    fontWeight: 700,
    color: '#10b981',
    background: 'rgba(16,185,129,0.10)',
    border: '1px solid rgba(16,185,129,0.25)',
    borderRadius: 4,
    padding: '1px 5px',
    fontFamily: 'var(--font-body)',
  }}>
    Gérant actif ✓
  </span>
)}
```

- [ ] **Step 2 — Ajouter le badge `newBusinessBadge`**

Juste après le bloc `isActiveOwner`, ajouter :

```jsx
{lead.newBusinessBadge === 'confirmed' && (
  <span style={{
    fontSize: 9,
    fontWeight: 700,
    color: '#f97316',
    background: 'rgba(249,115,22,0.10)',
    border: '1px solid rgba(249,115,22,0.25)',
    borderRadius: 4,
    padding: '1px 5px',
    fontFamily: 'var(--font-body)',
  }}>
    Nouveau business
  </span>
)}
{lead.newBusinessBadge === 'probable' && (
  <span style={{
    fontSize: 9,
    fontWeight: 700,
    color: 'var(--muted)',
    background: 'rgba(148,163,184,0.08)',
    border: '1px solid rgba(148,163,184,0.20)',
    borderRadius: 4,
    padding: '1px 5px',
    fontFamily: 'var(--font-body)',
  }}>
    Potentiel nouveau
  </span>
)}
```

- [ ] **Step 3 — Commit**

```bash
cd frontend
git add src/components/LeadCard.jsx
git commit -m "feat: add isActiveOwner + newBusinessBadge badges to LeadCard"
```

---

### Task 6 — LeadDetail.jsx : affichage des 4 signaux

**Files:**
- Modify: `frontend/src/components/LeadDetail.jsx`

Contexte : LeadDetail affiche le détail d'un lead. Les 4 signaux se placent :
- Features 1 et 4 (compétiteurs + benchmark) : sous le score principal
- Feature 2 (Gérant actif) : dans la section Réputation, à côté de la note Google
- Feature 3 (Nouveau business) : dans la section DONNÉES CLÉS

Avant de modifier, lire les sections concernées dans LeadDetail.jsx pour identifier les bons points d'insertion.

- [ ] **Step 1 — Localiser le point d'insertion pour Features 1 et 4**

Dans LeadDetail.jsx, rechercher le commentaire `{/* ── SCORE DÉTAILLÉ ── */}` (~ligne 1794). Les Features 1 et 4 se placent juste **avant** ce bloc. Ne pas chercher `score.total` (variable JS locale) — chercher le commentaire JSX `SCORE DÉTAILLÉ`.

- [ ] **Step 2 — Insérer Feature 1 (Comparaison Concurrents) sous le score**

Après le bloc du score principal, ajouter (conditionnel sur `lead.competitorAvg !== null && lead.competitorAvg !== undefined`) :

```jsx
{lead.competitorAvg != null && (
  <div style={{
    fontSize: 11,
    color: lead.competitorDelta > 0 ? '#10b981'
         : lead.competitorDelta < 0 ? '#ef4444'
         : '#94a3b8',
    padding: '4px 0',
    fontFamily: 'var(--font-mono)',
  }}>
    {lead.competitorDelta > 0
      ? `Moyenne secteur : ${lead.competitorAvg} — vous êtes +${lead.competitorDelta} au-dessus`
      : lead.competitorDelta < 0
      ? `Moyenne secteur : ${lead.competitorAvg} — vous êtes ${lead.competitorDelta} en dessous`
      : `Dans la moyenne du secteur : ${lead.competitorAvg}`
    }
  </div>
)}
```

- [ ] **Step 3 — Insérer Feature 4 (Benchmark Sectoriel) sous Feature 1**

Juste après le bloc Feature 1, ajouter :

```jsx
{lead.benchmarkPercentile != null && (
  <div style={{
    fontSize: 11,
    color: lead.benchmarkPercentile >= 70 ? '#10b981'
         : lead.benchmarkPercentile >= 40 ? '#f59e0b'
         : '#ef4444',
    padding: '4px 0',
    fontFamily: 'var(--font-mono)',
  }}>
    Meilleur que {lead.benchmarkPercentile}% des {lead.domain || 'établissements'}{lead.address ? ` de ${lead.address.split(',').pop().trim()}` : ''}
  </div>
)}
```

Note : `lead.address` est le champ `vicinity` retourné par Google Places (ex: `"12 Rue de la Paix, Lyon"`). Le `.split(',').pop().trim()` extrait la ville. `lead.google?.address` n'existe pas — utiliser `lead.address`.

- [ ] **Step 4 — Lire LeadDetail.jsx pour trouver la section Réputation / note Google**

Rechercher le bloc affichant `lead.google?.rating` ou les étoiles dans la section réputation. C'est le point d'insertion du badge Feature 2.

- [ ] **Step 5 — Insérer Feature 2 (Gérant Actif) dans la section Réputation**

À côté ou sous la note Google dans la section Réputation, ajouter :

```jsx
{lead.isActiveOwner && (
  <span style={{
    fontSize: 11,
    fontWeight: 600,
    color: '#10b981',
    background: 'rgba(16,185,129,0.08)',
    border: '1px solid rgba(16,185,129,0.20)',
    borderRadius: 6,
    padding: '3px 9px',
    marginLeft: 8,
  }}>
    Gérant actif ✓
  </span>
)}
```

- [ ] **Step 6 — Lire LeadDetail.jsx pour trouver la section DONNÉES CLÉS**

Rechercher le bloc `DONNÉES CLÉS` ou la section principale d'informations du lead. C'est le point d'insertion du badge Feature 3.

- [ ] **Step 7 — Insérer Feature 3 (Nouveau Business) dans DONNÉES CLÉS**

Dans la section DONNÉES CLÉS, ajouter le badge après les informations existantes :

```jsx
{lead.newBusinessBadge === 'confirmed' && (
  <div style={{ padding: '6px 14px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
    <span style={{
      fontSize: 11,
      color: '#f97316',
      background: 'rgba(249,115,22,0.08)',
      border: '1px solid rgba(249,115,22,0.20)',
      borderRadius: 6,
      padding: '3px 9px',
    }}>
      Nouveau business (confirmé)
    </span>
  </div>
)}
{lead.newBusinessBadge === 'probable' && (
  <div style={{ padding: '6px 14px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
    <span style={{
      fontSize: 11,
      color: '#94a3b8',
      background: 'rgba(148,163,184,0.06)',
      border: '1px solid rgba(148,163,184,0.18)',
      borderRadius: 6,
      padding: '3px 9px',
    }}>
      Potentiel nouveau business
    </span>
  </div>
)}
```

- [ ] **Step 8 — Vérification visuelle**

Lancer le frontend (`npm run dev` dans `frontend/`) et ouvrir http://localhost:5173. Effectuer une recherche. Vérifier dans la liste et dans LeadDetail que les badges s'affichent (ou sont absents si les données manquent, ce qui est normal pour `benchmarkPercentile` avant accumulation).

- [ ] **Step 9 — Commit**

```bash
cd frontend
git add src/components/LeadDetail.jsx
git commit -m "feat: display 4 enrichment signals in LeadDetail (competitors, owner, new business, benchmark)"
```

---

## Notes post-implémentation

- `benchmarkPercentile` sera `null` pour les premières recherches — comportement attendu (cache vide). Il se remplit au fil des recherches successives avec le même `domain:city`.
- Les bonus scoring (+5 Gérant actif, +15 Nouveau business) s'appliquent sur `score.total` uniquement — `score.breakdown.*` reste inchangé.
- `ownerReplyRatio` est stocké sur le lead (`lead.ownerReplyRatio`) mais non affiché — réservé usage futur.
- Les deux routes (`/search` et `/search/stream`) reçoivent le même post-processing via `applyPostProcessing`.
