// ── Persistent TTL cache — all named instances share a single JSON file ─────────
// On startup  : reads backend/cache/apiCache.json, restores non-expired entries
// On set/del  : schedules a debounced write (5 s) to avoid hammering the disk
// On shutdown : flushes synchronously before exit (SIGTERM + SIGINT)
//
// Usage (unchanged from previous API):
//   const { createCache } = require('../cache/searchCache')
//   const myCache = createCache('myName')
//   myCache.set('key', value, 7 * 24 * 60 * 60 * 1000)  // 7d TTL
//   const v = myCache.get('key')                          // null on miss/expiry

const fs   = require('fs')
const path = require('path')

const CACHE_FILE = path.join(__dirname, 'apiCache.json')
const registry   = new Map()   // name → instance — used by getAllStats()

// ── Load from disk once at module init ────────────────────────────────────────
let diskData = {}
try {
  if (fs.existsSync(CACHE_FILE)) {
    diskData = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'))
    const ns = Object.keys(diskData).length
    const total = Object.values(diskData).reduce((s, v) => s + Object.keys(v).length, 0)
    console.log(`[Cache] Restauré depuis disque: ${ns} namespace(s), ~${total} entrée(s)`)
  }
} catch (e) {
  console.warn('[Cache] Impossible de charger apiCache.json:', e.message)
  diskData = {}
}

// ── Debounced disk write ──────────────────────────────────────────────────────
let writeTimer = null

function scheduleSave() {
  if (writeTimer) return
  writeTimer = setTimeout(flushToDisk, 5000)
}

function flushToDisk() {
  writeTimer = null
  try {
    const snapshot = {}
    for (const [name, inst] of registry) {
      snapshot[name] = inst._raw()
    }
    fs.writeFileSync(CACHE_FILE, JSON.stringify(snapshot), 'utf8')
  } catch (e) {
    console.warn('[Cache] Erreur écriture apiCache.json:', e.message)
  }
}

// ── Graceful shutdown — flush synchronously before exit ──────────────────────
let shutdownRegistered = false
function registerShutdownHandlers() {
  if (shutdownRegistered) return
  shutdownRegistered = true

  function onShutdown(sig) {
    console.log(`[Cache] Signal ${sig} — sauvegarde du cache sur disque…`)
    if (writeTimer) { clearTimeout(writeTimer); writeTimer = null }
    flushToDisk()
    process.exit(0)
  }
  process.on('SIGTERM', () => onShutdown('SIGTERM'))
  process.on('SIGINT',  () => onShutdown('SIGINT'))
}
registerShutdownHandlers()

// ── Cache factory ─────────────────────────────────────────────────────────────
function createCache(name) {
  const store = new Map()
  let hits = 0, misses = 0, sets = 0

  // Restore non-expired entries from disk
  if (diskData[name]) {
    let restored = 0
    for (const [k, v] of Object.entries(diskData[name])) {
      if (v && Date.now() < v.expiresAt) {
        store.set(k, v)
        restored++
      }
    }
    if (restored > 0) {
      console.log(`[Cache] "${name}" → ${restored} entrée(s) restaurée(s) depuis disque`)
    }
  }

  function _valid(entry) {
    return entry && Date.now() < entry.expiresAt
  }

  function get(key) {
    const entry = store.get(key)
    if (_valid(entry)) {
      hits++
      console.log(`[Cache] HIT  ${name}:${key}`)
      return entry.value
    }
    if (entry) store.delete(key)   // purge stale entry
    misses++
    console.log(`[Cache] MISS ${name}:${key}`)
    return null
  }

  function set(key, value, ttlMs) {
    store.set(key, { value, expiresAt: Date.now() + ttlMs })
    sets++
    scheduleSave()
  }

  function has(key) {
    const entry = store.get(key)
    if (!_valid(entry)) {
      if (entry) store.delete(key)
      return false
    }
    return true
  }

  function del(key) {
    store.delete(key)
    scheduleSave()
  }

  function clear() {
    store.clear()
    hits = 0; misses = 0; sets = 0
    scheduleSave()
  }

  function stats() {
    // Purge expired before counting
    for (const [k, v] of store) {
      if (!_valid(v)) store.delete(k)
    }
    const total = hits + misses
    return {
      name,
      entries:  store.size,
      hits,
      misses,
      sets,
      hitRate:  total > 0 ? Math.round((hits / total) * 100) : 0,
    }
  }

  // Internal: returns only valid entries as a plain object for serialization
  function _raw() {
    const out = {}
    for (const [k, v] of store) {
      if (_valid(v)) out[k] = v
    }
    return out
  }

  const instance = { get, set, has, delete: del, clear, stats, _raw }
  registry.set(name, instance)
  return instance
}

// Returns stats for every registered cache — used by GET /api/cache/stats
function getAllStats() {
  return [...registry.values()].map(c => c.stats())
}

module.exports = { createCache, getAllStats }
