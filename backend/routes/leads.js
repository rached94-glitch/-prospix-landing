const express        = require('express');
const router         = express.Router();
const { searchPlaces, getPlaceDetails, getPhotoUrls, getLocalRank } = require('../services/googlePlaces');
const { analyzePhotoQuality } = require('../services/photoQualityService');
const { enrichSocial }   = require('../services/socialEnrichment');
const { calculateScore }  = require('../services/scoring');
const { analyzeReviews }  = require('../services/reviewAnalysis');
const { getAllReviews }      = require('../services/apifyReviews');
const { analyzeWithAI, generateEmailPhotographe, generateEmailSEO, generateEmailChatbot } = require('../services/aiReviewAnalysis');
const { findDecisionMaker } = require('../services/linkedinScraper');
const { searchPappers }     = require('../services/pappersService');
const { getPageSpeed, checkNAP, getSiteSignals } = require('../services/pagespeedService');
const { getFacebookActivity, getInstagramActivity, getInstagramPosts } = require('../services/socialMediaService')
const { analyzeNetworkPhotos } = require('../services/visualSocialService');
const benchmarkService = require('../services/benchmarkService');

const SOCIAL_SOURCES = ['linkedin', 'facebook', 'instagram', 'tiktok'];

// ─── Helpers ─────────────────────────────────────────────────────────────────
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
  const placeData      = { ...place, openNow };
  const reviewAnalysis = analyzeReviews(place.reviews || []);

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
      linkedin:       socialPresence.linkedin,
      facebook:       socialPresence.facebook,
      instagram:      socialPresence.instagram,
      tiktok:         socialPresence.tiktok,
      googleBusiness: `https://maps.google.com/?cid=${place.place_id}`,
    },
    googleAudit,
    chatbotDetection: socialPresence.chatbotDetection ?? null,
    pappers:          pappersData ?? null,
    score: { total: score.total, breakdown: score.breakdown },
    reviewAnalysis,
    status:  'new',
    domain:  domain || null,
    keyword: keywords?.[0] || null,
    newBusinessBadge: score.newBusinessBadge ?? null,
    isActiveOwner:    place.isActiveOwner ?? false,
    ownerReplyRatio:  place.ownerReplyRatio ?? 0,
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

async function processPlaces(places, { lat, lng, domain, keywords, sources, city, onProgress, weights, profileId }) {
  const useSocial = sources.some(s => SOCIAL_SOURCES.includes(s));

  if (onProgress) onProgress({ type: 'progress', message: 'Scoring...' });

  const leads = await Promise.all(
    places.map(async place => {
      const [socialPresence, pappersData] = await Promise.all([
        useSocial
          ? enrichSocial({ name: place.name, website: place.website, address: place.vicinity, placeId: place.place_id })
          : Promise.resolve({ linkedin: null, facebook: null, instagram: null, tiktok: null, hasChatbot: false }),
        searchPappers(place.name, city || ''),
      ]);

      return buildLead(place, { lat, lng, domain, keywords, socialPresence, pappersData, weights, profileId });
    })
  );

  leads.sort((a, b) => b.score.total - a.score.total);
  return leads;
}

// ─── POST /search/stream (SSE) ────────────────────────────────────────────────
router.post('/search/stream', async (req, res) => {
  res.setHeader('Content-Type',  'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection',    'keep-alive');
  res.flushHeaders();

  const send = data => res.write(`data: ${JSON.stringify(data)}\n\n`);

  try {
    const { city, lat, lng, radius, domain, keywords = [], sources = [], weights = null, profileId = null } = req.body;

    if (!lat || !lng) { send({ type: 'error', message: 'lat/lng manquants' }); return res.end(); }

    const { places, fromCache } = await searchPlaces({
      lat, lng, radius, keywords, domain,
      onProgress: send,
    });

    const leads = await processPlaces(places, {
      lat, lng, domain, keywords, sources, city,
      onProgress: send,
      weights,
      profileId,
    });

    applyPostProcessing(leads, { city, domain })

    send({
      type: 'done',
      leads,
      total: leads.length,
      fromCache,
      searchParams: { city, lat, lng, radius, domain, keywords, sources },
    });
  } catch (err) {
    console.error('Stream search error:', err.message);
    send({ type: 'error', message: err.message });
  }

  res.end();
});

// ─── POST /search (classique, rétrocompatibilité) ─────────────────────────────
router.post('/search', async (req, res) => {
  try {
    const { city, lat, lng, radius, domain, keywords = [], sources = [], weights = null, profileId = null } = req.body;

    if (!lat || !lng)    return res.status(400).json({ error: 'lat/lng manquants' });
    if (radius == null)  return res.status(400).json({ error: 'radius manquant' });

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
    console.error('POST /search error:', err.message);
    res.status(500).json({ error: 'Internal server error', details: err.message });
  }
});

