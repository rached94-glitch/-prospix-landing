const Anthropic = require('@anthropic-ai/sdk')
const { countQuestionsInReviews, detectLanguages, detectLoyaltyMentions, detectEmailThemes } = require('./reviewAnalysis')
const auditStatsData = require('../data/auditStats.json')

// ── Filtrage des stats par type d'audit ───────────────────────────────────────
function getFilteredStats(auditType) {
  const filtered = []
  for (const [category, entries] of Object.entries(auditStatsData)) {
    if (category === 'sources') continue
    for (const [, item] of Object.entries(entries)) {
      if (!item || !Array.isArray(item.context)) continue
      if (item.context.includes(auditType) && !(item.forbidden_context ?? []).includes(auditType)) {
        filtered.push(item.stat)
      }
    }
  }
  if (filtered.length === 0) return '— Aucune statistique sectorielle spécifique disponible pour cet audit'
  return filtered.map(s => `- ${s}`).join('\n')
}

// ── Bloc de règles commun injecté dans TOUS les generateAudit* ─────────────────
function buildAuditRulesBlock(auditType) {
  return `
RÈGLES OBLIGATOIRES POUR CET AUDIT :

A) STATS — RÈGLE STRICTE :
- Utilise UNIQUEMENT les statistiques fournies ci-dessous. Ne JAMAIS inventer de chiffre.
- Si aucune stat fournie ne correspond au point que tu veux illustrer, formule l'argument sans chiffre plutôt que d'inventer.
- Chaque stat utilisée doit être citée avec sa source entre parenthèses.
- Ne JAMAIS réutiliser une stat dans un contexte différent de celui pour lequel elle a été mesurée (ex: une stat sur les fiches Google ne peut pas servir d'argument pour un chatbot).

STATISTIQUES AUTORISÉES POUR CET AUDIT :
${getFilteredStats(auditType)}

B) COMPARAISON CONCURRENTS — Ajoute un champ comparaison_concurrents dans le JSON retourné :
{"position": "Position du prospect vs la moyenne du secteur, basée uniquement sur ses propres données (note, présence digitale, performance) — jamais une affirmation sur ce que les concurrents font ou ne font pas", "avantages": ["max 2 points forts du prospect vs moyenne sectorielle"], "retards": ["max 2 points en retard du prospect vs moyenne sectorielle"]}
RÈGLE STRICTE : Ne JAMAIS affirmer ce que les concurrents locaux font ou ne font pas (ex: "vos concurrents n'ont pas de chatbot", "aucun concurrent n'est sur Instagram"). Ces données ne sont pas vérifiées. Baser la comparaison sur les données du prospect et les tendances générales du secteur. Si incertain, utiliser : "L'adoption de [service] reste limitée dans ce secteur localement, ce qui représente une opportunité de différenciation."

C) TIMELINE — Ajoute un champ timeline dans le JSON :
{"semaine_1": "Action prioritaire immédiate concrète", "semaine_2_3": "Actions de fond à lancer", "mois_2_3": "Consolidation et premiers indicateurs mesurables"}
Décris les actions, pas les résultats attendus. Pas de promesses.

D) ACCROCHE CTA — Le champ accroche doit être factuel et professionnel. INTERDICTION ABSOLUE : "résultats garantis", "en X jours", "multipliez vos revenus", "résultats visibles en 30 jours". Ton de consultant, pas de commercial.

E) TITRE DYNAMIQUE — Ajoute un champ titre_audit dans le JSON avec le titre approprié au type d'audit (ex: "Audit SEO & Visibilité Locale", "Audit Image & Photographie", "Audit Chatbot & IA Conversationnelle", "Audit Community Management & E-Réputation", "Audit Identité Visuelle & Branding", "Audit Technique & Performance Web", "Audit Email Marketing & Fidélisation", "Audit Google Ads & Acquisition Locale", "Audit Contenu & SEO Rédactionnel").`
}

// ── Note stats à injecter dans TOUS les generateEmail* ────────────────────────
const EMAIL_STATS_NOTE = `
RÈGLE STATS DANS LES EMAILS :
- Ne JAMAIS citer de statistique externe (SQ Magazine, Bain, Google, etc.) dans un email de prospection.
- Utiliser UNIQUEMENT les données réelles du prospect : son nombre d'avis, sa note, ses avis sans réponse, ses thèmes d'avis, ses KPIs détectés.
- Un chiffre qui vient du prospect est 10x plus convaincant qu'une stat générique.`

// ── Helper : enrichit le résultat parsé avec les nouveaux champs (fallback null/défaut) ──
function enrichAuditResult(parsed) {
  if (!parsed || typeof parsed !== 'object') return parsed
  return {
    ...parsed,
    comparaison_concurrents: parsed.comparaison_concurrents || null,
    timeline:                parsed.timeline                || null,
    titre_audit:             parsed.titre_audit             || 'Audit Digital',
  }
}

function selectRepresentativeReviews(reviews) {
  if (reviews.length <= 30) return { selected: reviews, total: reviews.length }

  const recent   = [...reviews].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 15)
  const negative = [...reviews].filter(r => r.rating <= 2).sort((a, b) => a.rating - b.rating).slice(0, 10)
  const liked    = [...reviews].sort((a, b) => (b.likes || 0) - (a.likes || 0)).slice(0, 5)

  const seen = new Set()
  const selected = []
  for (const r of [...recent, ...negative, ...liked]) {
    const key = `${r.author}|${r.date}`
    if (!seen.has(key)) {
      seen.add(key)
      selected.push(r)
    }
  }

  return { selected: selected.slice(0, 30), total: reviews.length }
}

// ── Context block (prepended to all prompts when audit data is available) ──────
function buildContextBlock(meta, auditData) {
  if (!auditData) return ''

  const { websiteUrl = null, rating = null, reviewCount = null } = meta
  const { googleAudit = null, pagespeed = null, facebookActivity = null, instagramActivity = null } = auditData

  const lines = ['=== DONNÉES COMPLÈTES DU LEAD ===', '']

  // Google fiche
  lines.push('📍 FICHE GOOGLE :')
  if (rating !== null)      lines.push(`  - Note Google   : ${rating}/5`)
  if (reviewCount !== null) lines.push(`  - Nombre d'avis : ${reviewCount}`)
  if (googleAudit) {
    lines.push(`  - Photos        : ${googleAudit.hasPhotos ? `✅ ${googleAudit.photoCount} photo(s)` : '❌ Aucune photo'}`)
    lines.push(`  - Horaires      : ${googleAudit.hasHours ? '✅ Renseignés' : '❌ Non renseignés'}`)
    lines.push(`  - Description   : ${googleAudit.hasDescription ? '✅ Présente' : '❌ Absente'}`)
  }
  lines.push('')

  // Website / PageSpeed
  lines.push('🌐 SITE WEB & PERFORMANCE :')
  lines.push(`  - Site web      : ${websiteUrl ? websiteUrl : '❌ ABSENT — aucun site détecté'}`)
  if (pagespeed) {
    lines.push(`  - Performance   : ${pagespeed.performance}/100`)
    lines.push(`  - Score SEO     : ${pagespeed.seo}/100`)
    if (pagespeed.loadTime) lines.push(`  - Chargement    : ${pagespeed.loadTime}`)
    if (pagespeed.issues?.length > 0) lines.push(`  - Problèmes     : ${pagespeed.issues.join(', ')}`)
  } else if (websiteUrl) {
    lines.push('  - (données PageSpeed non disponibles)')
  }
  lines.push('')

  // Social networks
  lines.push('📱 ACTIVITÉ RÉSEAUX SOCIAUX :')
  if (facebookActivity && facebookActivity.status !== 'unknown') {
    lines.push(`  - Facebook      : ${facebookActivity.label}`)
    if (facebookActivity.lastPostDate) lines.push(`    Dernier post  : ${facebookActivity.lastPostDate} (${facebookActivity.daysAgo}j)`)
    if (facebookActivity.followers)    lines.push(`    Abonnés       : ${facebookActivity.followers}`)
  } else {
    lines.push('  - Facebook      : ⚪ Non détecté ou inactif')
  }
  if (instagramActivity && instagramActivity.status !== 'unknown') {
    lines.push(`  - Instagram     : ${instagramActivity.label}`)
    if (instagramActivity.lastPostDate) lines.push(`    Dernier post  : ${instagramActivity.lastPostDate} (${instagramActivity.daysAgo}j)`)
    if (instagramActivity.followers)    lines.push(`    Abonnés       : ${instagramActivity.followers}`)
  } else {
    lines.push('  - Instagram     : ⚪ Non détecté ou inactif')
  }

  lines.push('')
  lines.push('=================================')
  lines.push('')

  return lines.join('\n')
}

// ── Per-profile focus directives ───────────────────────────────────────────────
function buildFocusDirective(profileId, auditData, meta) {
  if (!auditData) return ''

  const { websiteUrl = null } = meta
  const { googleAudit = null, pagespeed = null, facebookActivity = null, instagramActivity = null } = auditData

  const photoCount    = googleAudit?.photoCount ?? 0
  const hasDescription = googleAudit?.hasDescription ?? false
  const hasHours      = googleAudit?.hasHours ?? false
  const perf          = pagespeed?.performance ?? null
  const seo           = pagespeed?.seo ?? null
  const loadTime      = pagespeed?.loadTime ?? null
  const fbLabel       = facebookActivity?.label ?? '⚪ Non détecté'
  const igLabel       = instagramActivity?.label ?? '⚪ Non détecté'
  const fbDays        = facebookActivity?.daysAgo
  const igDays        = instagramActivity?.daysAgo
  const noSocial      = (!facebookActivity || facebookActivity.status === 'unknown') &&
                        (!instagramActivity || instagramActivity.status === 'unknown')

  const focuses = {
    chatbot: `Concentre-toi sur les questions récurrentes et les demandes sans réponse dans les avis. ${pagespeed?.siteSignals?.chatbotDetected ? `Chatbot existant détecté (${pagespeed.siteSignals.chatbotTool}) — angle différentiel requis.` : ''} ${pagespeed?.siteSignals?.bookingPlatform ? `Booking (${pagespeed.siteSignals.bookingPlatform}) détectée — le chatbot répond à tout ce que la plateforme ne couvre pas.` : ''} ${pagespeed?.siteSignals?.hasFAQ ? 'FAQ existante détectée — le contenu RAG est déjà disponible.' : ''} Quantifie les opportunités d'automatisation à partir des avis réels uniquement.`,

    seo: `Le score SEO PageSpeed est ${seo !== null ? `${seo}/100` : 'non disponible'}. ${!hasDescription ? '⚠️ Description fiche Google absente — signaler comme lacune SEO prioritaire.' : '✅ Description fiche présente.'} ${!hasHours ? '⚠️ Horaires non renseignés — signal négatif pour Google.' : ''} Lie les avis clients aux signaux SEO (fraîcheur, mots-clés, réponses).`,

    'pub-google': `Performance site : ${perf !== null ? `${perf}/100` : 'non disponible'}. ${loadTime ? `Temps de chargement : ${loadTime} — un site lent nuit au Quality Score et au taux de conversion.` : ''} Photos fiche Google : ${photoCount} — exploitable dans les extensions d'annonces.`,

    'dev-web': !websiteUrl
      ? `🚨 PRIORITÉ ABSOLUE : aucun site web détecté. Le site est l'argument principal à vendre. Lie les attentes clients dans les avis aux fonctionnalités web manquantes.`
      : `Site présent (${websiteUrl}). Performance : ${perf !== null ? `${perf}/100` : 'non dispo'}${loadTime ? `, chargement : ${loadTime}` : ''}. Identifie les fonctionnalités manquantes demandées dans les avis.`,

    photographe: `La fiche Google contient ${photoCount} photo(s). ${photoCount === 0 ? '🚨 Aucune photo — frein direct au clic sur Google Maps.' : photoCount < 5 ? '⚠️ Peu de photos — potentiel fort d\'amélioration.' : '✅ Photos présentes — analyser la qualité et la diversité perçues dans les avis.'} Connecte les avis à la valorisation visuelle.`,

    'social-media': `Facebook : ${fbLabel}${fbDays !== null && fbDays !== undefined ? ` (${fbDays}j)` : ''}. Instagram : ${igLabel}${igDays !== null && igDays !== undefined ? ` (${igDays}j)` : ''}. ${noSocial ? '⚠️ Réseaux inexistants ou dormants — forte opportunité de création de présence.' : 'Compare la fréquence de publication aux attentes clients dans les avis.'}`,

    copywriter: `${!hasDescription ? '⚠️ Description fiche Google absente — opportunité de copywriting immédiate.' : '✅ Description fiche présente mais optimisable.'} Identifie les expressions authentiques des avis réutilisables pour les textes marketing.`,

    'email-marketing': `Identifie les signaux de fidélité et de récurrence dans les avis. Croise avec la présence digitale : site ${websiteUrl ? 'présent' : '❌ absent'}${perf !== null ? `, performance ${perf}/100` : ''}.`,

    designer: `${photoCount} photo(s) sur la fiche Google. ${!hasDescription ? 'Aucune description fiche — cohérence de marque absente en ligne.' : ''} Analyse l'écart entre l'expérience décrite dans les avis et l'identité visuelle projetée.`,

    videaste: `Activité réseaux : FB ${fbLabel} / IG ${igLabel}. ${noSocial ? '⚠️ Aucune présence vidéo détectée — opportunité forte.' : ''} Identifie les histoires et émotions des avis qui se prêtent à la vidéo.`,

    'consultant-seo': `Score SEO PageSpeed : ${seo !== null ? `${seo}/100` : 'non disponible'}. Photos fiche : ${photoCount}. Description : ${hasDescription ? '✅ présente' : '❌ absente'}. Horaires : ${hasHours ? '✅ renseignés' : '❌ non renseignés'}. Analyse E-E-A-T à partir des avis et de ces signaux.`,
  }

  return focuses[profileId] ?? `Intègre toutes les données disponibles dans ton analyse globale (site, performance, réseaux sociaux, fiche Google).`
}

// ── Prompt builders per profile ───────────────────────────────────────────────
function buildPrompt(businessName, reviewsText, total, avgRating, unanswered, profileId, meta = {}, auditData = null, negativeCount = 0, stats = {}) {
  const { websiteUrl = null, city = null, rating = null, reviewCount = null, category = null } = meta

  console.log(`[aiReviewAnalysis] Profil actif: ${profileId}`)

  const ctx        = buildContextBlock(meta, auditData)
  const focusText  = buildFocusDirective(profileId, auditData, meta)
  const focusBlock = focusText ? `⚡ FOCUS PROFIL : ${focusText}\n\n` : ''

  // ── Build statistics block from full reviews corpus ───────────────────────
  const statsLines = []
  if (stats.total)                              statsLines.push(`Total avis analysés : ${stats.total}`)
  if (stats.starDist) {
    const t = stats.total || 1
    statsLines.push(`Distribution : 5★ ${Math.round((stats.starDist[5]||0)/t*100)}% | 4★ ${Math.round((stats.starDist[4]||0)/t*100)}% | 3★ ${Math.round((stats.starDist[3]||0)/t*100)}% | 2★ ${Math.round((stats.starDist[2]||0)/t*100)}% | 1★ ${Math.round((stats.starDist[1]||0)/t*100)}%`)
  }
  if (stats.replyRate !== undefined)            statsLines.push(`Taux de réponse propriétaire : ${stats.replyRate}%`)
  if (stats.questionCount)                      statsLines.push(`Questions dans les avis : ${stats.questionCount}`)
  if (stats.topThemes?.length > 0)             statsLines.push(`Thèmes fréquents : ${stats.topThemes.join(', ')}`)
  if (stats.loyaltyMentions > 0)               statsLines.push(`Mentions fidélité/retour : ${stats.loyaltyMentions}`)
  if (stats.languages?.length > 1)             statsLines.push(`Langues détectées : ${stats.languages.join(', ')}`)
  const statsBlock = statsLines.length > 0
    ? `STATISTIQUES CORPUS :\n${statsLines.join('\n')}\n\n`
    : ''

  const header = `Tu es un expert en réputation digitale et en marketing local. Analyse ces avis Google pour "${businessName}".

RÈGLE ABSOLUE — ZÉRO NOM DE MARQUE : N'utilise aucun nom de marque, outil ou plateforme commerciale dans tes recommandations. Interdit : Planity, Reservio, Hootsuite, Buffer, Canva, Mailchimp, Brevo, HubSpot, Calendly, WordPress, Webflow, Shopify, Wix, Crisp, Tidio, Intercom, Semrush, Ahrefs, etc. Utilise uniquement des descriptions génériques : "outil de réservation en ligne", "plateforme de gestion des réseaux sociaux", "solution d'email marketing", "logiciel de chat en ligne", "outil de planification éditoriale".

Analyse basée sur ${total} avis réels (sélection des plus représentatifs)
Moyenne : ${avgRating}/5 | Avis négatifs sans réponse : ${unanswered}

${statsBlock}AVIS :
${reviewsText}

`

  // Conditional rule: if < 5% negative reviews, don't invent problems
  const negativeRate = total > 0 ? negativeCount / total : 0
  const negativeRule = negativeRate < 0.05
    ? `\n⚠️ RÈGLE IMPORTANTE : Ce business a très peu ou pas d'avis négatifs (${negativeCount} sur ${total}). NE PAS mentionner des problèmes critiques de manière forcée. Ne jamais inventer un problème absent des données. À la place, identifie des opportunités d'amélioration dans d'autres domaines (présence web, réseaux sociaux, fiche Google, fréquence des réponses) même si tout va bien côté avis.`
    : ''

  const footer = `${negativeRule}

Réponds en français uniquement. Sois précis et cite des exemples concrets tirés des avis.

RÈGLES DE FORMATAGE STRICTES :
- Ne jamais utiliser de tableaux markdown (|---|---|)
- Ne jamais utiliser de séparateurs --- ou ***
- Ne jamais utiliser de # pour les titres
- Ne jamais utiliser de ** pour le gras
- Utiliser uniquement du texte brut
- Les listes : utiliser • au lieu de - ou *
- Les titres de section : écrire en MAJUSCULES suivi de deux points, pas de symboles`

  // ── SEO-specific enriched header ─────────────────────────────────────────────
  const seoHeader = `Tu es consultant SEO local expert. Analyse ces avis ET ces données pour "${businessName}".

DONNÉES CONTEXTUELLES :
- Site web      : ${websiteUrl ? websiteUrl : 'ABSENT — aucun site web trouvé'}
- Note Google   : ${rating ?? avgRating}/5
- Nombre d'avis : ${reviewCount ?? total}
- Ville         : ${city ?? 'non renseignée'}
- Avis négatifs sans réponse : ${unanswered}

${websiteUrl
    ? `⚠️ Le site existe (${websiteUrl}) mais sa visibilité organique est à analyser.`
    : `🚨 ALERTE : Aucun site web détecté. Le SEO on-page est impossible sans site. Recommander la création d'un site avant toute stratégie SEO.`
  }

AVIS CLIENTS :
${statsBlock}${reviewsText}

