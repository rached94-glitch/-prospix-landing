/**
 * validateInputs.js — Validation des paramètres d'entrée des routes
 *
 * Toutes les fonctions retournent { valid: boolean, errors: string[] }
 * ou un boolean (validatePlaceId).
 */

/**
 * Valide les paramètres de recherche (POST /api/leads/search/stream)
 *
 * @param {object} params
 * @param {*}      params.lat       - Latitude, obligatoire, -90..90
 * @param {*}      params.lng       - Longitude, obligatoire, -180..180
 * @param {*}      params.radius    - Rayon en km, optionnel, 0.1..50
 * @param {*}      params.keywords  - Array ou string, chaque élément max 200 chars
 * @param {*}      params.domain    - String max 100 chars
 * @param {*}      params.profileId - String max 50 chars
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validateSearchParams({ lat, lng, radius, keywords, domain, profileId }) {
  const errors = []

  // ── lat ───────────────────────────────────────────────────────────────────────
  if (lat === undefined || lat === null || lat === '') {
    errors.push('lat est obligatoire')
  } else {
    const latNum = Number(lat)
    if (isNaN(latNum) || latNum < -90 || latNum > 90) {
      errors.push('lat doit être un nombre entre -90 et 90')
    }
  }

  // ── lng ───────────────────────────────────────────────────────────────────────
  if (lng === undefined || lng === null || lng === '') {
    errors.push('lng est obligatoire')
  } else {
    const lngNum = Number(lng)
    if (isNaN(lngNum) || lngNum < -180 || lngNum > 180) {
      errors.push('lng doit être un nombre entre -180 et 180')
    }
  }

  // ── radius ────────────────────────────────────────────────────────────────────
  if (radius !== undefined && radius !== null && radius !== '') {
    const radiusNum = Number(radius)
    if (isNaN(radiusNum) || radiusNum < 0.1 || radiusNum > 50) {
      errors.push('radius doit être un nombre entre 0.1 et 50 (km)')
    }
  }

  // ── keywords ──────────────────────────────────────────────────────────────────
  if (keywords !== undefined && keywords !== null) {
    const kwList = Array.isArray(keywords) ? keywords : [keywords]
    for (const kw of kwList) {
      if (typeof kw !== 'string') {
        errors.push('keywords doit être un tableau de chaînes')
        break
      }
      if (kw.length > 200) {
        errors.push(`keyword "${kw.slice(0, 20)}…" dépasse 200 caractères`)
        break
      }
    }
  }

  // ── domain ────────────────────────────────────────────────────────────────────
  if (domain !== undefined && domain !== null && domain !== '') {
    if (typeof domain !== 'string') {
      errors.push('domain doit être une chaîne de caractères')
    } else if (domain.length > 100) {
      errors.push('domain dépasse 100 caractères')
    }
  }

  // ── profileId ─────────────────────────────────────────────────────────────────
  if (profileId !== undefined && profileId !== null && profileId !== '') {
    if (typeof profileId !== 'string') {
      errors.push('profileId doit être une chaîne de caractères')
    } else if (profileId.length > 50) {
      errors.push('profileId dépasse 50 caractères')
    }
  }

  return { valid: errors.length === 0, errors }
}

/**
 * Valide un placeId Google Maps.
 * Un placeId valide est un string non-vide commençant par "ChIJ".
 *
 * @param {*} placeId
 * @returns {boolean}
 */
function validatePlaceId(placeId) {
  return typeof placeId === 'string'
    && placeId.length > 10
    && !/[\s<>"'`]/.test(placeId)
}

module.exports = { validateSearchParams, validatePlaceId }
