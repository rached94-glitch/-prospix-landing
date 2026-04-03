const https = require('https')
const fs    = require('fs')
const path  = require('path')

const BASE_URL  = 'https://api.pappers.fr/v2'
const CACHE_TTL = 60 * 60 * 1000 // 1 heure en mémoire

// ─── Cache persistant (fichier JSON) ──────────────────────────────────────────
const CACHE_DIR  = path.join(__dirname, '..', 'cache')
const CACHE_FILE = path.join(CACHE_DIR, 'pappers-cache.json')

// Charge le cache depuis le fichier au démarrage
if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true })

let persistedCache = {}
try {
  persistedCache = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'))
  console.log(`[Pappers] Cache chargé : ${Object.keys(persistedCache).length} entrées`)
} catch {
  persistedCache = {}
}

// Map mémoire pour les accès rapides intra-session
const cache = new Map(Object.entries(persistedCache))

let flushTimer = null
function schedulePersist() {
  // Dé-bounce : écrit sur disque max 1x par seconde
  if (flushTimer) return
  flushTimer = setTimeout(() => {
    flushTimer = null
    try {
      fs.writeFileSync(CACHE_FILE, JSON.stringify(Object.fromEntries(cache), null, 2))
    } catch (e) {
      console.warn('[Pappers] Impossible d\'écrire le cache :', e.message)
    }
  }, 1000)
}

function getCached(key) {
  const entry = cache.get(key)
  if (!entry) return undefined
  // Les entrées null (= non trouvé) sont permanentes — pas d'expiration
  if (entry.expiresAt && Date.now() > entry.expiresAt) {
    cache.delete(key)
    schedulePersist()
    return undefined
  }
  return entry.data
}

function setCached(key, data) {
  // null = entreprise non trouvée → pas de TTL (permanent jusqu'au prochain démarrage)
  const entry = data === null
    ? { data: null }
    : { data, expiresAt: Date.now() + CACHE_TTL }
  cache.set(key, entry)
  schedulePersist()
}

// ─── HTTP helper ──────────────────────────────────────────────────────────────
function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let body = ''
      res.on('data', c => body += c)
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(body) }) }
        catch { reject(new Error('Invalid JSON from Pappers')) }
      })
    }).on('error', reject)
  })
}

// ─── Nettoyage du nom commercial ──────────────────────────────────────────────

// Formes juridiques à supprimer partout dans le nom
const LEGAL_RE = /\b(SARL|SAS|SASU|EURL|SCI|SA\b|SNC|SELARL|SELAS|SEL|GIE|SCOP|SCIC|EI|EIRL|SCP|SC|SNCS?)\b\.?/gi

// Mots-préfixe à enlever en tête
const PREFIX_WORDS = new Set([
  'cabinet', 'cabinets', 'maître', 'maitre', 'maîtres', 'maitres', 'me',
  'dr', 'docteur', 'prof', 'professeur', 'notaire', 'notaires',
  'avocat', 'avocats', 'société', 'societe', 'groupe', 'group',
  'agence', 'agency', 'atelier', 'studio', 'office', 'offices',
  'etude', 'étude', 'clinique', 'pharmacie',
])

// Mots-suffixe à enlever en queue
const SUFFIX_WORDS = new Set([
  'avocat', 'avocats', 'avocate', 'avocates', 'notaire', 'notaires',
  'associés', 'associes', 'associé', 'associe', 'associates',
  'conseil', 'conseils', 'consulting', 'consultants', 'consultant',
  'expert', 'experts', 'comptable', 'comptables',
  'immobilier', 'immobilière', 'immobiliere',
  'médical', 'medical', 'juridique', 'et', '&', 'partenaires',
])

/**
 * Nettoie un nom commercial avant envoi à Pappers.
 * Supprime : formes juridiques, nom de ville, numéros de rue.
 */
