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
  if (!social || typeof social !== 'object') social = {}
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
  if (!social || typeof social !== 'object') social = {}
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

// ── Opportunité vidéaste → score /100 ────────────────────────────────────────
function videographerOpportunityScore(placeData, social) {
  if (!social || typeof social !== 'object') social = {}
  let score = 0

  // Absence de chaînes vidéo = opportunité forte
  if (!social.youtube)       score += 25
  if (!social.tiktok)        score += 15

  // Vidéo sur le site
  if (!social.videoOnSite)               score += 20
  else if ((social.videoCount ?? 0) < 3) score += 10  // a commencé mais peu

  // Portfolio / galerie
  if (!social.hasPortfolio) score += 10
  else                      score -= 10  // déjà équipé → moins d'opportunité

  // Peu de photos = contenu visuel insuffisant
  if ((placeData.photoCount ?? 0) < 10) score += 5

  // Pas d'Instagram dans un secteur visuel
  if (!social.instagram) score += 5

  return Math.max(10, Math.min(100, score))
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
    if (sig.hasRecurringQuestions)                  score += 20
    if ((sig.unansweredCount ?? 0) >= 3)            score += 15
    if (sig.isMultilingual)                         score += 10
    if (sig.hasOverwhelmKeywords)                   score += 20
    if ((sig.questionCount ?? 0) >= 3)              score += 15  // reviews with questions
    if ((sig.questionRatio ?? 0) >= 20)             score += 10  // high question ratio
    if (sig.hasFAQ)                                 score -= 20  // already has FAQ → less need
    if (sig.hasContactForm)                         score -= 10  // already has contact channel
    if (sig.domainComplexity === 'complex')         score += 15
    else if (sig.domainComplexity === 'medium')     score += 5
    if (sig.phoneCallMentions?.hasDifficulty)       score += 15  // hard to reach by phone
    if (sig.offHoursActivity?.hasOffHoursNeed)      score += 10  // off-hours demand
    if (sig.languageDetection?.isMultilingual)      score += 5   // multilingual audience
  }

  return Math.max(10, Math.min(100, score))
}

// ── Type de chatbot recommandé ────────────────────────────────────────────────
function getRecommendedRAGType(domainComplexity, hasBooking, hasFAQ, questionTopics, totalReviews) {
  if (hasBooking) return { type: 'booking_assistant', label: 'Assistant réservation et questions fréquentes', color: '#a78bfa' }
  if (domainComplexity === 'complex') return { type: 'rag_advanced', label: 'Assistant IA complet avec base de connaissances', color: '#22c55e' }
  if (domainComplexity === 'medium') return { type: 'rag_medium', label: 'Assistant conversationnel personnalisé', color: '#f59e0b' }
  if (hasFAQ && (totalReviews ?? 0) > 50) return { type: 'faq_dynamic', label: 'Assistant FAQ automatique enrichi', color: '#EDFA36' }
  return { type: 'faq_simple', label: 'Assistant FAQ automatique', color: '#64748b' }
}

// ── Conversations mensuelles estimées ─────────────────────────────────────────
function estimateMonthlyConversations(totalReviews, questionsCount, hasContactForm) {
  // ~5% des visiteurs mensuels (estimés à 10× les avis) posent une question
  const base = Math.round((totalReviews ?? 0) * 10 * 0.05)
  let estimate = base
  if ((questionsCount ?? 0) > 5)  estimate += 20
  if (hasContactForm)              estimate += 15
  return Math.max(10, estimate)
}

// ── Stack technologique recommandée ──────────────────────────────────────────
function getRecommendedStack(cms, domainComplexity, isMultilingual) {
  const cmsName = (cms ?? '').toLowerCase()
  if (domainComplexity === 'complex') {
    return isMultilingual
      ? 'Solution chat autonome + serveur IA dédié (multi-langue)'
      : 'Widget JS standalone + backend cloud IA'
  }
  if (cmsName === 'wordpress') return 'Plugin chat natif CMS + IA conversationnelle'
  if (cmsName === 'wix' || cmsName === 'shopify') return 'Chat intégré boutique en ligne + backend IA'
  if (domainComplexity === 'medium') return 'Widget chat intégré au site + scénarios automatisés'
  if (isMultilingual)                return 'Widget chat multilingue + réponses automatisées'
  return 'Widget chat intégré au site + scénarios automatisés'
}