`

  // ── Prompt dédié SEO (partagé par 'seo' et 'consultant-seo') ─────────────────
  // Extract pagespeed + localRank from auditData if available
  const ps         = auditData?.pagespeed  ?? null
  const lr         = auditData?.localRank  ?? null
  const psPerf     = ps?.performance       ?? null
  const psSeo      = ps?.seo               ?? null
  const psLoad     = ps?.loadTime          ?? null
  const psHttps    = ps?.https             ?? null
  const psSitemap  = ps?.sitemap           ?? null
  const psMobile   = ps?.mobileFriendly    ?? null
  const psLcp      = ps?.lcp               ?? null
  const psIndexed  = ps?.indexedPages      ?? null
  const psCms      = ps?.cms?.cms          ?? null

  const rankLine = !lr
    ? null
    : lr.found
      ? `Position ${lr.rank}/20 sur Google Maps local${lr.topThree ? ' — top 3' : lr.topTen ? ' — top 10' : ''}`
      : 'Hors top 20 — établissement invisible sur Google Maps local'

  const techLines = []
  if (psPerf    !== null) techLines.push(`- Performance mobile (PageSpeed Insights) : ${psPerf}/100`)
  if (psSeo     !== null) techLines.push(`- Score SEO technique (PageSpeed Insights) : ${psSeo}/100`)
  if (psLoad    !== null) techLines.push(`- Temps de chargement : ${psLoad}s`)
  if (psLcp     !== null) techLines.push(`- LCP (vitesse perçue) : ${psLcp}`)
  if (psHttps   !== null) techLines.push(`- HTTPS : ${psHttps ? 'activé' : 'ABSENT'}`)
  if (psSitemap !== null) techLines.push(`- Sitemap XML : ${psSitemap ? 'présent' : 'ABSENT'}`)
  if (psMobile  !== null) techLines.push(`- Mobile friendly : ${psMobile ? 'oui' : 'NON'}`)
  if (psCms)              techLines.push(`- CMS détecté : ${psCms}`)
  if (psIndexed)          techLines.push(`- Pages indexées par Google : ${psIndexed.indexedPages} (${psIndexed.signal === 'good' ? 'bon volume' : psIndexed.signal === 'weak' ? 'insuffisant' : 'quasi invisible'})`)
  if (rankLine)           techLines.push(`- Position locale : ${rankLine}`)

  const techBlock = techLines.length > 0
    ? `DONNÉES TECHNIQUES — Google PageSpeed Insights + Maps :\n${techLines.join('\n')}\n\n`
    : ''

  // Quick win: prioritise critical technical issues over review tasks
  const qwHints = []
  if (psHttps  === false)                          qwHints.push(`Activer le HTTPS — Google pénalise les sites non sécurisés et les navigateurs affichent un avertissement qui fait fuir les visiteurs.`)
  if (psSitemap === false)                         qwHints.push(`Soumettre un sitemap XML dans Google Search Console — sans sitemap, certaines pages ne sont jamais indexées.`)
  if (psMobile  === false)                         qwHints.push(`Corriger l'absence de balise viewport — Google déprioritise les sites non adaptés au mobile dans les résultats locaux.`)
  if (psPerf !== null && psPerf < 50)              qwHints.push(`Améliorer le score de performance mobile (actuellement ${psPerf}/100 selon PageSpeed Insights) — en dessous de 50, Google réduit la visibilité dans le classement local.`)
  if (unanswered > 0 && qwHints.length === 0)      qwHints.push(`Répondre aux ${unanswered} avis sans réponse cette semaine améliore le score E-E-A-T Google et le taux de conversion Maps.`)
  if (lr && !lr.found && qwHints.length === 0)     qwHints.push(`Optimiser la fiche Google Business Profile (catégorie, description, photos) pour apparaître dans le top 20 sur les recherches locales.`)
  const quickWinHint = qwHints[0] ?? `Répondre aux ${unanswered} avis sans réponse améliore le score E-E-A-T Google.`

  // Signal d'alerte: merge review + technical signals
  const techAlerts = []
  if (psHttps  === false)                techAlerts.push('HTTPS absent — signal de sécurité critique pour Google')
  if (psPerf   !== null && psPerf < 30)  techAlerts.push(`Score performance mobile effondré (${psPerf}/100)`)
  if (lr && !lr.found)                   techAlerts.push('Établissement hors top 20 Google Maps local')
  if (psIndexed && psIndexed.signal === 'poor') techAlerts.push(`Seulement ${psIndexed.indexedPages} page(s) indexée(s) par Google`)
  const techAlertLine = techAlerts.length > 0
    ? `Signaux techniques critiques détectés : ${techAlerts.join(' — ')}.`
    : null

  const seoPrompt = `Tu es un expert SEO local. Analyse ces ${reviewCount ?? total} avis d'un commerce de type ${category ?? 'ce secteur'} à ${city ?? 'cette ville'}.

${techBlock}AVIS CLIENTS :
${reviewsText}

Produis une analyse en 5 points factuels. Croise les données techniques ci-dessus avec les avis clients quand c'est pertinent.

## MOTS-CLÉS OPPORTUNITÉS
Identifie 3-5 expressions exactes utilisées par les clients qui représentent des opportunités SEO — termes métier, géographiques ou de service que le site devrait intégrer dans ses balises title, meta description et contenu.${psSeo !== null && psSeo < 70 ? ` (Score SEO technique : ${psSeo}/100 — les balises sont probablement sous-optimisées.)` : ''} Cite les expressions entre guillemets.

## CONTENU MANQUANT
Identifie 2-3 sujets que les clients mentionnent dans leurs avis mais qui sont probablement absents du site web (FAQ, pages services, pages géographiques, pages événements).${psIndexed ? ` Le site n'a que ${psIndexed.indexedPages} page(s) indexée(s) — signe que le contenu est insuffisant.` : ''} Base-toi sur les questions posées et les informations cherchées dans les avis négatifs.

## SCORE RÉPUTATION LOCALE
Évalue la réputation locale de ce commerce en une phrase qui intègre : le volume d'avis (${reviewCount ?? total} avis), la note (${avgRating}/5), le taux de réponse (${unanswered} sans réponse)${rankLine ? ` et la position Maps (${rankLine})` : ''}. Dis ce que ça signifie concrètement pour sa crédibilité et sa visibilité auprès de nouveaux clients — sans formule, sans score chiffré.

## QUICK WIN
${quickWinHint}

## SIGNAL D'ALERTE
${techAlertLine ? techAlertLine + ' ' : ''}Si un problème critique existe dans les avis (note qui chute, plaintes récurrentes) → décris-le en 1 phrase factuelle. Sinon${techAlertLine ? ' sur le plan des avis' : ''} → "Aucun signal d'alerte critique détecté."

RÈGLES :
- Prose uniquement, jamais de bullet points
- Factuel et professionnel, jamais émotionnel
- Cite toujours les chiffres exacts fournis dans les données techniques
- Ne jamais inventer de données
- Maximum 300 mots au total`

  const prompts = {
    chatbot: `Tu es un expert en automatisation client pour les commerces locaux. Analyse ces ${reviewCount ?? total} avis de "${businessName}" (${category ?? 'ce secteur'}, ${city ?? 'cette ville'}).

DONNÉES CONTEXTUELLES :
- Note Google : ${rating ?? avgRating}/5
- Avis analysés : ${reviewCount ?? total}
- Avis sans réponse : ${unanswered}
- Chatbot existant : ${ps?.siteSignals?.chatbotDetected ? `Oui (${ps.siteSignals.chatbotTool})` : 'Non'}
- Plateforme réservation : ${ps?.siteSignals?.bookingPlatform ?? 'Aucune'}
- FAQ sur le site : ${ps?.siteSignals?.hasFAQ ? 'Présente' : 'Absente'}

AVIS CLIENTS :
${statsBlock}${reviewsText}

Produis une analyse en 5 sections. Prose uniquement — jamais de listes à puces. 300 mots maximum.

## QUESTIONS RÉCURRENTES
Identifie les 5 types de questions les plus fréquents dans les avis (horaires, tarifs, disponibilité, réservation, procédures). Pour chaque type, cite un extrait verbatim de l'avis concerné.

## CONTENU RAG DISPONIBLE
Identifie ce que le commerce possède comme contenu exploitable pour alimenter un assistant IA : menus, tarifs mentionnés, horaires récurrents, services décrits dans les avis. Sois strictement factuel.

## SIGNAL DÉBORDEMENT
Évalue le niveau de débordement à partir des avis sans réponse, des récurrences de demandes et des mentions de difficulté à joindre. Estime le volume de questions hebdomadaires automatisables sur la base des données réelles uniquement.

## QUICK WIN
Identifie l'action unique la plus impactante pour ce commerce — celle qui produirait le résultat le plus visible le plus rapidement.

## OPPORTUNITÉ ESTIMÉE
Donne une fourchette réaliste de questions par semaine que le chatbot pourrait traiter — exclusivement basé sur les données des avis, jamais inventé.

RÈGLES :
- Prose uniquement, jamais de listes
- Cite des extraits exacts des avis
- Ne jamais inventer de chiffres
- Factuel, jamais émotionnel`,

    seo: seoPrompt,

    'pub-google': header + `Fournis une analyse orientée PUBLICITÉ GOOGLE ADS avec :

## 📊 Résumé exécutif
- Attractivité commerciale globale (taux de satisfaction, volume d'avis)
- Points forts à mettre en avant dans les annonces
- Objections clients récurrentes à anticiper

## 🔴 Problèmes critiques (frein à la conversion)
- Avis négatifs susceptibles de freiner les conversions
- Cite des exemples précis

## 📊 Opportunité Google Ads
- Score de potentiel publicitaire (0-100)
- Argumentaires gagnants tirés des avis (USP réels)
- Ciblages d'audiences suggérés selon le profil clients

## 📝 Recommandations
- 3 actions pour maximiser le ROI publicitaire
- Exemple de titre d'annonce basé sur les avis

## 🎯 Pitch commercial
- 2-3 phrases pour vendre une campagne Google Ads à ce business` + footer,

    'social-media': header + `Fournis une analyse orientée RÉSEAUX SOCIAUX avec :

## 📊 Résumé exécutif
- Richesse du contenu potentiel (histoires clients, ambiance, savoir-faire)
- Émotions et expériences clés mentionnées dans les avis
- Thèmes de contenu récurrents exploitables

## 🔴 Problèmes critiques (image social media)
- Points négatifs qui nuisent à l'image en ligne
- Cite des exemples précis d'avis

## 📱 Opportunité social media
- Score de potentiel contenu (0-100)
- 5 idées de posts concrètes tirées des avis (format, angle, message)
- Réseaux les plus adaptés à ce business

## 📝 Recommandations
- 3 actions social media prioritaires
- Exemple de légende de post basé sur un avis réel

## 🎯 Pitch commercial
- 2-3 phrases pour vendre une gestion des réseaux sociaux à ce business` + footer,

    photographe: header + `Fournis une analyse orientée PHOTOGRAPHIE PROFESSIONNELLE avec :

## 📊 Résumé exécutif
- Qualité perçue de l'expérience visuelle (ambiance, présentation, décoration)
- Mentions de l'aspect visuel dans les avis
- Écart entre la qualité réelle et sa représentation en ligne

## 🔴 Problèmes critiques (image visuelle)
- Avis mentionnant l'absence ou la mauvaise qualité des photos
- Cite des exemples précis

## 📸 Opportunité photo
- Score de besoin en photographie (0-100)
- Sujets à photographier identifiés dans les avis (plats, ambiance, équipe, etc.)
- Impact estimé sur la visibilité Google Maps

## 📝 Recommandations
- 3 actions pour améliorer la présence visuelle
- Type de séance photo recommandée

## 🎯 Pitch commercial
- 2-3 phrases pour vendre une séance photo professionnelle à ce business` + footer,

    videaste: header + `Fournis une analyse orientée VIDÉO & CONTENU VIDÉO avec :

## 📊 Résumé exécutif
- Richesse narrative du business (histoires, savoir-faire, ambiance filmable)
- Expériences clients mentionnées qui se prêtent à la vidéo
- Potentiel viral ou émotionnel

## 🔴 Problèmes critiques (visibilité vidéo)
- Absence de contenu vidéo mentionnée ou sous-exploitation
- Cite des exemples précis d'avis

## 🎬 Opportunité vidéo
- Score de potentiel vidéo (0-100)
- 3 concepts de vidéos concrètes tirés des avis
- Formats recommandés (reels, témoignages, coulisses)

## 📝 Recommandations
- 3 actions vidéo prioritaires
- Exemple de script ou angle de vidéo basé sur un avis réel

## 🎯 Pitch commercial
- 2-3 phrases pour vendre une production vidéo à ce business` + footer,

    designer: header + `Fournis une analyse orientée BRANDING & DESIGN avec :

## 📊 Résumé exécutif
- Perception de l'image de marque dans les avis (cohérence, professionnalisme)
- Adjectifs récurrents utilisés pour décrire le business
- Écart entre la réputation et l'identité visuelle supposée

## 🔴 Problèmes critiques (image de marque)
- Incohérences ou commentaires négatifs sur l'image ou le cadre
- Cite des exemples précis

## 🎨 Opportunité branding
- Score de besoin en rebranding (0-100)
- Valeurs et positionnement à renforcer selon les avis
- Supports prioritaires à améliorer

## 📝 Recommandations
- 3 actions design/branding prioritaires
- Direction créative suggérée

## 🎯 Pitch commercial
- 2-3 phrases pour vendre une prestation branding à ce business` + footer,

    copywriter: header + `Fournis une analyse orientée COPYWRITING & CONTENU avec :

## 📊 Résumé exécutif
- Richesse du vocabulaire client (expressions authentiques utilisables)
- Arguments de vente réels cités dans les avis
- Objections et freins récurrents

## 🔴 Problèmes critiques (contenu & conversion)
- Avis révélant des incompréhensions, des attentes non comblées
- Cite des exemples précis

## ✍️ Opportunité copywriting
- Score de potentiel copywriting (0-100)
- 5 expressions clés tirées des avis à réutiliser dans les textes
- Pages ou supports prioritaires à réécrire

## 📝 Recommandations
- 3 actions contenu prioritaires
- Exemple d'accroche de page d'accueil basé sur les avis

## 🎯 Pitch commercial
- 2-3 phrases pour vendre une prestation copywriting à ce business` + footer,

    'dev-web': header + `Fournis une analyse orientée DÉVELOPPEMENT WEB avec :

## 📊 Résumé exécutif
- Mentions du site web ou de l'expérience digitale dans les avis
- Attentes clients en matière d'information en ligne (horaires, réservation, menu, prix)
- Frustrations liées à l'absence d'information ou de fonctionnalités

## 🔴 Problèmes critiques (présence web)
- Avis révélant un manque d'information ou des problèmes de contact
- Cite des exemples précis

## 💻 Opportunité web
- Score de besoin en site web / refonte (0-100)
- Fonctionnalités prioritaires à développer selon les avis
- Pages indispensables identifiées

## 📝 Recommandations
- 3 actions web prioritaires
- Structure de site suggérée

## 🎯 Pitch commercial
- 2-3 phrases pour vendre une création ou refonte de site à ce business` + footer,

    'email-marketing': header + `Fournis une analyse orientée EMAIL MARKETING & FIDÉLISATION avec :

## 📊 Résumé exécutif
- Niveau de fidélité client perçu dans les avis (clients réguliers vs one-shot)
- Occasions de contact identifiées (anniversaires, saisonnalité, offres)
- Potentiel de recommandation et bouche-à-oreille

## 🔴 Problèmes critiques (rétention)
- Clients perdus ou déçus qui ne reviendraient pas
- Cite des exemples précis

## 📧 Opportunité email marketing
- Score de potentiel fidélisation (0-100)
- 3 séquences email suggérées selon le comportement client observé
- Offres ou messages à tester

## 📝 Recommandations
- 3 actions email marketing prioritaires
- Exemple d'objet d'email basé sur les avis

## 🎯 Pitch commercial
- 2-3 phrases pour vendre une stratégie email marketing à ce business` + footer,

    'consultant-seo': seoPrompt,
  }

  const base = prompts[profileId] ?? prompts['chatbot']
  return ctx + focusBlock + base
}

// ── Main export ───────────────────────────────────────────────────────────────
async function analyzeWithAI(reviews, businessName, profileId = 'chatbot', meta = {}, auditData = null) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  console.log(`[aiReviewAnalysis] analyzeWithAI — business: "${businessName}" | reviews: ${reviews.length} | profileId: "${profileId}"`)
  console.log(`[aiReviewAnalysis] Profil reçu: ${profileId} | site: ${meta.websiteUrl ?? 'absent'} | ville: ${meta.city ?? '?'}`)
  console.log(`[aiReviewAnalysis] auditData disponible: ${auditData ? 'oui' : 'non (analyse reviews uniquement)'}`)
  console.log(`[aiReviewAnalysis] ANTHROPIC_API_KEY présente: ${!!apiKey} | longueur: ${apiKey?.length ?? 0}`)

  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY manquante dans .env — ajoutez votre clé Anthropic pour activer l\'analyse IA')
  }

  const anthropic = new Anthropic({ apiKey })

  const { selected, total } = selectRepresentativeReviews(reviews)
  console.log(`[aiReviewAnalysis] avis sélectionnés: ${selected.length}/${total}`)

  // ── Compute corpus statistics from all reviews (not just selected) ──────────
  const starDist = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 }
  let repliedCount = 0
  reviews.forEach(r => {
    starDist[r.rating] = (starDist[r.rating] || 0) + 1
    if (r.ownerReply) repliedCount++
  })
  const replyRate        = total > 0 ? Math.round(repliedCount / total * 100) : 0
  const questionAnalysis = countQuestionsInReviews(reviews)
  const loyaltyData      = detectLoyaltyMentions(reviews)
  const langData         = detectLanguages(reviews)
  const emailThemeData   = detectEmailThemes(reviews)
  const stats = {
    total,
    starDist,
    replyRate,
    questionCount:   questionAnalysis.totalQuestions,
    topThemes:       emailThemeData.themes.slice(0, 5).map(t => t.label),
    loyaltyMentions: loyaltyData.loyaltyMentions,
    languages:       langData.languages,
  }

  const reviewsText = selected.map((r, i) =>
    `[${i + 1}] ${r.rating}★ — ${r.author} (${r.date ? new Date(r.date).toLocaleDateString('fr-FR') : '?'})\n` +
    `${r.text || '(sans texte)'}\n` +
    (r.ownerReply ? `Réponse propriétaire : ${r.ownerReply}\n` : '') +
    (r.likes ? `❤️ ${r.likes} likes\n` : '')
  ).join('\n---\n')

  const unanswered    = selected.filter(r => !r.ownerReply && r.rating <= 2).length
  const negativeCount = selected.filter(r => r.rating <= 2).length
  const avgRating     = (selected.reduce((s, r) => s + (r.rating || 0), 0) / selected.length).toFixed(1)

  console.log(`[aiReviewAnalysis] avis négatifs: ${negativeCount}/${selected.length} (${Math.round(negativeCount / selected.length * 100)}%)`)

  const prompt = buildPrompt(businessName, reviewsText, total, avgRating, unanswered, profileId, meta, auditData, negativeCount, stats)

  const MODEL = 'claude-sonnet-4-6'
  console.log(`[aiReviewAnalysis] → appel API Anthropic (model: ${MODEL}, prompt: ${prompt.length} chars)`)

  let message
  try {
    message = await anthropic.messages.create({
      model:      MODEL,
      max_tokens: 1500,
      messages:   [{ role: 'user', content: prompt }],
    })
  } catch (err) {
    console.error('[aiReviewAnalysis] ✗ Erreur Anthropic API:')
    console.error('  status   :', err.status)
    console.error('  name     :', err.name)
    console.error('  message  :', err.message)
    console.error('  error    :', JSON.stringify(err.error ?? null))
    throw new Error(`Anthropic API error (status ${err.status ?? '?'}): ${err.message}`)
  }

  console.log(`[aiReviewAnalysis] ✓ réponse reçue (tokens: ${message.usage?.output_tokens ?? '?'}, stop: ${message.stop_reason})`)

  return {
    report:       message.content[0].text,
    profileId,
    reviewsUsed:  selected.length,
    totalReviews: total,
    avgRating:    parseFloat(avgRating),
    unanswered,
    websiteUrl:   meta.websiteUrl ?? null,
    hasWebsite:   !!meta.websiteUrl,
    city:         meta.city ?? null,
  }
}

// ── Extract top quotes from reviews ───────────────────────────────────────────
function extractTopQuotes(reviewsData) {
  if (reviewsData?.topQuotes?.length > 0) return reviewsData.topQuotes
  const reviews = reviewsData?.reviews || []
  return reviews
    .filter(r => (r.rating || 0) >= 4 && (r.text || '').trim().length > 20)
    .sort((a, b) => (b.text?.length || 0) - (a.text?.length || 0))
    .slice(0, 3)
    .map(r => r.text.trim().substring(0, 200))
}

// ── Email generator — PHOTOGRAPHE profile ─────────────────────────────────────
async function generateEmailPhotographe({ leadData, visualAnalysis, googleData, siteAnalysis, reviewsData, facebookActivity, instagramActivity, photoQuality }) {
  console.log('[generateEmailPhotographe] reçu:', JSON.stringify({
    name: leadData?.name,
    city: leadData?.city,
    reviewCount: leadData?.reviewCount
  }))
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY manquante')

  const topQuotes = extractTopQuotes(reviewsData)
  const hasInstagram = !!(siteAnalysis?.socialLinks?.instagram || googleData?.hasInstagram)
  const date = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })

  const obsText = Array.isArray(visualAnalysis?.observations)
    ? visualAnalysis.observations.map(o => `- [${o.level}] ${o.text}`).join('\n')
    : '—'

  const quotesText = topQuotes.length > 0
    ? topQuotes.map(q => `"${q}"`).join('\n')
    : '— (aucune citation disponible — ne pas inventer de citations)'

  const reviews = reviewsData?.reviews ?? []
  const negativeRatio = reviews.length > 0
    ? reviews.filter(r => (r.rating ?? 5) <= 2).length / reviews.length
    : 0
  const highNegativeRatio = negativeRatio > 0.5

  const fbLabel  = facebookActivity?.status === 'unknown' ? null : facebookActivity?.label  ?? null
  const igLabel  = instagramActivity?.status === 'unknown' ? null : instagramActivity?.label ?? null
  const fbFollowers = facebookActivity?.followers  ?? null
  const igFollowers = instagramActivity?.followers ?? null

  console.log(`[generateEmailPhotographe] topQuotes: ${topQuotes.length} citations | Instagram: ${hasInstagram ? 'présent' : 'absent'} | score visuel: ${visualAnalysis?.score ?? '—'} | FB: ${fbLabel ?? 'n/a'} | IG: ${igLabel ?? 'n/a'}`)
  console.log('[EmailPhotographe] données reçues:', {
    photoCount:          googleData?.photoCount,
    hasInstagram:        hasInstagram,
    instagramDaysAgo:    instagramActivity?.daysAgo,
    instagramStatus:     instagramActivity?.status,
    facebookFollowers:   facebookActivity?.followers,
    visualScore:         visualAnalysis?.score,
    visualVerdict:       visualAnalysis?.verdict,
    topQuotesCount:      topQuotes?.length,
  })

  const photoCount        = googleData?.photoCount ?? 0
  const redObs            = visualAnalysis?.observations?.find(o => o.level === 'red')?.text ?? null
  const igLowActivity     = instagramActivity?.status === 'low_active' || instagramActivity?.status === 'inactive'
  const city              = leadData.city || ''
  const competitorDelta   = leadData.competitorDelta ?? null
  const igDaysAgo         = (instagramActivity?.status !== 'unknown' && instagramActivity?.daysAgo != null) ? instagramActivity.daysAgo : null

  // item 3 — real avg rating computed from reviews array (may differ from Google's displayed rating)
  const reviewsAvgRating  = reviews.length >= 3
    ? parseFloat((reviews.reduce((s, r) => s + (r.rating ?? 5), 0) / reviews.length).toFixed(1))
    : null

  // item 4 — unanswered reviews count
  const unanswered = reviews.filter(r => !r.ownerReply && !r.reply).length

  // P3 — dissonance entre expérience clients et photos actuelles, verrouillée en JS
  const visualWords = topQuotes.slice(0, 2).join(' / ')
  const p3Hint = topQuotes.length > 0
    ? `${leadData.reviewCount} personnes ont décrit chez vous ${visualWords}. Mais celui qui découvre votre fiche pour la première fois ne retrouve pas cette histoire — les photos actuelles ne restituent pas ce que vos clients vivent réellement. Cette réputation existe — elle reste juste invisible.`
    : `${leadData.reviewCount} personnes ont partagé leur expérience chez vous. Mais celui qui découvre votre fiche pour la première fois ne retrouve pas cette histoire — les photos actuelles ne restituent pas ce que vos clients vivent réellement. Cette réputation existe — elle reste juste invisible.`

  // Social context lines — only include when data is available
  const socialLines = [
    igFollowers != null                        ? `- Abonnés Instagram : ${igFollowers}` : null,
    igDaysAgo   != null                        ? `- Dernier post Instagram : il y a ${igDaysAgo} jours` : null,
    fbFollowers != null                        ? `- Abonnés Facebook : ${fbFollowers}` : null,
  ].filter(Boolean).join('\n')

  const prompt = `Tu es un photographe professionnel. Rédige un email de prospection pour un commerce local.
Ton : chaleureux, direct, sincère — jamais vendeur, jamais de liste à puces dans le corps.

RÈGLE ABSOLUE — ZÉRO NOM DE MARQUE : N'utilise aucun nom de marque, outil ou plateforme commerciale dans tes recommandations. Interdit : Planity, Reservio, Hootsuite, Buffer, Canva, Mailchimp, Brevo, HubSpot, Calendly, WordPress, Webflow, Shopify, Wix, Crisp, Tidio, Intercom, Semrush, Ahrefs, etc. Utilise uniquement des descriptions génériques : "outil de réservation en ligne", "plateforme de gestion des réseaux sociaux", "solution d'email marketing", "logiciel de chat en ligne", "outil de planification éditoriale".

DONNÉES RÉELLES — UTILISER UNIQUEMENT CES CHIFFRES :
- Nom : ${leadData.name}
- Ville : ${city || '—'}
- Catégorie : ${leadData.category ?? 'commerce local'}
- Note Google affichée : ${leadData.rating}/5 (INTERDIT d'écrire un autre chiffre)${reviewsAvgRating !== null ? `\n- Note réelle des derniers avis analysés : ${reviewsAvgRating}/5 (INTERDIT d'écrire un autre chiffre — le total d'avis Google reste ${leadData.reviewCount})` : ''}
- Nombre d'avis : ${leadData.reviewCount} (INTERDIT d'écrire un autre chiffre)
- Avis sans réponse du propriétaire : ${unanswered} sur les ${leadData.reviewCount} derniers avis analysés (total Google : ${leadData.reviewCount})${visualAnalysis?.score != null ? `\n- Score qualité visuelle Instagram : ${visualAnalysis.score}/100` : ''}
- Citations exactes des avis : ${quotesText}
- Mots-clés récurrents dans les avis : ${reviewsData?.keywords?.join(', ') ?? '—'}${socialLines ? '\n' + socialLines : ''}

STRUCTURE OBLIGATOIRE EN 5 PARAGRAPHES :

OBJET :
"${leadData.name} — ce que vos clients décrivent, personne ne le voit encore"

SALUTATION :
${leadData.decisionMaker?.name ? `"Bonjour ${leadData.decisionMaker.name},"` : '"Bonjour,"'}

P1 — ACCROCHE (recopier quasi-exactement) :
"Je suis photographe spécialisé dans la mise en valeur des commerces locaux que j'aime mettre en lumière — au sens propre comme au sens figuré.
Il y a quelques jours, je suis tombé sur ${leadData.name} — et vos avis m'ont arrêté."

P2 — CE QUE LES CLIENTS RESSENTENT :
Tisser 2 citations EXACTES de topQuotes dans un récit fluide — JAMAIS une liste.
Terminer OBLIGATOIREMENT par : "Ce n'est pas le genre d'expérience qu'on fabrique."
Si aucune citation disponible → décrire l'ambiance ressentie à travers les mots-clés des avis.

P3 — LE FOSSÉ (dissonance entre expérience clients et photos) :
Reformuler naturellement en prose ce texte verrouillé : "${p3Hint}"
Ce P3 doit exprimer la dissonance entre l'expérience décrite par les clients dans leurs avis et ce que les photos actuelles restituent.
Ne jamais dire "ce que vous voyez" ou "il n'y a pas assez de photos".
Dire que les photos ne racontent pas la même histoire que les clients.
Terminer OBLIGATOIREMENT par : "Cette réputation existe — elle reste juste invisible."

P4 — CE QU'ON A IDENTIFIÉ (en prose, jamais de liste) :
"En regardant ${leadData.name}, j'ai identifié exactement ce qui mériterait d'être capturé : {sujet 1}, {sujet 2} et {sujet 3}."
Les 3 sujets doivent être TRÈS SPÉCIFIQUES à ce commerce — tirés des mots-clés des avis et du type d'activité.
Jamais de sujets génériques comme "intérieur" ou "équipe".

P5 — CTA :
"Ensemble, on peut faire en sorte que votre présence en ligne reflète enfin ce que vos clients vivent chez vous.
Un appel de 15 minutes suffit pour voir si on peut faire quelque chose ensemble."

SIGNATURE (recopier exactement) :
Photographe commerce local — ${city || 'Paris'}

${EMAIL_STATS_NOTE}

RÈGLES ABSOLUES :
- Jamais de liste à puces dans le corps de l'email
- Jamais "j'ai analysé votre présence"
- Jamais "Cordialement"
- Jamais de mot technique (SEO, conversion, KPI...)
- INTERDIT d'écrire un nombre d'avis différent de ${leadData.reviewCount} — même approximativement
- INTERDIT d'écrire un autre chiffre que ${leadData.reviewCount} pour le total d'avis Google
- INTERDIT d'écrire une note différente de ${leadData.rating}${reviewsAvgRating !== null ? ` ou ${reviewsAvgRating}` : ''} — même approximativement
- Jamais de chiffre inventé — chaque chiffre mentionné doit figurer dans la liste DONNÉES RÉELLES ci-dessus
- Jamais le statut ouvert/fermé ni les horaires
- Jamais [Prénom], [Email], [Téléphone] ni aucun placeholder entre crochets
- Maximum 200 mots
- Vérifier avant de terminer que chaque chiffre mentionné est dans la liste ci-dessus

Retourne UNIQUEMENT un JSON valide :
{"subject":"...","body":"..."}`

  const anthropic = new Anthropic({ apiKey })
  console.log(`[generateEmailPhotographe] → appel Anthropic (prompt: ${prompt.length} chars)`)

  let message
  try {
    message = await anthropic.messages.create({
      model:      'claude-sonnet-4-6',
      max_tokens: 800,
      messages:   [{ role: 'user', content: prompt }],
    })
  } catch (err) {
    console.error('[generateEmailPhotographe] ✗ Erreur Anthropic:', err.message)
    throw new Error(`Erreur génération email photographe: ${err.message}`)
  }

  const raw = message.content[0].text
  console.log(`[generateEmailPhotographe] ✓ réponse reçue (${raw.length} chars)`)

  const jsonMatch = raw.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('Réponse invalide — JSON introuvable')
  const parsed = JSON.parse(jsonMatch[0])

  const cleaned = parsed.body
    .replace(/^---+$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  return { subject: parsed.subject, body: cleaned }
}

// ── Email generator — SEO / CONSULTANT-SEO profile ───────────────────────────
async function generateEmailSEO({ leadData, pagespeedData, localRank, reviewsData, napData }) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY manquante')

  const anthropic = new Anthropic({ apiKey })

  const name        = leadData.name        ?? 'ce commerce'
  const city        = leadData.city        ?? ''
  const category    = leadData.category    ?? 'ce secteur'
  const website     = leadData.website     ?? null
  const rating      = leadData.rating      ?? null
  const reviewCount = leadData.reviewCount ?? null

  const performance    = pagespeedData?.performance    ?? null
  const seoScore       = pagespeedData?.seo            ?? null
  const loadTime       = pagespeedData?.loadTime       ?? null
  const https          = pagespeedData?.https          ?? null
  const sitemap        = pagespeedData?.sitemap        ?? null
  const cms            = pagespeedData?.cms?.cms       ?? null

  const rankFound = localRank?.found    ?? false
  const rank      = localRank?.rank     ?? null
  const topThree  = localRank?.topThree ?? false
  const topTen    = localRank?.topTen   ?? false

  const unanswered = reviewsData?.unanswered ?? 0
  const keywords   = reviewsData?.keywords   ?? []

  // ── P1 — accroche technique verrouillée côté JS ──────────────────────────────
  let p1Hint
  const lt = loadTime != null ? parseFloat(loadTime) : null
  if (lt !== null && lt > 8 && performance !== null) {
    p1Hint = `En passant votre site dans Google PageSpeed Insights, j'ai obtenu un score de performance mobile de ${performance}/100 — Google considère ce niveau comme insuffisant et le pénalise dans le classement local.`
  } else if (lt !== null && lt > 8) {
    p1Hint = `Google PageSpeed Insights attribue à votre site un score de performance mobile insuffisant — ce signal technique pèse directement sur votre positionnement dans les résultats locaux.`
  } else if (performance !== null && performance < 50) {
    p1Hint = `En passant votre site dans Google PageSpeed Insights, j'ai obtenu un score de performance mobile de ${performance}/100 — Google considère ce niveau comme insuffisant et le pénalise dans le classement local.`
  } else if (!rankFound) {
    p1Hint = `En cherchant "${category} ${city}" sur Google Maps, votre établissement n'apparaît pas dans les 20 premiers résultats.`
  } else {
    p1Hint = `En auditant votre présence en ligne, j'ai identifié plusieurs points techniques qui freinent votre visibilité sur Google.`
  }

  // ── P4 — 3 problèmes prioritaires verrouillés côté JS ───────────────────────
  const problemPool = []
  if (lt !== null && lt > 8)                 problemPool.push('la vitesse de chargement')
  if (!rankFound)                            problemPool.push('votre invisibilité sur Google Maps local')
  if (performance !== null && performance < 50) problemPool.push('les performances mobiles')
  if (https === false)                       problemPool.push('la sécurité HTTPS')
  if (sitemap === false)                     problemPool.push("l'indexation Google")
  if (unanswered > 0)                        problemPool.push('les avis clients sans réponse qui nuisent à la crédibilité de votre fiche aux yeux de Google')

  const fallbacks = ['le référencement local', 'la visibilité organique', "l'optimisation technique"]
  while (problemPool.length < 3) problemPool.push(fallbacks[problemPool.length])
  const [prob1, prob2, prob3] = problemPool.slice(0, 3)

  const keywordsText = keywords.length > 0 ? keywords.slice(0, 5).join(', ') : '—'
  const rankLabel    = rankFound
    ? (topThree ? `Top 3 (position ${rank})` : topTen ? `Top 10 (position ${rank})` : `Position ${rank}`)
    : 'Hors top 20'

  // ── NAP — message spécifique selon les champs en incohérence ─────────────
  let napParagraphHint = null
  if (napData?.napScore === 'not_found') {
    napParagraphHint = `Votre commerce ne figure pas sur PagesJaunes — ce manque de présence sur les annuaires est un signal négatif pour le classement local de Google.`
  } else if (napData?.napScore === 'inconsistent') {
    const napIssues  = napData.issues ?? []
    const hasPhone   = napIssues.some(i => i.toLowerCase().includes('téléphone'))
    const hasAddress = napIssues.some(i => i.toLowerCase().includes('adresse'))
    const fields     = [hasPhone && 'votre numéro de téléphone', hasAddress && 'votre adresse'].filter(Boolean)
    const fieldText  = fields.length > 0
      ? fields.join(' et ') + ' ne correspondent pas'
      : 'vos coordonnées ne sont pas identiques'
    napParagraphHint = `${fieldText.charAt(0).toUpperCase() + fieldText.slice(1)} entre votre fiche Google et PagesJaunes — Google pénalise ces incohérences dans le classement local.`
  }

  const prompt = `Tu es un consultant SEO local. Rédige un email de prospection pour ${name}.
Ton : professionnel, direct, factuel — jamais vendeur, jamais de liste à puces dans le corps.

RÈGLE ABSOLUE — ZÉRO NOM DE MARQUE : N'utilise aucun nom de marque, outil ou plateforme commerciale dans tes recommandations. Interdit : Planity, Reservio, Hootsuite, Buffer, Canva, Mailchimp, Brevo, HubSpot, Calendly, WordPress, Webflow, Shopify, Wix, Crisp, Tidio, Intercom, Semrush, Ahrefs, etc. Utilise uniquement des descriptions génériques : "outil de réservation en ligne", "plateforme de gestion des réseaux sociaux", "solution d'email marketing", "logiciel de chat en ligne", "outil de planification éditoriale".

DONNÉES TECHNIQUES VERROUILLÉES — UTILISER UNIQUEMENT CES CHIFFRES :
- Nom du commerce : ${name}
- Ville : ${city || '—'}
- Catégorie : ${category}
- Site web : ${website || 'absent'}
- Note Google : ${rating ?? '—'}/5
- Nombre d'avis : ${reviewCount ?? '—'}
- Score performance mobile : ${performance ?? '—'}/100
- Score SEO technique : ${seoScore ?? '—'}/100
- Temps de chargement : ${loadTime ?? '—'}s
- Position Google Maps locale : ${rankLabel}
- CMS détecté : ${cms ?? 'non identifié'}
- Mots-clés récurrents : ${keywordsText}

STRUCTURE OBLIGATOIRE EN 5 PARAGRAPHES :

OBJET : ${name} — un point sur votre visibilité Google locale

SALUTATION : "Bonjour,"

P1 — ACCROCHE TECHNIQUE (reformuler naturellement en prose, sans déformer le sens) :
"${p1Hint}"

P2 — PROBLÈMES CONCRETS :
2-3 problèmes réels tirés des données ci-dessus avec chiffres exacts, en prose fluide.
Ne jamais inventer un chiffre absent de la liste ci-dessus.

P3 — IMPACT BUSINESS :
Expliquer ce que ces problèmes coûtent concrètement en clients perdus.
Terminer OBLIGATOIREMENT par : "Cette visibilité existe — elle reste juste inexploitée."

P4 — CE QUE TU CORRIGES (reformuler en prose naturelle, pas de liste) :
"J'interviens exactement sur ces points : ${prob1}, ${prob2} et ${prob3}."${napParagraphHint ? `

