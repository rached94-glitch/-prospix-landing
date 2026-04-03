import { useState, useRef, useEffect } from 'react'
import {
  UtensilsCrossed, ShoppingBag, Heart, Home, Sparkles,
  Cpu, Scale, TrendingUp, BookOpen, Dumbbell, Loader, Zap,
} from 'lucide-react'

const IC = { size: 12, strokeWidth: 1.75, style: { flexShrink: 0 } }

const LS_FORM_KEY = 'leadgen_form'
function loadSavedForm() {
  try { return JSON.parse(localStorage.getItem(LS_FORM_KEY)) || {} } catch { return {} }
}

const COUNTRIES = [
  { code: 'fr', flag: '🇫🇷', label: 'France' },
  { code: 'be', flag: '🇧🇪', label: 'Belgique' },
  { code: 'ch', flag: '🇨🇭', label: 'Suisse' },
  { code: 'ca', flag: '🇨🇦', label: 'Canada' },
  { code: 'ma', flag: '🇲🇦', label: 'Maroc' },
  { code: 'dz', flag: '🇩🇿', label: 'Algérie' },
  { code: 'tn', flag: '🇹🇳', label: 'Tunisie' },
  { code: 'sn', flag: '🇸🇳', label: 'Sénégal' },
  { code: 'ci', flag: '🇨🇮', label: "Côte d'Ivoire" },
  { code: 'cm', flag: '🇨🇲', label: 'Cameroun' },
  { code: 'mg', flag: '🇲🇬', label: 'Madagascar' },
  { code: 'ml', flag: '🇲🇱', label: 'Mali' },
  { code: 'bf', flag: '🇧🇫', label: 'Burkina Faso' },
  { code: 'ne', flag: '🇳🇪', label: 'Niger' },
  { code: 'gn', flag: '🇬🇳', label: 'Guinée' },
  { code: 'cg', flag: '🇨🇬', label: 'Congo' },
  { code: 'ga', flag: '🇬🇦', label: 'Gabon' },
  { code: 'tg', flag: '🇹🇬', label: 'Togo' },
  { code: 'bj', flag: '🇧🇯', label: 'Bénin' },
  { code: 'rw', flag: '🇷🇼', label: 'Rwanda' },
  { code: 'es', flag: '🇪🇸', label: 'Espagne' },
  { code: 'it', flag: '🇮🇹', label: 'Italie' },
  { code: 'de', flag: '🇩🇪', label: 'Allemagne' },
  { code: 'pt', flag: '🇵🇹', label: 'Portugal' },
  { code: 'gb', flag: '🇬🇧', label: 'Royaume-Uni' },
  { code: 'nl', flag: '🇳🇱', label: 'Pays-Bas' },
  { code: 'se', flag: '🇸🇪', label: 'Suède' },
  { code: 'no', flag: '🇳🇴', label: 'Norvège' },
  { code: 'dk', flag: '🇩🇰', label: 'Danemark' },
  { code: 'fi', flag: '🇫🇮', label: 'Finlande' },
  { code: 'pl', flag: '🇵🇱', label: 'Pologne' },
  { code: 'ro', flag: '🇷🇴', label: 'Roumanie' },
  { code: 'us', flag: '🇺🇸', label: 'États-Unis' },
  { code: 'mx', flag: '🇲🇽', label: 'Mexique' },
  { code: 'br', flag: '🇧🇷', label: 'Brésil' },
  { code: 'ar', flag: '🇦🇷', label: 'Argentine' },
  { code: 'co', flag: '🇨🇴', label: 'Colombie' },
  { code: 'cl', flag: '🇨🇱', label: 'Chili' },
  { code: 'pe', flag: '🇵🇪', label: 'Pérou' },
  { code: 'ae', flag: '🇦🇪', label: 'Émirats Arabes Unis' },
  { code: 'sa', flag: '🇸🇦', label: 'Arabie Saoudite' },
  { code: 'qa', flag: '🇶🇦', label: 'Qatar' },
  { code: 'kw', flag: '🇰🇼', label: 'Koweït' },
  { code: 'bh', flag: '🇧🇭', label: 'Bahreïn' },
  { code: 'om', flag: '🇴🇲', label: 'Oman' },
  { code: 'tr', flag: '🇹🇷', label: 'Turquie' },
  { code: 'eg', flag: '🇪🇬', label: 'Égypte' },
  { code: 'za', flag: '🇿🇦', label: 'Afrique du Sud' },
  { code: 'ng', flag: '🇳🇬', label: 'Nigeria' },
  { code: 'ke', flag: '🇰🇪', label: 'Kenya' },
  { code: 'gh', flag: '🇬🇭', label: 'Ghana' },
  { code: 'jp', flag: '🇯🇵', label: 'Japon' },
  { code: 'cn', flag: '🇨🇳', label: 'Chine' },
  { code: 'in', flag: '🇮🇳', label: 'Inde' },
  { code: 'au', flag: '🇦🇺', label: 'Australie' },
  { code: 'sg', flag: '🇸🇬', label: 'Singapour' },
  { code: 'th', flag: '🇹🇭', label: 'Thaïlande' },
  { code: 'vn', flag: '🇻🇳', label: 'Vietnam' },
  { code: '',   flag: '🌍', label: 'Monde entier' },
]

