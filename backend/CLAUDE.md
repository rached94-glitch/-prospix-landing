# CLAUDE.md — Backend LeadGen Pro

> Instructions spécifiques au backend Node.js/Express. Complète le CLAUDE.md racine.

---

## STACK

Node.js 20 + Express 4 — port **3001**
CommonJS strict (`require` / `module.exports`) — jamais d'ESM.

---

## CONVENTION : ROUTES EXPRESS

Toujours suivre ce pattern dans l'ordre exact :

```js
router.post('/ma-route', async (req, res) => {
  try {
    // 1. Validation des inputs
    const { param1, param2 } = req.body
    if (!param1) return res.status(400).json({ error: 'param1 requis' })

    // 2. Vérification du cache AVANT l'appel API
    const cacheKey = `prefix_${param1}`
    const cached = myCache.get(cacheKey)
    if (cached) {
      console.log(`[MaRoute] cache HIT ${cacheKey}`)
      return res.json(cached)
    }

    // 3. Appel API avec withTimeout — JAMAIS sans
    const result = await withTimeout(
      monServiceExterne(param1, param2),
      30_000,       // 30s max
      null          // fallback — jamais reject
    )

    // 4. Mise en cache
    myCache.set(cacheKey, result, TTL_7D)

    // 5. Réponse
    res.json(result)
  } catch (e) {
    console.error('[MaRoute] error:', e)
    res.status(500).json({ error: e.message })
  }
})
```

---

## CONVENTION : withTimeout()

**Obligatoire sur TOUT appel API externe.** Résout avec `fallback` si timeout — ne rejette jamais.

```js
// Définition dans routes/leads.js (utilise resolve, jamais reject)
function withTimeout(promise, ttlMs, fallback = null) {
  return Promise.race([
    promise,
    new Promise(resolve => setTimeout(() => resolve(fallback), ttlMs)),
  ])
}

// Attention : googlePlaces.js a son propre withTimeout() qui lui REJETTE
// → Il est interne à ce service, ne pas l'importer ailleurs
```

Timeouts standards :
- Appels API enrichissement lead : `30_000` (30s)
- Appels simples (cache check, etc.) : `5_000` (5s)

---

## CONVENTION : CACHE

### Toujours utiliser createCache()

```js
const { createCache } = require('../cache/searchCache')
const myCache = createCache('monNamespace')  // snake_case, unique dans tout le projet

// TTLs de référence
const TTL_7D  = 7 * 24 * 60 * 60 * 1000
const TTL_48H = 48 * 60 * 60 * 1000
const TTL_1H  =      60 * 60 * 1000
```

**Interdit :**
- `new Map()` pour du cache persistant
- Lire/écrire `apiCache.json` directement
- Créer un namespace déjà existant (voir tableau racine CLAUDE.md)

### API d'une instance

```js
cache.get(key)           // valeur ou null (purge auto si expiré)
cache.set(key, v, ttl)   // stocke + flush async debounce 5s
cache.has(key)           // boolean, purge si expiré
cache.delete(key)        // supprime + flush async
cache.clear()            // vide tout + reset compteurs
cache.stats()            // { name, entries, hits, misses, sets, hitRate% }
```

### Clés de cache — format recommandé

```js
`place_details_${placeId}`           // ✅
`place_basic_${placeId}`             // ✅
`unlock_${placeId}_${profileId}`     // ✅
`localrank_${placeId}_${cat}_${city}`// ✅
```

---

## CONVENTION : LOGS

**Toujours** préfixer avec `[NomService]` :

```js
// Services
console.log('[Places] searchPlaces → lat=48.85 lng=2.35 radius=5km domain=restaurant')
console.log('[Places] editorial_summary raw:', r.editorial_summary)
console.log('[Scoring] calculateScore profil=photographe score=72')
console.log('[Pappers] Stratégie 1 : recherche par nom exact')
console.log('[LinkedIn] Dirigeant trouvé : Jean Dupont via Google')
console.log('[Social] Détection LinkedIn → https://linkedin.com/...')
console.log('[PageSpeed] Score perf=45 seo=78 lcp=4.2s')
console.log('[Apify] Reviews actor terminé : 97 avis chargés')

// Coûts API (aide à surveiller la facturation)
console.log('[API COST] Appel réel à Google API: Places NearbySearch — type=restaurant page=1')
console.log('[API COST] Appel réel à Google API: Place Details — placeId=ChIJ123')
console.log('[API COST] Appel réel à Google API: Places TextSearch — "restaurant Paris"')

// Cache
console.log('[Cache] HIT  placeDetails:ChIJ123')
console.log('[Cache] MISS placeDetails:ChIJ456')

// Routes SSE
console.log('[Stream] Requête reçue — body:', JSON.stringify(req.body))
console.log('[Stream] searchPlaces terminé — 47 lieux (fromCache:false)')
console.log('[Enrich] Lead 3/10 terminé : Brasserie Le Marais')
console.log('[Unlock] Brasserie Le Marais (ChIJ123) déverrouillé')
```

