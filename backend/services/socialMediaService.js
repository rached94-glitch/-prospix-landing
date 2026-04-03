const axios   = require('axios')
const smCache = require('../cache/socialMediaCache')

const APIFY_TOKEN = process.env.APIFY_API_TOKEN
const APIFY_BASE  = 'https://api.apify.com/v2/acts'

// ─── URL cleaners ─────────────────────────────────────────────────────────────
function cleanInstagramUrl(url) {
  if (!url) return null
  const base = url.split('?')[0]
  if (base.includes('/p/') || base.includes('/reel/')) return null
  return base
}

function cleanFacebookUrl(url) {
  if (!url) return null
  return url.split('?')[0]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function daysAgo(dateStr) {
  if (!dateStr) return null
  const d = new Date(dateStr)
  return isNaN(d) ? null : Math.round((Date.now() - d.getTime()) / 86_400_000)
}

function activityLabel(days) {
  if (days === null || days === undefined) return { status: 'unknown', label: '⚪ Non détecté' }
  if (days < 7)   return { status: 'very_active', label: '🟢 Très actif' }
  if (days < 30)  return { status: 'active',      label: '🟡 Actif' }
  if (days < 90)  return { status: 'low_active',  label: '🟠 Peu actif' }
  return               { status: 'inactive',      label: '🔴 Inactif' }
}

// POST run-sync-get-dataset-items — timeout 30s
async function runApify(actorId, input) {
  if (!APIFY_TOKEN) throw new Error('APIFY_API_TOKEN manquant')
  const url = `${APIFY_BASE}/${actorId}/run-sync-get-dataset-items?token=${APIFY_TOKEN}&timeout=30`
  const { data } = await axios.post(url, input, {
    timeout:  35_000,
    headers:  { 'Content-Type': 'application/json' },
  })
  return Array.isArray(data) ? data : []
}

// ─── Facebook ─────────────────────────────────────────────────────────────────
async function getFacebookActivity(facebookUrl) {
  if (!facebookUrl) return { status: 'unknown', label: '⚪ Non détecté', reason: 'no_url' }

  const cleanUrl = cleanFacebookUrl(facebookUrl)
  if (!cleanUrl) return { status: 'unknown', label: '⚪ Non détecté', reason: 'invalid_url' }

  const cached = smCache.get(cleanUrl)
  if (cached) {
    console.log('[SocialMedia] FB Cache HIT:', cleanUrl)
    return cached
  }
  console.log('[SocialMedia] FB Cache MISS — appel Apify:', cleanUrl)

  try {
    // ── 1. Infos de la page (followers, likes) ────────────────────────────────
    const pageItems = await runApify('apify~facebook-pages-scraper', {
      startUrls: [{ url: cleanUrl }],
      maxPosts:  1,
    })

    const page = pageItems[0]
    console.log('[Facebook Apify] résultat brut:', JSON.stringify(page, null, 2))
    console.log('[Facebook Apify] champs disponibles:', Object.keys(page || {}))

    if (!page) return { status: 'unknown', label: '⚪ Non détecté', reason: 'empty_response' }

    if (page.not_available || page.status === 'not_available') {
      return { status: 'unknown', label: '⚪ Non détecté', reason: 'not_available' }
    }

    const followers = page.followers ?? page.followersCount ?? page.fan_count ?? page.fanCount ?? page.pageFollowers ?? null
    const likes     = page.likes     ?? page.likesCount     ?? page.pagelike_count ?? null
    console.log('[Facebook Apify] followers:', followers, '| likes:', likes)

    // ── 2. Dernier post — acteur dédié ────────────────────────────────────────
    let lastPostDateRaw = null
    try {
      const postItems = await runApify('apify~facebook-posts-scraper', {
        startUrls:   [{ url: cleanUrl }],
        maxPosts:    1,
        resultsType: 'posts',
      })
      console.log('[Facebook Posts Apify] résultat brut:', JSON.stringify(postItems?.[0], null, 2))
      const firstPost   = postItems?.[0] ?? null
      lastPostDateRaw   = firstPost?.time ?? firstPost?.date ?? firstPost?.created_time ?? null
      console.log('[Facebook Posts Apify] date détectée:', lastPostDateRaw)
    } catch (postErr) {
      console.warn('[Facebook Posts Apify] échec (ignoré):', postErr.message)
    }

    const lastPostDate      = lastPostDateRaw ? new Date(lastPostDateRaw).toISOString().slice(0, 10) : null
    const days              = daysAgo(lastPostDateRaw)
    const { status, label } = activityLabel(days)

    const result = { status, label, lastPostDate, daysAgo: days, followers, likes }

    smCache.set(cleanUrl, result)
    console.log('[SocialMedia] FB résultat final:', JSON.stringify(result))
    return result
  } catch (e) {
    console.warn('[SocialMedia] Facebook Apify error:', e.message)
    const status400 = e.response?.status === 400
    const notAvail  = e.message?.toLowerCase().includes('not_available') || e.message?.toLowerCase().includes('not available')
    if (status400 || notAvail) {
      return { status: 'unknown', label: '⚪ Non détecté', reason: 'not_available' }
    }
    return { status: 'unknown', label: '⚪ Non détecté', reason: e.message }
  }
}

// ─── Instagram ────────────────────────────────────────────────────────────────
async function getInstagramActivity(instagramUrl) {
  if (!instagramUrl) return { status: 'unknown', label: '⚪ Non détecté', reason: 'no_url' }

  const cleanUrl = cleanInstagramUrl(instagramUrl)
  if (!cleanUrl) return { status: 'unknown', label: '⚪ Non détecté', reason: 'invalid_url' }

  const cached = smCache.get(cleanUrl)
  if (cached) {
    console.log('[SocialMedia] IG Cache HIT:', cleanUrl)
    return cached
  }
  console.log('[SocialMedia] IG Cache MISS — appel Apify:', cleanUrl)

  try {
    const items = await runApify('apify~instagram-scraper', {
      directUrls:   [cleanUrl],
      resultsType:  'posts',
      resultsLimit: 1,
    })

    const post = items[0]
    console.log('[Instagram Apify] résultat brut:', JSON.stringify(items?.[0], null, 2))
    if (!post) return { status: 'unknown', label: '⚪ Non détecté', reason: 'empty_response' }

    const rawDate      = post.timestamp ?? post.date ?? null
    const lastPostDate = rawDate ? new Date(rawDate).toISOString().slice(0, 10) : null
    const days         = daysAgo(rawDate)
    const { status, label } = activityLabel(days)

    const result = {
      status,
      label,
      lastPostDate,
      daysAgo:   days,
      followers: post.ownerFollowersCount ?? null,
      posts:     null,  // posts count not available from single-post scrape
    }

    smCache.set(cleanUrl, result)
    console.log('[SocialMedia] IG résultat:', JSON.stringify(result))
    return result
  } catch (e) {
    console.warn('[SocialMedia] Instagram Apify error:', e.message)
    const status400 = e.response?.status === 400
    const notAvail  = e.message?.toLowerCase().includes('not_available') || e.message?.toLowerCase().includes('not available')
    if (status400 || notAvail) {
      return { status: 'unknown', label: '⚪ Non détecté', reason: 'not_available' }
    }
    return { status: 'unknown', label: '⚪ Non détecté', reason: e.message }
  }
}

// ─── Instagram Deep Analysis ──────────────────────────────────────────────────
async function getInstagramPosts(instagramUrl) {
  if (!instagramUrl) return { error: 'no_url' }

  const cleanUrl = cleanInstagramUrl(instagramUrl)
  if (!cleanUrl) return { error: 'invalid_url' }

  if (!APIFY_TOKEN)  return { error: 'no_token' }

  console.log('[SocialMedia] IG Deep — appel Apify 12 posts:', cleanUrl)

  try {
    const items = await runApify('apify~instagram-scraper', {
      directUrls:   [cleanUrl],
      resultsType:  'posts',
      resultsLimit: 12,
    })

    if (!Array.isArray(items) || items.length === 0) {
      return { error: 'private_or_missing' }
    }

    const postCount = items.length

    // Likes & comments averages
    const totalLikes    = items.reduce((s, p) => s + (p.likesCount    ?? p.likes    ?? 0), 0)
    const totalComments = items.reduce((s, p) => s + (p.commentsCount ?? p.comments ?? 0), 0)
    const avgLikes    = Math.round(totalLikes    / postCount)
    const avgComments = Math.round(totalComments / postCount)

    // Last post date
    const rawDate     = items[0]?.timestamp ?? items[0]?.date ?? null
    const lastPostDate = rawDate ? new Date(rawDate).toISOString().slice(0, 10) : null

    // Posts per month (from oldest to newest in the batch)
    let postsPerMonth = null
    const oldest = items[items.length - 1]
    const oldestRaw = oldest?.timestamp ?? oldest?.date ?? null
    if (rawDate && oldestRaw) {
      const newestMs = new Date(rawDate).getTime()
      const oldestMs = new Date(oldestRaw).getTime()
      const diffMonths = (newestMs - oldestMs) / (1000 * 60 * 60 * 24 * 30)
      postsPerMonth = diffMonths > 0.5 ? Math.round(postCount / diffMonths) : postCount
    }

    // Top hashtags
    const hashtagMap = {}
    items.forEach(p => {
      const tags = p.hashtags ?? []
      tags.forEach(tag => {
        const t = tag.replace(/^#/, '').toLowerCase()
        hashtagMap[t] = (hashtagMap[t] ?? 0) + 1
      })
    })
    const topHashtags = Object.entries(hashtagMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([tag]) => `#${tag}`)

    const result = { postCount, avgLikes, avgComments, postsPerMonth, lastPostDate, topHashtags }
    console.log('[SocialMedia] IG Deep résultat:', JSON.stringify(result))
    return result
  } catch (e) {
    console.warn('[SocialMedia] IG Deep error:', e.message)
    const status400 = e.response?.status === 400
    const notAvail  = e.message?.toLowerCase().includes('not_available') || e.message?.toLowerCase().includes('not available')
    const isPrivate = e.message?.toLowerCase().includes('private') || e.message?.toLowerCase().includes('not found')
    if (status400 || notAvail || isPrivate) {
      return { error: 'private_or_missing' }
    }
    return { error: e.message }
  }
}

module.exports = { getFacebookActivity, getInstagramActivity, getInstagramPosts }