P4B — INCOHÉRENCE NAP (ajouter après P4, en prose courte) :
"${napParagraphHint}"` : ''}

P5 — CTA (recopier exactement) :
"Un audit complet de 30 minutes suffit pour identifier toutes les corrections prioritaires.
Auriez-vous 15 minutes cette semaine pour en discuter ?

Consultant SEO local — ${city || 'France'}"

${EMAIL_STATS_NOTE}

RÈGLES ABSOLUES :
- Jamais de liste à puces dans le corps de l'email
- Jamais "Bonjour [nom]" — uniquement "Bonjour,"
- Jamais [Votre prénom], [Votre numéro] ni aucun placeholder entre crochets
- Jamais "j'ai analysé vos avis" — partir du site ou de la position Google
- Chaque chiffre mentionné doit figurer dans la liste DONNÉES TECHNIQUES ci-dessus
- INTERDIT d'écrire un autre chiffre que ${reviewCount} pour le total d'avis Google
- Maximum 200 mots
- Ton factuel, jamais émotionnel ou flatteur

Retourne UNIQUEMENT un JSON valide :
{"subject":"...","body":"..."}`

  console.log(`[generateEmailSEO] ${name} | city:${city} | loadTime:${loadTime ?? 'n/a'} | rank:${rank ?? 'n/a'} | prompt: ${prompt.length} chars`)

  let message
  try {
    message = await anthropic.messages.create({
      model:      'claude-sonnet-4-6',
      max_tokens: 800,
      messages:   [{ role: 'user', content: prompt }],
    })
  } catch (err) {
    console.error('[generateEmailSEO] ✗ Erreur Anthropic:', err.message)
    throw new Error(`Erreur génération email SEO: ${err.message}`)
  }

  const raw = message.content[0].text
  console.log(`[generateEmailSEO] ✓ réponse reçue (${raw.length} chars)`)

  const jsonMatch = raw.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('Réponse invalide — JSON introuvable')
  const parsed = JSON.parse(jsonMatch[0])

  const cleaned = parsed.body
    .replace(/^---+$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  return { subject: parsed.subject, body: cleaned }
}

// ── Email generator — CHATBOT / DEV-CHATBOT profile ──────────────────────────
async function generateEmailChatbot({ leadData, pagespeedData, reviewsData }) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY manquante')

  const anthropic = new Anthropic({ apiKey })

  const name        = leadData.name        ?? 'ce commerce'
  const city        = leadData.city        ?? ''
  const category    = leadData.category    ?? 'ce secteur'
  const website     = leadData.website     ?? null
  const rating      = leadData.rating      ?? null
  const reviewCount = leadData.reviewCount ?? null

  // pagespeedData peut être flat (getSiteSignals, profil chatbot) ou imbriqué (getPageSpeed, profil SEO)
  const siteSignals     = pagespeedData?.siteSignals ?? pagespeedData ?? null
  const bookingPlatform = siteSignals?.bookingPlatform ?? null

  // Données avis
  const unansweredReviews = reviewsData?.unanswered ?? null
  const keywords          = reviewsData?.keywords ?? []
  const reviewThemesText  = keywords.length > 0 ? keywords.slice(0, 5).join(', ') : '—'

  // Questions détectées dans les avis (reviews contenant "?")
  const reviews = reviewsData?.reviews ?? []
  const questionsFound = reviews
    .filter(r => (r.text ?? '').includes('?'))
    .slice(0, 3)
    .map(r => `"${(r.text ?? '').substring(0, 80).trim()}${(r.text?.length ?? 0) > 80 ? '…' : ''}"`)
  const questionsInReviewsText = questionsFound.length > 0
    ? questionsFound.join(' / ')
    : keywords.length > 0 ? `Questions sur : ${keywords.slice(0, 3).join(', ')}` : '—'

  const bookingText = bookingPlatform ? 'Oui (outil de réservation en ligne détecté)' : 'Non'

  const prompt = `Tu rédiges un email de prospection à froid pour un développeur chatbot/IA local qui contacte un commerce.

DONNÉES DU PROSPECT (utilise-les dans l'email) :
- Nom du commerce : ${name}
- Note Google : ${rating ?? '—'}/5
- Nombre d'avis : ${reviewCount ?? '—'}
- Avis sans réponse : ${unansweredReviews ?? '—'}
- Questions détectées dans les avis : ${questionsInReviewsText}
- Thèmes récurrents des avis : ${reviewThemesText}
- Réservation en ligne : ${bookingText}
- Secteur : ${category}

STRUCTURE OBLIGATOIRE DE L'EMAIL (5 lignes max entre l'intro et le CTA) :

1. OBJET : Doit mentionner le nom du commerce + un chiffre concret tiré de l'analyse (ex: "Institut Sarah Beauté — vos 15 avis sans réponse perdent des clientes"). Ne JAMAIS utiliser un objet vague ou générique.

2. ACCROCHE (1 ligne) : Commencer par un fait concret tiré des avis du prospect. Pas "probablement" ni "peut-être". Utiliser les vrais thèmes détectés. Exemples :
   - "Vos clientes demandent si les hommes sont acceptés, combien coûte le blanchiment, et si les forfaits incluent 1h ou 1h30 — j'ai lu vos 30 avis Google."
   - "14 de vos 30 avis Google posent des questions sur vos horaires, tarifs ou soins disponibles."

3. PROBLÈME (1-2 lignes) : Quantifier la perte avec les données du prospect. Exemples :
   - "15 de ces avis n'ont pas de réponse. À chaque question sans réponse rapide, la cliente réserve chez un concurrent ouvert en ligne."
   - "Votre équipe traite ces demandes une par une entre deux soins."

4. SOLUTION (2 lignes max) : Ce qu'un assistant IA changerait concrètement pour CE commerce. Mentionner les cas d'usage spécifiques au secteur :
   - Institut beauté : prise de RDV par type de soin, réponse aux questions sur les prestations/tarifs, disponibilités en temps réel
   - Restaurant : réservation, menu du jour, allergies
   - Médical : motif de consultation, documents à apporter
   NE PAS expliquer comment fonctionne l'IA. Le commerçant veut le résultat, pas la technique.

5. CTA (1 ligne) : Proposer un échange court avec une question directe. Exemples :
   - "Ça vous dirait que je vous montre en 10 minutes ce que ça donnerait sur votre institut ?"
   - "Est-ce que vous avez 10 minutes cette semaine pour un test rapide sur votre commerce ?"

RÈGLES STRICTES :
- Maximum 6-8 lignes au total (hors signature). Un commerçant lit sur mobile entre deux clients.
- JAMAIS de stats génériques (pas de "48% des recherches...", pas de "76% des..."). Le seul chiffre autorisé vient des données du prospect (ses avis, son score, ses questions).
- JAMAIS de nom de marque (pas Planity, pas Doctolib, pas Crisp). Dire "votre outil de réservation" ou "votre solution de prise de RDV".
- JAMAIS "probablement", "peut-être", "il est possible que". Utiliser les données concrètes.
- JAMAIS de paragraphe technique sur l'IA, le RAG, les modèles de langage.
- Ton : direct, factuel, humain. Comme un artisan local qui parle à un autre artisan. Pas un commercial SaaS.
- Signature : [Votre prénom] + [Votre rôle] + Strasbourg + [Votre numéro]

Retourne UNIQUEMENT un JSON valide :
{"subject":"...","body":"Corps complet de l'email avec sauts de ligne \\n"}`

  console.log(`[generateEmailChatbot] ${name} | city:${city} | category:${category} | booking:${bookingPlatform ?? 'none'} | unanswered:${unansweredReviews ?? '—'} | prompt:${prompt.length} chars`)

  let message
  try {
    message = await anthropic.messages.create({
      model:      'claude-sonnet-4-6',
      max_tokens: 700,
      messages:   [{ role: 'user', content: prompt }],
    })
  } catch (err) {
    console.error('[generateEmailChatbot] ✗ Erreur Anthropic:', err.message)
    throw new Error(`Erreur génération email chatbot: ${err.message}`)
  }

  const raw = message.content[0].text
  console.log(`[generateEmailChatbot] ✓ réponse reçue (${raw.length} chars)`)

  const jsonMatch = raw.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('Réponse JSON invalide du modèle')
  try {
    return JSON.parse(jsonMatch[0])
  } catch (e) {
    throw new Error(`Parse JSON échoué: ${e.message}`)
  }
}

