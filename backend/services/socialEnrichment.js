const axios   = require('axios');
const cheerio = require('cheerio');
const { createCache } = require('../cache/searchCache');

const TIMEOUT_MS   = 3000;
const socialCache  = createCache('social');  // 48h

function cleanName(name) {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

async function fetchWebsiteHTML(url) {
  const response = await axios.get(url, {
    timeout: TIMEOUT_MS,
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; LeadGenBot/1.0)' },
    maxRedirects: 3,
  });
  return response.data || '';
}

const CHATBOT_SIGNATURES = {
  intercom:  'intercom',
  tidio:     'tidio',
  crisp:     'crisp.chat',
  zendesk:   'zendesk',
  hubspot:   'hubspot',
  drift:     'drift',
  freshchat: 'freshchat',
  tawk:      'tawk.to',
  livechat:  'livechat',
  manychat:  'manychat',
  chatbot:   'chatbot',
};

async function detectChatbotAndCompetitors(website) {
  if (!website) return null;
  try {
    const res  = await axios.get(website, {
      timeout: 5000,
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });
    const html     = res.data.toLowerCase();
    const detected = Object.entries(CHATBOT_SIGNATURES)
      .filter(([, sig]) => html.includes(sig))
      .map(([name]) => name);

    return {
      hasChatbot:        detected.length > 0,
      chatbotsDetected:  detected,
      opportunity: detected.length === 0
        ? '✅ Aucun chatbot — opportunité directe'
        : `⚠️ Utilise déjà : ${detected.join(', ')}`,
    };
  } catch (e) {
    return { hasChatbot: false, chatbotsDetected: [], error: true };
  }
}

// Mots-clés qui signalent un lien de partage ou d'action, pas un profil
const SHARE_BLACKLIST = ['share', 'sharer', 'intent', 'dialog', 'login', 'signup']

function isShareLink(href) {
  const lower = href.toLowerCase()
  return SHARE_BLACKLIST.some(kw => lower.includes(kw))
}

function validateSocialHref(network, href) {
  const lower = href.toLowerCase()
  const valid = (() => {
    if (isShareLink(lower)) return false
    if (network === 'instagram') {
      return /instagram\.com\/.+/.test(lower)
        && !lower.includes('instagram.com/p/')
        && !lower.includes('instagram.com/reel/')
    }
    if (network === 'facebook') {
      return /facebook\.com\/.+/.test(lower)
        && !lower.includes('facebook.com/sharer')
        && !lower.includes('facebook.com/share')
        && !lower.includes('facebook.com/dialog')
    }
    return true
  })()
  console.log('[Social]', network, href, '→', valid ? 'OK' : 'ignoré')
  return valid
}

