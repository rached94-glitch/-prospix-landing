const express        = require('express');
const router         = express.Router();
const AppError       = require('../utils/AppError');
const logger         = require('../utils/logger');
const { searchPlaces, getPlaceDetails, getPhotoUrls, getLocalRank, cleanWebsiteUrl, scrapeDescription } = require('../services/googlePlaces');
const { createCache } = require('../cache/searchCache');
const { validateSearchParams, validatePlaceId } = require('../utils/validateInputs');
const { analyzePhotoQuality } = require('../services/photoQualityService');
const { enrichSocial }   = require('../services/socialEnrichment');
const { calculateScore, getDomainComplexity, getRecommendedRAGType, estimateMonthlyConversations, getRecommendedStack, getEmailMarketingRecommendation, getGoogleAdsConcurrence, googleAdsReadiness, getGoogleAdsRecommendation } = require('../services/scoring');
const { analyzeReviews, countQuestionsInReviews, countPhoneCallMentions, detectOffHoursActivity, detectLanguages, detectLoyaltyMentions, detectEmailThemes } = require('../services/reviewAnalysis');
const { getAllReviews }      = require('../services/apifyReviews');
const { analyzeWithAI, generateEmailPhotographe, generateEmailSEO, generateEmailChatbot, generateEmailSocialMedia, generateEmailDesigner, generateEmailWebDev, generateAuditSEO, generateAuditPhotographe, generateAuditChatbot, generateAuditSocialMedia, generateAuditDesigner, generateAuditWebDev, generateAuditEmailMarketing, generateEmailEmailMarketing, generateAuditGoogleAds, generateEmailGoogleAds } = require('../services/aiReviewAnalysis');
const { findDecisionMaker } = require('../services/linkedinScraper');
const { searchPappers }     = require('../services/pappersService');
const { getPageSpeed, checkNAP, getSiteSignals } = require('../services/pagespeedService');
const { getFacebookActivity, getInstagramActivity, getInstagramPosts } = require('../services/socialMediaService')
const { analyzeNetworkPhotos } = require('../services/visualSocialService');
const benchmarkService = require('../services/benchmarkService');
const { LEAD_COSTS, DEFAULT_MAX_LEADS } = require('../config/plans');

const SOCIAL_SOURCES = ['linkedin', 'facebook', 'instagram', 'tiktok'];

const unlockCache = createCache('unlock'); // TTL 7j — évite de re-facturer un déblocage

