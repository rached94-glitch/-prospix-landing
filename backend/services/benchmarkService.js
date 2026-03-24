// backend/services/benchmarkService.js
const cache = new Map()  // Map<"domain:city" → number[]>

function addScore(domain, city, score) {
  if (!domain || !city) return
  const key = `${domain}:${city}`
  if (!cache.has(key)) cache.set(key, [])
  cache.get(key).push(score)
  // Tech debt : cache non borné — ajouter un cap à 200 scores/clé si besoin
}

function getPercentile(domain, city, score) {
  if (!domain || !city) return null
  const key = `${domain}:${city}`
  const scores = cache.get(key) ?? []
  if (scores.length < 5) return null
  const below = scores.filter(s => s < score).length
  return Math.round((below / scores.length) * 100)
}

module.exports = { addScore, getPercentile }
