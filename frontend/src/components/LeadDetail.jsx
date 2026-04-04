import { useState, useEffect, useRef } from 'react'
import { playClick, playSuccess, playError } from '../utils/sounds'
import ReactMarkdown from 'react-markdown'
import { ScoreBadge } from './LeadCard'
import { exportLeadPDF } from '../utils/exportPDF'
import { exportAuditPDF } from '../utils/exportAuditPDF'
import { FaFacebookF, FaLinkedinIn, FaYoutube, FaTiktok, FaInstagram } from 'react-icons/fa'

const SOCIAL_CONFIG = [
  { key: 'linkedin',  label: 'LinkedIn',  icon: '💼' },
  { key: 'facebook',  label: 'Facebook',  icon: '📘' },
  { key: 'instagram', label: 'Instagram', icon: '📸' },
  { key: 'tiktok',    label: 'TikTok',    icon: '🎵' },
]

// Module-level cache: avoids re-calling Anthropic API on every click
const aiCache   = {} // { [placeId]: analysisResult }
const auditCache = {} // { [website]: auditData } — évite les appels PageSpeed répétés

const SCORE_BREAKDOWN = [
  { key: 'googleRating',      label: 'Note Google',        color: '#f59e0b' },
  { key: 'reviewVolume',      label: 'Volume avis',         color: '#10b981' },
  { key: 'digitalPresence',   label: 'Présence digitale',   color: '#EDFA36' },
  { key: 'opportunity',       label: 'Opportunité',         color: '#00d4ff' },
  { key: 'financialCapacity', label: 'Capacité financière', color: '#f97316' },
]

// Default weights (max per criterion) — used as fallback when activeProfile is null
const DEFAULT_WEIGHTS = { googleRating: 30, reviewVolume: 25, digitalPresence: 25, opportunity: 20, financialCapacity: 30 }

function Stars({ rating = 0, size = 13 }) {
  const full = Math.round(rating)
  return (
    <span style={{ fontSize: size, letterSpacing: 0.5 }}>
      {Array.from({ length: 5 }, (_, i) => (
        <span key={i} style={{ color: i < full ? '#f59e0b' : 'rgba(255,255,255,0.10)' }}>★</span>
      ))}
    </span>
  )
}

function Bar({ value, max, color }) {
  const pct = Math.min(Math.round((value / max) * 100), 100)
  return (
    <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 3, height: 4, overflow: 'hidden' }}>
      <div style={{
        width: `${pct}%`,
        height: '100%',
        background: color,
        borderRadius: 3,
        transition: 'width 0.65s cubic-bezier(0.4,0,0.2,1)',
        boxShadow: `0 0 6px ${color}55`,
      }} />
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{
        fontFamily: 'var(--font-body)',
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: '0.12em',
        textTransform: 'uppercase',
        color: '#1D6E55',
        marginBottom: 10,
        paddingBottom: 6,
        borderBottom: '1px solid rgba(29,110,85,0.12)',
      }}>
        {title}
      </div>
      {children}
    </div>
  )
}

const STATUS_KEY = (id) => `lead_status_${id}`
function saveStatus(id, status) { localStorage.setItem(STATUS_KEY(id), status) }

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001'