function normalize(str) {
  return str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}
function searchCountries(q) {
  const n = normalize(q)
  return COUNTRIES.filter(c => normalize(c.label).startsWith(n) || normalize(c.label).includes(n))
    .sort((a, b) => normalize(a.label).startsWith(n) ? -1 : normalize(b.label).startsWith(n) ? 1 : 0)
    .slice(0, 5)
}
function countryDisplay(code) {
  const c = COUNTRIES.find(c => c.code === code)
  return c ? `${c.flag} ${c.label}` : ''
}

function IconLinkedIn() {
  return (
    <svg width={12} height={12} viewBox="0 0 24 24" fill="currentColor">
      <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/>
      <rect x="2" y="9" width="4" height="12"/><circle cx="4" cy="4" r="2"/>
    </svg>
  )
}
function IconFacebook() {
  return (
    <svg width={12} height={12} viewBox="0 0 24 24" fill="currentColor">
      <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/>
    </svg>
  )
}
function IconInstagram() {
  return (
    <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
      <circle cx="12" cy="12" r="4"/>
      <circle cx="17.5" cy="6.5" r="0.5" fill="currentColor" stroke="none"/>
    </svg>
  )
}
function IconTikTok() {
  return (
    <svg width={12} height={12} viewBox="0 0 24 24" fill="currentColor">
      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.18 8.18 0 0 0 4.78 1.52V6.76a4.85 4.85 0 0 1-1.01-.07z"/>
    </svg>
  )
}
function IconGoogleMaps() {
  return (
    <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
      <circle cx="12" cy="10" r="3"/>
    </svg>
  )
}

const MOCK_CREDITS     = 847
const MOCK_CREDITS_MAX = 1000

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
  { label: 'Google Maps', value: 'google',    icon: <IconGoogleMaps />, forced: true },
  { label: 'LinkedIn',    value: 'linkedin',  icon: <IconLinkedIn /> },
  { label: 'Facebook',    value: 'facebook',  icon: <IconFacebook /> },
  { label: 'Instagram',   value: 'instagram', icon: <IconInstagram /> },
  { label: 'TikTok',      value: 'tiktok',    icon: <IconTikTok /> },
]

const sectionLabel = {
  fontFamily: 'var(--font-body)',
  fontSize: 10, fontWeight: 700,
  letterSpacing: '0.12em', textTransform: 'uppercase',
  color: 'var(--muted)', marginBottom: 8, display: 'block',
}

