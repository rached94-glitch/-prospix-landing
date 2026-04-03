import { useState, useRef, useEffect } from 'react'
import {
  UtensilsCrossed, ShoppingBag, Heart, Home, Sparkles,
  Cpu, Scale, TrendingUp, BookOpen, Dumbbell, Loader, Zap,
} from 'lucide-react'

const IC = { size: 13, strokeWidth: 1.75, style: { flexShrink: 0 } }

function IconLinkedIn({ size = 13 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/>
      <rect x="2" y="9" width="4" height="12"/><circle cx="4" cy="4" r="2"/>
    </svg>
  )
}
function IconFacebook({ size = 13 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/>
    </svg>
  )
}
function IconInstagram({ size = 13 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
      <circle cx="12" cy="12" r="4"/>
      <circle cx="17.5" cy="6.5" r="0.5" fill="currentColor" stroke="none"/>
    </svg>
  )
}
function IconTikTok({ size = 13 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.18 8.18 0 0 0 4.78 1.52V6.76a4.85 4.85 0 0 1-1.01-.07z"/>
    </svg>
  )
}
function IconGoogleMaps({ size = 13 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
      <circle cx="12" cy="10" r="3"/>
    </svg>
  )
}

const MOCK_CREDITS     = 847
const MOCK_CREDITS_MAX = 1000
const LS_SEARCHES_KEY  = 'leadgen_saved_searches'

const DOMAINS = [
  { label: 'Tous',       value: '',           icon: null },
  { label: 'Restaurant', value: 'restaurant', icon: <UtensilsCrossed {...IC} /> },
  { label: 'Commerce',   value: 'commerce',   icon: <ShoppingBag {...IC} /> },
  { label: 'Santé',      value: 'sante',      icon: <Heart {...IC} /> },
  { label: 'Immobilier', value: 'immobilier', icon: <Home {...IC} /> },
  { label: 'Beauté',     value: 'beaute',     icon: <Sparkles {...IC} /> },
  { label: 'Tech',       value: 'tech',       icon: <Cpu {...IC} /> },
  { label: 'Juridique',  value: 'juridique',  icon: <Scale {...IC} /> },
  { label: 'Finance',    value: 'finance',    icon: <TrendingUp {...IC} /> },
  { label: 'Éducation',  value: 'education',  icon: <BookOpen {...IC} /> },
  { label: 'Sport',      value: 'sport',      icon: <Dumbbell {...IC} /> },
]

const SOURCES = [
  { label: 'Google Maps', value: 'google',    icon: <IconGoogleMaps size={13} />, forced: true },
  { label: 'LinkedIn',    value: 'linkedin',  icon: <IconLinkedIn size={13} /> },
  { label: 'Facebook',    value: 'facebook',  icon: <IconFacebook size={13} /> },
  { label: 'Instagram',   value: 'instagram', icon: <IconInstagram size={13} /> },
  { label: 'TikTok',      value: 'tiktok',    icon: <IconTikTok size={13} /> },
]

const S = {
  panel: {
    background: 'var(--surface)',
    borderBottom: '1px solid var(--border)',
    padding: '18px 16px',
    display: 'flex',
    flexDirection: 'column',
    gap: 20,
    overflowY: 'auto',
    flexShrink: 0,
    maxHeight: '60vh',
  },
  sectionLabel: {
    fontFamily: 'var(--font-body)',
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    color: 'var(--muted)',
    marginBottom: 9,
    display: 'block',
  },
  tag: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    background: 'rgba(0,212,255,0.10)',
    border: '1px solid rgba(0,212,255,0.25)',
    borderRadius: 4,
    padding: '2px 7px',
    fontSize: 12,
    fontFamily: 'var(--font-body)',
    color: 'var(--accent)',
  },
  tagInput: {
    background: 'transparent',
    border: 'none',
    outline: 'none',
    color: 'var(--text)',
    fontSize: 13,
    fontFamily: 'var(--font-body)',
    flex: 1,
    minWidth: 80,
  },
  tagsContainer: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 5,
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 10,
    padding: '7px 10px',
    minHeight: 42,
    alignItems: 'center',
    cursor: 'text',
    transition: 'border-color 0.2s',
  },
  checkbox: {
    accentColor: 'var(--accent)',
    width: 14,
    height: 14,
    cursor: 'pointer',
  },
}

