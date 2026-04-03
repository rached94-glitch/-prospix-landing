# Design — Enrichissement Leads : 4 Signaux Universels

**Date** : 2026-03-24
**Projet** : LeadGen Pro
**Périmètre** : Backend Node.js/Express + Frontend React/Vite

---

## Contexte

Ajouter 4 nouveaux signaux de qualification visibles dans LeadDetail et SearchPanel, applicables à tous les profils de scoring. Aucune modification des pondérations existantes.

---

## Feature 1 — Comparaison Concurrents

### But
Positionner chaque lead par rapport aux autres résultats de la même recherche.

### Implémentation
- **Fichier** : `backend/routes/leads.js` — POST `/api/leads/search`
- **Moment** : après `processPlaces()` (qui inclut déjà le scoring), avant la réponse

Dans une même recherche, tous les leads partagent le même `domain` — `competitorAvg` est la moyenne de tous les leads de la recherche. C'est intentionnel : on compare chaque lead à ses pairs du même secteur dans la même zone.

Si `domain` est vide, tous les leads forment un seul groupe — la moyenne reste valide. Note : Feature 4 (benchmark) ne collecte pas de données pour les recherches sans `domain` (voir Feature 4).

```js
// Pseudo-code dans routes/leads.js, après processPlaces()
const scores = leads.map(l => l.score?.total ?? 0)
const avg = scores.length > 1
  ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
  : null

for (const lead of leads) {
  lead.competitorAvg   = avg
  lead.competitorDelta = avg !== null ? (lead.score?.total ?? 0) - avg : null
}
```

### Affichage LeadDetail
Ligne sous le score principal (masquée si `competitorAvg === null`) :
- `"Moyenne secteur : 52 — vous êtes +12 au-dessus"` (vert si delta > 0)
- `"Moyenne secteur : 52 — vous êtes -8 en dessous"` (rouge si delta < 0)
- `"Dans la moyenne du secteur : 52"` (gris si delta = 0)

Non affiché dans SearchPanel (liste) — LeadDetail uniquement.

---

## Feature 2 — Gérant Actif

### But
Détecter les commerces dont le gérant répond activement aux avis Google.

### Implémentation dans `googlePlaces.js` — enrichBatch

Les reviews sont déjà enrichies avec `author_reply`. Le seuil utilise `user_ratings_total` (nombre total réel), pas `details.reviews.length` (limité à 5).

```js
// Dans enrichBatch, dans le batch.map(async place => { ... })
const totalRatings   = details.user_ratings_total ?? place.user_ratings_total ?? 0
const repliedCount   = (details.reviews ?? []).filter(r => r.author_reply).length
const isActiveOwner  = totalRatings >= 5 && repliedCount >= 3  // 3/5 = 60% > seuil 50% demandé
const ownerReplyRatio = totalRatings > 0 ? repliedCount / Math.min(totalRatings, 5) : 0

// Ces deux champs sont EXPLICITEMENT ajoutés à l'objet retourné :
return {
  place_id:           place.place_id,
  name:               place.name,
  // ... tous les champs existants ...
  photoCount,
  hasDescription:     descResult.hasDescription,
  descriptionText:    descResult.descriptionText,
  descriptionSource:  descResult.descriptionSource,
  hasHours:           !!(details.opening_hours),
  isActiveOwner,       // NOUVEAU
  ownerReplyRatio,     // NOUVEAU
}
```

### Scoring dans `scoring.js`

Migration requise — identifier la ligne par son contenu (`const total = Math.min(100, ...)`):
```js
// AVANT :
const total = Math.min(100, Math.max(googleRating + reviewVolume + digitalPresence + opportunity, 0))

// APRÈS :
let total = Math.max(googleRating + reviewVolume + digitalPresence + opportunity, 0)
if (placeData.isActiveOwner) total += 5      // Feature 2 : Gérant actif
if (placeData.newBusinessBadge) total += 15  // Feature 3 : Nouveau business
total = Math.min(100, total)                 // cap après les deux bonus
```

`breakdown.*` n'est pas modifié — les bonus sont uniquement sur `total`.

`newBusinessBadge` est calculé avant ce bloc (voir Feature 3).