// ─── Helpers ─────────────────────────────────────────────────────────────────
// Résout avec la valeur si la promise se termine avant ttlMs, sinon résout
// avec `fallback` (ne rejette jamais — un enrichissement lent ne bloque pas tout)
function withTimeout(promise, ttlMs, fallback = null) {
  return Promise.race([
    promise,
    new Promise(resolve => setTimeout(() => resolve(fallback), ttlMs)),
  ])
}
function haversineKm(lat1, lng1, lat2, lng2) {
  if (lat2 == null || lng2 == null) return 0;
  const R    = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function buildLead(place, { lat, lng, domain, keywords, socialPresence, pappersData, weights, profileId }) {
  const openNow        = place.opening_hours?.open_now ?? null;
  const placeData      = { ...place, openNow, keyword: keywords?.[0], domain };
  const reviews        = place.reviews || []
  const reviewAnalysis = analyzeReviews(reviews)
  const loyaltyAnalysis = detectLoyaltyMentions(reviews)
  const emailThemes     = detectEmailThemes(reviews)

  // Chatbot enrichment signals — computed from native reviews (5 max in phase 1)
  const phoneCallAnalysis  = countPhoneCallMentions(reviews)
  const offHoursAnalysis   = detectOffHoursActivity(reviews)
  const languageDetection  = detectLanguages(reviews)
  const domainComplexityVal = getDomainComplexity(placeData)
  const hasFAQPhase1       = socialPresence.faqDetection?.hasFAQ ?? false
  const hasFormPhase1      = socialPresence.contactFormDetection?.hasContactForm ?? false
  const hasBooking         = !!(socialPresence.bookingPlatform)

  // Augment chatbotSignals for scoring (merged from review + social detection)
  reviewAnalysis.chatbotSignals = {
    ...(reviewAnalysis.chatbotSignals || {}),
    questionCount:     reviewAnalysis.questionAnalysis?.totalQuestions ?? 0,
    questionRatio:     reviewAnalysis.questionAnalysis?.questionRatio  ?? 0,
    hasFAQ:            hasFAQPhase1,
    hasContactForm:    hasFormPhase1,
    domainComplexity:  domainComplexityVal,
    phoneCallMentions: phoneCallAnalysis,
    offHoursActivity:  offHoursAnalysis,
    languageDetection: languageDetection,
    isMultilingual:    languageDetection.isMultilingual,
  }

  const domainComplexity = domainComplexityVal

  const recommendedRAGType = getRecommendedRAGType(
    domainComplexity, hasBooking, hasFAQPhase1,
    reviewAnalysis.questionAnalysis?.questionTopics ?? {},
    place.user_ratings_total ?? 0
  )
  const estimatedConversations = estimateMonthlyConversations(
    place.user_ratings_total ?? 0,
    reviewAnalysis.questionAnalysis?.totalQuestions ?? 0,
    hasFormPhase1
  )
  const recommendedStack = getRecommendedStack(null, domainComplexity, languageDetection.isMultilingual)

  // Google audit — derived from Places Details, no extra API call
  const googleAudit = {
    hasPhotos:         (place.photoCount ?? 0) > 0,
    photoCount:        place.photoCount ?? 0,
    hasDescription:    place.hasDescription ?? false,
    descriptionText:   place.descriptionText   ?? null,
    descriptionSource: place.descriptionSource ?? null,
    hasHours:          place.hasHours ?? !!(place.opening_hours),
  };

  const score    = calculateScore(placeData, socialPresence, reviewAnalysis, weights ?? undefined, pappersData ?? null, googleAudit, profileId ?? null);
  const distance = Math.round(haversineKm(lat, lng, place.lat, place.lng) * 10) / 10;

  return {
    id:       place.place_id,
    name:     place.name,
    address:  place.vicinity,
    phone:    place.phone,
    website:  place.website,
    lat:      place.lat,
    lng:      place.lng,
    distance,
    google: {
      rating:       place.rating,
      totalReviews: place.user_ratings_total,
      priceLevel:   place.price_level,
      openNow,
      reviews:      place.reviews || [],
    },
    social: {
      linkedin:             socialPresence.linkedin,
      facebook:             socialPresence.facebook,
      instagram:            socialPresence.instagram,
      tiktok:               socialPresence.tiktok,
      googleBusiness:       `https://maps.google.com/?cid=${place.place_id}`,
      newsletterDetection:  socialPresence.newsletterDetection  ?? null,
      contactFormDetection: socialPresence.contactFormDetection ?? null,
    },
    googleAudit,
    chatbotDetection: socialPresence.chatbotDetection ?? null,
    pappers:          pappersData ?? null,
    score: { total: score.total, breakdown: score.breakdown },
    reviewAnalysis,
    status:  'new',
    domain:  domain || null,
    keyword: keywords?.[0] || null,
    newBusinessBadge:    score.newBusinessBadge ?? null,
    isActiveOwner:       place.isActiveOwner ?? false,
    ownerReplyRatio:     place.ownerReplyRatio ?? 0,
    domainComplexity,
    faqDetection:        socialPresence.faqDetection         ?? null,
    contactFormDetection: socialPresence.contactFormDetection ?? null,
    phoneCallAnalysis,
    offHoursAnalysis,
    languageDetection,
    recommendedRAGType,
    estimatedConversations,
    recommendedStack,
    loyaltyAnalysis,
    emailThemes,
  };
}

function applyPostProcessing(leads, { city, domain }) {
  if (!leads.length) return;

  // Feature 1 — Comparaison Concurrents
  const scores = leads.map(l => l.score?.total ?? 0);
  const avg = scores.length > 1
    ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
    : null;
  for (const lead of leads) {
    lead.competitorAvg   = avg;
    lead.competitorDelta = avg !== null ? (lead.score?.total ?? 0) - avg : null;
  }

  // Feature 4 — Benchmark Sectoriel (2 passes)
  const d = domain ?? '';
  const c = city   ?? '';
  for (const lead of leads) {
    benchmarkService.addScore(d, c, lead.score?.total ?? 0);
  }
  for (const lead of leads) {
    lead.benchmarkPercentile = benchmarkService.getPercentile(d, c, lead.score?.total ?? 0);
  }
}

async function processPlaces(places, { lat, lng, domain, keywords, city, onProgress, weights, profileId }) {
  const total = places.length;
  let   done      = 0;

  if (onProgress) onProgress({ type: 'progress', message: 'Scoring...' });

  const leads = await Promise.all(
    places.map(async place => {
      // Phase 1 : pas d'appel social/pappers — différé à l'unlock
      const socialPresence = { linkedin: null, facebook: null, instagram: null, tiktok: null, hasChatbot: false };
      const pappersData    = null;

      const lead = buildLead(place, { lat, lng, domain, keywords, socialPresence, pappersData, weights, profileId });
      lead.locked = true;
      done++;
      logger.info('Enrich', `Lead ${done}/${total} terminé : ${place.name}`);
      return lead;
    })
  );

  leads.sort((a, b) => b.score.total - a.score.total);
  return leads;
}

// ─── POST /search/stream (SSE) ────────────────────────────────────────────────
router.post('/search/stream', async (req, res) => {
  logger.info('Stream', `Requête reçue — body: ${JSON.stringify(req.body)}`)

  res.setHeader('Content-Type',  'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection',    'keep-alive');
  res.flushHeaders();
  logger.info('Stream', 'Headers SSE envoyés')

  const send = data => {
    if (res.writableEnded) return
    try {
      res.write(`data: ${JSON.stringify(data)}\n\n`)
    } catch (e) {
      logger.error('Stream', `res.write error: ${e.message}`, e)
    }
  }

  try {
    const { city, lat, lng, radius, domain, keywords = [], sources = [], weights = null, profileId = null, maxLeads: rawMaxLeads } = req.body;
    logger.info('Stream', `Params — city:${city} lat:${lat} lng:${lng} radius:${radius} domain:${domain}`)

    const maxLeads = [30, 60, 120].includes(Number(rawMaxLeads)) ? Number(rawMaxLeads) : DEFAULT_MAX_LEADS

    const { valid, errors } = validateSearchParams({ lat, lng, radius, keywords, domain, profileId, maxLeads })
    if (!valid) {
      send({ type: 'error', message: errors.join(', ') })
      return res.end()
    }

    // TODO: Supabase — vérifier que l'utilisateur a assez de crédits avant de lancer
    logger.info('Stream', `Recherche limitée à ${maxLeads} leads (coût : ${LEAD_COSTS[maxLeads] ?? 2} crédits)`)

    logger.info('Stream', 'Lancement searchPlaces…')
    let { places, fromCache } = await searchPlaces({
      lat, lng, radius, keywords, domain,
      onProgress: send,
    });
    places = places.slice(0, maxLeads)
    logger.info('Stream', `searchPlaces terminé — ${places.length} lieux (fromCache:${fromCache})`)

    logger.info('Stream', 'Lancement processPlaces…')
    const leads = await processPlaces(places, {
      lat, lng, domain, keywords, sources, city,
      onProgress: send,
      weights,
      profileId,
    });
    logger.info('Stream', `processPlaces terminé — ${leads.length} leads`)

    applyPostProcessing(leads, { city, domain })

    send({
      type: 'done',
      leads,
      total: leads.length,
      fromCache,
      searchParams: { city, lat, lng, radius, domain, keywords, sources },
    });
    logger.info('Stream', 'Événement done envoyé')
  } catch (err) {
    logger.error('Stream', `ERREUR non catchée: ${err.message}`, err)
    send({ type: 'error', message: err.message });
  }

  res.end();
  logger.info('Stream', 'res.end() appelé')
});

// ─── POST /search (classique, rétrocompatibilité) ─────────────────────────────
router.post('/search', async (req, res, next) => {
  try {
    const { city, lat, lng, radius, domain, keywords = [], sources = [], weights = null, profileId = null } = req.body;

    if (!lat || !lng)    throw new AppError('lat/lng manquants', 400);
    if (radius == null)  throw new AppError('radius manquant', 400);

    const { places, fromCache } = await searchPlaces({ lat, lng, radius, keywords, domain });
    const leads = await processPlaces(places, { lat, lng, domain, keywords, sources, city, weights, profileId });

    applyPostProcessing(leads, { city, domain })

    res.json({
      leads,
      total: leads.length,
      fromCache,
      searchParams: { city, lat, lng, radius, domain, keywords, sources },
    });
  } catch (err) {
    next(err);
  }
});

// ─── POST /decision-maker — LinkedIn scraping ─────────────────────────────────
router.post('/decision-maker', async (req, res, next) => {
  try {
    const { businessName, city, website } = req.body
    if (!businessName) throw new AppError('businessName requis', 400)
    const decisionMaker = await findDecisionMaker(businessName, city || '', website || null)
    res.json({ decisionMaker })
  } catch (e) {
    next(e)
  }
})

// ─── POST /reviews/:placeId — Récupération Apify ─────────────────────────────
router.post('/reviews/:placeId', async (req, res, next) => {
  try {
    const { placeId } = req.params
    if (!validatePlaceId(placeId)) throw new AppError('placeId invalide', 400)
    const reviews           = await getAllReviews(placeId)
    const unanswered        = reviews.filter(r => !r.ownerReply).length
    const questionAnalysis  = countQuestionsInReviews(reviews)
    const phoneCallAnalysis = countPhoneCallMentions(reviews)
    const offHoursAnalysis  = detectOffHoursActivity(reviews)
    const languageDetection = detectLanguages(reviews)
    const loyaltyAnalysis   = detectLoyaltyMentions(reviews)
    const emailThemes       = detectEmailThemes(reviews)
    res.json({ reviews, total: reviews.length, unanswered, questionAnalysis, phoneCallAnalysis, offHoursAnalysis, languageDetection, loyaltyAnalysis, emailThemes })
  } catch (e) {
    next(e)
  }
})

// ─── POST /pappers — Enrichissement financier Pappers.fr ─────────────────────
router.post('/pappers', async (req, res, next) => {
  try {
    const { businessName, city, siret } = req.body
    if (!businessName) throw new AppError('businessName requis', 400)
    const data = await searchPappers(businessName, city || '', siret || '')
    res.json({ pappers: data })
  } catch (e) {
    next(e)
  }
})

// ─── POST /analyze/:placeId — Analyse IA Claude ───────────────────────────────
router.post('/analyze/:placeId', async (req, res, next) => {
  try {
    const { placeId } = req.params
    if (!validatePlaceId(placeId)) throw new AppError('placeId invalide', 400)
    const {
      reviews     = [],
      businessName = 'ce business',
      profileId    = 'default',
      websiteUrl   = null,
      city         = null,
      rating       = null,
      reviewCount  = null,
      auditData    = null,
      category     = null,
    } = req.body
    console.log(`[analyze] Profil reçu: ${profileId} | business: "${businessName}" | avis: ${reviews.length} | site: ${websiteUrl ?? 'absent'} | ville: ${city ?? '?'}`)
    console.log(`[analyze] auditData reçu: ${auditData ? 'oui' : 'non'}`)

    if (reviews.length === 0) {
      throw new AppError('Aucun avis fourni. Chargez les avis d\'abord.', 400)
    }

    const result = await analyzeWithAI(reviews, businessName, profileId, { websiteUrl, city, rating, reviewCount, category: category || 'ce secteur' }, auditData)
    res.json(result)
  } catch (e) {
    next(e)
  }
})

// ─── POST /generate-email — Email personnalisé basé sur l'analyse IA ──────────
router.post('/generate-email', async (req, res, next) => {
  const Anthropic = require('@anthropic-ai/sdk')

  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new AppError('ANTHROPIC_API_KEY manquante — la génération d\'email IA est indisponible', 503)
    }
    const {
      businessName   = 'ce business',
      profileId      = 'chatbot',
      profileName    = 'Défaut',
      aiAnalysis     = null,   // { report, totalReviews, avgRating, unanswered }
      leadData       = {},     // { rating, totalReviews, website, social, address }
      visualAnalysis = null,   // { score, verdict, observations } — depuis l'analyse visuelle IA
      reviewsData        = null,   // { highlights, keywords, summary, topQuotes, reviews }
      googleData         = {},     // { photoCount, hasInstagram, hasFacebook }
      siteAnalysis       = null,   // { socialLinks: { instagram, facebook, ... } }
      facebookActivity   = null,   // { status, label, followers, lastPostDate, daysAgo }
      instagramActivity  = null,   // { status, label, followers, lastPostDate, daysAgo }
      photoQuality       = null,   // { verdict, score, hasStockPhotos, hasAuthenticPhotos, observations }
      pagespeedData      = null,   // { performance, seo, loadTime, lcp, mobileFriendly, https, title, sitemap, cms }
      localRank          = null,   // { rank, found, topThree, topTen }
    } = req.body

    if (!aiAnalysis?.report) {
      throw new AppError('aiAnalysis.report est requis pour générer un email personnalisé', 400)
    }

    // Prioritise the "Problèmes critiques" section of the report
    const reportFull  = aiAnalysis.report ?? ''
    const criticalIdx = reportFull.search(/##\s*(?:🔴\s*)?Probl[eè]mes critiques/i)
    const reportExcerpt = criticalIdx > 0
      ? reportFull.slice(criticalIdx, criticalIdx + 2500)
      : reportFull.slice(0, 2500)

    const unanswered   = aiAnalysis.unanswered ?? 0
    const avgRating    = aiAnalysis.avgRating ?? '?'
    const totalReviews = aiAnalysis.totalReviews ?? leadData.totalReviews ?? '?'

    // Introduction sentence per profile — injected verbatim, Claude must not change it
    const PROFILE_INTRO = {
      'chatbot':        "Je suis spécialisé dans l'automatisation des échanges clients pour les commerces locaux via des assistants IA sur mesure.",
      'seo':            "J'accompagne les commerces locaux à améliorer leur visibilité sur Google et attirer plus de clients en ligne.",
      'social-media':   "J'aide les commerces locaux à développer leur présence sur les réseaux sociaux et engager leur communauté.",
      'photographe':    "Je suis photographe professionnel spécialisé dans la mise en valeur des commerces et restaurants locaux.",
      'videaste':       "Je crée des contenus vidéo pour aider les commerces locaux à se démarquer en ligne.",
      'designer':       "Je conçois l'identité visuelle et les supports de communication pour les commerces locaux.",
      'copywriter':     "J'aide les commerces locaux à améliorer leur communication écrite pour attirer et fidéliser leurs clients.",
      'dev-web':        "Je crée et optimise les sites web des commerces locaux pour convertir les visiteurs en clients.",
      'consultant-seo': "J'accompagne les commerces locaux à dominer les résultats Google dans leur zone de chalandise.",
      'email-marketing':"Je fidélise les clients existants des commerces locaux via des campagnes email personnalisées.",
      'pub-google':     "Je gère les campagnes Google Ads pour les commerces locaux pour maximiser leur retour sur investissement.",
    }
    const PROFILE_PROOF = {
      'chatbot':        "Mes clients constatent en moyenne +20% de prises de contact dans les 30 jours suivant l'installation.",
      'seo':            "En moyenne, mes clients gagnent 2 à 3 positions sur leurs mots-clés locaux en 60 à 90 jours.",
      'social-media':   "Les commerces que j'accompagne voient leur engagement organique progresser de 20 à 25% en 45 jours.",
      'photographe':    "Les fiches Google de mes clients enregistrent en moyenne +25% de taux de clic après une séance photo.",
      'videaste':       "Les contenus vidéo génèrent en moyenne 25 à 30% d'interactions supplémentaires par rapport aux posts statiques.",
      'designer':       "Une identité visuelle cohérente améliore la mémorisation de la marque de 20 à 30% en moyenne.",
      'copywriter':     "Des textes optimisés augmentent le taux de contact d'un site de 20 à 30% en moyenne.",
      'dev-web':        "Un site local bien optimisé convertit en moyenne 25% de visiteurs Maps supplémentaires en appels directs.",
      'consultant-seo': "Mes clients apparaissent sur les premières positions Google pour leurs requêtes locales en 60 à 90 jours.",
      'email-marketing':"Une séquence email ciblée ramène en moyenne 15 à 20% des clients inactifs sur une période de 60 jours.",
      'pub-google':     "Les campagnes que je gère atteignent en moyenne un retour de 2 à 3x sur les commerces locaux.",
    }
    // Natural business description per profile — replaces the raw profile name in the email body
    const PROFILE_ACTIVITY = {
      'chatbot':         "je développe des assistants IA pour automatiser les échanges clients",
      'seo':             "j'accompagne les commerces à améliorer leur visibilité sur Google",
      'social-media':    "j'aide les commerces à développer leur présence sur les réseaux sociaux",
      'photographe':     "je suis photographe spécialisé dans la mise en valeur des commerces",
      'videaste':        "je produis des contenus vidéo pour les commerces locaux",
      'designer':        "je conçois l'identité visuelle des commerces locaux",
      'copywriter':      "j'aide les commerces à améliorer leur communication écrite",
      'dev-web':         "je crée des sites web pour les commerces locaux",
      'consultant-seo':  "j'accompagne les commerces à dominer Google localement",
      'email-marketing': "je fidélise les clients des commerces par email",
      'pub-google':      "je gère les campagnes publicitaires Google pour les commerces",
    }
    const intro    = PROFILE_INTRO[profileId]    ?? "Je travaille avec des commerces locaux pour améliorer leur présence digitale et développer leur clientèle."
    const proof    = PROFILE_PROOF[profileId]    ?? "Les commerces locaux qui améliorent leur présence digitale voient leur fréquentation augmenter de 20% en moyenne."
    const activity = PROFILE_ACTIVITY[profileId] ?? "j'accompagne les commerces à développer leur présence digitale"

    let prompt = `Tu es un rédacteur expert en cold email B2B pour prestataires de services locaux.

MISSION : Rédiger un email de prospection pour "${businessName}"

─── DONNÉES CHIFFRÉES — UTILISATION OBLIGATOIRE ────────────────────────────
• Avis Google totaux          : ${totalReviews}
• Note moyenne                : ${avgRating}/5
• Avis négatifs sans réponse  : ${unanswered}
• Site web                    : ${leadData.website ? `Présent (${leadData.website})` : 'ABSENT'}
• Instagram                   : ${leadData.social?.instagram ? 'Présent' : 'Absent'}
• TikTok                      : ${leadData.social?.tiktok ? 'Présent' : 'Absent'}
────────────────────────────────────────────────────────────────────────────

─── ANALYSE IA — PROBLÈMES RÉELS IDENTIFIÉS ────────────────────────────────
${reportExcerpt}
────────────────────────────────────────────────────────────────────────────

STRUCTURE OBLIGATOIRE (dans cet ordre exact, aucune section ne peut être omise) :

OBJET : ${businessName} — une observation sur votre présence Google

CORPS :
Bonjour ${businessName},

[INTRODUCTION — 1 phrase, recopie telle quelle]
${intro}

[ACCROCHE — 1 phrase fixe, recopie telle quelle]
J'ai pris le temps d'analyser vos ${totalReviews} avis Google, et j'ai relevé des éléments concrets qui pourraient impacter votre activité.

[CONSTATS — 2 à 4 bullet points •, extraits EXCLUSIVEMENT de l'analyse ci-dessus]
Règles constats :
— Chaque bullet DOIT contenir un chiffre réel ET/OU une citation courte d'un avis réel (prénom, étoiles, date si disponible)
— Format : "• [problème chiffré ou cité] — [conséquence business en 1 phrase]"
— Si ${unanswered} > 0 : inclure obligatoirement "• ${unanswered} avis négatifs sans réponse — chaque silence est interprété comme une validation du problème par vos futurs clients."
— INTERDIT : inventer des citations, prénoms ou chiffres absents de l'analyse

[SOLUTION — 2 phrases, utiliser la formulation naturelle ci-dessous, ne JAMAIS écrire le nom technique du profil]
C'est exactement ce sur quoi j'interviens : ${activity}. [1 phrase sur le bénéfice concret lié aux problèmes identifiés ci-dessus.]

[PREUVE SOCIALE — 1 phrase, recopie telle quelle]
${proof}

[CTA — recopie telle quelle]
Auriez-vous 15 minutes cette semaine pour en discuter ?

[SIGNATURE]
[Votre prénom]
________________
[Votre numéro]

RÈGLES ABSOLUES :
— 150 à 250 mots selon la richesse des données — plus il y a de preuves concrètes, plus l'email peut être long
— Ton bienveillant, jamais accusateur — on aide, on ne juge pas
— Chaque phrase justifie sa présence, zéro remplissage
— PAS de markdown (**, ##, tirets de liste formatés)
— INTERDIT : "j'espère que ce message vous trouve bien", "votre réputation en ligne", "notre solution", "développer votre activité"
— INTERDIT : écrire le nom du profil technique (ex: "Chatbot", "SEO", "Photographe", "Dev Web") tel quel dans l'email — utiliser uniquement la formulation naturelle de la section SOLUTION

Retourne UNIQUEMENT un JSON valide (pas de texte avant ou après) :
{"subject":"${businessName} — une observation sur votre présence Google","body":"Corps complet de l'email avec sauts de ligne \\n"}`

    // ── Email spécialisé CHATBOT / DEV-CHATBOT → fonction dédiée ────────────────
    if (profileId === 'chatbot' || profileId === 'dev-chatbot') {
      const leadCity = leadData?.address?.split(',').pop()?.trim() || req.body.city || ''
      const chatbotReviewsData = {
        unanswered: unanswered ?? null,
        avgRating,
        keywords:   reviewsData?.keywords  ?? [],
        topQuotes:  reviewsData?.topQuotes ?? [],
        reviews:    reviewsData?.reviews   ?? [],
      }
      console.log(`[generate-email] Délégation CHATBOT → generateEmailChatbot`, {
        category:        req.body.category ?? 'n/a',
        rating:          leadData.rating ?? avgRating,
        reviewCount:     leadData.reviewCount ?? totalReviews,
        unanswered:      chatbotReviewsData.unanswered,
        keywords:        chatbotReviewsData.keywords.slice(0, 5),
        reviewsWithQ:    chatbotReviewsData.reviews.filter(r => (r.text ?? '').includes('?')).length,
        bookingPlatform: pagespeedData?.bookingPlatform ?? pagespeedData?.siteSignals?.bookingPlatform ?? null,
      })
      const emailResult = await generateEmailChatbot({
        leadData:      { name: businessName, city: leadCity, category: req.body.category ?? null, rating: leadData.rating ?? avgRating, reviewCount: leadData.reviewCount ?? totalReviews, website: leadData.website ?? null },
        pagespeedData: pagespeedData ?? null,
        reviewsData:   chatbotReviewsData,
      })
      return res.json(emailResult)
    }

    // ── Email spécialisé SEO / CONSULTANT-SEO → fonction dédiée ─────────────────
    if (profileId === 'seo' || profileId === 'consultant-seo') {
      console.log(`[generate-email] Délégation SEO → generateEmailSEO (rank:${localRank?.rank ?? 'n/a'} perf:${pagespeedData?.performance ?? 'n/a'})`)
      const leadCity = leadData?.address?.split(',').pop()?.trim() || req.body.city || ''
      const emailResult = await generateEmailSEO({
        leadData:      { name: businessName, city: leadCity, category: req.body.category ?? null, rating: leadData.rating ?? avgRating, reviewCount: leadData.reviewCount ?? totalReviews, website: leadData.website ?? null },
        pagespeedData: pagespeedData ?? null,
        localRank:     localRank    ?? null,
        reviewsData:   { unanswered, avgRating, keywords: reviewsData?.keywords ?? [], topQuotes: reviewsData?.topQuotes ?? [] },
        napData:       req.body.napData ?? null,
      })
      return res.json(emailResult)
    }

    // ── Email spécialisé PHOTOGRAPHE → fonction dédiée dans aiReviewAnalysis ───
    if (profileId === 'photographe') {
      console.log(`[generate-email] Délégation PHOTOGRAPHE → generateEmailPhotographe (score:${visualAnalysis?.score ?? 'n/a'})`)
      const leadCity = leadData?.address?.split(',').pop()?.trim() || req.body.city || ''
      console.log('[Email Photographe] leadData transmis:', JSON.stringify({
        name: businessName,
        city: leadCity,
        reviewCount: totalReviews,
        photoCount: googleData?.photoCount ?? null,
        rating: avgRating
      }))
      const emailResult = await generateEmailPhotographe({
        leadData:          { name: businessName, rating: avgRating, reviewCount: totalReviews, website: leadData.website ?? null, decisionMaker: req.body.decisionMaker ?? null, city: leadCity, category: req.body.category ?? null, competitorDelta: req.body.leadData?.competitorDelta ?? null },
        visualAnalysis:    visualAnalysis ?? null,
        googleData,
        siteAnalysis,
        reviewsData,
        facebookActivity:  facebookActivity  ?? null,
        instagramActivity: instagramActivity ?? null,
        photoQuality:      photoQuality      ?? null,
      })
      return res.json(emailResult)
    }

    // ── Email spécialisé SOCIAL-MEDIA → fonction dédiée ─────────────────────────
    if (profileId === 'social-media') {
      console.log(`[generate-email] Délégation SOCIAL-MEDIA → generateEmailSocialMedia`)
      const leadCity = leadData?.address?.split(',').pop()?.trim() || req.body.city || ''
      const emailResult = await generateEmailSocialMedia({
        leadData:           { name: businessName, city: leadCity, category: req.body.category ?? null, rating: leadData.rating ?? avgRating, reviewCount: leadData.reviewCount ?? totalReviews, website: leadData.website ?? null },
        socialPresence:     req.body.socialPresence  ?? leadData.social ?? null,
        socialMediaActivity:{ instagramActivity: instagramActivity ?? null, facebookActivity: facebookActivity ?? null },
        reviewsData:        { unanswered, avgRating, keywords: reviewsData?.keywords ?? [] },
      })
      return res.json(emailResult)
    }

    // ── Email spécialisé DESIGNER → fonction dédiée ──────────────────────────────
    if (profileId === 'designer') {
      console.log(`[generate-email] Délégation DESIGNER → generateEmailDesigner`)
      const leadCity = leadData?.address?.split(',').pop()?.trim() || req.body.city || ''
      const emailResult = await generateEmailDesigner({
        leadData:     { name: businessName, city: leadCity, category: req.body.category ?? null, rating: leadData.rating ?? avgRating, reviewCount: leadData.reviewCount ?? totalReviews },
        photoCount:   googleData?.photoCount ?? req.body.photoCount ?? 0,
        googleAudit:  req.body.leadData?.googleAudit ?? null,
        socialPresence: req.body.socialPresence ?? leadData.social ?? null,
        reviewsData:  { unanswered, avgRating, reviews: reviewsData?.reviews ?? [] },
      })
      return res.json(emailResult)
    }

    // ── Email spécialisé DEV-WEB → fonction dédiée ──────────────────────────────
    if (profileId === 'dev-web') {
      console.log(`[generate-email] Délégation DEV-WEB → generateEmailWebDev`)
      const leadCity2  = leadData?.address?.split(',').pop()?.trim() || req.body.city || ''
      const psData     = req.body.pagespeedData ?? null
      const emailResult = await generateEmailWebDev({
        leadData:      { name: businessName, city: leadCity2, category: req.body.category ?? null, rating: leadData.rating ?? avgRating, reviewCount: leadData.reviewCount ?? totalReviews },
        websiteUrl:    leadData.website ?? null,
        pagespeedData: psData,
        cms:           psData?.cms?.cms ?? null,
        hasHttps:      psData?.https ?? null,
        hasSitemap:    psData?.sitemap ?? null,
        reviewsData:   { unanswered, avgRating, reviews: reviewsData?.reviews ?? [] },
      })
      return res.json(emailResult)
    }

    // ── Email spécialisé EMAIL-MARKETING → fonction dédiée ───────────────────────
    if (profileId === 'email-marketing') {
      console.log(`[generate-email] Délégation EMAIL-MARKETING → generateEmailEmailMarketing`)
      const leadCity3    = leadData?.address?.split(',').pop()?.trim() || req.body.city || ''
      const socialData   = req.body.socialPresence ?? leadData.social ?? null
      const emailResult  = await generateEmailEmailMarketing({
        leadData:       { name: businessName, city: leadCity3, category: req.body.category ?? null, rating: leadData.rating ?? avgRating, reviewCount: leadData.reviewCount ?? totalReviews, website: leadData.website ?? null },
        reviewsData:    { unanswered, avgRating, topQuotes: reviewsData?.topQuotes ?? [] },
        hasNewsletter:  socialData?.newsletterDetection?.hasNewsletter ?? false,
        hasContactForm: socialData?.contactFormDetection?.hasContactForm ?? false,
        socialPresence: socialData,
        ownerReplyRatio: leadData.ownerReplyRatio ?? null,
      })
      return res.json(emailResult)
    }

    // ── Email spécialisé PUB-GOOGLE → fonction dédiée ───────────────────────────
    if (profileId === 'pub-google') {
      console.log(`[generate-email] Délégation PUB-GOOGLE → generateEmailGoogleAds`)
      const leadCity4 = leadData?.address?.split(',').pop()?.trim() || req.body.city || ''
      const psData4   = req.body.pagespeedData ?? null
      const negRatio4 = leadData?.reviewAnalysis?.negativeScore != null
        ? leadData.reviewAnalysis.negativeScore / 100
        : (req.body.reviewsData?.negative?.count ?? 0) / Math.max(totalReviews, 1)
      const domain4   = req.body.domain ?? req.body.leadData?.domain ?? null
      const readiness = googleAdsReadiness(
        leadData?.rating ?? avgRating,
        leadData?.reviewCount ?? totalReviews,
        leadData?.website ?? null,
        psData4,
        leadData?.googleAudit?.photoCount ?? req.body.photoCount ?? 0,
        leadData?.googleAudit?.hasDescription ?? false,
        leadData?.googleAudit?.hasHours ?? false,
        negRatio4,
      )
      const concurrence = getGoogleAdsConcurrence(domain4)
      const emailResult = await generateEmailGoogleAds({
        leadData:     { name: businessName, city: leadCity4, category: req.body.category ?? null, rating: leadData?.rating ?? avgRating, reviewCount: leadData?.reviewCount ?? totalReviews, website: leadData?.website ?? null },
        pagespeedData: psData4,
        reviewsData:   { unanswered, avgRating, reviews: reviewsData?.reviews ?? [] },
        googleAdsReadiness: readiness,
        concurrence,
      })
      return res.json(emailResult)
    }

    const MODEL = 'claude-sonnet-4-6'
    console.log(`[generate-email] → appel Anthropic (model: ${MODEL}, prompt: ${prompt.length} chars)`)

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    let message
    try {
      message = await anthropic.messages.create({
        model:      MODEL,
        max_tokens: 800,
        messages:   [{ role: 'user', content: prompt }],
      })
    } catch (apiErr) {
      console.error('[generate-email] ✗ Erreur Anthropic API:')
      console.error('  status :', apiErr.status)
      console.error('  name   :', apiErr.name)
      console.error('  message:', apiErr.message)
      console.error('  error  :', JSON.stringify(apiErr.error ?? null))
      throw new Error(`Anthropic API error (status ${apiErr.status ?? '?'}): ${apiErr.message}`)
    }

    console.log(`[generate-email] ✓ réponse reçue (tokens: ${message.usage?.output_tokens ?? '?'})`)
    const raw = message.content[0].text.trim()
    // Strip possible markdown code fences
    const jsonStr = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim()
    const parsed  = JSON.parse(jsonStr)

    res.json({ subject: parsed.subject, body: parsed.body })
  } catch (e) {
    next(e)
  }
})