function cleanName(raw, city = '') {
  let name = raw.trim()

  // Numéros de rue en tête  (ex: "12 rue de …  Coiffeur" → on enlève le numéro seul)
  name = name.replace(/^\d+[\s,.-]+/, '')

  // Formes juridiques
  name = name.replace(LEGAL_RE, ' ')

  // Nom de la ville s'il apparaît dans le nom commercial
  if (city) {
    const safe = city.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    name = name.replace(new RegExp(`\\b${safe}\\b`, 'gi'), ' ')
  }

  // Ponctuation en bord + espaces multiples
  name = name.replace(/\s+/g, ' ').replace(/^[\s,.\-–]+|[\s,.\-–]+$/g, '').trim()

  return name || raw.trim()
}

/**
 * Supprime les mots-préfixe et mots-suffixe connus du nom nettoyé.
 */
function stripPrefixSuffix(name) {
  const words = name.trim().split(/\s+/)
  let s = 0
  let e = words.length - 1
  while (s <= e && PREFIX_WORDS.has(words[s].toLowerCase().replace(/[.,]/g, ''))) s++
  while (e >= s && SUFFIX_WORDS.has(words[e].toLowerCase().replace(/[.,]/g, ''))) e--
  return words.slice(s, e + 1).join(' ') || name
}

/**
 * Construit la liste ordonnée de requêtes full-text à essayer en cascade.
 * La ville est intégrée dans le terme q (pas un paramètre séparé)
 * car /v2/recherche fait du full-text sur l'ensemble du champ.
 *
 * Stratégie :
 *   Étape 1 — nom nettoyé + ville         (full-text)
 *   Étape 2 — nom nettoyé                 (sans ville)
 *   Étape 3 — 2 premiers mots + ville
 *   Étape 4 — 2 premiers mots             (sans ville)
 *   Étape 5 — nom sans préfixe/sfx + ville
 *   Étape 6 — nom sans préfixe/sfx        (sans ville)
 *   Étape 7 — dernier mot seul            (nom de famille)
 */
function buildCandidates(rawName, city) {
  const candidates = []
  const seen       = new Set()

  const add = (q) => {
    const t = q.trim()
    if (t.length < 2 || seen.has(t.toLowerCase())) return
    seen.add(t.toLowerCase())
    candidates.push(t)
  }

  const cleaned  = cleanName(rawName, city)
  const words    = cleaned.split(/\s+/)
  const cityPart = city.trim()

  // Étapes 1–2 : nom nettoyé complet ± ville
  add(cityPart ? `${cleaned} ${cityPart}` : cleaned)
  add(cleaned)

  // Étapes 3–4 : 2 premiers mots ± ville
  if (words.length > 2) {
    const two = words.slice(0, 2).join(' ')
    if (cityPart) add(`${two} ${cityPart}`)
    add(two)
  }

  // Étapes 5–6 : strip préfixe/suffixe ± ville
  const stripped  = stripPrefixSuffix(cleaned)
  const strWords  = stripped.split(/\s+/)
  if (stripped !== cleaned) {
    if (cityPart) add(`${stripped} ${cityPart}`)
    add(stripped)
    // 2 premiers mots du stripped
    if (strWords.length > 2) add(strWords.slice(0, 2).join(' '))
  }

  // Étape 7 : dernier mot seul (nom de famille probable)
  const refWords = stripped !== cleaned ? strWords : words
  if (refWords.length > 1) add(refWords[refWords.length - 1])

  return candidates
}

// ─── Filtrage par ville ───────────────────────────────────────────────────────

/**
 * Normalise une ville pour comparaison insensible à la casse et aux accents.
 * "Strasbourg" → "STRASBOURG", "Saint-Étienne" → "SAINT-ETIENNE"
 */
function normalizeCity(str) {
  return str
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .trim()
}

/**
 * Extrait la ville depuis une adresse Google Maps.
 * "12 Rue de la Paix, 67000 Strasbourg, France" → "Strasbourg"
 * "Cabinet Dupont, Paris 8e Arrondissement"      → "Paris"
 */
function extractCity(address) {
  if (!address) return ''
  // Essai 1 : dernier fragment avant "France" ou en bout de chaîne
  const parts = address.split(',').map(p => p.trim()).filter(Boolean)
  // Retire "France" si présent en dernier
  if (/^france$/i.test(parts[parts.length - 1])) parts.pop()
  // Le fragment avant-dernier contient souvent "code_postal Ville" ou "Ville"
  for (let i = parts.length - 1; i >= 0; i--) {
    // Enlève les codes postaux et numéros → reste le nom de ville
    const candidate = parts[i].replace(/^\d{4,5}\s+/, '').replace(/\s+\d+[eèème]*\s*arrondissement.*/i, '').trim()
    if (candidate.length >= 2 && !/^\d+$/.test(candidate)) return candidate
  }
  return ''
}

