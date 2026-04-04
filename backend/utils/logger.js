// ── Terminal colors (ANSI) ────────────────────────────────────────────────────
const C = {
  reset:   '\x1b[0m',
  bold:    '\x1b[1m',
  dim:     '\x1b[2m',
  red:     '\x1b[31m',
  green:   '\x1b[32m',
  yellow:  '\x1b[33m',
  cyan:    '\x1b[36m',
  magenta: '\x1b[35m',
  gray:    '\x1b[90m',
}

function ts() {
  return new Date().toISOString().replace('T', ' ').slice(0, 23)
}

function prefix(level, color, service) {
  return `${C.gray}${ts()}${C.reset} ${color}${level}${C.reset} ${C.bold}[${service}]${C.reset}`
}

const logger = {
  // logger.info('Stream', 'Requête reçue')
  info(service, message) {
    console.log(`${prefix('[INFO] ', C.green, service)} ${message}`)
  },

  // logger.warn('PageSpeed', 'Double timeout')
  warn(service, message) {
    console.warn(`${prefix('[WARN] ', C.yellow, service)} ${message}`)
  },

  // logger.error('Stream', 'res.write error', err)
  error(service, message, err) {
    console.error(`${prefix('[ERROR]', C.red, service)} ${message}`)
    if (err?.stack) console.error(`${C.gray}${err.stack}${C.reset}`)
  },

  // logger.api('PageSpeed', 'https://...', 200, 320)
  api(service, url, status, durationMs) {
    const sc = status >= 400 ? C.red : status >= 300 ? C.yellow : C.green
    console.log(`${prefix('[API]  ', C.cyan, service)} ${url} ${sc}→ ${status}${C.reset} (${durationMs}ms)`)
  },

  // logger.cache('unlock', 'unlock_ChIJ_default', true)
  cache(namespace, key, hit) {
    const label = hit ? `${C.green}HIT${C.reset}` : `${C.yellow}MISS${C.reset}`
    console.log(`${prefix('[CACHE]', C.magenta, namespace)} ${key} → ${label}`)
  },
}

module.exports = logger