// ─── POST /photo-quality — Analyse qualité photos Google via IA ──────────────
router.post('/photo-quality', async (req, res, next) => {
  try {
    const { photoUrls } = req.body
    if (!photoUrls || photoUrls.length === 0) {
      throw new AppError('photoUrls requis', 400)
    }
    const result = await analyzePhotoQuality(photoUrls)
    res.json(result)
  } catch (err) {
    next(err)
  }
})

// ─── GET /audit — PageSpeed + Facebook + Instagram (chargement à la demande) ──
router.get('/audit', async (req, res, next) => {
  try {
    const { website, facebook, instagram, placeId, profileId, category, city, businessName, address, phone } = req.query
    console.log('[PageSpeed] website reçu (query):', website ?? 'undefined')

    const SOCIAL_PROFILES   = ['photographe', 'social-media']
    const SEO_PROFILES      = ['seo', 'consultant-seo']
    const hasSocialUrls     = !!(facebook || instagram)

    // Retour anticipé uniquement si pas de site ET pas de réseaux utilisables
    // Pour social-media/photographe : on continue si facebook/instagram sont présents
    if ((!website || website.trim() === '') && !(SOCIAL_PROFILES.includes(profileId) && hasSocialUrls)) {
      return res.json({
        pagespeed: null,
        localRank: null,
        message: 'Pas de site web détecté pour ce lead',
      })
    }
    const CHATBOT_PROFILES  = ['chatbot', 'dev-chatbot']
    const WEBSITE_BLACKLIST = [
      'facebook.com', 'fb.com',
      'instagram.com', 'twitter.com', 'x.com',
      'linkedin.com', 'tiktok.com', 'youtube.com',
      'google.com', 'maps.google.com',
    ]
    const isBlacklisted = (url) => {
      if (!url) return false
      try {
        const hostname = new URL(url).hostname.replace(/^www\./, '')
        return WEBSITE_BLACKLIST.some(d => hostname === d || hostname.endsWith(`.${d}`))
      } catch { return false }
    }
    const websiteForAudit = isBlacklisted(website) ? null : (website || null)
    if (isBlacklisted(website)) console.log(`[Audit] website blacklisté, PageSpeed ignoré: ${website}`)

    const needsSocial   = SOCIAL_PROFILES.includes(profileId) || profileId === 'email-marketing'
    const needsRank     = SEO_PROFILES.includes(profileId) && placeId && category && city
    const needsNAP      = SEO_PROFILES.includes(profileId) && businessName && city
    const isChatbot     = CHATBOT_PROFILES.includes(profileId)

    const AUDIT_TIMEOUT = 30_000  // 30s par appel d'audit
    const [pagespeed, facebookActivity, instagramActivity, localRank, napData] = await Promise.all([
      withTimeout(isChatbot ? getSiteSignals(websiteForAudit, category ?? null) : getPageSpeed(websiteForAudit), AUDIT_TIMEOUT, null),
      withTimeout(needsSocial ? getFacebookActivity(facebook  || null) : Promise.resolve(null), AUDIT_TIMEOUT, null),
      withTimeout(needsSocial ? getInstagramActivity(instagram || null) : Promise.resolve(null), AUDIT_TIMEOUT, null),
      withTimeout(needsRank   ? getLocalRank(placeId, category, city)  : Promise.resolve(null), AUDIT_TIMEOUT, null),
      withTimeout(needsNAP    ? checkNAP(businessName, address || null, phone || null, city, placeId || null) : Promise.resolve(null), AUDIT_TIMEOUT, null),
    ])
    console.log('[PageSpeed] Résultat:', JSON.stringify(pagespeed))

    let photoUrls = []
    if (placeId) {
      try {
        const details = await getPlaceDetails(placeId)
        photoUrls = details?.photos ? getPhotoUrls(details.photos) : []
        console.log(`[Audit] photoUrls pour ${placeId}: ${photoUrls.length} photo(s)`)
      } catch (err) {
        console.warn('[Audit] getPlaceDetails error (ignoré):', err.message)
      }
    }

    res.json({ pagespeed, facebookActivity, instagramActivity, photoUrls, localRank, napData })
  } catch (e) {
    next(e)
  }
})

