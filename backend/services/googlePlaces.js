const axios   = require('axios');
const cheerio = require('cheerio');
const { createCache } = require('../cache/searchCache');

const BASE_URL = 'https://maps.googleapis.com/maps/api/place/';
const API_KEY  = process.env.GOOGLE_MAPS_API_KEY;

// ─── Caches TTL ───────────────────────────────────────────────────────────────
const TTL_7D             = 7 * 24 * 60 * 60 * 1000      // 7 jours en ms
const searchResultsCache = createCache('search');        // 7 jours
const placeDetailsCache  = createCache('placeDetails');  // 7 jours
const localRankCache     = createCache('localRank');     // 7 jours

// ─── Mapping domaine → types Google Places ───────────────────────────────────
const DOMAIN_TYPES = {
  restaurant: ['restaurant', 'cafe', 'bar'],
  commerce:   ['store', 'supermarket', 'shopping_mall'],
  sante:      ['doctor', 'dentist', 'pharmacy', 'hospital'],
  immobilier: ['real_estate_agency', 'moving_company'],
  beaute:     ['beauty_salon', 'hair_care', 'spa'],
  tech:       ['electronics_store'],
  juridique:  ['lawyer'],
  finance:    ['accounting', 'bank', 'insurance_agency'],
  education:  ['school', 'university', 'library'],
  sport:      ['gym', 'stadium'],
};

// ─── Domaines génériques/sociaux — jamais considérés comme site web du business ─
const WEBSITE_BLACKLIST = [
  'facebook.com', 'fb.com',
  'instagram.com', 'twitter.com', 'x.com',
  'linkedin.com', 'tiktok.com', 'youtube.com',
  'google.com', 'maps.google.com',
]