const tag = {
  display: 'inline-flex', alignItems: 'center', gap: 4,
  background: 'rgba(0,212,255,0.10)',
  border: '1px solid rgba(0,212,255,0.25)',
  borderRadius: 4, padding: '2px 7px',
  fontSize: 11, fontFamily: 'var(--font-body)', color: 'var(--accent)',
}

const tagsContainer = {
  display: 'flex', flexWrap: 'wrap', gap: 4,
  background: 'rgba(255,255,255,0.03)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 8, padding: '6px 9px',
  minHeight: 38, alignItems: 'center', cursor: 'text',
}

export default function SidebarSearch({
  onSearch, isLoading, progress, activeProfile, onOpenScoring,
  onAutoSave, loadedSearch,
}) {
  const [country,      setCountry]      = useState(() => loadSavedForm().country  ?? 'fr')
  const [countryInput, setCountryInput] = useState(() => countryDisplay(loadSavedForm().country ?? 'fr'))
  const [city,         setCity]         = useState(() => loadSavedForm().city     ?? '')
  const [detectedLoc,  setDetectedLoc]  = useState(null)
  const [radius,       setRadius]       = useState(() => loadSavedForm().radius   ?? 5)
  const [domain,       setDomain]       = useState(() => loadSavedForm().domain   ?? '')
  const [keywords,     setKeywords]     = useState(() => loadSavedForm().keywords ?? [])
  const [keywordInput, setKeywordInput] = useState('')
  const [sources,      setSources]      = useState(['google', 'linkedin', 'facebook', 'instagram'])
  const tagInputRef = useRef(null)

  // Country autocomplete
  const [countrySugg,      setCountrySugg]      = useState([])
  const [showCountryDrop,  setShowCountryDrop]  = useState(false)
  const [countryActiveIdx, setCountryActiveIdx] = useState(-1)
  const countryWrapperRef = useRef(null)

  // City autocomplete
  const [suggestions,   setSuggestions]   = useState([])
  const [showDropdown,  setShowDropdown]  = useState(false)
  const [activeIdx,     setActiveIdx]     = useState(-1)
  const [_cityValidated, setCityValidated] = useState(false) // tracked for autocomplete UX
  const debounceRef    = useRef(null)
  const cityWrapperRef = useRef(null)

  // Persist form to localStorage whenever fields change
  useEffect(() => {
    localStorage.setItem(LS_FORM_KEY, JSON.stringify({ country, city, radius, domain, keywords }))
  }, [country, city, radius, domain, keywords])

  // Load from history — React 18 batches these setState calls (eslint rule is overly strict here)
  useEffect(() => {
    if (!loadedSearch) return
    /* eslint-disable react-hooks/set-state-in-effect */
    const savedCode = loadedSearch.country ?? 'fr'
    setCountry(savedCode)
    setCountryInput(countryDisplay(savedCode))
    setCity(loadedSearch.city ?? '')
    setRadius(loadedSearch.radius ?? 5)
    setDomain(loadedSearch.domain ?? '')
    setKeywords(loadedSearch.keywords ?? [])
    setSources(loadedSearch.sources ?? ['google', 'linkedin', 'facebook', 'instagram'])
    setCityValidated(true)
    setDetectedLoc(null)
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [loadedSearch])

  const selectCountry = (c) => {
    setCountry(c.code)
    setCountryInput(`${c.flag} ${c.label}`)
    setCountrySugg([])
    setShowCountryDrop(false)
    setCountryActiveIdx(-1)
    setCity('')
    setSuggestions([])
    setShowDropdown(false)
    setDetectedLoc(null)
  }

  const fetchSuggestions = (value) => {
    clearTimeout(debounceRef.current)
    if (value.length < 2) { setSuggestions([]); setShowDropdown(false); return }
    debounceRef.current = setTimeout(async () => {
      try {
        const cc = country ? `&countrycodes=${country}` : ''
        const res  = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(value)}&limit=6&addressdetails=1&dedupe=1${cc}`, { headers: { 'Accept-Language': 'fr' } })
        const data = await res.json()
        const seen = new Set()
        const list = data.flatMap(item => {
          const addr = item.address || {}
          const name = addr.city || addr.town || addr.village || addr.county || item.display_name.split(',')[0].trim()
          const key  = name.toLowerCase()
          if (seen.has(key)) return []
          seen.add(key)
          const country = addr.country || ''
          return [{ label: country ? `${name}, ${country}` : name, city: name, lat: item.lat, lon: item.lon }]
        })
        setSuggestions(list)
        setShowDropdown(list.length > 0)
        setActiveIdx(-1)
      } catch (e) { console.error('[Autocomplete]', e) }
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
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx(i => Math.min(i + 1, suggestions.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIdx(i => Math.max(i - 1, -1)) }
    else if (e.key === 'Enter' && activeIdx >= 0) { e.preventDefault(); selectSuggestion(suggestions[activeIdx]) }
    else if (e.key === 'Escape') setShowDropdown(false)
  }

  useEffect(() => {
    const handler = (e) => {
      if (cityWrapperRef.current    && !cityWrapperRef.current.contains(e.target))    setShowDropdown(false)
      if (countryWrapperRef.current && !countryWrapperRef.current.contains(e.target)) setShowCountryDrop(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const makeSaveLabel = () => {
    const domainLabel = DOMAINS.find(d => d.value === domain)?.label ?? null
    const parts = [city]
    if (domain && domainLabel) parts.push(domainLabel)
    else parts.push('Tous')
    parts.push(`${radius}km`)
    if (keywords[0]) parts.push(keywords[0])
    return parts.join(' · ')
  }

  const addKeyword = (raw) => {
    const val = raw.trim().replace(/,$/, '')
    if (val && !keywords.includes(val) && keywords.length < 6) setKeywords([...keywords, val])
    setKeywordInput('')
  }
  const handleKeywordKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addKeyword(keywordInput) }
    else if (e.key === 'Backspace' && keywordInput === '') setKeywords(keywords.slice(0, -1))
  }
  const toggleSource = (value) =>
    setSources(prev => prev.includes(value) ? prev.filter(s => s !== value) : [...prev, value])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!city.trim() || isLoading) return
    let lat = null, lng = null
    setDetectedLoc(null)
    try {
      const cc = country ? `&countrycodes=${country}` : ''
      const res  = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(city)}&limit=1&addressdetails=1${cc}`)
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

    // Auto-save to history
    onAutoSave({
      id: Date.now(),
      label: makeSaveLabel(),
      savedAt: Date.now(),
      pinned: false,
      params: { country, city, radius, domain, keywords, sources },
    })

    onSearch({ city, lat, lng, radius, domain, keywords, sources })
  }

  const isDisabled = !city.trim() || isLoading
  const progressPct = progress?.total ? Math.round((progress.current / progress.total) * 100) : null
  const surface = Math.round(Math.PI * radius * radius)

  return (
    <form onSubmit={handleSubmit} style={{
      height: '100%', display: 'flex', flexDirection: 'column',
      overflowY: 'auto', gap: 18, padding: '14px 14px 18px',
    }}>

      {/* Credits */}
      {(() => {
        const pct = Math.round((MOCK_CREDITS / MOCK_CREDITS_MAX) * 100)
        const color   = pct > 50 ? '#10b981' : pct > 20 ? '#f97316' : '#ef4444'
        const bg      = pct > 50 ? 'rgba(16,185,129,0.07)' : pct > 20 ? 'rgba(249,115,22,0.07)' : 'rgba(239,68,68,0.07)'
        const border  = pct > 50 ? 'rgba(16,185,129,0.18)' : pct > 20 ? 'rgba(249,115,22,0.18)' : 'rgba(239,68,68,0.18)'
        return (
          <div style={{ background: bg, border: `1px solid ${border}`, borderRadius: 8, padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 11, fontFamily: 'var(--font-body)', fontWeight: 700, color, display: 'flex', alignItems: 'center', gap: 4 }}>
                ⚡ {MOCK_CREDITS.toLocaleString('fr-FR')} / {MOCK_CREDITS_MAX.toLocaleString('fr-FR')} crédits
              </span>
              <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color, fontWeight: 600 }}>{pct}%</span>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.07)', borderRadius: 3, height: 3, overflow: 'hidden' }}>
              <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 3, transition: 'width 0.5s', boxShadow: `0 0 6px ${color}55` }} />
            </div>
          </div>
        )
      })()}

      {/* Pays */}
      <div ref={countryWrapperRef} style={{ position: 'relative', flexShrink: 0 }}>
        <span style={sectionLabel}>Pays</span>
        <input
          className="input-premium"
          placeholder="🌍 France, Maroc, Canada..."
          value={countryInput}
          autoComplete="off"
          onChange={e => {
            const v = e.target.value
            setCountryInput(v)
            setCountry('')
            const results = v.trim().length === 0 ? COUNTRIES.slice(0, 5) : searchCountries(v)
            setCountrySugg(results)
            setShowCountryDrop(results.length > 0)
            setCountryActiveIdx(-1)
          }}
          onFocus={() => {
            const results = countryInput.trim().length === 0 ? COUNTRIES.slice(0, 5) : searchCountries(countryInput)
            setCountrySugg(results)
            setShowCountryDrop(results.length > 0)
          }}
          onBlur={() => {
            setTimeout(() => {
              setShowCountryDrop(false)
              // Revert to last valid selection if input is partial
              const display = countryDisplay(country)
              if (display) setCountryInput(display)
            }, 150)
          }}
          onKeyDown={e => {
            if (!showCountryDrop || countrySugg.length === 0) return
            if (e.key === 'ArrowDown') { e.preventDefault(); setCountryActiveIdx(i => Math.min(i + 1, countrySugg.length - 1)) }
            else if (e.key === 'ArrowUp') { e.preventDefault(); setCountryActiveIdx(i => Math.max(i - 1, -1)) }
            else if (e.key === 'Enter' && countryActiveIdx >= 0) { e.preventDefault(); selectCountry(countrySugg[countryActiveIdx]) }
            else if (e.key === 'Escape') setShowCountryDrop(false)
          }}
        />
        {showCountryDrop && countrySugg.length > 0 && (
          <div style={{
            position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0,
            background: 'rgba(13,13,20,0.97)', backdropFilter: 'blur(16px)',
            border: '1px solid rgba(255,255,255,0.10)', borderRadius: 9,
            boxShadow: '0 8px 32px rgba(0,0,0,0.6)', zIndex: 9999, overflow: 'hidden',
          }}>
            {countrySugg.map((c, i) => (
              <div
                key={c.code}
                onMouseDown={() => selectCountry(c)}
                onMouseEnter={() => setCountryActiveIdx(i)}
                style={{
                  padding: '8px 11px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 9,
                  background: i === countryActiveIdx ? 'rgba(0,212,255,0.09)' : 'transparent',
                  borderBottom: i < countrySugg.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                }}
              >
                <span style={{ fontSize: 15, lineHeight: 1 }}>{c.flag}</span>
                <span style={{ fontSize: 12, fontFamily: 'var(--font-body)', color: i === countryActiveIdx ? 'var(--accent)' : 'var(--text)' }}>
                  {c.label}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Ville */}
      <div ref={cityWrapperRef} style={{ position: 'relative', flexShrink: 0 }}>
        <span style={sectionLabel}>Ville</span>
        <input
          className="input-premium"
          placeholder="Paris, Lyon, Bordeaux..."
          value={city}
          autoComplete="off"
          onChange={e => { setCity(e.target.value); setDetectedLoc(null); setCityValidated(false); fetchSuggestions(e.target.value) }}
          onKeyDown={handleCityKeyDown}
          onFocus={() => suggestions.length > 0 && setShowDropdown(true)}
        />
        {showDropdown && suggestions.length > 0 && (
          <div style={{
            position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0,
            background: 'rgba(13,13,20,0.97)', backdropFilter: 'blur(16px)',
            border: '1px solid rgba(255,255,255,0.10)', borderRadius: 9,
            boxShadow: '0 8px 32px rgba(0,0,0,0.6)', zIndex: 9999, overflow: 'hidden',
          }}>
            {suggestions.map((s, i) => (
              <div key={i} onMouseDown={() => selectSuggestion(s)} onMouseEnter={() => setActiveIdx(i)} style={{
                padding: '8px 11px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
                background: i === activeIdx ? 'rgba(0,212,255,0.09)' : 'transparent',
                borderBottom: i < suggestions.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
              }}>
                <span style={{ fontSize: 12, opacity: 0.45, flexShrink: 0 }}>📍</span>
                <span style={{ fontSize: 12, fontFamily: 'var(--font-body)', color: i === activeIdx ? 'var(--accent)' : 'var(--text)', flex: 1 }}>
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
          <div style={{ fontSize: 10, color: 'var(--accent)', marginTop: 5, fontFamily: 'var(--font-mono)', display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ opacity: 0.6 }}>📍</span> {detectedLoc}
          </div>
        )}
      </div>

      {/* Rayon */}
      <div style={{ flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 8 }}>
          <span style={sectionLabel}>Rayon</span>
          <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--faint)', fontFamily: 'var(--font-mono)' }}>
            {radius}km · ≈{surface}km²
          </span>
        </div>
        <input type="range" min={1} max={50} value={radius} onChange={e => setRadius(Number(e.target.value))} className="slider-premium" />
      </div>

      {/* Domaines */}
      <div style={{ flexShrink: 0 }}>
        <span style={sectionLabel}>Domaine</span>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {DOMAINS.map(d => (
            <span
              key={d.value}
              onClick={() => setDomain(d.value)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                padding: '3px 9px', borderRadius: 20, fontSize: 11,
                fontFamily: 'var(--font-body)', fontWeight: 500,
                cursor: 'pointer', userSelect: 'none',
                border: `1px solid ${domain === d.value ? 'rgba(0,212,255,0.45)' : 'rgba(255,255,255,0.07)'}`,
                background: domain === d.value ? 'rgba(0,212,255,0.10)' : 'rgba(255,255,255,0.02)',
                color: domain === d.value ? 'var(--accent)' : 'var(--muted)',
              }}
            >
              {d.icon}{d.label}
            </span>
          ))}
        </div>
      </div>

      {/* Mots-clés */}
      <div style={{ flexShrink: 0 }}>
        <span style={sectionLabel}>Mots-clés ({keywords.length}/6)</span>
        <div style={tagsContainer} onClick={() => tagInputRef.current?.focus()}>
          {keywords.map((kw, i) => (
            <span key={i} style={tag}>
              {kw}
              <button type="button" onClick={e => { e.stopPropagation(); setKeywords(prev => prev.filter((_, idx) => idx !== i)) }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', opacity: 0.6, padding: 0, lineHeight: 1, fontSize: 13 }}>
                ×
              </button>
            </span>
          ))}
          <input
            ref={tagInputRef}
            style={{ background: 'transparent', border: 'none', outline: 'none', color: 'var(--text)', fontSize: 12, fontFamily: 'var(--font-body)', flex: 1, minWidth: 70, display: keywords.length >= 6 ? 'none' : 'block' }}
            placeholder={keywords.length === 0 ? 'coiffure, spa...' : ''}
            value={keywordInput}
            onChange={e => setKeywordInput(e.target.value)}
            onKeyDown={handleKeywordKeyDown}
            onBlur={() => keywordInput && addKeyword(keywordInput)}
          />
        </div>
      </div>

      {/* Sources */}
      <div style={{ flexShrink: 0 }}>
        <span style={sectionLabel}>Sources</span>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {SOURCES.map(src => (
            <label key={src.value} style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '5px 6px', borderRadius: 7,
              cursor: src.forced ? 'default' : 'pointer', userSelect: 'none',
            }}
              onMouseEnter={e => { if (!src.forced) e.currentTarget.style.background = 'rgba(255,255,255,0.03)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
            >
              <input type="checkbox" style={{ accentColor: 'var(--accent)', width: 13, height: 13, cursor: 'pointer' }}
                checked={src.forced || sources.includes(src.value)}
                disabled={src.forced}
                onChange={() => !src.forced && toggleSource(src.value)}
              />
              <span style={{ color: src.forced ? 'var(--faint)' : 'var(--muted)', display: 'flex' }}>{src.icon}</span>
              <span style={{ fontSize: 12, fontFamily: 'var(--font-body)', color: src.forced ? 'var(--muted)' : 'var(--text)' }}>{src.label}</span>
              {src.forced && <span style={{ fontSize: 9, color: 'var(--faint)', marginLeft: 'auto', fontFamily: 'var(--font-mono)' }}>always on</span>}
            </label>
          ))}
        </div>
      </div>

      {/* Profil actif */}
      <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 9px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 7 }}>
        <span style={{ fontSize: 11, fontFamily: 'var(--font-body)', color: 'var(--muted)' }}>
          Profil : <span style={{ color: 'var(--accent)', fontWeight: 600 }}>{activeProfile?.name ?? 'Défaut'}</span>
        </span>
        <button type="button" onClick={onOpenScoring} style={{ background: 'none', border: '1px solid rgba(0,212,255,0.25)', borderRadius: 5, color: 'var(--accent)', fontSize: 10, fontFamily: 'var(--font-mono)', padding: '2px 7px', cursor: 'pointer' }}>
          Modifier
        </button>
      </div>

      {/* Progress */}
      {isLoading && progress && (
        <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 11, color: 'var(--accent)', fontFamily: 'var(--font-mono)' }}>{progress.message}</span>
            {progressPct !== null && <span style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>{progressPct}%</span>}
          </div>
          <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 4, height: 3, overflow: 'hidden' }}>
            <div style={{
              height: '100%', borderRadius: 4,
              background: 'linear-gradient(90deg, var(--accent), var(--accent2))',
              width: progressPct !== null ? `${progressPct}%` : '100%',
              animation: progressPct === null ? 'progressIndeterminate 1.5s ease infinite' : 'none',
              transition: 'width 0.35s ease',
              boxShadow: '0 0 8px rgba(0,212,255,0.4)',
            }} />
          </div>
        </div>
      )}

      {/* Bouton */}
      <button
        type="submit"
        className="btn-shimmer"
        disabled={isDisabled}
        style={{
          flexShrink: 0,
          width: '100%', padding: '10px',
          borderRadius: 9, border: 'none',
          background: isDisabled
            ? 'rgba(255,255,255,0.05)'
            : 'linear-gradient(135deg, var(--accent) 0%, var(--accent2) 100%)',
          color: isDisabled ? 'var(--faint)' : '#0a0a0f',
          fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 13,
          letterSpacing: '0.02em',
          cursor: isDisabled ? 'not-allowed' : 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
          opacity: isDisabled ? 0.5 : 1,
          boxShadow: isDisabled ? 'none' : '0 0 20px rgba(0,212,255,0.22), 0 4px 14px rgba(0,0,0,0.4)',
        }}
      >
        {isLoading
          ? <><Loader size={13} style={{ animation: 'spin 1s linear infinite', flexShrink: 0 }} />Génération en cours...</>
          : <><Zap size={13} style={{ flexShrink: 0 }} />⚡ Générer les leads</>
        }
      </button>

    </form>
  )
}
