const Anthropic = require('@anthropic-ai/sdk')

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
function buildPrompt(businessName, reviewsText, total, avgRating, unanswered, profileId, meta = {}, auditData = null, negativeCount = 0) {
  const { websiteUrl = null, city = null, rating = null, reviewCount = null, category = null } = meta

  console.log(`[aiReviewAnalysis] Profil actif: ${profileId}`)

  const ctx        = buildContextBlock(meta, auditData)
  const focusText  = buildFocusDirective(profileId, auditData, meta)
  const focusBlock = focusText ? `⚡ FOCUS PROFIL : ${focusText}\n\n` : ''

  const header = `Tu es un expert en réputation digitale et en marketing local. Analyse ces avis Google pour "${businessName}".

Analyse basée sur ${total} avis réels (sélection des plus représentatifs)
Moyenne : ${avgRating}/5 | Avis négatifs sans réponse : ${unanswered}

AVIS :
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
${reviewsText}

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
${reviewsText}

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

  const prompt = buildPrompt(businessName, reviewsText, total, avgRating, unanswered, profileId, meta, auditData, negativeCount)

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

  const siteSignals     = pagespeedData?.siteSignals     ?? null
  const chatbotDetected = siteSignals?.chatbotDetected   ?? false
  const bookingPlatform = siteSignals?.bookingPlatform   ?? null
  const hasFAQ          = siteSignals?.hasFAQ            ?? false
  const sensitiveData   = pagespeedData?.sensitiveData   ?? false

  const keywords    = reviewsData?.keywords ?? []
  const keywordsText = keywords.length > 0 ? keywords.slice(0, 5).join(', ') : '—'

  // ── P1 — accroche verrouillée : questions réelles si dispo, sinon par catégorie ─
  const catLow = category.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  const topKw = (keywords ?? []).slice(0, 3).filter(Boolean)
  let p1Hint
  if (topKw.length >= 2) {
    // Build from real recurring keywords extracted from reviews
    const kwList = topKw.length >= 3
      ? `${topKw[0]}, ${topKw[1]} et ${topKw[2]}`
      : `${topKw[0]} et ${topKw[1]}`
    p1Hint = `Chaque semaine, vos clients cherchent des réponses sur ${kwList} — et n'obtiennent pas toujours de réponse immédiate.`
  } else if (/restaurant|cafe|brasserie|pizz|burger/.test(catLow))
    p1Hint = `Chaque semaine, vos clients cherchent vos horaires, votre menu ou vos conditions de réservation — et ne trouvent pas de réponse immédiate.`
  else if (/avocat|notaire|comptable/.test(catLow))
    p1Hint = `Vos prospects cherchent vos honoraires et vos domaines d'intervention avant de vous appeler — la plupart ne rappellent pas s'ils n'obtiennent pas de réponse rapidement.`
  else if (/salon|spa|coiffure|beaute|barbier/.test(catLow))
    p1Hint = `Vos clientes veulent savoir vos disponibilités et vos tarifs sans avoir à téléphoner.`
  else if (/garage|auto|carrosserie/.test(catLow))
    p1Hint = `Vos clients veulent un devis rapide et savoir si vous traitez leur marque — avant même de se déplacer.`
  else
    p1Hint = `Vos clients posent les mêmes questions chaque semaine — et n'obtiennent pas toujours de réponse immédiate.`

  const tone = /avocat|notaire|comptable/.test(catLow) ? 'formel et professionnel' : 'direct et conversationnel'

  const sensitiveBlock = sensitiveData
    ? `\nBLOC SENSIBLE (insérer en fin de P3, obligatoire) :\n"Le système fonctionne sur votre propre serveur — aucune donnée client ne quitte votre cabinet."`
    : ''

  const bookingBlock = bookingPlatform
    ? `\nBLOC BOOKING (insérer après P4, si pertinent) :\n"${bookingPlatform} gère vos réservations. Ce système répond à tout le reste — tarifs, conditions, questions spécifiques — sans remplacer ce que vous avez déjà."`
    : ''

  const faqBlock = hasFAQ
    ? `\nBLOC FAQ (insérer en P4 si pertinent) :\n"Votre FAQ existe déjà — elle devient la base du système en quelques heures."`
    : ''

  const prompt = `Tu es un développeur IA spécialisé dans les assistants clients pour commerces locaux. Rédige un email de prospection pour ${name}.
Ton : ${tone} — jamais vendeur, jamais de liste à puces dans le corps.

DONNÉES TECHNIQUES VERROUILLÉES — UTILISER UNIQUEMENT CES CHIFFRES :
- Nom du commerce : ${name}
- Ville : ${city || '—'}
- Catégorie : ${category}
- Site web : ${website || 'absent'}
- Note Google : ${rating ?? '—'}/5
- Nombre d'avis : ${reviewCount ?? '—'}
- Mots-clés récurrents : ${keywordsText}

STRUCTURE OBLIGATOIRE EN 5 PARAGRAPHES :

OBJET : ${name} — une question sur vos échanges clients

SALUTATION : "Bonjour,"

P1 — ACCROCHE (reformuler naturellement en prose, sans déformer le sens) :
"${p1Hint}"

P2 — PREUVE PAR LES AVIS :
Citer 1-2 questions ou demandes réelles extraites des mots-clés. Lier à la perte concrète de clients potentiels.

P3 — CE QUE ÇA DONNE CONCRÈTEMENT :
Expliquer comment un assistant IA entraîné sur les données du commerce répond 24h/24 aux questions spécifiques sans jargon.${sensitiveBlock}

P4 — ARGUMENT DÉCISIF (reformuler en prose naturelle) :
"Cette automatisation existe — elle reste juste à connecter à votre activité."${faqBlock}${bookingBlock}

P5 — CTA (recopier exactement) :
"Une démonstration de 15 minutes sur votre commerce suffit pour voir ce que ça donne concrètement.

Développeur IA local — ${city || 'France'}"

RÈGLES ABSOLUES :
- Jamais de liste à puces dans le corps
- Jamais "Bonjour [nom]" — uniquement "Bonjour,"
- Jamais de placeholder entre crochets dans l'email livré
- INTERDIT : RAG, NLP, LLM, vecteur, embedding, modèle de langage — utiliser uniquement "système", "assistant IA" ou "automatisation"
- INTERDIT d'écrire un autre chiffre que ${reviewCount} pour le total d'avis Google
- Maximum 200 mots

Retourne UNIQUEMENT un JSON valide :
{"subject":"...","body":"Corps complet de l'email avec sauts de ligne \\n"}`

  console.log(`[generateEmailChatbot] ${name} | city:${city} | category:${category} | booking:${bookingPlatform ?? 'none'} | sensitive:${sensitiveData} | prompt:${prompt.length} chars`)

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
- Sois CONCIS. Chaque description fait maximum 2 phrases. Le JSON total doit faire moins de 3000 caractères.