// ─── Nettoie une URL Google Places (supprime paramètres UTM, trailing slash) ─
function cleanWebsiteUrl(raw) {
  if (!raw || raw === 'null' || raw === 'undefined') return null
  try {
    // Google Places sometimes returns URLs without protocol — add https:// if needed
    const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`
    const origin = new URL(withProtocol).origin  // ex: "https://asia-market.fr"
    const hostname = new URL(withProtocol).hostname.replace(/^www\./, '')
    if (WEBSITE_BLACKLIST.some(domain => hostname === domain || hostname.endsWith(`.${domain}`))) {
      console.log(`[Places] cleanWebsiteUrl → domaine blacklisté ignoré: ${hostname}`)
      return null
    }
    return origin
  } catch {
    return raw  // si URL vraiment invalide, on garde brute
  }
}

// ─── Timeout helper ──────────────────────────────────────────────────────────
function withTimeout(promise, ms = 5000) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('timeout')), ms)
    ),
  ]);
}

// ─── Pagination : jusqu'à 3 pages pour un type donné ────────────────────────
async function fetchAllPages({ lat, lng, radius, keyword, type, onProgress }) {
  const baseParams = {
    location: `${lat},${lng}`,
    radius:   radius * 1000,
    key:      API_KEY,
  };
  if (keyword) baseParams.keyword = keyword;
  if (type)    baseParams.type    = type;

  const all = [];
  let pageToken = null;
  let pageNum   = 0;

  do {
    pageNum++;
    if (onProgress) onProgress({ type: 'page', message: `Page ${pageNum}/3 (${type || keyword || 'all'})` });

    try {
      const params = { ...baseParams };
      if (pageToken) params.pagetoken = pageToken;

      console.log(`[API COST] Appel réel à Google API: Places NearbySearch maps.googleapis.com — type=${type || 'all'} keyword=${keyword || '—'} page=${pageNum}`)
      const { data } = await withTimeout(
        axios.get(`${BASE_URL}nearbysearch/json`, { params }),
        5000
      );

      console.log(`[Places] type=${type} keyword=${keyword || '—'} page=${pageNum} status=${data.status} results=${data.results?.length ?? 0}`);

      if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
        console.warn(`[Places] status inattendu: ${data.status}`, data.error_message || '');
        break;
      }

      all.push(...(data.results || []));
      pageToken = data.next_page_token || null;

      if (pageToken && pageNum < 3) {
        await new Promise(r => setTimeout(r, 2000)); // délai obligatoire Google
      }
    } catch (err) {
      console.error(`fetchAllPages page ${pageNum} (${type}):`, err.message);
      break;
    }
  } while (pageToken && pageNum < 3);

  return all;
}

// ─── Détails + avis d'un lieu ────────────────────────────────────────────────
async function getPlaceDetails(placeId) {
  const cached = placeDetailsCache.get(`place_details_${placeId}`)
  if (cached) return cached

  const fields = [
    'formatted_phone_number', 'website', 'opening_hours',
    'price_level', 'rating', 'user_ratings_total', 'reviews',
    'photos', 'editorial_summary',
  ].join(',');

  console.log(`[API COST] Appel réel à Google API: Place Details maps.googleapis.com — placeId=${placeId}`)
  try {
    const { data } = await withTimeout(
      axios.get(`${BASE_URL}details/json`, {
        params: { place_id: placeId, fields, key: API_KEY, language: 'fr' },
      }),
      5000
    );
    const r = data.result || {};

    // ── Log editorial_summary ─────────────────────────────────────────────────
    console.log('[Places] editorial_summary raw:', r.editorial_summary)
    console.log('[Places] editorial_summary overview:', r.editorial_summary?.overview)

    // ── Log diagnostic : montre les champs réels d'un avis brut ──────────────
    if (r.reviews && r.reviews.length > 0) {
      console.log('[Places] Premier avis raw:', JSON.stringify(r.reviews[0], null, 2));
    }

    const result = {
      ...r,
      reviews: (r.reviews || []).slice(0, 5).map(rev => ({
        author:       rev.author_name,
        rating:       rev.rating,
        text:         rev.text,
        time:         new Date(rev.time * 1000).toISOString().slice(0, 10),
        // Places API legacy → owner_answer { text, time }
        // Places API new    → authorAttribution (pas de réponse propriétaire)
        // On garde les deux pour couvrir tous les cas
        author_reply: rev.author_reply?.text
                      || rev.owner_answer?.text
                      || (typeof rev.author_reply === 'string' ? rev.author_reply : null)
                      || null,
      })),
    };
    placeDetailsCache.set(`place_details_${placeId}`, result, TTL_7D)
    return result;
  } catch (err) {
    console.error(`getPlaceDetails ${placeId}:`, err.message);
    return {};
  }
}

// ─── Blacklist paragraphes non-pertinents ────────────────────────────────────
const PARAGRAPH_BLACKLIST = /cookie|rgpd|privacy|gdpr|©|newsletter|inscription/i

// ─── Scraping description multi-sources ──────────────────────────────────────
// Priorité : 1. meta description  2. og:description  3. twitter:description
//            4. schema.org JSON-LD  5. paragraphe dans zone sémantique
async function scrapeDescription(websiteUrl, editorialSummary) {
  // Source 0 : editorial_summary Google — vérifié avant tout appel HTTP
  const editorial = editorialSummary?.overview
                 || (typeof editorialSummary === 'string' ? editorialSummary : null)
                 || null
  if (editorial) {
    console.log(`[Places] scrapeDescription → Google editorial_summary`)
    return { hasDescription: true, descriptionText: editorial, descriptionSource: 'Google' }
  }

  if (!websiteUrl) {
    return { hasDescription: false, descriptionText: null, descriptionSource: null }
  }

  try {
    const { data } = await withTimeout(
      axios.get(websiteUrl, {
        timeout: 5000,
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; LeadGenBot/1.0; +https://leadgenpro.app)' },
        maxRedirects: 3,
        maxContentLength: 500_000,
      }),
      5000
    )
    const $ = cheerio.load(data)

    // ── Source 1 : meta[name="description"] ─────────────────────────────────
    const metaDesc = ($('meta[name="description"]').attr('content') || '').trim() || null
    if (metaDesc) {
      console.log(`[Places] scrapeDescription ${websiteUrl} → meta description: ${metaDesc.slice(0, 60)}…`)
      return { hasDescription: true, descriptionText: metaDesc, descriptionSource: 'meta SEO' }
    }

    // ── Source 2 : og:description ────────────────────────────────────────────
    const ogDesc = ($('meta[property="og:description"]').attr('content') || '').trim() || null
    if (ogDesc) {
      console.log(`[Places] scrapeDescription ${websiteUrl} → og:description: ${ogDesc.slice(0, 60)}…`)
      return { hasDescription: true, descriptionText: ogDesc, descriptionSource: 'réseaux sociaux' }
    }

    // ── Source 3 : twitter:description ──────────────────────────────────────
    const twitterDesc = ($('meta[name="twitter:description"]').attr('content') || '').trim() || null
    if (twitterDesc) {
      console.log(`[Places] scrapeDescription ${websiteUrl} → twitter:description: ${twitterDesc.slice(0, 60)}…`)
      return { hasDescription: true, descriptionText: twitterDesc, descriptionSource: 'réseaux sociaux' }
    }

    // ── Source 4 : schema.org JSON-LD ────────────────────────────────────────
    let schemaDesc = null
    $('script[type="application/ld+json"]').each((_, el) => {
      if (schemaDesc) return false
      try {
        const json = JSON.parse($(el).html() || '{}')
        // Peut être un objet ou un tableau
        const entries = Array.isArray(json) ? json : [json]
        for (const entry of entries) {
          if (entry.description && typeof entry.description === 'string') {
            schemaDesc = entry.description.trim()
            break
          }
        }
      } catch { /* JSON invalide — ignorer */ }
    })
    if (schemaDesc) {
      console.log(`[Places] scrapeDescription ${websiteUrl} → schema.org: ${schemaDesc.slice(0, 60)}…`)
      return { hasDescription: true, descriptionText: schemaDesc, descriptionSource: 'schema.org' }
    }

    // ── Source 5a : section/div avec class ou id contenant des mots-clés ──────
    const ZONE_KEYWORDS = ['hero', 'about', 'intro', 'presentation', 'qui-sommes', 'a-propos', 'description', 'tagline']
    const ZONE_SELECTOR = ZONE_KEYWORDS.flatMap(kw => [
      `[class*="${kw}"] p`,
      `[id*="${kw}"] p`,
    ]).concat(['main p', 'article p']).join(', ')

    let zoneText = null
    $(ZONE_SELECTOR).each((_, el) => {
      if (zoneText) return false
      const text = $(el).text().trim().replace(/\s+/g, ' ')
      if (text.length >= 100 && !PARAGRAPH_BLACKLIST.test(text)) {
        zoneText = text
      }
    })
    if (zoneText) {
      console.log(`[Places] scrapeDescription ${websiteUrl} → contenu page (zone): ${zoneText.slice(0, 60)}…`)
      return { hasDescription: true, descriptionText: zoneText, descriptionSource: 'contenu page' }
    }

    // ── Source 5b : premier <p> visible hors header/footer/nav ───────────────
    let fallbackText = null
    $('p').each((_, el) => {
      if (fallbackText) return false
      // Exclure les éléments dans header, footer, nav
      if ($(el).closest('header, footer, nav').length > 0) return
      const text = $(el).text().trim().replace(/\s+/g, ' ')
      if (text.length >= 100 && !PARAGRAPH_BLACKLIST.test(text)) {
        fallbackText = text
      }
    })
    if (fallbackText) {
      console.log(`[Places] scrapeDescription ${websiteUrl} → contenu page (fallback p): ${fallbackText.slice(0, 60)}…`)
      return { hasDescription: true, descriptionText: fallbackText, descriptionSource: 'contenu page' }
    }

    // Aucune source fiable trouvée
    console.log(`[Places] scrapeDescription ${websiteUrl} → aucune description`)
    return { hasDescription: false, descriptionText: null, descriptionSource: null }

  } catch (e) {
    console.warn(`[Places] scrapeDescription error (${websiteUrl}):`, e.message)
    return { hasDescription: false, descriptionText: null, descriptionSource: null }
  }
}

// ─── Enrichissement par batch de 10 ─────────────────────────────────────────
async function enrichBatch(places, onProgress) {
  const BATCH = 10;
  const enriched = [];

  for (let i = 0; i < places.length; i += BATCH) {
    if (onProgress) {
      onProgress({ type: 'enrich', current: i, total: places.length,
        message: `Enrichissement ${i + 1}–${Math.min(i + BATCH, places.length)} / ${places.length}` });
    }

    const batch = places.slice(i, i + BATCH);
    const results = await Promise.all(
      batch.map(async place => {
        const details    = await getPlaceDetails(place.place_id);
        const websiteUrl = cleanWebsiteUrl(details.website);
        const descResult = await scrapeDescription(websiteUrl, details.editorial_summary);
        const photoCount = details.photos?.length ?? 0
        console.log('[Photos]', JSON.stringify(photoCount), '—', place.name)

        const totalRatings    = details.user_ratings_total ?? place.user_ratings_total ?? 0
        const repliedCount    = (details.reviews ?? []).filter(r => r.author_reply).length
        // 3/5 visible reviews = 60% effective threshold; condition impossible if < 3 reviews visible
        const isActiveOwner   = totalRatings >= 5 && repliedCount >= 3
        // Ratio sur les 5 avis retournés par l'API (pas le taux de réponse global)
        const ownerReplyRatio = totalRatings > 0 ? repliedCount / Math.min(totalRatings, 5) : 0

        return {
          place_id:            place.place_id,
          name:                place.name,
          vicinity:            place.vicinity,
          lat:                 place.geometry?.location?.lat,
          lng:                 place.geometry?.location?.lng,
          rating:              details.rating              ?? place.rating              ?? null,
          user_ratings_total:  details.user_ratings_total ?? place.user_ratings_total ?? null,
          price_level:         details.price_level         ?? place.price_level         ?? null,
          phone:               details.formatted_phone_number ?? null,
          website:             websiteUrl,
          opening_hours:       details.opening_hours          ?? null,
          reviews:             details.reviews                ?? [],
          photoCount,
          hasDescription:      descResult.hasDescription,
          descriptionText:     descResult.descriptionText,
          descriptionSource:   descResult.descriptionSource,
          hasHours:            !!(details.opening_hours),
          isActiveOwner,
          ownerReplyRatio,
        };
      })
    );
    enriched.push(...results);
  }

  return enriched;
}

// ─── Fonction principale ─────────────────────────────────────────────────────
async function searchPlaces({ lat, lng, radius, keywords = [], domain, onProgress }) {
  console.log(`[Places] searchPlaces → lat=${lat} lng=${lng} radius=${radius}km domain=${domain || 'tous'} keywords=[${keywords.join(',')}]`);

  // Cache
  const cacheKey = `${lat}-${lng}-${radius}-${domain || 'all'}-${keywords.join(',')}`;
  const cached   = searchResultsCache.get(cacheKey);
  if (cached) {
    if (onProgress) onProgress({ type: 'cache', message: 'Résultats depuis le cache ⚡' });
    return { places: cached, fromCache: true };
  }

  // N'utilise QUE les mots-clés utilisateur — jamais le label de domaine (mot français)
  // Le type Google Places (doctor, beauty_salon…) gère déjà le filtre catégorie
  const keyword = keywords.filter(Boolean).join(' ') || undefined;

  // Types à requêter
  const types = domain && DOMAIN_TYPES[domain]
    ? DOMAIN_TYPES[domain]
    : ['establishment'];

  if (onProgress) onProgress({ type: 'progress', message: `Recherche sur ${types.length} type(s)...` });

  // Requêtes multiples en parallèle
  const rawArrays = await Promise.all(
    types.map(type => fetchAllPages({ lat, lng, radius, keyword, type, onProgress }))
  );

  // Déduplication par place_id
  const seen   = new Set();
  const unique = rawArrays.flat().filter(p => {
    if (seen.has(p.place_id)) return false;
    seen.add(p.place_id);
    return true;
  });

  console.log(`[Places] ${unique.length} lieux uniques après déduplication (brut: ${rawArrays.flat().length})`);
  if (onProgress) onProgress({ type: 'progress', message: `${unique.length} lieux uniques trouvés — enrichissement...` });

  // Enrichissement par batch
  const places = await enrichBatch(unique, onProgress);

  // Mise en cache 7 jours
  searchResultsCache.set(cacheKey, places, TTL_7D);

  return { places, fromCache: false };
}

function getPhotoUrls(photos, maxPhotos = 5) {
  if (!photos || photos.length === 0) return []
  return photos.slice(0, maxPhotos).map(photo => {
    const ref = photo.photo_reference
    return `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photo_reference=${ref}&key=${process.env.GOOGLE_MAPS_API_KEY}`
  })
}

// ─── Rang local : position d'un lieu dans une recherche catégorie + ville ─────
async function getLocalRank(placeId, category, city) {
  const notFound = { rank: null, outOf: 20, found: false, topThree: false, topTen: false }
  if (!placeId || !category || !city) return notFound

  const rankKey = `localrank_${placeId}_${category}_${city}`
  const cached  = localRankCache.get(rankKey)
  if (cached) return cached

  console.log(`[API COST] Appel réel à Google API: Places TextSearch maps.googleapis.com — "${category} ${city}"`)
  try {
    const { data } = await withTimeout(
      axios.get(`${BASE_URL}textsearch/json`, {
        params: { query: `${category} ${city}`, key: API_KEY, language: 'fr' },
      }),
      5000
    )

    if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
      console.warn(`[LocalRank] status inattendu: ${data.status}`)
      return notFound
    }

    const results = data.results || []
    const outOf   = results.length
    const idx     = results.findIndex(r => r.place_id === placeId)

    if (idx === -1) return { rank: null, outOf, found: false, topThree: false, topTen: false }

    const rank = idx + 1
    console.log(`[LocalRank] "${category} ${city}" → ${placeId} → position ${rank}/${outOf}`)
    const rankResult = { rank, outOf, found: true, topThree: rank <= 3, topTen: rank <= 10 }
    localRankCache.set(rankKey, rankResult, TTL_7D)
    return rankResult
  } catch (e) {
    console.warn(`[LocalRank] erreur ${placeId} (${category} ${city}):`, e.message)
    return { found: false }
  }
}

module.exports = { searchPlaces, getPlaceDetails, getPhotoUrls, getLocalRank };