// ── Audit prospect — SEO / CONSULTANT-SEO profile ────────────────────────────
async function generateAuditSEO({ leadData, pagespeedData, localRank, reviewsData, napData, facebookActivity, instagramActivity }) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY manquante')

  const anthropic = new Anthropic({ apiKey })

  const name        = leadData.name        ?? 'ce commerce'
  const city        = leadData.city        ?? ''
  const category    = leadData.category    ?? 'ce secteur'
  const website     = leadData.website     ?? null
  const rating      = leadData.rating      ?? null
  const reviewCount = leadData.reviewCount ?? null
  const address     = leadData.address     ?? null

  const performance  = pagespeedData?.performance  ?? null
  const seoScore     = pagespeedData?.seo          ?? null
  const loadTime     = pagespeedData?.loadTime     ?? null
  const https        = pagespeedData?.https        ?? null
  const sitemap      = pagespeedData?.sitemap      ?? null
  const cms          = pagespeedData?.cms?.cms     ?? null
  const issues       = pagespeedData?.issues       ?? []

  const googleAudit  = leadData.googleAudit ?? null
  const hasPhotos    = googleAudit?.hasPhotos    ?? null
  const photoCount   = googleAudit?.photoCount   ?? null
  const hasHours     = googleAudit?.hasHours     ?? null
  const hasDescription = googleAudit?.hasDescription ?? null

  const rankFound = localRank?.found    ?? false
  const rank      = localRank?.rank     ?? null
  const topThree  = localRank?.topThree ?? false
  const topTen    = localRank?.topTen   ?? false
  const rankLabel = rankFound
    ? (topThree ? `Top 3 (position ${rank})` : topTen ? `Top 10 (position ${rank})` : `Position ${rank}`)
    : 'Hors top 20'

  const unanswered    = reviewsData?.unanswered ?? 0
  const keywords      = reviewsData?.keywords   ?? []
  const keywordsText  = keywords.length > 0 ? keywords.slice(0, 5).join(', ') : '—'

  const napScore   = napData?.napScore ?? null
  const napIssues  = napData?.issues   ?? []

  // ── Forces détectées côté JS (verrouillées dans le prompt) ─────────────────
  const forcesHints = []
  if (rating !== null && rating >= 4)        forcesHints.push(`Bonne note Google (${rating}/5)`)
  if (reviewCount !== null && reviewCount > 50) forcesHints.push(`Volume d'avis significatif (${reviewCount} avis)`)
  if (website)                               forcesHints.push('Site web présent')
  if (rankFound && topTen)                   forcesHints.push(`Visible sur Google Maps (${rankLabel})`)
  if (hasPhotos && photoCount > 5)           forcesHints.push(`Fiche Google illustrée (${photoCount} photos)`)
  if (https === true)                        forcesHints.push('Site sécurisé HTTPS')
  if (sitemap === true)                      forcesHints.push('Sitemap XML détecté')
  if (performance !== null && performance >= 70) forcesHints.push(`Bonne performance mobile (${performance}/100)`)
  if (forcesHints.length === 0)              forcesHints.push('Fiche Google Maps existante et indexée')

  // ── Faiblesses détectées côté JS (verrouillées dans le prompt) ─────────────
  const weaknessHints = []
  if (!website)                              weaknessHints.push('Absence de site web — aucune présence hors Google Maps')
  if (seoScore !== null && seoScore < 70)    weaknessHints.push(`Score SEO technique insuffisant (${seoScore}/100)`)
  if (performance !== null && performance < 50) weaknessHints.push(`Performances mobiles faibles (${performance}/100)`)
  if (loadTime !== null && parseFloat(loadTime) > 8) weaknessHints.push(`Temps de chargement trop élevé (${loadTime}s)`)
  if (https === false)                       weaknessHints.push('Pas de HTTPS — signal négatif pour Google')
  if (sitemap === false)                     weaknessHints.push('Aucun sitemap XML — indexation Google compromise')
  if (!rankFound)                            weaknessHints.push('Hors top 20 sur Google Maps local')
  if (hasDescription === false)             weaknessHints.push('Description fiche Google absente')
  if (hasHours === false)                   weaknessHints.push('Horaires non renseignés sur la fiche Google')
  if (unanswered > 0)                       weaknessHints.push(`${unanswered} avis Google sans réponse`)
  if (napScore === 'inconsistent')          weaknessHints.push(`Incohérence NAP : ${napIssues.join(', ')}`)
  if (napScore === 'not_found')             weaknessHints.push('Absent des annuaires locaux (PagesJaunes)')
  if (!hasPhotos)                           weaknessHints.push('Peu ou pas de photos sur la fiche Google')
  if (issues.length > 0)                   weaknessHints.push(`Problèmes techniques détectés : ${issues.slice(0, 3).join(', ')}`)

  // ── Réseaux sociaux ─────────────────────────────────────────────────────────
  const fbLabel = facebookActivity?.label ?? null
  const igLabel = instagramActivity?.label ?? null
  const socialBlock = [
    fbLabel ? `  - Facebook  : ${fbLabel}` : '  - Facebook  : Non détecté',
    igLabel ? `  - Instagram : ${igLabel}` : '  - Instagram : Non détecté',
  ].join('\n')

  const prompt = `Tu es un consultant SEO local expert. Rédige un audit digital pour "${name}" (${category}, ${city || 'France'}).
Ton : consultant professionnel, factuel, bienveillant — jamais alarmiste, jamais vendeur.

RÈGLE ABSOLUE — ZÉRO NOM DE MARQUE : N'utilise aucun nom de marque, outil ou plateforme commerciale dans tes recommandations. Interdit : Planity, Reservio, Hootsuite, Buffer, Canva, Mailchimp, Brevo, HubSpot, Calendly, WordPress, Webflow, Shopify, Wix, Crisp, Tidio, Intercom, Semrush, Ahrefs, etc. Utilise uniquement des descriptions génériques : "outil de réservation en ligne", "plateforme de gestion des réseaux sociaux", "solution d'email marketing", "logiciel de chat en ligne", "outil de planification éditoriale".

DONNÉES TECHNIQUES VERROUILLÉES — N'UTILISE QUE CES CHIFFRES :
- Nom            : ${name}
- Adresse        : ${address ?? '—'}
- Ville          : ${city || '—'}
- Catégorie      : ${category}
- Site web       : ${website || 'ABSENT'}
- Note Google    : ${rating ?? '—'}/5 (${reviewCount ?? '—'} avis)
- Avis sans réponse : ${unanswered}
- Mots-clés avis : ${keywordsText}
- Performance    : ${performance ?? '—'}/100
- Score SEO      : ${seoScore ?? '—'}/100
- Chargement     : ${loadTime ?? '—'}s
- HTTPS          : ${https === true ? 'Oui' : https === false ? 'Non' : '—'}
- Sitemap        : ${sitemap === true ? 'Présent' : sitemap === false ? 'Absent' : '—'}
- CMS            : ${cms ?? 'non identifié'}
- Classement Maps : ${rankLabel}
- Photos fiche   : ${hasPhotos ? `${photoCount} photo(s)` : 'Absentes'}
- Description    : ${hasDescription ? 'Présente' : 'Absente'}
- Horaires       : ${hasHours ? 'Renseignés' : 'Non renseignés'}
- NAP            : ${napScore ?? 'non vérifié'}
${socialBlock}

FORCES DÉTECTÉES (base de départ obligatoire) :
${forcesHints.map(f => `- ${f}`).join('\n')}

FAIBLESSES IDENTIFIÉES (points à traiter) :
${weaknessHints.map(w => `- ${w}`).join('\n') || '- Aucune faiblesse majeure identifiée'}

INSTRUCTIONS :
1. Commence toujours par les forces — ne jamais ouvrir sur les problèmes
2. Les faiblesses doivent être factuelles et directement tirées des données ci-dessus
3. Les opportunités = ce que ces corrections permettraient concrètement (visibilité, trafic, clients)
4. Les recommandations doivent être priorisées (1 = priorité absolue) et orienter naturellement vers le référencement local, la performance web, la visibilité Google Maps, les balises, le HTTPS, la vitesse de chargement
5. L'accroche est une phrase courte et percutante pour l'email d'accompagnement du PDF — jamais "j'ai analysé", jamais de liste
6. N'invente aucun chiffre absent des DONNÉES TECHNIQUES ci-dessus

LIMITES STRICTES DE LONGUEUR — OBLIGATOIRE :
- resume_executif : maximum 4 phrases courtes
- forces : exactement 3 entrées maximum
- faiblesses : exactement 3 entrées maximum
- opportunites : exactement 3 entrées maximum
- recommandations : exactement 4 entrées maximum
- Chaque titre : maximum 10 mots
- Chaque description : maximum 2 phrases
- accroche : 1 seule phrase
- Sois CONCIS. Chaque description fait maximum 2 phrases. Le JSON total doit faire moins de 4000 caractères.
${buildAuditRulesBlock('seo')}

IMPORTANT: Réponds UNIQUEMENT avec un objet JSON valide. Pas de texte avant, pas de texte après, pas de markdown, pas de \`\`\`json.

Retourne UNIQUEMENT un JSON valide, sans markdown, sans texte avant ou après :
{
  "resume_executif": "3-4 phrases courtes max",
  "forces": [{"titre": "max 10 mots", "description": "max 2 phrases"}],
  "faiblesses": [{"titre": "max 10 mots", "description": "max 2 phrases"}],
  "opportunites": [{"titre": "max 10 mots", "description": "max 2 phrases"}],
  "recommandations": [{"titre": "max 10 mots", "description": "max 2 phrases", "priorite": 1}],
  "accroche": "1 seule phrase factuelle — jamais de promesses marketing",
  "comparaison_concurrents": {"position": "...", "avantages": ["..."], "retards": ["..."]},
  "timeline": {"semaine_1": "...", "semaine_2_3": "...", "mois_2_3": "..."},
  "titre_audit": "Audit SEO & Visibilité Locale"
}`

  console.log(`[generateAuditSEO] ${name} | city:${city} | seo:${seoScore ?? 'n/a'} | rank:${rankLabel} | prompt:${prompt.length} chars`)

  let message
  try {
    message = await anthropic.messages.create({
      model:      'claude-sonnet-4-6',
      max_tokens: 3500,
      messages:   [{ role: 'user', content: prompt }],
    })
  } catch (err) {
    console.error('[generateAuditSEO] ✗ Erreur Anthropic:', err.message)
    throw new Error(`Erreur génération audit SEO: ${err.message}`)
  }

  const raw = message.content[0].text
  console.log(`[generateAuditSEO] ✓ réponse reçue (${raw.length} chars)`)
  console.log('[generateAuditSEO] Réponse brute Claude:', raw)

  // ── Parsing robuste ────────────────────────────────────────────────────────
  function tryParse(str) {
    try { return JSON.parse(str) } catch (_) { return null }
  }

  function cleanAndParse(str) {
    // 1. Tenter tel quel
    let result = tryParse(str)
    if (result) return result

    // 2. Couper au dernier '}' valide
    const lastBrace = str.lastIndexOf('}')
    if (lastBrace > 0) {
      result = tryParse(str.substring(0, lastBrace + 1))
      if (result) return result
    }

    // 3. Nettoyer trailing commas, sauts de ligne dans les strings
    const cleaned = str
      .replace(/,\s*([}\]])/g, '$1')          // trailing commas
      .replace(/[\r\n]+/g, ' ')               // newlines → espace
      .replace(/([^\\])\\n/g, '$1 ')          // \n littéraux
      .replace(/\t/g, ' ')                    // tabs
    result = tryParse(cleaned)
    if (result) return result

    // 4. Dernier '}' sur le nettoyé
    const lastBrace2 = cleaned.lastIndexOf('}')
    if (lastBrace2 > 0) {
      result = tryParse(cleaned.substring(0, lastBrace2 + 1))
      if (result) return result
    }

    return null
  }

  const start = raw.indexOf('{')
  const end   = raw.lastIndexOf('}')

  if (start === -1 || end === -1 || end <= start) {
    console.error('[generateAuditSEO] Aucun JSON trouvé dans la réponse')
    return {
      resume_executif: 'Audit généré avec des données partielles — veuillez relancer.',
      forces: [], faiblesses: [], opportunites: [],
      recommandations: [{ titre: 'Optimiser la fiche Google Business Profile', description: 'Photos, description, horaires à jour.', priorite: 1 }],
      accroche: 'Votre présence digitale mérite une attention particulière.',
    }
  }

  const jsonStr = raw.substring(start, end + 1)
  const parsed  = cleanAndParse(jsonStr)

  if (!parsed) {
    console.error('[generateAuditSEO] Parse échoué après toutes les tentatives. JSON extrait:', jsonStr)
    return enrichAuditResult({
      resume_executif: 'Audit généré avec des données partielles — veuillez relancer.',
      forces: [], faiblesses: [], opportunites: [],
      recommandations: [{ titre: 'Optimiser la fiche Google Business Profile', description: 'Photos, description, horaires à jour.', priorite: 1 }],
      accroche: 'Votre présence digitale mérite une attention particulière.',
    })
  }

  return enrichAuditResult(parsed)
}

// ─── generateAuditPhotographe ─────────────────────────────────────────────────
async function generateAuditPhotographe({ businessName, websiteUrl, googlePhotos, photoCount, socialActivity, reviewsData, googleRating, totalReviews }) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY manquante')

  const anthropic = new Anthropic({ apiKey })

  const name         = businessName  ?? 'ce commerce'
  const website      = websiteUrl    ?? null
  const rating       = googleRating  ?? null
  const reviewCount  = totalReviews  ?? null
  const photos       = photoCount    ?? 0

  const hasInstagram = socialActivity?.hasInstagram ?? false
  const hasFacebook  = socialActivity?.hasFacebook  ?? false
  const hasTiktok    = socialActivity?.hasTiktok    ?? false
  const hasYoutube   = socialActivity?.hasYoutube   ?? false
  const hasPinterest = socialActivity?.hasPinterest ?? false

  const unanswered   = reviewsData?.unanswered ?? 0
  const keywords     = reviewsData?.keywords   ?? []
  const keywordsText = keywords.length > 0 ? keywords.slice(0, 5).join(', ') : '—'

  // ── Forces détectées côté JS ──────────────────────────────────────────────
  const forcesHints = []
  if (photos >= 20)                          forcesHints.push(`Volume de photos Google significatif (${photos} photos)`)
  else if (photos >= 5)                      forcesHints.push(`Fiche Google illustrée (${photos} photos)`)
  if (hasInstagram)                          forcesHints.push('Présence Instagram détectée')
  if (hasTiktok)                             forcesHints.push('Présence TikTok détectée — format vidéo court valorisé')
  if (hasFacebook)                           forcesHints.push('Page Facebook active')
  if (hasYoutube)                            forcesHints.push('Chaîne YouTube présente — contenu vidéo long format')
  if (rating !== null && rating >= 4.5)      forcesHints.push(`Excellente note Google (${rating}/5 — ${reviewCount ?? '?'} avis)`)
  else if (rating !== null && rating >= 4)   forcesHints.push(`Bonne note Google (${rating}/5)`)
  if (website)                               forcesHints.push('Site web présent — galerie potentiellement exploitable')
  if (forcesHints.length === 0)              forcesHints.push('Fiche Google Maps existante et indexée')

  // ── Faiblesses détectées côté JS ─────────────────────────────────────────
  const weaknessHints = []
  if (photos === 0)                          weaknessHints.push('Aucune photo sur la fiche Google — premier critère de confiance absent')
  else if (photos < 5)                       weaknessHints.push(`Fiche Google sous-illustrée (${photos} photo${photos > 1 ? 's' : ''} seulement)`)
  else if (photos < 15)                      weaknessHints.push(`Volume de photos limité (${photos}) — pas de diversité intérieur/extérieur/équipe`)
  if (!hasInstagram && !hasTiktok)           weaknessHints.push('Absence totale sur les réseaux visuels (Instagram, TikTok)')
  else if (!hasInstagram)                    weaknessHints.push('Instagram absent — canal visuel prioritaire pour ce secteur')
  if (!website)                              weaknessHints.push('Site web absent — pas de galerie photos professionnelle possible')
  if (unanswered > 0)                        weaknessHints.push(`${unanswered} avis Google sans réponse — signaux de confiance manquants`)
  if (rating !== null && rating < 4)         weaknessHints.push(`Note Google insuffisante (${rating}/5) — les visuels pourraient améliorer la perception`)
  if (!hasPinterest && !hasYoutube)          weaknessHints.push('Absence sur Pinterest/YouTube — opportunités de contenu visuel long terme inexploitées')

  // ── Bloc réseaux sociaux visuels ──────────────────────────────────────────
  const socialsBlock = [
    `  - Instagram  : ${hasInstagram ? 'Présent' : 'Absent'}`,
    `  - TikTok     : ${hasTiktok    ? 'Présent' : 'Absent'}`,
    `  - Facebook   : ${hasFacebook  ? 'Présent' : 'Absent'}`,
    `  - YouTube    : ${hasYoutube   ? 'Présent' : 'Absent'}`,
    `  - Pinterest  : ${hasPinterest ? 'Présent' : 'Absent'}`,
  ].join('\n')

  const prompt = `Tu es un photographe professionnel expert en image de marque pour les commerces locaux. Rédige un audit visuel pour "${name}".
Ton : consultant professionnel, factuel, bienveillant — jamais alarmiste, jamais vendeur.

RÈGLE ABSOLUE — ZÉRO NOM DE MARQUE : N'utilise aucun nom de marque, outil ou plateforme commerciale dans tes recommandations. Interdit : Planity, Reservio, Hootsuite, Buffer, Canva, Mailchimp, Brevo, HubSpot, Calendly, WordPress, Webflow, Shopify, Wix, Crisp, Tidio, Intercom, Semrush, Ahrefs, etc. Utilise uniquement des descriptions génériques : "outil de réservation en ligne", "plateforme de gestion des réseaux sociaux", "solution d'email marketing", "logiciel de chat en ligne", "outil de planification éditoriale".

DONNÉES VERROUILLÉES — N'UTILISE QUE CES CHIFFRES :
- Nom           : ${name}
- Site web      : ${website || 'ABSENT'}
- Note Google   : ${rating ?? '—'}/5 (${reviewCount ?? '—'} avis)
- Avis sans réponse : ${unanswered}
- Mots-clés avis : ${keywordsText}
- Photos Google : ${photos} photo(s)
${socialsBlock}

FORCES DÉTECTÉES (base de départ obligatoire) :
${forcesHints.map(f => `- ${f}`).join('\n')}

FAIBLESSES IDENTIFIÉES (points à traiter) :
${weaknessHints.map(w => `- ${w}`).join('\n') || '- Aucune faiblesse majeure identifiée'}

INSTRUCTIONS :
1. Commence toujours par les forces — ne jamais ouvrir sur les problèmes
2. Les faiblesses doivent être factuelles et directement tirées des données ci-dessus
3. Les opportunités = bénéfices concrets d'un travail photo professionnel (fiche Google, réseaux, site, saisonnier)
4. Les recommandations doivent être priorisées et orienter naturellement vers le shooting professionnel, la cohérence visuelle, le contenu réseaux sociaux visuels
5. L'accroche est une phrase courte et percutante pour l'email — jamais "j'ai analysé", jamais de liste
6. N'invente aucun chiffre absent des DONNÉES VERROUILLÉES ci-dessus

LIMITES STRICTES DE LONGUEUR — OBLIGATOIRE :
- resume_executif : maximum 4 phrases courtes
- forces : exactement 3 entrées maximum
- faiblesses : exactement 3 entrées maximum
- opportunites : exactement 3 entrées maximum
- recommandations : exactement 4 entrées maximum
- Chaque titre : maximum 10 mots
- Chaque description : maximum 2 phrases
- accroche : 1 seule phrase
- Sois CONCIS. Le JSON total doit faire moins de 4000 caractères.
${buildAuditRulesBlock('photographe')}

IMPORTANT: Réponds UNIQUEMENT avec un objet JSON valide. Pas de texte avant, pas de texte après, pas de markdown, pas de \`\`\`json.

Retourne UNIQUEMENT un JSON valide, sans markdown, sans texte avant ou après :
{
  "resume_executif": "3-4 phrases courtes max",
  "forces": [{"titre": "max 10 mots", "description": "max 2 phrases"}],
  "faiblesses": [{"titre": "max 10 mots", "description": "max 2 phrases"}],
  "opportunites": [{"titre": "max 10 mots", "description": "max 2 phrases"}],
  "recommandations": [{"titre": "max 10 mots", "description": "max 2 phrases", "priorite": 1}],
  "accroche": "1 seule phrase factuelle — jamais de promesses marketing",
  "comparaison_concurrents": {"position": "...", "avantages": ["..."], "retards": ["..."]},
  "timeline": {"semaine_1": "...", "semaine_2_3": "...", "mois_2_3": "..."},
  "titre_audit": "Audit Image & Photographie"
}`

  console.log(`[generateAuditPhotographe] ${name} | photos:${photos} | ig:${hasInstagram} | tt:${hasTiktok} | prompt:${prompt.length} chars`)

  let message
  try {
    message = await anthropic.messages.create({
      model:      'claude-sonnet-4-6',
      max_tokens: 3500,
      messages:   [{ role: 'user', content: prompt }],
    })
  } catch (err) {
    console.error('[generateAuditPhotographe] ✗ Erreur Anthropic:', err.message)
    throw new Error(`Erreur génération audit photographe: ${err.message}`)
  }

  const raw = message.content[0].text
  console.log(`[generateAuditPhotographe] ✓ réponse reçue (${raw.length} chars)`)

  // ── Parsing robuste (même logique que generateAuditSEO) ───────────────────
  function tryParse(str) {
    try { return JSON.parse(str) } catch (_) { return null }
  }

  function cleanAndParse(str) {
    let result = tryParse(str)
    if (result) return result

    const lastBrace = str.lastIndexOf('}')
    if (lastBrace > 0) {
      result = tryParse(str.substring(0, lastBrace + 1))
      if (result) return result
    }

    const cleaned = str
      .replace(/,\s*([}\]])/g, '$1')
      .replace(/[\r\n]+/g, ' ')
      .replace(/([^\\])\\n/g, '$1 ')
      .replace(/\t/g, ' ')
    result = tryParse(cleaned)
    if (result) return result

    const lastBrace2 = cleaned.lastIndexOf('}')
    if (lastBrace2 > 0) {
      result = tryParse(cleaned.substring(0, lastBrace2 + 1))
      if (result) return result
    }

    return null
  }

  const start = raw.indexOf('{')
  const end   = raw.lastIndexOf('}')

  if (start === -1 || end === -1 || end <= start) {
    console.error('[generateAuditPhotographe] Aucun JSON trouvé dans la réponse')
    return {
      resume_executif: 'Audit généré avec des données partielles — veuillez relancer.',
      forces: [], faiblesses: [], opportunites: [],
      recommandations: [{ titre: 'Enrichir les photos de la fiche Google', description: 'Des photos professionnelles augmentent le taux de clic de 25% en moyenne.', priorite: 1 }],
      accroche: 'Vos photos sont votre première impression — soignons-la.',
    }
  }

  const jsonStr = raw.substring(start, end + 1)
  const parsed  = cleanAndParse(jsonStr)

  if (!parsed) {
    console.error('[generateAuditPhotographe] Parse échoué. JSON extrait:', jsonStr)
    return enrichAuditResult({
      resume_executif: 'Audit généré avec des données partielles — veuillez relancer.',
      forces: [], faiblesses: [], opportunites: [],
      recommandations: [{ titre: 'Enrichir les photos de la fiche Google', description: 'Des photos professionnelles augmentent le taux de clic de 25% en moyenne.', priorite: 1 }],
      accroche: 'Vos photos sont votre première impression — soignons-la.',
    })
  }

  return enrichAuditResult(parsed)
}