IMPORTANT: Réponds UNIQUEMENT avec un objet JSON valide. Pas de texte avant, pas de texte après, pas de markdown, pas de \`\`\`json.

Retourne UNIQUEMENT un JSON valide, sans markdown, sans texte avant ou après :
{
  "resume_executif": "3-4 phrases courtes max",
  "forces": [{"titre": "max 10 mots", "description": "max 2 phrases"}],
  "faiblesses": [{"titre": "max 10 mots", "description": "max 2 phrases"}],
  "opportunites": [{"titre": "max 10 mots", "description": "max 2 phrases"}],
  "recommandations": [{"titre": "max 10 mots", "description": "max 2 phrases", "priorite": 1}],
  "accroche": "1 seule phrase"
}`

  console.log(`[generateAuditSEO] ${name} | city:${city} | seo:${seoScore ?? 'n/a'} | rank:${rankLabel} | prompt:${prompt.length} chars`)

  let message
  try {
    message = await anthropic.messages.create({
      model:      'claude-sonnet-4-6',
      max_tokens: 2500,
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
    return {
      resume_executif: 'Audit généré avec des données partielles — veuillez relancer.',
      forces: [], faiblesses: [], opportunites: [],
      recommandations: [{ titre: 'Optimiser la fiche Google Business Profile', description: 'Photos, description, horaires à jour.', priorite: 1 }],
      accroche: 'Votre présence digitale mérite une attention particulière.',
    }
  }

  return parsed
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
- Sois CONCIS. Le JSON total doit faire moins de 3000 caractères.

IMPORTANT: Réponds UNIQUEMENT avec un objet JSON valide. Pas de texte avant, pas de texte après, pas de markdown, pas de \`\`\`json.

Retourne UNIQUEMENT un JSON valide, sans markdown, sans texte avant ou après :
{
  "resume_executif": "3-4 phrases courtes max",
  "forces": [{"titre": "max 10 mots", "description": "max 2 phrases"}],
  "faiblesses": [{"titre": "max 10 mots", "description": "max 2 phrases"}],
  "opportunites": [{"titre": "max 10 mots", "description": "max 2 phrases"}],
  "recommandations": [{"titre": "max 10 mots", "description": "max 2 phrases", "priorite": 1}],
  "accroche": "1 seule phrase"
}`

  console.log(`[generateAuditPhotographe] ${name} | photos:${photos} | ig:${hasInstagram} | tt:${hasTiktok} | prompt:${prompt.length} chars`)

  let message
  try {
    message = await anthropic.messages.create({
      model:      'claude-sonnet-4-6',
      max_tokens: 2500,
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
    return {
      resume_executif: 'Audit généré avec des données partielles — veuillez relancer.',
      forces: [], faiblesses: [], opportunites: [],
      recommandations: [{ titre: 'Enrichir les photos de la fiche Google', description: 'Des photos professionnelles augmentent le taux de clic de 25% en moyenne.', priorite: 1 }],
      accroche: 'Vos photos sont votre première impression — soignons-la.',
    }
  }

  return parsed
}

module.exports = { analyzeWithAI, generateEmailPhotographe, generateEmailSEO, generateEmailChatbot, generateAuditSEO, generateAuditPhotographe }