router.post('/instagram-deep', async (req, res, next) => {
  try {
    const { instagramUrl } = req.body
    if (!instagramUrl) throw new AppError('instagramUrl manquant', 400)
    const result = await getInstagramPosts(instagramUrl)
    res.json(result)
  } catch (e) {
    next(e)
  }
})

// ─── GET /facebook-stats — Facebook activity on-demand (slim, no pagespeed) ────
router.get('/facebook-stats', async (req, res, next) => {
  try {
    const { url } = req.query
    if (!url) throw new AppError('url requis', 400)
    const result = await getFacebookActivity(url)
    res.json(result)
  } catch (e) {
    next(e)
  }
})

// ─── GET /tiktok-stats — TikTok stats via HTML scraping (free, no Apify) ────────
router.get('/tiktok-stats', async (req, res, next) => {
  const axios   = require('axios')
  const cheerio = require('cheerio')
  try {
    const { url } = req.query
    if (!url) throw new AppError('url requis', 400)
    const cleanUrl = url.split('?')[0]
    console.log('[TikTokStats] Scraping:', cleanUrl)
    const { data: html } = await axios.get(cleanUrl, {
      timeout: 15000,
      headers: {
        'User-Agent':      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8',
        'Accept':          'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    })
    const $ = cheerio.load(html)
    // TikTok embeds stats in a <script id="__UNIVERSAL_DATA_FOR_REHYDRATION__"> tag
    const scriptContent = $('script#__UNIVERSAL_DATA_FOR_REHYDRATION__').html()
    if (!scriptContent) {
      console.warn('[TikTokStats] Script __UNIVERSAL_DATA_FOR_REHYDRATION__ introuvable')
      return res.json({ error: 'tiktok_unavailable' })
    }
    const json       = JSON.parse(scriptContent)
    const userInfo   = json?.['__DEFAULT_SCOPE__']?.['webapp.user-detail']?.userInfo
    const stats      = userInfo?.stats
    if (!stats) {
      console.warn('[TikTokStats] stats introuvables dans le JSON')
      return res.json({ error: 'tiktok_unavailable' })
    }
    const followers   = stats.followerCount  ?? null
    const videoCount  = stats.videoCount     ?? null
    const heartCount  = stats.heartCount     ?? stats.heart ?? null
    console.log(`[TikTokStats] followers:${followers} videos:${videoCount} hearts:${heartCount}`)
    res.json({ followers, videoCount, heartCount })
  } catch (e) {
    console.warn('[TikTokStats] Erreur:', e.message)
    res.json({ error: 'tiktok_unavailable' })
  }
})

// ─── GET /semrush — Données SEMrush via Apify (authority, trafic, keywords) ─────
router.get('/semrush', async (req, res, next) => {
  const { scrapeSemrushData } = require('../services/semrushService')
  try {
    const { domain } = req.query
    if (!domain) throw new AppError('domain requis', 400)
    if (!process.env.APIFY_API_TOKEN) throw new AppError('APIFY_API_TOKEN manquant', 503)
    const result = await scrapeSemrushData(domain)
    if (!result) throw new AppError('Aucune donnée SEMrush disponible pour ce domaine', 404)
    res.json(result)
  } catch (e) {
    next(e)
  }
})

// ─── POST /audit-prospect/:placeId — Audit IA prospect (JSON structuré) ───────
router.post('/audit-prospect/:placeId', async (req, res, next) => {
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new AppError('ANTHROPIC_API_KEY manquante', 503)
    }
    const { placeId } = req.params
    if (!validatePlaceId(placeId)) throw new AppError('placeId invalide', 400)

    // Fat payload — union de tous les champs nécessaires selon le profil
    const {
      profileId            = 'seo',
      // SEO / générique
      leadData             = {},
      pagespeedData        = null,
      localRank            = null,
      reviewsData          = null,
      napData              = null,
      facebookActivity     = null,
      instagramActivity    = null,
      // Photographe
      businessName         = leadData.name ?? 'ce commerce',
      websiteUrl           = leadData.website ?? null,
      googlePhotos         = [],
      photoCount           = 0,
      social               = {},
      googleRating         = leadData.rating ?? null,
      totalReviews         = leadData.userRatingsTotal ?? 0,
      // Chatbot
      chatbotDetection     = null,
      questionsAnalysis    = null,
      domainComplexity     = null,
      faqDetection         = null,
      contactFormDetection = null,
      // Social / Community Manager
      socialPresence       = null,
      socialMediaActivity  = null,
      domain               = null,
      city                 = null,
      instagramDeep        = null,
      // Designer
      googleAudit          = null,
      // Web Dev
      cms                  = null,
      hasHttps             = null,
      hasSitemap           = null,
      hasRobots            = null,
      domainAge            = null,
      indexedPages         = null,
      // Email Marketing
      ownerReplyRatio      = null,
      hasNewsletter        = null,
      hasContactForm       = null,
      loyaltyMentions      = 0,
      loyaltyTopics        = [],
      unansweredCount      = null,
      totalReviewsFull     = null,
      ownerReplyRatioFull  = null,
      visitFrequency       = null,
      businessStability    = null,
      canInvest            = false,
      aiReport             = null,
      // Google Ads
      hasDescription       = false,
      hasHours             = false,
      semrushData          = null,
    } = req.body

    console.log(`[audit-prospect] placeId:${placeId} | profileId:${profileId} | business:"${businessName}"`)

    let result
    switch (profileId) {
      case 'photographe': {
        const socialActivity = {
          hasInstagram: !!(social.instagram),
          hasFacebook:  !!(social.facebook),
          hasTiktok:    !!(social.tiktok),
          hasYoutube:   !!(social.youtube),
          hasPinterest: !!(social.pinterest),
        }
        result = await generateAuditPhotographe({ businessName, websiteUrl, googlePhotos, photoCount, socialActivity, reviewsData, googleRating, totalReviews })
        break
      }
      case 'chatbot':
      case 'dev-chatbot':
        result = await generateAuditChatbot({ businessName, websiteUrl, chatbotDetection, reviewsData, googleRating, totalReviews, questionsAnalysis, domainComplexity, faqDetection, contactFormDetection, pagespeedData })
        break
      case 'social-media':
        result = await generateAuditSocialMedia({ businessName, websiteUrl, socialPresence, socialMediaActivity, photoCount, reviewsData, googleRating, totalReviews, domain, city, instagramDeep })
        break
      case 'designer':
        result = await generateAuditDesigner({ businessName, websiteUrl, photoCount, googleAudit, socialPresence, reviewsData, googleRating, totalReviews, domain, pagespeedData })
        break
      case 'dev-web':
        result = await generateAuditWebDev({ businessName, websiteUrl, pagespeedData, cms, hasHttps, hasSitemap, hasRobots, domainAge, indexedPages, socialPresence, googleRating, totalReviews, domain })
        break
      case 'email-marketing':
        result = await generateAuditEmailMarketing({ businessName, websiteUrl, totalReviews, googleRating, ownerReplyRatio, hasNewsletter, hasContactForm, socialPresence, domain, pagespeedData, loyaltyMentions, loyaltyTopics, unansweredCount, totalReviewsFull, ownerReplyRatioFull, visitFrequency, businessStability, canInvest, aiReport, facebookActivity, instagramActivity })
        break
      case 'pub-google':
        result = await generateAuditGoogleAds({ businessName, websiteUrl, googleRating, totalReviews, pagespeedData, photoCount, hasDescription, hasHours, socialPresence, domain, semrushData, facebookActivity, instagramActivity, localRank })
        break
      case 'copywriter':
        console.warn('[audit-prospect] copywriter → fallback SEO en attendant generateAuditCopywriter')
        result = await generateAuditSEO({ leadData, pagespeedData, localRank, reviewsData, napData, facebookActivity, instagramActivity })
        break
      case 'seo':
      case 'consultant-seo':
      default:
        result = await generateAuditSEO({ leadData, pagespeedData, localRank, reviewsData, napData, facebookActivity, instagramActivity })
        break
    }

    res.json(result)
  } catch (e) {
    next(e)
  }
})

// ─── POST /audit-photo/:placeId — Audit IA prospect profil Photographe ───────
router.post('/audit-photo/:placeId', async (req, res, next) => {
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new AppError('ANTHROPIC_API_KEY manquante', 503)
    }
    const { placeId } = req.params
    if (!validatePlaceId(placeId)) throw new AppError('placeId invalide', 400)

    const {
      businessName  = 'ce commerce',
      websiteUrl    = null,
      googlePhotos  = [],
      photoCount    = 0,
      social        = {},   // { linkedin, facebook, instagram, tiktok }
      reviewsData   = null,
      googleRating  = null,
      totalReviews  = null,
    } = req.body

    // Construire socialActivity depuis le champ lead.social standard
    const socialActivity = {
      hasInstagram: !!(social.instagram),
      hasFacebook:  !!(social.facebook),
      hasTiktok:    !!(social.tiktok),
      hasYoutube:   !!(social.youtube),
      hasPinterest: !!(social.pinterest),
    }

    console.log(`[audit-photo] placeId:${placeId} | business:"${businessName}" | photos:${photoCount} | ig:${socialActivity.hasInstagram} | tt:${socialActivity.hasTiktok}`)

    const result = await generateAuditPhotographe({
      businessName,
      websiteUrl,
      googlePhotos,
      photoCount,
      socialActivity,
      reviewsData,
      googleRating,
      totalReviews,
    })
    res.json(result)
  } catch (e) {
    next(e)
  }
})

