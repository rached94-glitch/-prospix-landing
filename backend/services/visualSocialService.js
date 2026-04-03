const Anthropic = require('@anthropic-ai/sdk')
const axios     = require('axios')

const APIFY_TOKEN = process.env.APIFY_API_TOKEN
const APIFY_BASE  = 'https://api.apify.com/v2/acts'

// ─── Actor config per network ─────────────────────────────────────────────────
const NETWORK_CONFIG = {
  instagram: {
    actor:    'apify~instagram-scraper',
    input:    (url) => ({ directUrls: [url], resultsType: 'posts', resultsLimit: 3 }),
    imageUrl: (item) => item.imageUrl ?? item.displayUrl ?? null,
  },
  // Facebook uses a two-actor fallback — see fetchFacebookImages()
  facebook: null,
  tiktok: {
    actor:    'clockworks~free-tiktok-scraper',
    input:    (url) => ({ profiles: [url.split('?')[0]], resultsPerPage: 3 }),
    imageUrl: (item) => item.videoMeta?.coverUrl ?? item.covers?.[0] ?? item.thumbnail ?? null,
  },
  pinterest: {
    actor:    'tri_angle~pinterest-scraper',
    input:    (url) => ({ startUrls: [url.split('?')[0]], maxItems: 3 }),
    imageUrl: (item) => item.image ?? item.imgSrc ?? item.imageUrl ?? null,
  },
  youtube: {
    actor:    'streamers~youtube-scraper',
    input:    (url) => ({ startUrls: [{ url: url.split('?')[0] }], maxResults: 3 }),
    imageUrl: (item) => item.thumbnails?.[0]?.url ?? item.thumbnail?.url ?? item.thumbnail ?? item.bestThumbnail?.url ?? item.videoThumbnail ?? null,
  },
}

// ─── Prompts ──────────────────────────────────────────────────────────────────
const PROMPT_PHOTO = `Tu es un photographe professionnel expert en photographie commerciale pour PME locales.
Analyse ces photos de posts d'un commerce local.

CRITÈRES :
1. QUALITÉ TECHNIQUE : netteté, exposition, bruit numérique
2. COMPOSITION : cadrage, angles, sujet identifiable
3. ÉCLAIRAGE : naturel/studio maîtrisé ou flash direct non diffusé
4. COHÉRENCE : style unifié entre les posts ?
5. IMPACT COMMERCIAL : donne-t-il envie de contacter/réserver ?

SCORE /100 :
90-100 : posts professionnels cohérents
70-89  : bonne qualité, quelques imperfections
50-69  : acceptable mais amélioration possible
30-49  : amateur, incohérent
0-29   : très mauvaise qualité

Réponds UNIQUEMENT en JSON valide sans markdown :
{
  "score": number (0-100),
  "verdict": "Professionnel"|"Correct"|"Amateur"|"Mauvais",
  "observations": [{ "level": "red"|"orange"|"green", "text": string (max 120 chars) }],
  "photosAnalyzed": number
}
Maximum 3 observations orientées argument commercial concret. Jamais condescendant — constats factuels.`

const PROMPT_VIDEO = `Tu es un expert en branding vidéo pour PME locales.
Analyse ces miniatures de vidéos d'un commerce local.

CRITÈRES :
1. ACCROCHE : attire-t-elle le regard en 1 seconde ?
2. LISIBILITÉ : sujet/texte/visage clairement visible ?
3. QUALITÉ : image nette, bien exposée ?
4. COHÉRENCE : style unifié entre les miniatures ?
5. CONVERSION : donne-t-elle envie de cliquer ?

SCORE /100 :
90-100 : miniatures professionnelles cohérentes
70-89  : bonne qualité, quelques imperfections
50-69  : acceptable mais amélioration possible
30-49  : amateur, incohérent
0-29   : très mauvaise qualité

Réponds UNIQUEMENT en JSON valide sans markdown :
{
  "score": number (0-100),
  "verdict": "Professionnel"|"Correct"|"Amateur"|"Mauvais",
  "observations": [{ "level": "red"|"orange"|"green", "text": string (max 120 chars) }],
  "photosAnalyzed": number
}
Maximum 3 observations orientées argument commercial concret. Jamais condescendant — constats factuels.`

