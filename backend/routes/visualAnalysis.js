const express  = require('express')
const router   = express.Router()
const { captureScreenshot, analyzeVisual } = require('../services/visualAnalysisService')

const VALID_PROFILES = ['designer', 'photographe', 'copywriter']
const VALID_ZONES    = ['header', 'corps', 'full']
const ZONE_COST      = { header: 1, corps: 2, full: 3 }

// Mock credits — à remplacer par req.user.credits quand l'auth sera implémentée
let mockCredits = 847

router.post('/visual-analysis', async (req, res) => {
  const { url, zone = 'header', profile } = req.body

  if (!url) {
    return res.status(400).json({ error: 'URL manquante' })
  }
  if (!VALID_PROFILES.includes(profile)) {
    return res.status(400).json({ error: `Profil invalide. Valeurs : ${VALID_PROFILES.join(', ')}` })
  }
  if (!VALID_ZONES.includes(zone)) {
    return res.status(400).json({ error: `Zone invalide. Valeurs : ${VALID_ZONES.join(', ')}` })
  }

  const creditsUsed = ZONE_COST[zone]
  if (mockCredits < creditsUsed) {
    return res.status(402).json({ error: 'Crédits insuffisants', creditsRemaining: mockCredits })
  }

  console.log(`[VisualAnalysis] Demande — url:${url} zone:${zone} profile:${profile} (coût:${creditsUsed})`)

  try {
    const screenshot = await captureScreenshot(url, zone)

    if (!screenshot) {
      return res.status(422).json({ error: 'Ce site ne permet pas la capture automatique' })
    }

    const analysis = await analyzeVisual(screenshot, profile)

    mockCredits -= creditsUsed

    console.log(`[VisualAnalysis] OK — score:${analysis.score} verdict:${analysis.verdict} crédits restants:${mockCredits}`)

    res.json({
      ...analysis,
      creditsUsed,
      creditsRemaining: mockCredits,
    })
  } catch (e) {
    console.error('[VisualAnalysis] Erreur:', e.message)
    res.status(500).json({
      error: 'Analyse indisponible — réessayer',
      details: e.message,
    })
  }
})

module.exports = router