// ── Email generator — SOCIAL-MEDIA profile ────────────────────────────────────
async function generateEmailSocialMedia({ leadData, socialPresence, socialMediaActivity, reviewsData }) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY manquante')
  const anthropic = new Anthropic({ apiKey })

  const name        = leadData.name        ?? 'ce commerce'
  const city        = leadData.city        ?? ''
  const category    = leadData.category    ?? 'ce secteur'
  const rating      = leadData.rating      ?? null
  const reviewCount = leadData.reviewCount ?? null

  const hasIG = !!(socialPresence?.instagram)
  const hasFB = !!(socialPresence?.facebook)
  const hasLI = !!(socialPresence?.linkedin)
  const hasTK = !!(socialPresence?.tiktok)
  const hasYT = !!(socialPresence?.youtube)

  const igFollowers   = socialMediaActivity?.instagramActivity?.followers  ?? null
  const fbFollowers   = socialMediaActivity?.facebookActivity?.followers   ?? null
  const igDaysAgo     = socialMediaActivity?.instagramActivity?.daysAgo    ?? null
  const fbDaysAgo     = socialMediaActivity?.facebookActivity?.daysAgo     ?? null

  const missingNets = [!hasIG && 'Instagram', !hasFB && 'Facebook', !hasTK && 'TikTok'].filter(Boolean)
  const missingLabel = missingNets.length > 0 ? missingNets.join(', ') : null

  const isInactive = (igDaysAgo !== null && igDaysAgo > 30) || (fbDaysAgo !== null && fbDaysAgo > 30)

  const catLow = category.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  const isRestaurant = /restaurant|cafe|brasserie|pizz|burger|traiteur/.test(catLow)
  const isBeauty     = /coiffure|salon|spa|beaute|barbier/.test(catLow)

  let sectorHint
  if (isRestaurant) sectorHint = 'La restauration est le secteur où les contenus visuels ont le plus fort impact : chaque plat, chaque ambiance peut devenir un levier d\'acquisition local.'
  else if (isBeauty) sectorHint = 'La beauté est l\'un des secteurs où la transformation visuelle génère le plus d\'engagement organique — chaque résultat est une preuve concrète.'
  else sectorHint = 'Dans votre secteur, la régularité et la qualité du contenu social sont des facteurs directs de différenciation face aux concurrents.'

  const observationLine = missingLabel
    ? `vous n'êtes pas présent(e) sur ${missingLabel}`
    : isInactive
    ? `votre activité sur les réseaux est très irrégulière depuis plus de ${Math.max(igDaysAgo ?? 0, fbDaysAgo ?? 0)} jours`
    : 'votre présence sociale a un potentiel non exploité'

  const prompt = `Tu es un social media manager freelance spécialisé dans les commerces locaux. Rédige un email de prospection pour ${name}.

RÈGLE ABSOLUE — ZÉRO NOM DE MARQUE : N'utilise aucun nom de marque, outil ou plateforme commerciale dans tes recommandations. Interdit : Planity, Reservio, Hootsuite, Buffer, Canva, Mailchimp, Brevo, HubSpot, Calendly, WordPress, Webflow, Shopify, Wix, Crisp, Tidio, Intercom, Semrush, Ahrefs, etc. Utilise uniquement des descriptions génériques : "outil de réservation en ligne", "plateforme de gestion des réseaux sociaux", "solution d'email marketing", "logiciel de chat en ligne", "outil de planification éditoriale".

DONNÉES VERROUILLÉES — UTILISER UNIQUEMENT CES CHIFFRES :
- Nom : ${name}
- Ville : ${city || '—'}
- Catégorie : ${category}
- Note Google : ${rating ?? '—'}/5 — Avis : ${reviewCount ?? '—'}
- Instagram : ${hasIG ? `Présent (${igFollowers !== null ? igFollowers + ' abonnés' : 'abonnés inconnus'}, dernier post il y a ${igDaysAgo ?? '?'} jours)` : 'ABSENT'}
- Facebook : ${hasFB ? `Présent (${fbFollowers !== null ? fbFollowers + ' abonnés' : 'abonnés inconnus'})` : 'ABSENT'}
- LinkedIn : ${hasLI ? 'Présent' : 'Absent'}
- TikTok : ${hasTK ? 'Présent' : 'Absent'}
- YouTube : ${hasYT ? 'Présent' : 'Absent'}

OBSERVATION DE DÉPART : ${observationLine}
CONTEXTE SECTEUR : ${sectorHint}

STRUCTURE EN 5 PARAGRAPHES :

OBJET : ${missingLabel ? `${name} — Absent(e) sur ${missingLabel}` : `${name} — votre présence sociale a du potentiel`}

SALUTATION : "Bonjour,"

P1 — ACCROCHE (observation concrète sur la situation réelle, prose naturelle, max 2 phrases) :
À partir de l'observation : "${observationLine}"

P2 — CONTEXTE SECTORIEL (1 phrase, utiliser l'indice secteur ci-dessus sans le recopier mot pour mot) :
Reformuler naturellement.

P3 — CE QUE JE PROPOSE (2 phrases, sans nommer d'outils ni de plateformes spécifiques, sans listes) :
Décrire la gestion de contenu social, la régularité de publication, l'engagement communautaire.

P4 — RÉSULTAT CONCRET (1 phrase de preuve, recopier exactement) :
"Les commerces que j'accompagne voient leur engagement organique progresser de 20 à 25% en 45 jours."

P5 — CTA (recopier exactement) :
"Je vous envoie des exemples de contenus réalisés pour des commerces similaires ?

Community Manager — ${city || 'France'}"

${EMAIL_STATS_NOTE}

RÈGLES ABSOLUES :
- Jamais de liste à puces dans le corps
- Jamais "Bonjour [nom]" — uniquement "Bonjour,"
- Jamais de noms d'outils ni de plateformes
- Jamais de placeholder entre crochets dans l'email livré
- Maximum 180 mots

Retourne UNIQUEMENT un JSON valide :
{"subject":"...","body":"Corps complet de l'email avec sauts de ligne \\n"}`

  console.log(`[generateEmailSocialMedia] ${name} | city:${city} | missingNets:${missingLabel ?? 'aucun'} | inactive:${isInactive} | prompt:${prompt.length} chars`)

  let message
  try {
    message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6', max_tokens: 700,
      messages: [{ role: 'user', content: prompt }],
    })
  } catch (err) {
    console.error('[generateEmailSocialMedia] ✗ Erreur Anthropic:', err.message)
    throw new Error(`Erreur génération email social media: ${err.message}`)
  }

  const raw = message.content[0].text
  console.log(`[generateEmailSocialMedia] ✓ réponse reçue (${raw.length} chars)`)
  const jsonMatch = raw.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('Réponse JSON invalide du modèle')
  try { return JSON.parse(jsonMatch[0]) }
  catch (e) { throw new Error(`Parse JSON échoué: ${e.message}`) }
}

// ─── generateAuditChatbot ─────────────────────────────────────────────────────
async function generateAuditChatbot({ businessName, websiteUrl, chatbotDetection, reviewsData, googleRating, totalReviews, questionsAnalysis, domainComplexity, faqDetection, contactFormDetection, pagespeedData }) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY manquante')

  const anthropic = new Anthropic({ apiKey })

  const name        = businessName ?? 'ce commerce'
  const website     = websiteUrl   ?? null
  const rating      = googleRating ?? null
  const reviewCount = totalReviews ?? null

  // Chatbot detection signals
  const hasChatbot      = chatbotDetection?.hasChatbot       ?? false
  const chatbotTool     = chatbotDetection?.chatbotsDetected?.[0] ?? null
  const bookingPlatform = chatbotDetection?.bookingPlatform
    ?? pagespeedData?.bookingPlatform              // getSiteSignals (flat, chatbot profile)
    ?? pagespeedData?.siteSignals?.bookingPlatform // getPageSpeed (nested, SEO profile)
    ?? null

  // Reviews
  const unanswered   = reviewsData?.unanswered ?? 0
  const keywords     = reviewsData?.keywords   ?? []
  const keywordsText = keywords.length > 0 ? keywords.slice(0, 5).join(', ') : '—'

  // Questions analysis
  const questionCount  = questionsAnalysis?.totalQuestions ?? 0
  const questionRatio  = questionsAnalysis?.questionRatio  ?? 0
  const questionTopics = questionsAnalysis?.questionTopics ?? {}
  const topTopics      = Object.entries(questionTopics)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([k, v]) => `${k} (${v}x)`)
  const topicsText = topTopics.length > 0 ? topTopics.join(', ') : '—'

  // Site signals
  const hasFAQ         = faqDetection         ?? false
  const hasContactForm = contactFormDetection  ?? false
  const complexity     = domainComplexity      ?? 'simple'
  const cms            = pagespeedData?.cms?.cms ?? pagespeedData?.cms ?? null

  // Type de RAG recommandé
  let ragType
  if (bookingPlatform) {
    ragType = `Assistant réservation intégré (connexion ${bookingPlatform})`
  } else if (complexity === 'complex') {
    ragType = 'Assistant IA avancé — RAG multi-source avec base documentaire métier'
  } else if (complexity === 'medium') {
    ragType = 'Assistant réservation & FAQ hybride'
  } else {
    ragType = 'FAQ bot simple — questions/réponses automatisées'
  }

  // Forces
  const forcesHints = []
  if (rating !== null && rating >= 4)           forcesHints.push(`Bonne note Google (${rating}/5) — engagement client avéré, base solide pour le RAG`)
  if (reviewCount !== null && reviewCount > 50) forcesHints.push(`Volume d'avis significatif (${reviewCount}) — corpus de données pour l'entraînement`)
  if (website)                                  forcesHints.push('Site web présent — déploiement widget chatbot immédiatement possible')
  if (cms === 'wordpress' || cms === 'wix')     forcesHints.push(`CMS ${cms} détecté — intégration chatbot simplifiée via plugin natif`)
  if (bookingPlatform)                          forcesHints.push('Plateforme de réservation en ligne détectée — connexion possible pour automatiser les réservations')
  if (!hasChatbot && website)                   forcesHints.push("L'adoption des assistants conversationnels reste limitée dans le secteur localement — opportunité de différenciation")
  if (forcesHints.length === 0)                 forcesHints.push('Fiche Google Maps existante et indexée')

  // Faiblesses
  const weaknessHints = []
  if (!hasChatbot)                              weaknessHints.push('Aucun assistant conversationnel — toutes les demandes sont traitées manuellement')
  if (unanswered > 0)                           weaknessHints.push(`${unanswered} avis Google sans réponse — indicateur de charge non maîtrisée`)
  if (questionCount > 0)                        weaknessHints.push(`${questionCount} questions récurrentes dans les avis (${topicsText}) — aucun self-service disponible`)
  if (!hasFAQ && website)                       weaknessHints.push('Aucune FAQ détectée sur le site — les visiteurs ne trouvent pas leurs réponses en autonomie')
  if (!website)                                 weaknessHints.push('Absence de site web — déploiement chatbot limité aux réseaux sociaux (Messenger, Instagram DM)')
  if (complexity === 'complex')                 weaknessHints.push('Domaine à forte complexité métier — sans chatbot qualifiant, les délais de réponse pénalisent la conversion')

  const prompt = `Tu es un développeur IA spécialisé dans les assistants conversationnels pour commerces locaux. Rédige un audit chatbot pour "${name}".
Ton : expert technique, factuel, bienveillant — jamais alarmiste, jamais vendeur.

RÈGLE ANTI-MARQUES ABSOLUE :
- Ne JAMAIS citer de nom de marque dans l'audit : ni Planity, ni Doctolib, ni TheFork, ni Crisp, ni Tidio, ni Intercom, ni aucune autre.
- Interdit également : Reservio, Hootsuite, Buffer, Canva, Mailchimp, Brevo, HubSpot, Calendly, WordPress, Webflow, Shopify, Wix, Semrush, Ahrefs, etc.
- Si une plateforme de réservation est détectée, dire "plateforme de réservation en ligne existante" ou "solution de prise de rendez-vous déjà active".
- Dans le type de RAG recommandé, écrire "Assistant connecté à la réservation en ligne" au lieu de tout nom de plateforme spécifique.
- Dans les KPIs : remplacer tout nom de plateforme par "✓ Détectée" pour la ligne "Réservation en ligne".
- Si les FORCES DÉTECTÉES ci-dessous contiennent un nom de plateforme ou de marque, réécrire la force avec des termes génériques uniquement.
- Cette règle s'applique à TOUT le document sans exception.

DONNÉES VERROUILLÉES — N'UTILISE QUE CES CHIFFRES :
- Nom               : ${name}
- Site web          : ${website || 'ABSENT'}
- CMS               : ${cms ?? 'non identifié'}
- Note Google       : ${rating ?? '—'}/5 (${reviewCount ?? '—'} avis)
- Avis sans réponse : ${unanswered}
- Mots-clés avis    : ${keywordsText}
- Chatbot existant  : ${hasChatbot ? 'Oui (outil non identifié)' : 'Non'}
- Plateforme résa   : ${bookingPlatform ? 'Oui (plateforme de réservation en ligne détectée)' : 'Aucune détectée'}
- Questions dans avis : ${questionCount} (${questionRatio}% des avis contiennent une question)
- Sujets récurrents : ${topicsText}
- FAQ sur site      : ${hasFAQ ? 'Oui' : 'Non'}
- Formulaire contact : ${hasContactForm ? 'Oui' : 'Non'}
- Complexité domaine : ${complexity}
- Type RAG recommandé : ${bookingPlatform ? 'Assistant connecté à la réservation en ligne' : ragType}

FORCES DÉTECTÉES (base de départ obligatoire) :
${forcesHints.map(f => `- ${f}`).join('\n')}

FAIBLESSES IDENTIFIÉES (points à traiter) :
${weaknessHints.map(w => `- ${w}`).join('\n') || '- Aucune faiblesse majeure identifiée'}

PERSONNALISATION SECTORIELLE OBLIGATOIRE :
Les recommandations doivent être adaptées au secteur d'activité du prospect. Exemples :
- Institut de beauté / coiffeur : prise de RDV par type de soin, gestion des annulations, rappels automatiques, vente de produits/cartes cadeaux, suggestion de soins complémentaires
- Restaurant : réservation de table, commande à emporter, menu du jour, gestion des allergies, événements privés
- Médical/paramédical : pré-qualification des motifs de consultation, rappels de rendez-vous, documents à préparer
- Artisan/BTP : qualification du besoin (type de travaux, budget, délai), prise de rendez-vous pour devis, suivi de chantier
- Commerce : disponibilité produit, horaires, click & collect, promotions en cours
Ne JAMAIS donner des recommandations génériques qui s'appliqueraient à n'importe quel commerce. Chaque recommandation doit mentionner un cas d'usage concret lié au métier du prospect.

CHIFFRAGE OBLIGATOIRE :
Dans le calendrier de mise en œuvre, chaque phase doit inclure :
- Une estimation de temps (ex: "2-4 heures", "1 journée")
- Un niveau d'effort (ex: "configuration simple", "nécessite un prestataire technique")
- Un indicateur de résultat attendu mesurable (ex: "réduction de 30-50% des appels pour prise de RDV")
Dans la section recommandations, ajouter pour chaque recommandation un niveau de priorité (Haute/Moyenne/Basse) et un impact estimé.

EXPLICATION DU SCORE :
Dans le champ "comprendre_votre_score", expliquer en 2-3 phrases :
- Le score est calculé sur 100 points répartis entre : volume et qualité des avis (10%), signaux d'automatisation existants (10%), complexité du domaine (10%), potentiel d'impact d'un chatbot (70%)
- Un score bas signifie un fort potentiel d'amélioration, pas une mauvaise performance
- Rappeler les 2-3 facteurs principaux qui ont influencé le score du prospect

INSTRUCTIONS :
1. Commence toujours par les forces — ne jamais ouvrir sur les problèmes
2. Les faiblesses doivent être factuelles et directement tirées des données ci-dessus
3. Les opportunités = bénéfices concrets d'un assistant IA (réduction charge manuelle, disponibilité 24h/24, qualification automatique des leads)
4. Les recommandations doivent orienter vers le type de RAG recommandé et son intégration concrète — adapter au secteur d'activité du prospect
5. Dans la section Forces, ne PAS affirmer qu'aucun concurrent n'a de chatbot (cette information ne peut pas être vérifiée). Si les FORCES DÉTECTÉES mentionnent l'absence de chatbot chez les concurrents, reformuler ainsi : "L'adoption des assistants conversationnels reste faible dans le secteur localement, ce qui représente une fenêtre d'opportunité pour se différencier."
6. N'invente aucun chiffre absent des DONNÉES VERROUILLÉES ci-dessus

CTA FINAL :
La phrase d'accroche finale doit :
- Reprendre LE problème concret principal identifié (ex: "Chaque semaine, votre équipe traite manuellement des dizaines de demandes d'horaires et de disponibilités")
- Quantifier l'impact quand c'est possible (ex: "15 avis sans réponse représentent autant d'occasions manquées de fidéliser")
- Terminer par : "Échangeons 15 minutes sur vos priorités — sans engagement."
(pas "Discutons de vos priorités" qui est trop vague)

LIMITES STRICTES DE LONGUEUR — OBLIGATOIRE :
- resume_executif : maximum 4 phrases courtes
- comprendre_votre_score : maximum 3 phrases
- forces : exactement 3 entrées maximum
- faiblesses : exactement 3 entrées maximum
- opportunites : exactement 3 entrées maximum
- recommandations : exactement 4 entrées maximum
- Chaque titre : maximum 10 mots
- Chaque description : maximum 2 phrases
- accroche : 1 seule phrase
- Sois CONCIS. Le JSON total doit faire moins de 4500 caractères.
${buildAuditRulesBlock('chatbot')}

IMPORTANT: Réponds UNIQUEMENT avec un objet JSON valide. Pas de texte avant, pas de texte après, pas de markdown, pas de \`\`\`json.

Retourne UNIQUEMENT un JSON valide, sans markdown, sans texte avant ou après :
{
  "resume_executif": "3-4 phrases courtes max",
  "comprendre_votre_score": "2-3 phrases expliquant le score et ses facteurs principaux",
  "forces": [{"titre": "max 10 mots", "description": "max 2 phrases"}],
  "faiblesses": [{"titre": "max 10 mots", "description": "max 2 phrases"}],
  "opportunites": [{"titre": "max 10 mots", "description": "max 2 phrases"}],
  "recommandations": [{"titre": "max 10 mots", "description": "max 2 phrases", "priorite": "Haute|Moyenne|Basse", "impact": "indicateur mesurable"}],
  "accroche": "phrase factuelle reprenant le problème principal — se termine par 'Échangeons 15 minutes sur vos priorités — sans engagement.'",
  "comparaison_concurrents": {"position": "...", "avantages": ["..."], "retards": ["..."]},
  "timeline": {"semaine_1": "action + durée estimée + effort + résultat attendu", "semaine_2_3": "...", "mois_2_3": "..."},
  "titre_audit": "Audit Chatbot & IA Conversationnelle"
}`

  console.log(`[generateAuditChatbot] ${name} | hasChatbot:${hasChatbot} | unanswered:${unanswered} | questions:${questionCount} | complexity:${complexity} | prompt:${prompt.length} chars`)

  let message
  try {
    message = await anthropic.messages.create({
      model:      'claude-sonnet-4-6',
      max_tokens: 3500,
      messages:   [{ role: 'user', content: prompt }],
    })
  } catch (err) {
    console.error('[generateAuditChatbot] ✗ Erreur Anthropic:', err.message)
    throw new Error(`Erreur génération audit chatbot: ${err.message}`)
  }

  const raw = message.content[0].text
  console.log(`[generateAuditChatbot] ✓ réponse reçue (${raw.length} chars)`)

  // ── Parsing robuste (même logique que les autres audits) ──────────────────
  function tryParse(str) {
    try { return JSON.parse(str) } catch (_) { return null }
  }

  function cleanAndParse(str) {
    let result = tryParse(str)
    if (result) return result

    const lastBrace = str.lastIndexOf('}')
    if (lastBrace > 0) {
      result = tryParse(str.substring(0, lastBrace + 1))
      if (result) return result
    }

    const cleaned = str
      .replace(/,\s*([}\]])/g, '$1')
      .replace(/[\r\n]+/g, ' ')
      .replace(/([^\\])\\n/g, '$1 ')
      .replace(/\t/g, ' ')
    result = tryParse(cleaned)
    if (result) return result

    const lastBrace2 = cleaned.lastIndexOf('}')
    if (lastBrace2 > 0) {
      result = tryParse(cleaned.substring(0, lastBrace2 + 1))
      if (result) return result
    }

    return null
  }

  const start = raw.indexOf('{')
  const end   = raw.lastIndexOf('}')

  if (start === -1 || end === -1 || end <= start) {
    console.error('[generateAuditChatbot] Aucun JSON trouvé dans la réponse')
    return {
      resume_executif: 'Audit généré avec des données partielles — veuillez relancer.',
      forces: [], faiblesses: [], opportunites: [],
      recommandations: [{ titre: 'Déployer un assistant IA sur le site', description: 'Un chatbot répond aux questions fréquentes 24h/24 et réduit la charge manuelle de 40%.', priorite: 1 }],
      accroche: 'Chaque question sans réponse est une vente perdue — automatisons.',
    }
  }

  const jsonStr = raw.substring(start, end + 1)
  const parsed  = cleanAndParse(jsonStr)

  if (!parsed) {
    console.error('[generateAuditChatbot] Parse échoué. JSON extrait:', jsonStr)
    return enrichAuditResult({
      resume_executif: 'Audit généré avec des données partielles — veuillez relancer.',
      forces: [], faiblesses: [], opportunites: [],
      recommandations: [{ titre: 'Déployer un assistant IA sur le site', description: 'Un chatbot répond aux questions fréquentes 24h/24 et réduit la charge manuelle de 40%.', priorite: 1 }],
      accroche: 'Chaque question sans réponse est une vente perdue — automatisons.',
    })
  }

  return enrichAuditResult(parsed)
}