/**
 * Retourne true si la ville du siège Pappers correspond à la ville attendue.
 * Accepte les correspondances partielles (ex : "Paris" ↔ "PARIS 8").
 */
function cityMatches(company, expectedCity) {
  if (!expectedCity) return true  // pas de filtre si ville inconnue

  const expected  = normalizeCity(expectedCity)
  const siegeVille = normalizeCity(company?.siege?.ville ?? company?.ville ?? '')

  if (!siegeVille) {
    console.log(`[Pappers]   ↳ Pas de siege.ville dans le résultat`)
    return false
  }

  const match = siegeVille.includes(expected) || expected.includes(siegeVille)
  console.log(`[Pappers]   ↳ Ville Pappers: "${siegeVille}" vs attendu: "${expected}" → ${match ? '✅ match' : '❌ no match'}`)
  return match
}

// ─── Requête Pappers ──────────────────────────────────────────────────────────

/**
 * Full-text search via /v2/recherche?bases=entreprises
 * Récupère jusqu'à 5 résultats, filtre par ville du siège, retourne le premier
 * qui correspond — ou null si aucune correspondance de ville.
 */
async function queryByText(q, apiKey, filterCity = '') {
  const url = `${BASE_URL}/recherche?api_token=${apiKey}&q=${encodeURIComponent(q)}&bases=entreprises&par_page=5`

  console.log(`\n[Pappers] ► URL : ${url.replace(apiKey, '***')}`)

  const { status, data } = await fetchJson(url)

  console.log(`[Pappers] ◄ HTTP ${status}`)
  console.log(`[Pappers] ◄ Réponse brute : ${JSON.stringify(data, null, 2)}`)

  // /v2/recherche retourne { resultats: [...] } ou { resultats_entreprises: [...] }
  const results = data.resultats ?? data.resultats_entreprises ?? []
  console.log(`[Pappers] ◄ resultats.length = ${results.length}`)

  if (!results.length) return null

  // Déplie chaque entrée (format direct ou wrappé { entreprise: {} })
  const companies = results.map(e => e?.entreprise ?? e).filter(Boolean)

  console.log(`[Pappers] ◄ Filtrage par ville : "${filterCity || '(aucun)'}"`)
  for (const c of companies) {
    console.log(`[Pappers]   Candidat : "${c.nom_entreprise ?? c.nom}" — siege.ville: "${c?.siege?.ville ?? '?'}"`)
    if (cityMatches(c, filterCity)) {
      console.log(`[Pappers] ✅ Sélectionné : ${JSON.stringify(c, null, 2)}`)
      return c
    }
  }

  console.log(`[Pappers] ❌ Aucun résultat ne correspond à la ville "${filterCity}"`)
  return null
}

async function queryBySiret(siret, apiKey) {
  const url              = `${BASE_URL}/entreprise?api_token=${apiKey}&siret=${siret}`
  const { status, data } = await fetchJson(url)
  console.log(`[Pappers] SIRET lookup HTTP ${status}`)
  // L'endpoint /entreprise retourne directement l'objet, pas un tableau
  return data?.siren ? data : null
}

async function fetchDetails(siren, siret, apiKey) {
  if (!siren && !siret) return { finances: null, dirigeants: null }
  try {
    const id               = siret || siren
    const param            = siret ? 'siret' : 'siren'
    const url              = `${BASE_URL}/entreprise?api_token=${apiKey}&${param}=${id}&extrait_financier=true&dirigeants=true`
    const { status, data } = await fetchJson(url)
    console.log(`[Pappers] Détails HTTP ${status} — finances: ${data.finances?.length ?? 0}, dirigeants: ${data.dirigeants?.length ?? 0}`)
    return { finances: data.finances || null, dirigeants: data.dirigeants || null }
  } catch (e) {
    console.warn('[Pappers] Détails indisponibles:', e.message)
    return { finances: null, dirigeants: null }
  }
}

