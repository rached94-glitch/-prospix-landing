const puppeteer      = require('puppeteer-extra')
const StealthPlugin  = require('puppeteer-extra-plugin-stealth')
puppeteer.use(StealthPlugin())
const Anthropic  = require('@anthropic-ai/sdk')

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// ── Screenshot cache 30 min ────────────────────────────────────────────────────
const SCREENSHOT_TTL = 30 * 60 * 1000
const ssCache = new Map()

// ── Zone configs ───────────────────────────────────────────────────────────────
const ZONE_CONFIG = {
  header: { viewportW: 1280, viewportH: 800,  clipH: 600,  fullPage: false },
  corps:  { viewportW: 1280, viewportH: 1400, clipH: 1200, fullPage: false },
  full:   { viewportW: 1280, viewportH: 900,  clipH: null, fullPage: true  },
}

// ── Prompts par profil ─────────────────────────────────────────────────────────
const PROMPTS = {
  designer: `Tu es un designer senior. Analyse ce header de site web professionnel.
Évalue uniquement : cohérence visuelle, palette de couleurs, typographie, modernité du design, hiérarchie visuelle.
Réponds UNIQUEMENT en JSON valide sans markdown :
{
  "score": number (0-100),
  "epoch": string (ex: "2008-2013"),
  "verdict": string (1 mot : Moderne / Soigné / Passable / Vieillot / Non professionnel),
  "observations": [
    { "level": "red"|"orange"|"green", "text": string (max 80 chars, ton direct pro) }
  ]
}
Maximum 3 observations. Sois direct et professionnel.`,

  photographe: `Tu es un directeur artistique senior avec 15 ans d'expérience.
Tu analyses des sites de PME locales pour identifier si elles ont besoin d'un photographe professionnel.
Sois brutal et honnête — pas de compliments inutiles.

Analyse ce header selon ces 5 critères psychologiques :

1. CONFIANCE : Est-ce que les visuels inspirent confiance ou font fuir ?
2. AUTHENTICITÉ : Photos réelles du business ou images stock génériques ?
3. ÉMOTION : Les visuels créent-ils une émotion ou sont-ils neutres/froids ?
4. COHÉRENCE : Les visuels racontent-ils une histoire ou se contredisent-ils ?
5. CONVERSION : Les visuels donnent-ils envie d'acheter/réserver/contacter ?

Réponds UNIQUEMENT en JSON valide sans markdown :
{
  "score": number (0-100, sois sévère — un vrai site pro mérite 70+),
  "epoch": string (ex: "2015-2018", estime l'âge du style photographique),
  "verdict": string — choisir parmi UNIQUEMENT :
    "Professionnel"  → photos pro réelles, cohérentes, émotionnelles
    "Correct"        → photos réelles mais qualité moyenne
    "Générique"      → images stock détectées, pas authentique
    "Illustratif"    → illustrations/vectoriel, zéro photo réelle
    "Faible"         → visuels présents mais contre-productifs
    "Sans visuels"   → aucun visuel réel, fond uni ou texte seul,
  "observations": [
    { "level": "red"|"orange"|"green", "text": string }
  ]
}

6. AUTHENTICITÉ DES VISUELS :
   - Les photos visibles sont-elles réelles du commerce ou des images stock/marques fournisseurs ?
   - Y a-t-il des photos de l'espace, de l'équipe, des prestations réelles ?
   - Les visuels correspondent-ils à ce que les clients décriraient en visitant ce lieu ?

Inclure dans les observations :
- Si photos stock détectées → observation rouge
- Si aucune photo de l'espace réel → observation rouge
- Si photos authentiques mais amateur → observation orange
- Si bon équilibre authenticité/qualité → observation verte

Règles pour les observations :
- Maximum 3 observations
- Ton direct, professionnel, sans condescendance
- Chaque observation doit être un argument concret qu'un photographe peut utiliser pour vendre sa prestation
- red   → problème qui coûte des clients aujourd'hui
- orange → opportunité manquée mais pas critique
- green  → seul point positif s'il existe, sinon ne pas forcer
- Maximum 120 caractères par observation — phrase complète obligatoire, jamais coupée
- Si une observation dépasse 120 caractères, reformuler en gardant le sens complet
- Jamais de "Absent" comme verdict`,

  copywriter: `Tu es un expert en conversion web. Analyse ce header de site web.
Évalue uniquement : clarté du message principal, visibilité des CTA, accroche en 3 secondes, structure narrative visible.
Réponds UNIQUEMENT en JSON valide sans markdown :
{
  "score": number (0-100),
  "epoch": string (ex: "2016-2019"),
  "verdict": string (1 mot : Percutant / Clair / Flou / Confus / Invisible),
  "observations": [
    { "level": "red"|"orange"|"green", "text": string (max 80 chars, ton direct pro) }
  ]
}
Maximum 3 observations.`,
}