// ─── generateAuditSocialMedia ─────────────────────────────────────────────────
async function generateAuditSocialMedia({ businessName, websiteUrl, socialPresence, socialMediaActivity, photoCount, reviewsData, googleRating, totalReviews, domain, city, instagramDeep }) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY manquante')
  const anthropic = new Anthropic({ apiKey })

  const name    = businessName ?? 'ce commerce'
  const hasIG   = !!(socialPresence?.instagram)
  const hasFB   = !!(socialPresence?.facebook)
  const hasLI   = !!(socialPresence?.linkedin)
  const hasTK   = !!(socialPresence?.tiktok)
  const hasYT   = !!(socialPresence?.youtube)

  const igFollowers  = socialMediaActivity?.instagramActivity?.followers  ?? null
  const igDaysAgo    = socialMediaActivity?.instagramActivity?.daysAgo    ?? null
  const fbFollowers  = socialMediaActivity?.facebookActivity?.followers   ?? null
  const fbDaysAgo    = socialMediaActivity?.facebookActivity?.daysAgo     ?? null
  const photos       = photoCount ?? 0
  const rating       = googleRating ?? '—'
  const reviews      = totalReviews ?? 0
  const unanswered   = reviewsData?.unanswered ?? 0
  const replyRate    = reviews > 0 ? Math.round(((reviews - unanswered) / reviews) * 100) : null

  // Deep IG engagement (si disponible — 12 posts Apify)
  const igAvgLikes    = instagramDeep?.avgLikes    ?? null
  const igAvgComments = instagramDeep?.avgComments ?? null
  const igPostsMonth  = instagramDeep?.postsPerMonth ?? null
  const igTopHashtags = instagramDeep?.topHashtags  ?? []

  const missingNets = [!hasIG && 'Instagram', !hasFB && 'Facebook', !hasLI && 'LinkedIn', !hasTK && 'TikTok'].filter(Boolean)
  const presentNets = [hasIG && 'Instagram', hasFB && 'Facebook', hasLI && 'LinkedIn', hasTK && 'TikTok', hasYT && 'YouTube'].filter(Boolean)

  const photoQuality = photos === 0 ? 'Aucune photo' : photos <= 5 ? 'Insuffisant (<5)' : photos <= 15 ? 'Basique (5-15)' : photos <= 30 ? 'Correct (15-30)' : 'Excellent (30+)'

  const engagementLine = igAvgLikes != null
    ? `- Engagement Instagram : ${igAvgLikes} likes/post, ${igAvgComments ?? '—'} commentaires/post, ${igPostsMonth ?? '—'} posts/mois${igTopHashtags.length > 0 ? `, hashtags: ${igTopHashtags.slice(0, 3).join(' ')}` : ''}`
    : '- Engagement Instagram : données non disponibles (analyse réseaux non effectuée)'

  const reputationLine = replyRate != null
    ? `${reviews} avis — ${unanswered} sans réponse — taux de réponse : ${replyRate}%`
    : `${reviews} avis — taux de réponse inconnu`

  const prompt = `Tu es un expert en community management et e-réputation pour commerces locaux. Audite la présence sociale et la réputation de "${name}" et retourne un rapport structuré.

RÈGLE ABSOLUE — ZÉRO NOM DE MARQUE : N'utilise aucun nom de marque, outil ou plateforme commerciale dans tes recommandations. Interdit : Planity, Reservio, Hootsuite, Buffer, Canva, Mailchimp, Brevo, HubSpot, Calendly, WordPress, Webflow, Shopify, Wix, Crisp, Tidio, Intercom, Semrush, Ahrefs, etc. Utilise uniquement des descriptions génériques : "outil de réservation en ligne", "plateforme de gestion des réseaux sociaux", "solution d'email marketing", "logiciel de chat en ligne", "outil de planification éditoriale".

DONNÉES :
- Ville/zone : ${city || 'France'}
- Domaine/catégorie : ${domain ?? 'non précisé'}
- Site web : ${websiteUrl ?? 'absent'}

E-RÉPUTATION GOOGLE :
- Note : ${rating}/5 — ${reputationLine}
- Avis sans réponse : ${unanswered > 0 ? `${unanswered} avis négatifs sans réponse propriétaire — RISQUE e-réputation` : 'Tous répondus ✓'}

RÉSEAUX SOCIAUX :
- Réseaux PRÉSENTS : ${presentNets.length > 0 ? presentNets.join(', ') : 'Aucun'}
- Réseaux ABSENTS : ${missingNets.length > 0 ? missingNets.join(', ') : 'Présence complète'}
- Instagram : ${hasIG ? `${igFollowers !== null ? igFollowers + ' abonnés' : 'abonnés inconnus'}, dernier post ${igDaysAgo !== null ? 'il y a ' + igDaysAgo + ' jours' : 'date inconnue'}` : 'ABSENT'}
- Facebook : ${hasFB ? `${fbFollowers !== null ? fbFollowers + ' abonnés' : 'abonnés inconnus'}, dernier post ${fbDaysAgo !== null ? 'il y a ' + fbDaysAgo + ' jours' : 'date inconnue'}` : 'ABSENT'}
${engagementLine}
- Photos Google : ${photos} (${photoQuality})

RÈGLES :
- Prose uniquement dans resume_executif — pas de listes à puces
- Ton expert, orienté résultats concrets et chiffres
- Les forces/faiblesses intègrent OBLIGATOIREMENT la dimension e-réputation (réponses aux avis)
- Chaque recommandation doit préciser une action concrète et un résultat attendu
- Maximum 4000 caractères total pour le JSON
${buildAuditRulesBlock('community-manager')}

Retourne UNIQUEMENT ce JSON valide :
{
  "resume_executif": "Paragraphe 3-4 phrases sur situation sociale + e-réputation actuelle et opportunité principale",
  "tonalite": "Positive / Mitigée / Négative — 1 phrase sur la tonalité des avis et interactions",
  "forces": [
    {"titre": "...", "description": "..."},
    {"titre": "...", "description": "..."}
  ],
  "faiblesses": [
    {"titre": "...", "description": "..."},
    {"titre": "...", "description": "..."}
  ],
  "opportunites": [
    {"label": "...", "detail": "..."},
    {"label": "...", "detail": "..."},
    {"label": "...", "detail": "..."}
  ],
  "recommandations": [
    {"titre": "...", "description": "...", "priorite": 1},
    {"titre": "...", "description": "...", "priorite": 2},
    {"titre": "...", "description": "...", "priorite": 3}
  ],
  "accroche": "Phrase factuelle — jamais de promesses marketing",
  "comparaison_concurrents": {"position": "...", "avantages": ["..."], "retards": ["..."]},
  "timeline": {"semaine_1": "...", "semaine_2_3": "...", "mois_2_3": "..."},
  "titre_audit": "Audit Community Management & E-Réputation"
}`

  console.log(`[generateAuditSocialMedia] ${name} | present:${presentNets.join(',')} | missing:${missingNets.join(',')} | prompt:${prompt.length} chars`)

  let message
  try {
    message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6', max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }],
    })
  } catch (err) {
    console.error('[generateAuditSocialMedia] ✗ Erreur Anthropic:', err.message)
    throw new Error(`Erreur génération audit social media: ${err.message}`)
  }

  const raw = message.content[0].text
  console.log(`[generateAuditSocialMedia] ✓ réponse reçue (${raw.length} chars)`)

  function tryParse(str) { try { return JSON.parse(str) } catch (_) { return null } }
  function cleanAndParse(str) {
    const cleaned = str.replace(/[\x00-\x1F\x7F]/g, m => m === '\n' || m === '\r' || m === '\t' ? m : ' ')
    return tryParse(cleaned)
  }

  const start = raw.indexOf('{')
  const end   = raw.lastIndexOf('}')
  if (start === -1 || end === -1 || end <= start) {
    console.error('[generateAuditSocialMedia] Aucun JSON trouvé')
    return enrichAuditResult({ resume_executif: 'Audit généré avec des données partielles — veuillez relancer.', forces: [], faiblesses: [], opportunites: [], recommandations: [{ titre: 'Créer une présence sociale cohérente', description: 'Définir une ligne éditoriale et publier régulièrement sur les réseaux adaptés au secteur.', priorite: 1 }], accroche: 'Chaque client satisfait est un contenu potentiel — apprenons à le montrer.' })
  }

  const jsonStr = raw.slice(start, end + 1)
  const parsed  = tryParse(jsonStr) || cleanAndParse(jsonStr)

  if (!parsed) {
    console.error('[generateAuditSocialMedia] Parse échoué. JSON extrait:', jsonStr)
    return enrichAuditResult({ resume_executif: 'Audit généré avec des données partielles — veuillez relancer.', forces: [], faiblesses: [], opportunites: [], recommandations: [{ titre: 'Créer une présence sociale cohérente', description: 'Définir une ligne éditoriale et publier régulièrement.', priorite: 1 }], accroche: 'Chaque client satisfait est un contenu potentiel — apprenons à le montrer.' })
  }

  return enrichAuditResult(parsed)
}

// ── Email generator — DESIGNER profile ───────────────────────────────────────
async function generateEmailDesigner({ leadData, photoCount, googleAudit, socialPresence, reviewsData }) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY manquante')
  const anthropic = new Anthropic({ apiKey })

  const name        = leadData.name        ?? 'ce commerce'
  const city        = leadData.city        ?? ''
  const category    = leadData.category    ?? 'ce secteur'
  const rating      = leadData.rating      ?? null
  const reviewCount = leadData.reviewCount ?? null

  const hasIG  = !!(socialPresence?.instagram)
  const hasFB  = !!(socialPresence?.facebook)
  const hasPin = !!(socialPresence?.pinterest)
  const hasDesc = !!(googleAudit?.hasDescription)
  const photos  = photoCount ?? 0

  const catLow = category.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  const isRestaurant = /restaurant|cafe|brasserie|pizz|burger|traiteur/.test(catLow)
  const isBeauty     = /coiffure|salon|spa|beaute|barbier/.test(catLow)
  const isRetail     = /boutique|commerce|magasin|retail|mode|vetement/.test(catLow)

  let sectorHint
  if (isRestaurant) sectorHint = 'En restauration, les visuels sont le premier facteur de décision — une fiche Google sans photos professionnelles perd 30 à 40% des clics potentiels.'
  else if (isBeauty) sectorHint = 'Dans la beauté, chaque avant/après est un argument de vente. Une identité visuelle cohérente crée la confiance avant même le premier contact.'
  else if (isRetail) sectorHint = 'Dans le commerce local, la cohérence visuelle entre la vitrine, la fiche Google et les réseaux multiplie la mémorisation de marque.'
  else sectorHint = 'Dans votre secteur, une identité visuelle professionnelle est l\'un des premiers critères d\'évaluation avant de faire appel à un prestataire.'

  const weakPoints = [
    photos < 5                   ? `seulement ${photos} photo(s) sur Google` : null,
    !hasDesc                     ? 'aucune description sur la fiche Google' : null,
    !hasIG && !hasFB && !hasPin  ? 'aucun réseau visuel actif détecté' : null,
  ].filter(Boolean)

  const observationLine = weakPoints.length > 0
    ? weakPoints.join(', ')
    : 'l\'identité visuelle a un potentiel non exploité sur les supports digitaux'

  const topQuotes = extractTopQuotes(reviewsData)
  const quotesText = topQuotes.length > 0 ? topQuotes.map(q => `"${q}"`).join('\n') : null

  const prompt = `Tu es un designer graphique et branding freelance spécialisé dans les commerces locaux. Rédige un email de prospection pour ${name}.

RÈGLE ABSOLUE — ZÉRO NOM DE MARQUE : N'utilise aucun nom de marque, outil ou plateforme commerciale dans tes recommandations. Interdit : Planity, Reservio, Hootsuite, Buffer, Canva, Mailchimp, Brevo, HubSpot, Calendly, WordPress, Webflow, Shopify, Wix, Crisp, Tidio, Intercom, Semrush, Ahrefs, etc. Utilise uniquement des descriptions génériques : "outil de réservation en ligne", "plateforme de gestion des réseaux sociaux", "solution d'email marketing", "logiciel de chat en ligne", "outil de planification éditoriale".

DONNÉES VERROUILLÉES — UTILISER UNIQUEMENT CES CHIFFRES :
- Nom : ${name}
- Ville : ${city || '—'}
- Catégorie : ${category}
- Note Google : ${rating ?? '—'}/5 — Avis : ${reviewCount ?? '—'}
- Photos Google : ${photos}
- Description fiche : ${hasDesc ? 'Présente' : 'Absente'}
- Instagram : ${hasIG ? 'Présent' : 'Absent'} | Facebook : ${hasFB ? 'Présent' : 'Absent'} | Pinterest : ${hasPin ? 'Présent' : 'Absent'}
- Observation principale : ${observationLine}
- Contexte secteur : ${sectorHint}
${quotesText ? `- Citations clients : ${quotesText}` : ''}

STRUCTURE — 5 PARAGRAPHES COURTS :
P1 — Accroche factuelle sur le point faible visuel identifié (1-2 phrases, ne pas commencer par "Je")
P2 — Ce que les clients perçoivent vs ce que la fiche montre (lien réputation/identité visuelle)
P3 — Ta valeur ajoutée concrète en tant que designer local (sans mention de tarif)
P4 — Ce que tu peux améliorer précisément pour eux (photos Google, charte, réseaux)
P5 — Appel à l'action simple et concret (1-2 phrases)

${EMAIL_STATS_NOTE}

RÈGLES :
- Ne jamais inventer de chiffres, noms ou faits non fournis ci-dessus
- Vouvoiement tout au long de l'email
- Ton professionnel mais accessible
- Longueur totale : 150-220 mots
- Objet : accrocheur, factuel, sans emoji (max 80 caractères)

Retourne UNIQUEMENT un JSON valide :
{"subject":"...","body":"Corps complet de l'email avec sauts de ligne \\n"}`

  console.log(`[generateEmailDesigner] ${name} | city:${city} | photos:${photos} | instagram:${hasIG} | prompt:${prompt.length} chars`)

  let message
  try {
    message = await anthropic.messages.create({
      model:      'claude-sonnet-4-6',
      max_tokens: 800,
      messages:   [{ role: 'user', content: prompt }],
    })
  } catch (err) {
    console.error('[generateEmailDesigner] ✗ Erreur Anthropic:', err.message)
    throw new Error(`Erreur génération email designer: ${err.message}`)
  }

  const raw = message.content[0].text
  console.log(`[generateEmailDesigner] ✓ réponse reçue (${raw.length} chars)`)
  const jsonMatch = raw.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('Réponse JSON invalide du modèle')
  try { return JSON.parse(jsonMatch[0]) }
  catch { return JSON.parse(jsonMatch[0].replace(/[\u0000-\u001F\u007F-\u009F]/g, ' ')) }
}

