const axios = require('axios')

const FORBIDDEN_WORDS = [
  'else', 'if', 'var', 'const', 'let', 'function', 'return', 'class',
  'null', 'undefined', 'true', 'false', 'div', 'span', 'script',
  'style', 'body', 'html', 'new', 'this', 'for', 'while', 'switch',
]

function isValidName(name) {
  if (!name) return false
  const trimmed = name.trim()
  if (trimmed.length < 5 || trimmed.length > 40) return false
  const words = trimmed.split(' ')
  if (words.length < 2 || words.length > 3) return false
  if (words.some(w => FORBIDDEN_WORDS.includes(w.toLowerCase()))) return false
  if (!words.every(w => /^[A-ZÀ-Ü][a-zà-ü]{1,}$/.test(w))) return false
  return true
}

async function findEmailWithHunter(domain, firstName, lastName) {
  try {
    // Si nom connu → cherche l'email précis du décideur
    if (firstName && lastName) {
      const finder = await axios.get('https://api.hunter.io/v2/email-finder', {
        params: { domain, first_name: firstName, last_name: lastName, api_key: process.env.HUNTER_API_KEY },
        timeout: 6000,
      })
      const found = finder.data.data
      if (found.email) {
        return {
          source:  'hunter_finder',
          email:   found.email,
          confidence: found.score,
          verified: found.verification?.status === 'valid',
        }
      }
    }

    // Sinon → cherche tous les emails connus du domaine
    const search = await axios.get('https://api.hunter.io/v2/domain-search', {
      params: { domain, api_key: process.env.HUNTER_API_KEY },
      timeout: 6000,
    })
    const data = search.data.data
    if (data.emails?.length > 0) {
      return {
        source:  'hunter_domain',
        pattern: data.pattern || null,
        emails:  data.emails.slice(0, 3).map(e => ({
          email:      e.value,
          name:       `${e.first_name || ''} ${e.last_name || ''}`.trim() || null,
          title:      e.position || null,
          confidence: e.confidence,
          verified:   e.verification?.status === 'valid',
        })),
      }
    }

    return null
  } catch (e) {
    console.error('Hunter error:', e.message)
    return null
  }
}

async function findDecisionMaker(businessName, city, website) {
  const results = {
    name:       null,
    title:      null,
    linkedin:   null,
    email:      null,
    source:     null,
  }

  // SOURCE 1 — Recherche Google pour trouver le dirigeant
  try {
    const query      = encodeURIComponent(
      `"${businessName}" "${city}" dirigeant OR gérant OR directeur OR owner site:linkedin.com`
    )
    const googleUrl  = `https://www.google.com/search?q=${query}`

    const res = await axios.get(googleUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      timeout: 5000,
    })

    const linkedinMatch = res.data.match(/linkedin\.com\/in\/([a-zA-Z0-9-]+)/)
    if (linkedinMatch) {
      results.linkedin = `https://linkedin.com/in/${linkedinMatch[1]}`
      results.source   = 'google'
    }

    const nameMatch = res.data.match(
      /([A-Z][a-zà-ü]+ [A-Z][a-zà-ü]+(?:\s[A-Z][a-zà-ü]+)?).*?(gérant|directeur|owner|founder|PDG|CEO)/i
    )
    if (nameMatch && isValidName(nameMatch[1])) {
      results.name   = nameMatch[1]
      results.title  = nameMatch[2]
      results.source = 'google'
    }
  } catch (e) {
    console.log('Google search failed:', e.message)
  }

  // SOURCE 2 — Scrape le site web du commerce
  if (website && !results.name) {
    try {
      const res  = await axios.get(website, {
        timeout: 4000,
        headers: { 'User-Agent': 'Mozilla/5.0' },
      })
      const html = res.data

      const patterns = [
        /(?:fondateur|gérant|directeur|owner|founder)[^\w]*([A-Z][a-z]+ [A-Z][a-z]+)/i,
        /([A-Z][a-z]+ [A-Z][a-z]+)[^\w]*(?:fondateur|gérant|directeur)/i,
        /<title>([^<]+)<\/title>/i,
      ]

      for (const pattern of patterns) {
        const match = html.match(pattern)
        if (match && match[1] && isValidName(match[1])) {
          results.name   = match[1].trim()
          results.source = 'website'
          break
        }
      }

      const emailMatch = html.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/)
      if (emailMatch && !emailMatch[0].includes('example')) {
        results.email = emailMatch[0]
      }

      const liMatch = html.match(/linkedin\.com\/(?:in|company)\/([a-zA-Z0-9-]+)/)
      if (liMatch) {
        results.linkedin = `https://linkedin.com/${liMatch[0]}`
      }
    } catch (e) {
      console.log('Website scrape failed:', e.message)
    }
  }

  // SOURCE 3 — Hunter.io (si clé configurée) + fallback emails probables
  if (website) {
    try {
      const domain = new URL(website).hostname.replace('www.', '')

      if (process.env.HUNTER_API_KEY) {
        const nameParts = results.name
          ? results.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').split(' ')
          : []
        const [firstName, lastName] = nameParts.length >= 2 ? nameParts : [null, null]
        const hunterData = await findEmailWithHunter(domain, firstName, lastName)
        if (hunterData) results.hunterData = hunterData
      }

      // Fallback emails probables (toujours généré)
      const generic = [`contact@${domain}`, `info@${domain}`, `bonjour@${domain}`, `hello@${domain}`]
      if (results.name) {
        const nameParts = results.name
          .toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').split(' ')
        results.emailGuess = nameParts.length >= 2
          ? [`${nameParts[0]}@${domain}`, `${nameParts[0]}.${nameParts[1]}@${domain}`, ...generic]
          : generic
      } else {
        results.emailGuess = generic
      }
    } catch (e) { /* URL invalide */ }
  }

  return Object.values(results).some(v => v) ? results : null
}

module.exports = { findDecisionMaker }
