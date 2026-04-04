// ── Social media cache — wraps createCache for backward-compat API ───────────
// External API: get(url) → result | null
//               set(url, result)
// Internally delegates to the persistent createCache('socialMedia').

const { createCache } = require('./searchCache')

const TTL_24H = 24 * 60 * 60 * 1000
const _cache  = createCache('socialMedia')

function get(url) {
  if (!url) return null
  return _cache.get(url)
}

function set(url, result) {
  if (!url) return
  _cache.set(url, result, TTL_24H)
}

module.exports = { get, set }