// ── captureScreenshot ──────────────────────────────────────────────────────────
async function captureScreenshot(url, zone = 'header') {
  const cacheKey = `${url}::${zone}`
  const hit = ssCache.get(cacheKey)
  if (hit && (Date.now() - hit.ts) < SCREENSHOT_TTL) {
    console.log(`[VisualAnalysis] Cache screenshot HIT — ${url} zone:${zone}`)
    return hit.data
  }

  const cfg = ZONE_CONFIG[zone] ?? ZONE_CONFIG.header
  console.log(`[VisualAnalysis] Capture ${zone} de ${url}`)

  // ── Helper interne : tente une capture avec waitUntil donné ──────────────
  const tryCapture = async (waitUntil) => {
    let browser
    try {
      const execPath = process.platform === 'win32'
        ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
        : undefined
      browser = await puppeteer.launch({
        headless: true,
        executablePath: execPath,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
      })
      const page = await browser.newPage()
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36')
      await page.setViewport({ width: cfg.viewportW, height: cfg.viewportH })
      await page.goto(url, { waitUntil, timeout: 20000 })

      const screenshot = cfg.fullPage
        ? await page.screenshot({ fullPage: true, type: 'png', encoding: 'base64' })
        : await page.screenshot({ clip: { x: 0, y: 0, width: cfg.viewportW, height: cfg.clipH }, type: 'png', encoding: 'base64' })

      return screenshot
    } finally {
      if (browser) await browser.close()
    }
  }

  // ── Tentative 1 : domcontentloaded ────────────────────────────────────────
  try {
    const screenshot = await tryCapture('domcontentloaded')
    ssCache.set(cacheKey, { data: screenshot, ts: Date.now() })
    console.log(`[VisualAnalysis] Screenshot OK (tentative 1) — ${url} zone:${zone}`)
    return screenshot
  } catch (e1) {
    console.warn(`[VisualAnalysis] Tentative 1 échouée pour ${url}:`, e1.message)
  }

  // ── Tentative 2 : load ────────────────────────────────────────────────────
  try {
    const screenshot = await tryCapture('load')
    ssCache.set(cacheKey, { data: screenshot, ts: Date.now() })
    console.log(`[VisualAnalysis] Screenshot OK (tentative 2) — ${url} zone:${zone}`)
    return screenshot
  } catch (e2) {
    console.warn(`[VisualAnalysis] Tentative 2 échouée pour ${url}:`, e2.message)
  }

  // ── Les 2 tentatives ont échoué → null propre ─────────────────────────────
  console.warn(`[VisualAnalysis] Capture impossible après 2 tentatives pour ${url}`)
  return null
}

// ── analyzeVisual ──────────────────────────────────────────────────────────────
async function analyzeVisual(screenshotBase64, profile) {
  const prompt = PROMPTS[profile]
  if (!prompt) throw new Error(`Profil inconnu : ${profile}`)

  console.log(`[VisualAnalysis] Appel Claude Vision — profil:${profile}`)

  const response = await anthropic.messages.create({
    model:      'claude-sonnet-4-6',
    max_tokens: 600,
    messages: [{
      role: 'user',
      content: [
        {
          type: 'image',
          source: { type: 'base64', media_type: 'image/png', data: screenshotBase64 },
        },
        { type: 'text', text: prompt },
      ],
    }],
  })

  const raw = response.content?.[0]?.text ?? ''
  console.log(`[VisualAnalysis] Réponse brute (${raw.length} chars):`, raw.slice(0, 120))

  try {
    // Extraire le JSON même si Claude ajoute du texte autour
    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('Pas de JSON dans la réponse')
    const parsed = JSON.parse(jsonMatch[0])

    // Normalisation défensive
    const score        = Math.min(100, Math.max(0, Number(parsed.score) || 0))
    const epoch        = String(parsed.epoch ?? '—')
    const verdict      = String(parsed.verdict ?? '—')
    const observations = Array.isArray(parsed.observations)
      ? parsed.observations
          .slice(0, 3)
          .map(o => ({ level: o.level ?? 'orange', text: String(o.text ?? '').slice(0, 120) }))
          .sort((a, b) => { const order = { red: 0, orange: 1, green: 2 }; return (order[a.level] ?? 1) - (order[b.level] ?? 1) })
      : []

    return { score, epoch, verdict, observations }
  } catch (e) {
    console.warn('[VisualAnalysis] Échec parse JSON:', e.message, '| raw:', raw.slice(0, 200))
    throw new Error('Analyse indisponible — réessayer')
  }
}

module.exports = { captureScreenshot, analyzeVisual }