Note : `placeData` est construit dans `buildLead` par `const placeData = { ...place, openNow }`. Le spread préserve `isActiveOwner` et `ownerReplyRatio` depuis l'objet retourné par `enrichBatch` — aucune transformation supplémentaire requise.

### Propagation de `isActiveOwner` dans `leads.js`

`isActiveOwner` doit être promu en champ top-level du lead dans `buildLead` (parallèle à `newBusinessBadge`) :
```js
// Dans buildLead, dans l'objet retourné :
isActiveOwner:       place.isActiveOwner ?? false,
ownerReplyRatio:     place.ownerReplyRatio ?? 0,
```

**Chemin frontend** : `lead.isActiveOwner` (boolean)

### Affichage
- Badge vert `"Gérant actif ✓"` dans :
  - **LeadDetail** : section Réputation, à côté de la note Google
  - **SearchPanel** : dans le composant de rendu de chaque lead dans la liste (inspecter le JSX au moment de l'implémentation)
- Champ frontend : `lead.isActiveOwner`
- `ownerReplyRatio` : stocké sur le lead pour usage futur — non affiché dans cette version.

---

## Feature 3 — Nouveau Business

### But
Identifier les commerces récemment créés.

### Sources de données
1. **Pappers (priorité)** : `pappersData.dateCreation` format ISO `"YYYY-MM-DD"` (champ existant pappersService.js ligne 329)
2. **Fallback heuristique** : `placeData.user_ratings_total < 10` — sans appel API supplémentaire. L'intégration Pappers reste manuelle et inchangée.

### Logique dans `scoring.js` (avant le bloc de calcul du total)

Note : `pappersData` est déjà le 5e paramètre existant de `calculateScore` — aucune modification de signature requise.

```js
const SIX_MONTHS_MS = 180 * 24 * 3600 * 1000  // ~180 jours, approximation consciente
let newBusinessBadge = null

if (pappersData?.dateCreation) {
  const d = new Date(pappersData.dateCreation)
  if (!isNaN(d.getTime())) {  // guard: format invalide → NaN silencieux
    const age = Date.now() - d.getTime()
    if (age < SIX_MONTHS_MS) newBusinessBadge = 'confirmed'
  }
} else if ((placeData.user_ratings_total ?? 99) < 10) {
  newBusinessBadge = 'probable'
}
// Note : placeData.user_ratings_total (pas lead.user_ratings_total — placeData est l'argument passé à calculateScore)
```

### Propagation du badge vers le frontend

`calculateScore` calcule `newBusinessBadge` en interne et l'expose dans son retour. `routes/leads.js` le promeut ensuite en champ top-level du lead.

Le retour de `calculateScore` est étendu :
```js
return {
  total,
  breakdown: { googleRating, reviewVolume, digitalPresence, opportunity, financialCapacity },
  newBusinessBadge,  // NOUVEAU champ dans le retour
}
```

Dans `buildLead` de `leads.js`, la variable locale est `score` (pas `scoreResult`) :
```js
const score = calculateScore(placeData, socialPresence, reviewAnalysis, weights, pappersData, googleAudit)
// Dans l'objet retourné par buildLead, ajouter à côté de `score` :
newBusinessBadge: score.newBusinessBadge ?? null,
```

Le champ `score` lui-même reste `{ total, breakdown }` — `newBusinessBadge` est promu frère au niveau du lead, pas imbriqué dans `score`.

**Chemin frontend** : `lead.newBusinessBadge` (ex: `'confirmed'` ou `'probable'`)

### Scoring
Géré dans le bloc migré de `scoring.js` (voir Feature 2 — même bloc de bonus).

### Affichage
- Badge orange `"Nouveau business 🆕"` si `lead.newBusinessBadge === 'confirmed'`
- Badge gris `"Potentiel nouveau"` si `lead.newBusinessBadge === 'probable'`
- Visible dans : SearchPanel (liste) + LeadDetail (section DONNÉES CLÉS)

---

## Feature 4 — Benchmark Sectoriel

### But
Positionner chaque lead parmi tous les leads observés cross-recherches pour sa catégorie et sa ville.

### Contrainte importante
Le benchmark ne collecte des données que pour les recherches avec un `domain` non vide. Pour les recherches génériques (domain = `''` ou `null`), `benchmarkPercentile` sera `null` et l'affichage masqué. C'est intentionnel et documenté.

### Nouveau fichier : `backend/services/benchmarkService.js`

```js
const cache = new Map()  // Map<"domain:city" → number[]>

function addScore(domain, city, score) {
  if (!domain || !city) return  // guard: évite clés "null:null" ou "undefined:undefined"
  const key = `${domain}:${city}`
  if (!cache.has(key)) cache.set(key, [])
  cache.get(key).push(score)
  // Tech debt connu : cache non borné — ajouter un cap à 200 scores/clé si besoin
}

function getPercentile(domain, city, score) {
  if (!domain || !city) return null
  const key = `${domain}:${city}`
  const scores = cache.get(key) ?? []
  if (scores.length < 5) return null  // pas assez de données
  const below = scores.filter(s => s < score).length
  return Math.round((below / scores.length) * 100)
}

module.exports = { addScore, getPercentile }
```

### Intégration dans `routes/leads.js` — DEUX PASSES obligatoires

`leads.js` expose deux routes : `POST /api/leads/search` (classique) et `POST /api/leads/search/stream` (SSE). Les blocs de post-processing des Features 1, 3 et 4 doivent être appliqués dans les deux routes. Recommandation : extraire le post-processing dans une fonction helper partagée `applyPostProcessing(leads, { city, domain })` appelée depuis les deux routes.

```js
// Après processPlaces() + Feature 1 competitor avg
const city = req.body.city ?? ''
const domain = req.body.domain ?? ''

// Passe 1 : alimenter le cache (tous les leads de la recherche)
for (const lead of leads) {
  benchmarkService.addScore(domain, city, lead.score?.total ?? 0)
}

// Passe 2 : calculer les percentiles (cache complet)
for (const lead of leads) {
  lead.benchmarkPercentile = benchmarkService.getPercentile(domain, city, lead.score?.total ?? 0)
}
```

La séparation en 2 passes garantit :
- Que tous les scores de la recherche sont présents dans le cache avant tout calcul de percentile
- Sans ce découplage, un passage unique ferait que les premiers leads de la recherche (N < 5 en cache) recevraient `null` puisque `getPercentile` exige `scores.length >= 5`

**Chemin frontend** : `lead.benchmarkPercentile` (number 0-100 ou null)

### Affichage LeadDetail
Ligne distincte de Feature 1 (masquée si `null`) :
- Vert (≥ 70) : `"Meilleur que 73% des restaurants de Lyon"`
- Orange (40-69) : `"Meilleur que 45% des restaurants de Lyon"`
- Rouge (< 40) : `"Meilleur que 18% des restaurants de Lyon"`

Non affiché dans SearchPanel (liste) — LeadDetail uniquement.
Note technique : le cache est en mémoire et réinitialisé à chaque redémarrage serveur ; `null` en tests locaux est normal jusqu'à accumulation de 5+ scores pour la clé `domain:city`.

---

## Règles globales respectées

- **Pondérations** : inchangées. Bonus +5 et +15 s'appliquent sur `score.total` après multiplication pondérée, avant `Math.min(100, ...)`. `breakdown.*` non modifié.
- **localStorage** : non touché
- **Pappers** : manuel, non modifié

---

## Fichiers modifiés

| Fichier | Modification |
|---|---|
| `backend/services/googlePlaces.js` | `isActiveOwner` + `ownerReplyRatio` dans retour de `enrichBatch` |
| `backend/services/scoring.js` | `const total` → `let total`, bonuses +5/+15, `newBusinessBadge` dans retour |
| `backend/services/benchmarkService.js` | **Nouveau** — cache percentile sectoriel |
| `backend/routes/leads.js` | `competitorAvg`/`Delta` post-processing, 2 passes benchmark, `lead.newBusinessBadge` + `lead.isActiveOwner` promus top-level ; post-processing appliqué aux 2 routes (search + stream) |
| `frontend/src/components/LeadDetail.jsx` | Affichage 4 signaux (`competitorAvg`, `isActiveOwner`, `newBusinessBadge`, `benchmarkPercentile`) |
| `frontend/src/components/SearchPanel.jsx` | Badges `isActiveOwner` + `newBusinessBadge` dans liste leads |
