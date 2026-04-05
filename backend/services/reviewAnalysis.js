const QUESTION_PATTERNS = [
  'est-ce que', 'comment', 'quand', 'combien', 'peut-on', 'est-il possible',
  'pouvez-vous', 'avez-vous', 'faites-vous', 'acceptez-vous',
]

const QUESTION_TOPICS = {
  horaires:    ['horaire', 'ouvert', 'fermé', 'fermeture', 'heure', 'quand'],
  reservation: ['réservation', 'réserver', 'booking', 'prendre rendez'],
  tarif:       ['prix', 'tarif', 'combien', 'coût', 'cout', 'cher', 'gratuit'],
  contact:     ['téléphone', 'contact', 'joindre', 'appeler', 'mail', 'email'],
  services:    ['service', 'prestation', 'disponible', 'propose', 'offre'],
}

function countQuestionsInReviews(reviews) {
  if (!reviews || reviews.length === 0) {
    return { totalQuestions: 0, questionTopics: {}, questionRatio: 0 }
  }

  let totalQuestions = 0
  const topicCounts  = {}

  reviews.forEach(review => {
    const text = (review.text || '').toLowerCase()
    const hasQuestion = text.includes('?') ||
      QUESTION_PATTERNS.some(kw => text.includes(kw))
    if (hasQuestion) totalQuestions++

    for (const [topic, keywords] of Object.entries(QUESTION_TOPICS)) {
      if (keywords.some(kw => text.includes(kw))) {
        topicCounts[topic] = (topicCounts[topic] || 0) + 1
      }
    }
  })

  return {
    totalQuestions,
    questionTopics: topicCounts,
    questionRatio:  Math.round((totalQuestions / reviews.length) * 100),
  }
}

const POSITIVE_KEYWORDS = [
  'excellent', 'parfait', 'super', 'rapide', 'efficace',
  'professionnel', 'accueil', 'recommande', 'top', 'génial',
  'perfect', 'great', 'fast', 'amazing', 'love',
]

const NEGATIVE_KEYWORDS = [
  'attente', 'lent', 'pas de réponse', 'ignoré', 'fermé',
  'impossible', 'jamais', 'décevant', 'nul', 'mauvais',
  'horaires', 'injoignable', 'pas rappelé', 'personne',
  'wait', 'slow', 'no response', 'ignored', 'terrible',
  'disappointed', 'rude', 'closed', 'unreachable',
]