// ── Audit generator — DESIGNER profile ───────────────────────────────────────
async function generateAuditDesigner({ businessName, websiteUrl, photoCount, googleAudit, socialPresence, reviewsData, googleRating, totalReviews, domain, pagespeedData }) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY manquante')
  const anthropic = new Anthropic({ apiKey })

  const name   = businessName ?? 'ce commerce'
  const photos = photoCount ?? 0

  const hasIG  = !!(socialPresence?.instagram)
  const hasFB  = !!(socialPresence?.facebook)
  const hasPin = !!(socialPresence?.pinterest)
  const hasLI  = !!(socialPresence?.linkedin)
  const hasDesc = !!(googleAudit?.hasDescription)
  const hasSite = !!(websiteUrl && websiteUrl !== 'null' && websiteUrl !== 'undefined')

  const visualNets = [hasIG && 'Instagram', hasFB && 'Facebook', hasPin && 'Pinterest', hasLI && 'LinkedIn'].filter(Boolean)
  const missingVisual = [!hasIG && 'Instagram', !hasFB && 'Facebook', !hasPin && 'Pinterest'].filter(Boolean)

  const catLow = (domain ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  const isRestaurant = /restaurant|cafe|brasserie|pizz|burger|traiteur/.test(catLow)
  const isBeauty     = /coiffure|salon|spa|beaute|barbier/.test(catLow)

  const perfScore = pagespeedData?.performance ?? null
  const seoScore  = pagespeedData?.seo         ?? null

  const topQuotes = extractTopQuotes(reviewsData)
  const reviews   = reviewsData?.reviews ?? []
  const unanswered = reviews.filter(r => !r.ownerReply && !r.reply).length

  const prompt = `Tu es un expert branding & identité visuelle. Génère un audit complet pour ${name}.

RÈGLE ABSOLUE — ZÉRO NOM DE MARQUE : N'utilise aucun nom de marque, outil ou plateforme commerciale dans tes recommandations. Interdit : Planity, Reservio, Hootsuite, Buffer, Canva, Mailchimp, Brevo, HubSpot, Calendly, WordPress, Webflow, Shopify, Wix, Crisp, Tidio, Intercom, Semrush, Ahrefs, etc. Utilise uniquement des descriptions génériques : "outil de réservation en ligne", "plateforme de gestion des réseaux sociaux", "solution d'email marketing", "logiciel de chat en ligne", "outil de planification éditoriale".

DONNÉES :
- Note Google : ${googleRating ?? '—'}/5 | Avis : ${totalReviews ?? 0} | Non répondus : ${unanswered}
- Photos Google : ${photos}
- Description fiche : ${hasDesc ? 'Présente' : 'Absente'}
- Site web : ${hasSite ? websiteUrl : 'Absent'}${perfScore !== null ? ` | Perf: ${perfScore}/100` : ''}${seoScore !== null ? ` | SEO: ${seoScore}/100` : ''}
- Réseaux visuels présents : ${visualNets.length > 0 ? visualNets.join(', ') : 'Aucun'}
- Réseaux visuels absents : ${missingVisual.length > 0 ? missingVisual.join(', ') : 'Aucun'}
- Secteur : ${domain ?? '—'}
${topQuotes.length > 0 ? `- Citations clients (verbatim) :\n${topQuotes.map(q => `  "${q}"`).join('\n')}` : ''}
${isRestaurant ? '- Contexte : Restauration — les visuels sont le premier facteur de décision client.' : ''}
${isBeauty ? '- Contexte : Beauté — l\'identité visuelle crée la confiance avant le premier contact.' : ''}

${buildAuditRulesBlock('designer')}

Retourne UNIQUEMENT ce JSON valide (pas de texte avant ou après) :
{
  "resume_executif": "Synthèse en 3-4 phrases sur l'état actuel de l'identité visuelle et le potentiel de progression",
  "forces": [
    { "titre": "Force 1", "description": "Explication 1-2 phrases" },
    { "titre": "Force 2", "description": "Explication 1-2 phrases" }
  ],
  "faiblesses": [
    { "titre": "Faiblesse 1", "description": "Explication 1-2 phrases" },
    { "titre": "Faiblesse 2", "description": "Explication 1-2 phrases" }
  ],
  "opportunites": [
    { "titre": "Opportunité 1", "description": "Ce que tu peux apporter concrètement" },
    { "titre": "Opportunité 2", "description": "Ce que tu peux apporter concrètement" }
  ],
  "recommandations": [
    { "titre": "Action prioritaire 1", "description": "Description actionnable", "priorite": 1 },
    { "titre": "Action prioritaire 2", "description": "Description actionnable", "priorite": 2 },
    { "titre": "Action prioritaire 3", "description": "Description actionnable", "priorite": 3 }
  ],
  "accroche": "Phrase factuelle — jamais de promesses marketing",
  "comparaison_concurrents": {"position": "...", "avantages": ["..."], "retards": ["..."]},
  "timeline": {"semaine_1": "...", "semaine_2_3": "...", "mois_2_3": "..."},
  "titre_audit": "Audit Identité Visuelle & Branding"
}`

  console.log(`[generateAuditDesigner] ${name} | photos:${photos} | visualNets:${visualNets.join(',')} | missing:${missingVisual.join(',')} | prompt:${prompt.length} chars`)

  let message
  try {
    message = await anthropic.messages.create({
      model:      'claude-sonnet-4-6',
      max_tokens: 2500,
      messages:   [{ role: 'user', content: prompt }],
    })
  } catch (err) {
    console.error('[generateAuditDesigner] ✗ Erreur Anthropic:', err.message)
    throw new Error(`Erreur génération audit designer: ${err.message}`)
  }

  const raw = message.content[0].text
  console.log(`[generateAuditDesigner] ✓ réponse reçue (${raw.length} chars)`)

  function tryParse(str) { try { return JSON.parse(str) } catch (_) { return null } }
  function cleanAndParse(str) {
    const cleaned = str.replace(/[\u0000-\u001F\u007F-\u009F]/g, ' ').replace(/,\s*([}\]])/g, '$1')
    return tryParse(cleaned)
  }

  const start = raw.indexOf('{')
  const end   = raw.lastIndexOf('}')
  if (start === -1 || end === -1 || end <= start) {
    console.error('[generateAuditDesigner] Aucun JSON trouvé')
    return enrichAuditResult({ resume_executif: 'Audit généré avec des données partielles — veuillez relancer.', forces: [], faiblesses: [], opportunites: [], recommandations: [{ titre: 'Créer une identité visuelle cohérente', description: 'Définir une charte graphique et déployer des visuels professionnels sur tous les supports.', priorite: 1 }], accroche: 'Votre réputation mérite une image à sa hauteur.' })
  }

  const jsonStr = raw.slice(start, end + 1)
  const parsed  = tryParse(jsonStr) || cleanAndParse(jsonStr)

  if (!parsed) {
    console.error('[generateAuditDesigner] Parse échoué. JSON extrait:', jsonStr)
    return enrichAuditResult({ resume_executif: 'Audit généré avec des données partielles — veuillez relancer.', forces: [], faiblesses: [], opportunites: [], recommandations: [{ titre: 'Créer une identité visuelle cohérente', description: 'Définir une charte graphique et déployer des visuels professionnels.', priorite: 1 }], accroche: 'Votre réputation mérite une image à sa hauteur.' })
  }

  return enrichAuditResult(parsed)
}

// ── Email generator — DEV-WEB profile ────────────────────────────────────────
async function generateEmailWebDev({ leadData, websiteUrl, pagespeedData, cms, hasHttps, hasSitemap, reviewsData }) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY manquante')
  const anthropic = new Anthropic({ apiKey })

  const name        = leadData.name        ?? 'ce commerce'
  const city        = leadData.city        ?? ''
  const category    = leadData.category    ?? 'ce secteur'
  const rating      = leadData.rating      ?? null
  const reviewCount = leadData.reviewCount ?? null

  const hasSite  = !!(websiteUrl && websiteUrl !== 'null' && websiteUrl !== 'undefined')
  const rawPerf  = pagespeedData?.performance ?? null
  const perf     = rawPerf != null ? (rawPerf <= 1 ? Math.round(rawPerf * 100) : Math.round(rawPerf)) : null
  const mobile   = pagespeedData?.mobileFriendly ?? null
  const sitemap  = hasSitemap ?? pagespeedData?.sitemap ?? null
  const https    = hasHttps   ?? pagespeedData?.https   ?? null
  const cmsKey   = (cms ?? pagespeedData?.cms?.cms ?? '').toLowerCase()
  const CMS_LABELS = { wordpress: 'CMS open-source', wix: 'Constructeur de site', shopify: 'Plateforme e-commerce', squarespace: 'Solution tout-en-un', webflow: 'Solution no-code', jimdo: 'Constructeur de site' }
  const cmsLabel = CMS_LABELS[cmsKey] ?? null

  const weakPoints = [
    !hasSite                             ? 'aucun site web détecté' : null,
    hasSite && https === false           ? 'site sans certificat HTTPS' : null,
    perf != null && perf < 50            ? `performance très faible (${perf}/100)` : null,
    mobile === false                     ? 'site non optimisé pour mobile' : null,
    hasSite && sitemap === false         ? 'pas de sitemap XML' : null,
  ].filter(Boolean)

  const observationLine = weakPoints.length > 0
    ? weakPoints.slice(0, 2).join(' et ')
    : 'les performances techniques ont un potentiel d\'amélioration'

  const topQuotes = extractTopQuotes(reviewsData)
  const catLow = category.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  const isRestaurant = /restaurant|cafe|brasserie|pizz|burger|traiteur/.test(catLow)
  const isRetail     = /boutique|commerce|magasin|retail|mode|vetement/.test(catLow)

  let sectorHint
  if (isRestaurant) sectorHint = 'En restauration, un site avec menu en ligne et réservation convertit 30% de visiteurs supplémentaires.'
  else if (isRetail) sectorHint = 'Dans le commerce local, un site rapide et mobile-friendly est le premier levier de conversion des recherches Google.'
  else sectorHint = 'Dans votre secteur, la performance technique du site est un facteur direct de crédibilité et de conversion.'

  const prompt = `Tu es développeur web freelance spécialisé dans les commerces locaux. Rédige un email de prospection pour ${name}.

RÈGLE ABSOLUE — ZÉRO NOM DE MARQUE : N'utilise aucun nom de marque, outil ou plateforme commerciale dans tes recommandations. Interdit : Planity, Reservio, Hootsuite, Buffer, Canva, Mailchimp, Brevo, HubSpot, Calendly, WordPress, Webflow, Shopify, Wix, Crisp, Tidio, Intercom, Semrush, Ahrefs, etc. Utilise uniquement des descriptions génériques : "outil de réservation en ligne", "plateforme de gestion des réseaux sociaux", "solution d'email marketing", "logiciel de chat en ligne", "outil de planification éditoriale".

DONNÉES VERROUILLÉES — UTILISER UNIQUEMENT CES CHIFFRES :
- Nom : ${name}
- Ville : ${city || '—'}
- Catégorie : ${category}
- Note Google : ${rating ?? '—'}/5 — Avis : ${reviewCount ?? '—'}
- Site web : ${hasSite ? websiteUrl : 'ABSENT'}
- HTTPS : ${https == null ? 'Non analysé' : https ? 'Oui' : 'Non'}
- Performance : ${perf ?? 'Non analysé'}/100
- Mobile friendly : ${mobile == null ? 'Non analysé' : mobile ? 'Oui' : 'Non'}
- CMS : ${cmsLabel ?? 'Non identifié'}
- Observation principale : ${observationLine}
- Contexte secteur : ${sectorHint}
${topQuotes.length > 0 ? `- Citations clients : ${topQuotes.slice(0,2).map(q => `"${q}"`).join(' / ')}` : ''}

STRUCTURE — 5 PARAGRAPHES COURTS :
P1 — Accroche factuelle sur le point technique faible identifié (1-2 phrases, ne pas commencer par "Je")
P2 — Impact concret de ce problème sur les clients et le business
P3 — Ta valeur ajoutée concrète en tant que développeur local (sans mention de tarif)
P4 — Ce que tu peux améliorer précisément (HTTPS, vitesse, mobile, sitemap)
P5 — Appel à l'action simple et concret (1-2 phrases)

${EMAIL_STATS_NOTE}

RÈGLES :
- Ne jamais inventer de chiffres ou faits non fournis
- Vouvoiement tout au long de l'email
- Ton technique mais accessible, pas de jargon inutile
- Longueur totale : 150-220 mots
- Objet : accrocheur, factuel, sans emoji (max 80 caractères)

Retourne UNIQUEMENT un JSON valide :
{"subject":"...","body":"Corps complet de l'email avec sauts de ligne \\n"}`

  console.log(`[generateEmailWebDev] ${name} | city:${city} | hasSite:${hasSite} | perf:${perf ?? '—'} | https:${https} | prompt:${prompt.length} chars`)

  let message
  try {
    message = await anthropic.messages.create({
      model:      'claude-sonnet-4-6',
      max_tokens: 800,
      messages:   [{ role: 'user', content: prompt }],
    })
  } catch (err) {
    console.error('[generateEmailWebDev] ✗ Erreur Anthropic:', err.message)
    throw new Error(`Erreur génération email dev-web: ${err.message}`)
  }

  const raw = message.content[0].text
  console.log(`[generateEmailWebDev] ✓ réponse reçue (${raw.length} chars)`)
  const jsonMatch = raw.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('Réponse JSON invalide du modèle')
  try { return JSON.parse(jsonMatch[0]) }
  catch { return JSON.parse(jsonMatch[0].replace(/[\u0000-\u001F\u007F-\u009F]/g, ' ')) }
}

// ── Audit generator — DEV-WEB profile ────────────────────────────────────────
async function generateAuditWebDev({ businessName, websiteUrl, pagespeedData, cms, hasHttps, hasSitemap, hasRobots, domainAge, indexedPages, socialPresence, googleRating, totalReviews, domain }) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY manquante')
  const anthropic = new Anthropic({ apiKey })

  const name    = businessName ?? 'ce commerce'
  const hasSite = !!(websiteUrl && websiteUrl !== 'null' && websiteUrl !== 'undefined')

  const rawPerf  = pagespeedData?.performance ?? null
  const perf     = rawPerf != null ? (rawPerf <= 1 ? Math.round(rawPerf * 100) : Math.round(rawPerf)) : null
  const rawPerfD = pagespeedData?.performanceDesktop ?? pagespeedData?.desktopPerf ?? null
  const perfD    = rawPerfD != null ? (rawPerfD <= 1 ? Math.round(rawPerfD * 100) : Math.round(rawPerfD)) : null
  const rawAcc   = pagespeedData?.accessibility ?? null
  const acc      = rawAcc != null ? (rawAcc <= 1 ? Math.round(rawAcc * 100) : Math.round(rawAcc)) : null
  const rawSeo   = pagespeedData?.seo ?? null
  const seo      = rawSeo != null ? (rawSeo <= 1 ? Math.round(rawSeo * 100) : Math.round(rawSeo)) : null

  const https       = hasHttps  ?? pagespeedData?.https   ?? null
  const sitemap     = hasSitemap ?? pagespeedData?.sitemap ?? null
  const robots      = hasRobots  ?? pagespeedData?.robots  ?? null
  const mobile      = pagespeedData?.mobileFriendly ?? null
  const loadTime    = pagespeedData?.loadTime ?? null
  const lcp         = pagespeedData?.lcp      ?? null
  const cls         = pagespeedData?.cls      ?? null
  const imagesOpt   = pagespeedData?.imagesOptimized  ?? null
  const renderBlock = pagespeedData?.renderBlocking   ?? null

  const cmsKey   = (cms ?? pagespeedData?.cms?.cms ?? '').toLowerCase()
  const CMS_LABELS = { wordpress: 'CMS open-source', wix: 'Constructeur de site', shopify: 'Plateforme e-commerce', squarespace: 'Solution tout-en-un', webflow: 'Solution no-code', jimdo: 'Constructeur de site' }
  const cmsLabel = CMS_LABELS[cmsKey] ?? (cmsKey ? cmsKey : 'Non identifié')

  const daLabel  = domainAge?.ageLabel  ?? null
  const ipLabel  = indexedPages?.label  ?? null

  const prompt = `Tu es expert en développement web et performance technique. Génère un audit complet pour ${name}.

RÈGLE ABSOLUE — ZÉRO NOM DE MARQUE : N'utilise aucun nom de marque, outil ou plateforme commerciale dans tes recommandations. Interdit : Planity, Reservio, Hootsuite, Buffer, Canva, Mailchimp, Brevo, HubSpot, Calendly, WordPress, Webflow, Shopify, Wix, Crisp, Tidio, Intercom, Semrush, Ahrefs, etc. Utilise uniquement des descriptions génériques : "outil de réservation en ligne", "plateforme de gestion des réseaux sociaux", "solution d'email marketing", "logiciel de chat en ligne", "outil de planification éditoriale".

DONNÉES TECHNIQUES :
- Site web : ${hasSite ? websiteUrl : 'ABSENT — aucun site détecté'}
- Note Google : ${googleRating ?? '—'}/5 | Avis : ${totalReviews ?? 0}
- CMS : ${cmsLabel}
- HTTPS : ${https == null ? 'Non analysé' : https ? 'Oui ✅' : 'Non ❌'}
- Mobile friendly : ${mobile == null ? 'Non analysé' : mobile ? 'Oui ✅' : 'Non ❌'}
- Performance mobile : ${perf ?? '—'}/100${perfD != null ? ` | Desktop : ${perfD}/100` : ''}
- Temps de chargement : ${loadTime ? `${Number(loadTime).toFixed(1)}s` : '—'}${lcp ? ` | LCP : ${lcp}` : ''}${cls ? ` | CLS : ${cls}` : ''}
- Score SEO PageSpeed : ${seo ?? '—'}/100
- Accessibilité : ${acc ?? '—'}/100
- Sitemap : ${sitemap == null ? 'Non vérifié' : sitemap ? 'Présent ✅' : 'Absent ❌'}
- Robots.txt : ${robots == null ? 'Non vérifié' : robots ? 'Présent ✅' : 'Absent ❌'}
- Images optimisées : ${imagesOpt == null ? '—' : imagesOpt ? 'Oui' : 'Non'}
- Ressources bloquantes : ${renderBlock != null ? renderBlock : '—'}
- Pages indexées : ${ipLabel ?? '—'}
- Âge du domaine : ${daLabel ?? '—'}
- Secteur : ${domain ?? '—'}

${buildAuditRulesBlock('web-dev')}

Retourne UNIQUEMENT ce JSON valide (pas de texte avant ou après) :
{
  "resume_executif": "Synthèse en 3-4 phrases sur l'état technique du site et les leviers d'amélioration prioritaires",
  "forces": [
    { "titre": "Force 1", "description": "Explication 1-2 phrases" },
    { "titre": "Force 2", "description": "Explication 1-2 phrases" }
  ],
  "faiblesses": [
    { "titre": "Faiblesse 1", "description": "Explication 1-2 phrases" },
    { "titre": "Faiblesse 2", "description": "Explication 1-2 phrases" }
  ],
  "opportunites": [
    { "titre": "Opportunité 1", "description": "Ce que tu peux apporter concrètement" },
    { "titre": "Opportunité 2", "description": "Ce que tu peux apporter concrètement" }
  ],
  "recommandations": [
    { "titre": "Action prioritaire 1", "description": "Description actionnable et précise", "priorite": 1 },
    { "titre": "Action prioritaire 2", "description": "Description actionnable et précise", "priorite": 2 },
    { "titre": "Action prioritaire 3", "description": "Description actionnable et précise", "priorite": 3 }
  ],
  "accroche": "Phrase factuelle — jamais de promesses marketing",
  "comparaison_concurrents": {"position": "...", "avantages": ["..."], "retards": ["..."]},
  "timeline": {"semaine_1": "...", "semaine_2_3": "...", "mois_2_3": "..."},
  "titre_audit": "Audit Technique & Performance Web"
}`

  console.log(`[generateAuditWebDev] ${name} | hasSite:${hasSite} | perf:${perf ?? '—'} | https:${https} | cms:${cmsLabel} | prompt:${prompt.length} chars`)

  let message
  try {
    message = await anthropic.messages.create({
      model:      'claude-sonnet-4-6',
      max_tokens: 2500,
      messages:   [{ role: 'user', content: prompt }],
    })
  } catch (err) {
    console.error('[generateAuditWebDev] ✗ Erreur Anthropic:', err.message)
    throw new Error(`Erreur génération audit dev-web: ${err.message}`)
  }

  const raw = message.content[0].text
  console.log(`[generateAuditWebDev] ✓ réponse reçue (${raw.length} chars)`)

  function tryParse(str) { try { return JSON.parse(str) } catch (_) { return null } }
  function cleanAndParse(str) {
    const cleaned = str.replace(/[\u0000-\u001F\u007F-\u009F]/g, ' ').replace(/,\s*([}\]])/g, '$1')
    return tryParse(cleaned)
  }

  const start = raw.indexOf('{')
  const end   = raw.lastIndexOf('}')
  if (start === -1 || end === -1 || end <= start) {
    console.error('[generateAuditWebDev] Aucun JSON trouvé')
    return enrichAuditResult({ resume_executif: 'Audit généré avec des données partielles — veuillez relancer.', forces: [], faiblesses: [], opportunites: [], recommandations: [{ titre: 'Corriger les fondamentaux techniques', description: 'HTTPS, sitemap, robots.txt et performance mobile à traiter en priorité.', priorite: 1 }], accroche: 'Un site rapide et sécurisé, c\'est plus de clients et moins de clients perdus.' })
  }

  const jsonStr = raw.slice(start, end + 1)
  const parsed  = tryParse(jsonStr) || cleanAndParse(jsonStr)

  if (!parsed) {
    console.error('[generateAuditWebDev] Parse échoué. JSON extrait:', jsonStr)
    return enrichAuditResult({ resume_executif: 'Audit généré avec des données partielles — veuillez relancer.', forces: [], faiblesses: [], opportunites: [], recommandations: [{ titre: 'Optimiser les performances techniques', description: 'Vitesse, sécurité et indexation à corriger.', priorite: 1 }], accroche: 'Un site rapide et sécurisé, c\'est plus de clients et moins de clients perdus.' })
  }

  return enrichAuditResult(parsed)
}