export default function SearchPanel({ onSearch, isLoading, progress, activeProfile, onOpenScoringDrawer, onFiltersChange }) {
  // ─── Recherche ──────────────────────────────────────────────────────────────
  const [city,         setCity]         = useState('')
  const [detectedLoc,  setDetectedLoc]  = useState(null)
  const [radius,       setRadius]       = useState(5)
  const [domain,       setDomain]       = useState('')
  const [keywords,     setKeywords]     = useState([])
  const [keywordInput, setKeywordInput] = useState('')
  const [sources,      setSources]      = useState(['google', 'linkedin', 'facebook', 'instagram'])
  const tagInputRef   = useRef(null)

  // ─── Autocomplétion ville (Nominatim) ───────────────────────────────────────
  const [suggestions,   setSuggestions]   = useState([])   // [{ label, city, lat, lon }]
  const [showDropdown,  setShowDropdown]  = useState(false)
  const [activeIdx,     setActiveIdx]     = useState(-1)
  const [cityValidated, setCityValidated] = useState(false) // true = sélectionné depuis autocomplete
  const debounceRef     = useRef(null)
  const cityWrapperRef  = useRef(null)

  const fetchSuggestions = (value) => {
    clearTimeout(debounceRef.current)
    if (value.length < 2) { setSuggestions([]); setShowDropdown(false); return }

    debounceRef.current = setTimeout(async () => {
      try {
        const url  = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(value)}&limit=6&addressdetails=1&dedupe=1`
        const res  = await fetch(url, { headers: { 'Accept-Language': 'fr' } })
        const data = await res.json()
        console.log('Suggestions:', data)

        // Extrait ville + pays, déduplique sur le nom de ville normalisé
        const seen = new Set()
        const list = data.flatMap(item => {
          const addr  = item.address || {}
          const name  = addr.city || addr.town || addr.village || addr.county || item.display_name.split(',')[0].trim()
          const country = addr.country || ''
          const key   = name.toLowerCase()
          if (seen.has(key)) return []
          seen.add(key)
          return [{ label: country ? `${name}, ${country}` : name, city: name, lat: item.lat, lon: item.lon }]
        })

        setSuggestions(list)
        setShowDropdown(list.length > 0)
        setActiveIdx(-1)
      } catch (e) {
        console.error('[Autocomplete] Erreur:', e)
      }
    }, 300)
  }

  const selectSuggestion = (s) => {
    setCity(s.city)
    setDetectedLoc(s.label)
    setCityValidated(true)
    setSuggestions([])
    setShowDropdown(false)
    setActiveIdx(-1)
  }

  const handleCityKeyDown = (e) => {
    if (!showDropdown || suggestions.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIdx(i => Math.min(i + 1, suggestions.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIdx(i => Math.max(i - 1, -1))
    } else if (e.key === 'Enter' && activeIdx >= 0) {
      e.preventDefault()
      selectSuggestion(suggestions[activeIdx])
    } else if (e.key === 'Escape') {
      setShowDropdown(false)
    }
  }

  // Ferme le dropdown si clic en dehors
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (cityWrapperRef.current && !cityWrapperRef.current.contains(e.target)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // ─── Filtres avancés ────────────────────────────────────────────────────────
  const [advancedOpen,    setAdvancedOpen]    = useState(false)
  const [minRating,       setMinRating]       = useState(0)
  const [minReviews,      setMinReviews]      = useState(0)
  const [onlyNoWebsite,   setOnlyNoWebsite]   = useState(false)
  const [onlyChatbotFree, setOnlyChatbotFree] = useState(false)
  const [onlyNew,         setOnlyNew]         = useState(false)

  // ─── Score minimum ──────────────────────────────────────────────────────────
  const [minScore, setMinScore] = useState(0)

  // ─── Recherches sauvegardées ────────────────────────────────────────────────
  const [savedSearches, setSavedSearches] = useState(() => {
    try { return JSON.parse(localStorage.getItem(LS_SEARCHES_KEY)) || [] }
    catch { return [] }
  })

  const activeFiltersCount = [
    minRating > 0, minReviews > 0, onlyNoWebsite, onlyChatbotFree, onlyNew,
  ].filter(Boolean).length

  // Remonte les filtres à App.jsx chaque fois qu'ils changent
  const onFiltersChangeRef = useRef(onFiltersChange)
  useEffect(() => { onFiltersChangeRef.current = onFiltersChange })
  useEffect(() => {
    onFiltersChangeRef.current?.({ minScore, minRating, minReviews, onlyNoWebsite, onlyChatbotFree, onlyNew })
  }, [minScore, minRating, minReviews, onlyNoWebsite, onlyChatbotFree, onlyNew])

  const timeAgo = (ts) => {
    const diff = Date.now() - ts
    const m = Math.floor(diff / 60000)
    if (m < 1)   return 'à l\'instant'
    if (m < 60)  return `il y a ${m} min`
    const h = Math.floor(m / 60)
    if (h < 24)  return `il y a ${h}h`
    const d = Math.floor(h / 24)
    return `il y a ${d}j`
  }

  const persistSearches = (next) => {
    setSavedSearches(next)
    localStorage.setItem(LS_SEARCHES_KEY, JSON.stringify(next))
  }

  const makeLabelParts = (p) => {
    const domainLabel = DOMAINS.find(d => d.value === p.domain)?.label ?? null
    const parts = [p.city]
    if (domainLabel && p.domain) parts.push(domainLabel)
    else parts.push('Tous')
    parts.push(`${p.radius}km`)
    if (p.keywords?.[0]) parts.push(p.keywords[0])
    return parts
  }
  const makeLabel = (p) => makeLabelParts(p).join(' · ')

  // Appelé automatiquement après chaque recherche
  const autoSaveSearch = () => {
    if (!city.trim()) return
    const now   = Date.now()
    const label = makeLabel({ city, radius, domain, keywords })
    // Si une entrée identique existe déjà (non épinglée), on met juste à jour savedAt
    const existing = savedSearches.find(s => s.label === label)
    let next
    if (existing && !existing.pinned) {
      next = savedSearches.map(s => s.id === existing.id ? { ...s, savedAt: now } : s)
    } else if (!existing) {
      const entry = { id: now, label, savedAt: now, pinned: false, params: { city, radius, domain, keywords, sources } }
      const pinned   = savedSearches.filter(s => s.pinned)
      const unpinned = savedSearches.filter(s => !s.pinned)
      // Max 10 total : garder tous les épinglés + unpinned récents jusqu'à 10 - pinned.length
      const maxUnpinned = Math.max(0, 10 - pinned.length - 1) // -1 pour le nouvel entry
      next = [...pinned, entry, ...unpinned.slice(0, maxUnpinned)]
    } else {
      // Exactement la même recherche épinglée : on ne touche à rien
      return
    }
    persistSearches(next)
  }

  // Épingle / désépingle la recherche courante
  const pinCurrentSearch = () => {
    if (!cityValidated) return
    const label    = makeLabel({ city, radius, domain, keywords })
    const existing = savedSearches.find(s => s.label === label)
    let next
    if (existing) {
      // Toggle pinned
      next = savedSearches.map(s => s.id === existing.id ? { ...s, pinned: !s.pinned } : s)
    } else {
      const now   = Date.now()
      const entry = { id: now, label, savedAt: now, pinned: true, params: { city, radius, domain, keywords, sources } }
      const pinned   = savedSearches.filter(s => s.pinned)
      const unpinned = savedSearches.filter(s => !s.pinned)
      const maxUnpinned = Math.max(0, 10 - pinned.length - 1)
      next = [...pinned, entry, ...unpinned.slice(0, maxUnpinned)]
    }
    persistSearches(next)
  }

  const isCurrentPinned = (() => {
    if (!cityValidated) return false
    const label = makeLabel({ city, radius, domain, keywords })
    return savedSearches.some(s => s.label === label && s.pinned)
  })()

  const deleteSavedSearch = (id) => persistSearches(savedSearches.filter(s => s.id !== id))
  const loadSavedSearch   = (s) => {
    setCity(s.params.city)
    setRadius(s.params.radius)
    setDomain(s.params.domain)
    setKeywords(s.params.keywords)
    setSources(s.params.sources)
    setCityValidated(true)
  }

  // Trie : épinglées en premier, puis par savedAt desc
  const sortedSearches = [...savedSearches].sort((a, b) => {
    if (a.pinned && !b.pinned) return -1
    if (!a.pinned && b.pinned) return 1
    return (b.savedAt ?? b.id) - (a.savedAt ?? a.id)
  })

  const surface = Math.round(Math.PI * radius * radius)

  const addKeyword = (raw) => {
    const val = raw.trim().replace(/,$/, '')
    if (val && !keywords.includes(val) && keywords.length < 6)
      setKeywords([...keywords, val])
    setKeywordInput('')
  }
  const handleKeywordKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addKeyword(keywordInput) }
    else if (e.key === 'Backspace' && keywordInput === '') setKeywords(keywords.slice(0, -1))
  }
  const toggleSource = (value) =>
    setSources(prev => prev.includes(value) ? prev.filter(s => s !== value) : [...prev, value])

  const handleSubmit = async (e) => {
    console.log('[SearchPanel] handleSubmit — city:', city, '| isLoading:', isLoading)
    e.preventDefault()
    if (!city.trim() || isLoading) return
    console.log('[SearchPanel] geocoding...')
    let lat = null, lng = null
    setDetectedLoc(null)
    try {
      const res  = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(city)}&limit=1&addressdetails=1`)
      const data = await res.json()
      if (data.length > 0) {
        lat = parseFloat(data[0].lat)
        lng = parseFloat(data[0].lon)
        const addr    = data[0].address ?? {}
        const locCity = addr.city ?? addr.town ?? addr.village ?? addr.county ?? city
        const country = addr.country ?? ''
        setDetectedLoc(country ? `${locCity}, ${country}` : locCity)
      }
    } catch (err) { console.error('Geocoding error:', err) }
    console.log('[SearchPanel] calling onSearch — lat:', lat, 'lng:', lng)
    autoSaveSearch()
    onSearch({ city, lat, lng, radius, domain, keywords, sources })
  }

  const isDisabled = !city.trim() || isLoading
  const progressPct = progress?.total
    ? Math.round((progress.current / progress.total) * 100)
    : null

  return (
    <form style={S.panel} onSubmit={handleSubmit}>

      {/* 0. INDICATEUR CRÉDITS */}
      {(() => {
        const pct     = Math.round((MOCK_CREDITS / MOCK_CREDITS_MAX) * 100)
        const color   = pct > 50 ? '#10b981' : pct > 20 ? '#f97316' : '#ef4444'
        const bgColor = pct > 50 ? 'rgba(16,185,129,0.08)' : pct > 20 ? 'rgba(249,115,22,0.08)' : 'rgba(239,68,68,0.08)'
        const border  = pct > 50 ? 'rgba(16,185,129,0.20)' : pct > 20 ? 'rgba(249,115,22,0.20)' : 'rgba(239,68,68,0.20)'
        return (
          <div style={{ background: bgColor, border: `1px solid ${border}`, borderRadius: 9, padding: '9px 12px', display: 'flex', flexDirection: 'column', gap: 7 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 11, fontFamily: 'var(--font-body)', fontWeight: 700, color, display: 'flex', alignItems: 'center', gap: 5 }}>
                ⚡ {MOCK_CREDITS.toLocaleString('fr-FR')} / {MOCK_CREDITS_MAX.toLocaleString('fr-FR')} crédits
              </span>
              <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color, fontWeight: 600 }}>{pct}%</span>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.07)', borderRadius: 3, height: 4, overflow: 'hidden' }}>
              <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 3, transition: 'width 0.5s ease', boxShadow: `0 0 6px ${color}66` }} />
            </div>
            {pct <= 20 && (
              <a href="#" style={{ fontSize: 10, color: '#ef4444', fontFamily: 'var(--font-body)', fontWeight: 700, textDecoration: 'none', letterSpacing: '0.04em' }}>
                Acheter des crédits →
              </a>
            )}
          </div>
        )
      })()}

      {/* 1. Ville */}
      <div ref={cityWrapperRef} style={{ position: 'relative' }}>
        <span style={S.sectionLabel}>Ville</span>
        <input
          className="input-premium"
          placeholder="Paris, Strasbourg, Lyon..."
          value={city}
          autoComplete="off"
          onChange={e => {
            setCity(e.target.value)
            setDetectedLoc(null)
            setCityValidated(false)
            fetchSuggestions(e.target.value)
          }}
          onKeyDown={handleCityKeyDown}
          onFocus={() => suggestions.length > 0 && setShowDropdown(true)}
        />

        {/* Dropdown suggestions */}
        {showDropdown && suggestions.length > 0 && (
          <div style={{
            position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0,
            background: 'rgba(13,13,20,0.97)',
            backdropFilter: 'blur(16px)',
            border: '1px solid rgba(255,255,255,0.10)',
            borderRadius: 10,
            boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
            zIndex: 9999,
            overflow: 'hidden',
          }}>
            {suggestions.map((s, i) => (
              <div
                key={i}
                onMouseDown={() => selectSuggestion(s)}
                onMouseEnter={() => setActiveIdx(i)}
                style={{
                  padding: '9px 12px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 9,
                  background: i === activeIdx ? 'rgba(0,212,255,0.09)' : 'transparent',
                  borderBottom: i < suggestions.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                  transition: 'background 0.1s',
                }}
              >
                <span style={{ fontSize: 13, opacity: 0.5, flexShrink: 0 }}>📍</span>
                <span style={{
                  fontSize: 12,
                  fontFamily: 'var(--font-body)',
                  color: i === activeIdx ? 'var(--accent)' : 'var(--text)',
                  flex: 1,
                }}>
                  {/* Met en gras la partie tapée */}
                  {s.label.split(new RegExp(`(${city.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'i')).map((part, j) =>
                    part.toLowerCase() === city.toLowerCase()
                      ? <strong key={j} style={{ color: 'var(--accent)' }}>{part}</strong>
                      : part
                  )}
                </span>
              </div>
            ))}
          </div>
        )}

        {detectedLoc && !showDropdown && (
          <div style={{ fontSize: 11, color: 'var(--accent)', marginTop: 6, fontFamily: 'var(--font-mono)', display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ opacity: 0.7 }}>📍</span> {detectedLoc}
          </div>
        )}
      </div>

      {/* 2. Rayon */}
      <div>
        <span style={S.sectionLabel}>Rayon de recherche</span>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 5, marginBottom: 10 }}>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 30, color: 'var(--accent)', letterSpacing: '-0.03em', lineHeight: 1 }}>
            {radius}
          </span>
          <span style={{ fontSize: 13, color: 'var(--muted)', fontFamily: 'var(--font-body)' }}>km</span>
          <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--faint)', fontFamily: 'var(--font-mono)' }}>
            ≈ {surface} km²
          </span>
        </div>
        <input
          type="range"
          min={1} max={50}
          value={radius}
          onChange={e => setRadius(Number(e.target.value))}
          className="slider-premium"
        />
      </div>

      {/* 3. Domaines */}
      <div>
        <span style={S.sectionLabel}>Domaine</span>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
          {DOMAINS.map(d => (
            <span
              key={d.value}
              className="chip-domain"
              onClick={() => setDomain(d.value)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                padding: '4px 10px',
                borderRadius: 20,
                fontSize: 12,
                fontFamily: 'var(--font-body)',
                fontWeight: 500,
                cursor: 'pointer',
                userSelect: 'none',
                border: `1px solid ${domain === d.value ? 'rgba(0,212,255,0.45)' : 'rgba(255,255,255,0.08)'}`,
                background: domain === d.value ? 'rgba(0,212,255,0.10)' : 'rgba(255,255,255,0.02)',
                color: domain === d.value ? 'var(--accent)' : 'var(--muted)',
                boxShadow: domain === d.value ? '0 0 10px rgba(0,212,255,0.12)' : 'none',
              }}
            >
              {d.icon}{d.label}
            </span>
          ))}
        </div>
      </div>

      {/* 4. Mots-clés */}
      <div>
        <span style={S.sectionLabel}>Mots-clés ({keywords.length}/6)</span>
        <div style={S.tagsContainer} onClick={() => tagInputRef.current?.focus()}>
          {keywords.map((kw, i) => (
            <span key={i} style={S.tag}>
              {kw}
              <button
                type="button"
                onClick={e => { e.stopPropagation(); setKeywords(prev => prev.filter((_, idx) => idx !== i)) }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', opacity: 0.6, padding: 0, lineHeight: 1, fontSize: 13 }}
              >×</button>
            </span>
          ))}
          <input
            ref={tagInputRef}
            style={{ ...S.tagInput, display: keywords.length >= 6 ? 'none' : 'block' }}
            placeholder={keywords.length === 0 ? 'coiffure, spa...' : ''}
            value={keywordInput}
            onChange={e => setKeywordInput(e.target.value)}
            onKeyDown={handleKeywordKeyDown}
            onBlur={() => keywordInput && addKeyword(keywordInput)}
          />
        </div>
      </div>

      {/* 5. Sources */}
      <div>
        <span style={S.sectionLabel}>Sources</span>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {SOURCES.map(src => (
            <label key={src.value} style={{
              display: 'flex',
              alignItems: 'center',
              gap: 9,
              padding: '6px 8px',
              borderRadius: 8,
              cursor: src.forced ? 'default' : 'pointer',
              userSelect: 'none',
              transition: 'background 0.15s',
            }}
            onMouseEnter={e => { if (!src.forced) e.currentTarget.style.background = 'rgba(255,255,255,0.03)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
            >
              <input
                type="checkbox"
                style={S.checkbox}
                checked={src.forced || sources.includes(src.value)}
                disabled={src.forced}
                onChange={() => !src.forced && toggleSource(src.value)}
              />
              <span style={{ color: src.forced ? 'var(--faint)' : 'var(--muted)', display: 'flex' }}>{src.icon}</span>
              <span style={{ fontSize: 13, fontFamily: 'var(--font-body)', color: src.forced ? 'var(--muted)' : 'var(--text)' }}>
                {src.label}
              </span>
              {src.forced && (
                <span style={{ fontSize: 10, color: 'var(--faint)', marginLeft: 'auto', fontFamily: 'var(--font-mono)' }}>
                  always on
                </span>
              )}
            </label>
          ))}
        </div>
      </div>

      {/* 6. FILTRES AVANCÉS */}
      <div>
        <button
          type="button"
          onClick={() => setAdvancedOpen(o => !o)}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            background: 'none', border: 'none', cursor: 'pointer', padding: 0,
          }}
        >
          <span style={{ ...S.sectionLabel, marginBottom: 0, display: 'flex', alignItems: 'center', gap: 7 }}>
            Filtres avancés
            {activeFiltersCount > 0 && (
              <span style={{
                fontSize: 10, fontWeight: 700, fontFamily: 'var(--font-mono)',
                background: 'rgba(139,92,246,0.18)', border: '1px solid rgba(139,92,246,0.35)',
                color: '#a78bfa', borderRadius: 5, padding: '1px 6px',
              }}>
                {activeFiltersCount} actif{activeFiltersCount > 1 ? 's' : ''}
              </span>
            )}
          </span>
          <span style={{ fontSize: 11, color: 'var(--faint)', transition: 'transform 0.2s', display: 'inline-block', transform: advancedOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}>▼</span>
        </button>

        <div style={{
          overflow: 'hidden',
          maxHeight: advancedOpen ? 340 : 0,
          transition: 'max-height 0.25s cubic-bezier(0.4,0,0.2,1)',
        }}>
          <div style={{ paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 14 }}>

            {/* Note Google minimum */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'var(--font-body)' }}>Note Google minimum</span>
                <span style={{ fontSize: 11, color: '#f59e0b', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                  {'★'.repeat(Math.round(minRating))}{'☆'.repeat(5 - Math.round(minRating))} {minRating > 0 ? minRating.toFixed(1) : 'Toutes'}
                </span>
              </div>
              <input type="range" className="slider-premium" min={0} max={5} step={0.5} value={minRating} onChange={e => setMinRating(Number(e.target.value))} />
            </div>

            {/* Avis minimum */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'var(--font-body)' }}>Avis minimum</span>
                <span style={{ fontSize: 11, color: 'var(--accent)', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                  {minReviews > 0 ? `≥ ${minReviews}` : 'Tous'}
                </span>
              </div>
              <input type="range" className="slider-premium" min={0} max={500} step={10} value={minReviews} onChange={e => setMinReviews(Number(e.target.value))} />
            </div>

            {/* Checkboxes */}
            {[
              { label: 'Sans site web uniquement',  value: onlyNoWebsite,   set: setOnlyNoWebsite },
              { label: 'Sans chatbot uniquement',   value: onlyChatbotFree, set: setOnlyChatbotFree },
              { label: 'Nouveaux établissements',   value: onlyNew,         set: setOnlyNew },
            ].map(({ label, value, set }) => (
              <label key={label} style={{ display: 'flex', alignItems: 'center', gap: 9, cursor: 'pointer', userSelect: 'none' }}
                onMouseEnter={e => e.currentTarget.style.color = 'var(--text)'}
                onMouseLeave={e => e.currentTarget.style.color = ''}
              >
                <input type="checkbox" style={S.checkbox} checked={value} onChange={e => set(e.target.checked)} />
                <span style={{ fontSize: 12, fontFamily: 'var(--font-body)', color: value ? 'var(--text)' : 'var(--muted)' }}>{label}</span>
              </label>
            ))}
          </div>
        </div>
      </div>

      {/* 7. SCORE MINIMUM */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <span style={S.sectionLabel}>Qualité minimum</span>
          <span style={{
            fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 700,
            color: minScore >= 70 ? '#10b981' : minScore >= 40 ? '#f97316' : minScore > 0 ? '#ef4444' : 'var(--faint)',
          }}>
            {minScore > 0 ? `≥ ${minScore}/100` : 'Tout afficher'}
          </span>
        </div>
        <input
          type="range"
          className="slider-premium"
          min={0} max={100} step={5}
          value={minScore}
          onChange={e => setMinScore(Number(e.target.value))}
        />
        {/* Zones colorées sous le slider */}
        <div style={{ position: 'relative', height: 4, borderRadius: 2, marginTop: 6, overflow: 'hidden' }}>
          <div style={{ position: 'absolute', left: '0%',  width: '40%', height: '100%', background: 'rgba(239,68,68,0.45)',  borderRadius: '2px 0 0 2px' }} />
          <div style={{ position: 'absolute', left: '40%', width: '30%', height: '100%', background: 'rgba(249,115,22,0.45)' }} />
          <div style={{ position: 'absolute', left: '70%', width: '30%', height: '100%', background: 'rgba(16,185,129,0.45)', borderRadius: '0 2px 2px 0' }} />
          {/* Marqueur de position */}
          {minScore > 0 && (
            <div style={{
              position: 'absolute', left: `${minScore}%`, transform: 'translateX(-50%)',
              top: -1, width: 2, height: 6, background: 'white', borderRadius: 1,
            }} />
          )}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
          {[['0', '#ef4444', '< 40'], ['40', '#f97316', '40–70'], ['70', '#10b981', '> 70']].map(([pos, col, lbl]) => (
            <span key={pos} style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: col, opacity: 0.65 }}>{lbl}</span>
          ))}
        </div>
      </div>

      {/* 8. RECHERCHES SAUVEGARDÉES */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <span style={{ ...S.sectionLabel, marginBottom: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
            🔖 Mes recherches
            {savedSearches.length > 0 && (
              <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--faint)', fontWeight: 400 }}>
                {savedSearches.length}/10
              </span>
            )}
          </span>
          <button
            type="button"
            onClick={pinCurrentSearch}
            disabled={!cityValidated}
            title={
              !cityValidated ? 'Sélectionne une ville depuis la liste d\'abord'
              : isCurrentPinned ? 'Désépingler cette recherche'
              : 'Épingler cette recherche'
            }
            style={{
              background: isCurrentPinned ? 'rgba(139,92,246,0.12)' : 'none',
              border: `1px solid ${isCurrentPinned ? 'rgba(139,92,246,0.4)' : 'rgba(255,255,255,0.12)'}`,
              borderRadius: 6,
              color: !cityValidated ? 'var(--faint)' : isCurrentPinned ? '#a78bfa' : 'var(--muted)',
              fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 600,
              padding: '3px 8px', cursor: cityValidated ? 'pointer' : 'not-allowed',
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => cityValidated && !isCurrentPinned && (e.currentTarget.style.background = 'rgba(255,255,255,0.04)')}
            onMouseLeave={e => !isCurrentPinned && (e.currentTarget.style.background = 'none')}
          >
            📌 {isCurrentPinned ? 'Épinglée' : 'Épingler'}
          </button>
        </div>

        {sortedSearches.length === 0 ? (
          <div style={{ fontSize: 11, color: 'var(--faint)', fontFamily: 'var(--font-body)', textAlign: 'center', padding: '10px 0', fontStyle: 'italic' }}>
            Les recherches s'enregistrent automatiquement
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {sortedSearches.map(s => (
              <div key={s.id} style={{
                display: 'flex', alignItems: 'center', gap: 8,
                background: s.pinned ? 'rgba(139,92,246,0.05)' : 'rgba(255,255,255,0.025)',
                border: `1px solid ${s.pinned ? 'rgba(139,92,246,0.20)' : 'rgba(255,255,255,0.06)'}`,
                borderRadius: 9, padding: '8px 10px',
                transition: 'border-color 0.15s, background 0.15s',
              }}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = s.pinned ? 'rgba(139,92,246,0.35)' : 'rgba(255,255,255,0.14)'
                  e.currentTarget.style.background  = s.pinned ? 'rgba(139,92,246,0.09)' : 'rgba(255,255,255,0.04)'
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = s.pinned ? 'rgba(139,92,246,0.20)' : 'rgba(255,255,255,0.06)'
                  e.currentTarget.style.background  = s.pinned ? 'rgba(139,92,246,0.05)' : 'rgba(255,255,255,0.025)'
                }}
              >
                {/* Icône */}
                <span style={{ fontSize: 12, opacity: 0.5, flexShrink: 0 }}>
                  {s.pinned ? '📌' : '🔍'}
                </span>

                {/* Label + timestamp */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 12, fontFamily: 'var(--font-body)', fontWeight: 600,
                    color: s.pinned ? '#c4b5fd' : 'var(--text)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {s.label}
                  </div>
                  {s.savedAt && (
                    <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--faint)', marginTop: 1 }}>
                      {timeAgo(s.savedAt)}
                    </div>
                  )}
                </div>

                {/* Bouton relancer */}
                <button
                  type="button"
                  onClick={() => loadSavedSearch(s)}
                  title="Charger cette recherche"
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'var(--accent)', fontSize: 13, padding: '2px 4px', lineHeight: 1,
                    flexShrink: 0, transition: 'opacity 0.15s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.opacity = '0.7')}
                  onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
                >
                  🔄
                </button>

                {/* Bouton supprimer */}
                <button
                  type="button"
                  onClick={() => deleteSavedSearch(s.id)}
                  title="Supprimer"
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'var(--faint)', fontSize: 12, padding: '2px 4px', lineHeight: 1,
                    flexShrink: 0, transition: 'color 0.15s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.color = '#ef4444')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'var(--faint)')}
                >
                  🗑
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Barre de progression */}
      {isLoading && progress && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 11, color: 'var(--accent)', fontFamily: 'var(--font-mono)', animation: 'pulse 1.5s infinite' }}>
              {progress.message}
            </span>
            {progressPct !== null && (
              <span style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'var(--font-mono)', fontWeight: 500 }}>
                {progressPct}%
              </span>
            )}
          </div>
          <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 4, height: 3, overflow: 'hidden' }}>
            <div style={{
              height: '100%',
              borderRadius: 4,
              background: 'linear-gradient(90deg, var(--accent), var(--accent2))',
              width: progressPct !== null ? `${progressPct}%` : '100%',
              animation: progressPct === null ? 'progressIndeterminate 1.5s ease infinite' : 'none',
              transition: 'width 0.35s ease',
              boxShadow: '0 0 8px rgba(0,212,255,0.4)',
            }} />
          </div>
        </div>
      )}

      {/* Profil de scoring actif */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '8px 10px',
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 8,
      }}>
        <span style={{ fontSize: 12, fontFamily: 'var(--font-body)', color: 'var(--muted)' }}>
          Profil :{' '}
          <span style={{ color: 'var(--accent)', fontWeight: 600 }}>
            {activeProfile?.name ?? 'Défaut'}
          </span>
        </span>
        <button
          type="button"
          onClick={onOpenScoringDrawer}
          style={{
            background: 'none',
            border: '1px solid rgba(0,212,255,0.3)',
            borderRadius: 6,
            color: 'var(--accent)',
            fontSize: 11,
            fontFamily: 'var(--font-mono)',
            padding: '3px 8px',
            cursor: 'pointer',
          }}
        >
          Modifier
        </button>
      </div>

      {/* Bouton */}
      <button
        type="submit"
        className="btn-shimmer"
        disabled={isDisabled}
        style={{
          width: '100%',
          padding: '11px',
          borderRadius: 10,
          border: 'none',
          background: isDisabled
            ? 'rgba(255,255,255,0.05)'
            : 'linear-gradient(135deg, var(--accent) 0%, var(--accent2) 100%)',
          color: isDisabled ? 'var(--faint)' : '#0a0a0f',
          fontFamily: 'var(--font-display)',
          fontWeight: 700,
          fontSize: 14,
          letterSpacing: '0.02em',
          cursor: isDisabled ? 'not-allowed' : 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          opacity: isDisabled ? 0.5 : 1,
          boxShadow: isDisabled ? 'none' : '0 0 20px rgba(0,212,255,0.25), 0 4px 14px rgba(0,0,0,0.4)',
          transition: 'opacity 0.2s, box-shadow 0.2s',
        }}
      >
        {isLoading ? (
          <>
            <Loader size={14} style={{ animation: 'spin 1s linear infinite', flexShrink: 0 }} />
            Analyse en cours...
          </>
        ) : (
          <>
            <Zap size={14} style={{ flexShrink: 0 }} />
            Générer les leads
          </>
        )}
      </button>

    </form>
  )
}