// ─── Helpers ──────────────────────────────────────────────────────────────────
async function runApify(actorId, input) {
  if (!APIFY_TOKEN) throw new Error('APIFY_API_TOKEN manquant')
  const url = `${APIFY_BASE}/${actorId}/run-sync-get-dataset-items?token=${APIFY_TOKEN}&timeout=30`
  const response = await axios.post(url, input, {
    timeout:  35_000,
    headers:  { 'Content-Type': 'application/json' },
  })
  // Guard: Apify may return HTML on auth errors or quota exceeded
  if (typeof response.data === 'string') {
    throw new Error(`Apify returned non-JSON response (status ${response.status})`)
  }
  return Array.isArray(response.data) ? response.data : []
}

// ─── Facebook two-actor fallback ──────────────────────────────────────────────
async function fetchFacebookImages(facebookUrl) {
  const cleanUrl = facebookUrl.split('?')[0]
  console.log('[VisualSocial] Facebook URL nettoyée:', cleanUrl)

  // Acteur 1 : facebook-posts-scraper → attachments[0].media.image.uri
  try {
    const items1 = await runApify('apify~facebook-posts-scraper', {
      startUrls:   [{ url: cleanUrl }],
      maxPosts:    3,
      resultsType: 'posts',
    })
    console.log('[VisualSocial] Facebook images trouvées:', JSON.stringify(items1?.slice(0, 3), null, 2))
    const urls1 = items1
      .slice(0, 3)
      .map(item => item.attachments?.[0]?.media?.image?.uri ?? item.full_picture ?? item.picture ?? null)
      .filter(Boolean)
    if (urls1.length > 0) {
      console.log('[VisualSocial] Facebook acteur 1 — images trouvées:', urls1.length)
      return urls1
    }
    console.log('[VisualSocial] Facebook acteur 1 — aucune image, tentative acteur 2')
  } catch (e) {
    console.warn('[VisualSocial] Facebook acteur 1 échoué:', e.message)
  }

  // Acteur 2 : facebook-scraper → photos[0].url
  try {
    const items2 = await runApify('apify~facebook-scraper', {
      startUrls: [{ url: cleanUrl }],
      maxPosts:  3,
    })
    console.log('[VisualSocial] Facebook acteur 2 images trouvées:', JSON.stringify(items2?.slice(0, 3), null, 2))
    const urls2 = items2
      .slice(0, 3)
      .map(item => item.photos?.[0]?.url ?? null)
      .filter(Boolean)
    if (urls2.length > 0) {
      console.log('[VisualSocial] Facebook acteur 2 — images trouvées:', urls2.length)
      return urls2
    }
    console.log('[VisualSocial] Facebook acteur 2 — aucune image non plus')
  } catch (e) {
    console.warn('[VisualSocial] Facebook acteur 2 échoué:', e.message)
  }

  return []
}

