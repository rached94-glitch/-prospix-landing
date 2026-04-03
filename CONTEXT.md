# LeadGen Pro — Contexte Projet

## Stack
- Backend : Node.js + Express (port 3001)
- Frontend : React + Vite (port 5173)

## Structure backend/
- server.js — point d'entrée
- .env — toutes les clés API
- services/scoring.js — logique scoring /100 par profil (+ opportunité spécifique photographe)
- services/aiReviewAnalysis.js — analyse avis via Claude API
- services/pappersService.js — données financières Pappers
- services/googlePlaces.js — recherche leads Google Places (+ isActiveOwner/ownerReplyRatio)
- services/pagespeedService.js — audit PageSpeed + CrUX API (cache 24h / 48h)
- services/socialEnrichment.js — détection réseaux sociaux (linkedin/fb/ig/tiktok/pinterest/youtube)
- services/visualAnalysisService.js — capture Puppeteer + analyse Claude Vision (designer/photographe/copywriter)
- services/benchmarkService.js — cache percentile sectoriel cross-recherches (domain:city → scores[])
- cache/pagespeedCache.js — cache mémoire 24h (vidé au démarrage)
- cache/searchCache.js — factory cache TTL générique (createCache/getAllStats) — NEW
- routes/leads.js — endpoints leads + analyse IA + génération email + applyPostProcessing (4 signaux)
- routes/profiles.js — profils de scoring
- routes/export.js — export PDF
- routes/visualAnalysis.js — POST /api/leads/visual-analysis
- routes/cache.js — GET /api/cache/stats (stats hit/miss tous les caches) — NEW

## Structure frontend/src/
- App.jsx — état global, routing
- theme-new.css — tokens de référence redesign vert/jaune (documentation)
- components/SidebarSearch.jsx — panneau gauche recherche (⚠️ PAS SearchPanel.jsx — inutilisé)
- components/SearchPanel.jsx — FICHIER NON UTILISÉ dans App.jsx (remplacé par SidebarSearch)
- components/LeadDetail.jsx — panneau droit détail lead + score + analyse
- components/ScoringProfileDrawer.jsx — drawer profils de scoring
- components/Map.jsx — carte interactive react-map-gl

## Profils de scoring (Note% / Avis% / Présence% / Opportunité%)
- Défaut : 30/25/25/20
- Dev Chatbot IA : 10/10/10/70
- SEO : 15/15/60/10
- Social Media : 10/15/55/20
- Photographe : 20/15/20/45
- Vidéaste : 15/10/40/35
- Designer : 15/10/35/40
- Copywriter : 20/30/25/25
- Développeur Web : 15/10/45/30
- Consultant SEO : 10/40/30/20
- Email Marketing : 15/20/30/35
- Pub Google : 50/20/20/10

## Barèmes scoring sur 100
NOTE : 4.5-5→100 | 4.0-4.4→73 | 3.5-3.9→47 | <3.5→17 | sans→0
AVIS : 500+→100 | 200-499→80 | 100-199→60 | 50-99→40 | 20-49→20 | <20→0
PRÉSENCE : site→+40 | facebook→+20 | instagram→+20 | linkedin→+12 | tiktok→+8
OPPORTUNITÉ (défaut) : sans site→100 | site sans réseaux→70 | site+1 réseau→40 | site+2+→15
OPPORTUNITÉ (photographe) : photoCount=0→100 | ≤5→85 | ≤15→65 | ≤30→35 | >30→10
  + visualBonus : -instagram→+20 | -tiktok→+10 | -pinterest→+5 | -youtube→+5
  + pénalité : sans site web → photoScore - 20 (budget limité)
  → cap final Math.min(100, photoScore + visualBonus)

## Bonus de score universels (tous profils)
- +5 pts si isActiveOwner (gérant répond activement aux avis, ≥3/5 réponses)
- +15 pts si newBusinessBadge (< 6 mois : Pappers dateCreation ou user_ratings_total < 10)
- Ces bonus s'appliquent sur score.total APRÈS multiplication pondérée, AVANT Math.min(100)

## Clés API (.env backend)
- GOOGLE_MAPS_API_KEY
- ANTHROPIC_API_KEY
- PAPPERS_API_KEY
- APIFY_API_TOKEN

## Design
- Dark mode, accent vert #1D6E55, accent jaune #EDFA36
- Background #0D1410, surface #111813, texte #F5F5F0
- Style Linear/Notion/Slack
- Navbar 52px icônes
- Redesign complet 2026-04-03 : branche redesign-ui-vert-jaune mergée dans master

## Fonctionnalités actives
- Carte interactive react-map-gl + MapLibre
- Marqueurs colorés : vert 70+, orange 40-69, rouge <40
- Analyse avis IA Claude (streaming)
- Intégration Pappers (chargement manuel)
- Export PDF 2 pages
- Email AIDA+PAS par profil (prompt spécialisé PHOTOGRAPHE avec visualAnalysis)
- Favoris + historique localStorage
- Indicateur crédits 847/1000
- Détection sans chatbot, sans site web, réseaux sociaux
- Autocomplétion ville + sélecteur pays
- Audit PageSpeed on-demand (profils SEO/consultant-seo/dev-web/pub-google)
  - 16 KPIs grille 2 colonnes + liste problèmes triés rouge/orange
  - HTTPS via catégorie best-practices Lighthouse (buildQS inclut best-practices)
  - Cache PSI vidé au démarrage serveur
- CrUX API intégrée (données réelles Chrome, cache 48h)
  - Section "PERFORMANCES RÉELLES" sous la grille SEO
  - Seuils Core Web Vitals officiels : LCP/FCP/CLS/INP/TTFB/FID
  - Si null : card verte "données issues d'un audit Google en temps réel"
- Analyse Visuelle IA (profils Designer/Photographe/Copywriter uniquement)
  - Capture Puppeteer 3 zones : header (1 crédit), corps (2), full (3)
  - Anti-bot : userAgent Chrome, retry domcontentloaded → load
  - Analyse Claude Vision avec prompt dédié par profil
  - Résultat : score/100, époque, verdict, observations colorées red/orange/green
  - Cache screenshot 30 min, cache CrUX 48h
- Card "RÉSEAUX VISUELS" profil Photographe (Instagram/Facebook/TikTok/Pinterest/YouTube)
- 4 signaux universels enrichissement (tous profils, toutes recherches) :
  - competitorAvg / competitorDelta — positionnement vs moyenne de la même recherche
  - isActiveOwner — gérant répond à ≥3/5 avis visibles (totalRatings ≥5)
  - newBusinessBadge — 'confirmed' (Pappers <6 mois) ou 'probable' (totalRatings <10)
  - benchmarkPercentile — percentile cross-recherches par domain:city (cache mémoire, min 5 scores)
- Section POSITIONNEMENT dans LeadDetail (entre SCORE DÉTAILLÉ et ANALYSE DES AVIS)
  - Card "Moyenne secteur" : valeur + delta coloré vert/rouge/gris
  - Card "Benchmark sectoriel" : barre de progression + texte neutre + mini-liste 5 peers de la recherche
  - Peers triés par score décroissant, lead actuel mis en évidence (fond violet + "← vous")

## Commandes
Backend : cd backend && node server.js
Frontend : cd frontend && npm run dev
Kill ports : taskkill /F /IM node.exe

## Problèmes connus résolus
- Scoring : tous les critères plafonnés avec Math.min(100, score)
- website détecté comme absent si : undefined, null, "", "null", "undefined"
- user_ratings_total casté en Number() avant toute comparaison
- localStorage vidé au démarrage : ville vide, carte centrée France lat:46.5 lng:2.5 zoom:6

## Règles importantes — NE PAS TOUCHER
- Les pondérations des profils de scoring
- La logique localStorage des favoris et de l'historique
- L'intégration Pappers : chargement manuel uniquement, jamais inclus dans le score automatique
- Le système de crédits 847/1000

## Workflow Claude Code
- Toujours lire CONTEXT.md en premier avant toute modification
- Ne lire que les fichiers strictement nécessaires à la tâche
- Toujours montrer les lignes avant/après chaque modification
- Ne jamais modifier plus de fichiers que nécessaire

---

## Session 2026-04-03 — Modifications

