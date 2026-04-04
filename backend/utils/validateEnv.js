/**
 * validateEnv.js — Vérification des variables d'environnement au démarrage
 *
 * Obligatoires : arrête le processus avec un message clair si absentes.
 * Optionnelles : affiche un warning jaune mais laisse le serveur démarrer.
 *
 * Appeler avant tout autre require dans server.js :
 *   require('./utils/validateEnv')()
 */

const REQUIRED = [
  'GOOGLE_MAPS_API_KEY',
  'ANTHROPIC_API_KEY',
]

const OPTIONAL = [
  { key: 'PAGESPEED_API_KEY', hint: 'PageSpeed et CrUX désactivés' },
  { key: 'GOOGLE_CSE_KEY',    hint: 'IndexedPages désactivé' },
  { key: 'GOOGLE_CSE_CX',     hint: 'IndexedPages désactivé' },
  { key: 'APIFY_API_TOKEN',   hint: 'Apify reviews/SEMrush/social désactivés' },
  { key: 'PAPPERS_API_KEY',   hint: 'données financières désactivées' },
  { key: 'HUNTER_API_KEY',    hint: 'recherche décisionnaire désactivée' },
]

// ANSI color codes
const YELLOW = '\x1b[33m'
const RED    = '\x1b[31m'
const RESET  = '\x1b[0m'

function validateEnv() {
  // ── Variables obligatoires ────────────────────────────────────────────────────
  const missing = REQUIRED.filter(key => !process.env[key])

  if (missing.length > 0) {
    for (const key of missing) {
      console.error(`${RED}[ENV] Variable obligatoire manquante : ${key}${RESET}`)
    }
    console.error(`${RED}[ENV] Arrêt du serveur — définissez ces variables dans .env${RESET}`)
    process.exit(1)
  }

  // ── Variables optionnelles ────────────────────────────────────────────────────
  for (const { key, hint } of OPTIONAL) {
    if (!process.env[key]) {
      console.warn(`${YELLOW}[WARNING] ${key} manquante — ${hint}${RESET}`)
    }
  }
}

module.exports = validateEnv
