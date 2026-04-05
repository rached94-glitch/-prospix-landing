const axios    = require('axios')
const logger   = require('../utils/logger')
const psCache  = require('../cache/pagespeedCache')
const puppeteer = require('puppeteer')
const { createCache } = require('../cache/searchCache')

const TTL_7D   = 7 * 24 * 60 * 60 * 1000
const napCache        = createCache('nap')           // 7 jours
const indexedCache    = createCache('indexedPages')  // 7 jours

// ── Sensitive categories → local RAG deployment recommended ───────────────────
const SENSITIVE_CATEGORIES = [
  'avocat', 'notaire', 'expert-comptable', 'comptable', 'medecin', 'médecin',
  'dentiste', 'kine', 'kiné', 'osteopathe', 'ostéopathe', 'psychologue',
  'psychiatre', 'pharmacie', 'clinique', 'cabinet medical', 'cabinet médical',
]

function checkSensitiveCategory(category) {
  if (!category) return false
  const c = String(category).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/-/g, ' ')
  return SENSITIVE_CATEGORIES.some(s => {
    const ns = s.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    return c.includes(ns) || ns.includes(c)
  })
}

// ── Cache CrUX 7 jours (données mensuelles) ───────────────────────────────────
const CRUX_TTL   = 7 * 24 * 60 * 60 * 1000
const cruxCache  = createCache('crux')

async function getCruxData(originUrl) {
  const key    = originUrl
  const cached = cruxCache.get(key)
  if (cached !== null) {
    // HIT already logged by createCache — cached can be the result object or the sentinel {_null:true}
    return cached._null ? null : cached
  }

  logger.info('CrUX', `[API COST] chromeuxreport.googleapis.com — ${originUrl}`)
  try {
    const cruxKey = process.env.PAGESPEED_API_KEY ? `?key=${process.env.PAGESPEED_API_KEY}` : ''
    const response = await axios.post(
      `https://chromeuxreport.googleapis.com/v1/records:queryRecord${cruxKey}`,
      {
        origin: originUrl,
        formFactor: 'PHONE',
        metrics: [
          'largest_contentful_paint',
          'first_input_delay',
          'cumulative_layout_shift',
          'first_contentful_paint',
          'interaction_to_next_paint',
          'experimental_time_to_first_byte',
        ],
      },
      { timeout: 10000 }
    )

    const metrics = response.data?.record?.metrics
    if (!metrics) {
      logger.warn('CrUX', `Pas de métriques pour ${originUrl}`)
      cruxCache.set(key, { _null: true }, CRUX_TTL)
      return null
    }

    const getP75 = (m) => metrics[m]?.percentiles?.p75 ?? null

    const result = {
      lcp_real:  getP75('largest_contentful_paint'),
      fid_real:  getP75('first_input_delay'),
      cls_real:  getP75('cumulative_layout_shift'),
      fcp_real:  getP75('first_contentful_paint'),
      inp_real:  getP75('interaction_to_next_paint'),
      ttfb_real: getP75('experimental_time_to_first_byte'),
      dataSource: 'crux',
    }
    cruxCache.set(key, result, CRUX_TTL)
    logger.info('CrUX', `Données réelles — lcp:${result.lcp_real}ms fcp:${result.fcp_real}ms ttfb:${result.ttfb_real}ms — ${originUrl}`)
    return result
  } catch (e) {
    const status = e.response?.status
    const detail = e.response?.data?.error?.message ?? e.message
    if (status === 404) {
      logger.warn('CrUX', `Domaine absent du dataset Chrome pour ${originUrl} (404 — trafic insuffisant)`)
    } else {
      logger.warn('CrUX', `Erreur ${status ?? 'réseau'} pour ${originUrl}: ${detail}`)
    }
    cruxCache.set(key, { _null: true }, CRUX_TTL)
    return null
  }
}

const ISSUE_MAP = {
  'uses-optimized-images':     'Images non optimisées',
  'meta-description':          'Pas de meta description',
  'render-blocking-resources': 'Ressources bloquant le rendu',
  'uses-text-compression':     'Compression texte absente',
  'viewport':                  'Viewport manquant',
  'document-title':            'Balise title absente',
  'link-text':                 'Textes de liens non descriptifs',
  'uses-responsive-images':    'Images non responsives',
}

// ── HEAD check with 3s timeout ────────────────────────────────────────────────
async function checkUrl(url) {
  try {
    const r = await axios.head(url, { timeout: 3000, validateStatus: () => true })
    return r.status === 200
  } catch {
    return false
  }
}

