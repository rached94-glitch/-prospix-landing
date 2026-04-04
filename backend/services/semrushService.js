const axios = require('axios')

const APIFY_TOKEN = process.env.APIFY_API_TOKEN
const APIFY_BASE  = 'https://api.apify.com/v2/acts'

// Actor : radeance/semrush-scraper
const ACTOR_ID = 'radeance~semrush-scraper'

// Timeout : 180s pour couvrir domain_authority (rapide) + traffic + backlinks (8-60s chacun)
const TIMEOUT_MS    = 190_000
const APIFY_TIMEOUT = 180  // secondes (param Apify)

/**
 * Scrape SEMrush data for a given domain via Apify.
 * L'acteur retourne UN item par type de données :
 *   { type: "domain_authority", authority_score, moz_domain_authority }
 *   { type: "traffic", monthly_visits, organic_traffic, bounce_rate, ... }
 *   { type: "backlinks", total_backlinks, referring_domains, ... }
 *
 * On merge tous les items en un seul objet normalisé.
 * Retourne null sur toute erreur (quota, réseau, pas de données).
 *
 * @param {string} domain — ex: "monrestaurant.fr" ou "https://monrestaurant.fr"
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

  // Input correct selon la doc de l'acteur (confirmé par les logs Apify)
  const input = {
    urls:               [cleanDomain],
    country:            'fr',    // code ISO 2 lettres minuscules
    include_authority:  true,    // authority score (~2s)
    include_traffic:    true,    // trafic mensuel + bounce rate (~8-60s)
    include_backlinks:  true,    // backlinks + domaines référents (~8-60s)
    include_overview:   false,
    include_top_websites: false,
  }

  try {
    const url = `${APIFY_BASE}/${ACTOR_ID}/run-sync-get-dataset-items?token=${APIFY_TOKEN}&timeout=${APIFY_TIMEOUT}`

    console.log(`[SEMrush] Input:`, JSON.stringify(input))
    const { data } = await axios.post(url, input, {
      timeout: TIMEOUT_MS,
      headers: { 'Content-Type': 'application/json' },
    })

    const items = Array.isArray(data) ? data : []
    console.log(`[SEMrush] Résultat brut (${items.length} item(s)):`, JSON.stringify(items))

    if (items.length === 0) {
      console.warn(`[SEMrush] Aucun résultat pour "${cleanDomain}"`)
      return null
    }

    // ── Merge de tous les items par type ─────────────────────────────────────
    // Chaque item a un champ "type" : "domain_authority", "traffic", "backlinks"
    const byType = {}
    for (const item of items) {
      const t = item.type ?? 'unknown'
      byType[t] = { ...byType[t], ...item }
    }
    const auth     = byType['domain_authority'] ?? {}
    const traffic  = byType['traffic']          ?? {}
    const backlink = byType['backlinks']        ?? {}

    // Fallback : si pas de type, essaie sur tous les items mergés
    const merged   = items.reduce((acc, item) => ({ ...acc, ...item }), {})

    const result = {
      domain: cleanDomain,

      // Authority score (domain_authority item)
      authorityScore: auth.authority_score    ?? auth.authorityScore
                   ?? merged.authority_score  ?? merged.authorityScore
                   ?? merged.domainAuthority  ?? null,

      // Trafic mensuel (traffic item)
      monthlyTraffic: traffic.monthly_visits   ?? traffic.monthlyVisits
                   ?? traffic.organic_traffic  ?? traffic.organicTraffic
                   ?? traffic.visits           ?? traffic.traffic
                   ?? merged.monthlyTraffic    ?? merged.monthly_traffic
                   ?? merged.organicTraffic    ?? null,

      // Mots-clés organiques (traffic item)
      organicKeywords: traffic.organic_keywords    ?? traffic.organicKeywords
                    ?? traffic.keywords            ?? traffic.organicKeywordsCount
                    ?? merged.organicKeywords      ?? merged.organic_keywords
                    ?? merged.keywords             ?? null,

      // Backlinks (backlinks item)
      backlinks: backlink.total_backlinks    ?? backlink.totalBacklinks
              ?? backlink.backlinks          ?? backlink.backlinksCount
              ?? merged.totalBacklinks       ?? merged.total_backlinks
              ?? merged.backlinks            ?? null,

      // Domaines référents (backlinks item)
      referringDomains: backlink.referring_domains   ?? backlink.referringDomains
                     ?? backlink.refDomains          ?? backlink.referringDomainsCount
                     ?? merged.referringDomains      ?? merged.referring_domains
                     ?? merged.refDomains            ?? null,

      // Bounce rate (traffic item)
      bounceRate: traffic.bounce_rate      ?? traffic.bounceRate
               ?? traffic.bounceRateDesktop
               ?? merged.bounceRate        ?? merged.bounce_rate ?? null,

      // Mots-clés payants (traffic item)
      paidKeywords: traffic.paid_keywords    ?? traffic.paidKeywords
                 ?? traffic.adKeywords       ?? traffic.paidKeywordsCount
                 ?? merged.paidKeywords      ?? merged.paid_keywords
                 ?? merged.adKeywords        ?? null,
    }

    console.log(`[SEMrush] ✓ ${cleanDomain} — authority:${result.authorityScore} traffic:${result.monthlyTraffic} keywords:${result.organicKeywords} backlinks:${result.backlinks} refDomains:${result.referringDomains}`)
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
