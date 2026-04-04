const DEFAULT_WEIGHTS = {
  googleRating:    30,
  reviewVolume:    25,
  digitalPresence: 25,
  opportunity:     20,
}

// ── Financial capacity (display only — not included in total score) ──────────
function computeFinancialScore(pappersData) {
  if (!pappersData) return 0
  const ca = pappersData.chiffreAffaires
  if (ca == null) return 0
  if (ca >= 500000) return 30
  if (ca >= 200000) return 20
  if (ca >= 50000)  return 10
  return 0
}

// ── Helper: treat blank/literal "null"/"undefined" as absent ────────────────
function sitePresent(website) {
  return !!(website && website !== 'null' && website !== 'undefined')
}

// ── Note Google → score /100 ─────────────────────────────────────────────────
function ratingScore(rating) {
  if (!rating || rating === 0) return 0
  if (rating >= 4.5) return 100
  if (rating >= 4.0) return 73
  if (rating >= 3.5) return 47
  return 17
}

// ── Volume avis → score /100 ─────────────────────────────────────────────────
function reviewScore(total) {
  const n = Number(total) || 0   // cast — avoids NaN when value is a string
  if (n >= 500) return 100
  if (n >= 200) return 80
  if (n >= 100) return 60
  if (n >= 50)  return 40
  if (n >= 20)  return 20
  return 0
}

// ── Présence digitale → score /100 ───────────────────────────────────────────
function presenceScore(website, social) {
  let pts = 0
  if (sitePresent(website))    pts += 40
  if (social.facebook)         pts += 20
  if (social.instagram)        pts += 20
  if (social.linkedin)         pts += 12
  if (social.tiktok)           pts += 8
  return Math.min(pts, 100)
}

// ── Opportunité → score /100 ─────────────────────────────────────────────────
function opportunityScore(website, social) {
  const hasWebsite = sitePresent(website)
  if (!hasWebsite) return 100

  const networks = [
    social.facebook,
    social.instagram,
    social.linkedin,
    social.tiktok,
  ].filter(Boolean).length

  if (networks === 0) return 70
  if (networks === 1) return 40
  return 15  // 2+ réseaux
}

// ── Opportunité photographe → score /100 ─────────────────────────────────────
function photographeOpportunityScore(placeData, socialPresence) {
  const photoCount = placeData.photoCount ?? 0
  let photoScore = 0
  if (photoCount === 0)        photoScore = 100
  else if (photoCount <= 5)    photoScore = 85
  else if (photoCount <= 15)   photoScore = 65
  else if (photoCount <= 30)   photoScore = 35
  else                         photoScore = 10

  if (!sitePresent(placeData.website)) photoScore = Math.max(0, photoScore - 20)

  let visualBonus = 0
  if (!socialPresence.instagram) visualBonus += 20
  if (!socialPresence.tiktok)    visualBonus += 10
  if (!socialPresence.pinterest) visualBonus += 5
  if (!socialPresence.youtube)   visualBonus += 5

  return Math.min(100, photoScore + visualBonus)
}

// ── Complexité du domaine métier ──────────────────────────────────────────────
const DOMAIN_COMPLEX = ['doctor', 'dentist', 'lawyer', 'hospital', 'clinique', 'cabinet', 'assurance', 'comptable', 'notaire', 'avocat', 'kine', 'psy', 'pharmacie', 'immo', 'insurance', 'medical', 'clinic', 'attorney', 'accountant', 'osteopathe', 'psychologue', 'psychiatre', 'orthodontiste']
const DOMAIN_MEDIUM  = ['restaurant', 'cafe', 'hotel', 'salon', 'coiffure', 'spa', 'garage', 'sport', 'fitness', 'gym', 'brasserie', 'pizz', 'burger', 'barbier']

function getDomainComplexity(placeData) {
  const types   = (placeData.types || []).map(t => t.toLowerCase())
  const raw     = ((placeData.keyword ?? placeData.domain ?? types[0] ?? '') + '')
    .toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  const allText = [...types, raw].join(' ')
  if (DOMAIN_COMPLEX.some(c => allText.includes(c))) return 'complex'
  if (DOMAIN_MEDIUM.some(c  => allText.includes(c))) return 'medium'
  return 'simple'
}

// ── Opportunité chatbot → score /100 ─────────────────────────────────────────
const CHATBOT_FORT   = ['restaurant', 'cafe', 'hotel', 'salon', 'coiffure', 'beaute', 'spa', 'barbier', 'clinique', 'dentiste', 'kine', 'garage', 'avocat', 'notaire', 'comptable', 'immo', 'sport', 'medecin', 'pharmacie', 'cabinet', 'osteopathe', 'psychologue', 'psychiatre', 'brasserie', 'pizz', 'burger']
const CHATBOT_MOYEN  = ['fleuriste', 'bijouterie', 'optique']
const CHATBOT_FAIBLE = ['plombier', 'electricien', 'macon', 'epicerie', 'tabac', 'pressing']