// ── Score de régularité sociale ───────────────────────────────────────────────
function socialRegularityScore(socialPresence, socialMediaActivity, photoCount) {
  const NETWORK_KEYS = ['facebook', 'instagram', 'linkedin', 'tiktok', 'youtube', 'pinterest']
  const networks = NETWORK_KEYS.filter(n => !!(socialPresence?.[n])).length
  const BASE = [0, 15, 30, 50, 70, 85, 100]
  let score = BASE[Math.min(networks, 6)]

  const igFollowers = socialMediaActivity?.instagramActivity?.followers ?? null
  const igDaysAgo   = socialMediaActivity?.instagramActivity?.daysAgo   ?? null
  const fbDaysAgo   = socialMediaActivity?.facebookActivity?.daysAgo    ?? null
  const lastPost    = igDaysAgo !== null && fbDaysAgo !== null ? Math.min(igDaysAgo, fbDaysAgo)
                    : igDaysAgo !== null ? igDaysAgo : fbDaysAgo

  if (igFollowers !== null && igFollowers > 1000) score += 10
  if (lastPost !== null && lastPost < 7)          score += 15
  if ((photoCount ?? 0) > 15)                     score += 10
  if (lastPost !== null && lastPost > 30)          score -= 15

  score = Math.max(0, Math.min(100, score))
  const label = score >= 80 ? 'Très actif'
              : score >= 60 ? 'Actif'
              : score >= 40 ? 'En développement'
              : score >= 20 ? 'Faible'
              : 'Inexistant'
  return { score, label }
}