// ─── POST /audit-chatbot/:placeId — Audit IA prospect profil Chatbot ─────────
router.post('/audit-chatbot/:placeId', async (req, res, next) => {
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new AppError('ANTHROPIC_API_KEY manquante', 503)
    }
    const { placeId } = req.params
    if (!validatePlaceId(placeId)) throw new AppError('placeId invalide', 400)

    const {
      businessName         = 'ce commerce',
      websiteUrl           = null,
      chatbotDetection     = null,
      reviewsData          = null,
      googleRating         = null,
      totalReviews         = null,
      questionsAnalysis    = null,
      domainComplexity     = null,
      faqDetection         = null,
      contactFormDetection = null,
      pagespeedData        = null,
    } = req.body

    console.log(`[audit-chatbot] placeId:${placeId} | business:"${businessName}" | hasChatbot:${chatbotDetection?.hasChatbot ?? false} | questions:${questionsAnalysis?.totalQuestions ?? 0}`)

    const result = await generateAuditChatbot({
      businessName,
      websiteUrl,
      chatbotDetection,
      reviewsData,
      googleRating,
      totalReviews,
      questionsAnalysis,
      domainComplexity,
      faqDetection,
      contactFormDetection,
      pagespeedData,
    })
    res.json(result)
  } catch (e) {
    next(e)
  }
})