// ── CMS detection (pure — operates on HTML string) ────────────────────────────
function detectCMSFromHTML(html) {
  if (!html || typeof html !== 'string') return { cms: 'inconnu', confidence: 'low', editable: null }
  if (/\/wp-content\/|\/wp-includes\//.test(html) ||
      /<meta[^>]+generator[^>]+WordPress/i.test(html) ||
      /wp-emoji|wp-settings/.test(html))
    return { cms: 'wordpress',   confidence: 'high', editable: true  }
  if (/wix\.com/.test(html) ||
      /<meta[^>]+generator[^>]+Wix/i.test(html) ||
      /data-site-id/.test(html))
    return { cms: 'wix',         confidence: 'high', editable: false }
  if (/cdn\.shopify\.com/.test(html) ||
      /<meta[^>]+generator[^>]+Shopify/i.test(html))
    return { cms: 'shopify',     confidence: 'high', editable: true  }
  if (/squarespace\.com/.test(html) ||
      /<meta[^>]+generator[^>]+Squarespace/i.test(html))
    return { cms: 'squarespace', confidence: 'high', editable: false }
  if (/webflow\.com/.test(html))
    return { cms: 'webflow',     confidence: 'high', editable: true  }
  if (/jimdo\.com/.test(html))
    return { cms: 'jimdo',       confidence: 'high', editable: false }
  return { cms: 'inconnu', confidence: 'medium', editable: null }
}

// ── Known booking platform domains ────────────────────────────────────────────
// label = for logging only. bookingPlatform stored value is always 'Détectée' (no brand names).
const BOOKING_DOMAIN_MAP = [
  { pattern: /planity\.com/i,                   label: 'Planity'           },
  { pattern: /doctolib\.fr/i,                   label: 'Doctolib'          },
  { pattern: /thefork\.com|lafourchette\.com/i, label: 'TheFork'           },
  { pattern: /reservio\.com/i,                  label: 'Reservio'          },
  { pattern: /koifaire\.com/i,                  label: 'Koifaire'          },
  { pattern: /kalendes\.com/i,                  label: 'Kalendes'          },
  { pattern: /treatwell\.(fr|com)/i,            label: 'Treatwell'         },
  { pattern: /simplybook\.me/i,                 label: 'SimplyBook'        },
  { pattern: /fresha\.com/i,                    label: 'Fresha'            },
  { pattern: /booksy\.com/i,                    label: 'Booksy'            },
  { pattern: /setmore\.com/i,                   label: 'Setmore'           },
  { pattern: /calendly\.com/i,                  label: 'Calendly'          },
  { pattern: /square\.site|squareup\.com/i,     label: 'Square'            },
  { pattern: /yclients\.com/i,                  label: 'YClients'          },
  { pattern: /salonkee\.com/i,                  label: 'Salonkee'          },
  { pattern: /kiute\.com/i,                     label: 'Kiute'             },
  { pattern: /balinea\.com/i,                   label: 'Balinea'           },
  { pattern: /beauty-coiffure\.com/i,           label: 'BeautyCoiffure'    },
  { pattern: /rdv360\.com/i,                    label: 'RDV360'            },
  { pattern: /medoucine\.com/i,                 label: 'Medoucine'         },
  { pattern: /crenolibre\.fr/i,                 label: 'CrenoLibre'        },
  { pattern: /timify\.com/i,                    label: 'Timify'            },
  { pattern: /agendize\.com/i,                  label: 'Agendize'          },
  { pattern: /google\.com\/maps\/reserve/i,     label: 'Google Reserve'    },
  { pattern: /hubspot\.com\/meetings/i,         label: 'HubSpot Meetings'  },
  { pattern: /acuityscheduling\.com/i,          label: 'Acuity Scheduling' },
]

// ── Regex for booking button/link text scan (Couche 2) ─────────────────────────
const BOOKING_KEYWORDS_RE = /r[eé]server|prendre\s+(?:un\s+)?r(?:endez-vous|dv)|book\s+(?:now|online)|r[eé]servation\s+en\s+ligne|prendre\s+un\s+cr[eé]neau|rendez-vous\s+en\s+ligne|rdv\s+en\s+ligne/i