// Patterns de détection par réseau — [réseau]: { href, script, meta }
const SOCIAL_PATTERNS = {
  instagram: {
    href:   [/instagram\.com\//, /instagr\.am\//],
    script: /instagram\.com\/([a-zA-Z0-9_.]+)/,
    meta:   /instagram\.com\/([a-zA-Z0-9_.]+)/,
    build:  (handle) => `https://www.instagram.com/${handle}`,
    // Segments à ignorer car ce ne sont pas des profils
    ignore: ['p', 'reel', 'stories', 'explore', 'accounts', 'tv'],
  },
  facebook: {
    href:   [/facebook\.com\//],
    script: /facebook\.com\/([a-zA-Z0-9_./-]+)/,
    meta:   /facebook\.com\/([a-zA-Z0-9_./-]+)/,
    build:  (handle) => `https://www.facebook.com/${handle}`,
    ignore: ['sharer', 'share', 'dialog', 'login', 'signup', 'tr', 'plugins'],
  },
  linkedin: {
    href:   [/linkedin\.com\/company\//],
    script: /linkedin\.com\/company\/([a-zA-Z0-9_-]+)/,
    meta:   /linkedin\.com\/company\/([a-zA-Z0-9_-]+)/,
    build:  (handle) => `https://www.linkedin.com/company/${handle}`,
    ignore: [],
  },
  tiktok: {
    href:   [/tiktok\.com\/@?/],
    script: /tiktok\.com\/@?([a-zA-Z0-9_.]+)/,
    meta:   /tiktok\.com\/@?([a-zA-Z0-9_.]+)/,
    build:  (handle) => `https://www.tiktok.com/@${handle}`,
    ignore: [],
  },
  youtube: {
    href:   [/youtube\.com\/(channel|c|@|user)\//],
    script: /youtube\.com\/(channel|c|@|user)\/([a-zA-Z0-9_-]+)/,
    meta:   /youtube\.com\/(channel|c|@|user)\/([a-zA-Z0-9_-]+)/,
    build:  (type, handle) => `https://www.youtube.com/${type}/${handle}`,
    ignore: [],
    multiGroup: true,  // script/meta match a 2-group pattern
  },
}

function extractHandleFromUrl(url, pattern) {
  const m = url.match(pattern)
  return m ? m[1] : null
}

function detectFAQ($, html) {
  // Check links text or href
  let hasFAQ = false
  $('a').each((_, el) => {
    const href = ($(el).attr('href') || '').toLowerCase()
    const text = ($(el).text() || '').toLowerCase()
    if (href.includes('faq') || text.includes('faq') ||
        text.includes('foire aux questions') || text.includes('questions fréquentes') ||
        href.includes('questions-frequentes')) {
      hasFAQ = true
    }
  })
  if (!hasFAQ && $('[id*="faq"],[class*="faq"]').length > 0) hasFAQ = true
  if (!hasFAQ && ($('details').length >= 3)) hasFAQ = true  // accordion FAQ pattern
  if (!hasFAQ && (html.toLowerCase().includes('"faqpage"') || html.toLowerCase().includes('application/ld+json'))) {
    hasFAQ = html.toLowerCase().includes('faqpage')
  }
  return hasFAQ
}

function detectContactForm($) {
  let hasContactForm = false
  $('form').each((_, form) => {
    const $form    = $(form)
    const hasEmail = $form.find('input[type="email"]').length > 0 ||
      $form.find('input[name*="email"],input[name*="mail"]').length > 0
    const hasTextarea = $form.find('textarea').length > 0
    const hasSubmit   = $form.find('input[type="submit"],button[type="submit"],button').length > 0
    if ((hasEmail || hasTextarea) && hasSubmit) hasContactForm = true
  })
  if (!hasContactForm) {
    if ($('[id*="contact-form"],[class*="contact-form"],[class*="wpcf7"],[id*="wpcf7"]').length > 0)
      hasContactForm = true
  }
  return hasContactForm
}

function extractSocialLinks(html) {
  const social = {
    linkedin:  null,
    facebook:  null,
    instagram: null,
    tiktok:    null,
    pinterest: null,
    youtube:   null,
    hasChatbot: false,
  };

  const $ = cheerio.load(html)

  for (const [network, cfg] of Object.entries(SOCIAL_PATTERNS)) {
    if (social[network]) continue  // déjà trouvé

    // ── 1. Liens href ────────────────────────────────────────────────────────
    $('a[href]').each((_, el) => {
      if (social[network]) return
      const href = $(el).attr('href') || ''
      const lower = href.toLowerCase()
      const matches = cfg.href.some(re => re.test(lower))
      if (!matches) return
      const full = href.startsWith('http') ? href : `https://${href}`
      if (!validateSocialHref(network, full)) return
      console.log(`[Social] ${network} href →`, full)
      social[network] = full
    })

    if (social[network]) continue

    // ── 2. Scripts inline ────────────────────────────────────────────────────
    $('script').each((_, el) => {
      if (social[network]) return
      const content = $(el).html() || ''
      const m = content.match(cfg.script)
      if (!m) return
      let candidate
      if (cfg.multiGroup) {
        candidate = cfg.build(m[1], m[2])
      } else {
        const handle = m[1]
        if (cfg.ignore.includes(handle)) return
        candidate = cfg.build(handle)
      }
      if (!validateSocialHref(network, candidate)) return
      console.log(`[Social] ${network} script →`, candidate)
      social[network] = candidate
    })

    if (social[network]) continue

    // ── 3. Meta tags (content) ───────────────────────────────────────────────
    $('meta').each((_, el) => {
      if (social[network]) return
      const content = $(el).attr('content') || ''
      const m = content.match(cfg.meta)
      if (!m) return
      let candidate
      if (cfg.multiGroup) {
        candidate = cfg.build(m[1], m[2])
      } else {
        const handle = m[1]
        if (cfg.ignore.includes(handle)) return
        candidate = cfg.build(handle)
      }
      if (!validateSocialHref(network, candidate)) return
      console.log(`[Social] ${network} meta →`, candidate)
      social[network] = candidate
    })

    if (!social[network]) {
      console.log(`[Social] ${network} → non trouvé`)
    }
  }

  // Pinterest — regex simple (pas de profil standard)
  const pinterestMatch = html.match(/https?:\/\/(www\.)?pinterest\.[a-z]{2,3}\/[^\s"'<>]+/i);
  if (pinterestMatch && validateSocialHref('pinterest', pinterestMatch[0])) {
    console.log('[Social] pinterest href →', pinterestMatch[0])
    social.pinterest = pinterestMatch[0]
  }

  const detected = Object.entries(CHATBOT_SIGNATURES)
    .filter(([, sig]) => html.toLowerCase().includes(sig))
    .map(([name]) => name);
  social.hasChatbot         = detected.length > 0;
  social.chatbotsDetected   = detected;

  social.faqDetection         = { hasFAQ: detectFAQ($, html) }
  social.contactFormDetection = { hasContactForm: detectContactForm($) }

  return social;
}

async function enrichSocial({ name, website, placeId }) {
  if (placeId) {
    const cached = socialCache.get(`social_${placeId}`)
    if (cached) return cached
  }

  const result = {
    linkedin:             null,
    facebook:             null,
    instagram:            null,
    tiktok:               null,
    pinterest:            null,
    youtube:              null,
    hasChatbot:           false,
    chatbotsDetected:     [],
    chatbotDetection:     null,
    faqDetection:         null,
    contactFormDetection: null,
  };

  if (website) {
    try {
      const html  = await fetchWebsiteHTML(website);
      const found = extractSocialLinks(html);
      Object.assign(result, found);
      result.faqDetection         = found.faqDetection         || { hasFAQ: false }
      result.contactFormDetection = found.contactFormDetection || { hasContactForm: false }
      result.chatbotDetection = {
        hasChatbot:           found.hasChatbot,
        chatbotsDetected:     found.chatbotsDetected || [],
        opportunity: found.hasChatbot
          ? `⚠️ Utilise déjà : ${(found.chatbotsDetected || []).join(', ')}`
          : '✅ Aucun chatbot — opportunité directe',
        faqDetection:         result.faqDetection,
        contactFormDetection: result.contactFormDetection,
      };
    } catch (err) {
      console.error(`Error fetching website ${website}:`, err.message);
    }
  }

  if (!result.facebook && name) {
    const slug = cleanName(name);
    result.facebook = `https://facebook.com/${slug}`;
  }

  if (placeId) {
    socialCache.set(`social_${placeId}`, result, 48 * 60 * 60 * 1000)
  }

  return result;
}

module.exports = { enrichSocial, detectChatbotAndCompetitors };