async function downloadImages(urls) {
  const images = []
  for (const url of urls) {
    if (!url) continue
    try {
      const response = await axios.get(url, { responseType: 'arraybuffer', timeout: 8000 })
      const base64      = Buffer.from(response.data).toString('base64')
      const contentType = response.headers['content-type'] || 'image/jpeg'
      images.push({ base64, contentType })
    } catch (err) {
      console.warn('[VisualSocial] Erreur téléchargement image:', err.message)
    }
  }
  return images
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function analyzeNetworkPhotos(networkUrl, network) {
  // Outer guard — always return JSON, never throw
  try {
    return await _analyzeNetworkPhotos(networkUrl, network)
  } catch (e) {
    console.error('[VisualSocial] Erreur non catchée:', e.message)
    return { error: e.message, score: null }
  }
}

async function _analyzeNetworkPhotos(networkUrl, network) {
  if (!networkUrl) return { error: 'no_url' }
  if (!APIFY_TOKEN) return { error: 'no_token' }

  const cfg = NETWORK_CONFIG[network]
  if (cfg === undefined) return { error: `Réseau inconnu : ${network}` }
  // cfg may be null for networks with custom fetch logic (e.g. facebook)

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return { error: 'ANTHROPIC_API_KEY manquante' }

  console.log(`[VisualSocial] Analyse ${network} — ${networkUrl}`)

  try {
    // Étape 1 — Récupérer URLs images (Facebook : fallback deux acteurs)
    let imageUrls
    if (network === 'facebook') {
      imageUrls = await fetchFacebookImages(networkUrl)
      if (imageUrls.length === 0) {
        return { error: 'Photos Facebook inaccessibles — compte protégé', protected: true }
      }
    } else {
      const items = await runApify(cfg.actor, cfg.input(networkUrl))
      if (network === 'pinterest') console.log('[VisualSocial] Pinterest items:', items?.length)
      if (network === 'youtube') { console.log('[VisualSocial] YouTube items:', items?.length); console.log('[VisualSocial] YouTube item keys:', Object.keys(items[0] || {})) }
      if (!items || items.length === 0) return { error: 'Aucun contenu trouvé sur ce profil' }
      imageUrls = items.slice(0, 3).map(cfg.imageUrl).filter(Boolean)
      if (imageUrls.length === 0) return { error: 'Aucune image accessible sur ce profil' }
    }

    // Étape 2 — Télécharger en base64
    const images = await downloadImages(imageUrls)
    if (images.length === 0) return { error: 'Impossible de télécharger les images' }

    console.log(`[VisualSocial] ${images.length} image(s) prêtes pour ${network}`)

    // Étape 4 — Analyser avec Claude Vision
    const isVideo = network === 'tiktok' || network === 'youtube'
    const prompt  = isVideo ? PROMPT_VIDEO : PROMPT_PHOTO

    const anthropic = new Anthropic({ apiKey })
    const content = [
      ...images.map(img => ({
        type:   'image',
        source: { type: 'base64', media_type: img.contentType, data: img.base64 },
      })),
      { type: 'text', text: prompt },
    ]

    const message = await anthropic.messages.create({
      model:      'claude-sonnet-4-6',
      max_tokens: 500,
      messages:   [{ role: 'user', content }],
    })

    const raw = message.content[0].text
    console.log(`[VisualSocial] Réponse ${network} (${raw.length} chars):`, raw.slice(0, 120))

    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('JSON introuvable dans la réponse')

    const parsed = JSON.parse(jsonMatch[0])
    const score        = Math.min(100, Math.max(0, Number(parsed.score) || 0))
    const verdict      = String(parsed.verdict ?? '—')
    const observations = Array.isArray(parsed.observations)
      ? parsed.observations.slice(0, 3).map(o => ({
          level: o.level ?? o.color ?? 'orange',
          text:  String(o.text ?? '').slice(0, 120),
        }))
      : []

    return { score, verdict, observations, photosAnalyzed: images.length }

  } catch (e) {
    console.warn(`[VisualSocial] Erreur ${network}:`, e.message)
    if (network === 'tiktok') return { error: 'tiktok_restricted' }
    const status = e.response?.status
    const msg    = e.message?.toLowerCase() ?? ''
    if (status === 404)                                                  return { error: 'Compte introuvable ou supprimé' }
    if (status === 403)                                                  return { error: 'Accès refusé par la plateforme' }
    if (status === 400 || msg.includes('not_available') || msg.includes('not available')) return { error: 'Compte privé ou inaccessible' }
    if (msg.includes('timeout') || msg.includes('etimedout') || msg.includes('econnaborted')) return { error: 'Délai dépassé — réessayer plus tard' }
    return { error: 'Analyse temporairement indisponible' }
  }
}

module.exports = { analyzeNetworkPhotos }
