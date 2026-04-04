// ── PageSpeed cache — wraps createCache for backward-compat API ───────────────
// External API: get(url) → { domain, result } | null
//               set(url, result)
//               clear()
// Internally delegates to the persistent createCache('pagespeed').

const { createCache } = require('./searchCache')

const TTL_7D = 7 * 24 * 60 * 60 * 1000
const _cache = createCache('pagespeed')

function extractDomain(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url  // for keys like "https://site.fr__desktop" — use raw string
  }
}

function get(url) {
  const domain = extractDomain(url)
  const value  = _cache.get(domain)
  if (value !== null) return { domain, result: value }
  return null
}

function set(url, result) {
  const domain = extractDomain(url)
  _cache.set(domain, result, TTL_7D)
}

function clear() {
  _cache.clear()
}

module.exports = { get, set, clear }