// ─── POST /decision-maker — LinkedIn scraping ─────────────────────────────────
router.post('/decision-maker', async (req, res) => {
  try {
    const { businessName, city, website } = req.body
    if (!businessName) return res.status(400).json({ error: 'businessName requis' })
    const decisionMaker = await findDecisionMaker(businessName, city || '', website || null)
    res.json({ decisionMaker })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ─── POST /reviews/:placeId — Récupération Apify ─────────────────────────────
router.post('/reviews/:placeId', async (req, res) => {
  try {
    const { placeId } = req.params
    const reviews = await getAllReviews(placeId)
    res.json({
      reviews,
      total:      reviews.length,
      unanswered: reviews.filter(r => !r.ownerReply).length,
    })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ─── POST /pappers — Enrichissement financier Pappers.fr ─────────────────────
router.post('/pappers', async (req, res) => {
  try {
    const { businessName, city, siret } = req.body
    if (!businessName) return res.status(400).json({ error: 'businessName requis' })
    const data = await searchPappers(businessName, city || '', siret || '')
    res.json({ pappers: data })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ─── POST /analyze/:placeId — Analyse IA Claude ───────────────────────────────
router.post('/analyze/:placeId', async (req, res) => {
  try {
    const { placeId } = req.params
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
      return res.status(400).json({ error: 'Aucun avis fourni. Chargez les avis d\'abord.' })
    }

    const result = await analyzeWithAI(reviews, businessName, profileId, { websiteUrl, city, rating, reviewCount, category: category || 'ce secteur' }, auditData)
    res.json(result)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ─── POST /generate-email — Email personnalisé basé sur l'analyse IA ──────────
router.post('/generate-email', async (req, res) => {
  const Anthropic = require('@anthropic-ai/sdk')

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(503).json({ error: 'ANTHROPIC_API_KEY manquante — la génération d\'email IA est indisponible' })
  }

  try {
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
      return res.status(400).json({ error: 'aiAnalysis.report est requis pour générer un email personnalisé' })
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
      console.log(`[generate-email] Délégation CHATBOT → generateEmailChatbot (category:${req.body.category ?? 'n/a'})`)
      const leadCity = leadData?.address?.split(',').pop()?.trim() || req.body.city || ''
      const emailResult = await generateEmailChatbot({
        leadData:      { name: businessName, city: leadCity, category: req.body.category ?? null, rating: leadData.rating ?? avgRating, reviewCount: leadData.reviewCount ?? totalReviews, website: leadData.website ?? null },
        pagespeedData: pagespeedData ?? null,
        reviewsData:   { unanswered, avgRating, keywords: reviewsData?.keywords ?? [], topQuotes: reviewsData?.topQuotes ?? [] },
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
    console.error('[generate-email] erreur finale:', e.message)
    res.status(500).json({ error: e.message })
  }
})

// ─── POST /photo-quality — Analyse qualité photos Google via IA ──────────────
router.post('/photo-quality', async (req, res) => {
  try {
    const { photoUrls } = req.body
    if (!photoUrls || photoUrls.length === 0) {
      return res.status(400).json({ error: 'photoUrls requis' })
    }
    const result = await analyzePhotoQuality(photoUrls)
    res.json(result)
  } catch (err) {
    console.error('[photo-quality]', err.message)
    res.status(500).json({ error: err.message })
  }
})

// ─── GET /audit — PageSpeed + Facebook + Instagram (chargement à la demande) ──
router.get('/audit', async (req, res) => {
  try {
    const { website, facebook, instagram, placeId, profileId, category, city, businessName, address, phone } = req.query
    console.log('[PageSpeed] website reçu (query):', website ?? 'undefined')

    if (!website || website.trim() === '') {
      return res.json({
        pagespeed: null,
        localRank: null,
        message: 'Pas de site web détecté pour ce lead',
      })
    }

    const SOCIAL_PROFILES   = ['photographe', 'social-media']
    const SEO_PROFILES      = ['seo', 'consultant-seo']
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

    const needsSocial   = SOCIAL_PROFILES.includes(profileId)
    const needsRank     = SEO_PROFILES.includes(profileId) && placeId && category && city
    const needsNAP      = SEO_PROFILES.includes(profileId) && businessName && city
    const isChatbot     = CHATBOT_PROFILES.includes(profileId)

    const [pagespeed, facebookActivity, instagramActivity, localRank, napData] = await Promise.all([
      isChatbot ? getSiteSignals(websiteForAudit, category ?? null) : getPageSpeed(websiteForAudit),
      needsSocial ? getFacebookActivity(facebook  || null) : Promise.resolve(null),
      needsSocial ? getInstagramActivity(instagram || null) : Promise.resolve(null),
      needsRank   ? getLocalRank(placeId, category, city)  : Promise.resolve(null),
      needsNAP    ? checkNAP(businessName, address || null, phone || null, city, placeId || null) : Promise.resolve(null),
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
    res.status(500).json({ error: e.message })
  }
})

router.post('/instagram-deep', async (req, res) => {
  try {
    const { instagramUrl } = req.body
    if (!instagramUrl) return res.status(400).json({ error: 'instagramUrl manquant' })
    const result = await getInstagramPosts(instagramUrl)
    res.json(result)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ─── GET /facebook-stats — Facebook activity on-demand (slim, no pagespeed) ────
router.get('/facebook-stats', async (req, res) => {
  try {
    const { url } = req.query
    if (!url) return res.status(400).json({ error: 'url requis' })
    const result = await getFacebookActivity(url)
    res.json(result)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ─── GET /tiktok-stats — TikTok stats via HTML scraping (free, no Apify) ────────
router.get('/tiktok-stats', async (req, res) => {
  const axios   = require('axios')
  const cheerio = require('cheerio')
  try {
    const { url } = req.query
    if (!url) return res.status(400).json({ error: 'url requis' })
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

router.post('/network-visual', async (req, res) => {
  try {
    const { networkUrl, network } = req.body
    if (!networkUrl || !network) return res.status(400).json({ error: 'networkUrl et network requis' })
    const VALID = ['instagram', 'facebook', 'tiktok', 'pinterest', 'youtube']
    if (!VALID.includes(network)) return res.status(400).json({ error: `Réseau invalide : ${network}` })
    const result = await analyzeNetworkPhotos(networkUrl, network)
    res.json(result)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

module.exports = router;