export default function LeadDetail({ lead, leads, onClose, onStatusChange, onDecisionMakerFound, onLeadUnlocked, activeProfile }) {
  const [contactedConfirm, setContactedConfirm] = useState(false)
  const [savedToSheets,    setSavedToSheets]    = useState(false)
  const [wide,             setWide]             = useState(false)
  const [copiedReport,     setCopiedReport]     = useState(false)
  const [copiedEmail,      setCopiedEmail]      = useState(false)
  const [showDescriptionModal, setShowDescriptionModal] = useState(false)
  const [showTooltip,          setShowTooltip]          = useState(false)
  const [auditTab, setAuditTab] = useState('fiche') // 'fiche' | 'performance' | 'reseaux'

  // Décideur LinkedIn state
  const [dmState,      setDmState]      = useState('idle') // idle | loading | found | not_found
  const [copiedEmails, setCopiedEmails] = useState(null) // null | email string

  // Apify reviews state
  const [reviewsState, setReviewsState]   = useState('idle') // idle | loading | done
  const [reviewsData,  setReviewsData]    = useState(null)

  // AI analysis state
  const [aiState,      setAiState]        = useState('idle') // idle | loading | done | error
  const [aiReport,     setAiReport]       = useState(null)
  const [aiError,      setAiError]        = useState(null)

  // AI-generated email state
  const [aiEmailState, setAiEmailState]   = useState('idle') // idle | loading | done | error
  const [aiEmail,      setAiEmail]        = useState(null)   // { subject, body }

  // Pappers financial data state
  const [pappersData,  setPappersData]    = useState(null)
  const [pappersState, setPappersState]   = useState('idle') // idle | loading | done | not_found

  // Digital audit state (PageSpeed + social activity) — loaded on lead select
  const [auditData,  setAuditData]  = useState(null)  // { pagespeed, socialActivity }
  const [auditState, setAuditState] = useState('idle') // idle | loading | done | error

  // AI prospect audit state — generated on demand via /api/leads/audit-prospect
  const [prospectAudit,      setProspectAudit]      = useState(null)  // JSON from generateAuditSEO
  const [prospectAuditState, setProspectAuditState] = useState('idle') // idle | loading | done | error

  // Instagram deep analysis — profil photographe uniquement
  const [igDeep,        setIgDeep]        = useState(null)
  const [igDeepLoading, setIgDeepLoading] = useState(false)
  const [igDeepError,   setIgDeepError]   = useState(null)

  // Facebook stats on-demand (profil photographe)
  const [fbStats,        setFbStats]        = useState(null)
  const [fbStatsLoading, setFbStatsLoading] = useState(false)
  const [fbStatsError,   setFbStatsError]   = useState(null)

  // TikTok stats on-demand (profil photographe)
  const [tkStats,        setTkStats]        = useState(null)
  const [tkStatsLoading, setTkStatsLoading] = useState(false)
  const [tkStatsError,   setTkStatsError]   = useState(null)

  // SEMrush stats on-demand (profil SEO)
  const [semrushData,        setSemrushData]        = useState(null)
  const [semrushLoading,     setSemrushLoading]     = useState(false)
  const [semrushError,       setSemrushError]       = useState(null)


  // Network visual quality — profil photographe (instagram/facebook/tiktok/pinterest/youtube)
  const [netVisual,        setNetVisual]        = useState({})
  const [netVisualLoading, setNetVisualLoading] = useState({})
  const [netVisualError,   setNetVisualError]   = useState({})

  // Analyse visuelle IA — profils designer / photographe / copywriter
  const [visualAnalysis, setVisualAnalysis] = useState(null)
  const [visualLoading,  setVisualLoading]  = useState(false)
  const [visualError,    setVisualError]    = useState(null)
  const [selectedZone,   setSelectedZone]   = useState('header')
  const [photoQuality,        setPhotoQuality]        = useState(null)
  const [photoQualityLoading, setPhotoQualityLoading] = useState(false)

  // Lock state
  const [isUnlocked,   setIsUnlocked]   = useState(false)
  const [unlockLoading, setUnlockLoading] = useState(false)
  const [unlockError,   setUnlockError]   = useState(null)

  // Ref on scrollable container — used to reset scroll position when lead changes
  const scrollRef = useRef(null)

  useEffect(() => {
    setIsUnlocked(!(lead?.locked))
    setUnlockLoading(false)
    setUnlockError(null)
    setContactedConfirm(false)
    if (scrollRef.current) scrollRef.current.scrollTop = 0
    setSavedToSheets(false)
    setDmState(lead?.decisionMaker ? 'found' : 'idle')
    setCopiedEmails(false)
    setReviewsState('idle')
    setReviewsData(null)
    setWide(false)
    setCopiedReport(false)
    setAiEmailState('idle')
    setAiEmail(null)
    // Restore from cache if already analysed for this lead+profile combo
    const placeKey    = (lead?._id ?? lead?.id ?? '').replace(/^ChIJ/, '')
    const profileKey  = activeProfile?.id ?? 'default'
    const cacheKey    = `${placeKey}::${profileKey}`
    if (placeKey && aiCache[cacheKey]) {
      setAiState('done')
      setAiReport(aiCache[cacheKey])
      setWide(true)
    } else {
      setAiState('idle')
      setAiReport(null)
    }
    // Initialise Pappers depuis les données déjà chargées lors de la recherche
    if (lead?.pappers) {
      setPappersData(lead.pappers)
      setPappersState('done')
    } else {
      setPappersData(null)
      setPappersState('idle')
    }
    // Reset visual analysis on lead change
    setVisualAnalysis(null)
    setVisualLoading(false)
    setVisualError(null)
    setSelectedZone('header')
    // Reset Instagram deep on lead change
    setIgDeep(null)
    setIgDeepLoading(false)
    setIgDeepError(null)
    // Reset network visual on lead change
    setNetVisual({})
    setNetVisualLoading({})
    setNetVisualError({})
    // Reset Facebook / TikTok on-demand stats
    setFbStats(null); setFbStatsLoading(false); setFbStatsError(null)
    setTkStats(null); setTkStatsLoading(false); setTkStatsError(null)
    setPhotoQuality(null)
    setPhotoQualityLoading(false)
    // Audit digital (PageSpeed + social) — chargé à la demande, sauf si cache dispo
    const auditKey = lead?.website || lead?.social?.facebook || lead?.social?.instagram || null
    if (auditKey && auditCache[auditKey]) {
      setAuditData(auditCache[auditKey])
      setAuditState('done')
    } else {
      setAuditData(null)
      setAuditState('idle')
    }
    // Reset prospect audit on lead change
    setProspectAudit(null)
    setProspectAuditState('idle')
    // Reset SEMrush on lead change
    setSemrushData(null); setSemrushLoading(false); setSemrushError(null)
  }, [lead?.id, lead?._id])

  const handleUnlock = async () => {
    if (unlockLoading) return
    setUnlockLoading(true)
    setUnlockError(null)
    try {
      const placeId = lead.id || lead._id
      const res = await fetch(`/api/leads/unlock/${placeId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name:               lead.name,
          vicinity:           lead.address,
          lat:                lead.lat,
          lng:                lead.lng,
          rating:             lead.google?.rating,
          user_ratings_total: lead.google?.totalReviews,
          price_level:        lead.google?.priceLevel,
          photoCount:         lead.googleAudit?.photoCount ?? 0,
          domain:             lead.domain,
          keywords:           lead.keyword ? [lead.keyword] : [],
          city:               lead.address?.split(',').pop()?.trim() ?? '',
          profileId:          activeProfile?.id ?? null,
          weights:            activeProfile?.weights ?? null,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || `HTTP ${res.status}`)
      }
      const enriched = await res.json()
      setIsUnlocked(true)
      onLeadUnlocked?.(lead.id || lead._id, enriched)
    } catch (e) {
      setUnlockError(e.message)
    } finally {
      setUnlockLoading(false)
    }
  }

  const handleAnalyzePerformance = async () => {
    if (auditState === 'loading') return
    setAuditState('loading')
    try {
      const params = new URLSearchParams()
      if (lead.website)            params.set('website',   lead.website)
      if (lead.social?.facebook)   params.set('facebook',  lead.social.facebook)
      if (lead.social?.instagram)  params.set('instagram', lead.social.instagram)
      params.set('profileId', activeProfile?.id ?? '')
      if (lead.id || lead._id)     params.set('placeId',  lead.id || lead._id)
      const leadCategory = lead.keyword || lead.domain || ''
      const leadCity     = lead.address?.split(',').pop()?.trim() || ''
      if (leadCategory)  params.set('category',     leadCategory)
      if (leadCity)      params.set('city',          leadCity)
      if (lead.name)     params.set('businessName',  lead.name)
      if (lead.address)  params.set('address',       lead.address)
      if (lead.phone)    params.set('phone',         lead.phone)
      const r = await fetch(`${API}/api/leads/audit?${params}`)
      const d = await r.json()
      console.log('[Audit] auditData reçu:', d)
      console.log('[Audit] pagespeed:', d?.pagespeed)
      console.log('[Audit] performance:', d?.pagespeed?.performance)
      console.log('[CrUX] données reçues frontend:', d?.pagespeed?.crux)
      console.log('[Audit] facebookActivity:', d?.facebookActivity)
      console.log('[Audit] instagramActivity:', d?.instagramActivity)
      const auditKey = lead.website || lead.social?.facebook || lead.social?.instagram
      if (auditKey) auditCache[auditKey] = d
      setAuditData(d)
      setAuditState('done')
    } catch (e) {
      console.error('[Audit] erreur:', e)
      setAuditState('error')
    }
  }

  const handleFbStats = async () => {
    if (fbStatsLoading || !lead.social?.facebook) return
    setFbStatsLoading(true); setFbStatsError(null); setFbStats(null)
    try {
      const r = await fetch(`${API}/api/leads/facebook-stats?url=${encodeURIComponent(lead.social.facebook)}`)
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || 'Erreur serveur')
      if (d.status === 'unknown') setFbStatsError('Compte privé ou inaccessible')
      else setFbStats(d)
    } catch (e) { setFbStatsError(e.message) }
    finally     { setFbStatsLoading(false) }
  }

  const handleTkStats = async () => {
    if (tkStatsLoading || !lead.social?.tiktok) return
    setTkStatsLoading(true); setTkStatsError(null); setTkStats(null)
    try {
      const r = await fetch(`${API}/api/leads/tiktok-stats?url=${encodeURIComponent(lead.social.tiktok)}`)
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || 'Erreur serveur')
      if (d.error === 'tiktok_unavailable') setTkStatsError('Données indisponibles — compte privé ou restreint')
      else if (d.error) setTkStatsError(d.error)
      else setTkStats(d)
    } catch (e) { setTkStatsError(e.message) }
    finally     { setTkStatsLoading(false) }
  }

  const handleSemrush = async () => {
    if (semrushLoading || !lead.website) return
    setSemrushLoading(true); setSemrushError(null); setSemrushData(null)
    try {
      const domain = lead.website.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0]
      const r = await fetch(`${API}/api/leads/semrush?domain=${encodeURIComponent(domain)}`)
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || 'Erreur serveur')
      setSemrushData(d)
    } catch (e) { setSemrushError(e.message) }
    finally     { setSemrushLoading(false) }
  }

  const handleInstagramDeep = async () => {
    if (igDeepLoading || !lead.social?.instagram) return
    setIgDeepLoading(true)
    setIgDeepError(null)
    setIgDeep(null)
    try {
      const r = await fetch(`${API}/api/leads/instagram-deep`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ instagramUrl: lead.social.instagram }),
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || 'Erreur serveur')
      if (d.error === 'invalid_url') {
        setIgDeepError('URL invalide — analyse impossible')
      } else if (d.error === 'private_or_missing' || d.error === 'not_available') {
        setIgDeepError('Compte privé ou inaccessible')
      } else if (d.error) {
        setIgDeepError(d.error)
      } else {
        setIgDeep(d)
      }
    } catch (e) {
      setIgDeepError(e.message)
    } finally {
      setIgDeepLoading(false)
    }
  }

  const handleNetworkVisual = async (network, networkUrl) => {
    if (netVisualLoading[network] || !networkUrl) return
    setNetVisualLoading(prev => ({ ...prev, [network]: true }))
    setNetVisualError(prev => ({ ...prev, [network]: null }))
    setNetVisual(prev => ({ ...prev, [network]: null }))
    try {
      const r = await fetch(`${API}/api/leads/network-visual`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ networkUrl, network }),
      })
      let d
      try { d = await r.json() } catch { throw new Error('Analyse indisponible') }
      if (!r.ok || d?.error) throw new Error(d?.error || `Erreur ${r.status}`)
      setNetVisual(prev => ({ ...prev, [network]: d }))
    } catch (e) {
      setNetVisualError(prev => ({ ...prev, [network]: e.message }))
    } finally {
      setNetVisualLoading(prev => ({ ...prev, [network]: false }))
    }
  }

  const handleVisualAnalysis = async () => {
    if (visualLoading || !lead.website) return
    setVisualLoading(true)
    setVisualError(null)
    setVisualAnalysis(null)
    try {
      const r = await fetch(`${API}/api/leads/visual-analysis`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ url: lead.website, zone: selectedZone, profile: activeProfile?.id }),
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || 'Erreur serveur')
      setVisualAnalysis(d)
    } catch (e) {
      setVisualError(e.message)
    } finally {
      setVisualLoading(false)
    }
  }

  const handleAnalyzePhotoQuality = async () => {
    const placeId = lead.id || lead._id
    if (!placeId || photoQualityLoading) return
    setPhotoQualityLoading(true)
    try {
      const params = new URLSearchParams({ placeId })
      if (lead.website) params.set('website', lead.website)
      const auditRes  = await fetch(`${API}/api/leads/audit?${params}`)
      const auditJson = await auditRes.json()
      const photoUrls = auditJson.photoUrls || []

      if (photoUrls.length === 0) {
        setPhotoQuality({ verdict: 'Aucune photo', score: null, observations: [], photosAnalyzed: 0 })
        return
      }

      const res  = await fetch(`${API}/api/leads/photo-quality`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ photoUrls }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erreur serveur')
      setPhotoQuality(data)
    } catch (err) {
      console.error('[PhotoQuality]', err)
      setPhotoQuality({ verdict: 'Non analysable', score: null, observations: [], photosAnalyzed: 0 })
    } finally {
      setPhotoQualityLoading(false)
    }
  }

  const handleFindDecisionMaker = async () => {
    if (dmState === 'loading') return
    setDmState('loading')
    try {
      const city = (lead.address || '').split(',').pop()?.trim() || ''
      const res  = await fetch(`${API}/api/leads/decision-maker`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessName: lead.name, city, website: lead.website || null }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erreur serveur')
      if (data.decisionMaker) {
        setDmState('found')
        onDecisionMakerFound?.(leadId, data.decisionMaker)
      } else {
        setDmState('not_found')
      }
    } catch (e) {
      console.error('Decision maker error:', e)
      setDmState('not_found')
    }
  }

  const handleLoadReviews = async () => {
    if (reviewsState === 'loading') return
    setReviewsState('loading')
    setReviewsData(null)
    try {
      const placeId = (lead._id ?? lead.id).replace(/^ChIJ/, '')
      const res  = await fetch(`${API}/api/leads/reviews/${placeId}`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erreur serveur')
      setReviewsData(data)
      setReviewsState('done')
    } catch (e) {
      console.error('Load reviews error:', e)
      setReviewsState('idle')
    }
  }

  const handleAnalyzeAI = async () => {
    if (aiState === 'loading' || !reviewsData) return
    const placeId = (lead._id ?? lead.id).replace(/^ChIJ/, '')

    // Serve from cache if available
    if (aiCache[placeId]) {
      setAiReport(aiCache[placeId])
      setAiState('done')
      return
    }

    const profileId = activeProfile?.id ?? 'default'
    const cacheFullKey = `${placeId}::${profileId}` // cache per lead + profile

    setAiState('loading')
    setAiReport(null)
    setAiError(null)
    try {
      const res  = await fetch(`${API}/api/leads/analyze/${placeId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reviews:      reviewsData.reviews,
          businessName: lead.name,
          profileId,
          websiteUrl:   lead.website   || null,
          city:         (lead.address || '').split(',')[0]?.trim() || null,
          rating:       lead.google?.rating       ?? null,
          reviewCount:  lead.google?.totalReviews ?? null,
          category:     lead.keyword || lead.domain || '',
          auditData:    auditData ? {
            googleAudit:       lead.googleAudit       ?? null,
            pagespeed:         auditData.pagespeed         ?? null,
            facebookActivity:  auditData.facebookActivity  ?? null,
            instagramActivity: auditData.instagramActivity ?? null,
          } : null,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erreur serveur')
      aiCache[cacheFullKey] = data // cache per lead + profile
      setAiReport(data)
      setAiState('done')
      try { playSuccess() } catch (_) {}
      setWide(true)
    } catch (e) {
      console.error('AI analyze error:', e)
      setAiError(e.message || 'Erreur lors de l\'analyse IA')
      setAiState('error')
      try { playError() } catch (_) {}
    }
  }

  const handleGenerateAIEmail = async () => {
    if (aiEmailState === 'loading' || !aiReport) return
    setAiEmailState('loading')
    try {
      const res  = await fetch(`${API}/api/leads/generate-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessName:   lead.name,
          profileId:      activeProfile?.id   ?? 'chatbot',
          profileName:    activeProfile?.name ?? 'Défaut',
          aiAnalysis:     aiReport,
          leadData: {
            rating:       lead.google?.rating,
            totalReviews: lead.google?.totalReviews,
            reviewCount:  lead.google?.totalReviews,
            website:      lead.website,
            social:       lead.social,
            address:      lead.address,
          },
          visualAnalysis:    visualAnalysis ?? null,
          googleData: {
            photoCount:   lead.googleAudit?.photoCount ?? 0,
            hasInstagram: !!(lead.social?.instagram),
          },
          siteAnalysis:      auditData?.siteAnalysis      ?? null,
          reviewsData:       reviewsData                  ?? null,
          facebookActivity:  auditData?.facebookActivity  ?? null,
          instagramActivity: auditData?.instagramActivity ?? null,
          photoQuality:      photoQuality                  ?? null,
          decisionMaker:     lead.decisionMaker            ?? null,
          city:              lead.city ?? lead.vicinity    ?? null,
          category:          lead.types?.[0]               ?? null,
          napData:           auditData?.napData            ?? null,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erreur serveur')
      setAiEmail(data)
      setAiEmailState('done')
    } catch (e) {
      console.error('Generate email error:', e)
      setAiEmailState('error')
    }
  }

  const handleLoadPappers = async () => {
    if (pappersState === 'loading') return
    setPappersState('loading')
    try {
      const city = (lead.address || '').split(',').pop()?.trim() || ''
      const res  = await fetch(`${API}/api/leads/pappers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessName: lead.name, city }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erreur serveur')
      if (data.pappers) {
        setPappersData(data.pappers)
        setPappersState('done')
      } else {
        setPappersState('not_found')
      }
    } catch (e) {
      console.error('Pappers error:', e)
      setPappersState('not_found')
    }
  }

  if (!lead) return null

  const leadId     = lead._id ?? lead.id
  const score      = lead.score?.total ?? lead.score ?? 0
  const breakdown  = lead.score?.breakdown ?? {}
  const isFavorite = lead.status === 'favorite'
  const isIgnored  = lead.status === 'ignored'

  // Derive display weights: activeProfile.weights if valid, else DEFAULT_WEIGHTS
  const activeWeights = (() => {
    const w = activeProfile?.weights
    if (w && typeof w === 'object' && !Array.isArray(w)) {
      const valid = SCORE_BREAKDOWN.every(({ key }) => key === 'financialCapacity' || (typeof w[key] === 'number' && w[key] > 0))
      if (valid) {
        console.log('[LeadDetail] activeWeights from profile:', activeProfile.id, w)
        return w
      }
    }
    console.warn('[LeadDetail] activeProfile.weights invalid, using DEFAULT_WEIGHTS. activeProfile=', activeProfile)
    return DEFAULT_WEIGHTS
  })()

  const handleContact = () => {
    try { playClick() } catch (_) {}
    if (lead.email) {
      window.location.href = `mailto:${lead.email}?subject=Proposition chatbot pour ${encodeURIComponent(lead.name)}&body=Bonjour%2C%20je%20vous%20contacte%20au%20sujet%20de%20l'am%C3%A9lioration%20de%20votre%20pr%C3%A9sence%20digitale.`
    } else if (lead.phone) {
      alert(`Pas d'email trouvé.\nAppeler : ${lead.phone}`)
    } else {
      alert('Aucun moyen de contact disponible pour ce lead.')
    }
    onStatusChange(leadId, 'contacted')
    saveStatus(leadId, 'contacted')
    setContactedConfirm(true)
    setTimeout(() => setContactedConfirm(false), 2000)
  }
  const handleFavorite = () => {
    try { playClick() } catch (_) {}
    const next = isFavorite ? 'new' : 'favorite'
    onStatusChange(leadId, next)
    saveStatus(leadId, next)
    if (next === 'favorite') {
      setSavedToSheets(true)
      setTimeout(() => setSavedToSheets(false), 2000)
    }
  }
  const handleIgnore = () => {
    try { playClick() } catch (_) {}
    onStatusChange(leadId, 'ignored')
    saveStatus(leadId, 'ignored')
  }

  const buildEmail = (profileId) => {
    const ra          = lead.reviewAnalysis
    const unanswered  = ra?.negative?.unanswered ?? 0
    const reviews     = lead.google?.totalReviews ?? 0
    const rating      = lead.google?.rating ?? '—'
    const noWebsite   = !lead.website
    const noIG        = !lead.social?.instagram
    const noTK        = !lead.social?.tiktok
    const missingNets = [noIG && 'Instagram', noTK && 'TikTok'].filter(Boolean).join(' et ')
    const photoCount  = lead.google?.photos?.length ?? lead.photoCount ?? 0

    const SIG = '\n___________________\n[Votre numéro]'

    const templates = {
      'chatbot': {
        subject: unanswered > 0
          ? `${lead.name} — ${unanswered} clients sans réponse`
          : `${lead.name} — Répondez à vos clients 24h/24`,
        body: `Bonjour,

En analysant la fiche Google de ${lead.name}, j'ai repéré quelque chose qui m'a interpellé : ${unanswered > 0 ? `${unanswered} avis sans aucune réponse du propriétaire` : 'des demandes clients qui restent sans réponse rapide'}.

Chaque question sans réponse, c'est un client potentiel perdu — souvent au profit d'un concurrent qui, lui, répond en moins de 2 minutes grâce à un assistant IA.

J'intègre des chatbots IA sur mesure pour des commerces locaux comme le vôtre. En 48h, votre site répond automatiquement aux questions fréquentes, prend des réservations et relance les prospects — 24h/24, 7j/7, sans effort de votre part.

Résultat moyen constaté chez mes clients : +23 % de prises de contact en 30 jours.

Auriez-vous 15 minutes cette semaine pour une démo en direct, sur votre propre site ?

Bien cordialement,
[Votre prénom]${SIG}`,
      },

      'seo': noWebsite ? {
        subject: `${lead.name} — Sans site, le SEO est impossible`,
        body: `Bonjour,

En cherchant ${lead.name} sur Google, j'ai constaté l'absence de site web.

Sans site, vos ${reviews} avis positifs restent invisibles pour 76 % des clients qui cherchent en ligne avant de se déplacer.

Je propose un pack complet :
→ Site pro optimisé SEO dès le départ
→ Fiche Google My Business optimisée
→ Référencement local inclus

Résultat : visible sur Google en moins de 60 jours.

15 minutes pour vous montrer des exemples dans votre secteur ?

Bien cordialement,
[Votre prénom]${SIG}`,
      } : {
        subject: `J'ai audité ${lead.name} sur Google — voici ce que j'ai trouvé`,
        body: `Bonjour,

J'ai analysé la présence en ligne de ${lead.name}.

Votre site ${lead.website ? lead.website.replace(/^https?:\/\//, '') : ''} existe mais n'apparaît pas quand on cherche votre activité${noWebsite ? '' : ' à ' + (lead.address?.split(',')[0]?.trim() || 'dans votre ville')}.

Pendant ce temps, vos ${reviews} avis (${rating}/5) restent invisibles pour les nouveaux clients qui vous cherchent en ligne.

3 problèmes techniques que j'ai identifiés en 5 minutes :
→ Balises titre non optimisées
→ Fiche Google My Business incomplète
→ Aucun backlink local

Ces 3 points corrigés = première page Google en 90 jours.

Audit complet offert cette semaine.

Bien cordialement,
[Votre prénom]${SIG}`,
      },

      'consultant-seo': {
        subject: `${lead.name} — Audit SEO gratuit : voici ce que j'ai trouvé`,
        body: `Bonjour,

J'ai effectué une analyse rapide de la présence en ligne de ${lead.name}. Vous avez un capital confiance solide — ${reviews} avis, ${rating}/5 — mais votre visibilité organique ne reflète pas encore ce potentiel.

J'ai identifié plusieurs leviers concrets : optimisation de vos balises, cohérence de votre NAP local, structure de vos pages, opportunités de backlinks dans votre secteur. Chacun améliore votre positionnement sans budget publicitaire.

En tant que consultant SEO indépendant, je ne vends pas de packages. Je réalise un audit complet, j'explique exactement ce qui freine votre visibilité et on décide ensemble des priorités.

Audit complet offert pour les nouveaux clients — compte rendu en 48h.

Un appel de 20 minutes pour qu'on fasse le point ?

Bien cordialement,
[Votre prénom]${SIG}`,
      },

      'social-media': {
        subject: missingNets
          ? `${lead.name} — Absent(e) sur ${missingNets}`
          : `${lead.name} — Votre communauté vous attend sur les réseaux`,
        body: `Bonjour,

J'ai analysé la présence digitale de ${lead.name}${missingNets ? ` et constaté l'absence sur ${missingNets}` : ' et remarqué un potentiel non exploité sur les réseaux sociaux'}.

Avec ${reviews} clients qui vous font confiance (${rating}/5), vous avez une matière première exceptionnelle. Chaque avis, chaque service, chaque instant de votre activité peut devenir du contenu qui attire de nouveaux clients — gratuitement.

En moyenne, mes clients gagnent entre 300 et 2 000 nouveaux abonnés en 60 jours, et voient leur trafic augmenter de 15 à 30 %. Je crée et publie tout pour vous : textes, visuels, reels, stories. Vous n'avez rien à faire.

Je vous envoie des exemples de contenu réalisés pour des commerces similaires ?

Bien cordialement,
[Votre prénom]${SIG}`,
      },

      'photographe': {
        subject: `${lead.name} — Des photos qui font perdre des clients`,
        body: `Bonjour,

En cherchant ${lead.name} sur Google Maps, j'ai regardé vos photos${photoCount === 0 ? " — et il n'y en a pas" : photoCount < 5 ? ` — seulement ${photoCount} disponibles` : ''}.

C'est dommage, parce que vos ${reviews} avis et votre note de ${rating}/5 montrent que vos clients adorent ce que vous faites. Mais avant d'entrer, les nouveaux clients regardent les photos. S'ils ne voient rien, ils passent à la fiche suivante.

Google Maps favorise les établissements avec des photos récentes et qualitatives : ils apparaissent plus haut et génèrent 2 à 3 fois plus de clics.

Je propose des séances photo professionnelles dédiées aux commerces locaux : ambiance, produits, équipe, avant/après. Résultat livré en 5 jours.

Disponible pour un devis sans engagement ?

Bien cordialement,
[Votre prénom]${SIG}`,
      },

      'videaste': {
        subject: `${lead.name} — La vidéo qui manque à votre vitrine`,
        body: `Bonjour,

J'ai regardé la présence en ligne de ${lead.name}${missingNets ? ` — aucune vidéo, pas de présence sur ${missingNets}` : " — et j'ai remarqué l'absence de contenu vidéo"}.

En 2025, une vidéo bien réalisée génère 10 à 20 fois plus d'engagement qu'une photo. Les clients veulent voir l'ambiance, le savoir-faire, les coulisses — avant de se décider. Sans vidéo, vous laissez cet espace à vos concurrents.

Vos ${reviews} avis (${rating}/5) prouvent que l'expérience que vous offrez mérite d'être montrée. Je réalise des vidéos courtes (30–90 sec) pensées pour les réseaux sociaux et Google — tournées en une demi-journée, livrées montées.

Je peux vous montrer des exemples de réalisations dans votre secteur ?

Bien cordialement,
[Votre prénom]${SIG}`,
      },

      'designer': {
        subject: `${lead.name} — Votre image de marque envoie-t-elle le bon message ?`,
        body: `Bonjour,

J'ai examiné la présence visuelle de ${lead.name} en ligne. Avec ${reviews} avis et une note de ${rating}/5, vous avez une excellente réputation. Mais votre identité visuelle — logo, couleurs, typographie, cohérence entre vos supports — raconte-t-elle la même histoire ?

Un branding incohérent crée un doute inconscient chez les prospects. Même si votre service est excellent, une image qui ne correspond pas à votre promesse peut faire fuir des clients avant qu'ils vous contactent.

Je suis designer spécialisé en branding pour les commerces locaux. Je crée des identités visuelles qui inspirent confiance, fidélisent et démarquent — logo, charte graphique, supports print et digitaux.

Je vous envoie des exemples de rebranding réalisés dans votre secteur ?

Bien cordialement,
[Votre prénom]${SIG}`,
      },

      'copywriter': {
        subject: `${lead.name} — Vos ${reviews} avis cachent une mine d'or inexploitée`,
        body: `Bonjour,

J'ai lu les avis Google de ${lead.name}. Vos clients utilisent des mots précis, des formules authentiques, des émotions réelles. C'est exactement ce que cherchent vos futurs clients avant de vous faire confiance.

Problème : ces mots restent enfermés dans Google. Votre site, vos réseaux, vos emails ne les utilisent pas. Résultat : vous perdez des conversions à chaque étape.

Je suis copywriter spécialisé en marketing local. Je transforme vos avis clients et l'histoire de votre marque en textes qui convainquent — pages de vente, fiches produits, séquences email, accroches réseaux sociaux.

Mes clients voient en moyenne +35 % de clics et +20 % de conversions après réécriture de leurs pages clés.

Je vous propose un mini-audit de votre page d'accueil actuelle — offert, sans engagement. Ça vous intéresse ?

Bien cordialement,
[Votre prénom]${SIG}`,
      },

      'dev-web': {
        subject: noWebsite
          ? `${lead.name} — Sans site web, vous perdez des clients chaque jour`
          : `${lead.name} — Votre site web peut générer 3× plus de contacts`,
        body: noWebsite
          ? `Bonjour,

En cherchant ${lead.name} en ligne, j'ai constaté l'absence de site web professionnel. Pourtant, avec ${reviews} avis Google et une note de ${rating}/5, vous avez tout pour convertir les visiteurs en clients.

Sans site, vous êtes invisible pour tous ceux qui cherchent votre type de service en dehors de Google Maps. C'est plusieurs dizaines de clients potentiels perdus chaque mois, directement au profit de vos concurrents.

Je crée des sites web rapides, modernes et optimisés pour le référencement local — livrés en 10 à 14 jours, sans jargon technique. Mes clients constatent en moyenne +40 % de demandes de contact dans les 30 premiers jours.

Je vous prépare une maquette gratuite pour visualiser ce que ça donnerait pour ${lead.name} ?

Bien cordialement,
[Votre prénom]${SIG}`
          : `Bonjour,

J'ai visité le site de ${lead.name}. Vous avez posé les bases — c'est une bonne chose. Mais j'ai identifié plusieurs points qui vous coûtent des contacts qualifiés chaque semaine.

Avec ${reviews} avis (${rating}/5), votre réputation est là. Le problème, c'est que votre site actuel ne transforme pas ce capital confiance en prises de rendez-vous ou en demandes de devis.

Vitesse, mobile, pages de conversion, SEO local — j'interviens sur les points qui font vraiment la différence. Mes clients gagnent en moyenne 3 fois plus de contacts qualifiés après refonte.

Je peux vous faire un audit de 10 minutes et vous montrer exactement quoi améliorer — sans engagement.

Bien cordialement,
[Votre prénom]${SIG}`,
      },

      'email-marketing': {
        subject: `${lead.name} — Vos clients satisfaits ne reviennent pas assez`,
        body: `Bonjour,

Avec ${reviews} avis et une note de ${rating}/5, ${lead.name} a clairement des clients qui aiment ce que vous faites. La vraie question : combien d'entre eux reviennent régulièrement ?

La majorité des commerces perdent 60 à 70 % de leurs clients non pas par mauvaise expérience, mais par oubli. Pas de rappel, pas de lien, pas de raison de revenir.

Une séquence email bien construite change ça. Message de bienvenue, offres exclusives, rappels saisonniers, programme fidélité — chaque email travaille pour vous pendant que vous vous concentrez sur votre métier.

Mes clients fidélisent en moyenne 2 fois plus de clients et augmentent leur panier moyen de 25 % en 90 jours.

Je peux vous montrer une séquence adaptée à votre secteur en 15 minutes d'appel ?

Bien cordialement,
[Votre prénom]${SIG}`,
      },

      'pub-google': {
        subject: `${lead.name} — Vos concurrents achètent les clients que vous perdez`,
        body: `Bonjour,

J'ai analysé les annonces Google Ads dans votre secteur. Plusieurs de vos concurrents directs apparaissent en première position sur les recherches de vos futurs clients — avec un budget souvent inférieur à ce que vous imaginez.

Avec ${reviews} avis (${rating}/5), ${lead.name} a tous les atouts pour convertir. Il manque juste la visibilité au bon moment, au bon endroit.

Je gère des campagnes Google Ads pour des commerces locaux avec un principe simple : chaque euro investi doit générer au moins 3 euros de chiffre d'affaires. Pas de budget gaspillé sur des clics non qualifiés.

Je vous propose un audit publicitaire gratuit — je vous montre ce que vos concurrents font, ce qu'il vous faudrait pour les dépasser et quel budget serait rentable pour vous.

Disponible cette semaine ?

Bien cordialement,
[Votre prénom]${SIG}`,
      },
    }

    return templates[profileId] ?? templates['chatbot']
  }

  const [pdfLoading, setPdfLoading] = useState(false)
  const [auditPdfLoading, setAuditPdfLoading] = useState(false)
  const [auditPdfError,   setAuditPdfError]   = useState(null)

  const handleExportPDF = async () => {
    setPdfLoading(true)
    try {
      await exportLeadPDF({ lead, activeProfile, aiReport, aiEmail, pappersData, auditData })
    } catch (err) {
      console.error('[PDF]', err)
    } finally {
      setPdfLoading(false)
    }
  }

  const handleExportAuditPDF = async () => {
    setAuditPdfLoading(true)
    setAuditPdfError(null)
    setProspectAuditState('loading')
    try {
      const placeId  = lead.id || lead._id || 'unknown'
      const profileId = activeProfile?.id ?? 'seo'
      const leadCity  = lead.address?.split(',').pop()?.trim() || ''

      // Step 1 — generate AI audit via backend
      const r = await fetch(`${API}/api/leads/audit-prospect/${placeId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profile: profileId,
          leadData: {
            name:        lead.name        ?? '',
            address:     lead.address     ?? '',
            city:        leadCity,
            category:    lead.keyword     ?? lead.domain ?? '',
            website:     lead.website     ?? null,
            rating:      lead.google?.rating       ?? null,
            reviewCount: lead.google?.totalReviews  ?? null,
            googleAudit: lead.googleAudit ?? null,
          },
          pagespeedData:    auditData?.pagespeed         ?? null,
          localRank:        auditData?.localRank         ?? null,
          reviewsData:      reviewsData                  ?? null,
          napData:          auditData?.napData           ?? null,
          facebookActivity: auditData?.facebookActivity  ?? null,
          instagramActivity:auditData?.instagramActivity ?? null,
        }),
      })
      if (!r.ok) {
        const err = await r.json().catch(() => ({}))
        throw new Error(err.error ?? `Erreur serveur ${r.status}`)
      }
      const prospectAuditResult = await r.json()
      setProspectAudit(prospectAuditResult)
      setProspectAuditState('done')

      // Step 2 — generate PDF with AI content
      await exportAuditPDF({ lead, activeProfile, activeWeights, aiReport, auditData, prospectAudit: prospectAuditResult })
    } catch (err) {
      console.error('[AuditPDF]', err)
      setProspectAuditState('error')
      setAuditPdfError(err.message ?? 'Erreur inconnue')
    } finally {
      setAuditPdfLoading(false)
    }
  }

  const handleDownloadEmailPDF = async () => {
    const tpl = aiEmail ?? buildEmail(activeProfile?.id ?? 'chatbot')
    if (!tpl) return

    try {
      const { jsPDF } = await import('jspdf')
      const doc      = new jsPDF({ unit: 'mm', format: 'a4' })
      const margin   = 20
      const pageW    = doc.internal.pageSize.getWidth()
      const pageH    = doc.internal.pageSize.getHeight()
      const maxW     = pageW - margin * 2
      const dateStr  = new Date().toLocaleDateString('fr-FR')
      const profileName = activeProfile?.name ?? 'Défaut'

      let y = margin

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(15)
      doc.setTextColor(30, 30, 30)
      const titleLines = doc.splitTextToSize(`Email de prospection — ${lead.name ?? ''}`, maxW)
      doc.text(titleLines, margin, y)
      y += titleLines.length * 7 + 5

      doc.setDrawColor(200, 200, 200)
      doc.line(margin, y, pageW - margin, y)
      y += 7

      doc.setFontSize(10)
      doc.setTextColor(80, 80, 80)
      doc.setFont('helvetica', 'bold')
      doc.text('Objet :', margin, y)
      doc.setFont('helvetica', 'normal')
      const subjLines = doc.splitTextToSize(tpl.subject ?? '', maxW - 18)
      doc.text(subjLines, margin + 18, y)
      y += Math.max(subjLines.length, 1) * 5 + 8

      doc.setDrawColor(230, 230, 230)
      doc.line(margin, y, pageW - margin, y)
      y += 7

      doc.setFont('helvetica', 'normal')
      doc.setFontSize(10)
      doc.setTextColor(40, 40, 40)
      const bodyLines = doc.splitTextToSize(tpl.body ?? '', maxW)
      const lineH = 5.2
      for (const line of bodyLines) {
        if (y + lineH > pageH - 22) {
          doc.addPage()
          y = margin
        }
        doc.text(line, margin, y)
        y += lineH
      }

      const lastPageH = doc.internal.pageSize.getHeight()
      doc.setDrawColor(200, 200, 200)
      doc.line(margin, lastPageH - 16, pageW - margin, lastPageH - 16)
      doc.setFontSize(8)
      doc.setTextColor(150, 150, 150)
      doc.text(`Généré par LeadGen Pro · ${dateStr} · Profil ${profileName}`, margin, lastPageH - 10)

      const filename = `email-${(lead.name ?? 'lead').replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}.pdf`
      doc.save(filename)
    } catch (err) {
      console.error('[EmailPDF] erreur jsPDF:', err)
      alert('Erreur lors de la génération du PDF email')
    }
  }

  // ── Profile-based data logic (KPIs + problems) ──
  const getProfileData = () => {
    const profileId   = activeProfile?.id ?? 'default'
    const social      = lead.social || {}
    const google      = lead.google || {}
    const totalReviews = Number(google.totalReviews) || 0
    const rating      = google.rating || 0
    const hasWebsite  = !!(lead.website && !['null', 'undefined', ''].includes(String(lead.website)))
    const hasFacebook = !!social.facebook
    const hasInstagram = !!social.instagram
    const hasLinkedin = !!social.linkedin
    const hasTiktok   = !!social.tiktok
    const photoCount  = lead.googleAudit?.photoCount || 0
    const unanswered  = lead.reviewAnalysis?.negative?.unanswered || 0

    // PageSpeed metrics (handle both 0–1 and 0–100 ranges)
    const rawPerf    = auditData?.pagespeed?.performance
    const perfScore  = rawPerf != null
      ? (rawPerf <= 1 ? Math.round(rawPerf * 100) : Math.round(rawPerf))
      : null
    const rawSEO     = auditData?.pagespeed?.seo
    const seoScore   = (() => {
      if (rawSEO == null) return null
      const v = rawSEO <= 1 ? Math.round(rawSEO * 100) : Math.round(rawSEO)
      return (isNaN(v) || v < 0 || v > 100) ? null : v
    })()
    // loadTime is now a number in seconds (e.g. 3.5) from backend
    const rawLoadTime = auditData?.pagespeed?.loadTime
    const loadTimeSec = rawLoadTime != null ? Number(rawLoadTime).toFixed(1) : null
    // Extra SEO fields
    const psHttps          = auditData?.pagespeed?.https               ?? null   // boolean
    const psTitle          = auditData?.pagespeed?.title               ?? null   // 'Présente'|'Absente'
    const psLcp            = auditData?.pagespeed?.lcp                 ?? null   // string "2.3 s"
    const psCls            = auditData?.pagespeed?.cls                 ?? null   // string "0.12"
    const psSitemap        = auditData?.pagespeed?.sitemap             ?? null   // boolean
    const psRobots         = auditData?.pagespeed?.robots              ?? null   // boolean
    const psPerformanceDsk = auditData?.pagespeed?.performanceDesktop  ?? auditData?.pagespeed?.desktopPerf ?? null  // 0-100
    const psAccessibility  = auditData?.pagespeed?.accessibility       ?? null   // 0-100
    const psImagesOpt      = auditData?.pagespeed?.imagesOptimized     ?? null   // boolean
    const psRenderBlocking = auditData?.pagespeed?.renderBlocking      ?? null   // number
    const psMobileFriendly = auditData?.pagespeed?.mobileFriendly      ?? null   // boolean
    const hasMeta    = !!(lead.googleAudit?.descriptionText && lead.googleAudit?.descriptionSource !== 'contenu page')

    const kpi  = (label, value, status = 'neutral', note = null, tooltip = null) => ({ label, value: String(value), status, note, tooltip })
    const prob = (text, color) => ({ text, color })

    switch (profileId) {
      case 'chatbot':
      case 'dev-chatbot': {
        const siteSignals     = auditData?.pagespeed?.siteSignals ?? null
        const isBookingUrl    = siteSignals?.isBookingUrl ?? false
        const chatDetected    = siteSignals != null ? siteSignals.chatbotDetected : !!(lead.googleAudit?.hasChatbot)
        const chatTool        = siteSignals?.chatbotTool ?? null
        const bookingPlatform = siteSignals?.bookingPlatform ?? null
        const hasFAQ          = siteSignals?.hasFAQ ?? null
        const hasForm         = siteSignals?.hasContactForm ?? null
        const sensitive       = auditData?.pagespeed?.sensitiveData ?? null
        const themes          = lead.reviewAnalysis?.themes?.length || 0

        const kpis = [
          kpi('Avis sans réponse', unanswered > 0 ? unanswered : '0', unanswered > 0 ? 'danger' : 'good'),
          { label: 'CHATBOT EXISTANT', type: 'chatbot_detect', detected: chatDetected, tool: chatTool },
        ]
        // Booking platform card — always orange, regardless of whether the URL is the platform itself
        if (bookingPlatform !== null)
          kpis.push({ label: 'PLATEFORME RÉSERVATION', type: 'booking_url', platform: bookingPlatform })
        if (hasFAQ !== null)
          kpis.push({ label: 'FAQ DÉTECTÉE', type: 'faq_detect', detected: hasFAQ })
        if (hasForm !== null)
          kpis.push({ label: 'FORMULAIRE CONTACT', type: 'form_detect', detected: hasForm })
        if (sensitive !== null)
          kpis.push({ label: 'DOMAINE SENSIBLE', type: 'sensitive', detected: sensitive })
        if (siteSignals === null)
          kpis.push(kpi('Thèmes récurrents', themes > 0 ? themes : '—', themes > 0 ? 'warn' : 'neutral'))

        return {
          kpis,
          problems: [
            ...(unanswered > 0   ? [prob(`${unanswered} avis sans réponse — chaque silence = client perdu`, '#ef4444')] : []),
            ...(!chatDetected    ? [prob('Aucun chatbot détecté — opportunité directe', '#22c55e')] : []),
            ...(chatDetected     ? [prob(`Chatbot existant (${chatTool ?? 'inconnu'}) — angle différentiel requis`, '#f59e0b')] : []),
            ...(bookingPlatform  ? [prob(`${bookingPlatform} détecté — ne pas proposer la réservation, angle FAQ/tarifs/horaires`, '#f97316')] : []),
            ...(hasFAQ           ? [prob('FAQ détectée — base de contenu disponible', '#22c55e')] : []),
            ...(sensitive        ? [prob('Données sensibles — serveur local recommandé', '#f97316')] : []),
            ...(themes > 0       ? [prob(`${themes} thèmes récurrents répondables automatiquement`, '#f59e0b')] : []),
          ],
        }
      }

      case 'seo':
      case 'consultant-seo': {
        // Audit pas encore lancé → grille vide, seul le bouton s'affiche
        if (!auditData?.pagespeed || auditData?.pagespeed?.timeout) {
          return {
            kpis: [kpi('Meta description', hasMeta ? 'Présente' : 'Absente', hasMeta ? 'good' : 'danger')],
            problems: [...(!hasMeta ? [prob('Meta description absente — invisible sur Google', '#ef4444')] : [])],
          }
        }

        const seoVal = seoScore ?? perfScore
        const lcpNum = psLcp ? parseFloat(psLcp) : null
        const clsNum = psCls ? parseFloat(psCls) : null

        // Helpers statut couleur
        const scoreStatus = (v) => v == null ? 'neutral' : v > 79 ? 'good' : v >= 50 ? 'warn' : 'danger'
        const boolStatus  = (v) => v === true ? 'good' : v === false ? 'danger' : 'neutral'
        const ltStatus    = (s) => { const v = parseFloat(s); return isNaN(v) ? 'neutral' : v < 3 ? 'good' : v <= 7 ? 'warn' : 'danger' }

        const kpis = [
          // Ligne 1
          kpi('Score SEO',        seoVal           != null ? `${seoVal}/100`           : '—', scoreStatus(seoVal)),
          kpi('Perf. mobile',     perfScore        != null ? `${perfScore}/100`        : '—', scoreStatus(perfScore)),
          // Ligne 2
          kpi('Perf. desktop',    psPerformanceDsk != null ? `${psPerformanceDsk}/100` : '—', scoreStatus(psPerformanceDsk)),
          kpi('Chargement',       loadTimeSec               ? `${loadTimeSec}s`         : '—', loadTimeSec ? ltStatus(loadTimeSec) : 'neutral', null, loadTimeSec ? true : null),
          // Ligne 3
          kpi('Meta description', hasMeta  ? 'Présente' : 'Absente', hasMeta  ? 'good' : 'danger'),
          kpi('Balise title',     psTitle === 'Présente' ? 'Présente' : psTitle === 'Absente' ? 'Absente' : '—', psTitle === 'Présente' ? 'good' : psTitle === 'Absente' ? 'danger' : 'neutral'),
          // Ligne 4
          kpi('HTTPS',            psHttps === true ? '✅ Sécurisé' : psHttps === false ? '❌ Non sécurisé' : '—', boolStatus(psHttps)),
          ...(psMobileFriendly !== null ? [kpi('Mobile friendly', psMobileFriendly === true ? '✅ Oui' : '❌ Non', psMobileFriendly ? 'good' : 'danger')] : []),
          // Ligne 5
          kpi('LCP',              psLcp ?? '—', lcpNum != null ? (lcpNum <= 2.5 ? 'good' : lcpNum <= 4 ? 'warn' : 'danger') : 'neutral', lcpNum != null && lcpNum > 10 ? '⚠️ Mesure variable' : null),
          kpi('CLS',              psCls ?? '—', clsNum != null ? (clsNum <= 0.1 ? 'good' : clsNum <= 0.25 ? 'warn' : 'danger') : 'neutral'),
          // Ligne 6
          kpi('Accessibilité',    psAccessibility  != null ? `${psAccessibility}/100`  : '—', scoreStatus(psAccessibility)),
          kpi('Images optimisées',psImagesOpt === true ? '✅ Oui' : psImagesOpt === false ? '❌ Non optimisées' : '—', boolStatus(psImagesOpt)),
          // Ligne 7
          kpi('Res. bloquantes',  psRenderBlocking != null ? (psRenderBlocking === 0 ? '✅ Aucune' : `${psRenderBlocking} détectée${psRenderBlocking > 1 ? 's' : ''}`) : '—', psRenderBlocking != null ? (psRenderBlocking === 0 ? 'good' : psRenderBlocking <= 2 ? 'warn' : 'danger') : 'neutral'),
          kpi('Sitemap',          psSitemap === true ? '✅ Présent' : psSitemap === false ? '❌ Absent' : '—', boolStatus(psSitemap)),
          // Ligne 8
          kpi('robots.txt',       psRobots  === true ? '✅ Présent' : psRobots  === false ? '❌ Absent' : '—', boolStatus(psRobots)),
        ]

        // Problèmes : rouge d'abord, orange ensuite
        const redProbs = [], orangeProbs = []
        if (seoVal != null && seoVal < 80)
          redProbs.push(prob('SEO technique faible — Google a du mal à indexer ce site', '#ef4444'))
        if (perfScore != null && perfScore < 70)
          (perfScore < 50 ? redProbs : orangeProbs).push(prob('Performance mobile insuffisante — pénalité de référencement', perfScore < 50 ? '#ef4444' : '#f59e0b'))
        if (psPerformanceDsk != null && psPerformanceDsk < 70)
          (psPerformanceDsk < 50 ? redProbs : orangeProbs).push(prob('Performance desktop faible — expérience utilisateur dégradée', psPerformanceDsk < 50 ? '#ef4444' : '#f59e0b'))
        if (loadTimeSec && parseFloat(loadTimeSec) >= 3) {
          const lt = parseFloat(loadTimeSec)
          if (lt >= 8)
            redProbs.push(prob(`Site charge en ${loadTimeSec}s — trop lent, pénalité SEO probable`, '#ef4444'))
          else
            orangeProbs.push(prob(`Site charge en ${loadTimeSec}s — peut être optimisé (seuil Google : 3s)`, '#f59e0b'))
        }
        if (lcpNum != null && lcpNum > 2.5)
          (lcpNum > 4 ? redProbs : orangeProbs).push(prob('LCP trop lent — critère Core Web Vitals échoué', lcpNum > 4 ? '#ef4444' : '#f59e0b'))
        if (clsNum != null && clsNum > 0.25)
          redProbs.push(prob('Instabilité visuelle — critère Core Web Vitals échoué', '#ef4444'))
        if (!hasMeta)
          redProbs.push(prob('Meta description absente — invisible sur Google', '#ef4444'))
        if (psTitle === 'Absente')
          redProbs.push(prob('Balise title absente — critère SEO critique', '#ef4444'))
        if (psHttps === false)
          redProbs.push(prob('Site non sécurisé — Google pénalise les sites HTTP', '#ef4444'))
        if (psSitemap === false)
          orangeProbs.push(prob('Sitemap absent — Google indexe moins efficacement', '#f59e0b'))
        if (psRobots === false)
          orangeProbs.push(prob('robots.txt absent — crawl Google non contrôlé', '#f59e0b'))
        if (psImagesOpt === false)
          orangeProbs.push(prob('Images non optimisées — ralentissent le chargement et le SEO', '#f59e0b'))
        if (psRenderBlocking != null && psRenderBlocking > 0)
          orangeProbs.push(prob(`${psRenderBlocking} ressource${psRenderBlocking > 1 ? 's' : ''} bloquante${psRenderBlocking > 1 ? 's' : ''} — retardent l'affichage`, '#f59e0b'))
        if (psAccessibility != null && psAccessibility < 70)
          orangeProbs.push(prob('Accessibilité faible — pénalise le référencement', '#f59e0b'))

        const lr = auditData?.localRank
        if (lr) {
          const rankValue  = lr.found
            ? (lr.topThree ? 'Top 3' : lr.topTen ? 'Top 10' : `Position ${lr.rank}`)
            : 'Hors top 20'
          const rankStatus = lr.found
            ? (lr.topThree ? 'good' : lr.topTen ? 'warn' : 'danger')
            : 'danger'
          kpis.push({ label: 'POSITION LOCALE', value: rankValue, status: rankStatus, note: 'sur Google Maps local' })
        }

        const cmsRaw    = auditData?.pagespeed?.cms
        const CMS_NAMES = { wordpress: 'WordPress', shopify: 'Shopify', webflow: 'Webflow', wix: 'Wix', squarespace: 'Squarespace', jimdo: 'Jimdo' }
        const CMS_BADGES = {
          wordpress:   { text: 'Optimisable', color: '#22c55e' },
          shopify:     { text: 'Optimisable', color: '#22c55e' },
          webflow:     { text: 'Optimisable', color: '#22c55e' },
          wix:         { text: 'Limité',      color: '#f59e0b' },
          squarespace: { text: 'Limité',      color: '#f59e0b' },
          jimdo:       { text: 'Limité',      color: '#f59e0b' },
        }
        if (cmsRaw) kpis.push({ label: 'CMS DÉTECTÉ', value: CMS_NAMES[cmsRaw.cms] ?? 'Non identifié', type: 'cms', cmsBadge: CMS_BADGES[cmsRaw.cms] ?? null })

        if (auditData?.pagespeed) {
          const domainAge   = auditData.pagespeed.domainAge   ?? null
          const indexedData = auditData.pagespeed.indexedPages ?? null
          kpis.push({ label: 'ÂGE DU DOMAINE', type: 'domainAge', domainAge })
          kpis.push({ label: 'PAGES INDEXÉES', type: 'indexedPages', indexedData })
        }

        if (auditData?.napData !== undefined) {
          kpis.push({ label: 'COHÉRENCE NAP', type: 'nap', napData: auditData.napData ?? null })
        }

        return { kpis, problems: [...redProbs, ...orangeProbs] }
      }

      case 'photographe': {
        const photoLabel  = photoCount === 0 ? 'Aucune photo en ligne' : photoCount < 10 ? 'Peu de photos' : 'Photos présentes'
        const photoStatus = photoCount === 0 ? 'danger' : photoCount < 10 ? 'warn' : 'good'
        const vscore      = visualAnalysis?.score ?? null
        const siteLabel   = vscore === null ? 'Non analysé' : vscore < 40 ? 'À moderniser' : vscore <= 70 ? 'Correct' : 'Moderne'
        const siteStatus  = vscore === null ? 'muted' : vscore < 40 ? 'neutral' : vscore <= 70 ? 'warn' : 'good'
        const repStatus   = rating >= 4.5 ? 'good' : rating >= 4.0 ? 'warn' : 'danger'
        const igActivity  = auditData?.instagramActivity
        const igConfirmed = hasInstagram
          || (igActivity?.status === 'active')
          || (igActivity?.status === 'inactive')
        return {
          kpis: [
            kpi('Photos Google',     photoLabel,                                           photoStatus),
            kpi('Instagram',         igConfirmed ? 'Présent' : 'Non présent',              igConfirmed ? 'good' : 'neutral'),
            kpi('Réputation Google', rating ? `${rating} ★ · ${totalReviews} avis` : '—', repStatus),
            kpi('Site web',          siteLabel,                                            siteStatus),
          ],
          reseaux: true,
          problems: [
            ...(photoCount === 0 ? [{ text: 'Aucune photo en ligne — opportunité directe', plain: true }] : []),
            ...(unanswered > 0   ? [{ text: `${unanswered} avis sans réponse`,             plain: true }] : []),
          ],
        }
      }

      case 'videaste': {
        const hasYoutube = !!(lead.social?.youtube)
        const hasVideo   = hasYoutube || hasTiktok
        return {
          kpis: [
            kpi('YouTube',        hasYoutube ? 'Présent' : 'Absent', hasYoutube ? 'good' : 'danger'),
            kpi('TikTok',         hasTiktok  ? 'Présent' : 'Absent', hasTiktok  ? 'good' : 'danger'),
            kpi('Instagram',      hasInstagram ? 'Présent' : 'Absent', hasInstagram ? 'good' : 'neutral'),
            kpi('Contenu vidéo',  hasVideo ? 'Détecté' : 'Aucun',   hasVideo ? 'good' : 'danger'),
          ],
          problems: [
            ...(!hasVideo               ? [prob('Aucun contenu vidéo — le video marketing augmente les conversions de 80%', '#ef4444')] : []),
            ...(!hasYoutube && !hasTiktok ? [prob('YouTube et TikTok absents — canaux vidéo non exploités', '#f59e0b')] : []),
          ],
        }
      }

      case 'social-media': {
        const missingCount = [!hasFacebook, !hasInstagram, !hasLinkedin, !hasTiktok].filter(Boolean).length
        return {
          kpis: [
            kpi('Facebook',  hasFacebook  ? 'Présent' : 'Absent', hasFacebook  ? 'good' : 'danger'),
            kpi('Instagram', hasInstagram ? 'Présent' : 'Absent', hasInstagram ? 'good' : 'danger'),
            kpi('LinkedIn',  hasLinkedin  ? 'Présent' : 'Absent', hasLinkedin  ? 'good' : 'neutral'),
            kpi('TikTok',    hasTiktok    ? 'Présent' : 'Absent', hasTiktok    ? 'good' : 'warn'),
          ],
          problems: [
            ...(!hasFacebook  ? [prob('Facebook absent — opportunité de visibilité manquée', '#ef4444')] : []),
            ...(!hasInstagram ? [prob('Instagram absent — opportunité de visibilité manquée', '#ef4444')] : []),
            ...(!hasTiktok    ? [prob('TikTok absent — canal de croissance non exploité', '#f59e0b')] : []),
            ...(missingCount >= 3 ? [prob(`${missingCount} réseaux manquants sur 4 — présence digitale insuffisante`, '#ef4444')] : []),
          ].slice(0, 3),
        }
      }

      case 'dev-web': {
        const hasBooking = !!(lead.googleAudit?.hasBooking)
        return {
          kpis: [
            kpi('Perf. mobile',       perfScore != null ? `${perfScore}/100` : '—', perfScore != null ? (perfScore >= 70 ? 'good' : 'danger') : 'neutral'),
            kpi('Chargement',         loadTimeSec ? `${loadTimeSec}s` : '—',        loadTimeSec ? (parseFloat(loadTimeSec) <= 3 ? 'good' : 'danger') : 'neutral'),
            kpi('Site web',           hasWebsite ? 'Présent' : 'Absent',              hasWebsite ? 'good' : 'danger'),
            kpi('Réservation en ligne', hasBooking ? 'Oui' : 'Absente',              hasBooking ? 'good' : 'warn'),
          ],
          problems: [
            ...(!hasWebsite                                          ? [prob('Aucun site web — les clients ne peuvent pas vous trouver en ligne', '#ef4444')] : []),
            ...(perfScore != null && perfScore < 70                  ? [prob(`Site charge en ${loadTimeSec || '?'}s — 53% des visiteurs abandonnent`, '#ef4444')] : []),
            ...(loadTimeSec && parseFloat(loadTimeSec) > 3           ? [prob("Expérience mobile mauvaise — clients perdus avant de voir l'offre", '#f59e0b')] : []),
          ],
        }
      }

      case 'copywriter': {
        const hasReplies    = !!(lead.reviewAnalysis?.ownerReplies)
        const hasDescription = !!(lead.googleAudit?.descriptionText)
        const posKeywords   = lead.reviewAnalysis?.positive?.keywords?.length || 0
        return {
          kpis: [
            kpi('Meta description',  hasMeta ? 'Présente' : 'Absente',               hasMeta ? 'good' : 'danger'),
            kpi('Réponses avis',     hasReplies ? 'Personnalisées' : 'Absentes',      hasReplies ? 'good' : 'danger'),
            kpi('Description fiche', hasDescription ? 'Présente' : 'Absente',        hasDescription ? 'good' : 'danger'),
            kpi('Mots-clés positifs', posKeywords > 0 ? posKeywords : '—',         posKeywords > 0 ? 'good' : 'neutral'),
          ],
          problems: [
            ...(!hasReplies     ? [prob("Réponses aux avis absentes — nuit à l'image", '#ef4444')] : []),
            ...(!hasMeta        ? [prob('Aucune meta description — Google affiche un texte aléatoire', '#ef4444')] : []),
            ...(!hasDescription ? [prob('Description fiche Google absente — fiche incomplète', '#f59e0b')] : []),
          ],
        }
      }

      case 'email-marketing': {
        const hasForm      = !!(lead.googleAudit?.hasContactForm)
        const repeatMentions = lead.reviewAnalysis?.loyaltyMentions || 0
        return {
          kpis: [
            kpi('Volume avis',         totalReviews > 0 ? totalReviews : '0',         totalReviews >= 50 ? 'good' : 'warn'),
            kpi('Clients fidèles',     repeatMentions > 0 ? repeatMentions : 'Peu',   repeatMentions > 3 ? 'good' : 'warn'),
            kpi('Activité réseaux',    hasFacebook || hasInstagram ? 'Active' : 'Inactive', hasFacebook || hasInstagram ? 'good' : 'danger'),
            kpi('Formulaire contact',  hasForm ? 'Oui' : 'Absent',                    hasForm ? 'good' : 'danger'),
          ],
          problems: [
            ...(repeatMentions < 3 ? [prob('Peu de clients récurrents mentionnés — programme fidélité manquant', '#f59e0b')] : []),
            ...(!hasForm           ? [prob('Pas de capture email détectée — impossible de relancer les clients', '#ef4444')] : []),
          ],
        }
      }

      case 'pub-google': {
        return {
          kpis: [
            kpi('Perf. mobile', perfScore != null ? `${perfScore}/100` : '—', perfScore != null ? (perfScore >= 70 ? 'good' : 'danger') : 'neutral'),
            kpi('Site web',     hasWebsite ? 'Présent' : 'Absent',              hasWebsite ? 'good' : 'danger'),
            kpi('Note Google',  rating > 0 ? `${rating}/5` : '—',            rating >= 4 ? 'good' : rating >= 3 ? 'warn' : 'danger'),
            kpi('Volume avis',  totalReviews > 0 ? totalReviews : '0',          totalReviews >= 50 ? 'good' : 'warn'),
          ],
          problems: [
            ...(perfScore != null && perfScore < 70  ? [prob('Landing page lente — budget pub gaspillé sur des pages qui ne convertissent pas', '#ef4444')] : []),
            ...(!hasWebsite                          ? [prob('Aucun site pour recevoir les clics publicitaires', '#ef4444')] : []),
            ...(rating > 0 && rating < 4.0           ? [prob('Note insuffisante — les pubs Google perdent en efficacité sous 4 étoiles', '#f59e0b')] : []),
          ],
        }
      }

      case 'designer': {
        const nets    = [hasFacebook, hasInstagram, hasTiktok].filter(Boolean).length
        const coherent = nets >= 2
        return {
          kpis: [
            kpi('Photos Google',     photoCount > 0 ? photoCount : '0',         photoCount >= 5 ? 'good' : 'danger'),
            kpi('Cohérence visuelle', coherent ? 'Bonne' : 'Insuffisante',      coherent ? 'good' : 'danger'),
            kpi('Instagram',         hasInstagram ? 'Présent' : 'Absent',       hasInstagram ? 'good' : 'danger'),
            kpi('Logo / Charte',     hasWebsite ? 'À vérifier' : 'Absent',      hasWebsite ? 'warn' : 'danger'),
          ],
          problems: [
            ...(photoCount < 5  ? [prob('Identité visuelle faible sur Google', '#ef4444')] : []),
            ...(!coherent       ? [prob('Présence visuelle non cohérente entre les plateformes', '#f59e0b')] : []),
            ...(!hasInstagram   ? [prob('Instagram absent — vitrine visuelle manquante', '#ef4444')] : []),
          ],
        }
      }

      default: {
        const missingNets = [!hasFacebook, !hasInstagram, !hasLinkedin, !hasTiktok].filter(Boolean).length
        const problems = []
        if (!hasWebsite)   problems.push(prob('Aucun site web — invisibilité en ligne', '#ef4444'))
        if (unanswered > 0) problems.push(prob(`${unanswered} avis sans réponse`, '#ef4444'))
        if (missingNets >= 3) problems.push(prob(`${missingNets} réseaux sociaux absents sur 4`, '#f59e0b'))
        if (rating > 0 && rating < 4.0) problems.push(prob(`Note ${rating}/5 — en dessous de la moyenne`, '#f59e0b'))
        return {
          kpis: [
            kpi('Note Google',       rating > 0 ? `${rating}/5` : '—',                              rating >= 4 ? 'good' : rating >= 3 ? 'warn' : 'danger'),
            kpi('Volume avis',       totalReviews > 0 ? totalReviews : '0',                            totalReviews >= 50 ? 'good' : 'warn'),
            kpi('Présence digitale', hasWebsite && (hasFacebook || hasInstagram) ? 'Bonne' : hasWebsite ? 'Partielle' : 'Faible', hasWebsite && (hasFacebook || hasInstagram) ? 'good' : hasWebsite ? 'warn' : 'danger'),
            kpi('Score opportunité', `${score}/100`,                                                   score >= 70 ? 'good' : score >= 40 ? 'warn' : 'danger'),
          ],
          problems: problems.slice(0, 3),
        }
      }
    }
  }

  // ── Opportunity bar ──
  const getOpportunityBar = () => {
    const profileId  = activeProfile?.id ?? 'default'
    const social     = lead.social || {}
    const hasWebsite = !!(lead.website && !['null', 'undefined', ''].includes(String(lead.website)))
    const unanswered = lead.reviewAnalysis?.negative?.unanswered || 0
    const hasChatbot = !!(lead.googleAudit?.hasChatbot)
    const photoCount = lead.google?.photos?.length || lead.photoCount || 0
    const hasFacebook = !!social.facebook
    const hasInstagram = !!social.instagram

    const level = score >= 70 ? 'strong' : score >= 40 ? 'medium' : 'weak'

    const textMap = {
      chatbot:         hasChatbot ? 'Chatbot déjà en place — opportunité limitée' : `Pas de chatbot${unanswered > 0 ? ` · ${unanswered} avis sans réponse` : ''} — opportunité forte`,
      seo:             !hasWebsite ? 'Aucun site web — potentiel SEO inexploité' : 'Site présent — référencement organique à optimiser',
      'consultant-seo': !hasWebsite ? 'Aucun site — base SEO à construire' : 'Visibilité organique à développer',
      'social-media':  [!hasFacebook && 'Facebook', !hasInstagram && 'Instagram'].filter(Boolean).join(' & ') + (!hasFacebook || !hasInstagram ? ' absent(s) — audience à conquérir' : ' — Réseaux présents, contenu à optimiser'),
      photographe:     `${photoCount} photo${photoCount > 1 ? 's' : ''} en ligne — contenu visuel insuffisant`,
      videaste:        'Aucun contenu vidéo détecté — levier de conversion non exploité',
      'dev-web':       !hasWebsite ? 'Aucun site — priorité absolue' : 'Site existant — performances à améliorer',
      copywriter:      'Contenu textuel à optimiser — taux de conversion à améliorer',
      'email-marketing': 'Base clients existante — programme fidélisation absent',
      'pub-google':    'Audience locale disponible — publicité Google non configurée',
      designer:        'Identité visuelle à renforcer sur tous les supports',
      default:         score >= 70 ? 'Profil attractif — forte opportunité commerciale' : score >= 40 ? 'Profil moyen — plusieurs points à améliorer' : 'Profil faible — nombreuses opportunités détectées',
    }

    return {
      level,
      text:   textMap[profileId] ?? textMap.default,
      color:  level === 'strong' ? '#22c55e' : level === 'medium' ? '#f59e0b' : '#ef4444',
      bg:     level === 'strong' ? 'rgba(34,197,94,0.06)'    : level === 'medium' ? 'rgba(245,158,11,0.06)'  : 'rgba(239,68,68,0.06)',
      border: level === 'strong' ? 'rgba(34,197,94,0.15)'   : level === 'medium' ? 'rgba(245,158,11,0.15)' : 'rgba(239,68,68,0.15)',
    }
  }

  const profileData = getProfileData()
  const profileName = activeProfile?.name ?? 'Défaut'
  const oppBar      = getOpportunityBar()

  const STATUS_COLOR = { good: '#22c55e', danger: '#ef4444', warn: '#f59e0b', neutral: '#94a3b8', muted: '#475569' }

  return (
    <>
      <style>{`
        .ld-scroll::-webkit-scrollbar { width: 4px; }
        .ld-scroll::-webkit-scrollbar-track { background: #0D1410; }
        .ld-scroll::-webkit-scrollbar-thumb { background: #2d3748; border-radius: 2px; }
        @keyframes ld-slidein { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
        .ld-btn { transition: all 0.15s ease; cursor: pointer; }
        .ld-btn:hover { filter: brightness(1.15); }
        .ld-social-dot:hover { border-color: rgba(29,110,85,0.40) !important; }
      `}</style>

      {/* ── MAIN PANEL ── */}
      <div style={{
        position: 'absolute',
        bottom: 16,
        right: 16,
        width: wide ? 520 : 340,
        height: 'calc(100% - 32px)',
        display: 'flex',
        flexDirection: 'column',
        background: 'rgba(17,24,20,0.96)',
        border: '1px solid rgba(29,110,85,0.35)',
        borderRadius: 16,
        boxShadow: '0px 8px 32px rgba(29,110,85,0.28)',
        animation: 'ld-slidein 0.22s cubic-bezier(0.4,0,0.2,1)',
        transition: 'width 0.25s cubic-bezier(0.4,0,0.2,1)',
        zIndex: 1000,
        overflow: 'hidden',
        fontFamily: 'var(--font-body, system-ui, sans-serif)',
      }}>

        {/* ══ HEADER ══ */}
        <div style={{ padding: 14, flexShrink: 0, background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.08)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>

          {/* Top row: score circle + name/address/tags + buttons */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>

            {/* Score circle */}
            <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'radial-gradient(circle at 40% 35%, #f89e1e, #c97000)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 2px 8px rgba(248,158,30,0.35)' }}>
              <span style={{ fontSize: 16, fontWeight: 700, color: '#edfa36', fontFamily: 'var(--font-body)' }}>{score}</span>
            </div>

            {/* Name + address + tags */}
            <div style={{ flex: 1, minWidth: 0 }}>
              {/* Name + Ouvert/Fermé on same line */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#f5f5f0', lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>
                  {lead.name}
                </span>
                {lead.google?.openNow !== undefined && (
                  <span style={{ fontSize: 9, fontWeight: 600, flexShrink: 0, color: lead.google.openNow ? '#22c55e' : '#ef4444', background: lead.google.openNow ? 'rgba(34,197,94,0.10)' : 'rgba(239,68,68,0.12)', border: `1px solid ${lead.google.openNow ? 'rgba(34,197,94,0.25)' : 'rgba(239,68,68,0.35)'}`, borderRadius: 9, padding: '2px 7px' }}>
                    {lead.google.openNow ? 'Ouvert' : 'Fermé'}
                  </span>
                )}
              </div>
              {/* Address */}
              {lead.address && (
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.38)', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {lead.address}
                </div>
              )}
              {/* Bottom row: profile badge + distance + stars pushed right */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap', marginTop: 6 }}>
                {activeProfile && (
                  <span style={{ fontSize: 11, fontWeight: 600, color: '#1d6e55', background: 'rgba(29,110,85,0.15)', border: '1px solid rgba(29,110,85,0.4)', borderRadius: 9, padding: '5px 12px' }}>
                    {activeProfile.name}
                  </span>
                )}
                {lead.isActiveOwner && (
                  <span style={{ fontSize: 9, fontWeight: 600, color: '#10b981', background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.20)', borderRadius: 9, padding: '2px 7px' }}>Gérant actif ✓</span>
                )}
                {lead.distance > 0 && (
                  <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.38)' }}>
                    {lead.distance >= 1000 ? `${(lead.distance / 1000).toFixed(1)} km` : `${lead.distance} m`}
                  </span>
                )}
                {lead.google?.rating > 0 && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 'auto' }}>
                    <Stars rating={lead.google.rating} size={14} />
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#f1f5f9', fontFamily: 'var(--font-mono)' }}>{lead.google.rating}</span>
                    <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.38)' }}>({lead.google.totalReviews ?? 0})</span>
                  </span>
                )}
              </div>
            </div>

            {/* Utility buttons */}
            <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
              <button className="ld-btn" onClick={() => setWide(w => !w)} style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.5)', borderRadius: 12, width: 24, height: 24, cursor: 'pointer', fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {wide ? '⇥' : '↔'}
              </button>
              <button className="ld-btn" onClick={onClose} style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.5)', borderRadius: 12, width: 24, height: 24, cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                ✕
              </button>
            </div>
          </div>

        </div>

        {/* ══ CRM ACTIONS ══ */}
        <div style={{ display: 'flex', gap: 6, padding: '10px 16px', borderBottom: '1px solid rgba(255,255,255,0.05)', flexShrink: 0, justifyContent: 'center' }}>
          <button className="ld-btn" onClick={handleContact}
            style={{ width: 98, height: 36, borderRadius: 10, border: '1px solid rgba(29,110,85,0.4)', background: 'rgba(29,110,85,0.25)', color: '#1d6e55', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
            {contactedConfirm ? '✓ Contacté !' : 'Contacter'}
          </button>
          <button className="ld-btn" onClick={handleFavorite}
            style={{ width: 98, height: 36, borderRadius: 10, border: '1px solid rgba(237,250,54,0.25)', background: 'rgba(237,250,54,0.1)', color: '#edfa36', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
            {isFavorite ? '★ Favori' : '☆ Favori'}
          </button>
          <button className="ld-btn" onClick={handleIgnore}
            style={{ width: 98, height: 36, borderRadius: 10, border: '1px solid rgba(239,68,68,0.25)', background: 'rgba(239,68,68,0.1)', color: '#ef4444', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
            Ignorer
          </button>
        </div>

        {/* ══ SCROLLABLE CONTENT ══ */}
        <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
        {!isUnlocked && (
          <div style={{
            position: 'absolute', inset: 0, zIndex: 10,
            backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
            background: 'rgba(13,20,16,0.75)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            gap: 14, padding: '24px 20px',
          }}>
            <div style={{ fontSize: 36, lineHeight: 1 }}>🔒</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#f1f5f9', textAlign: 'center', lineHeight: 1.4 }}>
              Débloquez ce lead pour accéder à toutes les données
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center' }}>
              {['📞 Téléphone', '🌐 Site web', 'in LinkedIn', 'fb Facebook', 'ig Instagram', '📊 Score /100'].map(tag => (
                <span key={tag} style={{ fontSize: 11, padding: '3px 8px', borderRadius: 20, background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.4)', fontFamily: 'var(--font-mono)' }}>
                  {tag}
                </span>
              ))}
            </div>
            <button
              onClick={handleUnlock}
              disabled={unlockLoading}
              style={{
                marginTop: 6, padding: '10px 24px', borderRadius: 10, border: 'none', cursor: unlockLoading ? 'wait' : 'pointer',
                background: unlockLoading ? 'rgba(237,250,54,0.5)' : '#edfa36',
                color: '#0d1410', fontSize: 14, fontWeight: 700, fontFamily: 'var(--font-body)',
                display: 'flex', alignItems: 'center', gap: 8,
              }}
            >
              {unlockLoading
                ? <><span style={{ display: 'inline-block', width: 14, height: 14, border: '2px solid #0d1410', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />Déblocage...</>
                : '🔓 Débloquer — 1 crédit'
              }
            </button>
            {unlockError && (
              <div style={{ fontSize: 11, color: '#f87171', textAlign: 'center', maxWidth: 260, lineHeight: 1.4 }}>
                ✗ {unlockError}
              </div>
            )}
          </div>
        )}
        <div ref={scrollRef} className="ld-scroll" style={{ height: '100%', overflowY: 'auto', padding: '14px 16px 80px', scrollbarWidth: 'thin', scrollbarColor: '#2d3748 #0D1410' }}>

          {/* ── CONTACT & PRÉSENCE ── */}
          <div style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, marginBottom: 12, overflow: 'hidden' }}>
            <div style={{ height: 2, background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.14), transparent)' }} />
            <div style={{ padding: '12px 14px' }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '1.2px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.28)', marginBottom: 10 }}>
              Contact &amp; Présence
            </div>

            {/* Phone + Website 2-col */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 8 }}>
              <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, padding: '9px 11px' }}>
                <div style={{ fontSize: 9, color: '#475569', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: 5 }}>Téléphone</div>
                {lead.phone
                  ? <a href={`tel:${lead.phone}`} style={{ fontSize: 11.5, color: '#f1f5f9', textDecoration: 'none', fontFamily: 'var(--font-mono)', lineHeight: 1.3, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
                        <path d="M20.01 15.38c-1.23 0-2.42-.2-3.53-.56a.977.977 0 00-1.01.24l-1.57 1.97c-2.83-1.35-5.48-3.9-6.89-6.83l1.95-1.66c.27-.28.35-.67.24-1.02-.37-1.12-.56-2.3-.56-3.53 0-.54-.45-.99-.99-.99H4.19C3.65 3 3 3.24 3 3.99 3 13.28 10.73 21 20.01 21c.71 0 .99-.63.99-1.18v-3.45c0-.54-.45-.99-.99-.99z" fill="#94a3b8"/>
                      </svg>
                      {lead.phone}
                    </a>
                  : <span style={{ fontSize: 11, color: '#475569' }}>—</span>
                }
              </div>
              <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, padding: '9px 11px' }}>
                <div style={{ fontSize: 9, color: '#475569', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: 5 }}>Site web</div>
                {lead.website && !['null', 'undefined', ''].includes(String(lead.website))
                  ? <a href={lead.website} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: '#f5f5f0', textDecoration: 'none', wordBreak: 'break-all', lineHeight: 1.3, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
                        <circle cx="12" cy="12" r="10" stroke="#94a3b8" strokeWidth="1.5"/>
                        <path d="M2 12h20M12 2c-2.5 3-4 6.5-4 10s1.5 7 4 10M12 2c2.5 3 4 6.5 4 10s-1.5 7-4 10" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round"/>
                      </svg>
                      {lead.website.replace(/^https?:\/\//, '').replace(/\/$/, '').substring(0, 24)}{lead.website.replace(/^https?:\/\//, '').length > 24 ? '…' : ''}
                    </a>
                  : <span style={{ fontSize: 11, color: '#ef4444', fontWeight: 600 }}>Absent</span>
                }
              </div>
            </div>

            {/* Find decision maker */}
            {dmState === 'idle' && (
              <button className="ld-btn" onClick={handleFindDecisionMaker} style={{ width: '100%', height: 34, borderRadius: 8, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 8 }}>
                Trouver le décideur
              </button>
            )}
            {dmState === 'loading' && (
              <div style={{ height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: '#64748b', marginBottom: 8 }}>Recherche en cours…</div>
            )}
            {dmState === 'not_found' && (
              <div style={{ fontSize: 11, color: '#475569', padding: '7px 0', textAlign: 'center', marginBottom: 8 }}>
                Décideur non trouvé —{' '}
                <a href={`https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(lead.name)}`} target="_blank" rel="noreferrer" style={{ color: '#1D6E55', textDecoration: 'none' }}>chercher sur LinkedIn</a>
              </div>
            )}
            {dmState === 'found' && lead.decisionMaker && (() => {
              const dm = lead.decisionMaker
              return (
                <div style={{ background: 'rgba(16,185,129,0.05)', border: '1px solid rgba(16,185,129,0.22)', borderRadius: 9, padding: '10px 13px', display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 8 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#10b981' }}>
                    {dm.name || 'Décideur trouvé'}{dm.title ? ` — ${dm.title}` : ''}
                  </div>
                  {(dm.email || dm.emails?.[0]?.email) && (
                    <div style={{ fontSize: 11.5, color: '#94a3b8', fontFamily: 'var(--font-mono)' }}>
                      {dm.email || dm.emails?.[0]?.email}
                    </div>
                  )}
                  {dm.linkedinUrl && (
                    <a href={dm.linkedinUrl} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: '#0077B5', textDecoration: 'none' }}>Voir sur LinkedIn →</a>
                  )}
                </div>
              )
            })()}

            {/* Social 5-col strip */}
            {(() => {
              const SOCIAL_DEFS = [
                { key: 'facebook',  Icon: FaFacebookF,  size: 11, activeBg: '#1877F2',  activeBorder: 'transparent' },
                { key: 'instagram', Icon: FaInstagram,  size: 11, activeBg: 'linear-gradient(45deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888)', activeBorder: 'transparent' },
                { key: 'linkedin',  Icon: FaLinkedinIn, size: 11, activeBg: '#0A66C2',  activeBorder: 'transparent' },
                { key: 'tiktok',    Icon: FaTiktok,     size: 11, activeBg: '#010101',  activeBorder: 'rgba(255,255,255,0.2)' },
                { key: 'youtube',   Icon: FaYoutube,    size: 11, activeBg: '#FF0000',  activeBorder: 'transparent' },
              ]
              return (
                <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                  {SOCIAL_DEFS.map(({ key, Icon, size, activeBg, activeBorder }) => {
                    const url = lead.social?.[key]
                    const has = !!url
                    return (
                      <a key={key} href={has ? url : undefined} target={has ? '_blank' : undefined} rel={has ? 'noreferrer' : undefined}
                        className="ld-social-dot"
                        style={{
                          width: 26, height: 26, borderRadius: 6, flexShrink: 0,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          background: has ? activeBg : 'rgba(255,255,255,0.06)',
                          border: `1px solid ${has ? activeBorder : 'rgba(255,255,255,0.08)'}`,
                          color: has ? 'white' : 'rgba(255,255,255,0.2)',
                          textDecoration: 'none', cursor: has ? 'pointer' : 'default',
                        }}>
                        <Icon size={size} />
                      </a>
                    )
                  })}
                </div>
              )
            })()}
            </div>{/* /padding */}
          </div>{/* /Contact block */}

          {/* ── DONNÉES CLÉS ── */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '2.5px', textTransform: 'uppercase', color: '#1D6E55', marginBottom: 10, paddingBottom: 6, borderBottom: '1px solid rgba(29,110,85,0.12)' }}>
              Données clés — {profileName}
            </div>

            {/* ── NOUVEAU BUSINESS ── */}
            {lead.newBusinessBadge === 'confirmed' && (
              <div style={{ padding: '6px 14px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                <span style={{
                  fontSize: 11,
                  color: '#f97316',
                  background: 'rgba(249,115,22,0.08)',
                  border: '1px solid rgba(249,115,22,0.20)',
                  borderRadius: 6,
                  padding: '3px 9px',
                }}>
                  Nouveau business (confirmé)
                </span>
              </div>
            )}
            {lead.newBusinessBadge === 'probable' && (
              <div style={{ padding: '6px 14px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                <span style={{
                  fontSize: 11,
                  color: '#94a3b8',
                  background: 'rgba(148,163,184,0.06)',
                  border: '1px solid rgba(148,163,184,0.18)',
                  borderRadius: 6,
                  padding: '3px 9px',
                }}>
                  Potentiel nouveau business
                </span>
              </div>
            )}

            {/* ── DONNÉES CLÉS — photographe: lignes / autres: grille KPI ── */}
            {activeProfile?.id === 'photographe' ? (() => {
              const fmtDays = (d) => {
                if (d === null || d === undefined) return '—'
                if (d === 0)   return "Aujourd'hui"
                if (d < 7)     return `Il y a ${d}j`
                if (d < 30)    return `Il y a ${Math.round(d / 7)} sem.`
                if (d < 365)   return `Il y a ${Math.round(d / 30)} mois`
                return "Il y a + d'un an"
              }
              const dayColor = (d) => d == null ? '#475569' : d < 30 ? '#22c55e' : '#f59e0b'

              const pCount     = lead.googleAudit?.photoCount || 0
              const fbAct      = auditData?.facebookActivity  ?? null
              const igAct      = auditData?.instagramActivity ?? null
              const hasFb      = !!lead.social?.facebook
              const hasIg      = !!lead.social?.instagram || igAct?.status === 'active' || igAct?.status === 'inactive'
              const rating     = lead.google?.rating
              const totalRevs  = lead.google?.totalReviews
              const unanswered = lead.reviewAnalysis?.negative?.unanswered || 0
              const vscore     = visualAnalysis?.score ?? null

              const CARD  = { background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, overflow: 'hidden', marginBottom: 8 }
              const ROW   = (last) => ({ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderBottom: last ? 'none' : '1px solid rgba(255,255,255,0.04)' })
              const LBL   = { fontSize: 11, color: 'rgba(255,255,255,0.9)', display: 'flex', alignItems: 'center', gap: 7 }
              const VAL   = (color) => ({ fontSize: 12, fontWeight: 500, color: color || '#e2e8f0' })
              const BADGE = { fontSize: 10, color: '#475569', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 4, padding: '2px 7px' }
              const BTN   = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', cursor: 'pointer', color: '#1D6E55', fontSize: 12, fontWeight: 500, background: 'transparent', border: 'none', borderTop: '1px solid rgba(255,255,255,0.04)', width: '100%', textAlign: 'left' }

              const VERDICT_COLOR = { 'Professionnelles':'#22c55e','Correctes':'#f59e0b','Amateur':'#ef4444','Génériques':'#ef4444','Mixte':'#f59e0b','Non analysable':'#475569','Aucune photo':'#475569' }
              const obsOrder = { red:0, orange:1, green:2 }
              const obsColor = { red:'#ef4444', orange:'#f59e0b', green:'#22c55e' }

              // ─── Network visual quality helper ─────────────────────────────
              const SEP = '1px solid rgba(255,255,255,0.04)'
              const NV_VERDICT_COLOR = { Professionnel: '#22c55e', Correct: '#f59e0b', Amateur: '#ef4444', Mauvais: '#ef4444' }
              const renderNetVisual = (network, url) => {
                const nv      = netVisual[network]
                const loading = netVisualLoading[network]
                const error   = netVisualError[network]
                if (!url) return null
                if (nv) {
                  const sorted = [...(nv.observations ?? [])].sort((a, b) => (obsOrder[a.level] ?? 3) - (obsOrder[b.level] ?? 3))
                  return (
                    <>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderTop: SEP, borderBottom: sorted.length > 0 ? SEP : 'none' }}>
                        <span style={LBL}>Qualité visuelle</span>
                        <span style={{ fontSize: 12, fontWeight: 700, color: NV_VERDICT_COLOR[nv.verdict] ?? '#64748b' }}>{nv.verdict}{nv.score != null ? ` · ${nv.score}/100` : ''}</span>
                      </div>
                      {sorted.map((obs, idx) => (
                        <div key={idx} style={{ padding: '7px 14px 7px 11px', fontSize: 11, color: '#94a3b8', lineHeight: 1.4, borderLeft: `3px solid ${obsColor[obs.level] ?? '#475569'}`, borderBottom: idx < sorted.length - 1 ? SEP : 'none' }}>{obs.text}</div>
                      ))}
                    </>
                  )
                }
                if (loading) return <div style={{ padding: '10px 14px', fontSize: 12, color: '#64748b', borderTop: SEP }}>Analyse en cours…</div>
                if (error === 'tiktok_restricted') return (
                  <div style={{ padding: '8px 14px', fontSize: 11, color: '#f59e0b', borderTop: SEP }}>
                    Analyse TikTok indisponible — plateforme restreinte{' '}
                    <a href={url} target="_blank" rel="noreferrer" style={{ color: '#1D6E55', textDecoration: 'none' }}>Voir le compte →</a>
                  </div>
                )
                if (error)   return <div style={{ padding: '8px 14px', fontSize: 11, color: '#f59e0b', borderTop: SEP }}>{error}</div>
                return (
                  <button onClick={() => handleNetworkVisual(network, url)} onMouseEnter={e => e.currentTarget.style.background='rgba(29,110,85,0.06)'} onMouseLeave={e => e.currentTarget.style.background='transparent'} style={BTN}>
                    {network === 'instagram' ? 'Qualité des photos' : 'Analyser la qualité visuelle'}
                    <span style={BADGE}>1 crédit</span>
                  </button>
                )
              }

              // ─── Global visual score ───────────────────────────────────────
              const allVisualScores = [
                pCount > 0 && photoQuality?.score != null ? photoQuality.score : null,
                vscore,
                netVisual.instagram?.score ?? null,
                netVisual.facebook?.score  ?? null,
                netVisual.tiktok?.score    ?? null,
                netVisual.pinterest?.score ?? null,
                netVisual.youtube?.score   ?? null,
              ].filter(s => s != null)
              const globalVisualScore   = allVisualScores.length >= 2
                ? Math.round(allVisualScores.reduce((a, b) => a + b, 0) / allVisualScores.length)
                : null
              const globalVisualVerdict = globalVisualScore == null ? null
                : globalVisualScore >= 75 ? 'Excellent'
                : globalVisualScore >= 55 ? 'Correct'
                : globalVisualScore >= 35 ? 'Insuffisant'
                : 'Faible'
              const globalColor = globalVisualScore == null ? '#475569'
                : globalVisualScore >= 70 ? '#22c55e'
                : globalVisualScore >= 45 ? '#f59e0b'
                : '#ef4444'

              return (
                <>
                  {/* Card 1 — Photos Google */}
                  <div style={CARD}>
                    <div style={ROW(pCount === 0 && !photoQuality)}>
                      <span style={LBL}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                        Photos Google
                      </span>
                      <span style={VAL(pCount === 0 ? '#475569' : '#e2e8f0')}>{pCount === 0 ? 'Aucune' : `${pCount} photo${pCount > 1 ? 's' : ''}`}</span>
                    </div>
                    {pCount > 0 && photoQuality && (() => {
                      const vc     = VERDICT_COLOR[photoQuality.verdict] ?? '#64748b'
                      const sorted = [...(photoQuality.observations ?? [])].sort((a, b) => (obsOrder[a.level] ?? 3) - (obsOrder[b.level] ?? 3))
                      return (
                        <>
                          <div style={ROW(sorted.length === 0 && !photoQuality.hasStockPhotos && photoQuality.hasAuthenticPhotos !== false)}>
                            <span style={LBL}>Qualité</span>
                            <span style={{ fontSize: 12, fontWeight: 700, color: vc }}>{photoQuality.verdict}{photoQuality.score != null ? ` · ${photoQuality.score}/100` : ''}</span>
                          </div>
                          {photoQuality.hasStockPhotos === true && (
                            <div style={{ padding: '6px 14px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                              <span style={{ fontSize: 11, color: '#f59e0b', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 6, padding: '3px 9px' }}>Photos de marques détectées</span>
                            </div>
                          )}
                          {photoQuality.hasAuthenticPhotos === false && (
                            <div style={{ padding: '6px 14px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                              <span style={{ fontSize: 11, color: '#ef4444', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 6, padding: '3px 9px' }}>Aucune photo authentique du commerce</span>
                            </div>
                          )}
                          {sorted.map((obs, idx) => (
                            <div key={idx} style={{ padding: '8px 14px 8px 11px', fontSize: 11, color: '#94a3b8', lineHeight: 1.4, borderLeft: `3px solid ${obsColor[obs.level] ?? '#475569'}`, borderBottom: idx < sorted.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>{obs.text}</div>
                          ))}
                        </>
                      )
                    })()}
                    {pCount > 0 && !photoQuality && (
                      photoQualityLoading
                        ? <div style={{ padding: '10px 14px', fontSize: 11, color: '#64748b', borderTop: '1px solid rgba(255,255,255,0.04)' }}>Analyse en cours…</div>
                        : <button onClick={handleAnalyzePhotoQuality} onMouseEnter={e => e.currentTarget.style.background='rgba(29,110,85,0.06)'} onMouseLeave={e => e.currentTarget.style.background='transparent'} style={BTN}>
                            Analyser la qualité des photos
                            <span style={BADGE}>1 crédit</span>
                          </button>
                    )}
                  </div>

                  {/* Card 2 — Facebook */}
                  {(hasFb || (fbAct && fbAct.status !== 'unknown')) && (
                    <div style={CARD}>
                      <div style={ROW(!(fbAct && fbAct.status !== 'unknown'))}>
                        <span style={LBL}>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill={hasFb ? '#1877f2' : '#475569'}><path d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.41c0-3.025 1.792-4.697 4.533-4.697 1.312 0 2.686.236 2.686.236v2.97h-1.513c-1.491 0-1.956.93-1.956 1.886v2.267h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z"/></svg>
                          Facebook
                        </span>
                        <span style={VAL(hasFb ? '#22c55e' : '#475569')}>{hasFb ? 'Présent' : 'Non présent'}</span>
                      </div>
                      {/* Show stats from audit if already loaded, else from on-demand fetch */}
                      {(() => {
                        const src = (fbAct && fbAct.status !== 'unknown') ? fbAct : fbStats
                        if (src) return (
                          <>
                            <div style={ROW(src.lastPostDate == null && src.likes == null)}>
                              <span style={LBL}>Followers</span>
                              <span style={VAL(src.followers != null ? '#e2e8f0' : '#475569')}>{src.followers != null ? src.followers.toLocaleString('fr-FR') : '—'}</span>
                            </div>
                            {src.likes != null && (
                              <div style={ROW(src.lastPostDate == null)}>
                                <span style={LBL}>Likes page</span>
                                <span style={VAL('#e2e8f0')}>{src.likes.toLocaleString('fr-FR')}</span>
                              </div>
                            )}
                            {src.lastPostDate != null && (
                              <div style={ROW(true)}>
                                <span style={LBL}>Dernier post</span>
                                <span style={VAL(dayColor(src.daysAgo))}>{fmtDays(src.daysAgo)}</span>
                              </div>
                            )}
                          </>
                        )
                        if (fbStatsLoading) return <div style={{ padding: '10px 14px', fontSize: 12, color: '#64748b', borderTop: SEP }}>Récupération en cours…</div>
                        if (fbStatsError)   return <div style={{ padding: '8px 14px', fontSize: 11, color: '#f59e0b', borderTop: SEP }}>{fbStatsError}</div>
                        if (hasFb && !fbStats) return (
                          <button onClick={handleFbStats} onMouseEnter={e => e.currentTarget.style.background='rgba(24,119,242,0.06)'} onMouseLeave={e => e.currentTarget.style.background='transparent'} style={BTN}>
                            Stats &amp; activité
                            <span style={BADGE}>1 crédit</span>
                          </button>
                        )
                        return null
                      })()}
                      <div style={{ padding: '8px 14px', fontSize: 11, color: '#475569', fontStyle: 'italic', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                        Analyse visuelle des photos non disponible — politique Meta
                        {hasFb && lead.social?.facebook && (
                          <>{' '}<a href={lead.social.facebook} target="_blank" rel="noreferrer" style={{ color: '#1D6E55', fontStyle: 'normal', textDecoration: 'none' }}>Voir la page →</a></>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Card 3 — Instagram */}
                  <div style={CARD}>
                    <div style={ROW(hasIg && !(igAct && igAct.status !== 'unknown'))}>
                      <span style={LBL}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill={hasIg ? '#E1306C' : '#475569'}><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>
                        Instagram
                      </span>
                      <span style={VAL(hasIg ? '#22c55e' : '#475569')}>{hasIg ? 'Présent' : 'Non présent'}</span>
                    </div>
                    {igAct && igAct.status !== 'unknown' && (
                      <>
                        <div style={ROW(igAct.lastPostDate == null)}>
                          <span style={LBL}>Followers</span>
                          <span style={VAL(igAct.followers != null ? '#e2e8f0' : '#475569')}>{igAct.followers != null ? igAct.followers.toLocaleString('fr-FR') : '—'}</span>
                        </div>
                        {igAct.lastPostDate != null && (
                          <div style={ROW(true)}>
                            <span style={LBL}>Dernier post</span>
                            <span style={VAL(dayColor(igAct.daysAgo))}>{fmtDays(igAct.daysAgo)}</span>
                          </div>
                        )}
                      </>
                    )}
                    {!hasIg && !(igAct && igAct.status !== 'unknown') && (
                      <div style={{ padding: '8px 14px', fontSize: 11, color: '#334155', fontStyle: 'italic', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                        Secteur très visuel — opportunité directe
                      </div>
                    )}
                    {/* Deep analysis button — only if IG present and not yet analysed */}
                    {hasIg && !igDeep && !igDeepLoading && !igDeepError && (
                      <button
                        onClick={handleInstagramDeep}
                        onMouseEnter={e => e.currentTarget.style.background='rgba(225,48,108,0.06)'}
                        onMouseLeave={e => e.currentTarget.style.background='transparent'}
                        style={{ ...BTN, borderTop: '1px solid rgba(255,255,255,0.04)' }}
                      >
                        Stats &amp; activité
                        <span style={BADGE}>1 crédit</span>
                      </button>
                    )}
                    {igDeepLoading && (
                      <div style={{ padding: '10px 14px', fontSize: 12, color: '#64748b', borderTop: '1px solid rgba(255,255,255,0.04)' }}>Analyse en cours…</div>
                    )}
                    {igDeepError && (
                      <div style={{ padding: '8px 14px', fontSize: 11, color: '#ef4444', borderTop: '1px solid rgba(255,255,255,0.04)' }}>{igDeepError}</div>
                    )}
                    {igDeep && (
                      <>
                        <div style={ROW(false)}>
                          <span style={LBL}>Publications analysées</span>
                          <span style={VAL('#e2e8f0')}>{igDeep.postCount}</span>
                        </div>
                        <div style={ROW(false)}>
                          <span style={LBL}>Likes moyens / post</span>
                          <span style={VAL(igDeep.avgLikes >= 50 ? '#22c55e' : igDeep.avgLikes >= 10 ? '#f59e0b' : '#94a3b8')}>{igDeep.avgLikes ?? '—'}</span>
                        </div>
                        <div style={ROW(false)}>
                          <span style={LBL}>Commentaires moyens</span>
                          <span style={VAL('#e2e8f0')}>{igDeep.avgComments ?? '—'}</span>
                        </div>
                        {igDeep.postsPerMonth != null && (
                          <div style={ROW(false)}>
                            <span style={LBL}>Posts / mois</span>
                            <span style={VAL(igDeep.postsPerMonth >= 4 ? '#22c55e' : igDeep.postsPerMonth >= 1 ? '#f59e0b' : '#ef4444')}>{igDeep.postsPerMonth}</span>
                          </div>
                        )}
                        {igDeep.lastPostDate && (
                          <div style={ROW(igDeep.topHashtags?.length === 0)}>
                            <span style={LBL}>Dernier post</span>
                            <span style={VAL('#e2e8f0')}>{igDeep.lastPostDate}</span>
                          </div>
                        )}
                        {igDeep.topHashtags?.length > 0 && (
                          <div style={{ padding: '8px 14px', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                            <div style={{ fontSize: 9, color: '#475569', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: 5 }}>Hashtags fréquents</div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                              {igDeep.topHashtags.map(tag => (
                                <span key={tag} style={{ fontSize: 10, color: '#94a3b8', background: 'rgba(255,255,255,0.04)', borderRadius: 4, padding: '2px 6px' }}>{tag}</span>
                              ))}
                            </div>
                          </div>
                        )}
                      </>
                    )}
                    {renderNetVisual('instagram', lead.social?.instagram)}
                  </div>

                  {/* Card 3b — TikTok */}
                  {lead.social?.tiktok && (
                    <div style={CARD}>
                      <div style={ROW(false)}>
                        <span style={LBL}>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="#fe2c55"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.27 6.27 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.34-6.34V9.01a8.16 8.16 0 0 0 4.77 1.52V7.07a4.85 4.85 0 0 1-1.01-.38z"/></svg>
                          TikTok
                        </span>
                        <span style={VAL('#22c55e')}>Présent</span>
                      </div>
                      {/* TikTok on-demand stats */}
                      {tkStats && (
                        <>
                          <div style={ROW(tkStats.videoCount == null && tkStats.heartCount == null)}>
                            <span style={LBL}>Followers</span>
                            <span style={VAL(tkStats.followers != null ? '#e2e8f0' : '#475569')}>{tkStats.followers != null ? tkStats.followers.toLocaleString('fr-FR') : '—'}</span>
                          </div>
                          {tkStats.videoCount != null && (
                            <div style={ROW(tkStats.heartCount == null)}>
                              <span style={LBL}>Vidéos publiées</span>
                              <span style={VAL('#e2e8f0')}>{tkStats.videoCount.toLocaleString('fr-FR')}</span>
                            </div>
                          )}
                          {tkStats.heartCount != null && (
                            <div style={ROW(true)}>
                              <span style={LBL}>Likes totaux</span>
                              <span style={VAL('#e2e8f0')}>{tkStats.heartCount.toLocaleString('fr-FR')}</span>
                            </div>
                          )}
                        </>
                      )}
                      {tkStatsLoading && <div style={{ padding: '10px 14px', fontSize: 12, color: '#64748b', borderTop: SEP }}>Récupération en cours…</div>}
                      {tkStatsError   && (
                        <div style={{ padding: '8px 14px', fontSize: 11, color: '#f59e0b', borderTop: SEP }}>
                          {tkStatsError}{' '}
                          <a href={lead.social.tiktok} target="_blank" rel="noreferrer" style={{ color: '#1D6E55', fontStyle: 'normal', textDecoration: 'none' }}>Voir le compte TikTok →</a>
                        </div>
                      )}
                      {!tkStats && !tkStatsLoading && !tkStatsError && (
                        <button onClick={handleTkStats} onMouseEnter={e => e.currentTarget.style.background='rgba(254,44,85,0.06)'} onMouseLeave={e => e.currentTarget.style.background='transparent'} style={BTN}>
                          Stats &amp; activité
                          <span style={{ ...BADGE, background: 'rgba(34,197,94,0.15)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.3)' }}>gratuit</span>
                        </button>
                      )}
                      {renderNetVisual('tiktok', lead.social.tiktok)}
                    </div>
                  )}

                  {/* Card 3c — Pinterest */}
                  {lead.social?.pinterest && (
                    <div style={CARD}>
                      <div style={ROW(false)}>
                        <span style={LBL}>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="#E60023"><path d="M12 0C5.373 0 0 5.373 0 12c0 5.084 3.163 9.426 7.627 11.174-.105-.949-.2-2.405.042-3.441.218-.937 1.407-5.965 1.407-5.965s-.359-.719-.359-1.782c0-1.668.967-2.914 2.171-2.914 1.023 0 1.518.769 1.518 1.69 0 1.029-.655 2.568-.994 3.995-.283 1.194.599 2.169 1.777 2.169 2.133 0 3.772-2.249 3.772-5.495 0-2.873-2.064-4.882-5.012-4.882-3.414 0-5.418 2.561-5.418 5.207 0 1.031.397 2.138.893 2.738a.36.36 0 0 1 .083.345l-.333 1.36c-.053.22-.174.267-.402.161-1.499-.698-2.436-2.889-2.436-4.649 0-3.785 2.75-7.262 7.929-7.262 4.163 0 7.398 2.967 7.398 6.931 0 4.136-2.607 7.464-6.227 7.464-1.216 0-2.359-.632-2.75-1.378l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146C9.57 23.812 10.763 24 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0z"/></svg>
                          Pinterest
                        </span>
                        <span style={VAL('#22c55e')}>Présent</span>
                      </div>
                      <div style={{ padding: '8px 14px', fontSize: 11, color: '#475569', fontStyle: 'italic', borderTop: SEP }}>
                        Analyse visuelle non disponible — plateforme restreinte{' '}
                        <a href={lead.social.pinterest} target="_blank" rel="noreferrer" style={{ color: '#1D6E55', fontStyle: 'normal', textDecoration: 'none' }}>Voir le compte →</a>
                      </div>
                    </div>
                  )}

                  {/* Card 3d — YouTube */}
                  {lead.social?.youtube && (
                    <div style={CARD}>
                      <div style={ROW(false)}>
                        <span style={LBL}>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="#FF0000"><path d="M23.495 6.205a3.007 3.007 0 0 0-2.088-2.088c-1.87-.501-9.396-.501-9.396-.501s-7.507-.01-9.396.501A3.007 3.007 0 0 0 .527 6.205a31.247 31.247 0 0 0-.522 5.805 31.247 31.247 0 0 0 .522 5.783 3.007 3.007 0 0 0 2.088 2.088c1.868.502 9.396.502 9.396.502s7.506 0 9.396-.502a3.007 3.007 0 0 0 2.088-2.088 31.247 31.247 0 0 0 .5-5.783 31.247 31.247 0 0 0-.5-5.805zM9.609 15.601V8.408l6.264 3.602z"/></svg>
                          YouTube
                        </span>
                        <span style={VAL('#22c55e')}>Présent</span>
                      </div>
                      <div style={{ padding: '8px 14px', fontSize: 11, color: '#475569', fontStyle: 'italic', borderTop: SEP }}>
                        Analyse visuelle non disponible — plateforme restreinte{' '}
                        <a href={lead.social.youtube} target="_blank" rel="noreferrer" style={{ color: '#1D6E55', fontStyle: 'normal', textDecoration: 'none' }}>Voir le compte →</a>
                      </div>
                    </div>
                  )}

                  {/* Card 4 — Réputation */}
                  <div style={CARD}>
                    <div style={ROW(false)}>
                      <span style={LBL}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="#f59e0b"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                        Note Google
                      </span>
                      <span style={VAL(rating >= 4.5 ? '#22c55e' : rating >= 4 ? '#f59e0b' : '#ef4444')}>
                        {rating ? `${rating} ★ · ${totalRevs} avis` : '—'}
                      </span>
                    </div>
                    <div style={ROW(true)}>
                      <span style={LBL}>Avis sans réponse</span>
                      <span style={VAL(unanswered > 0 ? '#f59e0b' : '#e2e8f0')}>{unanswered}</span>
                    </div>
                  </div>

                  {/* Card 6 — Analyser les performances digitales */}
                  {(lead.website || lead.social?.facebook || lead.social?.instagram) && auditState !== 'done' && (
                    <div style={CARD}>
                      {auditState === 'idle' && (
                        <button onClick={handleAnalyzePerformance} onMouseEnter={e => e.currentTarget.style.background='rgba(29,110,85,0.06)'} onMouseLeave={e => e.currentTarget.style.background='transparent'} style={{ ...BTN, borderTop: 'none' }}>
                          Analyser les performances digitales
                          <span style={BADGE}>1 crédit</span>
                        </button>
                      )}
                      {auditState === 'loading' && (
                        <div style={{ padding: '10px 14px', fontSize: 12, color: '#64748b' }}>Audit en cours…</div>
                      )}
                    </div>
                  )}

                  {/* Score visuel global — visible si 2+ sources analysées */}
                  {globalVisualScore != null && (
                    <div style={{ ...CARD, marginTop: 4 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', borderBottom: SEP }}>
                        <span style={{ ...LBL, gap: 6 }}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="#1D6E55"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                          Score visuel global
                        </span>
                        <span style={{ fontSize: 13, fontWeight: 700, color: globalColor }}>{globalVisualScore}/100</span>
                      </div>
                      <div style={{ padding: '8px 14px' }}>
                        <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 3, height: 4, overflow: 'hidden', marginBottom: 6 }}>
                          <div style={{ width: `${globalVisualScore}%`, height: '100%', background: globalColor, borderRadius: 3, transition: 'width 0.65s cubic-bezier(0.4,0,0.2,1)', boxShadow: `0 0 6px ${globalColor}55` }} />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: 11, color: globalColor, fontWeight: 500 }}>{globalVisualVerdict}</span>
                          <span style={{ fontSize: 10, color: '#475569' }}>{allVisualScores.length} source{allVisualScores.length > 1 ? 's' : ''} analysée{allVisualScores.length > 1 ? 's' : ''}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Problems list — photographe */}
                  {profileData.problems.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginTop: 4 }}>
                      {profileData.problems.map((p, i) => (
                        <div key={i} style={{ borderLeft: '2px solid #475569', borderRadius: '0 6px 6px 0', padding: '8px 12px', fontSize: 12, color: '#94a3b8', lineHeight: 1.45 }}>{p.text}</div>
                      ))}
                    </div>
                  )}
                </>
              )
            })() : (
              <>
                {/* 2×2 KPI grid — autres profils */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 10 }}>
                  {profileData.kpis.map((kpi, i) => {
                    if (kpi.type === 'reseaux_visuels') {
                      const nets = [
                        { label: 'Facebook',  val: lead.social?.facebook,  icon: (c) => <svg width="15" height="15" viewBox="0 0 24 24" fill={c}><path d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.41c0-3.025 1.792-4.697 4.533-4.697 1.312 0 2.686.236 2.686.236v2.97h-1.513c-1.491 0-1.956.93-1.956 1.886v2.267h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z"/></svg>, activeColor: '#1877f2' },
                        { label: 'Instagram', val: lead.social?.instagram, icon: (c) => <svg width="15" height="15" viewBox="0 0 24 24" fill={c}><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>, activeColor: '#E1306C' },
                      ]
                      return (
                        <div key={i} style={{ gridColumn: '1 / -1', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: '12px 14px' }}>
                          <div style={{ fontSize: 9, color: '#475569', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: 8 }}>Réseaux visuels</div>
                          {nets.map(({ label, val, icon, activeColor }, ni) => (
                            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: ni === 0 ? 0 : 7, paddingBottom: ni === nets.length - 1 ? 0 : 7, borderBottom: ni < nets.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none' }}>
                              <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#94a3b8' }}>{icon(val ? activeColor : '#475569')}{label}</span>
                              <span style={{ fontSize: 11.5, fontWeight: 500, color: val ? '#22c55e' : '#475569' }}>{val ? 'Présent' : 'Non présent'}</span>
                            </div>
                          ))}
                        </div>
                      )
                    }
                    if (kpi.type === 'cms') {
                      return (
                        <div key={i} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, padding: '10px 12px' }}>
                          <div style={{ fontSize: 9, color: '#f5f5f0', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: 6 }}>{kpi.label}</div>
                          <div style={{ fontSize: 16, fontWeight: 700, color: '#e2e8f0', lineHeight: 1.1 }}>{kpi.value}</div>
                          {kpi.cmsBadge && <div style={{ marginTop: 5, display: 'inline-block', fontSize: 9.5, fontWeight: 700, color: kpi.cmsBadge.color, background: `${kpi.cmsBadge.color}18`, border: `1px solid ${kpi.cmsBadge.color}40`, borderRadius: 4, padding: '2px 7px', letterSpacing: '0.5px' }}>{kpi.cmsBadge.text}</div>}
                        </div>
                      )
                    }
                    if (kpi.type === 'domainAge') {
                      const da = kpi.domainAge
                      const color = !da ? '#475569' : da.ageYears >= 5 ? '#22c55e' : da.ageYears >= 2 ? '#f59e0b' : '#ef4444'
                      const note  = !da ? null : da.ageYears >= 5 ? 'Domaine établi' : da.ageYears >= 2 ? 'Domaine récent' : 'Très récent'
                      return (
                        <div key={i} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, padding: '10px 12px' }}>
                          <div style={{ fontSize: 9, color: '#f5f5f0', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: 6 }}>{kpi.label}</div>
                          {da
                            ? <div style={{ fontSize: 16, fontWeight: 700, color, lineHeight: 1.1 }}>{da.ageLabel}</div>
                            : <div style={{ fontSize: 13, color: '#475569', fontStyle: 'italic' }}>Non disponible</div>
                          }
                          {note && <div style={{ fontSize: 8.5, color, marginTop: 4, lineHeight: 1.35 }}>{note}</div>}
                        </div>
                      )
                    }
                    if (kpi.type === 'indexedPages') {
                      const ip    = kpi.indexedData
                      const color = !ip ? '#475569' : ip.signal === 'good' ? '#22c55e' : ip.signal === 'weak' ? '#f59e0b' : '#ef4444'
                      const note  = !ip ? null : ip.signal === 'good' ? 'Bon volume de contenu' : ip.signal === 'weak' ? 'Contenu insuffisant' : 'Site quasi invisible'
                      return (
                        <div key={i} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, padding: '10px 12px' }}>
                          <div style={{ fontSize: 9, color: '#f5f5f0', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: 6 }}>{kpi.label}</div>
                          {ip
                            ? <div style={{ fontSize: 16, fontWeight: 700, color, lineHeight: 1.1 }}>{ip.label}</div>
                            : <div style={{ fontSize: 13, color: '#475569', fontStyle: 'italic' }}>Non disponible</div>
                          }
                          {note && <div style={{ fontSize: 8.5, color, marginTop: 4, lineHeight: 1.35 }}>{note}</div>}
                        </div>
                      )
                    }
                    if (kpi.type === 'nap') {
                      const nap   = kpi.napData
                      const color = !nap ? '#475569'
                        : nap.napScore === 'consistent'   ? '#22c55e'
                        : nap.napScore === 'inconsistent' ? '#f59e0b'
                        : '#ef4444'
                      const label = !nap ? 'Non vérifié'
                        : nap.napScore === 'consistent'   ? 'Cohérent'
                        : nap.napScore === 'inconsistent' ? 'Incohérent'
                        : 'Non trouvé'
                      const note  = !nap ? null
                        : nap.napScore === 'consistent'   ? 'Fiche PagesJaunes identique'
                        : nap.napScore === 'inconsistent' ? `${nap.issues?.length ?? 1} différence(s) détectée(s)`
                        : 'Commerce absent de PagesJaunes'
                      return (
                        <div key={i} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, padding: '10px 12px', gridColumn: nap?.found && nap?.issues?.length > 0 ? '1 / -1' : undefined }}>
                          <div style={{ fontSize: 9, color: '#f5f5f0', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: 6 }}>{kpi.label}</div>
                          {nap
                            ? <div style={{ fontSize: 16, fontWeight: 700, color, lineHeight: 1.1 }}>{label}</div>
                            : <div style={{ fontSize: 13, color: '#475569', fontStyle: 'italic' }}>Non vérifié</div>
                          }
                          {note && <div style={{ fontSize: 8.5, color, marginTop: 4, lineHeight: 1.35 }}>{note}</div>}
                          {nap?.found && (
                            <div style={{ marginTop: 7, paddingTop: 7, borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column', gap: 3 }}>
                              {nap.pjName    && <div style={{ fontSize: 10, color: '#64748b' }}>Nom : <span style={{ color: '#94a3b8' }}>{nap.pjName}</span></div>}
                              {nap.pjAddress && <div style={{ fontSize: 10, color: '#64748b' }}>Adresse : <span style={{ color: '#94a3b8' }}>{nap.pjAddress}</span></div>}
                              {nap.pjPhone   && <div style={{ fontSize: 10, color: '#64748b' }}>Tél : <span style={{ color: '#94a3b8' }}>{nap.pjPhone}</span></div>}
                            </div>
                          )}
                          {nap?.issues?.length > 0 && (
                            <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 2 }}>
                              {nap.issues.map((issue, ii) => (
                                <div key={ii} style={{ fontSize: 9.5, color: '#f59e0b', lineHeight: 1.5 }}>• {issue}</div>
                              ))}
                            </div>
                          )}
                        </div>
                      )
                    }
                    if (kpi.type === 'booking_url') {
                      return (
                        <div key={i} style={{ background: 'rgba(249,115,22,0.06)', border: '1px solid rgba(249,115,22,0.30)', borderRadius: 8, padding: '10px 12px' }}>
                          <div style={{ fontSize: 9, color: '#f97316', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: 6 }}>{kpi.label}</div>
                          <div style={{ fontSize: 16, fontWeight: 700, color: '#f97316', lineHeight: 1.1 }}>{kpi.platform}</div>
                          <div style={{ fontSize: 8.5, color: '#f97316', marginTop: 4, lineHeight: 1.35 }}>Angle complémentaire — ne pas proposer la réservation</div>
                        </div>
                      )
                    }
                    if (kpi.type === 'chatbot_detect') {
                      const color = kpi.detected ? '#f59e0b' : '#22c55e'
                      const label = kpi.detected ? (kpi.tool ? kpi.tool : 'Oui') : 'Aucun'
                      const note  = kpi.detected ? 'Angle différentiel requis' : 'Opportunité directe'
                      return (
                        <div key={i} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, padding: '10px 12px' }}>
                          <div style={{ fontSize: 9, color: '#f5f5f0', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: 6 }}>{kpi.label}</div>
                          <div style={{ fontSize: 16, fontWeight: 700, color, lineHeight: 1.1 }}>{label}</div>
                          <div style={{ fontSize: 8.5, color, marginTop: 4, lineHeight: 1.35 }}>{note}</div>
                        </div>
                      )
                    }
                    if (kpi.type === 'booking_platform') {
                      const color = kpi.platform ? '#a78bfa' : '#475569'
                      return (
                        <div key={i} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, padding: '10px 12px' }}>
                          <div style={{ fontSize: 9, color: '#f5f5f0', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: 6 }}>{kpi.label}</div>
                          {kpi.platform
                            ? <div style={{ fontSize: 16, fontWeight: 700, color, lineHeight: 1.1 }}>{kpi.platform}</div>
                            : <div style={{ fontSize: 13, color: '#475569', fontStyle: 'italic' }}>Aucune</div>
                          }
                          {kpi.platform && <div style={{ fontSize: 8.5, color, marginTop: 4, lineHeight: 1.35 }}>Complément FAQ possible</div>}
                        </div>
                      )
                    }
                    if (kpi.type === 'faq_detect') {
                      const color = kpi.detected ? '#22c55e' : '#475569'
                      return (
                        <div key={i} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, padding: '10px 12px' }}>
                          <div style={{ fontSize: 9, color: '#f5f5f0', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: 6 }}>{kpi.label}</div>
                          <div style={{ fontSize: 16, fontWeight: 700, color, lineHeight: 1.1 }}>{kpi.detected ? 'Oui' : 'Non'}</div>
                          {kpi.detected && <div style={{ fontSize: 8.5, color, marginTop: 4, lineHeight: 1.35 }}>Base de contenu disponible</div>}
                        </div>
                      )
                    }
                    if (kpi.type === 'form_detect') {
                      const color = kpi.detected ? '#22c55e' : '#475569'
                      return (
                        <div key={i} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, padding: '10px 12px' }}>
                          <div style={{ fontSize: 9, color: '#f5f5f0', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: 6 }}>{kpi.label}</div>
                          <div style={{ fontSize: 16, fontWeight: 700, color, lineHeight: 1.1 }}>{kpi.detected ? 'Présent' : 'Absent'}</div>
                          {kpi.detected && <div style={{ fontSize: 8.5, color, marginTop: 4, lineHeight: 1.35 }}>Remplacement ou complément chatbot</div>}
                        </div>
                      )
                    }
                    if (kpi.type === 'sensitive') {
                      const color = kpi.detected ? '#f97316' : '#22c55e'
                      return (
                        <div key={i} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, padding: '10px 12px' }}>
                          <div style={{ fontSize: 9, color: '#f5f5f0', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: 6 }}>{kpi.label}</div>
                          <div style={{ fontSize: 16, fontWeight: 700, color, lineHeight: 1.1 }}>{kpi.detected ? 'Oui' : 'Non'}</div>
                          {kpi.detected && <div style={{ fontSize: 8.5, color, marginTop: 4, lineHeight: 1.35 }}>Serveur local recommandé</div>}
                        </div>
                      )
                    }
                    return (
                      <div key={i} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, padding: '10px 12px' }}>
                        <div style={{ fontSize: 9, color: '#f5f5f0', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: 6 }}>{kpi.label}</div>
                        <div style={{ fontSize: 16, fontWeight: 700, color: STATUS_COLOR[kpi.status] || '#64748b', lineHeight: 1.1 }}>{kpi.value}</div>
                        {kpi.note && <div style={{ fontSize: 8.5, color: '#f59e0b', marginTop: 4, lineHeight: 1.35 }}>{kpi.note}</div>}
                        {kpi.tooltip && (
                          <div style={{ position: 'relative', display: 'inline-block', marginTop: 4 }}>
                            <span onMouseEnter={() => setShowTooltip(true)} onMouseLeave={() => setShowTooltip(false)} style={{ fontSize: 12, color: '#6b7280', cursor: 'default', borderBottom: '1px dotted #6b7280' }}>ⓘ</span>
                            {showTooltip && (
                              <div style={{ position: 'absolute', bottom: '120%', left: '50%', transform: 'translateX(-50%)', background: '#1e1e2e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: '#94a3b8', whiteSpace: 'nowrap', zIndex: 100, boxShadow: '0 4px 12px rgba(0,0,0,0.4)', lineHeight: 1.5 }}>
                                Temps mesuré en conditions réseau réelles.<br/>Peut varier selon la connexion du visiteur.
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>

                {/* Compact perf-audit — SEO / dev-web / pub-google / chatbot */}
                {['seo', 'consultant-seo', 'dev-web', 'pub-google', 'chatbot', 'dev-chatbot'].includes(activeProfile?.id) && (lead.website || lead.social?.facebook || lead.social?.instagram) && (() => {
                  const isChatbotProfile = ['chatbot', 'dev-chatbot'].includes(activeProfile?.id)
                  if (auditState === 'idle' && !lead.website)
                    return <div style={{ fontSize: 11, color: '#475569', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 6, padding: '7px 12px', marginBottom: 10, textAlign: 'center' }}>{isChatbotProfile ? 'Pas de site web — analyse impossible' : 'Pas de site web — audit SEO impossible'}</div>
                  if (auditState === 'idle')
                    return <button className="ld-btn" onClick={handleAnalyzePerformance} style={{ width: '100%', height: 28, borderRadius: 6, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.02)', color: '#64748b', fontSize: 10.5, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, marginBottom: 10 }}>{isChatbotProfile ? 'Analyser le site — détection chatbot' : 'Analyser les performances — 1 crédit'}</button>
                  if (auditState === 'loading')
                    return <div style={{ height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10.5, color: '#64748b', marginBottom: 10 }}>Analyse en cours…</div>
                  if (auditState === 'done' && auditData?.pagespeed?.timeout)
                    return (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 10.5, color: '#f59e0b', padding: '4px 0 10px' }}>
                        <span>⏱ Analyse expirée — site trop lent à répondre</span>
                        <button className="ld-btn" onClick={handleAnalyzePerformance} style={{ fontSize: 10, color: '#EDFA36', background: 'none', border: '1px solid rgba(29,110,85,0.25)', borderRadius: 5, padding: '2px 8px', cursor: 'pointer', flexShrink: 0, marginLeft: 8 }}>Réessayer</button>
                      </div>
                    )
                  if (auditState === 'error' || (auditState === 'done' && !auditData?.pagespeed))
                    return <div style={{ fontSize: 10.5, color: '#f59e0b', padding: '4px 0 10px', textAlign: 'center' }}>⚠ Analyse indisponible pour ce site</div>
                  return null
                })()}

                {/* Problems list — autres profils */}
                {profileData.problems.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                    {profileData.problems.map((p, i) => (
                      p.plain
                        ? <div key={i} style={{ borderLeft: '2px solid #475569', borderRadius: '0 6px 6px 0', padding: '8px 12px', fontSize: 12, color: '#94a3b8', lineHeight: 1.45 }}>{p.text}</div>
                        : <div key={i} style={{ borderLeft: `3px solid ${p.color}`, borderRadius: '0 6px 6px 0', padding: '6px 11px', background: `${p.color}0D`, fontSize: 11.5, color: '#cbd5e1', lineHeight: 1.45 }}>{p.text}</div>
                    ))}
                  </div>
                )}
              </>
            )}

            {/* ── BLOC CrUX — données réelles utilisateurs ── */}
            {['seo', 'consultant-seo'].includes(activeProfile?.id) && auditState === 'done' && (() => {
              const crux = auditData?.pagespeed?.crux
              const cruxColor = (val, good, warn) =>
                val == null ? '#64748b' : val <= good ? '#22c55e' : val <= warn ? '#f59e0b' : '#ef4444'
              const fmtMs  = (v) => v == null ? '—' : v >= 1000 ? `${(v / 1000).toFixed(1)}s` : `${Math.round(v)}ms`
              const fmtCls = (v) => v == null ? '—' : v.toFixed(3)

              if (!crux) return (
                <div style={{ marginTop: 12, background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)', borderLeft: '3px solid #f59e0b', borderRadius: '0 10px 10px 0', padding: '12px 14px', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <span style={{ fontSize: 15, flexShrink: 0, marginTop: 1 }}>⚠️</span>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#f59e0b', marginBottom: 4 }}>Données utilisateurs réelles non disponibles</div>
                    <div style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.6, marginBottom: 6 }}>
                      Ce site ne génère pas encore assez de trafic Chrome pour alimenter le rapport CrUX de Google.
                    </div>
                    <div style={{ fontSize: 11, color: '#64748b', lineHeight: 1.6 }}>
                      Les indicateurs ci-dessus sont issus d'un audit Lighthouse (simulation). Les données réelles apparaîtront automatiquement quand le trafic du site sera suffisant.
                    </div>
                  </div>
                </div>
              )

              const rows = [
                { label: 'LCP réel',  val: crux.lcp_real,  fmt: fmtMs,  color: cruxColor(crux.lcp_real,  2500, 4000) },
                { label: 'FCP réel',  val: crux.fcp_real,  fmt: fmtMs,  color: cruxColor(crux.fcp_real,  1800, 3000) },
                { label: 'CLS réel',  val: crux.cls_real,  fmt: fmtCls, color: cruxColor(crux.cls_real,  0.1,  0.25) },
                { label: 'INP réel',  val: crux.inp_real,  fmt: fmtMs,  color: cruxColor(crux.inp_real,  200,  500)  },
                { label: 'TTFB réel', val: crux.ttfb_real, fmt: fmtMs,  color: cruxColor(crux.ttfb_real, 800,  1800) },
                { label: 'FID réel',  val: crux.fid_real,  fmt: fmtMs,  color: cruxColor(crux.fid_real,  100,  300)  },
              ]

              return (
                <div style={{ marginTop: 12, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(29,110,85,0.12)', borderRadius: 8, overflow: 'hidden' }}>
                  <div style={{ padding: '7px 11px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase', color: '#1D6E55' }}>Performances réelles — vécues par vos clients</span>
                    <span style={{ fontSize: 8.5, color: '#334155', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 4, padding: '2px 6px' }}>Source : Chrome UX Report</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0 }}>
                    {rows.map(({ label, val, fmt, color }, i) => (
                      <div key={i} style={{ padding: '7px 11px', borderBottom: i < rows.length - 2 ? '1px solid rgba(255,255,255,0.04)' : 'none', borderRight: i % 2 === 0 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                        <div style={{ fontSize: 9, color: '#475569', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: 3 }}>{label}</div>
                        <div style={{ fontSize: 13, fontWeight: 700, color, fontFamily: 'var(--font-mono)' }}>{fmt(val)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })()}

            {/* ── BLOC SEMRUSH ── SEO seulement, à la demande */}
            {['seo', 'consultant-seo'].includes(activeProfile?.id) && lead.website && (() => {
              const domain = lead.website.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '').toLowerCase().trim()

              if (semrushLoading)
                return <div style={{ marginTop: 12, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10.5, color: '#64748b' }}>Récupération SEMrush…</div>

              if (semrushError)
                return (
                  <div style={{ marginTop: 12, background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, padding: '8px 12px', fontSize: 10.5, color: '#ef4444' }}>
                    ✗ {semrushError}
                    <button className="ld-btn" onClick={handleSemrush} style={{ marginLeft: 10, fontSize: 10, color: '#EDFA36', background: 'none', border: '1px solid rgba(29,110,85,0.25)', borderRadius: 5, padding: '2px 8px', cursor: 'pointer' }}>Réessayer</button>
                  </div>
                )

              if (!semrushData)
                return (
                  <button className="ld-btn" onClick={handleSemrush} style={{ marginTop: 12, width: '100%', height: 28, borderRadius: 6, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.02)', color: '#64748b', fontSize: 10.5, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2"><path d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z"/></svg>
                    Récupérer données SEMrush
                  </button>
                )

              // Data grid
              const fmt = (v, suffix = '') => v == null ? '—' : `${Number(v).toLocaleString('fr-FR')}${suffix}`
              const authorityColor = !semrushData.authorityScore ? '#64748b' : semrushData.authorityScore >= 50 ? '#22c55e' : semrushData.authorityScore >= 25 ? '#f59e0b' : '#ef4444'
              const rows = [
                { label: 'Authority Score',      val: semrushData.authorityScore != null ? `${semrushData.authorityScore}/100` : '—', color: authorityColor },
                { label: 'Trafic mensuel',        val: fmt(semrushData.monthlyTraffic),   color: '#94a3b8' },
                { label: 'Mots-clés organiques',  val: fmt(semrushData.organicKeywords),  color: '#94a3b8' },
                { label: 'Backlinks',             val: fmt(semrushData.backlinks),        color: '#94a3b8' },
                { label: 'Domaines référents',    val: fmt(semrushData.referringDomains), color: '#94a3b8' },
                { label: 'Mots-clés payants',     val: fmt(semrushData.paidKeywords),     color: '#94a3b8' },
              ]

              return (
                <div style={{ marginTop: 12, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(29,110,85,0.12)', borderRadius: 8, overflow: 'hidden' }}>
                  <div style={{ padding: '7px 11px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase', color: '#1D6E55' }}>SEMrush — Autorité & Trafic</span>
                    <span style={{ fontSize: 8.5, color: '#334155', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 4, padding: '2px 6px' }}>{domain}</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0 }}>
                    {rows.map(({ label, val, color }, i) => (
                      <div key={i} style={{ padding: '7px 11px', borderBottom: i < rows.length - 2 ? '1px solid rgba(255,255,255,0.04)' : 'none', borderRight: i % 2 === 0 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                        <div style={{ fontSize: 9, color: '#475569', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: 3 }}>{label}</div>
                        <div style={{ fontSize: 13, fontWeight: 700, color, fontFamily: 'var(--font-mono)' }}>{val}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })()}

          </div>

          {/* Audit on-demand — PHOTOGRAPHE seulement, avant l'analyse visuelle */}
          {activeProfile?.id === 'photographe' && auditState === 'loading' && (
            <div style={{ marginBottom: 12, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: '#64748b' }}>Audit en cours…</div>
          )}

          {/* ── ANALYSE VISUELLE IA ── designer / photographe / copywriter */}
          {['designer', 'photographe', 'copywriter'].includes(activeProfile?.id) && lead.website && (() => {
            const ZONE_OPTIONS = [
              { id: 'header', label: 'Header uniquement', desc: 'Première impression du site',    cost: 1, badge: null },
              { id: 'corps',  label: 'Header + corps',    desc: 'Analyse complète de la page',    cost: 2, badge: 'Recommandé' },
              { id: 'full',   label: 'Page complète',     desc: 'Audit total avec scroll',         cost: 3, badge: null },
            ]
            const MOCK_CREDITS  = 847
            const scoreColor    = (s) => s >= 70 ? '#22c55e' : s >= 40 ? '#f59e0b' : '#ef4444'
            const levelColor    = { red: '#ef4444', orange: '#f59e0b', green: '#22c55e' }
            const currentCost   = ZONE_OPTIONS.find(z => z.id === selectedZone)?.cost ?? 1

            return (
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '2.5px', textTransform: 'uppercase', color: '#1D6E55', marginBottom: 10, paddingBottom: 6, borderBottom: '1px solid rgba(29,110,85,0.12)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>Analyse Visuelle IA</span>
                  <span style={{ fontSize: 9, fontWeight: 400, color: '#475569', letterSpacing: 0 }}>{MOCK_CREDITS} crédits</span>
                </div>

                {/* Sélecteur de zone — liste verticale */}
                <div style={{ marginBottom: 10 }}>
                  {ZONE_OPTIONS.map(z => {
                    const sel = selectedZone === z.id
                    return (
                      <div key={z.id} onClick={() => !visualLoading && setSelectedZone(z.id)}
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderRadius: 8, background: sel ? 'rgba(29,110,85,0.06)' : 'rgba(255,255,255,0.02)', border: `1px solid ${sel ? 'rgba(29,110,85,0.3)' : 'rgba(255,255,255,0.06)'}`, marginBottom: 6, cursor: visualLoading ? 'default' : 'pointer', transition: 'all .15s' }}>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 500, color: sel ? '#EDFA36' : '#e2e8f0', marginBottom: 2 }}>{z.label}</div>
                          <div style={{ fontSize: 11, color: '#475569' }}>{z.desc}</div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                          <span style={{ fontSize: 11, color: '#475569' }}>{z.cost} crédit{z.cost > 1 ? 's' : ''}</span>
                          {z.badge && (
                            <span style={{ fontSize: 10, background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)', color: '#f59e0b', borderRadius: 4, padding: '2px 7px', fontWeight: 500 }}>{z.badge}</span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Bouton lancer */}
                <button onClick={handleVisualAnalysis} disabled={visualLoading}
                  style={{ width: '100%', height: 40, borderRadius: 10, border: '1px solid rgba(29,110,85,0.25)', background: visualLoading ? 'rgba(29,110,85,0.04)' : 'rgba(29,110,85,0.12)', color: visualLoading ? '#64748b' : '#1d6e55', fontSize: 12, fontWeight: 500, cursor: visualLoading ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 8 }}>
                  {visualLoading ? (
                    <>
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ animation: 'spin 1s linear infinite' }}>
                        <circle cx="7" cy="7" r="5.5" stroke="rgba(29,110,85,0.3)" strokeWidth="2"/>
                        <path d="M7 1.5A5.5 5.5 0 0 1 12.5 7" stroke="#1D6E55" strokeWidth="2" strokeLinecap="round"/>
                      </svg>
                      Analyse en cours…
                    </>
                  ) : `Lancer l'analyse — ${currentCost} crédit${currentCost > 1 ? 's' : ''}`}
                </button>

                {/* Erreur */}
                {visualError && (
                  <div style={{ padding: '8px 11px', background: visualError.includes('bloque') ? 'rgba(245,158,11,0.06)' : 'rgba(239,68,68,0.06)', borderLeft: `3px solid ${visualError.includes('bloque') ? '#f59e0b' : '#ef4444'}`, borderRadius: '0 8px 8px 0', fontSize: 10.5, color: visualError.includes('bloque') ? '#fcd34d' : '#fca5a5', lineHeight: 1.5, marginBottom: 8 }}>
                    ⚠ {visualError.includes('ne permet pas') ? 'Ce site bloque les captures automatiques — fonctionnalité indisponible pour ce prospect' : visualError}
                  </div>
                )}

                {/* Résultat */}
                {visualAnalysis && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {/* Grille score / époque / verdict */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 6 }}>
                      <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, padding: '10px 12px', textAlign: 'center' }}>
                        <div style={{ fontSize: 9, color: '#475569', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: 5 }}>Score</div>
                        <div style={{ fontSize: 22, fontWeight: 800, color: scoreColor(visualAnalysis.score), lineHeight: 1 }}>{visualAnalysis.score}</div>
                        <div style={{ fontSize: 9, color: '#475569', marginTop: 2 }}>/100</div>
                      </div>
                      <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, padding: '10px 12px', textAlign: 'center' }}>
                        <div style={{ fontSize: 9, color: '#475569', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: 5 }}>Époque</div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#f59e0b', lineHeight: 1.2 }}>{visualAnalysis.epoch}</div>
                      </div>
                      <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, padding: '10px 12px', textAlign: 'center' }}>
                        <div style={{ fontSize: 9, color: '#475569', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: 5 }}>Verdict</div>
                        <div style={{ fontSize: 11.5, fontWeight: 700, color: scoreColor(visualAnalysis.score), lineHeight: 1.2 }}>{visualAnalysis.verdict}</div>
                      </div>
                    </div>

                    {/* Observations */}
                    {visualAnalysis.observations?.length > 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                        {visualAnalysis.observations.map((obs, i) => (
                          <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '7px 11px', background: `${levelColor[obs.level] ?? '#f59e0b'}0D`, borderLeft: `3px solid ${levelColor[obs.level] ?? '#f59e0b'}`, borderRadius: '0 6px 6px 0' }}>
                            <span style={{ width: 7, height: 7, borderRadius: '50%', background: levelColor[obs.level] ?? '#f59e0b', flexShrink: 0, marginTop: 4 }} />
                            <span style={{ fontSize: 11.5, color: '#cbd5e1', lineHeight: 1.45, whiteSpace: 'normal', wordWrap: 'break-word', minWidth: 0 }}>{obs.text}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })()}

          {/* ── SCORE DÉTAILLÉ ── */}
          <div style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, marginBottom: 12, overflow: 'hidden' }}>
            <div style={{ height: 2, background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.14), transparent)' }} />
            <div style={{ padding: '12px 14px' }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '1.2px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.28)', marginBottom: 10 }}>
              Score Détaillé
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {SCORE_BREAKDOWN.filter(({ key }) => key !== 'financialCapacity').map(({ key, label }) => {
                const max = activeWeights[key] || 0
                const val = breakdown[key] || 0
                const ratio = max > 0 ? val / max : 0
                const c = ratio >= 0.7 ? '#1d6e55' : ratio >= 0.4 ? '#f97316' : '#ef4444'
                return (
                  <div key={key}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                      <span style={{ color: 'rgba(255,255,255,0.4)' }}>{label}</span>
                      <span style={{ fontWeight: 600, color: c }}>{val}/{max} pts</span>
                    </div>
                    <div style={{ height: 3, background: 'rgba(255,255,255,0.07)', borderRadius: 2, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${Math.min(ratio * 100, 100)}%`, background: c, borderRadius: 2 }} />
                    </div>
                  </div>
                )
              })}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, padding: '10px 12px', background: 'rgba(29,110,85,0.1)', border: '1px solid rgba(29,110,85,0.28)', borderRadius: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#f5f5f0' }}>Score total</span>
              <span style={{ fontSize: 15, fontWeight: 700, color: '#edfa36', fontFamily: 'var(--font-mono)' }}>{score}<span style={{ fontSize: 11, color: 'rgba(255,255,255,0.38)', fontWeight: 400 }}>/100</span></span>
            </div>
            {activeProfile?.id === 'photographe' && (
              <div style={{ fontSize: 12, color: '#475569', marginTop: 6 }}>Score basé sur les données publiques</div>
            )}
            </div>{/* /padding */}
          </div>{/* /Score block */}

          {/* ── POSITIONNEMENT ── */}
          {(lead.competitorAvg != null || lead.benchmarkPercentile != null) && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '2.5px', textTransform: 'uppercase', color: '#1D6E55', marginBottom: 10, paddingBottom: 6, borderBottom: '1px solid rgba(29,110,85,0.12)' }}>
                Positionnement
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {lead.competitorAvg != null && (
                  <div style={{ background: '#111813', border: '0.5px solid rgba(29,110,85,0.25)', borderRadius: 8, padding: '10px 12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                      <span style={{ fontSize: 10, color: '#64748b', letterSpacing: '0.04em' }}>Moyenne secteur</span>
                      <span style={{ fontSize: 14, fontWeight: 700, color: '#94a3b8', fontFamily: 'var(--font-mono)' }}>{lead.competitorAvg}</span>
                    </div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: lead.competitorDelta > 0 ? '#10b981' : lead.competitorDelta < 0 ? '#ef4444' : '#64748b' }}>
                      {lead.competitorDelta > 0 ? `+${lead.competitorDelta} au-dessus de la moyenne` : lead.competitorDelta < 0 ? `${lead.competitorDelta} en dessous de la moyenne` : 'Dans la moyenne'}
                    </div>
                  </div>
                )}
                {lead.benchmarkPercentile != null && (() => {
                  const pct = lead.benchmarkPercentile
                  const barColor = pct >= 60 ? '#10b981' : pct >= 40 ? '#f59e0b' : '#ef4444'
                  const city = lead.address ? lead.address.split(',').pop().trim() : null
                  const domain = lead.domain ? (lead.domain.charAt(0).toUpperCase() + lead.domain.slice(1)) : 'Établissements'
                  const label = city ? `${domain} de ${city}` : domain
                  const tierText = pct >= 60
                    ? 'se situe dans le tiers supérieur de son secteur.'
                    : pct >= 40
                    ? 'se situe dans la moyenne de son secteur.'
                    : 'se situe en dessous de la moyenne de son secteur.'
                  // Voisins : top-5 de la même recherche, triés par score décroissant
                  const peers = (leads || [])
                    .filter(l => l.score?.total != null)
                    .sort((a, b) => (b.score?.total ?? 0) - (a.score?.total ?? 0))
                    .slice(0, 5)
                  const peerCount = (leads || []).length
                  return (
                    <div style={{ background: '#111813', border: '0.5px solid rgba(29,110,85,0.25)', borderRadius: 8, padding: '10px 12px' }}>
                      {/* Header */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 7 }}>
                        <span style={{ fontSize: 10, color: '#64748b', letterSpacing: '0.04em' }}>Benchmark sectoriel</span>
                        <span style={{ fontSize: 13, fontWeight: 700, color: barColor, fontFamily: 'var(--font-mono)' }}>{pct}<span style={{ fontSize: 9, fontWeight: 400, color: '#475569' }}>%</span></span>
                      </div>
                      {/* Barre */}
                      <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 3, height: 4, marginBottom: 8, overflow: 'hidden' }}>
                        <div style={{ width: `${pct}%`, height: '100%', borderRadius: 3, background: barColor, transition: 'width 0.4s ease' }} />
                      </div>
                      {/* Texte principal */}
                      <div style={{ fontSize: 10.5, color: '#94a3b8', marginBottom: 8 }}>Meilleur que {pct}% des {label}</div>
                      {/* Bloc explicatif */}
                      <div style={{ background: 'rgba(255,255,255,0.03)', borderLeft: '2px solid rgba(29,110,85,0.4)', borderRadius: '0 4px 4px 0', padding: '7px 10px', marginBottom: 10 }}>
                        <span style={{ fontSize: 10, color: '#64748b', lineHeight: 1.5 }}>
                          Sur les {peerCount} établissements similaires analysés dans cette ville, celui-ci {tierText}
                        </span>
                      </div>
                      {/* Séparateur */}
                      <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', marginBottom: 9 }} />
                      {/* Mini liste des voisins */}
                      {peers.length > 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                          {peers.map(peer => {
                            const isCurrent = peer.id === lead.id
                            const peerScore = peer.score?.total ?? 0
                            const peerColor = peerScore >= 70 ? '#10b981' : peerScore >= 40 ? '#f59e0b' : '#ef4444'
                            const peerPct = peers.length > 1
                              ? Math.round((peers.filter(p => (p.score?.total ?? 0) < peerScore).length / (peers.length)) * 100)
                              : null
                            return (
                              <div key={peer.id} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: isCurrent ? '4px 7px' : '2px 0', borderRadius: isCurrent ? 5 : 0, background: isCurrent ? 'rgba(29,110,85,0.12)' : 'transparent' }}>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ fontSize: 9.5, color: isCurrent ? '#EDFA36' : '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: isCurrent ? 600 : 400 }}>
                                    {peer.name}{isCurrent && <span style={{ color: '#1D6E55', marginLeft: 4, fontSize: 8.5 }}>← vous</span>}
                                  </div>
                                  <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 2, height: 3, marginTop: 3, overflow: 'hidden' }}>
                                    <div style={{ width: `${peerScore}%`, height: '100%', borderRadius: 2, background: peerColor }} />
                                  </div>
                                </div>
                                <span style={{ fontSize: 10, fontWeight: 700, color: peerColor, fontFamily: 'var(--font-mono)', flexShrink: 0 }}>{peerScore}</span>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )
                })()}
              </div>
            </div>
          )}

          {/* ── ANALYSE DES AVIS ── */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '2.5px', textTransform: 'uppercase', color: '#1D6E55', marginBottom: 10, paddingBottom: 6, borderBottom: '1px solid rgba(29,110,85,0.12)' }}>
              Analyse des Avis
            </div>

            {/* AI results */}
            {aiState === 'done' && aiReport && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ background: 'rgba(29,110,85,0.12)', border: '1px solid rgba(29,110,85,0.35)', borderRadius: 10, padding: 14, textAlign: 'center' }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#1d6e55', fontFamily: 'var(--font-body)' }}>
                    ✅ Analyse terminée — consultez le rapport PDF pour voir les résultats détaillés.
                  </span>
                </div>
                <button
                  className="ld-btn"
                  onClick={handleExportPDF}
                  disabled={pdfLoading}
                  style={{ width: '100%', height: 32, borderRadius: 9, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.04)', color: pdfLoading ? '#475569' : 'rgba(255,255,255,0.48)', fontSize: 12, fontWeight: 500, cursor: pdfLoading ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}
                  onMouseEnter={e => { if (!pdfLoading) { e.currentTarget.style.color = 'rgba(255,255,255,0.7)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)' } }}
                  onMouseLeave={e => { e.currentTarget.style.color = pdfLoading ? '#475569' : 'rgba(255,255,255,0.48)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)' }}>
                  {pdfLoading ? '⏳ Génération en cours…' : '↓ Télécharger le rapport PDF'}
                </button>
              </div>
            )}

            {/* Error message */}
            {aiState === 'error' && aiError && (
              <div style={{ fontSize: 11, color: '#ef4444', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 7, padding: '8px 10px', marginBottom: 8 }}>
                ⚠ {aiError}
                <button onClick={() => setAiState('idle')} style={{ marginLeft: 8, fontSize: 10, color: 'rgba(255,255,255,0.4)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>Réessayer</button>
              </div>
            )}

            {/* Load / analyze button */}
            {aiState !== 'done' && (
              <button
                className="ld-btn"
                onClick={reviewsState === 'done' ? handleAnalyzeAI : handleLoadReviews}
                disabled={reviewsState === 'loading' || aiState === 'loading'}
                style={{ width: '100%', height: 40, borderRadius: 10, border: '1px solid rgba(29,110,85,0.25)', background: 'rgba(29,110,85,0.12)', color: reviewsState === 'loading' || aiState === 'loading' ? '#64748b' : '#1d6e55', fontSize: 12, fontWeight: 500, cursor: reviewsState === 'loading' || aiState === 'loading' ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 10 }}>
                {reviewsState === 'loading' && '⏳ Chargement des avis…'}
                {aiState === 'loading' && '✨ Analyse IA en cours…'}
                {reviewsState !== 'loading' && aiState !== 'loading' && (reviewsState === 'done' ? "Analyser avec l'IA" : 'Charger et analyser les avis IA (100 max) — 1 crédit')}
              </button>
            )}

            {/* Basic reviews preview (no AI yet) */}
            {aiState !== 'done' && lead.google?.reviews?.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {lead.google.reviews.slice(0, 2).map((review, i) => (
                  <div key={i} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 7, padding: '8px 10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                      <Stars rating={review.rating} size={10} />
                      <span style={{ fontSize: 10.5, color: '#475569' }}>{review.author}</span>
                    </div>
                    <div style={{ fontSize: 11, color: '#94a3b8', lineHeight: 1.5 }}>
                      {review.text?.substring(0, 100)}{(review.text?.length || 0) > 100 ? '…' : ''}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── DONNÉES FINANCIÈRES ── */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '2.5px', textTransform: 'uppercase', color: '#1D6E55', marginBottom: 10, paddingBottom: 6, borderBottom: '1px solid rgba(29,110,85,0.12)' }}>
              Données Financières
            </div>
            {pappersState === 'idle' && (
              <button className="ld-btn" onClick={handleLoadPappers} style={{ width: '100%', height: 40, borderRadius: 10, border: '1px solid rgba(29,110,85,0.25)', background: 'rgba(29,110,85,0.12)', color: '#1d6e55', fontSize: 12, fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                Charger les données Pappers — 1 crédit
              </button>
            )}
            {pappersState === 'loading' && (
              <div style={{ height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: '#64748b' }}>Chargement Pappers…</div>
            )}
            {pappersState === 'not_found' && (
              <div style={{ fontSize: 11, color: '#475569', textAlign: 'center', padding: '8px 0' }}>Aucune donnée Pappers trouvée.</div>
            )}
            {pappersState === 'done' && pappersData && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {[
                  { label: "Chiffre d'affaires", value: pappersData.chiffreAffaires != null ? (typeof pappersData.chiffreAffaires === 'number' ? pappersData.chiffreAffaires.toLocaleString('fr-FR') + ' €' : pappersData.chiffreAffaires) : null },
                  { label: 'Effectif',            value: pappersData.effectif },
                  { label: 'Forme juridique',     value: pappersData.formeJuridique },
                  { label: 'Créée le',            value: pappersData.dateCreation },
                ].filter(r => r.value).map((row, i) => (
                  <div key={i} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, padding: '9px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 10.5, color: '#64748b' }}>{row.label}</span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#f1f5f9', fontFamily: 'var(--font-mono)' }}>{row.value}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Perf audit on-demand */}
          {!['seo', 'consultant-seo', 'dev-web', 'pub-google', 'photographe', 'chatbot', 'dev-chatbot'].includes(activeProfile?.id) && auditState === 'idle' && (lead.website || lead.social?.facebook || lead.social?.instagram) && (
            <div style={{ marginBottom: 20 }}>
              <button className="ld-btn" onClick={handleAnalyzePerformance} style={{ width: '100%', height: 40, borderRadius: 10, border: '1px solid rgba(29,110,85,0.25)', background: 'rgba(29,110,85,0.12)', color: '#1d6e55', fontSize: 12, fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                Analyser les performances digitales — 1 crédit
              </button>
            </div>
          )}
          {!['seo', 'consultant-seo', 'dev-web', 'pub-google', 'photographe'].includes(activeProfile?.id) && auditState === 'loading' && (
            <div style={{ marginBottom: 20, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: '#64748b' }}>Audit en cours…</div>
          )}

          {/* ── EMAIL IA ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>

            {/* Generated email display */}
            {aiEmailState === 'done' && aiEmail && (
              <div style={{ background: 'rgba(29,110,85,0.06)', border: '1px solid rgba(29,110,85,0.20)', borderRadius: 10, padding: '13px 14px', marginBottom: 2 }}>
                <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase', color: '#1D6E55', marginBottom: 9 }}>Email généré</div>
                {aiEmail.subject && (
                  <div style={{ fontSize: 11.5, fontWeight: 600, color: '#f1f5f9', marginBottom: 7, lineHeight: 1.4 }}>Objet : {aiEmail.subject}</div>
                )}
                <div style={{ fontSize: 11, color: '#94a3b8', lineHeight: 1.65, maxHeight: 180, overflowY: 'auto', whiteSpace: 'pre-wrap', marginBottom: 9, scrollbarWidth: 'thin', scrollbarColor: '#2d3748 transparent' }}>
                  {aiEmail.body}
                </div>
                <button className="ld-btn" onClick={() => { navigator.clipboard.writeText(`${aiEmail.subject}\n\n${aiEmail.body}`); setCopiedEmail(true); setTimeout(() => setCopiedEmail(false), 2000) }} style={{ width: '100%', height: 30, borderRadius: 6, border: '1px solid rgba(29,110,85,0.25)', background: 'transparent', color: copiedEmail ? '#22c55e' : '#EDFA36', fontSize: 11, cursor: 'pointer', fontWeight: 600 }}>
                  {copiedEmail ? '✓ Copié !' : '📋 Copier'}
                </button>
              </div>
            )}

            {/* Generate email button */}
            {(() => {
              const VISUAL_PROFILES = ['photographe', 'designer', 'copywriter']
              const AUDIT_PROFILES  = ['seo', 'consultant-seo', 'dev-web', 'pub-google', 'chatbot', 'dev-chatbot']
              const pid = activeProfile?.id
              const visualBlocked = VISUAL_PROFILES.includes(pid) && !!visualError && (visualError.includes('bloque') || visualError.includes('indisponible') || visualError.includes('ne permet pas'))
              const step2Done = VISUAL_PROFILES.includes(pid)
                ? visualAnalysis !== null || visualBlocked
                : AUDIT_PROFILES.includes(pid) ? auditState === 'done' : null
              const hasStep2 = step2Done !== null
              const emailReady = aiReport && (!hasStep2 || step2Done)
              const emailDisabled = aiEmailState === 'loading' || !emailReady
              let emailLabel = '✦ Générer email IA'
              if (aiEmailState === 'loading') emailLabel = '✨ Génération en cours…'
              else if (!aiReport) emailLabel = '✦ Générer l\'email — analysez d\'abord les avis'
              else if (hasStep2 && !step2Done) emailLabel = '✦ Générer l\'email — analysez d\'abord le site'
              return (
                <>
                  <button
                    className="ld-btn"
                    onClick={emailReady ? handleGenerateAIEmail : undefined}
                    disabled={emailDisabled}
                    style={{ width: '100%', height: 48, borderRadius: 14, border: emailDisabled ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(255,255,255,0.28)', background: emailDisabled ? 'rgba(255,255,255,0.03)' : 'linear-gradient(to bottom, rgba(29,110,85,0.92), rgba(29,110,85,0.72))', color: emailDisabled ? '#475569' : '#edfa36', fontSize: 13, fontWeight: 700, cursor: emailDisabled ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, boxShadow: !emailDisabled ? '0px 6px 20px rgba(29,110,85,0.55)' : 'none', position: 'relative', overflow: 'hidden', transition: 'all 0.15s' }}>
                    {!emailDisabled && <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 20, background: 'linear-gradient(to bottom, rgba(255,255,255,0.2), transparent)', borderRadius: '14px 14px 0 0', pointerEvents: 'none' }} />}
                    {emailLabel}
                  </button>
                  {visualBlocked && (
                    <div style={{ fontSize: 10, color: '#475569', textAlign: 'center', marginTop: 5, lineHeight: 1.4 }}>
                      Analyse visuelle indisponible — email généré sans données visuelles du site
                    </div>
                  )}
                </>
              )
            })()}

            {/* Export PDF */}
            <button
              className="ld-btn"
              onClick={handleExportPDF}
              disabled={pdfLoading}
              style={{ width: '100%', height: 32, borderRadius: 9, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.04)', color: pdfLoading ? '#475569' : 'rgba(255,255,255,0.48)', fontSize: 12, fontWeight: 500, cursor: pdfLoading ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}
              onMouseEnter={e => { if (!pdfLoading) { e.currentTarget.style.color = 'rgba(255,255,255,0.7)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)' } }}
              onMouseLeave={e => { e.currentTarget.style.color = pdfLoading ? '#475569' : 'rgba(255,255,255,0.48)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)' }}>
              {pdfLoading ? '⏳ Génération en cours…' : '↓ Exporter fiche PDF'}
            </button>

            {/* Audit prospect PDF */}
            <button
              className="ld-btn"
              onClick={handleExportAuditPDF}
              disabled={auditPdfLoading}
              style={{ width: '100%', height: 32, borderRadius: 10, border: '1px solid rgba(237,250,54,0.3)', background: 'rgba(237,250,54,0.15)', color: auditPdfLoading ? '#475569' : '#edfa36', fontSize: 12, fontWeight: 600, cursor: auditPdfLoading ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}
              onMouseEnter={e => { if (!auditPdfLoading) { e.currentTarget.style.background = 'rgba(237,250,54,0.22)'; e.currentTarget.style.borderColor = 'rgba(237,250,54,0.5)' } }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(237,250,54,0.15)'; e.currentTarget.style.borderColor = 'rgba(237,250,54,0.3)' }}>
              {prospectAuditState === 'loading' ? '⏳ Génération de l\'audit…' : auditPdfLoading ? '⏳ Mise en page PDF…' : '↓ Générer l\'audit prospect'}
            </button>
            {auditPdfError && (
              <div style={{ fontSize: 11, color: '#f87171', textAlign: 'center', marginTop: 5, lineHeight: 1.4, padding: '4px 8px', background: 'rgba(239,68,68,0.08)', borderRadius: 6, border: '1px solid rgba(239,68,68,0.2)' }}>
                ✗ {auditPdfError}
              </div>
            )}
          </div>

        </div>
        </div>{/* end position:relative wrapper */}
      </div>

      {/* ── DESCRIPTION MODAL ── */}
      {showDescriptionModal && lead.googleAudit?.descriptionText && (
        <div onClick={() => setShowDescriptionModal(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#111813', border: '1px solid #1D6E55', borderRadius: 12, padding: 20, maxWidth: 560, width: '100%', display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#f1f5f9' }}>📝 Description</span>
              <button onClick={() => setShowDescriptionModal(false)} style={{ background: 'none', border: 'none', color: '#64748b', fontSize: 16, cursor: 'pointer' }}>✕</button>
            </div>
            <div style={{ fontSize: 14, lineHeight: 1.7, color: '#e2e8f0', overflowY: 'auto', maxHeight: '60vh', paddingRight: 6, scrollbarWidth: 'thin', scrollbarColor: '#4338ca #111813' }}>
              {lead.googleAudit.descriptionText}
            </div>
            {lead.googleAudit?.descriptionSource && (
              <div style={{ fontSize: 11, color: '#64748b', padding: '6px 10px', background: 'rgba(255,255,255,0.04)', borderRadius: 6, display: 'inline-block' }}>
                Source : {lead.googleAudit.descriptionSource}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