### Redesign UI — branche redesign-ui-vert-jaune (mergée dans master)
- Palette complète : cyan #00d4ff → vert #1D6E55 | violet #6366f1/#8b5cf6 → vert #1D6E55 / jaune #EDFA36
- Nouveau fichier `frontend/src/theme-new.css` — tokens de référence documentés
- `App.css` — tokens :root redessinés, scrollbar, orbs, gradient-text, inputs, sliders, boutons, lead-cards
- `NavBar.jsx` — fond #0D1410, logo gradient vert→jaune, bouton actif vert
- `SidebarLeads.jsx` — pills tri vert, badge filtres jaune
- `SearchPanel.jsx` — S.panel rgba(17,24,20,0.95)+radius 16, S.block, chips h:22 radius:11, bouton #EDFA36 h:52
- `ScoringProfileDrawer.jsx` — toutes les couleurs cyan→vert
- `LeadDetail.jsx` — toutes les couleurs violet→vert/jaune (#0d0d1a/#1a1830/#1e1b4b→tokens verts)
- `LeadCard.jsx` — couleurs sélection vert

### ⚠️ SearchPanel.jsx vs SidebarSearch.jsx
- `SearchPanel.jsx` est un fichier **non utilisé** — App.jsx importe `SidebarSearch.jsx`
- Les modifications de style dans SearchPanel.jsx n'ont aucun effet en browser
- Appliquer les changements de style dans `SidebarSearch.jsx` pour voir le résultat

### Système de cache backend (createCache)
- `backend/cache/searchCache.js` créé — factory TTL générique avec registry et stats
  - `createCache(name)` → { get, set, has, delete, clear, stats }
  - `getAllStats()` → stats de tous les caches enregistrés
- `googlePlaces.js` — 3 caches : `search` 6h | `placeDetails` 24h | `localRank` 24h
  - Inline `searchCache = new Map()` remplacé par `createCache('search')`
- `socialEnrichment.js` — cache `social` 48h, `placeId` optionnel dans `enrichSocial`
- `pagespeedService.js` — cache `nap` 24h, `placeId` 5e paramètre optionnel de `checkNAP`
- `routes/leads.js` — passe `place.place_id` à `enrichSocial` et `placeId` à `checkNAP`
- `routes/cache.js` — `GET /api/cache/stats` retourne hit/miss/hitRate de tous les caches
- `server.js` — monte `/api/cache`

---

## generateEmailPhotographe — refonte complète 28/03/2026

### aiReviewAnalysis.js — generateEmailPhotographe
- Prompt réduit de 680 à 320 mots
- Structure 5 paragraphes obligatoires :
  - P1 : accroche fixe narratif (quasi-verbatim)
  - P2 : 2 citations exactes de topQuotes tissées en prose, jamais en liste — termine par "Ce n'est pas le genre d'expérience qu'on fabrique."
  - P3 : UNE image forte calculée côté JS selon priorité (avant envoi au modèle) :
    1. `photoCount < 15` → chiffre réel interpolé
    2. Observation rouge `visualAnalysis` disponible → reformulée naturellement
    3. Instagram présent mais peu actif → "Vous publiez régulièrement mais quelque chose ne passe pas visuellement en ligne."
    → Termine OBLIGATOIREMENT par : "Cette réputation existe — elle reste juste invisible."
  - P4 : prose — "j'ai identifié exactement ce qui mériterait d'être capturé : {sujet 1}, {sujet 2} et {sujet 3}" — sujets très spécifiques au commerce, tirés des mots-clés avis
  - P5 : CTA fixe + signature "Photographe commerce local — {city}"
- Règles absolues :
  - 200 mots maximum
  - Jamais de liste à puces dans le corps
  - Jamais de placeholder `[Prénom]` `[Email]` `[Téléphone]`
  - Jamais de chiffres inventés — UNIQUEMENT `rating` et `reviewCount` fournis
  - Jamais le statut ouvert/fermé ni les horaires
- Données réelles injectées et verrouillées : `name`, `city`, `category`, `rating`, `reviewCount`, `photoCount`
- Règle INTERDIT avec valeurs JS interpolées (ex : "Écrire une note différente de 4.3") — le modèle voit le chiffre exact deux fois
- Bugs corrigés :
  - Chiffres inventés → bloc INTERDIT avec valeurs interpolées en dur
  - Placeholders `[Prénom]` etc. → supprimés définitivement
  - Listes à puces dans le corps → interdites explicitement
  - P3 résolu en JS (`p3Hint`) avant envoi au modèle, aucune ambiguïté laissée au modèle

---

## Session 2026-03-28 — Modifications

### visualSocialService.js — Nouveau service (analyses visuelles réseaux sociaux)
- `analyzeNetworkPhotos(networkUrl, network)` — outer guard, retourne toujours JSON
- `_analyzeNetworkPhotos` : route facebook → `fetchFacebookImages`, autres → NETWORK_CONFIG
- Acteurs Apify par réseau :
  - Instagram : `apify~instagram-scraper`
  - TikTok : `clockworks~free-tiktok-scraper` (remplace `apify~tiktok-scraper`)
  - Pinterest : `tri_angle~pinterest-scraper` (essais successifs d'acteurs)
  - YouTube : `streamers~youtube-scraper`
  - Facebook : deux acteurs fallback (`facebook-posts-scraper` → `facebook-scraper`)
- Facebook retourne `{ error: 'Photos Facebook inaccessibles — compte protégé', protected: true }` si les deux acteurs échouent
- TikTok : si erreur → `{ error: 'tiktok_restricted' }` affiché avec lien vers le compte
- Pinterest/YouTube : désactivés côté frontend (message statique + lien), acteurs gardés pour tests futurs
- Codes d'erreur par HTTP status : 404→"Compte introuvable", 403→"Accès refusé", timeout→"Délai dépassé"
- URL nettoyage : `url.split('?')[0]` pour tous les réseaux avant appel Apify
- Prompts améliorés :
  - `PROMPT_PHOTO` (instagram/facebook) : 5 critères détaillés + barème score documenté
  - `PROMPT_VIDEO` (tiktok) : 5 critères accroche/lisibilité/qualité/cohérence/conversion
- Logs debug : `Pinterest items`, `YouTube items`, `YouTube item keys`

### socialMediaService.js — Nouveau endpoint + nettoyage URLs
- `getInstagramPosts(url)` : 12 posts via Apify, calcule postCount/avgLikes/avgComments/postsPerMonth/lastPostDate/topHashtags
- `cleanInstagramUrl(url)` : strip `?query`, rejette `/p/` et `/reel/`
- `cleanFacebookUrl(url)` : strip `?query`
- Gestion `status 400` et `not_available` dans tous les catch blocks

### routes/leads.js — Nouveaux endpoints
- `POST /instagram-deep` : appelle `getInstagramPosts`, retourne stats profondes
- `POST /network-visual` : appelle `analyzeNetworkPhotos`, réseau validé en whitelist
- `GET /facebook-stats?url=` : slim wrapper `getFacebookActivity` (sans pagespeed)
- `GET /tiktok-stats?url=` : scraping HTML TikTok avec cheerio, extrait `__UNIVERSAL_DATA_FOR_REHYDRATION__` → followers/videoCount/heartCount

### LeadDetail.jsx — Profil Photographe — COMPLET
- **États ajoutés** : `igDeep/igDeepLoading/igDeepError`, `netVisual/netVisualLoading/netVisualError`, `fbStats/fbStatsLoading/fbStatsError`, `tkStats/tkStatsLoading/tkStatsError`
- **Handlers** : `handleInstagramDeep`, `handleNetworkVisual`, `handleFbStats`, `handleTkStats`
- **Cards réseaux** :
  - Card Instagram : bouton "Stats & activité — 1 crédit" (postCount/avgLikes/postsPerMonth/hashtags) + bouton "Qualité des photos — 1 crédit" (Claude Vision)
  - Card Facebook : bouton "Stats & activité — 1 crédit" si fbAct non dispo, sinon données auto ; message statique "Analyse visuelle non disponible — politique Meta" + lien "Voir la page →"
  - Card TikTok : bouton "Stats & activité — gratuit" (HTML scraping) + bouton "Qualité des photos — 1 crédit" (Claude Vision) ; si erreur vision → "Analyse TikTok indisponible — plateforme restreinte" + lien "Voir le compte TikTok →"
  - Card Pinterest : message statique "Analyse visuelle non disponible — plateforme restreinte" + lien "Voir le compte →"
  - Card YouTube : idem Pinterest
- **Score visuel global** : moyenne de tous les scores analysés (photoQuality + visualAnalysis + netVisual), affiché si ≥2 sources
- **"Score basé sur les données publiques"** : texte gris 12px sous score total, profil photographe uniquement
- **Boutons renommés** (Instagram) : "Stats & activité — 1 crédit" / "Qualité des photos — 1 crédit"
- **Mode test** `?test=true` : ajouté puis supprimé dans la même session

### aiReviewAnalysis.js — generateEmailPhotographe
- Placeholder `[Numéro]` supprimé du CTA → "Vous pouvez me répondre directement à cet email"
- Signature simplifiée : suppression `[Prénom] [Nom]` → uniquement "Photographe commerce local — {city}"

### visualAnalysisService.js — executablePath multi-OS
- `executablePath` : `process.platform === 'win32' ? 'C:\\Program Files\\Google\\Chrome\\...' : undefined`
- StealthPlugin (`puppeteer-extra-plugin-stealth`) installé et activé

---

## Session 2026-03-25 — Modifications

### googlePlaces.js — isActiveOwner + ownerReplyRatio
- `enrichBatch` retourne deux nouveaux champs :
  - `isActiveOwner = totalRatings >= 5 && repliedCount >= 3` (60% seuil effectif sur 5 avis visibles)
  - `ownerReplyRatio = repliedCount / Math.min(totalRatings, 5)` (stocké, non affiché)
- `totalRatings` = `details.user_ratings_total ?? place.user_ratings_total ?? 0`
- `repliedCount` = nombre d'avis avec `author_reply` dans les 5 retournés

### services/benchmarkService.js — Nouveau service
- Cache mémoire `Map<"domain:city" → number[]>`
- `addScore(domain, city, score)` : guard si domain ou city vide, cap non borné (tech debt connu)
- `getPercentile(domain, city, score)` : retourne null si <5 scores, sinon percentile 0-100
- Cache réinitialisé à chaque redémarrage serveur — null en tests locaux jusqu'à 5+ scores

### scoring.js — 4 modifications
- `SIX_MONTHS_MS = 180 * 24 * 3600 * 1000` ajouté au niveau module
- `newBusinessBadge` : Pappers dateCreation prioritaire → 'confirmed' | fallback totalRatings <10 → 'probable'
- Bonuses sur total : `+5 si isActiveOwner`, `+15 si newBusinessBadge` (avant Math.min(100))
- Retour étendu : `{ total, breakdown, newBusinessBadge }`
- `photographeOpportunityScore(placeData, socialPresence)` : logique photo+réseaux visuels
  - photoCount=0→100 | ≤5→85 | ≤15→65 | ≤30→35 | >30→10
  - Pénalité -20 si pas de site web (`sitePresent` existant)
  - visualBonus : instagram→+20, tiktok→+10, pinterest→+5, youtube→+5 (si absents)
  - Activée uniquement si `profileId === 'photographe'` (7e paramètre de `calculateScore`)
- `calculateScore` : nouveau 7e paramètre `profileId = null`

### routes/leads.js — Propagation profileId + post-processing
- `profileId` propagé : req.body → processPlaces → buildLead → calculateScore (7e arg)
- `buildLead` retour étendu : `newBusinessBadge`, `isActiveOwner`, `ownerReplyRatio`
  - `score` reste `{ total, breakdown }` uniquement (newBusinessBadge promu frère)
- `applyPostProcessing(leads, { city, domain })` — helper partagé, 2 passes benchmark :
  - Feature 1 : competitorAvg (moyenne scores recherche) + competitorDelta par lead
  - Feature 4 : passe 1 addScore, passe 2 getPercentile (séparation garantit cache complet)
- Appliqué dans les deux routes : `/search/stream` (SSE) et `/search` (classique)

### App.jsx — profileId envoyé au backend
- `searchLeads` : ajout `profileId: activeProfile?.id ?? null` dans les params

### LeadCard.jsx — Badges dans la liste
- Badge vert `"Gérant actif ✓"` si `lead.isActiveOwner`
- Badge orange `"Nouveau business"` si `lead.newBusinessBadge === 'confirmed'`
- Badge gris `"Potentiel nouveau"` si `lead.newBusinessBadge === 'probable'`

### LeadDetail.jsx — Affichage 4 signaux
- Badge `"Gérant actif ✓"` (vert) dans section Réputation, à côté note Google
- Badges `newBusinessBadge` dans section DONNÉES CLÉS
- Section POSITIONNEMENT (entre SCORE DÉTAILLÉ et ANALYSE DES AVIS) :
  - Card "Moyenne secteur" : competitorAvg à droite, delta coloré en dessous
  - Card "Benchmark sectoriel" : header percentile coloré, barre progression, texte neutre factuel
    (`"se situe dans le tiers supérieur / dans la moyenne / en dessous de la moyenne de son secteur."`)
    + bloc explicatif fond rgba(255,255,255,0.03) border-left violet + mini-liste 5 peers
  - `leads` prop ajoutée (`leads={safeLeads}` depuis App.jsx) pour alimenter la mini-liste
  - City extraite de `lead.address.split(',').pop().trim()`
  - Seuils couleur benchmark : vert ≥60 | orange 40-59 | rouge <40

### exportPDF.js — 2 corrections
- **Email coupé** : `id="email-section"` sur le wrapper, mesure `offsetTop % PAGE_PX` après appendChild
  - Si < 200px restants sur la page courante → `paddingTop = remaining` pour forcer page suivante
  - `PAGE_PX = Math.round(297 * 794 / 210) ≈ 1123px`
- **Sections par profil** :
  - Photographe : chatbot masqué, carte "Audit digital" entière masquée, Cap. financière masquée si = 0
  - SEO : Instagram + TikTok masqués dans Présence digitale, "Photos fiche Google" masqué dans Audit
  - `profileId = activeProfile?.id ?? null` extrait en tête de `buildReportHTML`

---

## Session 2026-03-24 — Modifications

### socialEnrichment.js — Détection réseaux sociaux (réécriture extractSocialLinks)
- Remplacement de la détection par regex brute par parsing cheerio structuré
- Ajout `SHARE_BLACKLIST = ['share', 'sharer', 'intent', 'dialog', 'login', 'signup']`
- Ajout `isShareLink(href)` et `validateSocialHref(network, href)` avec règles par réseau
  - Instagram : exclut `/p/` et `/reel/` (liens de partage)
  - Facebook : exclut `/sharer`, `/share`, `/dialog`
  - Tiktok : exclut `/tag/` et `/discover/`
- Détection 3 sources par réseau : `href` → `script` → `meta`
- Log `[Social] network href → OK/ignoré` pour chaque lien testé

### socialMediaService.js — Facebook dual-actor
- `getFacebookActivity` divisé en 2 appels Apify distincts :
  1. `apify~facebook-pages-scraper` → followers, likes
  2. `apify~facebook-posts-scraper` → `lastPostDate` (champs : `time ?? date ?? created_time`)
- Deuxième appel isolé dans try/catch (échec ignoré, ne bloque pas les followers)
- Ajout logs diagnostics : `[Facebook Apify] résultat brut:` + `[Facebook Apify] champs disponibles: Object.keys(...)`
- Ajout log `[Instagram Apify] résultat brut:` pour debug Instagram

### aiReviewAnalysis.js — generateEmailPhotographe
- Accepte `facebookActivity` et `instagramActivity` en paramètres
- Prompt inclut followers FB/IG et label d'activité
- Nettoyage du body après parse JSON :
  - Suppression lignes `---`
  - Réduction triple sauts de ligne → double
  - `.trim()`

### services/photoQualityService.js — Nouveau service
- `analyzePhotoQuality(photoUrls)` : télécharge jusqu'à 3 photos Google en base64
- Envoie à Claude Vision (`claude-sonnet-4-6`) avec prompt photographe pro
- Retourne `{ verdict, score, observations, photosAnalyzed }`
- Verdicts : `Professionnelles / Correctes / Amateur / Génériques / Mixte / Non analysable`
- Observations : `{ level: 'red'|'orange'|'green', text }`, max 3

### googlePlaces.js — getPhotoUrls
- Ajout fonction `getPhotoUrls(photos, maxPhotos = 5)`
- Génère URLs Google Places Photo API avec `photo_reference`
- Export ajouté : `module.exports = { searchPlaces, getPlaceDetails, getPhotoUrls }`

### routes/leads.js — Nouveaux endpoints et corrections
- Import `{ getPlaceDetails, getPhotoUrls }` depuis googlePlaces
- Import `{ analyzePhotoQuality }` depuis photoQualityService
- `generateEmailPhotographe` appelé pour tous les profils photographe (suppression condition `&& visualAnalysis`)
- Destructuring `/generate-email` body : ajout `facebookActivity = null`, `instagramActivity = null`
- Body email transmet : `visualAnalysis`, `googleData`, `siteAnalysis`, `reviewsData`, `facebookActivity`, `instagramActivity`
- Nouveau `POST /photo-quality` : appelle `analyzePhotoQuality(photoUrls)`, retourne résultat IA
- `GET /audit` : accepte param `placeId`, appelle `getPlaceDetails(placeId)` si fourni, retourne `photoUrls` dans réponse

### LeadDetail.jsx — Session 2026-03-24
- **États ajoutés** : `photoQuality`, `photoQualityLoading`, `pdfLoading`
- **useEffect reset** : inclut `setPhotoQuality(null)`, `setPhotoQualityLoading(false)`
- **handleAnalyzePhotoQuality** : appelle `/audit?placeId=...` pour URLs, puis `/photo-quality`
- **handleGenerateAIEmail body** : transmet `visualAnalysis`, `googleData`, `siteAnalysis`, `reviewsData`, `facebookActivity`, `instagramActivity`, `photoQuality`, `decisionMaker`, `city`, `category`
- **Audit button** : bouton "Analyser les performances digitales" photographe déplacé avant ANALYSE VISUELLE IA ; doublon supprimé (ancien bouton `🚀` lignes 1694-1700)
- **igConfirmed** : inclut `igActivity?.status === 'active' || igActivity?.status === 'inactive'`
- **DONNÉES CLÉS — restructure complète profil PHOTOGRAPHE** :
  - Bloc IIFE conditionnel `activeProfile?.id === 'photographe' ? (() => {...})() : (<>...</>)`
  - 5 cards en ligne avec style constants `CARD`, `ROW(last)`, `LBL`, `VAL(color)`, `BADGE`, `BTN`
  - Card 1 — Photos Google : compteur + bouton "Analyser la qualité" + résultat IA (verdict/score/badges hasStockPhotos/hasAuthenticPhotos/observations)
  - Card 2 — Facebook : Présent/Non présent + Followers + Dernier post (conditionnel si fbAct)
  - Card 3 — Instagram : toujours affichée ; Présent/Non présent + Followers + Dernier post + message italic "Secteur très visuel — opportunité directe" si absent sans données
  - Card 4 — Réputation : Note Google + Avis sans réponse
  - Card 5 (ex-6) — Performances digitales : bouton "Analyser les performances digitales" (si auditState !== 'done')
  - Card 5 Site web supprimée (remplacée par section ANALYSE VISUELLE IA)
  - Suppression du message flottant "Pas sur Instagram — secteur très visuel" des problems
  - Suppression variable `igAbsent`
- **Export PDF** : remplacé `window.print()` par `jsPDF + html2canvas`
  - `exportPDF.js` : `buildReportHTML()` (contenu inchangé) + `exportLeadPDF()` async
  - Div invisible 794px rendu hors écran, capturé en canvas scale:2, paginé en A4
  - Téléchargement direct `pdf.save()` sans popup — nom : `LeadGen-{NomCommerce}-{date}.pdf`
  - Bouton : état `pdfLoading`, texte `⏳ Génération en cours…` pendant export
- **Card 1 — badges photoQuality** :
  - Badge orange "Photos de marques détectées" si `hasStockPhotos === true`
  - Badge rouge "Aucune photo authentique du commerce" si `hasAuthenticPhotos === false`

### aiReviewAnalysis.js — generateEmailPhotographe (refonte prompt)
- Signature étendue : `photoQuality`, paramètres `leadData` enrichis (`city`, `category`, `decisionMaker`)
- Prompt entièrement réécrit avec structure obligatoire en 5 paragraphes :
  - P1 : accroche naturelle avec ville + type de commerce
  - P2 : citations exactes topQuotes + compteur avis
  - P3 : dissonance expérience clients / photos actuelles — phrase verrouillée construite en JS à partir de `topQuotes.slice(0,2)` + `leadData.reviewCount`, reformulée en prose par le modèle. Termine OBLIGATOIREMENT par "Cette réputation existe — elle reste juste invisible."
  - P4 : présentation photographe + 3-4 sujets spécifiques basés sur mots-clés avis
  - P5 : offre + CTA + signature avec ville
- Données `hasStockPhotos` et `hasAuthenticPhotos` injectées dans le prompt
- 250 mots max, jamais "Cordialement", jamais de durées inventées
- **Règle : `reviews.length` ne doit jamais apparaître dans le prompt template** — uniquement dans les calculs JS (`reviewsAvgRating`, `negativeRatio`, `unanswered`). Dans le prompt, utiliser `leadData.reviewCount` pour le total Google.
- **Règle P3 : ne jamais écrire "votre fiche" seul** — remplacer par "votre présence en ligne" ou "sur Google, Instagram et votre site" pour refléter l'analyse complète réalisée.

### routes/leads.js — /generate-email
- Destructuring ajout : `photoQuality = null`, `decisionMaker` / `city` / `category` via `req.body`
- `leadData` transmis à `generateEmailPhotographe` enrichi : `decisionMaker`, `city`, `category`
- `photoQuality` transmis à `generateEmailPhotographe`

### photoQualityService.js — Prompt refonte
- Prompt remplacé avec 5 critères : Authenticité (priorité), Qualité technique, Composition, Éclairage, Pertinence commerciale
- Nouveaux verdicts : `Professionnelles / Correctes / Amateur / Stock & Marques / Mixte / Insuffisantes`
- JSON retourné étendu : `{ verdict, score, hasStockPhotos, hasAuthenticPhotos, observations, photosAnalyzed }`
- Barème score documenté (90-100 pro authentique → 0-29 stock/très mauvaise)

### visualAnalysisService.js — Prompt photographe enrichi
- Critère 6 ajouté au prompt photographe : AUTHENTICITÉ DES VISUELS
  - Photos réelles vs stock/marques fournisseurs
  - Présence de photos espace/équipe/prestations réelles
  - Règles observations : rouge si stock, rouge si aucun espace réel, orange si amateur, vert si bon équilibre

## Session 2026-03-23 — Modifications

### pagespeedService.js — Fixes HTTPS / mobileFriendly / CrUX
- `buildQS` : ajout catégorie `best-practices` → audit `is-on-https` toujours présent
- `https` : retourne `null` (non `false`) si audit absent — `(isHttpsAudit != null && score != null) ? score === 1 : null`
- `mobileFriendly` : même correction null-safe
- Cache vidé au démarrage : `psCache.clear()` en haut de module
- CrUX API intégrée : `getCruxData(originUrl)` en parallèle avec sitemap+robots
  - Cache module-level Map, TTL 48h
  - Clé API conditionnelle (`?key=...` seulement si définie)
  - Logs distincts : 404 = trafic insuffisant, autres = erreur réseau
  - `result.crux = cruxData` dans l'objet retourné

### socialEnrichment.js — Pinterest et YouTube
- `extractSocialLinks` : ajout regex Pinterest (`pinterest.[a-z]{2,3}`) et YouTube (`youtube.com/(channel|c|@|user)/`)
- Résultat `enrichSocial` initialisé avec `pinterest: null, youtube: null`
- `Object.assign` propage automatiquement les deux nouveaux champs

### services/visualAnalysisService.js — Nouveau service (Puppeteer + Claude Vision)
- `captureScreenshot(url, zone)` : zones header/corps/full, cache 30 min
  - Anti-bot : `--disable-dev-shm-usage`, `userAgent` Chrome 120
  - 2 tentatives : `domcontentloaded` puis `load` (timeout 20s chacune)
  - Retourne `null` proprement après 2 échecs
- `analyzeVisual(screenshot, profile)` : Claude Vision `claude-sonnet-4-6`
  - Prompts dédiés : designer / photographe / copywriter
  - Prompt PHOTOGRAPHE : 5 critères psychologiques, verdicts fixes, max 120 chars/observation
  - Parse JSON défensif avec extraction regex, tri observations red→orange→green
- Dépendance : `puppeteer` installé

### routes/visualAnalysis.js — Nouveau endpoint
- `POST /api/leads/visual-analysis` : body `{ url, zone, profile }`
- Validation profile (designer/photographe/copywriter) et zone (header/corps/full)
- Coûts : header=1, corps=2, full=3 crédits (mock 847)
- Si `screenshot === null` → 422 `"Ce site ne permet pas la capture automatique"`
- Monté dans `server.js` sur `/api/leads`

### routes/leads.js — Prompt email PHOTOGRAPHE spécialisé
- Destructuring `req.body` : ajout `visualAnalysis`, `reviewsData`, `googleData`
- `const prompt` → `let prompt`
- Override si `profileId === 'photographe' && visualAnalysis` :
  - Prompt 4 blocs (Accroche/Constat/Transition/CTA), max 180 mots
  - Exploite score visuel, verdict, observations, photoCount, instagram, highlights
  - Footer daté, zéro mention SEO/technique
  - Fallback vers prompt standard si `visualAnalysis` absent

### LeadDetail.jsx — Session 2026-03-23
- **Contact & Présence** : `paddingTop: 4, marginBottom: 16` (section visible au premier scroll)
- **Mobile friendly** : card masquée si `psMobileFriendly === null` (audit absent)
- **Tooltip "Chargement"** : `const [showTooltip, setShowTooltip]` + helper `kpi` étendu (5e param `tooltip`) — remplace le texte `⚠️ Mesure variable` par icône ⓘ avec tooltip au survol
- **CrUX** : bloc "PERFORMANCES RÉELLES" sous grille SEO (profils seo/consultant-seo)
  - `console.log('[CrUX] données reçues frontend:', d?.pagespeed?.crux)` pour debug
  - Ordre rows : LCP/FCP, CLS/INP, TTFB/FID
  - Card null → card verte SVG info "audit Google en temps réel"
- **Analyse Visuelle IA** : section conditionnelle designer/photographe/copywriter
  - States : `visualAnalysis`, `visualLoading`, `visualError`, `selectedZone`
  - Sélecteur 3 zones cliquables + bouton + message contextuel
  - Résultat : grille 3 cols Score/Époque/Verdict + observations bullet coloré
  - Erreur "bloque les captures" → card orange ; autres erreurs → card rouge
- **Card RÉSEAUX VISUELS** profil photographe : full-width (`gridColumn: 1 / -1`), 5 réseaux (Instagram/Facebook/TikTok/Pinterest/YouTube) avec point vert/rouge

## Session 2026-03-22 — Modifications

### LeadDetail.jsx — Modal description
- Renommé état `descModal` → `showDescriptionModal`
- Ligne description : supprimé badge source, bouton "Voir" = texte violet souligné cliquable
- Nouvelle modal centrée : background `#1e1b4b`, border `1px solid #6366f1`, borderRadius 12px
  - Header : "📝 Description" + bouton ✕
  - Corps scrollable : `overflowY: auto`, `maxHeight: 60vh`, `scrollbarColor: #4338ca #1e1b4b`
  - Footer : badge source discret gris
  - Fermeture : clic ✕ ou overlay
- Fix JSX : return() enveloppé dans `<>…</>` (fragment) pour permettre la modal comme sibling du panneau principal

### LeadDetail.jsx — Audit digital PageSpeed (on-demand)
- Supprimé l'auto-fetch PageSpeed au chargement du lead
- Ajouté `const auditCache = {}` module-level (cache session par website URL)
- `useEffect` : charge depuis `auditCache` si dispo (état `done`), sinon `idle`
- Ajouté `handleAnalyzePerformance()` : fetch à la demande, stocke dans `auditCache`
- JSX : nouveau bouton "🚀 Analyser les performances" (outline violet, full width) quand `auditState === 'idle'`
- Économise les appels API PageSpeed pour les leads non consultés en détail

### LeadDetail.jsx — Affichage description (3 états)
- `['Google', 'meta SEO', 'réseaux sociaux', 'schema.org']` → ✅ Disponible (vert)
- `'contenu page'` → ⚠️ Contenu page (orange) + tip "pas de meta description"
- Aucune description → ❌ Absente (rouge) + tip "Argument SEO fort"

### googlePlaces.js — scrapeDescription() réécriture complète
Nouvelle priorité de sources :
1. `editorial_summary` Google → source `'Google'` (avant tout appel HTTP)
2. `meta[name="description"]` → source `'meta SEO'`
3. `meta[property="og:description"]` → source `'réseaux sociaux'`
4. `meta[name="twitter:description"]` → source `'réseaux sociaux'`
5. `<script type="application/ld+json">` champ `description` → source `'schema.org'`
6a. `<p>` dans zones sémantiques (`[class*=kw]`, `[id*=kw]` : hero/about/intro/presentation/qui-sommes/a-propos/description/tagline) → source `'contenu page'`
6b. Premier `<p>` hors `header/footer/nav`, ≥ 100 chars → source `'contenu page'`
- Aucune limite de caractères sur le texte retourné
- Si rien trouvé → `{ hasDescription: false, descriptionText: null, descriptionSource: null }`
- `PARAGRAPH_BLACKLIST` : cookie|rgpd|privacy|gdpr|©|newsletter|inscription
- Timeout 5s
- Log précis de la source à chaque cas

---

## Session 2026-04-01 — Profil SEO

### scoring.js — seoOpportunityScore()
- Nouvelle fonction dédiée activée si `profileId === 'seo' || 'consultant-seo'`
- Remplace l'opportunité générique pour ces deux profils
- Score de base 50 — bonifiée par les mauvais indicateurs PageSpeed (plus c'est mauvais, plus l'opportunité est forte)
- Aucun site détecté → retourne 10 (pénalité : budget probablement limité)
- Audit non encore lancé (pagespeedData null) → retourne 30 (score neutre)
- Détail des bonus : SEO<50→+25 | SEO<70→+15 | perf<50→+20 | perf<70→+10 | LCP>4s→+15 | pas title→+10 | pas mobileFriendly→+10 | pas HTTPS→+15 | renderBlocking>2→+5 | pas sitemap→+5
- `calculateScore()` : ajout 8e paramètre `pagespeedData = null`

### pagespeedService.js — Nouvelles fonctions
- `detectCMS(websiteUrl)` : fetch HTML avec timeout 8000ms, regex patterns pour WordPress/Wix/Shopify/Squarespace/Webflow/Jimdo
  - Retourne `{ cms, confidence: 'high'|'medium'|'low', editable: true|false|null }`
  - Fallback `{ cms: 'inconnu', confidence: 'low', editable: null }` sur erreur ou non identifié
- `getDomainAge(website)` : âge du domaine via rdap.org (sans clé API)
  - Retourne `{ createdAt, ageYears, ageMonths, ageLabel }` ou null
  - Utilise `fetch` natif + `AbortSignal.timeout(5000)`
- `getIndexedPages(website)` : nombre de pages indexées par Google
  - Primaire : Google Custom Search API (`GOOGLE_CSE_KEY` + `GOOGLE_CSE_CX` dans .env)
  - Fallback : scraping `google.com/search?q=site:${domain}` + regex `/Environ ([\d\s]+) résultats/`
  - Retourne `{ indexedPages, label, signal: 'good'|'weak'|'poor' }` — good >20, weak 5-20, poor <5
- `GOOGLE_CSE_CX=f17cea054ecb34c16` à ajouter dans .env + activer "Rechercher sur tout le web" dans la console CSE
- Toutes ces fonctions intégrées dans le `Promise.all` final de `getPageSpeed()`
- `result` étendu : `crux`, `cms`, `domainAge`, `indexedPages`
- Blacklist sites sociaux dans `cleanWebsiteUrl` : facebook/instagram/twitter/x/linkedin/tiktok/youtube/google

### googlePlaces.js — getLocalRank()
- `getLocalRank(placeId, category, city)` : Text Search API `${category} ${city}`, cherche le placeId dans les 20 premiers résultats
- Retourne `{ rank, outOf: 20, found, topThree, topTen }` ou null si erreur
- Exporté dans `module.exports`

### aiReviewAnalysis.js — Prompts SEO + email
- `seoPrompt` : prompt partagé par les profils `'seo'` et `'consultant-seo'`
  - 5 sections : MOTS-CLÉS OPPORTUNITÉS / CONTENU MANQUANT / SCORE RÉPUTATION LOCALE / QUICK WIN / SIGNAL D'ALERTE
  - Prose uniquement, jamais de bullet points, 250 mots max
  - Variables : `reviewCount ?? total`, `category ?? 'ce secteur'`, `city ?? 'cette ville'`
- `generateEmailSEO({ leadData, pagespeedData, localRank, reviewsData })` : email dédié consultant SEO
  - P1 verrouillé JS : 4 branches (loadTime>8s / perf<50 / !rankFound / générique)
  - P4 verrouillé JS : 3 problèmes prioritaires issus d'un pool ordonné (vitesse / rank / perf / HTTPS / sitemap / avis sans réponse)
  - Phrase verrouillée P3 : "Cette visibilité existe — elle reste juste inexploitée."
  - Signature : "Consultant SEO local — {city}"
  - Règles absolues : 200 mots max, jamais "j'ai analysé vos avis", jamais de liste, jamais de placeholders
  - Règle INTERDIT : "INTERDIT d'écrire un autre chiffre que ${reviewCount} pour le total d'avis Google"
- **Fix reviews.length** : dans `generateEmailPhotographe`, toute occurrence de `${reviews.length}` dans le template string remplacée par `${leadData.reviewCount}` — `reviews.length` autorisé uniquement dans les calculs JS

### routes/leads.js
- `GET /audit` :
  - Early return si `!website || website.trim() === ''` → `{ pagespeed: null, localRank: null, message: 'Pas de site web détecté pour ce lead' }`
  - Appels réseaux sociaux (FB/IG) conditionnels : uniquement si `SOCIAL_PROFILES = ['photographe', 'social-media']`
  - `getLocalRank` conditionnel : uniquement si `SEO_PROFILES = ['seo', 'consultant-seo']` + placeId + category + city
  - `profileId`, `category`, `city` ajoutés aux query params attendus
  - Blacklist sociale appliquée sur `website` avant `getPageSpeed()`
- `POST /analyze/:placeId` : `category` ajouté au body, transmis dans `meta`
- `POST /generate-email` : bloc SEO avant photographe — délègue à `generateEmailSEO()` si `profileId === 'seo' || 'consultant-seo'`
- `calculateScore()` appelé avec 8 args : `pagespeedData` transmis depuis `buildLead`

### LeadDetail.jsx — Cards KPI SEO
- `handleAnalyzePerformance` : `profileId`, `category` (`lead.keyword || lead.domain`), `city` (dernière partie de `lead.address`) ajoutés aux query params de `/audit`
- POST `/analyze/:placeId` body : `category` ajouté
- **KPIs grille SEO** (profils seo/consultant-seo, uniquement après audit terminé) :
  - `POSITION LOCALE` : valeur Top 3 / Top 10 / Position N / Hors top 20 — couleurs good/warn/danger
  - `CMS DÉTECTÉ` : nom CMS + badge "Optimisable" (vert) ou "Limité" (orange) — "Non identifié" si absent
  - `ÂGE DU DOMAINE` : vert ≥5 ans "Domaine établi" / orange ≥2 ans "Domaine récent" / rouge <2 ans "Très récent" / null → "Non disponible" italique gris
  - `PAGES INDEXÉES` : vert >20 "Bon volume de contenu" / orange 5-20 "Contenu insuffisant" / rouge <5 "Site quasi invisible" / null → "Non disponible" italique gris
- **Message sans site** : si `auditState === 'idle' && !lead.website` → card grise "Pas de site web — audit SEO impossible" (pas de bouton)
- **Bloc CrUX fallback** : remplacé card verte générique par card orange ⚠️ avec 3 niveaux :
  - Titre "Données utilisateurs réelles non disponibles"
  - Sous-titre gris "Ce site ne génère pas encore assez de trafic Chrome..."
  - Note "Les indicateurs ci-dessus sont issus d'un audit Lighthouse (simulation)..."
- **Seuils alerte chargement** : 3 niveaux — <3s : aucune alerte / ≥3s <8s : orange / ≥8s : rouge

### aiReviewAnalysis.js — seoPrompt enrichi avec données techniques
- `seoPrompt` reçoit maintenant les données PageSpeed et localRank depuis `auditData`
- Bloc `DONNÉES TECHNIQUES` injecté en tête du prompt si `auditData` disponible : performance/100, score SEO/100, loadTime, LCP, HTTPS, sitemap, mobile-friendly, CMS, pages indexées, position Maps
- 5 sections mises à jour pour croiser avis + données techniques :
  - MOTS-CLÉS : note si `psSeo < 70` (balises probablement sous-optimisées)
  - CONTENU MANQUANT : mentionne le nombre de pages indexées si disponible
  - SCORE RÉPUTATION : intègre `rankLine` (position Maps) dans le calcul
  - QUICK WIN : verrouillé JS, priorité HTTPS > sitemap > viewport > perf<50 > avis sans réponse > rank
  - SIGNAL D'ALERTE : pré-calcul JS des alertes techniques (HTTPS absent, perf<30, hors top 20, index poor) + alertes avis
- Si `auditData` null → dégradation gracieuse vers analyse avis seuls (comportement identique à avant)
- Limite portée à 300 mots (était 250)

### generateEmailSEO — P1 reformulé
- Branche `loadTime > 8s` : ne mentionne plus `"votre site charge en Xs"` — utilise le score PageSpeed à la place
- Formulation : `"En passant votre site dans Google PageSpeed Insights, j'ai obtenu un score de performance mobile de ${performance}/100 — Google considère ce niveau comme insuffisant et le pénalise dans le classement local."`
- Si `loadTime > 8` mais `performance` indisponible : formulation sans chiffre inventé
- `reviewCount` : corrigé dans `POST /generate-email` → `leadData.reviewCount ?? totalReviews` (source: Google Places réel, pas l'échantillon analysé)
- Frontend : `reviewCount: lead.google?.totalReviews` ajouté explicitement dans le `leadData` envoyé

### pagespeedService.js — checkNAP()
- `checkNAP(businessName, address, phone, city)` : vérifie la cohérence NAP (Name/Address/Phone) sur PagesJaunes
- Utilise `puppeteer` (plain, pas puppeteer-extra pour éviter double-registration de StealthPlugin)
- Même config que `visualAnalysisService.js` : executablePath win32, args no-sandbox, userAgent Chrome 120, timeout 20s
- URL : `pagesjaunes.fr/annuaire/chercherlespros?quoiqui={businessName}&ou={city}`
- Sélecteurs : `.bi-denomination a`, `[class*="adress"]`, `[class*="phone"]` avec fallbacks
- Comparaison :
  - Nom : exact → contains → mot significatif >3 chars en commun
  - Adresse : numéro de rue doit matcher si présent + mot >4 chars en commun
  - Téléphone : digits-only après strip `+33/0033`, fallback 8 derniers chiffres
- Retourne `{ found, napScore: 'consistent'|'inconsistent'|'not_found', pjName, pjAddress, pjPhone, issues[] }` ou `null` si erreur
- Exporté dans `module.exports`

### routes/leads.js — checkNAP intégré dans GET /audit
- `checkNAP` importé depuis `pagespeedService`
- Query params ajoutés : `businessName`, `address`, `phone`
- `needsNAP` : uniquement `SEO_PROFILES` + `businessName` + `city`
- 5e slot dans `Promise.all` : `needsNAP ? checkNAP(businessName, address, phone, city) : null`
- Réponse : `napData` inclus

### LeadDetail.jsx — Card COHÉRENCE NAP + corrections
- `handleAnalyzePerformance` : 3 nouveaux params — `businessName`, `address`, `phone`
- KPI `COHÉRENCE NAP` poussé si `auditData?.napData !== undefined` (après audit seulement)
- Renderer dédié `kpi.type === 'nap'` :
  - `consistent` → vert "Cohérent" + "Fiche PagesJaunes identique"
  - `inconsistent` → orange "Incohérent" + N différence(s) + `gridColumn: 1 / -1` si issues présentes
  - `not_found` → rouge "Non trouvé" + "Commerce absent de PagesJaunes"
  - Bloc détail : pjName / pjAddress / pjPhone si `found: true`
  - Liste des issues en orange (•) si `napScore === 'inconsistent'`
- Indicateur chatbot masqué pour profils `seo` et `consultant-seo` dans `exportPDF.js`
  - Condition : `!['photographe', 'seo', 'consultant-seo'].includes(profileId)`
- `POST /generate-email` body : `reviewCount: lead.google?.totalReviews` ajouté dans `leadData`

### Bugs corrigés
- Sites sociaux (Facebook, Instagram, etc.) détectés comme site web → blacklist dans `cleanWebsiteUrl`
- `profileId` absent de la query string audit → corrigé, transmis depuis `handleAnalyzePerformance`
- CMS affiché "Inconnu" → remplacé par "Non identifié"
- `reviewCount` dans email SEO utilisait `aiAnalysis.totalReviews` (échantillon) → corrigé vers `leadData.reviewCount` (total Google Places réel)
- Email SEO P1 mentionnait le temps de chargement en secondes → remplacé par score PageSpeed (objectif, non contestable)

### À faire / en attente
- ~~`GOOGLE_CSE_KEY` + `GOOGLE_CSE_CX=f17cea054ecb34c16` à ajouter dans `.env`~~ → `GOOGLE_CSE_CX` mis à jour : nouvelle valeur `e51ba5f540a9149ad` (ancienne : `f17cea054ecb34c16`)
- `indexedPages` non disponible : CSE bloqué (quota/accès), Bing Search API nécessite un compte Microsoft — fonctionnalité en attente d'une solution alternative
- Activer "Rechercher sur tout le web" dans la console Google Custom Search Engine
- Tester `checkNAP` sur des établissements réels — sélecteurs PagesJaunes peuvent évoluer
- ~~Blank page PDF~~ → corrigé : `.cover { height: 1123px }` (remplace `100vh`) + `container.style.paddingBottom = '0'` avant capture html2canvas
- ~~E-E-A-T dans email SEO~~ → remplacé par "crédibilité de votre fiche aux yeux de Google"
- ~~NAP paragraph générique~~ → corrigé, utilise `napData.issues[]` pour citer le champ exact (téléphone / adresse)
- ~~Bug note Google dans email SEO/chatbot~~ → corrigé : `leadData.rating ?? avgRating` dans les deux appels (SEO + chatbot)
- Titres de sections dans le rapport IA affichés en minuscules — investiguer la regex `cleanMarkdown` dans `exportPDF.js` (suppression des `##` peut laisser les titres en bas de casse)
- Tester pipeline complet chatbot + SEO avec de vrais leads
- `hasMenuContent` détecté dans `getSiteSignals` mais pas encore affiché dans les KPIs LeadDetail — à connecter quand utile

---

## Session 2026-04-01 (suite) — Profil Dev Chatbot IA — implémentation complète

### pagespeedService.js — Refonte détection site

**Nouvelles constantes module-level :**
- `SENSITIVE_CATEGORIES[]` + `checkSensitiveCategory(category)` — normalisation NFD, retourne bool
- `BOOKING_DOMAIN_MAP[]` — 5 plateformes (Planity/Doctolib/TheFork/Reservio/Koifaire) avec pattern regex

**Fonctions refactorisées (single-fetch) :**
- `detectCMSFromHTML(html)` — pure, opère sur HTML string déjà récupéré
- `detectSiteSignalsFromHTML(html, siteUrl)` — pure, retourne :
  - `chatbotDetected`, `chatbotTool` (Tidio/Crisp/Intercom/LiveChat/Tawk/HubSpot)
  - `bookingPlatform` (check URL d'abord, puis HTML)
  - `hasFAQ`, `hasContactForm`, `hasPDFContent`
  - `hasMenuContent` — 4 signaux : keyword dans texte nu (9 mots-clés), `<table>`, lien href/texte, `img alt`
  - `hasProminentPhone`, `pageCount`
  - Log debug : `menu:true(keyword+table) faq:false form:true ...`
- `detectCMSAndSiteSignals(websiteUrl)` — 1 seul fetch HTTP (timeout 10 000 ms), appelle les 2 pures
- `getSiteSignals(websiteUrl, category)` — audit léger chatbot :
  - Si URL = booking platform → retour immédiat, `isBookingUrl: true`, pas de fetch HTML
  - Sinon → `detectCMSAndSiteSignals`, retourne `{ ...siteSignals, sensitiveData, ragType, isBookingUrl: false }`
- `module.exports` : ajout `getSiteSignals`

### scoring.js — chatbotOpportunityScore()
- `CHATBOT_FORT[]`, `CHATBOT_MOYEN[]`, `CHATBOT_FAIBLE[]` — constantes module-level
- `chatbotOpportunityScore(placeData, pagespeedData, pappersData, reviewsData)` :
  - Éliminatoire : pas de site → 10
  - Base catégorie : FORT=80, MOYEN=60, FAIBLE=20, inconnu=50
  - CMS wordpress/wix: +10 | chatbotDetected: -40 | isActiveOwner: +10 | newBusinessBadge: -10
  - Pappers : eff≤2 +15 | eff≤10 +8 | eff>10 -5 | CA>100k +10
  - Signaux enrichis (`reviewsData.chatbotSignals`) : hasRecurringQuestions +20 | unansweredCount≥3 +15 | isMultilingual +10 | hasOverwhelmKeywords +20
- `calculateScore` : branche `profileId === 'chatbot' || 'dev-chatbot'` → `chatbotOpportunityScore`

### aiReviewAnalysis.js — Profil chatbot
- `buildFocusDirective` : branche chatbot mentionne chatbot existant si `pagespeed?.siteSignals?.chatbotDetected`
- `chatbotPrompt` : 5 sections prose-only (QUESTIONS RÉCURRENTES / CONTENU RAG / SIGNAL DÉBORDEMENT / QUICK WIN / OPPORTUNITÉ ESTIMÉE)
- `generateEmailChatbot({ leadData, pagespeedData, reviewsData })` :
  - P1 verrouillé JS : si `keywords.length >= 2` → utilise les vrais mots-clés extraits des avis ; sinon branche catégorie (restaurant/avocat/salon/garage/générique)
  - `tone` : formel pour avocat/notaire/comptable, sinon conversationnel
  - Blocs conditionnels : `sensitiveBlock` (données sensibles), `bookingBlock` (plateforme résa), `faqBlock` (FAQ existante)
  - INTERDIT : RAG, NLP, LLM, vecteur, embedding — uniquement "système", "assistant IA", "automatisation"
  - 200 mots max, retourne JSON `{subject, body}`
- `module.exports` : ajout `generateEmailChatbot`

### routes/leads.js — Chatbot routing
- Import `getSiteSignals` depuis `pagespeedService`
- Import `generateEmailChatbot` depuis `aiReviewAnalysis`
- `CHATBOT_PROFILES = ['chatbot', 'dev-chatbot']` dans GET /audit
- GET /audit : `isChatbot ? getSiteSignals(websiteForAudit, category) : getPageSpeed(websiteForAudit)`
- POST /generate-email : délégation `generateEmailChatbot()` avant SEO, passe `rating: leadData.rating ?? avgRating`
- **Fix rating** : `leadData.rating ?? avgRating` pour SEO ET chatbot (remplace `avgRating` seul)

### LeadDetail.jsx — Profil chatbot complet
- `case 'chatbot': case 'dev-chatbot':` — lit `auditData?.pagespeed?.siteSignals`
- `isBookingUrl` flag pour adapter l'affichage
- KPIs construits dynamiquement : `chatbot_detect` toujours présent ; `booking_url` si `bookingPlatform !== null` (orange, "Angle complémentaire — ne pas proposer la réservation") ; `faq_detect`, `form_detect`, `sensitive` si non-null post-audit
- 6 nouveaux renderers KPI : `booking_url` (orange), `chatbot_detect`, `booking_platform`, `faq_detect`, `form_detect`, `sensitive`
- Compact audit button "🤖 Analyser le site — détection chatbot" dans section profils chatbot
- `AUDIT_PROFILES` étendu avec chatbot/dev-chatbot (email nécessite audit terminé)
- Fallback sans audit : `lead.googleAudit?.hasChatbot` + `themes` count

### Bugs corrigés
- **Rating email** : `avgRating` (moyenne échantillon avis) remplacé par `leadData.rating` (note Google Maps réelle) dans les deux délégations SEO et chatbot
- **Blank PDF page** : `.cover { height: 1123px }` remplace `100vh` (100vh variait selon la hauteur fenêtre, créait des pages en trop) ; `container.style.paddingBottom = '0'` supprime le padding bas avant capture
- **Chatbot P1** : si `reviewsData.keywords.length >= 2`, P1 cite les vrais mots-clés extraits des avis au lieu du générique catégorie

---

### À faire plus tard — Feature transversale tous profils

#### Score completeness indicator
Afficher un indicateur visuel expliquant que le score affiché est partiel tant que toutes les analyses n'ont pas été lancées — objectif : inciter l'utilisateur à lancer les analyses manquantes (= consommation de crédits).

**Signaux par profil :**
| Profil | Signal 1 | Signal 2 | Signal 3 |
|---|---|---|---|
| seo | Google (auto) | Audit PageSpeed | Analyse IA |
| consultant-seo | Google (auto) | Audit PageSpeed | Analyse IA |
| dev-web | Google (auto) | Audit PageSpeed | Analyse IA |
| chatbot | Google (auto) | Analyse IA | — |
| copywriter | Google (auto) | Analyse IA | — |
| photographe | Google (auto) | Analyse visuelle | Analyse IA |

**Affichage envisagé :**
- Label dynamique : `"Score partiel"` → `"Score complet"` selon les signaux disponibles
- Checkboxes ou icônes par signal : ✓ disponible / ○ manquant
- Chaque signal manquant = CTA implicite vers le bouton d'analyse correspondant
- Couleur du score (rouge → orange → vert) pourrait refléter la complétude

**Données disponibles côté frontend :**
- Google : toujours présent après search (`lead.score` non null)
- Audit PageSpeed : `auditData?.pagespeed` non null
- Analyse IA : `aiReport` non null
- Analyse visuelle : `visualAnalysis` non null (profil photographe)

---

### ~~À faire plus tard — Profil Dev Chatbot IA~~ → IMPLÉMENTÉ (session 2026-04-01)

#### SCORING `chatbotOpportunityScore()` — pondération 10/10/10/70

**Score de base (sans analyse IA) :**

*Catégorie commerce* (10 pts)
- Fort : restaurant, café, hôtel, salon, clinique, dentiste, kiné, garage, avocat, notaire, expert-comptable, agence immo, salle de sport
- Moyen : pharmacie, fleuriste, bijouterie, optique
- Faible : plombier, électricien, maçon, épicerie, tabac

*Signaux techniques* (10 pts)
- Site absent = éliminatoire (score 0)
- CMS WordPress ou Wix = bonus intégration facile
- `isActiveOwner` = bonus gérant réactif
- `newBusinessBadge` = pénalité légère
- Chatbot existant détecté (Tidio/Crisp/Intercom/LiveChat/widget custom) = pénalité opportunité forte

*Données Pappers* (10 pts)
- Effectif 1-2 pers. = fort bonus (solo = débordé)
- Effectif 3-10 = bonus moyen
- Effectif 10+ = pénalité légère
- CA > 100 k€ = bonus (avocats/notaires notamment)

*Booking platform*
- Planity / Doctolib / TheFork / LaFourchette / Reservio détectée sur le site ou dans `lead.website` = adapter angle email, pas pénaliser

**Score enrichi (après analyse IA) :** (70 pts)
- Questions récurrentes dans les avis : horaires, ouvert/fermé, réservation, prix/tarif, livraison, disponible, rendez-vous, délai, devis, honoraires, procédure
- Avis sans réponse ≥ 3 = fort bonus débordement
- Avis multilingues (EN/DE/AR) = bonus chatbot multilingue
- Mentions Planity/Doctolib/TheFork dans les avis = adapter angle email
- Ratio questions/total avis = signal RAG fort
- Saisonnalité détectée dans les avis = bonus

#### DÉTECTION TECHNIQUE

- `visualAnalysisService` : détecter chatbot existant sur le site (Tidio, Crisp, Intercom, LiveChat, widget custom) → pénalité opportunité forte
- `visualAnalysisService` : détecter booking platform sur le site (Planity, Doctolib, TheFork, LaFourchette, Reservio)
- `googlePlaces` : si `lead.website` contient `planity.com` ou `doctolib.fr` → `bookingPlatform` détectée
- `scrapeDescription` : détecter mention plateformes dans description du site
- Langue des avis Google → signal marché multilingue

#### PROMPT IA `chatbotPrompt` — 5 sections

1. **QUESTIONS RÉCURRENTES** : top 5 questions extraites des avis
2. **CONTENU RAG DISPONIBLE** : menu / horaires / services / tarifs identifiés dans les avis
3. **SIGNAL DÉBORDEMENT** : avis sans réponse + gérant solo estimé
4. **QUICK WIN** : action immédiate la plus impactante
5. **OPPORTUNITÉ ESTIMÉE** : fourchette de questions/semaine automatisables — basée sur les données réelles, jamais inventée

#### EMAIL `generateEmailChatbot` — angle adapté par catégorie

| Contexte | Angle P1 |
|---|---|
| Restaurant | "vos clients demandent vos horaires et votre menu chaque semaine" |
| Avocat / Notaire | "vos prospects demandent vos honoraires avant de vous appeler" |
| Salon | "vos clientes veulent réserver sans téléphoner" |
| Booking platform détectée | "Planity gère vos réservations, le chatbot répond à tout le reste" |
| Pas de booking | angle complet : automatiser réservations ET questions |

**Structure email :**
- P1 : vraies questions extraites des avis
- P2 : avis sans réponse = clients perdus
- P3 : le chatbot connaît le commerce (carte, horaires, services, tarifs via RAG)
- CTA : démo 15 minutes sur votre commerce
- RÈGLE ABSOLUE : jamais de jargon RAG / NLP / LLM / IA dans le corps de l'email

#### CIBLES & ÉLIMINATOIRES

- **Prioritaires** : restaurants, hôtels, salons coiffure, cliniques, cabinets médicaux, dentistes, garages, avocats, notaires, agences immobilières, salles de sport
- **Éliminatoires** : pas de site web · moins de 20 avis · artisan solo

---

### À faire plus tard — Feature Veille Automatique

Système d'alertes configurables qui détecte automatiquement les nouveaux leads correspondant aux critères de l'utilisateur.

**Configuration utilisateur :**
- Profil de scoring cible (chatbot / seo / photographe / etc.)
- Secteurs surveillés (restaurant, coiffeur, dentiste, etc.)
- Ville / zone géographique
- Fréquence de relance (quotidienne / hebdomadaire)
- Seuil score minimum pour déclencher l'alerte

**Fonctionnement backend :**
- Cron job `node-cron` qui relance une recherche Google Places pour chaque config d'alerte active
- Comparaison des `place_id` retournés avec les `place_id` déjà connus en base — seuls les nouveaux jamais vus sont traités
- Calcul automatique du score sur les nouveaux leads détectés
- Stockage du résultat + timestamp de détection

**Notifications :**
- Email transactionnel via Resend ou Brevo : résumé des nouveaux leads de la période
- Notification in-app (badge compteur dans la navbar ou panneau dédié)
- Badge "Nouveau" sur la LeadCard pour les leads issus de la veille

**Prérequis bloquants :**
- Nécessite une base de données persistante pour stocker les `place_id` connus et les configs d'alerte — **impossible avec le stockage mémoire actuel**
- **À implémenter après la migration Supabase**