function computeCaEvolution(finances) {
  if (!finances || finances.length < 2) return null
  const out = []
  for (let i = 0; i < Math.min(finances.length - 1, 3); i++) {
    const cur  = finances[i]?.chiffre_affaires
    const prev = finances[i + 1]?.chiffre_affaires
    if (cur != null && prev != null && prev !== 0) {
      out.push({ annee: finances[i].annee, evolution: Math.round(((cur - prev) / prev) * 100) })
    }
  }
  return out.length ? out : null
}

async function buildResult(company, apiKey) {
  const siret = company.siret || company.siege?.siret
  const siren = company.siren

  const { finances, dirigeants } = await fetchDetails(siren, siret, apiKey)

  const latestFinance = finances?.[0] ?? null
  const dirigeant     = dirigeants?.[0] ?? null
  const dateCreation  = company.date_creation ?? null

  return {
    nom:             company.nom_entreprise || company.nom || null,
    siret:           siret || null,
    siren:           siren || null,
    formeJuridique:  company.forme_juridique || null,
    dateCreation,
    anciennete:      dateCreation
      ? new Date().getFullYear() - new Date(dateCreation).getFullYear()
      : null,
    dirigeant: dirigeant
      ? `${(dirigeant.prenom || '').trim()} ${(dirigeant.nom || '').trim()}`.trim() || null
      : null,
    chiffreAffaires: latestFinance?.chiffre_affaires ?? null,
    resultatNet:     latestFinance?.resultat_net      ?? null,
    effectifs:       latestFinance?.effectif ?? company.tranche_effectif ?? null,
    anneeFinances:   latestFinance?.annee    ?? null,
    caEvolution:     computeCaEvolution(finances),
  }
}

// ─── Point d'entrée ───────────────────────────────────────────────────────────

/**
 * Recherche les données financières d'une entreprise sur Pappers.fr.
 *
 * Cascade :
 *   1. nom nettoyé + ville
 *   2. nom nettoyé (sans ville)
 *   3. 2 premiers mots + ville
 *   4. 2 premiers mots (sans ville)
 *   5. nom sans préfixe/suffixe + ville
 *   6. nom sans préfixe/suffixe
 *   7. dernier mot seul (nom de famille)
 *   8. SIRET direct (si fourni par l'appelant, ex : extrait de Google Maps)
 *
 * @param {string}  businessName  Nom affiché sur Google Maps
 * @param {string}  [city='']     Ville du siège
 * @param {string}  [siret='']    SIRET si déjà connu (optionnel)
 */
async function searchPappers(businessName, city = '', siret = '') {
  const apiKey = process.env.PAPPERS_API_KEY
  if (!apiKey) return null

  const cacheKey = `${businessName.toLowerCase().trim()}|${city.toLowerCase().trim()}`
  const cached   = getCached(cacheKey)
  if (cached !== undefined) return cached

  try {
    // Étape 0 (prioritaire) : SIRET direct si fourni
    if (siret && /^\d{14}$/.test(siret.replace(/\s/g, ''))) {
      console.log(`[Pappers] SIRET direct : ${siret}`)
      const raw = await queryBySiret(siret.replace(/\s/g, ''), apiKey)
      if (raw) {
        const result = await buildResult(raw, apiKey)
        setCached(cacheKey, result)
        return result
      }
    }

    // Ville extraite depuis l'adresse Google Maps (ex: "Strasbourg" depuis "12 Rue …, Strasbourg")
    const filterCity = extractCity(city) || city

    // Étapes 1–7 : cascade full-text (/v2/recherche)
    const candidates = buildCandidates(businessName, city)

    for (const q of candidates) {
      console.log(`[Pappers] Full-text : "${q}" (filtre ville: "${filterCity}")`)
      const company = await queryByText(q, apiKey, filterCity)
      if (company) {
        const result = await buildResult(company, apiKey)
        setCached(cacheKey, result)
        return result
      }
    }

    setCached(cacheKey, null)
    return null
  } catch (e) {
    console.error('[Pappers] Erreur:', e.message)
    setCached(cacheKey, null)
    return null
  }
}

module.exports = { searchPappers }
