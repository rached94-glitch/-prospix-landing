// LRU cache helper — max 30 entrées, évite la croissance illimitée en mémoire
function createLRUCache(maxSize = 30) {
  const cache = new Map()
  return {
    get(key) {
      if (!cache.has(key)) return undefined
      const value = cache.get(key)
      cache.delete(key)
      cache.set(key, value)
      return value
    },
    set(key, value) {
      if (cache.has(key)) {
        cache.delete(key)
      } else if (cache.size >= maxSize) {
        const firstKey = cache.keys().next().value
        cache.delete(firstKey)
      }
      cache.set(key, value)
    },
    has(key) { return cache.has(key) },
    clear()  { cache.clear() },
  }
}

// Module-level caches partagés : évite les appels Anthropic et PageSpeed répétés
const aiCache    = createLRUCache(30) // { [placeId::profileId]: analysisResult }
const auditCache = createLRUCache(30) // { [website]: auditData }

export { createLRUCache, aiCache, auditCache }
