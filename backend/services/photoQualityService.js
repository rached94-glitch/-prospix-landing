const Anthropic = require('@anthropic-ai/sdk')
const axios     = require('axios')

async function analyzePhotoQuality(photoUrls) {
  if (!photoUrls || photoUrls.length === 0) return null

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY manquante')

  // Télécharger les photos et les convertir en base64
  const images = []
  for (const url of photoUrls.slice(0, 3)) {
    try {
      const response = await axios.get(url, {
        responseType: 'arraybuffer',
        timeout: 8000,
      })
      const base64      = Buffer.from(response.data).toString('base64')
      const contentType = response.headers['content-type'] || 'image/jpeg'
      images.push({ base64, contentType, url })
    } catch (err) {
      console.error('[PhotoQuality] Erreur téléchargement photo:', err.message)
    }
  }

  if (images.length === 0) {
    return { verdict: 'Non analysable', score: null, observations: [], photosAnalyzed: 0 }
  }

  const anthropic = new Anthropic({ apiKey })

  const content = [
    ...images.map(img => ({
      type: 'image',
      source: {
        type:       'base64',
        media_type: img.contentType,
        data:       img.base64,
      },
    })),
    {
      type: 'text',
      text: `Tu es un photographe professionnel expert en photographie commerciale pour PME locales.
Analyse ces ${images.length} photo(s) Google de ce commerce.

CRITÈRES D'ÉVALUATION OBJECTIFS :

1. AUTHENTICITÉ (le plus important) :
   - Photo réelle du commerce vs image stock de marque
   - Photo de l'espace/équipe/prestation vs photo produit fournisseur
   - Présence humaine (cliente, praticienne) vs objet seul

2. QUALITÉ TECHNIQUE :
   - Netteté et mise au point
   - Exposition (sur/sous-exposée ?)
   - Stabilité (floue par bougé ?)
   - Bruit numérique (photo sombre granuleuse ?)

3. COMPOSITION :
   - Cadrage intentionnel vs snapshot
   - Grand-angle déformant (perspective distordue ?)
   - Horizon droit
   - Sujet clairement identifiable

4. ÉCLAIRAGE :
   - Lumière naturelle ou studio maîtrisée
   - Ombres dures non contrôlées
   - Dominante couleur (trop chaud/froid ?)
   - Flash direct non diffusé

5. PERTINENCE COMMERCIALE :
   - La photo représente-t-elle vraiment ce commerce ?
   - Donne-t-elle envie de visiter/acheter ?
   - Montre-t-elle l'ambiance réelle ?

VERDICTS POSSIBLES (choisir le plus précis) :
- "Professionnelles" : photos pro réelles du commerce, éclairage maîtrisé, composition intentionnelle
- "Correctes" : photos authentiques de qualité acceptable, smartphone soigné, sujet clair
- "Amateur" : photos authentiques mais qualité faible, mal cadrées, sombres ou floues
- "Stock / Marques" : images marketing de fournisseurs ou photos stock — ne représentent pas le commerce
- "Mixte" : mélange de qualités ou de types
- "Insuffisantes" : moins de 2 photos analysables

SCORE /100 :
90-100 : toutes les photos sont professionnelles et authentiques
70-89  : bonnes photos avec quelques imperfections
50-69  : qualité acceptable mais améliorable
30-49  : photos amateur ou partiellement non représentatives
0-29   : photos stock/marques ou très mauvaise qualité

OBSERVATIONS (max 3, triées du plus critique au moins) :
- Chaque observation = 1 argument commercial concret
- Commencer par ce qui nuit le plus à la conversion
- Être précis et factuel, jamais condescendant
- Max 120 caractères par observation

Réponds UNIQUEMENT en JSON valide sans markdown :
{
  "verdict": string,
  "score": number,
  "hasStockPhotos": boolean,
  "hasAuthenticPhotos": boolean,
  "observations": [
    { "level": "red"|"orange"|"green", "text": string }
  ]
}`,
    },
  ]

  const message = await anthropic.messages.create({
    model:      'claude-sonnet-4-6',
    max_tokens: 500,
    messages:   [{ role: 'user', content }],
  })

  const raw = message.content[0].text
  console.log('[PhotoQuality] Réponse IA:', raw)

  const jsonMatch = raw.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('JSON introuvable dans la réponse')

  const result = JSON.parse(jsonMatch[0])
  return { ...result, photosAnalyzed: images.length }
}

module.exports = { analyzePhotoQuality }
