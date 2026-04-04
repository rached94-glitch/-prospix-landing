const axios = require('axios')

const APIFY_TOKEN = process.env.APIFY_API_TOKEN
const APIFY_BASE  = 'https://api.apify.com/v2/acts'

// Actor : radeance/semrush-scraper
const ACTOR_ID = 'radeance~semrush-scraper'

// Timeout généreux — SEMrush scraper peut prendre 30-60s selon la taille du domaine
const TIMEOUT_MS = 90_000

/**
 * Scrape SEMrush data for a given domain via Apify.
 * Returns null on any error (API unreachable, no data, quota exceeded).
 *
 * @param {string} domain — ex: "monrestaurant.fr" or "https://monrestaurant.fr"
 * @returns {object|null}
 */
async function scrapeSemrushData(domain) {
  if (!APIFY_TOKEN) {
    console.warn('[SEMrush] APIFY_API_TOKEN manquant — skip')
    return null
  }

  if (!domain) return null

  // Strip protocol + trailing slash for SEMrush input
  const cleanDomain = domain
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/.*$/, '')
    .toLowerCase()
    .trim()

  if (!cleanDomain) return null

  console.log(`[SEMrush] Scraping domaine: ${cleanDomain}`)

  try {
    const url = `${APIFY_BASE}/${ACTOR_ID}/run-sync-get-dataset-items?token=${APIFY_TOKEN}&timeout=80`

    const { data } = await axios.post(url, { domain: cleanDomain }, {
      timeout: TIMEOUT_MS,
      headers: { 'Content-Type': 'application/json' },
    })

    const items = Array.isArray(data) ? data : []
    if (items.length === 0) {
      console.warn(`[SEMrush] Aucun résultat pour "${cleanDomain}"`)
      return null
    }

    const raw = items[0]
    console.log(`[SEMrush] Résultat brut pour "${cleanDomain}":`, JSON.stringify(raw))

    // Normalise les champs — les noms de clés varient selon la version de l'acteur
    const result = {
      domain:           cleanDomain,
      authorityScore:   raw.authorityScore    ?? raw.authority_score    ?? raw.domainAuthority ?? null,
      monthlyTraffic:   raw.monthlyTraffic    ?? raw.monthly_traffic    ?? raw.organicTraffic  ?? raw.traffic ?? null,
      organicKeywords:  raw.organicKeywords   ?? raw.organic_keywords   ?? raw.keywords        ?? null,
      backlinks:        raw.backlinks         ?? raw.totalBacklinks      ?? raw.total_backlinks ?? null,
      referringDomains: raw.referringDomains  ?? raw.referring_domains  ?? raw.refDomains      ?? null,
      bounceRate:       raw.bounceRate        ?? raw.bounce_rate        ?? null,
      paidKeywords:     raw.paidKeywords      ?? raw.paid_keywords      ?? raw.adKeywords      ?? null,
    }

    console.log(`[SEMrush] ✓ ${cleanDomain} — authority:${result.authorityScore} traffic:${result.monthlyTraffic} keywords:${result.organicKeywords}`)
    return result

  } catch (e) {
    if (e.response) {
      console.error(`[SEMrush] Erreur HTTP ${e.response.status} pour "${cleanDomain}":`, e.response.data)
    } else {
      console.error(`[SEMrush] Erreur pour "${cleanDomain}":`, e.message)
    }
    return null
  }
}

module.exports = { scrapeSemrushData }