// ── Audit generator — EMAIL MARKETING profile ─────────────────────────���──────
async function generateAuditEmailMarketing({
  businessName, websiteUrl, totalReviews, googleRating,
  ownerReplyRatio, hasNewsletter, hasContactForm, socialPresence, domain, pagespeedData,
  // Enriched signals — available when reviews/IA/audit have been run
  loyaltyMentions = 0, loyaltyTopics = [],
  unansweredCount = null, totalReviewsFull = null, ownerReplyRatioFull = null,
  visitFrequency = null, businessStability = null, canInvest = false,
  aiReport = null,
  facebookActivity = null, instagramActivity = null,
}) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY manquante')
  const anthropic = new Anthropic({ apiKey })

  const name     = businessName ?? 'ce commerce'
  const hasSite  = !!(websiteUrl && websiteUrl !== 'null' && websiteUrl !== 'undefined')
  const reviews  = Number(totalReviews) || 0
  const rating   = googleRating ?? null

  // Reply ratio — prefer full data (100 reviews) over estimate (5 reviews)
  const effectiveRatio = ownerReplyRatioFull ?? ownerReplyRatio
  const replyPct = effectiveRatio != null
    ? `${Math.round(effectiveRatio * 100)}% ${totalReviewsFull ? `(${totalReviewsFull} avis)` : '(5 avis récents)'}`
    : 'Non analysé'

  const unansweredLine = (unansweredCount != null && totalReviewsFull != null)
    ? `${unansweredCount}/${totalReviewsFull} (données complètes)`
    : ownerReplyRatio != null
      ? `${5 - Math.round(ownerReplyRatio * 5)}/5 (estimation 5 avis récents)`
      : '—'

  const nets = socialPresence
    ? [socialPresence.facebook, socialPresence.instagram, socialPresence.tiktok,
       socialPresence.linkedin, socialPresence.youtube, socialPresence.pinterest]
        .filter(Boolean).length
    : 0

  const fbFollowers = facebookActivity?.followersCount ?? facebookActivity?.likes ?? null
  const igFollowers = instagramActivity?.followersCount ?? instagramActivity?.followers ?? null

  const estimatedClients = Math.round(reviews * 10)

  const prompt = `Tu es consultant en email marketing spécialisé dans les commerces locaux. Génère un audit complet pour ${name}.

RÈGLE ABSOLUE — ZÉRO NOM DE MARQUE : N'utilise aucun nom de marque, outil ou plateforme commerciale dans tes recommandations. Interdit : Planity, Reservio, Hootsuite, Buffer, Canva, Mailchimp, Brevo, HubSpot, Calendly, WordPress, Webflow, Shopify, Wix, Crisp, Tidio, Intercom, Semrush, Ahrefs, etc. Utilise uniquement des descriptions génériques : "outil de réservation en ligne", "plateforme de gestion des réseaux sociaux", "solution d'email marketing", "logiciel de chat en ligne", "outil de planification éditoriale".

DONNÉES GÉNÉRALES :
- Nom : ${name}
- Secteur : ${domain ?? '—'}
- Site web : ${hasSite ? websiteUrl : 'ABSENT'}
- Note Google : ${rating ?? '—'}/5
- Avis Google : ${reviews}
- Clients estimés : ~${estimatedClients} (base : avis × 10)

DONNÉES ENRICHIES (${totalReviewsFull ? `basées sur ${totalReviewsFull} avis complets` : 'basées sur 5 avis récents'}) :
- Taux réponse propriétaire : ${replyPct}
- Avis sans réponse : ${unansweredLine}
- Mentions fidélité dans les avis : ${loyaltyMentions} mention${loyaltyMentions !== 1 ? 's' : ''}${loyaltyTopics.length > 0 ? ` (thèmes : ${loyaltyTopics.join(', ')})` : ''}
- Fréquence de visite estimée : ${visitFrequency ?? '—'}
- Stabilité business : ${businessStability ?? '—'}${canInvest ? ' — capacité d\'investissement confirmée' : ''}

PRÉSENCE DIGITALE :
- Newsletter détectée : ${hasNewsletter != null ? (hasNewsletter ? 'Oui' : 'Non') : 'Non analysé'}
- Formulaire de contact : ${hasContactForm != null ? (hasContactForm ? 'Oui' : 'Non') : 'Non analysé'}
- Réseaux sociaux actifs : ${nets} réseau${nets !== 1 ? 'x' : ''}${fbFollowers ? ` · Facebook ${fbFollowers} abonnés` : ''}${igFollowers ? ` · Instagram ${igFollowers} abonnés` : ''}
- Performance site (PageSpeed) : ${pagespeedData?.performance != null ? `${Math.round(pagespeedData.performance <= 1 ? pagespeedData.performance * 100 : pagespeedData.performance)}/100` : '—'}
${aiReport ? `\nANALYSE IA DES AVIS :\n${aiReport.slice(0, 600)}\n` : ''}
${buildAuditRulesBlock('email-marketing')}

Retourne UNIQUEMENT ce JSON valide (pas de texte avant ou après) :
{
  "resume_executif": "Synthèse en 3-4 phrases sur le potentiel email marketing de ce commerce",
  "forces": ["point fort 1", "point fort 2"],
  "faiblesses": ["faiblesse 1", "faiblesse 2", "faiblesse 3"],
  "opportunites": ["opportunité 1", "opportunité 2"],
  "recommandations": [
    { "titre": "...", "description": "...", "priorite": 1 },
    { "titre": "...", "description": "...", "priorite": 2 },
    { "titre": "...", "description": "...", "priorite": 3 }
  ],
  "accroche": "Phrase factuelle — jamais de promesses marketing",
  "comparaison_concurrents": {"position": "...", "avantages": ["..."], "retards": ["..."]},
  "timeline": {"semaine_1": "...", "semaine_2_3": "...", "mois_2_3": "..."},
  "titre_audit": "Audit Email Marketing & Fidélisation"
}

Règles :
- Ton neutre, professionnel, orienté résultats et ROI
- Aucune marque d'outil email marketing
- Maximum 4000 chars au total
- Signature de contexte : "Consultant Email Marketing — ${domain ?? 'commerce local'}"`

  console.log(`[generateAuditEmailMarketing] ${name} | reviews:${reviews}${totalReviewsFull ? `(complets:${totalReviewsFull})` : ''} | newsletter:${hasNewsletter} | loyalty:${loyaltyMentions} | stability:${businessStability ?? '?'} | aiReport:${aiReport ? 'oui' : 'non'} | prompt:${prompt.length} chars`)

  let message
  try {
    message = await anthropic.messages.create({
      model:      'claude-sonnet-4-6',
      max_tokens: 2000,
      messages:   [{ role: 'user', content: prompt }],
    })
  } catch (err) {
    console.error('[generateAuditEmailMarketing] ✗ Erreur Anthropic:', err.message)
    throw new Error(`Erreur génération audit email marketing: ${err.message}`)
  }

  const raw = message.content[0].text
  console.log(`[generateAuditEmailMarketing] ✓ réponse reçue (${raw.length} chars)`)

  function tryParse(str) { try { return JSON.parse(str) } catch (_) { return null } }
  function cleanAndParse(str) {
    const cleaned = str.replace(/[\u0000-\u001F\u007F-\u009F]/g, ' ')
    return tryParse(cleaned)
  }

  const start = raw.indexOf('{')
  const end   = raw.lastIndexOf('}')
  if (start === -1 || end === -1 || end <= start) {
    console.error('[generateAuditEmailMarketing] Aucun JSON trouvé')
    return enrichAuditResult({ resume_executif: 'Audit généré avec des données partielles — veuillez relancer.', forces: [], faiblesses: [], opportunites: [], recommandations: [{ titre: 'Mettre en place une stratégie email', description: 'Capturer les emails des clients et créer des campagnes de fidélisation adaptées au secteur.', priorite: 1 }], accroche: 'Vos clients satisfaits sont votre meilleure audience — apprenons à les fidéliser.' })
  }

  const jsonStr = raw.slice(start, end + 1)
  const parsed  = tryParse(jsonStr) || cleanAndParse(jsonStr)

  if (!parsed) {
    console.error('[generateAuditEmailMarketing] Parse échoué. JSON extrait:', jsonStr)
    return enrichAuditResult({ resume_executif: 'Audit généré avec des données partielles — veuillez relancer.', forces: [], faiblesses: [], opportunites: [], recommandations: [{ titre: 'Capturer les emails clients', description: 'Ajouter un formulaire de capture email sur le site et les réseaux sociaux.', priorite: 1 }], accroche: 'Vos clients satisfaits sont votre meilleure audience — apprenons à les fidéliser.' })
  }

  return enrichAuditResult(parsed)
}

// ── Email personnalisé — EMAIL MARKETING profile ─────────────────────��────────
async function generateEmailEmailMarketing({ leadData, reviewsData, hasNewsletter, hasContactForm, socialPresence, ownerReplyRatio }) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY manquante')
  const anthropic = new Anthropic({ apiKey })

  const name         = leadData.name      ?? 'ce commerce'
  const city         = leadData.city      ?? ''
  const category     = leadData.category  ?? 'ce secteur'
  const rating       = leadData.rating    ?? null
  const reviewCount  = leadData.reviewCount ?? null
  const hasSite      = !!(leadData.website && leadData.website !== 'null')
  const unanswered   = reviewsData?.unanswered ?? 0
  const replyPct     = ownerReplyRatio != null ? Math.round(ownerReplyRatio * 100) : null
  const estimClients = Math.round((reviewCount ?? 0) * 10)

  const nets = socialPresence
    ? [socialPresence.facebook, socialPresence.instagram, socialPresence.tiktok,
       socialPresence.linkedin, socialPresence.youtube, socialPresence.pinterest]
        .filter(Boolean).length
    : 0

  const topQuotes = (reviewsData?.topQuotes ?? []).slice(0, 2)

  const prompt = `Tu es consultant en email marketing freelance spécialisé dans les commerces locaux. Rédige un email de prospection pour ${name}.

RÈGLE ABSOLUE — ZÉRO NOM DE MARQUE : N'utilise aucun nom de marque, outil ou plateforme commerciale dans tes recommandations. Interdit : Planity, Reservio, Hootsuite, Buffer, Canva, Mailchimp, Brevo, HubSpot, Calendly, WordPress, Webflow, Shopify, Wix, Crisp, Tidio, Intercom, Semrush, Ahrefs, etc. Utilise uniquement des descriptions génériques : "outil de réservation en ligne", "plateforme de gestion des réseaux sociaux", "solution d'email marketing", "logiciel de chat en ligne", "outil de planification éditoriale".

DONNÉES VERROUILLÉES — UTILISER UNIQUEMENT CES CHIFFRES :
- Nom : ${name}
- Ville : ${city || '—'}
- Catégorie : ${category}
- Note Google : ${rating ?? '—'}/5 — Avis : ${reviewCount ?? '—'}
- Clients estimés : ${estimClients} (base : avis × 10)
- Taux réponse propriétaire : ${replyPct != null ? `${replyPct}%` : 'Non analysé'}
- Avis sans réponse : ${unanswered}
- Site web : ${hasSite ? 'Présent' : 'ABSENT'}
- Newsletter : ${hasNewsletter ? 'Détectée' : 'Absente'}
- Formulaire contact : ${hasContactForm ? 'Présent' : 'Absent'}
- Réseaux sociaux actifs : ${nets}
${topQuotes.length > 0 ? `- Citations clients : ${topQuotes.map(q => `"${q}"`).join(' / ')}` : ''}

STRUCTURE — 5 PARAGRAPHES COURTS :
P1 — Accroche sur les clients non fidélisés (chiffre concret, ne pas commencer par "Je")
P2 — Impact concret : clients acquis mais jamais réengagés, perte de revenu récurrent
P3 — Ta valeur ajoutée : mise en place d'une stratégie email adaptée au commerce local
P4 — Ce que tu peux faire précisément (capture email, séquences automatiques, campagnes saisonnières)
P5 — Appel à l'action simple et concret (1-2 phrases)

${EMAIL_STATS_NOTE}

RÈGLES :
- Ne jamais inventer de chiffres ou faits non fournis
- Vouvoiement tout au long de l'email
- Orienté ROI et résultats concrets — aucune marque d'outil
- Longueur totale : 150-220 mots
- Objet : accrocheur, factuel, sans emoji (max 80 caractères)
- Signature : Consultant Email Marketing — ${city || 'votre ville'}

Retourne UNIQUEMENT un JSON valide :
{"subject":"...","body":"Corps complet de l'email avec sauts de ligne \\n"}`

  console.log(`[generateEmailEmailMarketing] ${name} | city:${city} | newsletter:${hasNewsletter} | prompt:${prompt.length} chars`)

  let message
  try {
    message = await anthropic.messages.create({
      model:      'claude-sonnet-4-6',
      max_tokens: 800,
      messages:   [{ role: 'user', content: prompt }],
    })
  } catch (err) {
    console.error('[generateEmailEmailMarketing] ✗ Erreur Anthropic:', err.message)
    throw new Error(`Erreur génération email marketing: ${err.message}`)
  }

  const raw = message.content[0].text
  console.log(`[generateEmailEmailMarketing] ✓ réponse reçue (${raw.length} chars)`)
  const jsonMatch = raw.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('Réponse JSON invalide du modèle')
  try { return JSON.parse(jsonMatch[0]) }
  catch { return JSON.parse(jsonMatch[0].replace(/[\u0000-\u001F\u007F-\u009F]/g, ' ')) }
}

// ── Audit Google Ads ──────────────────────────────────────────────────────────
async function generateAuditGoogleAds({ businessName, websiteUrl, googleRating, totalReviews, pagespeedData, photoCount, hasDescription, hasHours, socialPresence, domain, reviewsData, city = null }) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY manquante')
  console.log(`[generateAuditGoogleAds] business:"${businessName}" | site:${websiteUrl ?? 'absent'} | perf:${pagespeedData?.performance ?? '—'} | rating:${googleRating ?? '—'}`)

  const rawPerf = pagespeedData?.performance ?? null
  const perf    = rawPerf != null ? (rawPerf <= 1 ? Math.round(rawPerf * 100) : Math.round(rawPerf)) : null
  const hasHttps   = pagespeedData?.https    ?? false
  const loadTime   = pagespeedData?.loadTime ?? null
  const hasSitemap = pagespeedData?.sitemap  ?? false
  const nets = Object.entries(socialPresence ?? {})
    .filter(([, v]) => v).map(([k]) => k).join(', ') || 'aucun'

  const fiche = [
    `Photos fiche Google : ${photoCount ?? '?'} (${(photoCount ?? 0) > 10 ? 'bonne visibilité' : 'insuffisant'})`,
    `Description fiche   : ${hasDescription ? 'Présente' : 'ABSENTE'}`,
    `Horaires renseignés : ${hasHours ? 'Oui' : 'NON'}`,
  ].join('\n')

  const siteBlock = websiteUrl
    ? [
        `URL                 : ${websiteUrl}`,
        `Performance mobile  : ${perf !== null ? `${perf}/100` : 'non disponible'}`,
        `HTTPS               : ${hasHttps ? '✅ Sécurisé' : '❌ NON sécurisé'}`,
        `Temps de chargement : ${loadTime ?? 'non disponible'}`,
        `Sitemap XML         : ${hasSitemap ? 'Présent' : 'ABSENT'}`,
      ].join('\n')
    : '🚨 AUCUN SITE WEB — ads impossibles sans landing page'

  const reviewBlock = reviewsData
    ? `Avis positifs : ${reviewsData.positive?.count ?? '?'} | Négatifs : ${reviewsData.negative?.count ?? '?'} | Sans réponse : ${reviewsData.negative?.unanswered ?? '?'}`
    : `Note : ${googleRating ?? '?'}/5 | Total avis : ${totalReviews ?? '?'}`

  const sigCity = city ? ` — ${city}` : ''

  const prompt = `Tu es un consultant Google Ads spécialisé dans les commerces locaux. Analyse la compatibilité Google Ads de "${businessName}" (secteur : ${domain ?? 'non précisé'}) et produis un audit structuré.

RÈGLE ABSOLUE — ZÉRO NOM DE MARQUE : N'utilise aucun nom de marque, outil ou plateforme commerciale dans tes recommandations. Interdit : Planity, Reservio, Hootsuite, Buffer, Canva, Mailchimp, Brevo, HubSpot, Calendly, WordPress, Webflow, Shopify, Wix, Crisp, Tidio, Intercom, Semrush, Ahrefs, etc. Utilise uniquement des descriptions génériques : "outil de réservation en ligne", "plateforme de gestion des réseaux sociaux", "solution d'email marketing", "logiciel de chat en ligne", "outil de planification éditoriale".

DONNÉES DISPONIBLES :

📍 FICHE GOOGLE :
Note Google : ${googleRating ?? '?'}/5 | Volume avis : ${totalReviews ?? '?'}
${fiche}
${reviewBlock}

🌐 SITE WEB & PERFORMANCE :
${siteBlock}

📱 RÉSEAUX SOCIAUX PRÉSENTS : ${nets}

${buildAuditRulesBlock('google-ads')}

PRODUIS UNIQUEMENT un JSON valide (sans texte avant ou après) avec cette structure :
{
  "resume_executif": "2-3 phrases sur le potentiel Google Ads de ce business",
  "forces": [
    {"titre": "...", "description": "..."},
    {"titre": "...", "description": "..."}
  ],
  "faiblesses": [
    {"titre": "...", "description": "..."},
    {"titre": "...", "description": "..."}
  ],
  "opportunites": [
    {"titre": "...", "description": "..."},
    {"titre": "...", "description": "..."}
  ],
  "recommandations": [
    {"priorite": 1, "titre": "...", "description": "..."},
    {"priorite": 2, "titre": "...", "description": "..."},
    {"priorite": 3, "titre": "...", "description": "..."}
  ],
  "accroche": "phrase factuelle — jamais de promesses marketing",
  "comparaison_concurrents": {"position": "...", "avantages": ["..."], "retards": ["..."]},
  "timeline": {"semaine_1": "...", "semaine_2_3": "...", "mois_2_3": "..."},
  "titre_audit": "Audit Google Ads & Acquisition Locale"
}

RÈGLES :
- Forces et faiblesses : 2 à 4 items chacun, basés strictement sur les données
- Recommandations : 3 items ordonnés par priorité, focalisés sur les prérequis ads puis la stratégie
- Prose uniquement, pas de bullet points, max 4000 chars total
- Pas de marques d'outils de gestion ads
- Signature implicite : "Consultant Google Ads${sigCity}"`

  const anthropic = new Anthropic({ apiKey })
  const message = await anthropic.messages.create({
    model:      'claude-sonnet-4-6',
    max_tokens: 2000,
    messages:   [{ role: 'user', content: prompt }],
  })
  console.log(`[generateAuditGoogleAds] ✓ réponse (tokens: ${message.usage?.output_tokens ?? '?'})`)
  const raw = message.content[0].text
  const jsonMatch = raw.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('Réponse JSON invalide du modèle')
  try { return enrichAuditResult(JSON.parse(jsonMatch[0])) }
  catch { return enrichAuditResult(JSON.parse(jsonMatch[0].replace(/[\u0000-\u001F\u007F-\u009F]/g, ' '))) }
}

// ── Email Google Ads ──────────────────────────────────────────────────────────
async function generateEmailGoogleAds({ leadData, pagespeedData, reviewsData, googleAdsReadiness: readiness, concurrence }) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY manquante')

  const name    = leadData?.name     ?? 'ce commerce'
  const city    = leadData?.city     ?? ''
  const rating  = leadData?.rating   ?? '?'
  const reviews = leadData?.reviewCount ?? '?'
  const website = leadData?.website  ?? null

  const rawPerf = pagespeedData?.performance ?? null
  const perf    = rawPerf != null ? (rawPerf <= 1 ? Math.round(rawPerf * 100) : Math.round(rawPerf)) : null
  const hasHttps  = pagespeedData?.https    ?? null
  const loadTime  = pagespeedData?.loadTime ?? null

  const unanswered = reviewsData?.unanswered ?? 0
  const readinessLabel = readiness?.label ?? 'Non évalué'
  const readinessScore = readiness?.score ?? null

  const concLabel  = concurrence?.level  ?? 'Modérée'
  const concCpc    = concurrence?.cpc    ?? '1–2€'
  const concBudget = concurrence?.budget ?? '500–1500€/mois'

  const SIG = city ? `\n— Consultant Google Ads, ${city}` : '\n— Consultant Google Ads'

  const prompt = `Tu es un rédacteur expert en cold email B2B pour consultants Google Ads travaillant avec des commerces locaux.

RÈGLE ABSOLUE — ZÉRO NOM DE MARQUE : N'utilise aucun nom de marque, outil ou plateforme commerciale dans tes recommandations. Interdit : Planity, Reservio, Hootsuite, Buffer, Canva, Mailchimp, Brevo, HubSpot, Calendly, WordPress, Webflow, Shopify, Wix, Crisp, Tidio, Intercom, Semrush, Ahrefs, etc. Utilise uniquement des descriptions génériques : "outil de réservation en ligne", "plateforme de gestion des réseaux sociaux", "solution d'email marketing", "logiciel de chat en ligne", "outil de planification éditoriale".

MISSION : Rédiger un email de prospection pour "${name}"${city ? ` (${city})` : ''}

─── DONNÉES CHIFFRÉES ────────────────────────────────────────
• Avis Google         : ${reviews} avis | Note : ${rating}/5
• Avis sans réponse   : ${unanswered}
• Site web            : ${website ? `Présent (${website})` : 'ABSENT'}
• Performance mobile  : ${perf !== null ? `${perf}/100` : 'non disponible'}
• HTTPS               : ${hasHttps === true ? 'Sécurisé ✅' : hasHttps === false ? 'NON sécurisé ❌' : 'inconnu'}
• Temps chargement    : ${loadTime ?? 'non disponible'}
• Compatibilité Ads   : ${readinessLabel}${readinessScore !== null ? ` (${readinessScore}/100)` : ''}
• Concurrence secteur : ${concLabel} (CPC estimé ${concCpc})
• Budget recommandé   : ${concBudget}
──────────────────────────────────────────────────────────────

RÉDIGE un email de prospection orienté ROI et résultats chiffrés.

STRUCTURE :
[ACCROCHE] — 1 phrase percutante qui montre que tu connais leur secteur et leur situation Google Ads (mention de la concurrence et du CPC)
[PROBLÈME] — 1-2 phrases : ce qu'ils perdent chaque mois sans campagne Ads (clients captés par les concurrents)
[PREUVE] — 1 phrase avec les données concrètes (note ${rating}/5, ${reviews} avis = potentiel de conversion élevé${perf !== null ? `, site à ${perf}/100 perf mobile` : ''})
[SOLUTION] — 1-2 phrases : ce que tu proposes concrètement (audit gratuit, ROI cible, budget)
[CTA] — 1 phrase courte, appel à action

${EMAIL_STATS_NOTE}

CONTRAINTES :
- 150 à 220 mots maximum
- Pas de markdown, pas de ** ni ##
- Ton direct, chiffres, ROI — pas émotionnel
- Pas de "j'espère que ce message vous trouve bien"
- Introduis-toi comme : "je gère les campagnes publicitaires Google pour les commerces locaux"
- Ne mentionne aucun outil de gestion ads par son nom
- Retourne UNIQUEMENT un JSON : {"subject":"...","body":"..."}`

  const anthropic = new Anthropic({ apiKey })
  const message = await anthropic.messages.create({
    model:      'claude-sonnet-4-6',
    max_tokens: 600,
    messages:   [{ role: 'user', content: prompt }],
  })
  console.log(`[generateEmailGoogleAds] ✓ réponse (tokens: ${message.usage?.output_tokens ?? '?'})`)
  const raw = message.content[0].text
  const jsonMatch = raw.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('Réponse JSON invalide du modèle')
  try { return JSON.parse(jsonMatch[0]) }
  catch { return JSON.parse(jsonMatch[0].replace(/[\u0000-\u001F\u007F-\u009F]/g, ' ')) }
}

module.exports = { analyzeWithAI, generateEmailPhotographe, generateEmailSEO, generateEmailChatbot, generateEmailSocialMedia, generateEmailDesigner, generateEmailWebDev, generateAuditSEO, generateAuditPhotographe, generateAuditChatbot, generateAuditSocialMedia, generateAuditDesigner, generateAuditWebDev, generateAuditEmailMarketing, generateEmailEmailMarketing, generateAuditGoogleAds, generateEmailGoogleAds }