// ── Site signals detection (pure — operates on HTML string) ───────────────────
function detectSiteSignalsFromHTML(html, siteUrl) {
  const empty = {
    chatbotDetected: false, chatbotTool: null, bookingPlatform: null,
    hasFAQ: false, hasContactForm: false, hasNewsletter: false, hasPDFContent: false, hasMenuContent: false,
    hasProminentPhone: false, pageCount: 'unknown', hasBlog: false,
  }
  if (!html || typeof html !== 'string') return empty

  // Chatbot widgets
  let chatbotDetected = false, chatbotTool = null
  if      (/tidio/i.test(html))                   { chatbotDetected = true; chatbotTool = 'Tidio'    }
  else if (/crisp\.chat/i.test(html))             { chatbotDetected = true; chatbotTool = 'Crisp'    }
  else if (/intercom/i.test(html))                { chatbotDetected = true; chatbotTool = 'Intercom' }
  else if (/livechat/i.test(html))                { chatbotDetected = true; chatbotTool = 'LiveChat' }
  else if (/tawk\.to/i.test(html))                { chatbotDetected = true; chatbotTool = 'Tawk'     }
  else if (/hubspot.*chat|hs-chat/i.test(html))   { chatbotDetected = true; chatbotTool = 'HubSpot'  }

  // Booking detection — Couche 1 : domaines connus dans URL ou HTML
  let bookingPlatform = null
  const urlLow = (siteUrl || '').toLowerCase()
  for (const { pattern } of BOOKING_DOMAIN_MAP) {
    if (pattern.test(urlLow) || pattern.test(html)) {
      bookingPlatform = 'Détectée'
      break
    }
  }
  // Couche 2 : boutons/liens "réserver" si aucun domaine trouvé
  if (!bookingPlatform) {
    const anchorText = (html.match(/<a\b[^>]*>[\s\S]*?<\/a>/gi) ?? []).join(' ')
    const buttonText = (html.match(/<button\b[^>]*>[\s\S]*?<\/button>/gi) ?? []).join(' ')
    const hrefValues = (html.match(/href=["'][^"']*["']/gi) ?? []).join(' ')
    const ariaValues = (html.match(/aria-label=["'][^"']*["']/gi) ?? []).join(' ')
    if (
      BOOKING_KEYWORDS_RE.test(anchorText) ||
      BOOKING_KEYWORDS_RE.test(buttonText) ||
      BOOKING_KEYWORDS_RE.test(hrefValues) ||
      BOOKING_KEYWORDS_RE.test(ariaValues)
    ) {
      bookingPlatform = 'Détectée'
    }
  }

  // FAQ section
  const hasFAQ = /<section[^>]*id=["']faq/i.test(html) ||
    /class=["'][^"']*accordion/i.test(html) ||
    /questions?\s+fr[eé]quentes?/i.test(html) ||
    /foire aux questions/i.test(html)

  // Contact form with email input
  const hasContactForm = /<form/i.test(html) &&
    (/<input[^>]+type=["']email/i.test(html) || /name=["']email["']/i.test(html))

  // Newsletter detection — text patterns + tool signatures
  const htmlLow = html.toLowerCase()
  const nlTextPatterns = ['newsletter', 'inscription', "s'abonner", 'abonnez-vous', 'votre email', 'votre e-mail', 'restez informé', 'nos actualités']
  const nlToolSigs     = ['mailchimp', 'sendinblue', 'brevo', 'mailjet', 'hubspot', 'convertkit', 'klaviyo', 'sarbacane', 'emailoctopus', 'getresponse', 'list-manage', 'mc.us', 'mlsend']
  const hasNewsletter  = nlTextPatterns.some(p => htmlLow.includes(p)) || nlToolSigs.some(p => htmlLow.includes(p))

  // PDF links (menu, tarifs, brochures)
  const hasPDFContent = /href=["'][^"']*\.pdf/i.test(html)

  // ── Menu / tarif content detection ────────────────────────────────────────────
  const MENU_KEYWORDS = /\b(menu|carte|tarif|prix|formule|plat|entr[eé]e|dessert|boisson)\b/i
  // 1. Keywords in visible text (strip tags first to avoid matching attr values)
  const textOnly = html.replace(/<[^>]+>/g, ' ')
  const menuByKeyword = MENU_KEYWORDS.test(textOnly)
  // 2. <table> element present (common for price lists and menus)
  const menuByTable = /<table[\s>]/i.test(html)
  // 3. Links (<a>) with menu/carte/tarif in href or anchor text
  const menuByLink = /<a[^>]+href=["'][^"']*(?:menu|carte|tarif)[^"']*["'][^>]*>/i.test(html) ||
    /<a[^>]*>(?:[^<]*(?:menu|carte|tarif)[^<]*)<\/a>/i.test(html)
  // 4. Image alt containing "menu" or "carte"
  const menuByAlt = /<img[^>]+alt=["'][^"']*(?:menu|carte)[^"']*["']/i.test(html)

  const hasMenuContent = menuByKeyword || menuByTable || menuByLink || menuByAlt
  const menuSignals = []
  if (menuByKeyword) menuSignals.push('keyword')
  if (menuByTable)   menuSignals.push('table')
  if (menuByLink)    menuSignals.push('link')
  if (menuByAlt)     menuSignals.push('img-alt')

  // Prominent phone (clickable tel: link)
  const hasProminentPhone = /href=["']tel:[0-9+\s\-]{8,}["']/i.test(html)

  // Page count estimate via internal links
  const intLinks = (html.match(/<a[^>]+href=["'](?!\s*(?:https?:|#|mailto:|tel:))[^"']+["']/gi) || []).length
  const pageCount = intLinks > 20 ? 'multipage' : intLinks > 5 ? 'small' : 'onepage'

  // Blog detection — href patterns + class patterns
  const BLOG_PATH_RE = /href=["'][^"']*\/(blog|actualites|articles|news|magazine|journal|actu|publications)(\/|["'])/i
  const BLOG_CLASS_RE = /class=["'][^"']*(blog-?list|article-?list|post-?list|news-?list)[^"']*/i
  const hasBlog = BLOG_PATH_RE.test(html) || BLOG_CLASS_RE.test(html)

  console.log(`[SiteSignals] menu:${hasMenuContent}(${menuSignals.join('+') || 'none'}) faq:${hasFAQ} form:${hasContactForm} newsletter:${hasNewsletter} pdf:${hasPDFContent} phone:${hasProminentPhone} chatbot:${chatbotTool ?? 'none'} booking:${bookingPlatform ?? 'none'} pages:${pageCount} blog:${hasBlog}`)

  return { chatbotDetected, chatbotTool, bookingPlatform, hasFAQ, hasContactForm, hasNewsletter, hasPDFContent, hasMenuContent, hasProminentPhone, pageCount, hasBlog }
}

// ── Combined site analysis — single HTTP fetch for CMS + signals ──────────────
async function detectCMSAndSiteSignals(websiteUrl) {
  const unknownCms = { cms: 'inconnu', confidence: 'low', editable: null }
  const emptySig   = {
    chatbotDetected: false, chatbotTool: null, bookingPlatform: null,
    hasFAQ: false, hasContactForm: false, hasNewsletter: false, hasPDFContent: false, hasMenuContent: false,
    hasProminentPhone: false, pageCount: 'unknown', hasBlog: false,
  }
  if (!websiteUrl) return { cms: unknownCms, siteSignals: emptySig }
  try {
    const { data: html } = await axios.get(websiteUrl, {
      timeout: 10000,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; LeadGenBot/1.0)' },
      maxRedirects: 3,
    })
    if (typeof html !== 'string') return { cms: unknownCms, siteSignals: emptySig }
    const cms         = detectCMSFromHTML(html)
    const siteSignals = detectSiteSignalsFromHTML(html, websiteUrl)
    console.log(`[SiteAnalysis] ${websiteUrl} → cms:${cms.cms} chatbot:${siteSignals.chatbotTool ?? 'none'} booking:${siteSignals.bookingPlatform ?? 'none'} faq:${siteSignals.hasFAQ}`)
    return { cms, siteSignals }
  } catch (e) {
    console.warn(`[SiteAnalysis] Erreur pour ${websiteUrl}:`, e.message)
    return { cms: unknownCms, siteSignals: emptySig }
  }
}

// ── Lightweight site audit for chatbot profiles (no PageSpeed API call) ────────
async function getSiteSignals(websiteUrl, category) {
  const sensitiveData = checkSensitiveCategory(category)
  const base = { sensitiveData, ragType: sensitiveData ? 'local' : 'cloud' }
  if (!websiteUrl) return { ...base, chatbotDetected: false, chatbotTool: null, bookingPlatform: null, isBookingUrl: false, hasFAQ: false, hasContactForm: false, hasNewsletter: false, hasPDFContent: false, hasMenuContent: false, hasProminentPhone: false, pageCount: 'unknown', hasBlog: false }

  // If the website URL is itself a booking platform — skip HTML fetch entirely
  const bookingMatch = BOOKING_DOMAIN_MAP.find(b => b.pattern.test(websiteUrl))
  if (bookingMatch) {
    console.log(`[SiteSignals] Booking platform URL detected (${bookingMatch.label}) — HTML fetch skipped`)
    return {
      ...base,
      chatbotDetected: false, chatbotTool: null,
      bookingPlatform: 'Détectée', isBookingUrl: true,
      hasFAQ: false, hasContactForm: false, hasNewsletter: false, hasPDFContent: false, hasMenuContent: false,
      hasProminentPhone: false, pageCount: 'unknown', hasBlog: false,
    }
  }

  const { cms, siteSignals } = await detectCMSAndSiteSignals(websiteUrl)
  return { ...siteSignals, ...base, isBookingUrl: false, cms }
}

// ── Indexed pages count via Custom Search API + scraping fallback ─────────────
function buildIndexResult(indexedPages) {
  const signal = indexedPages > 20 ? 'good' : indexedPages >= 5 ? 'weak' : 'poor'
  const label  = `${indexedPages} page${indexedPages !== 1 ? 's' : ''} indexée${indexedPages !== 1 ? 's' : ''}`
  return { indexedPages, label, signal }
}

async function getIndexedPages(website) {
  if (!website) return null
  let domain
  try { domain = new URL(website).hostname.replace(/^www\./, '') } catch { return null }

  // ── Cache check 7 jours ───────────────────────────────────────────────────
  const cacheKey = `indexed_${domain}`
  const cached   = indexedCache.get(cacheKey)
  if (cached) {
    logger.cache('IndexedPages', domain, true)
    return cached
  }

  // Primary: Google Custom Search API (requires GOOGLE_CSE_KEY + GOOGLE_CSE_CX in .env)
  const cseKey = process.env.GOOGLE_CSE_KEY
  const cseCx  = process.env.GOOGLE_CSE_CX
  logger.info('IndexedPages', `domaine: ${domain} | CSE_KEY: ${cseKey ? 'présente' : 'absente'} | CSE_CX: ${cseCx ?? 'absent'}`)
  if (cseKey && cseCx) {
    logger.info('IndexedPages', 'méthode: CSE')
    logger.info('IndexedPages', `[API COST] Custom Search googleapis.com — site:${domain}`)
    try {
      const params = new URLSearchParams([
        ['key', cseKey], ['cx', cseCx], ['q', `site:${domain}`], ['num', '1'],
      ])
      const resp = await fetch(
        `https://www.googleapis.com/customsearch/v1?${params}`,
        { signal: AbortSignal.timeout(5000) }
      )
      logger.info('IndexedPages', `CSE HTTP status: ${resp.status}`)
      if (resp.ok) {
        const data  = await resp.json()
        logger.info('IndexedPages', `CSE réponse brute: ${JSON.stringify(data.searchInformation ?? data.error ?? data)}`)
        const total = parseInt(data.searchInformation?.totalResults ?? '', 10)
        if (!isNaN(total)) {
          logger.info('IndexedPages', `CSE → ${total} pages pour ${domain}`)
          const indexResult = buildIndexResult(total)
          indexedCache.set(cacheKey, indexResult, TTL_7D)
          return indexResult
        }
        logger.warn('IndexedPages', 'CSE totalResults introuvable ou NaN')
      } else {
        const errBody = await resp.text().catch(() => '(body illisible)')
        logger.warn('IndexedPages', `CSE réponse non-ok (${resp.status}): ${errBody.slice(0, 300)}`)
      }
    } catch (e) {
      logger.warn('IndexedPages', `CSE erreur pour ${domain}: ${e.message}`)
    }
  } else {
    logger.info('IndexedPages', 'CSE ignoré (clés manquantes) — passage au fallback scraping')
  }

  // Fallback: scrape Google search result page
  logger.info('IndexedPages', 'méthode: scraping Google')
  try {
    const resp = await fetch(
      `https://www.google.com/search?q=site%3A${domain}`,
      {
        signal:  AbortSignal.timeout(5000),
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; LeadGenBot/1.0)' },
      }
    )
    logger.info('IndexedPages', `Scraping HTTP status: ${resp.status}`)
    if (!resp.ok) {
      logger.warn('IndexedPages', `Scraping réponse non-ok (${resp.status}) pour ${domain}`)
      return null
    }
    const html  = await resp.text()
    logger.info('IndexedPages', `Scraping HTML reçu: ${html.length} chars | extrait: ${html.slice(0, 200).replace(/\s+/g, ' ')}`)
    const match = html.match(/Environ ([\d\s]+) résultats/)
    logger.info('IndexedPages', `Scraping regex match: ${match ? match[0] : 'aucun match'}`)
    if (match) {
      const total = parseInt(match[1].replace(/\s/g, ''), 10)
      if (!isNaN(total)) {
        logger.info('IndexedPages', `Scraping → ${total} pages pour ${domain}`)
        const indexResult = buildIndexResult(total)
        indexedCache.set(cacheKey, indexResult, TTL_7D)
        return indexResult
      }
    }
    logger.warn('IndexedPages', `Scraping — regex non matchée ou NaN pour ${domain}`)
  } catch (e) {
    logger.warn('IndexedPages', `Scraping erreur pour ${domain}: ${e.message}`)
  }

  logger.warn('IndexedPages', `aucune méthode n'a retourné de résultat pour ${domain}`)
  return null
}

// ── Domain age via RDAP (no API key required) ─────────────────────────────────
async function getDomainAge(website) {
  try {
    if (!website) return null
    const domain = new URL(website).hostname
      .replace('www.', '')

    const response = await fetch(
      `https://rdap.org/domain/${domain}`,
      { signal: AbortSignal.timeout(5000) }
    )
    if (!response.ok) return null

    const data = await response.json()
    const registrationEvent = data.events?.find(
      e => e.eventAction === 'registration'
    )
    if (!registrationEvent) return null

    const createdAt = new Date(registrationEvent.eventDate)
    const now = new Date()
    const ageMonths = Math.floor(
      (now - createdAt) / (1000 * 60 * 60 * 24 * 30.44)
    )
    const ageYears = Math.floor(ageMonths / 12)

    return {
      createdAt: createdAt.toISOString().split('T')[0],
      ageYears,
      ageMonths,
      ageLabel: ageYears >= 1
        ? `${ageYears} an${ageYears > 1 ? 's' : ''}`
        : `${ageMonths} mois`
    }
  } catch { return null }
}

async function getPageSpeed(websiteUrl, category = null) {
  logger.info('PageSpeed', `Clé API: ${process.env.PAGESPEED_API_KEY ? process.env.PAGESPEED_API_KEY.slice(0, 10) + '…' : '(absente)'} | URL: ${websiteUrl ?? 'null'}`)
  if (!websiteUrl || websiteUrl === 'null' || websiteUrl === 'undefined') return null

  // Secondary clean — safeguard against UTM params
  let cleanUrl = websiteUrl
  try {
    const withProto = /^https?:\/\//i.test(websiteUrl) ? websiteUrl : `https://${websiteUrl}`
    cleanUrl = new URL(withProto).origin
  } catch { /* keep raw */ }
  logger.info('PageSpeed', `URL nettoyée: ${cleanUrl}`)

  // ── Cache check (24h) ─────────────────────────────────────────────────────
  const hit = psCache.get(cleanUrl)
  if (hit) {
    logger.cache('PageSpeed', cleanUrl, true)
    return hit.result
  }
  logger.cache('PageSpeed', cleanUrl, false)
  logger.info('PageSpeed', `[API COST] PageSpeed Insights googleapis.com — ${cleanUrl}`)

  // ── PSI request builder ───────────────────────────────────────────────────
  const buildQS = (strategy) => {
    const entries = [
      ['url',      cleanUrl],
      ['strategy', strategy],
      ['category', 'performance'],
      ['category', 'seo'],
      ['category', 'accessibility'],
      ['category', 'best-practices'],
    ]
    if (process.env.PAGESPEED_API_KEY) entries.push(['key', process.env.PAGESPEED_API_KEY])
    return new URLSearchParams(entries)
  }

  const callPSI = (strategy) =>
    axios.get(
      `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?${buildQS(strategy).toString()}`,
      { timeout: 30000 }
    )

  // ── Mobile call (with one retry on timeout) ────────────────────────────────
  let mobileData
  try {
    ;({ data: mobileData } = await callPSI('mobile'))
  } catch (e) {
    const isTimeout = e.code === 'ECONNABORTED' || e.message?.includes('timeout')
    if (isTimeout) {
      logger.warn('PageSpeed', `Timeout 1er essai pour ${cleanUrl} — retry…`)
      try {
        ;({ data: mobileData } = await callPSI('mobile'))
      } catch (e2) {
        logger.warn('PageSpeed', `Double timeout pour ${cleanUrl}: ${e2.message}`)
        // Ne pas cacher — objet partiel avec flag timeout
        return { performance: null, seo: null, loadTime: null, timeout: true }
      }
    } else {
      logger.warn('PageSpeed', `Erreur pour ${cleanUrl}: ${e.message}`)
      if (e.response) {
        logger.warn('PageSpeed', `HTTP status: ${e.response.status} | data: ${JSON.stringify(e.response.data)?.slice(0, 200)}`)
      }
      return null
    }
  }

  const cats   = mobileData.lighthouseResult?.categories ?? {}
  const audits = mobileData.lighthouseResult?.audits ?? {}

  logger.info('PageSpeed', `categories: ${JSON.stringify(cats)}`)

  // ── Core metrics ──────────────────────────────────────────────────────────
  const performance = Math.round((cats.performance?.score ?? 0) * 100)
  const seo         = Math.min(100, Math.max(0, Math.round((cats.seo?.score || 0) * 100)))

  // loadTime : use numericValue (ms) → seconds with 1 decimal, no NaN
  const interactiveMs = audits['interactive']?.numericValue
  const loadTime = (interactiveMs != null && !isNaN(interactiveMs))
    ? Math.round(interactiveMs / 100) / 10
    : null

  // ── Extra fields from Lighthouse data already available ───────────────────
  // HTTPS : uniquement réponse Lighthouse — l'URL stockée est souvent http:// même si le site redirige
  const isHttpsAudit = audits['is-on-https']
  const https        = (isHttpsAudit != null && isHttpsAudit.score != null)
    ? isHttpsAudit.score === 1
    : null
  const title = audits['document-title']?.score === 1 ? 'Présente' : 'Absente'
  const lcp   = audits['largest-contentful-paint']?.displayValue ?? null  // e.g. "2.3 s"
  const cls   = audits['cumulative-layout-shift']?.displayValue   ?? null

  const accessibility    = Math.round((cats.accessibility?.score ?? 0) * 100)
  const imagesOptimized  = audits['uses-optimized-images']?.score === 1
  const renderBlocking   = audits['render-blocking-resources']?.details?.items?.length ?? 0
  const viewportAudit    = audits['viewport']
  const mobileFriendly   = (viewportAudit != null && viewportAudit.score != null)
    ? viewportAudit.score === 1
    : null

  const issues = Object.entries(ISSUE_MAP)
    .filter(([key]) => (audits[key]?.score ?? 1) < 0.5)
    .map(([, label]) => label)

  // ── Desktop score (separate cached call) ──────────────────────────────────
  let performanceDesktop = null
  const desktopKey = `${cleanUrl}__desktop`
  const desktopHit = psCache.get(desktopKey)
  if (desktopHit) {
    performanceDesktop = desktopHit.result?.performance ?? null
    logger.cache('PageSpeed', `${cleanUrl}__desktop`, true)
  } else {
    try {
      const { data: desktopData } = await callPSI('desktop')
      performanceDesktop = Math.round(
        (desktopData.lighthouseResult?.categories?.performance?.score ?? 0) * 100
      )
      psCache.set(desktopKey, { performance: performanceDesktop })
      logger.info('PageSpeed', `Desktop → ${performanceDesktop}`)
    } catch (e) {
      logger.warn('PageSpeed', `Desktop call failed: ${e.message}`)
    }
  }

  // ── Sitemap + robots.txt + CrUX (parallel, cached) ───────────────────────
  let sitemap = null
  let robots  = null
  const sitemapKey = `${cleanUrl}__sitemap`
  const sitemapHit = psCache.get(sitemapKey)

  const sitemapPromise = sitemapHit
    ? Promise.resolve(sitemapHit.result)
    : Promise.all([
        checkUrl(`${cleanUrl}/sitemap.xml`),
        checkUrl(`${cleanUrl}/robots.txt`),
      ]).then(([s, r]) => {
        psCache.set(sitemapKey, { sitemap: s, robots: r })
        return { sitemap: s, robots: r }
      })

  const [sitemapResult, cruxData, { cms: cmsData, siteSignals }, domainAge, indexedPages] = await Promise.all([sitemapPromise, getCruxData(cleanUrl), detectCMSAndSiteSignals(cleanUrl), getDomainAge(cleanUrl), getIndexedPages(cleanUrl)])
  ;({ sitemap, robots } = sitemapResult)

  if (sitemapHit) {
    logger.cache('PageSpeed', `${cleanUrl}__sitemap`, true)
  } else {
    logger.info('PageSpeed', `Sitemap check → sitemap:${sitemap} robots:${robots}`)
  }

  const sensitiveData = checkSensitiveCategory(category)
  const result = { performance, seo, loadTime, https, title, lcp, cls, accessibility, imagesOptimized, renderBlocking, mobileFriendly, performanceDesktop, sitemap, robots, issues, crux: cruxData, cms: cmsData, siteSignals, sensitiveData, domainAge, indexedPages }
  logger.info('PageSpeed', `${cleanUrl} → perf:${performance} seo:${seo} loadTime:${loadTime}s https:${https} sitemap:${sitemap} cms:${cmsData?.cms ?? 'n/a'} chatbot:${siteSignals?.chatbotTool ?? 'none'} booking:${siteSignals?.bookingPlatform ?? 'none'} sensitive:${sensitiveData}`)

  // Ne cacher que les résultats valides (jamais null ni timeout)
  psCache.set(cleanUrl, result)
  return result
}

// ── NAP consistency check via PagesJaunes ─────────────────────────────────────
const EXEC_PATH = process.platform === 'win32'
  ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
  : undefined

const PUPPETEER_ARGS = ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
const USER_AGENT     = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

// Normalize a string for fuzzy comparison: lowercase, strip accents + punctuation
function normalizeText(s) {
  return (s || '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

// Normalize a phone number to digits only (strip spaces, nbsp, dashes, dots, parens)
function normalizePhone(s) {
  return (s || '').replace(/[\s\u00a0\-\.\(\)]/g, '').replace(/^(\+33|0033)/, '0')
}

// True if the two name strings are likely the same business
function nameMatches(a, b) {
  const na = normalizeText(a)
  const nb = normalizeText(b)
  if (na === nb) return true
  if (na.includes(nb) || nb.includes(na)) return true
  // share at least one significant word (>=3 chars)
  const wordsA = na.split(' ').filter(w => w.length >= 3)
  return wordsA.some(w => nb.includes(w))
}

// True if the two addresses are likely the same location
function addressMatches(provided, found) {
  const np = normalizeText(provided)
  const nf = normalizeText(found)
  // Extract leading street number if present
  const numMatch = provided.match(/^\s*(\d+)/)
  const streetNum = numMatch ? numMatch[1] : null
  if (streetNum && !nf.includes(streetNum)) return false
  // At least one significant word in common (street name, city)
  const words = np.split(' ').filter(w => w.length > 4)
  return words.some(w => nf.includes(w))
}

async function checkNAP(businessName, address, phone, city, placeId) {
  if (!businessName || !city) return null

  if (placeId) {
    const cached = napCache.get(`nap_${placeId}`)
    if (cached) return cached
  }

  let browser
  try {
    const searchUrl = `https://www.pagesjaunes.fr/annuaire/chercherlespros?quoiqui=${encodeURIComponent(businessName)}&ou=${encodeURIComponent(city)}`
    console.log(`[NAP] Recherche PagesJaunes: ${searchUrl}`)

    browser = await puppeteer.launch({
      headless: true,
      executablePath: EXEC_PATH,
      args: PUPPETEER_ARGS,
    })

    const page = await browser.newPage()
    await page.setUserAgent(USER_AGENT)
    await page.setViewport({ width: 1280, height: 800 })
    await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 20000 })

    // Extract first listing result
    const raw = await page.evaluate(() => {
      // PagesJaunes listing — try multiple selector strategies
      const nameEl = document.querySelector(
        '.bi-denomination a, .denomination-links a, [class*="denomination"] a, .bi-denomination'
      )
      if (!nameEl) return null

      const container = nameEl.closest(
        '[class*="bi-bloc"], [class*="bloc-resultat"], article, li[class*="result"], .result'
      ) || nameEl.parentElement?.parentElement

      const addrEl  = container?.querySelector('[class*="adress"], .adresse, .bi-adress, [class*="address"]')
      const phoneEl = container?.querySelector(
        '[class*="phone"], [class*="tel"], .bi-phone, [data-pj-tel], a[href^="tel"]'
      )

      return {
        name:    nameEl.textContent?.trim()  || null,
        address: addrEl?.textContent?.trim() || null,
        phone:   phoneEl?.textContent?.trim() ?? phoneEl?.getAttribute('href')?.replace('tel:', '') ?? null,
      }
    })

    console.log(`[NAP] Résultat brut PagesJaunes:`, JSON.stringify(raw))

    if (!raw || !raw.name) {
      return { found: false, napScore: 'not_found', pjName: null, pjAddress: null, pjPhone: null, issues: ['Commerce non trouvé sur PagesJaunes'] }
    }

    // ── Compare each NAP field ─────────────────────────────────────────────────
    const issues = []

    const normName    = normalizeText(businessName)
    const normNamePJ  = normalizeText(raw.name)
    const normAddr    = normalizeText(address || '')
    const normAddrPJ  = normalizeText(raw.address || '')
    const normPhone   = normalizePhone(phone || '')
    const normPhonePJ = normalizePhone(raw.phone || '')
    console.log(`[NAP] Comparaison normalisée — Nom: "${normName}" vs "${normNamePJ}" | Adresse: "${normAddr}" vs "${normAddrPJ}" | Tél: "${normPhone}" vs "${normPhonePJ}"`)

    if (!nameMatches(businessName, raw.name))
      issues.push(`Nom différent : local "${businessName}" → PagesJaunes "${raw.name}"`)

    if (address && raw.address && !addressMatches(address, raw.address))
      issues.push(`Adresse différente : local "${address}" → PagesJaunes "${raw.address}"`)

    if (phone && raw.phone) {
      const np = normPhone
      const nf = normPhonePJ
      if (np !== nf && !np.endsWith(nf.slice(-8)) && !nf.endsWith(np.slice(-8)))
        issues.push(`Téléphone différent : local "${phone}" → PagesJaunes "${raw.phone}"`)
    }

    const napScore = issues.length === 0 ? 'consistent' : 'inconsistent'
    console.log(`[NAP] ${businessName} → ${napScore} (${issues.length} problème(s))`)

    const napResult = { found: true, napScore, pjName: raw.name, pjAddress: raw.address, pjPhone: raw.phone, issues }
    if (placeId) napCache.set(`nap_${placeId}`, napResult, TTL_7D)
    return napResult

  } catch (e) {
    console.warn(`[NAP] Erreur PagesJaunes pour "${businessName}":`, e.message)
    return null
  } finally {
    if (browser) await browser.close()
  }
}

module.exports = { getPageSpeed, checkNAP, getSiteSignals }