function chatbotOpportunityScore(placeData, pagespeedData, pappersData, reviewsData) {
  if (!sitePresent(placeData.website)) return 10  // éliminatoire — pas de site

  const raw = ((placeData.keyword ?? placeData.domain ?? placeData.types?.[0] ?? '') + '')
    .toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')

  let base = 50
  if      (CHATBOT_FORT.some(c   => raw.includes(c))) base = 80
  else if (CHATBOT_MOYEN.some(c  => raw.includes(c))) base = 60
  else if (CHATBOT_FAIBLE.some(c => raw.includes(c))) base = 20

  let score = base

  const cmsName = pagespeedData?.cms?.cms ?? pagespeedData?.cms ?? null
  if (cmsName === 'wordpress' || cmsName === 'wix') score += 10  // easy integration
  if (pagespeedData?.siteSignals?.chatbotDetected)  score -= 40  // already has chatbot
  if (placeData.isActiveOwner)   score += 10  // responsive owner
  if (placeData.newBusinessBadge) score -= 10  // budget concerns

  if (pappersData) {
    const eff = pappersData.effectifs ?? null
    if      (eff != null && eff <= 2)  score += 15
    else if (eff != null && eff <= 10) score += 8
    else if (eff != null && eff > 10)  score -= 5
    if ((pappersData.chiffreAffaires ?? 0) > 100000) score += 10
  }

  // Enriched signals — populated by buildLead() before calling calculateScore
  const sig = reviewsData?.chatbotSignals
  if (sig) {
    if (sig.hasRecurringQuestions)            score += 20
    if ((sig.unansweredCount ?? 0) >= 3)      score += 15
    if (sig.isMultilingual)                   score += 10
    if (sig.hasOverwhelmKeywords)             score += 20
    if ((sig.questionCount ?? 0) >= 3)        score += 15  // reviews with questions
    if ((sig.questionRatio ?? 0) >= 20)       score += 10  // high question ratio
    if (sig.hasFAQ)                           score -= 20  // already has FAQ → less need
    if (sig.hasContactForm)                   score -= 10  // already has contact channel
    if (sig.domainComplexity === 'complex')   score += 15
    else if (sig.domainComplexity === 'medium') score += 5
  }

  return Math.max(10, Math.min(100, score))
}

// ── Opportunité SEO → score /100 ─────────────────────────────────────────────
function seoOpportunityScore(placeData, pagespeedData) {
  if (!sitePresent(placeData.website)) return 10  // pas de site → pas d'optimisation possible

  if (!pagespeedData) return 30  // audit pas encore lancé → score neutre

  let score = 50

  // Signaux positifs — site mal optimisé = bonne opportunité
  const seo  = pagespeedData.seo  ?? null
  const perf = pagespeedData.performance ?? null
  const lcp  = pagespeedData.lcp  ? parseFloat(pagespeedData.lcp)  : null

  if      (seo  !== null && seo  < 50)  score += 25
  else if (seo  !== null && seo  < 70)  score += 15

  if      (perf !== null && perf < 50)  score += 20
  else if (perf !== null && perf < 70)  score += 10

  if (lcp !== null && lcp > 4)          score += 15

  if (!pagespeedData.title)             score += 10
  if (!pagespeedData.mobileFriendly)    score += 10
  if (!pagespeedData.https)             score += 15
  if ((pagespeedData.renderBlocking ?? 0) > 2) score += 5
  if (!pagespeedData.sitemap)           score += 5

  return Math.min(100, score)
}

// ── Module-level constants ────────────────────────────────────────────────────
const SIX_MONTHS_MS = 180 * 24 * 3600 * 1000

// ── Main ─────────────────────────────────────────────────────────────────────
function calculateScore(placeData, socialPresence, reviewAnalysis, weights = DEFAULT_WEIGHTS, pappersData = null, googleAudit = null, profileId = null, pagespeedData = null) {
  const w = { ...DEFAULT_WEIGHTS, ...weights }

  // Cap raw /100 scores before multiplying by weight, then cap result at weight
  const rawRating    = Math.min(100, ratingScore(placeData.rating))
  const rawReview    = Math.min(100, reviewScore(placeData.user_ratings_total))
  const rawPresence  = Math.min(100, presenceScore(placeData.website, socialPresence))
  const rawOpportunity = Math.min(100,
    profileId === 'photographe'
      ? photographeOpportunityScore(placeData, socialPresence)
      : (profileId === 'seo' || profileId === 'consultant-seo')
        ? seoOpportunityScore(placeData, pagespeedData)
        : (profileId === 'chatbot' || profileId === 'dev-chatbot')
          ? chatbotOpportunityScore(placeData, pagespeedData, pappersData, reviewAnalysis)
          : opportunityScore(placeData.website, socialPresence))

  const googleRating    = Math.min(w.googleRating,    Math.round(rawRating     / 100 * w.googleRating))
  const reviewVolume    = Math.min(w.reviewVolume,    Math.round(rawReview     / 100 * w.reviewVolume))
  let   digitalPresence = Math.min(w.digitalPresence, Math.round(rawPresence   / 100 * w.digitalPresence))
  const opportunity     = Math.min(w.opportunity,     Math.round(rawOpportunity / 100 * w.opportunity))
  const financialCapacity = computeFinancialScore(pappersData)  // display only

  // ── Google audit penalties on digitalPresence ──────────────────────────────
  if (googleAudit) {
    const ficheIncomplete = !googleAudit.hasPhotos && !googleAudit.hasHours
    if (ficheIncomplete) digitalPresence = Math.max(0, digitalPresence - 3)
  }

  // ── newBusinessBadge detection ───────────────────────────────────────────────
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

  let total = Math.max(googleRating + reviewVolume + digitalPresence + opportunity, 0)
  if (placeData.isActiveOwner) total += 5   // Feature 2 : Gérant actif
  if (newBusinessBadge)        total += 15  // Feature 3 : Nouveau business ('confirmed'|'probable' → truthy)
  total = Math.min(100, total)

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
}

module.exports = { calculateScore, DEFAULT_WEIGHTS, getDomainComplexity }