// ── Recommandation sociale par secteur ────────────────────────────────────────
function getSocialRecommendation(domain, socialPresence, photoCount, socialMediaActivity) {
  const raw = ((domain ?? '') + '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  const hasIG = !!(socialPresence?.instagram)
  const hasFB = !!(socialPresence?.facebook)
  const hasLI = !!(socialPresence?.linkedin)
  const igDays = socialMediaActivity?.instagramActivity?.daysAgo ?? null
  const fbDays = socialMediaActivity?.facebookActivity?.daysAgo  ?? null
  const isInactive = (igDays !== null && igDays > 30) || (fbDays !== null && fbDays > 30)

  const isRestaurant = /restaurant|cafe|brasserie|pizz|burger|traiteur|bistrot|bar/.test(raw)
  const isBeauty     = /coiffure|salon|spa|beaute|barbier|esthetique|onglerie/.test(raw)
  const isB2B        = /avocat|notaire|comptable|assurance|cabinet|immo|consulting|finance/.test(raw)
  const isRetail     = /boutique|commerce|magasin|retail|mode|vetement|fleuriste/.test(raw)
  const isHealth     = /medecin|docteur|kine|psy|sante|pharmacie|dentiste|clinique/.test(raw)

  if (isRestaurant) {
    if (!hasIG) return { priority: 'Créer et animer un compte photo + vidéos courtes', actions: ['Créer un compte dédié à la cuisine et à l\'ambiance', 'Publier 3x/semaine (plats, équipe, coulisses)', 'Lancer des vidéos courtes de 15-30 sec'], estimatedPrice: '300-600€/mois' }
    if (isInactive) return { priority: 'Relancer la publication régulière', actions: ['Reprendre une cadence 3x/semaine', 'Mettre en avant les plats du jour et événements', 'Répondre aux commentaires'], estimatedPrice: '200-400€/mois' }
    return { priority: 'Développer les vidéos courtes et les stories', actions: ['Créer du contenu vidéo (reels, stories)', 'Mettre en avant les coulisses', 'Interagir avec la communauté locale'], estimatedPrice: '250-500€/mois' }
  }
  if (isBeauty) {
    if (!hasIG) return { priority: 'Créer une présence visuelle forte', actions: ['Créer un compte centré sur les transformations', 'Publier des avant/après et ambiance du salon', 'Utiliser les tendances visuelles du secteur'], estimatedPrice: '300-600€/mois' }
    return { priority: 'Amplifier la stratégie visuelle et augmenter l\'audience', actions: ['Publier des contenus avant/après', 'Créer des vidéos tendance', 'Développer la communauté locale'], estimatedPrice: '250-450€/mois' }
  }
  if (isB2B) {
    if (!hasLI) return { priority: 'Créer une présence professionnelle et articles de fond', actions: ['Créer une page entreprise sur réseau professionnel', 'Publier des articles de fond 1x/semaine', 'Partager des actualités du secteur'], estimatedPrice: '400-800€/mois' }
    return { priority: 'Renforcer l\'autorité professionnelle et la génération de leads', actions: ['Publier des études de cas et retours clients', 'Développer le réseau professionnel', 'Créer du contenu éducatif sur le secteur'], estimatedPrice: '400-700€/mois' }
  }
  if (isRetail) {
    if (!hasIG && !hasFB) return { priority: 'Créer une présence sociale pour la boutique', actions: ['Créer une page commerce et un compte photo', 'Mettre en avant les nouveautés et promotions', 'Interagir avec la clientèle locale'], estimatedPrice: '250-500€/mois' }
    return { priority: 'Développer les ventes sociales et la fidélisation', actions: ['Créer du contenu produit régulier', 'Animer des jeux concours', 'Mettre en avant les offres exclusives'], estimatedPrice: '250-450€/mois' }
  }
  if (isHealth) {
    if (!hasFB) return { priority: 'Créer une page professionnelle rassurante', actions: ['Créer une page professionnelle', 'Partager des conseils santé et prévention', 'Mettre en avant les témoignages'], estimatedPrice: '300-600€/mois' }
    return { priority: 'Renforcer la confiance et l\'engagement', actions: ['Partager des conseils de prévention', 'Humaniser l\'équipe', 'Informer sur les services'], estimatedPrice: '250-500€/mois' }
  }
  if (!hasIG && !hasFB) return { priority: 'Établir une présence sur les réseaux essentiels', actions: ['Créer des comptes sur les principaux réseaux du secteur', 'Définir une ligne éditoriale', 'Publier régulièrement (3x/semaine minimum)'], estimatedPrice: '200-400€/mois' }
  if (isInactive) return { priority: 'Relancer la publication et réengager la communauté', actions: ['Reprendre une cadence régulière', 'Créer du contenu de valeur adapté au secteur', 'Répondre aux commentaires et messages'], estimatedPrice: '200-400€/mois' }
  return { priority: 'Développer l\'audience et augmenter l\'engagement', actions: ['Optimiser le contenu pour l\'algorithme', 'Créer des formats variés (photo, vidéo, stories)', 'Analyser les performances et ajuster'], estimatedPrice: '200-350€/mois' }
}

// ── Score de branding ─────────────────────────────────────────────────────────
function brandingScore(photoCount, hasDescription, descriptionSource, socialPresence, websiteUrl, cms) {
  const VISUAL_NETS = ['facebook', 'instagram', 'pinterest']
  const visualNets = VISUAL_NETS.filter(n => !!(socialPresence?.[n])).length
  const BASE = [0, 20, 45, 75]
  let score = BASE[Math.min(visualNets, 3)]

  if ((photoCount ?? 0) >= 10)                        score += 15
  else if ((photoCount ?? 0) >= 5)                    score += 7
  if (hasDescription && descriptionSource !== 'none') score += 10
  if (sitePresent(websiteUrl))                        score += 10
  if (cms && cms !== 'inconnu')                       score += 5

  score = Math.max(0, Math.min(100, score))
  const label = score >= 80 ? 'Image forte'
              : score >= 60 ? 'Image correcte'
              : score >= 40 ? 'Image à améliorer'
              : score >= 20 ? 'Image insuffisante'
              : 'Identité absente'
  return { score, label }
}

// ── Recommandation designer par secteur ──────────────────────────────────────
function getDesignerRecommendation(photoCount, hasDescription, socialPresence, domain, websiteUrl) {
  const raw    = ((domain ?? '') + '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  const hasIG  = !!(socialPresence?.instagram)
  const hasFB  = !!(socialPresence?.facebook)
  const hasSite = sitePresent(websiteUrl)

  const isRestaurant = /restaurant|cafe|brasserie|pizz|burger|traiteur|bistrot|bar/.test(raw)
  const isBeauty     = /coiffure|salon|spa|beaute|barbier|esthetique|onglerie/.test(raw)
  const isRetail     = /boutique|commerce|magasin|retail|mode|vetement|fleuriste/.test(raw)
  const isArtisan    = /artisan|menuisier|peintre|plombier|electricien|macon|couvreur/.test(raw)
  const isB2B        = /avocat|notaire|comptable|assurance|cabinet|immo|consulting/.test(raw)

  if (isRestaurant) {
    if ((photoCount ?? 0) < 5) return { priority: 'Créer une identité visuelle forte pour la fiche Google et les menus', actions: ['Shooting photo professionnel — plats, ambiance, équipe', 'Charte graphique cohérente (couleurs, typographie)', 'Mise à jour des visuels sur Google, Instagram et Facebook'], estimatedPrice: '800–2000€' }
    if (!hasIG) return { priority: 'Déployer l\'identité visuelle sur Instagram', actions: ['Créer un feed Instagram cohérent', 'Templates posts aux couleurs de l\'établissement', 'Visuels story et reels adaptés'], estimatedPrice: '500–1200€' }
    return { priority: 'Renforcer la cohérence visuelle sur tous les supports', actions: ['Audit de cohérence visuelle multi-supports', 'Uniformisation des visuels en ligne', 'Création de templates réutilisables'], estimatedPrice: '400–900€' }
  }
  if (isBeauty) {
    if (!hasSite && !hasIG) return { priority: 'Créer une identité visuelle complète', actions: ['Logo + charte graphique', 'Shooting avant/après et ambiance', 'Déploiement sur réseaux et site'], estimatedPrice: '1000–2500€' }
    return { priority: 'Renforcer l\'image premium et la cohérence visuelle', actions: ['Harmonisation des couleurs et typographies', 'Visuels avant/après professionnels', 'Templates pour les réseaux sociaux'], estimatedPrice: '600–1500€' }
  }
  if (isRetail) {
    if (!hasSite) return { priority: 'Créer une identité digitale cohérente', actions: ['Logo + charte graphique boutique', 'Visuels produits professionnels', 'Supports print et digital harmonisés'], estimatedPrice: '800–2000€' }
    return { priority: 'Uniformiser l\'image sur les supports physiques et digitaux', actions: ['Audit de cohérence visuelle', 'Mise à jour des visuels produits', 'Création de supports de communication'], estimatedPrice: '500–1200€' }
  }
  if (isArtisan) {
    return { priority: 'Créer une image professionnelle et rassurante', actions: ['Logo + charte graphique artisanale', 'Photos de chantiers et réalisations', 'Supports de présentation clients'], estimatedPrice: '600–1500€' }
  }
  if (isB2B) {
    return { priority: 'Construire une image professionnelle et mémorable', actions: ['Identité visuelle corporate complète', 'Supports de communication professionnels', 'Cohérence graphique sur tous les supports'], estimatedPrice: '1200–3000€' }
  }
  if ((photoCount ?? 0) < 5) return { priority: 'Créer des visuels professionnels pour améliorer la perception', actions: ['Shooting photo professionnel', 'Charte graphique de base', 'Mise à jour des visuels en ligne'], estimatedPrice: '600–1500€' }
  if (!hasIG && !hasFB) return { priority: 'Déployer l\'identité visuelle sur les réseaux sociaux', actions: ['Templates adaptés aux réseaux', 'Cohérence visuelle multi-plateformes', 'Ligne éditoriale visuelle'], estimatedPrice: '400–900€' }
  return { priority: 'Optimiser et renforcer l\'identité visuelle existante', actions: ['Audit de cohérence visuelle', 'Rafraîchissement des éléments graphiques', 'Nouveaux supports de communication'], estimatedPrice: '400–900€' }
}

// ── Score WebDev ─────────────────────────────────────────────────────────────
function webDevScore(pagespeedData, websiteUrl, cms, hasHttps, hasSitemap, hasRobots) {
  if (!sitePresent(websiteUrl)) return { score: 0, label: 'Inexistant' }

  let score = 20  // site present

  const https    = hasHttps  ?? pagespeedData?.https          ?? false
  const sitemap  = hasSitemap ?? pagespeedData?.sitemap       ?? false
  const robots   = hasRobots  ?? pagespeedData?.robots        ?? false
  const mobile   = pagespeedData?.mobileFriendly              ?? false

  const rawPerf  = pagespeedData?.performance ?? null
  const perf     = rawPerf != null ? (rawPerf <= 1 ? Math.round(rawPerf * 100) : Math.round(rawPerf)) : null

  const rawAcc   = pagespeedData?.accessibility ?? null
  const acc      = rawAcc  != null ? (rawAcc  <= 1 ? Math.round(rawAcc  * 100) : Math.round(rawAcc))  : null

  if (https)   score += 15
  if (mobile)  score += 15
  if (sitemap) score += 10
  if (robots)  score += 10
  if (perf != null) {
    if (perf >= 80)      score += 20
    else if (perf >= 50) score += 10
    else                 score += 5
  }
  if (acc != null && acc >= 80) score += 10

  score = Math.min(100, score)
  const label = score < 25 ? 'Critique'
              : score < 50 ? 'Basique'
              : score < 75 ? 'Correct'
              : 'Optimisé'
  return { score, label }
}

// ── Fréquence de visite estimée par secteur ──────────────────────────────────
const VISIT_FREQ_HIGH   = ['restaurant', 'cafe', 'boulangerie', 'bakery', 'pharmacie', 'supermarche', 'epicerie', 'tabac', 'pressing', 'gym', 'sport', 'fitness', 'brasserie', 'pizz', 'burger', 'traiteur', 'bistrot']
const VISIT_FREQ_LOW    = ['avocat', 'notaire', 'comptable', 'assurance', 'immo', 'architecte', 'dentiste', 'orthodontiste', 'psy', 'psychiatre', 'psychologue']

function estimateVisitFrequency(domain, types) {
  const raw = [(domain ?? ''), ...(types || [])].join(' ').toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  if (VISIT_FREQ_HIGH.some(k => raw.includes(k)))  return { label: 'Haute',  potential: 'Très fort', monthlyVisits: 4 }
  if (VISIT_FREQ_LOW.some(k  => raw.includes(k)))  return { label: 'Faible', potential: 'Faible',    monthlyVisits: 0.5 }
  return { label: 'Modérée', potential: 'Fort', monthlyVisits: 1 }
}

// ── Stabilité du business ─────────────────────────────────────────────────────
function evaluateBusinessStability(hasHours, pappersData) {
  let score = 0
  if (hasHours) score += 2  // horaires définis = établissement organisé

  if (pappersData) {
    const ca   = pappersData.chiffreAffaires ?? null
    const date = pappersData.dateCreation    ?? null
    const eff  = pappersData.effectifs       ?? null

    if (date) {
      const ageYears = (Date.now() - new Date(date).getTime()) / (365.25 * 24 * 3600 * 1000)
      if      (ageYears >= 5) score += 3
      else if (ageYears >= 2) score += 2
      else if (ageYears >= 1) score += 1
    }
    if (ca !== null) {
      if      (ca >= 200000) score += 3
      else if (ca >= 50000)  score += 2
      else                   score += 1
    }
    if (eff !== null && eff >= 1) score += 1
  }

  const stability = score >= 6 ? 'haute' : score >= 3 ? 'moyenne' : 'faible'
  const canInvest = score >= 5 && (pappersData?.chiffreAffaires ?? 0) >= 50000
  return { stability, canInvest, score }
}

// ── Email Marketing Opportunity Score ────────────────────────────────────────
function emailMarketingScore(totalReviews, ownerReplyRatio, hasWebsite, hasNewsletter, hasContactForm, socialPresence, loyaltyMentions, visitFrequencyPotential, stability, canInvest) {
  let score = 0
  const reviews = Number(totalReviews) || 0
  const nets    = socialPresence
    ? [socialPresence.facebook, socialPresence.instagram, socialPresence.tiktok,
       socialPresence.linkedin, socialPresence.youtube, socialPresence.pinterest].filter(Boolean).length
    : 0

  // Volume de clients potentiels à fidéliser
  if      (reviews > 200) score += 20
  else if (reviews > 100) score += 15
  else if (reviews > 50)  score += 10
  else                    score += 5

  // Propriétaire peu réactif = pas de suivi client = opportunité
  if ((ownerReplyRatio ?? 1) < 0.3) score += 20

  // Présence digitale = capacité de capture
  if (hasWebsite)     score += 15
  if (!hasNewsletter) score += 20  // pas de newsletter = opportunité directe
  if (hasContactForm) score += 10
  if (nets >= 3)      score += 15  // audience sociale à convertir

  // Signaux de fidélisation (avis clients)
  const lm = Number(loyaltyMentions) || 0
  if      (lm === 0) score += 10  // aucun programme = opportunité vierge
  else if (lm > 3)   score -= 10  // programme existant → moins d'urgence

  // Fréquence de visite — potentiel de réengagement
  if (visitFrequencyPotential === 'Très fort') score += 10
  else if (visitFrequencyPotential === 'Fort') score += 10
  else if (visitFrequencyPotential === 'Faible') score -= 5

  // Stabilité business — capacité d'investissement
  if (stability === 'haute' && canInvest) score += 10

  score = Math.min(100, score)

  const label = score >= 80 ? 'Inexistant'
    : score >= 60 ? 'Faible'
    : score >= 40 ? 'Basique'
    : score >= 20 ? 'Actif'
    : 'Avancé'

  return { score, label }
}

// ── Recommandation Email Marketing ────────────────────────────────────────────
function getEmailMarketingRecommendation(domain, hasNewsletter, totalReviews, hasWebsite) {
  if (!hasWebsite) {
    return { priority: 'Création landing page de capture email', estimatedPrice: '500–1500€' }
  }
  if (!hasNewsletter) {
    return { priority: 'Mise en place stratégie email complète', estimatedPrice: '800–2000€' }
  }
  return { priority: 'Optimisation et automatisation des campagnes', estimatedPrice: '400–1000€/mois' }
}

// ── Recommandation WebDev ────────────────────────────────────────────────────
function getWebDevRecommendation(websiteUrl, cms, pagespeedData, hasHttps, hasSitemap) {
  if (!sitePresent(websiteUrl)) {
    return { priority: 'Création site vitrine complet', estimatedPrice: '2000–5000€' }
  }

  const rawPerf = pagespeedData?.performance ?? null
  const perf    = rawPerf != null ? (rawPerf <= 1 ? Math.round(rawPerf * 100) : Math.round(rawPerf)) : null
  const https   = hasHttps   ?? pagespeedData?.https   ?? false
  const sitemap = hasSitemap ?? pagespeedData?.sitemap ?? false

  const cmsKey  = ((cms ?? pagespeedData?.cms?.cms ?? '')).toLowerCase()
  const isOld   = ['wix', 'jimdo', 'squarespace'].includes(cmsKey)

  if (!https && perf != null && perf < 40) return { priority: 'Refonte technique complète', estimatedPrice: '1500–4000€' }
  if (!https || !sitemap)                  return { priority: 'Corrections techniques fondamentales', estimatedPrice: '500–1500€' }
  if (perf != null && perf < 60)           return { priority: 'Optimisation performances', estimatedPrice: '800–2000€' }
  if (isOld)                               return { priority: 'Migration vers une solution moderne et maintenable', estimatedPrice: '1500–3500€' }
  return { priority: 'Maintenance technique et optimisations avancées', estimatedPrice: '500–1500€' }
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

// ── Concurrence Google Ads par secteur ───────────────────────────────────────
const ADS_CONCURRENCE_MAP = [
  { pattern: /restaurant|brasserie|cafe|pizz|burger|traiteur|bistrot|bar|food/, level: 'Modérée',    cpc: '0,50–1,50€', budget: '500–1500€/mois' },
  { pattern: /avocat|juridiqu|notaire|huissier|cabinet.*juri/,                  level: 'Très élevée', cpc: '3–8€',       budget: '2000–5000€/mois' },
  { pattern: /plombier|serrurier|electricien|depannage|urgence/,                level: 'Élevée',      cpc: '2–5€',       budget: '1500–3000€/mois' },
  { pattern: /coiffure|salon|barbier|beaute|spa|esthetique|onglerie/,          level: 'Faible',      cpc: '0,30–1€',    budget: '300–500€/mois' },
  { pattern: /immo|agence.*immo|location|transaction.*immo/,                   level: 'Élevée',      cpc: '2–6€',       budget: '1500–3000€/mois' },
  { pattern: /ecommerce|boutique|commerce.*en.*ligne|shop|magasin/,            level: 'Modérée',     cpc: '0,50–2€',    budget: '500–1500€/mois' },
  { pattern: /medecin|sante|clinique|kine|psy|dentiste|pharmacie|docteur/,     level: 'Élevée',      cpc: '2–4€',       budget: '1500–3000€/mois' },
]

function getGoogleAdsConcurrence(domain) {
  const raw = ((domain ?? '') + '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  const match = ADS_CONCURRENCE_MAP.find(m => m.pattern.test(raw))
  if (match) return { level: match.level, cpc: match.cpc, budget: match.budget }
  return { level: 'Modérée', cpc: '1–2€', budget: '500–1500€/mois' }
}

// ── Compatibilité Google Ads ─────────────────────────────────────────────────
function googleAdsReadiness(googleRating, totalReviews, websiteUrl, pagespeedData, photoCount, hasDescription, hasHours, negativeRatio) {
  let score = 0

  // Note Google
  const rating = Number(googleRating) || 0
  if      (rating >= 4.0) score += 20
  else if (rating >= 3.5) score += 10
  else                    score += 5

  // Volume d'avis
  const reviews = Number(totalReviews) || 0
  if      (reviews > 50) score += 15
  else if (reviews >= 20) score += 10
  else                    score += 5

  // Site web
  if (sitePresent(websiteUrl)) score += 15

  // Performance mobile
  const rawPerf = pagespeedData?.performance ?? null
  const perf    = rawPerf != null ? (rawPerf <= 1 ? Math.round(rawPerf * 100) : Math.round(rawPerf)) : null
  if (perf !== null) {
    if      (perf >= 70) score += 15
    else if (perf >= 50) score += 10
    else                 score += 5
  }

  // HTTPS
  if (pagespeedData?.https) score += 10

  // Temps de chargement
  const loadRaw = pagespeedData?.loadTime ?? null
  const loadSec = loadRaw !== null ? parseFloat(String(loadRaw).replace('s', '')) : null
  if (loadSec !== null) {
    if      (loadSec < 3) score += 10
    else if (loadSec < 5) score += 5
  }

  // Fiche Google complète (photos + description + horaires)
  if ((photoCount ?? 0) > 10 && hasDescription && hasHours) score += 10

  // Pénalité avis négatifs > 20%
  if ((negativeRatio ?? 0) > 0.2) score -= 15

  score = Math.max(0, Math.min(100, score))
  const label = score >= 75 ? 'Idéal'
              : score >= 55 ? 'Prêt'
              : score >= 35 ? 'À préparer'
              : 'Non compatible'
  return { score, label }
}

// ── Recommandation Google Ads ─────────────────────────────────────────────────
function getGoogleAdsRecommendation(domain, googleRating, websiteUrl, pagespeedData) {
  if (!sitePresent(websiteUrl)) {
    return { priority: 'Créer un site + landing page optimisée pour les ads', estimatedPrice: '1500–3000€ + 500€/mois gestion' }
  }

  const rawPerf = pagespeedData?.performance ?? null
  const perf    = rawPerf != null ? (rawPerf <= 1 ? Math.round(rawPerf * 100) : Math.round(rawPerf)) : null
  const hasHttps = pagespeedData?.https ?? false

  if (perf !== null && perf < 50 && !hasHttps) {
    return { priority: 'Optimiser le site avant de lancer les ads', estimatedPrice: '500–1000€ + 800€/mois gestion' }
  }
  if (perf !== null && perf < 50) {
    return { priority: 'Optimiser les performances mobiles avant de lancer les ads', estimatedPrice: '300–800€ + 800€/mois gestion' }
  }
  return { priority: 'Lancer une campagne Google Ads locale', estimatedPrice: '500–1500€/mois (budget ads + gestion)' }
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
      : profileId === 'videaste'
        ? videographerOpportunityScore(placeData, socialPresence)
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

module.exports = { calculateScore, DEFAULT_WEIGHTS, getDomainComplexity, getRecommendedRAGType, estimateMonthlyConversations, getRecommendedStack, socialRegularityScore, getSocialRecommendation, brandingScore, getDesignerRecommendation, webDevScore, getWebDevRecommendation, emailMarketingScore, getEmailMarketingRecommendation, estimateVisitFrequency, evaluateBusinessStability, getGoogleAdsConcurrence, googleAdsReadiness, getGoogleAdsRecommendation }