// ─── POST /audit-social/:placeId — Audit Community Manager IA ────────────────
router.post('/audit-social/:placeId', async (req, res, next) => {
  try {
    if (!process.env.ANTHROPIC_API_KEY) throw new AppError('ANTHROPIC_API_KEY manquante', 503)
    const { placeId } = req.params
    if (!validatePlaceId(placeId)) throw new AppError('placeId invalide', 400)
    const {
      businessName        = 'ce commerce',
      websiteUrl          = null,
      socialPresence      = null,
      socialMediaActivity = null,
      photoCount          = 0,
      reviewsData         = null,
      googleRating        = null,
      totalReviews        = 0,
      domain              = null,
      city                = null,
      instagramDeep       = null,
    } = req.body
    console.log(`[audit-social] placeId:${placeId} | business:"${businessName}" | present:${Object.keys(socialPresence ?? {}).filter(k => (socialPresence ?? {})[k]).join(',')} | city:${city ?? '—'}`)
    const result = await generateAuditSocialMedia({ businessName, websiteUrl, socialPresence, socialMediaActivity, photoCount, reviewsData, googleRating, totalReviews, domain, city, instagramDeep })
    res.json(result)
  } catch (e) {
    next(e)
  }
})

// ─── POST /audit-designer/:placeId — Audit Branding & Design IA ──────────────
router.post('/audit-designer/:placeId', async (req, res, next) => {
  try {
    if (!process.env.ANTHROPIC_API_KEY) throw new AppError('ANTHROPIC_API_KEY manquante', 503)
    const { placeId } = req.params
    if (!validatePlaceId(placeId)) throw new AppError('placeId invalide', 400)
    const {
      businessName  = 'ce commerce',
      websiteUrl    = null,
      photoCount    = 0,
      googleAudit   = null,
      socialPresence = null,
      reviewsData   = null,
      googleRating  = null,
      totalReviews  = 0,
      domain        = null,
      pagespeedData = null,
    } = req.body
    console.log(`[audit-designer] placeId:${placeId} | business:"${businessName}" | photos:${photoCount} | site:${websiteUrl ?? 'absent'}`)
    const result = await generateAuditDesigner({ businessName, websiteUrl, photoCount, googleAudit, socialPresence, reviewsData, googleRating, totalReviews, domain, pagespeedData })
    res.json(result)
  } catch (e) {
    next(e)
  }
})

