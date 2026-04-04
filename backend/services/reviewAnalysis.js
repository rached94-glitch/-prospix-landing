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

module.exports = { analyzeReviews, countQuestionsInReviews }