function analyzeReviews(reviews) {
  const result = {
    total: (reviews || []).length,
    byStars: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
    positiveScore: 0,
    negativeScore: 0,
    positive: {
      count:       0,
      keywords:    [],
      bestReview:  null,
    },
    negative: {
      count:        0,
      keywords:     [],
      unanswered:   0,
      worstReview:  null,
    },
    chatbotOpportunity: {
      score:   0,
      reasons: [],
      urgency: 'low',
    },
  }

  if (!reviews || reviews.length === 0) return result

  reviews.forEach(review => {
    const stars = review.rating
    const text  = (review.text || '').toLowerCase()

    result.byStars[stars] = (result.byStars[stars] || 0) + 1

    if (stars >= 4) {
      result.positive.count++
      POSITIVE_KEYWORDS.forEach(kw => {
        if (text.includes(kw) && !result.positive.keywords.includes(kw))
          result.positive.keywords.push(kw)
      })
      if (stars === 5 && (!result.positive.bestReview ||
          text.length > (result.positive.bestReview.text || '').length))
        result.positive.bestReview = review
    }

    if (stars <= 2) {
      result.negative.count++
      if (!review.owner_answer && !review.author_reply) result.negative.unanswered++
      NEGATIVE_KEYWORDS.forEach(kw => {
        if (text.includes(kw) && !result.negative.keywords.includes(kw))
          result.negative.keywords.push(kw)
      })
      if (stars === 1 && (!result.negative.worstReview ||
          text.length > (result.negative.worstReview.text || '').length))
        result.negative.worstReview = review
    }
  })

  const total = result.total
  result.positiveScore = Math.round((result.positive.count / total) * 100)
  result.negativeScore = Math.round((result.negative.count / total) * 100)

  // ── Score opportunité chatbot ─────────────────────────────────────────────
  let oppScore = 0
  const reasons = []

  if (result.negative.unanswered > 3) {
    oppScore += 30
    reasons.push(`${result.negative.unanswered} avis négatifs sans réponse`)
  }
  if (result.negativeScore > 20) {
    oppScore += 25
    reasons.push(`${result.negativeScore}% d'avis négatifs`)
  }
  if (result.negative.keywords.includes('attente') ||
      result.negative.keywords.includes('wait')) {
    oppScore += 20
    reasons.push("Problèmes d'attente mentionnés")
  }
  if (result.negative.keywords.includes('injoignable') ||
      result.negative.keywords.includes('no response')) {
    oppScore += 25
    reasons.push('Business injoignable selon les clients')
  }

  result.chatbotOpportunity.score   = Math.min(oppScore, 100)
  result.chatbotOpportunity.reasons = reasons
  result.chatbotOpportunity.urgency =
    oppScore >= 70 ? 'critical' :
    oppScore >= 50 ? 'high' :
    oppScore >= 30 ? 'medium' : 'low'

  result.questionAnalysis = countQuestionsInReviews(reviews)

  return result
}

// ── Mentions appels téléphoniques ────────────────────────────────────────────
const PHONE_KEYWORDS   = ['appel', 'téléphone', 'appeler', 'appelé', 'joindre', 'rappel', 'rappeler', 'call', 'phone', 'décroché']
const PHONE_DIFFICULTY = ['injoignable', 'impossible à joindre', 'pas de réponse', 'jamais décroché', 'ne répond pas', 'pas rappelé', 'unreachable', 'no answer', 'no response']

function countPhoneCallMentions(reviews) {
  if (!reviews || reviews.length === 0) return { totalMentions: 0, difficultyCount: 0, hasDifficulty: false }
  let totalMentions = 0
  let difficultyCount = 0
  reviews.forEach(review => {
    const text = (review.text || '').toLowerCase()
    if (!PHONE_KEYWORDS.some(kw => text.includes(kw))) return
    totalMentions++
    if (PHONE_DIFFICULTY.some(kw => text.includes(kw))) difficultyCount++
  })
  return { totalMentions, difficultyCount, hasDifficulty: difficultyCount > 0 }
}

// ── Activité hors horaires ────────────────────────────────────────────────────
const OFF_HOURS_KEYWORDS = ['soir', 'nuit', 'week-end', 'weekend', 'dimanche', 'samedi', 'fermé', 'après fermeture', 'after hours', 'hors horaires', 'pas disponible']

function detectOffHoursActivity(reviews) {
  if (!reviews || reviews.length === 0) return { hasOffHoursNeed: false, count: 0, ratio: 0 }
  let count = 0
  reviews.forEach(review => {
    const text = (review.text || '').toLowerCase()
    if (OFF_HOURS_KEYWORDS.some(kw => text.includes(kw))) count++
  })
  const ratio = Math.round((count / reviews.length) * 100)
  return { hasOffHoursNeed: count > 0, count, ratio }
}

// ── Détection de langues ──────────────────────────────────────────────────────
const LANG_SIGNATURES = {
  en: [' the ', ' and ', ' was ', ' very ', 'great', ' this ', 'really', 'amazing', 'staff'],
  es: [' muy ', 'bueno', 'excelente', 'gracias', 'servicio', ' todo '],
  de: [' sehr ', ' gut ', ' nicht ', ' und ', ' das ', ' ich '],
  it: [' molto ', ' bene', 'ottimo', 'servizio', 'grazie'],
  pt: [' muito ', 'ótimo', 'serviço', 'obrigado', 'recomendo'],
  nl: [' heel ', ' goed ', ' een ', ' van ', ' het '],
}