// ─── POST /audit-webdev/:placeId — Audit Technique Web IA ──────────────────────
router.post('/audit-webdev/:placeId', async (req, res, next) => {
  try {
    if (!process.env.ANTHROPIC_API_KEY) throw new AppError('ANTHROPIC_API_KEY manquante', 503)
    const { placeId } = req.params
    const {
      businessName   = '',
      websiteUrl     = null,
      pagespeedData  = null,
      cms            = null,
      hasHttps       = null,
      hasSitemap     = null,
      hasRobots      = null,
      domainAge      = null,
      indexedPages   = null,
      socialPresence = null,
      googleRating   = null,
      totalReviews   = 0,
      domain         = null,
    } = req.body
    console.log(`[audit-webdev] placeId:${placeId} | business:"${businessName}" | site:${websiteUrl ?? 'absent'}`)
    const result = await generateAuditWebDev({ businessName, websiteUrl, pagespeedData, cms, hasHttps, hasSitemap, hasRobots, domainAge, indexedPages, socialPresence, googleRating, totalReviews, domain })
    res.json(result)
  } catch (e) {
    next(e)
  }
})

// ─── POST /audit-email/:placeId — Audit Email Marketing IA ───────────────────
router.post('/audit-email/:placeId', async (req, res, next) => {
  try {
    if (!process.env.ANTHROPIC_API_KEY) throw new AppError('ANTHROPIC_API_KEY manquante', 503)
    const { placeId } = req.params
    if (!validatePlaceId(placeId)) throw new AppError('placeId invalide', 400)
    const {
      businessName         = '',
      websiteUrl           = null,
      totalReviews         = 0,
      googleRating         = null,
      ownerReplyRatio      = null,
      hasNewsletter        = null,
      hasContactForm       = null,
      socialPresence       = null,
      domain               = null,
      pagespeedData        = null,
      // Enriched signals
      loyaltyMentions      = 0,
      loyaltyTopics        = [],
      unansweredCount      = null,
      totalReviewsFull     = null,
      ownerReplyRatioFull  = null,
      visitFrequency       = null,
      businessStability    = null,
      canInvest            = false,
      aiReport             = null,
      facebookActivity     = null,
      instagramActivity    = null,
    } = req.body
    console.log(`[audit-email] placeId:${placeId} | business:"${businessName}" | newsletter:${hasNewsletter} | reviews:${totalReviews} | fullReviews:${totalReviewsFull ?? '—'} | loyalty:${loyaltyMentions} | stability:${businessStability ?? '—'} | aiReport:${aiReport ? 'oui' : 'non'}`)
    const result = await generateAuditEmailMarketing({
      businessName, websiteUrl, totalReviews, googleRating,
      ownerReplyRatio, hasNewsletter, hasContactForm,
      socialPresence, domain, pagespeedData,
      loyaltyMentions, loyaltyTopics,
      unansweredCount, totalReviewsFull, ownerReplyRatioFull,
      visitFrequency, businessStability, canInvest,
      aiReport, facebookActivity, instagramActivity,
    })
    res.json(result)
  } catch (e) {
    next(e)
  }
})