---

## CONVENTION : ROUTES SSE

```js
// Headers obligatoires dans cet ordre exact
res.setHeader('Content-Type',  'text/event-stream')
res.setHeader('Cache-Control', 'no-cache')
res.setHeader('Connection',    'keep-alive')
res.flushHeaders()

// Helper d'envoi — TOUJOURS vérifier writableEnded
const send = data => {
  if (res.writableEnded) return        // ← guard obligatoire
  try {
    res.write(`data: ${JSON.stringify(data)}\n\n`)
  } catch (e) {
    console.error('[Stream] res.write error:', e.message)
  }
}

// Types d'événements standards
send({ type: 'page',     page: N, message: 'Page N/3 (restaurant)' })
send({ type: 'progress', message: 'Scoring...' })
send({ type: 'enrich',   done: N, total: M, message: 'Enrichissement N–M / total' })
send({ type: 'cache',    message: 'Résultats depuis le cache ⚡' })
send({ type: 'done',     leads: [], total: N })
send({ type: 'error',    message: 'description erreur' })
```

---

## VARIABLES D'ENVIRONNEMENT DISPONIBLES

```bash
# Obligatoires
GOOGLE_MAPS_API_KEY          # Places API (NearbySearch, Details, TextSearch)
VITE_GOOGLE_MAPS_KEY         # Clé frontend (MapLibre)

# Enrichissement
PAGESPEED_API_KEY             # PageSpeed Insights + CrUX API
GOOGLE_CSE_KEY                # Custom Search JSON API (pages indexées)
GOOGLE_CSE_CX                 # ID du moteur de recherche personnalisé
PAPPERS_API_KEY               # Pappers.fr — données financières entreprises
ANTHROPIC_API_KEY             # Claude AI — analyse avis, emails, vision
APIFY_API_TOKEN               # Apify — avis Google, social media, SEMrush
HUNTER_API_KEY                # Hunter.io — email du dirigeant

# Google Sheets
GOOGLE_SERVICE_ACCOUNT_EMAIL  # Service account email
GOOGLE_PRIVATE_KEY            # Clé privée RSA (multiline — échapper \n en prod)

# Optionnel
PORT                          # Défaut : 3001
CORS_ORIGIN                   # Défaut : localhost:5173,5174,5175
```

---

## SERVICES — SIGNATURES CLÉS

### `googlePlaces.js`

```js
// Phase 1 — basic fields, locked:true
searchPlaces({ lat, lng, radius, keywords, domain, onProgress })
  → { places[], fromCache }

// Phase 2 — champs complets (phone, website, reviews, opening_hours)
getPlaceDetails(placeId)
  → { formatted_phone_number, website, opening_hours, reviews[], photos[], editorial_summary, ... }

// Phase 1 — basic fields uniquement (photos, price_level, rating, user_ratings_total)
getPlaceDetailsBasic(placeId)
  → { photos[], price_level, rating, user_ratings_total }

// Utilitaires (exportés, utilisables depuis leads.js)
cleanWebsiteUrl(raw)                        → string | null
scrapeDescription(websiteUrl, editorial)    → { hasDescription, descriptionText, descriptionSource }
getPhotoUrls(photos, maxPhotos)             → string[]
getLocalRank(placeId, category, city)       → { rank, outOf, found, topThree, topTen }
```

### `scoring.js`

```js
calculateScore(placeData, socialPresence, reviewAnalysis, weights, pappersData, googleAudit, profileId, pagespeedData)
  → { total: number, breakdown: { googleRating, reviewVolume, digitalPresence, opportunity, financialCapacity }, newBusinessBadge }

// weights = null → profil défaut 30/25/25/20
// profileId = null → profil défaut
```

### `aiReviewAnalysis.js`

```js
analyzeWithAI(reviews, businessName, profileId, meta, auditData)
  → { report: string (Markdown), totalReviews, avgRating, unanswered }

generateEmailPhotographe({ leadData, reviewsData, photoQuality, socialActivity })
generateEmailSEO({ leadData, pagespeedData, reviewsData, localRank })
generateEmailChatbot({ leadData, pagespeedData, reviewsData })
generateAuditSEO({ businessName, websiteUrl, pagespeedData, ... })
  → { subject, body } | { report }
```

Modèle : `claude-sonnet-4-6`. **Pas de cache** — chaque appel est facturé.

---

## NE JAMAIS MODIFIER SANS DEMANDE

- `server.js` — CORS, ports, montage des 6 groupes de routes
- `cache/searchCache.js` — cœur de la persistance TTL
- `data/scoringProfiles.json` — profils utilisateur sauvegardés
- `nodemonConfig.ignore` dans `package.json` — évite l'ECONNRESET SSE
- `.env` — jamais committer, jamais afficher en clair