function detectLanguages(reviews) {
  if (!reviews || reviews.length === 0) return { isMultilingual: false, languages: ['fr'], foreignRatio: 0 }
  const detected = new Set(['fr'])
  let foreignCount = 0
  reviews.forEach(review => {
    const text = ' ' + (review.text || '').toLowerCase() + ' '
    if (!text.trim()) return
    let isForeign = false
    for (const [lang, sigs] of Object.entries(LANG_SIGNATURES)) {
      if (sigs.some(s => text.includes(s))) {
        detected.add(lang)
        if (lang !== 'fr') isForeign = true
      }
    }
    if (isForeign) foreignCount++
  })
  const languages = [...detected]
  const foreignRatio = Math.round((foreignCount / reviews.length) * 100)
  return { isMultilingual: languages.length > 1, languages, foreignRatio }
}

// ── Mentions fidélité/email dans les avis ────────────────────────────────────
const LOYALTY_KEYWORDS = [
  'carte fidélité', 'programme fidélité', 'fidélisation', 'newsletter',
  'email', 'promo', 'réduction', 'offre', 'coupon', 'remise',
  'code promo', 'bon de réduction', 'parrainage',
]

function detectLoyaltyMentions(reviews) {
  if (!reviews || reviews.length === 0) return { loyaltyMentions: 0, loyaltyTopics: [], hasExistingLoyalty: false }

  const topicCounts = {}
  let total = 0

  for (const review of reviews) {
    const text = (review.text ?? review.comment ?? '').toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    for (const kw of LOYALTY_KEYWORDS) {
      const normalized = kw.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      if (text.includes(normalized)) {
        topicCounts[kw] = (topicCounts[kw] ?? 0) + 1
        total++
        break // une mention max par avis
      }
    }
  }

  const loyaltyTopics = Object.entries(topicCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([kw]) => kw)

  return {
    loyaltyMentions:    total,
    loyaltyTopics,
    hasExistingLoyalty: total > 3,
  }
}

// Thèmes email-marketing détectés dans les avis — { label, count, type: 'positif'|'opportunite' }
const EMAIL_THEME_KEYWORDS = {
  'fidélité':      'positif',
  'fidèle':        'positif',
  'revenir':       'positif',
  'habitué':       'positif',
  'régulier':      'positif',
  'recommande':    'opportunite',
  'offre':         'opportunite',
  'promo':         'opportunite',
  'réduction':     'opportunite',
  'anniversaire':  'opportunite',
  'carte':         'opportunite',
  'cadeau':        'opportunite',
  'abonnement':    'opportunite',
  'nouveau client':'opportunite',
  'première fois': 'opportunite',
  'découvert':     'opportunite',
}

function detectEmailThemes(reviews) {
  if (!reviews || reviews.length === 0) return { themes: [], totalMentions: 0 }

  const counts = {}
  let totalMentions = 0

  for (const review of reviews) {
    const text = (review.text ?? review.comment ?? '').toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    const seen = new Set()
    for (const [kw, type] of Object.entries(EMAIL_THEME_KEYWORDS)) {
      const norm = kw.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      if (text.includes(norm) && !seen.has(kw)) {
        seen.add(kw)
        if (!counts[kw]) counts[kw] = { count: 0, type }
        counts[kw].count++
        totalMentions++
      }
    }
  }

  const themes = Object.entries(counts)
    .map(([label, { count, type }]) => ({ label, count, type }))
    .sort((a, b) => b.count - a.count)

  return { themes, totalMentions }
}

module.exports = { analyzeReviews, countQuestionsInReviews, countPhoneCallMentions, detectOffHoursActivity, detectLanguages, detectLoyaltyMentions, detectEmailThemes }