// ─── POST /audit-ads/:placeId — Audit Google Ads IA ────────────────────────────
router.post('/audit-ads/:placeId', async (req, res, next) => {
  try {
    if (!process.env.ANTHROPIC_API_KEY) throw new AppError('ANTHROPIC_API_KEY manquante', 503)
    const { placeId } = req.params
    if (!validatePlaceId(placeId)) throw new AppError('placeId invalide', 400)
    const {
      businessName  = '',
      websiteUrl    = null,
      googleRating  = null,
      totalReviews  = 0,
      pagespeedData = null,
      photoCount    = 0,
      hasDescription = false,
      hasHours      = false,
      socialPresence = null,
      domain        = null,
      reviewsData   = null,
      city          = null,
    } = req.body
    console.log(`[audit-ads] placeId:${placeId} | business:"${businessName}" | site:${websiteUrl ?? 'absent'} | rating:${googleRating ?? '—'} | perf:${pagespeedData?.performance ?? '—'}`)
    const result = await generateAuditGoogleAds({ businessName, websiteUrl, googleRating, totalReviews, pagespeedData, photoCount, hasDescription, hasHours, socialPresence, domain, reviewsData, city })
    res.json(result)
  } catch (e) {
    next(e)
  }
})

// ─── POST /unlock/:placeId ────────────────────────────────────────────────────
router.post('/unlock/:placeId', async (req, res, next) => {
  try {
    // TODO: [CREDITS] Déduire 1 crédit via Supabase avant enrichissement
    // TODO: [CREDITS] Requiert: supabase.from('credits').decrement({ user_id })

    const { placeId } = req.params;
    if (!validatePlaceId(placeId)) throw new AppError('placeId invalide', 400)
    const {
      profileId = null,
      weights   = null,
      lat       = null,
      lng       = null,
      domain    = null,
      keywords  = [],
      city      = '',
      name      = '',
      vicinity  = '',
      rating    = null,
      user_ratings_total = null,
      price_level        = null,
      photoCount         = 0,
    } = req.body;

    if (!placeId) throw new AppError('placeId requis', 400);

    const cacheKey = `unlock_${placeId}_${profileId || 'default'}`;
    const cached   = unlockCache.get(cacheKey);
    if (cached) return res.json(cached);

    const ENRICH_TIMEOUT = 30_000;

    // Détails complets (phone, website, reviews, opening_hours)
    const details    = await getPlaceDetails(placeId);
    const websiteUrl = cleanWebsiteUrl(details.website);

    const [socialPresence, pappersData, descResult] = await Promise.all([
      withTimeout(
        enrichSocial({ name, website: websiteUrl, address: vicinity, placeId }),
        ENRICH_TIMEOUT,
        { linkedin: null, facebook: null, instagram: null, tiktok: null, hasChatbot: false }
      ),
      withTimeout(searchPappers(name, city), ENRICH_TIMEOUT, null),
      withTimeout(scrapeDescription(websiteUrl, details.editorial_summary), ENRICH_TIMEOUT,
        { hasDescription: false, descriptionText: null, descriptionSource: null }),
    ]);

    const totalRatings   = details.user_ratings_total ?? user_ratings_total ?? 0;
    const repliedCount   = (details.reviews ?? []).filter(r => r.author_reply).length;
    const isActiveOwner  = totalRatings >= 5 && repliedCount >= 3;
    const ownerReplyRatio = totalRatings > 0 ? repliedCount / Math.min(totalRatings, 5) : 0;

    const fullPlace = {
      place_id:           placeId,
      name,
      vicinity,
      lat,
      lng,
      rating:             details.rating             ?? rating             ?? null,
      user_ratings_total: details.user_ratings_total ?? user_ratings_total ?? null,
      price_level:        details.price_level        ?? price_level        ?? null,
      photoCount:         details.photos?.length     ?? photoCount,
      phone:              details.formatted_phone_number ?? null,
      website:            websiteUrl,
      opening_hours:      details.opening_hours      ?? null,
      reviews:            details.reviews            ?? [],
      hasDescription:     descResult.hasDescription,
      descriptionText:    descResult.descriptionText,
      descriptionSource:  descResult.descriptionSource,
      hasHours:           !!(details.opening_hours),
      isActiveOwner,
      ownerReplyRatio,
    };

    const lead = buildLead(fullPlace, {
      lat: lat ?? fullPlace.lat,
      lng: lng ?? fullPlace.lng,
      domain, keywords, socialPresence, pappersData, weights, profileId,
    });
    lead.locked = false;

    // faqDetection et contactFormDetection sont réservés à l'audit "Analyser le site"
    // (GET /audit → getSiteSignals) — ne pas les exposer au unlock pour éviter
    // un affichage prématuré côté frontend avant que l'utilisateur ait lancé l'analyse
    delete lead.faqDetection
    delete lead.contactFormDetection
    if (lead.chatbotDetection) {
      delete lead.chatbotDetection.faqDetection
      delete lead.chatbotDetection.contactFormDetection
    }

    const TTL_7D = 7 * 24 * 60 * 60 * 1000;
    unlockCache.set(cacheKey, lead, TTL_7D);

    console.log(`[Unlock] ${name} (${placeId}) déverrouillé`);
    res.json(lead);
  } catch (e) {
    next(e);
  }
});

router.post('/network-visual', async (req, res, next) => {
  try {
    const { networkUrl, network } = req.body
    if (!networkUrl || !network) throw new AppError('networkUrl et network requis', 400)
    const VALID = ['instagram', 'facebook', 'tiktok', 'pinterest', 'youtube']
    if (!VALID.includes(network)) throw new AppError(`Réseau invalide : ${network}`, 400)
    const result = await analyzeNetworkPhotos(networkUrl, network)
    res.json(result)
  } catch (e) {
    next(e)
  }
})

module.exports = router;
