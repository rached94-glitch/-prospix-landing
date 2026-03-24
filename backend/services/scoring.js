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

// ── Module-level constants ────────────────────────────────────────────────────
const SIX_MONTHS_MS = 180 * 24 * 3600 * 1000

// ── Main ─────────────────────────────────────────────────────────────────────
function calculateScore(placeData, socialPresence, reviewAnalysis, weights = DEFAULT_WEIGHTS, pappersData = null, googleAudit = null) {
  const w = { ...DEFAULT_WEIGHTS, ...weights }

  // Cap raw /100 scores before multiplying by weight, then cap result at weight
  const rawRating    = Math.min(100, ratingScore(placeData.rating))
  const rawReview    = Math.min(100, reviewScore(placeData.user_ratings_total))
  const rawPresence  = Math.min(100, presenceScore(placeData.website, socialPresence))
  const rawOpportunity = Math.min(100, opportunityScore(placeData.website, socialPresence))

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

module.exports = { calculateScore, DEFAULT_WEIGHTS }
