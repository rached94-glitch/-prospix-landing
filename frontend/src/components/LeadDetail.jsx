import { useState, useEffect, useRef } from 'react'
import { playClick, playSuccess, playError } from '../utils/sounds'
import ReactMarkdown from 'react-markdown'
import { ScoreBadge } from './LeadCard'
import { exportLeadPDF } from '../utils/exportPDF'
import { FaFacebookF, FaLinkedinIn, FaYoutube, FaTiktok, FaInstagram } from 'react-icons/fa'
import { aiCache, auditCache } from '../utils/caches'
import ReviewsSection from './ReviewsSection'
import AIEmailGenerator from './AIEmailGenerator'
import AuditPanel from './AuditPanel'

const SOCIAL_CONFIG = [
  { key: 'linkedin',  label: 'LinkedIn',  icon: '💼' },
  { key: 'facebook',  label: 'Facebook',  icon: '📘' },
  { key: 'instagram', label: 'Instagram', icon: '📸' },
  { key: 'tiktok',    label: 'TikTok',    icon: '🎵' },
]

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
  const [showDescriptionModal, setShowDescriptionModal] = useState(false)
  const [showTooltip,          setShowTooltip]          = useState(false)
  const [auditTab, setAuditTab] = useState('fiche') // 'fiche' | 'performance' | 'reseaux'

  // Décideur LinkedIn state
  const [dmState,      setDmState]      = useState('idle') // idle | loading | found | not_found

  // Apify reviews state
  const [reviewsState, setReviewsState]   = useState('idle') // idle | loading | done
  const [reviewsData,  setReviewsData]    = useState(null)

  // AI analysis state
  const [aiState,      setAiState]        = useState('idle') // idle | loading | done | error
  const [aiReport,     setAiReport]       = useState(null)
  const [aiError,      setAiError]        = useState(null)

  // AI-generated email state
  const [aiEmail, setAiEmail] = useState(null) // { subject, body } — géré dans AIEmailGenerator via onEmailGenerated

  // Pappers financial data state
  const [pappersData,  setPappersData]    = useState(null)
  const [pappersState, setPappersState]   = useState('idle') // idle | loading | done | not_found

  // Digital audit state (PageSpeed + social activity) — loaded on lead select
  const [auditData,  setAuditData]  = useState(null)  // { pagespeed, socialActivity }
  const [auditState, setAuditState] = useState('idle') // idle | loading | done | error

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
    setReviewsState('idle')
    setReviewsData(null)
    setWide(false)
    setCopiedReport(false)
    setAiEmail(null)
    // Restore from cache if already analysed for this lead+profile combo
    const placeKey    = (lead?._id ?? lead?.id ?? '').replace(/^ChIJ/, '')
    const profileKey  = activeProfile?.id ?? 'default'
    const cacheKey    = `${placeKey}::${profileKey}`
    if (placeKey && aiCache.has(cacheKey)) {
      setAiState('done')
      setAiReport(aiCache.get(cacheKey))
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
    if (auditKey && auditCache.has(auditKey)) {
      setAuditData(auditCache.get(auditKey))
      setAuditState('done')
    } else {
      setAuditData(null)
      setAuditState('idle')
    }
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
      if (auditKey) auditCache.set(auditKey, d)
      setAuditData(d)
      setAuditState('done')

      // ── social-media : deep Instagram en arrière-plan (engagement, hashtags) ──
      if (activeProfile?.id === 'social-media' && lead.social?.instagram) {
        console.log('[SocialMedia] Démarrage deep Instagram —', lead.social.instagram)
        fetch(`${API}/api/leads/instagram-deep`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ instagramUrl: lead.social.instagram }),
        })
          .then(r => r.json().then(body => ({ ok: r.ok, body })))
          .then(({ ok, body }) => {
            if (!ok) throw new Error(body.error || 'Erreur serveur')
            if (body.error) {
              console.warn('[SocialMedia] Deep IG — compte privé ou absent:', body.error)
              return
            }
            console.log('[SocialMedia] Deep IG résultat —', JSON.stringify(body))
            setAuditData(prev => prev ? { ...prev, instagramDeep: body } : { instagramDeep: body })
          })
          .catch(e => {
            console.warn('[SocialMedia] Deep IG erreur (ignorée) —', e.message)
          })
      }

      // ── dev-web : analyse visuelle en arrière-plan après PageSpeed ──────────
      if (activeProfile?.id === 'dev-web' && lead.website) {
        console.log('[VisualAnalysis dev-web] Démarrage —', lead.website)
        setVisualLoading(true)
        setVisualError(null)
        setVisualAnalysis(null)
        fetch(`${API}/api/leads/visual-analysis`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ url: lead.website, zone: 'header', profile: 'dev-web' }),
        })
          .then(r => r.json().then(body => ({ ok: r.ok, body })))
          .then(({ ok, body }) => {
            if (!ok) throw new Error(body.error || 'Erreur serveur')
            console.log('[VisualAnalysis dev-web] Résultat —', body.verdict, body.score)
            setVisualAnalysis(body)
          })
          .catch(e => {
            console.warn('[VisualAnalysis dev-web] Erreur —', e.message)
            setVisualError(e.message)
          })
          .finally(() => setVisualLoading(false))
      }
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
    // TODO: Supabase — déduire 1 crédit avant l'appel
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
    // TODO: Supabase — déduire 1 crédit avant l'appel
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

  const handleAnalyzeAI = async (freshReviewsData) => {
    const reviews = freshReviewsData ?? reviewsData
    if (aiState === 'loading' || !reviews) return
    const placeId = (lead._id ?? lead.id).replace(/^ChIJ/, '')

    // Serve from cache if available
    if (aiCache.has(placeId)) {
      setAiReport(aiCache.get(placeId))
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
          reviews:      reviews.reviews,
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
      aiCache.set(cacheFullKey, data) // cache per lead + profile
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

  const [pdfLoading, setPdfLoading] = useState(false)

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
        // getSiteSignals() (chatbot) retourne les signaux à plat dans pagespeed — pas imbriqués dans .siteSignals
        const siteSignals     = auditData?.pagespeed ?? null
        const auditDone       = siteSignals !== null

        // ── Phase 1 — disponible dès le unlock ──────────────────────────────────
        const chatDetected    = auditDone ? siteSignals.chatbotDetected : !!(lead.chatbotDetection?.hasChatbot)
        const chatTool        = siteSignals?.chatbotTool ?? (lead.chatbotDetection?.chatbotsDetected?.[0] ?? null)
        const domainComplexity = lead.domainComplexity ?? null

        // Si les 100 avis Apify sont chargés, recalculer sur les données fraîches
        // Sinon fallback sur les 5 avis Google natifs du lead
        const effectiveUnanswered = reviewsData?.unanswered ?? unanswered
        const qaData        = reviewsData?.questionAnalysis ?? lead.reviewAnalysis?.questionAnalysis ?? null
        const questionCount = qaData?.totalQuestions ?? null
        const questionRatio = qaData?.questionRatio  ?? null
        const questionTopics = qaData?.questionTopics ?? {}

        // ── Phase 2 — disponible uniquement après "Analyser le site" (audit) ────
        // hasFAQ, hasForm et cms viennent EXCLUSIVEMENT de siteSignals (GET /audit)
        // Pour ne pas afficher de données avant que l'utilisateur ait lancé l'analyse
        const hasFAQ  = auditDone ? (siteSignals.hasFAQ          ?? null) : null
        const hasForm = auditDone ? (siteSignals.hasContactForm   ?? null) : null
        const bookingPlatform = siteSignals?.bookingPlatform ?? null
        const sensitive       = siteSignals?.sensitiveData   ?? null
        const cmsData = auditDone ? (siteSignals.cms ?? null) : null
        const cmsName = cmsData?.cms && cmsData.cms !== 'inconnu' ? cmsData.cms : null

        // Topics pour "Thèmes récurrents" — données disponibles dès le unlock
        // mais affichées uniquement après l'audit (cohérence UX phase 2)
        const topTopicEntries = Object.entries(questionTopics).sort((a, b) => b[1] - a[1]).slice(0, 3)
        const topTopicsLabel  = topTopicEntries.length > 0 ? topTopicEntries.map(([t]) => t).join(', ') : null

        // ── Nouveaux signaux (phase 1 — refreshed par /reviews) ─────────────
        const phoneData    = reviewsData?.phoneCallAnalysis ?? lead.phoneCallAnalysis ?? null
        const offHoursData = reviewsData?.offHoursAnalysis  ?? lead.offHoursAnalysis  ?? null
        const langData     = reviewsData?.languageDetection  ?? lead.languageDetection ?? null

        const kpis = [
          // Phase 1 — post-unlock
          kpi('Avis sans réponse', effectiveUnanswered > 0 ? effectiveUnanswered : '0', effectiveUnanswered > 0 ? 'danger' : 'good'),
          { label: 'CHATBOT EXISTANT',    type: 'chatbot_detect',    detected: chatDetected, tool: chatTool },
          { label: 'QUESTIONS DANS AVIS', type: 'question_count',    count: questionCount, ratio: questionRatio, topics: questionTopics },
          { label: 'COMPLEXITÉ DOMAINE',  type: 'domain_complexity', complexity: domainComplexity },
          { label: 'APPELS TÉLÉPHONE',    type: 'phone_mentions',    mentions: phoneData?.totalMentions ?? null, difficulty: phoneData?.difficultyCount ?? 0, hasDifficulty: phoneData?.hasDifficulty ?? null },
          { label: 'HORS HORAIRES',       type: 'off_hours',         hasNeed: offHoursData?.hasOffHoursNeed ?? null, count: offHoursData?.count ?? null, ratio: offHoursData?.ratio ?? 0 },
          { label: 'LANGUES DÉTECTÉES',   type: 'languages',         isMultilingual: langData?.isMultilingual ?? null, languages: langData?.languages ?? ['fr'], foreignRatio: langData?.foreignRatio ?? 0 },
          { label: 'CONV./MOIS EST.',     type: 'monthly_conv',      count: lead.estimatedConversations ?? null },
          // Phase 2 — post-audit (null/auditDone=false → "—" jusqu'au clic "Analyser le site")
          { label: 'CMS DÉTECTÉ',         type: 'cms_detect',        cms: cmsName, noSite: !lead.website, auditDone },
          { label: 'FAQ DÉTECTÉE',       type: 'faq_detect',  detected: hasFAQ },
          { label: 'FORMULAIRE CONTACT', type: 'form_detect', detected: hasForm },
          { label: 'THÈMES RÉCURRENTS',  type: 'topic_list',
            topics:      auditDone ? topTopicEntries : [],
            topicsLabel: auditDone ? topTopicsLabel  : null },
        ]
        if (bookingPlatform !== null)
          kpis.push({ label: 'PLATEFORME RÉSERVATION', type: 'booking_url', platform: bookingPlatform })
        if (sensitive !== null)
          kpis.push({ label: 'DOMAINE SENSIBLE', type: 'sensitive', detected: sensitive })

        return {
          kpis,
          problems: [
            ...(effectiveUnanswered > 0     ? [prob(`${effectiveUnanswered} avis sans réponse — chaque silence = client perdu`, '#ef4444')] : []),
            ...(!chatDetected               ? [prob('Aucun chatbot détecté — opportunité directe', '#22c55e')] : []),
            ...(chatDetected                ? [prob(`Chatbot existant (${chatTool ?? 'inconnu'}) — angle différentiel requis`, '#f59e0b')] : []),
            ...(questionCount >= 3          ? [prob(`${questionCount} questions dans les avis — chatbot peut y répondre automatiquement`, '#f59e0b')] : []),
            ...(domainComplexity === 'complex' ? [prob('Domaine complexe — fort potentiel FAQ/chatbot', '#22c55e')] : []),
            // Phase 2 — seulement après audit
            ...(hasFAQ === false            ? [prob('Aucune FAQ — opportunité directe', '#10bb54')] : []),
            ...(hasFAQ === true             ? [prob('FAQ existante — angle complémentaire ou remplacement dynamique', '#f97316')] : []),
            ...(bookingPlatform             ? [prob(`${bookingPlatform} détecté — angle FAQ/tarifs/horaires`, '#f97316')] : []),
            ...(sensitive                   ? [prob('Données sensibles — serveur local recommandé', '#f97316')] : []),
            ...(auditDone && topTopicsLabel ? [prob(`Thèmes récurrents : ${topTopicsLabel}`, '#f59e0b')] : []),
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
        const hasYoutube   = !!(lead.social?.youtube)
        // Données enrichies depuis socialEnrichment (disponibles après unlock)
        const videoOnSite  = lead.social?.videoOnSite  ?? null
        const videoCount   = lead.social?.videoCount   ?? 0
        const hasPortfolio = lead.social?.hasPortfolio ?? null
        const ytChannel    = lead.social?.youtubeChannel ?? null
        const hasVideo     = hasYoutube || hasTiktok || !!videoOnSite

        const videoLabel   = videoOnSite === null ? '—'
          : videoOnSite ? `Oui (${videoCount} vidéo${videoCount > 1 ? 's' : ''})`
          : 'Non'
        const videoStatus  = videoOnSite === null ? 'muted'
          : videoOnSite ? (videoCount >= 3 ? 'good' : 'warn') : 'danger'

        return {
          kpis: [
            kpi('YouTube',            hasYoutube  ? 'Présent' : 'Absent',                             hasYoutube  ? 'good' : 'danger'),
            kpi('TikTok',             hasTiktok   ? 'Présent' : 'Absent',                             hasTiktok   ? 'good' : 'danger'),
            kpi('Instagram',          hasInstagram ? 'Présent' : 'Absent',                            hasInstagram ? 'good' : 'neutral'),
            kpi('Vidéo sur le site',  videoLabel,                                                     videoStatus),
            kpi('Portfolio / galerie',hasPortfolio === null ? '—' : hasPortfolio ? 'Détecté' : 'Non', hasPortfolio === null ? 'muted' : hasPortfolio ? 'good' : 'neutral'),
            kpi('Chaîne YT liée',     ytChannel ? 'Liée' : 'Non détectée',                           ytChannel ? 'good' : 'neutral'),
          ],
          problems: [
            ...(!hasVideo                   ? [prob('Aucun contenu vidéo détecté — opportunité directe pour le vidéo marketing', '#ef4444')] : []),
            ...(!hasYoutube && !hasTiktok   ? [prob('YouTube et TikTok absents — canaux vidéo non exploités', '#f59e0b')] : []),
            ...(videoOnSite === false       ? [prob('Aucune vidéo intégrée sur le site — différenciation forte possible', '#f59e0b')] : []),
          ],
        }
      }

      case 'social-media': {
        const hasYoutube  = !!(social.youtube)
        const hasPinterest = !!(social.pinterest)

        // ── Données activité (phase 2 — après clic "Analyser les réseaux") ───────
        const igActivity  = auditData?.instagramActivity ?? null
        const fbActivity  = auditData?.facebookActivity  ?? null
        // auditDoneSM = vrai dès que l'audit a été lancé (auditState === 'done')
        // même si Apify n'a pas pu scraper (compte privé, etc.)
        const auditDoneSM = auditState === 'done'

        const igFollowers  = igActivity?.followers  ?? null
        const igDaysAgo    = igActivity?.daysAgo    ?? null
        const fbFollowers  = fbActivity?.followers  ?? null
        const fbDaysAgo    = fbActivity?.daysAgo    ?? null

        // ── Engagement Instagram (deep — 12 posts, chargé en arrière-plan) ──────
        const igDeep        = auditData?.instagramDeep  ?? null
        const igAvgLikes    = igDeep?.avgLikes          ?? null
        const igAvgComments = igDeep?.avgComments       ?? null
        const igPostsMonth  = igDeep?.postsPerMonth     ?? null
        const igTopHashtags = igDeep?.topHashtags       ?? []
        const engagementDone = !!(igDeep && !igDeep.error)

        // ── Score régularité (inline — scoring.js est CommonJS backend) ──────────
        const NETWORK_COUNT = [hasFacebook, hasInstagram, hasLinkedin, hasTiktok, hasYoutube, hasPinterest].filter(Boolean).length
        const BASE_REG = [0, 15, 30, 50, 70, 85, 100]
        let regScore = BASE_REG[Math.min(NETWORK_COUNT, 6)]
        const lastPost = igDaysAgo !== null && fbDaysAgo !== null ? Math.min(igDaysAgo, fbDaysAgo) : igDaysAgo ?? fbDaysAgo
        if (igFollowers !== null && igFollowers > 1000) regScore += 10
        if (lastPost !== null && lastPost < 7)          regScore += 15
        if (photoCount > 15)                            regScore += 10
        if (lastPost !== null && lastPost > 30)         regScore -= 15
        regScore = Math.max(0, Math.min(100, regScore))
        const regLabel = regScore >= 80 ? 'Très actif' : regScore >= 60 ? 'Actif' : regScore >= 40 ? 'En développement' : regScore >= 20 ? 'Faible' : 'Inexistant'

        // ── Recommandation sectorielle (inline) ───────────────────────────────────
        const domainRaw = (lead.domain || lead.keyword || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        const isRestaurant = /restaurant|cafe|brasserie|pizz|burger|traiteur|bistrot|bar/.test(domainRaw)
        const isBeauty     = /coiffure|salon|spa|beaute|barbier|esthetique/.test(domainRaw)
        const isB2B        = /avocat|notaire|comptable|assurance|cabinet|immo|consulting|finance/.test(domainRaw)
        const isRetail     = /boutique|commerce|magasin|retail|mode|vetement|fleuriste/.test(domainRaw)
        const isHealth     = /medecin|docteur|kine|psy|sante|pharmacie|dentiste|clinique/.test(domainRaw)
        let sectorRec = 'Instagram + Facebook recommandés'
        if (isRestaurant)       sectorRec = 'Instagram + vidéos courtes essentiels'
        else if (isBeauty)      sectorRec = 'Instagram + contenus visuels + vidéos tendance'
        else if (isB2B)         sectorRec = 'Réseau professionnel essentiel + page entreprise'
        else if (isRetail)      sectorRec = 'Instagram + Facebook + contenus produits'
        else if (isHealth)      sectorRec = 'Page pro + conseils santé + témoignages'

        // ── Qualité photos ────────────────────────────────────────────────────────
        const photoQualityVal = photoCount === 0 ? 'Aucune' : photoCount <= 5 ? 'Insuffisant' : photoCount <= 15 ? 'Basique' : photoCount <= 30 ? 'Correct' : 'Excellent'
        const photoQualityStatus = photoCount === 0 ? 'danger' : photoCount <= 5 ? 'danger' : photoCount <= 15 ? 'warn' : 'good'

        // ── Présents / manquants ──────────────────────────────────────────────────
        const ALL_NETS = [
          { key: 'facebook',  label: 'FB',  present: hasFacebook },
          { key: 'instagram', label: 'IG',  present: hasInstagram },
          { key: 'linkedin',  label: 'LI',  present: hasLinkedin },
          { key: 'tiktok',    label: 'TK',  present: hasTiktok },
          { key: 'youtube',   label: 'YT',  present: hasYoutube },
        ]
        const missingCount = ALL_NETS.filter(n => !n.present).length

        const kpis = [
          // Phase 1 — post-unlock
          { label: 'RÉSEAUX PRÉSENTS',   type: 'social_present', nets: ALL_NETS.filter(n => n.present) },
          { label: 'RÉSEAUX MANQUANTS',  type: 'social_missing', nets: ALL_NETS.filter(n => !n.present) },
          kpi('Note Google',   rating      != null ? `${rating}/5` : '—',    rating >= 4 ? 'good' : rating >= 3 ? 'warn' : 'danger'),
          kpi('Volume avis',   totalReviews > 0 ? totalReviews : '0',         totalReviews >= 50 ? 'good' : totalReviews >= 20 ? 'warn' : 'danger'),
          kpi('Photos Google', `${photoCount} — ${photoQualityVal}`,          photoQualityStatus),
          { label: 'SECTEUR',            type: 'sector_rec',     sector: domainRaw ? (lead.domain || lead.keyword) : null, rec: sectorRec },
          // Phase 2 — post-audit (null → "—" jusqu'au clic "Analyser les réseaux")
          { label: 'FOLLOWERS INSTAGRAM', type: 'social_followers', network: 'Instagram', followers: igFollowers, daysAgo: igDaysAgo, auditDone: auditDoneSM },
          { label: 'FOLLOWERS FACEBOOK',  type: 'social_followers', network: 'Facebook',  followers: fbFollowers, daysAgo: fbDaysAgo, auditDone: auditDoneSM },
          { label: 'DERNIER POST IG',     type: 'social_last_post', network: 'Instagram', daysAgo: igDaysAgo, auditDone: auditDoneSM },
          { label: 'DERNIER POST FB',     type: 'social_last_post', network: 'Facebook',  daysAgo: fbDaysAgo, auditDone: auditDoneSM },
          // Phase 2b — deep Instagram (chargé en arrière-plan, ~12 posts Apify)
          { label: 'LIKES MOY. IG',       type: 'social_engagement', metric: igAvgLikes,    suffix: '♥', auditDone: engagementDone, goodThreshold: 100, warnThreshold: 20 },
          { label: 'POSTS / MOIS IG',     type: 'social_engagement', metric: igPostsMonth,  suffix: 'posts', auditDone: engagementDone, goodThreshold: 8, warnThreshold: 3 },
          ...(igTopHashtags.length > 0 ? [{ label: 'TOP HASHTAGS IG', type: 'social_hashtags', hashtags: igTopHashtags }] : []),
        ]

        return {
          kpis,
          regScore,
          regLabel,
          socialAuditDone: auditDoneSM,
          problems: [
            ...(!hasInstagram ? [prob('Instagram absent — canal visuel prioritaire non exploité', '#ef4444')] : []),
            ...(!hasFacebook  ? [prob('Facebook absent — audience locale non couverte', '#ef4444')] : []),
            ...(!hasTiktok    ? [prob('Vidéos courtes absentes — levier de croissance organique', '#f59e0b')] : []),
            ...(missingCount >= 3 ? [prob(`${missingCount} réseaux manquants sur 5 — présence digitale incomplète`, '#ef4444')] : []),
            ...(photoCount < 5 ? [prob(`Seulement ${photoCount} photo${photoCount > 1 ? 's' : ''} Google — visuels insuffisants`, '#f59e0b')] : []),
            ...(auditDoneSM && lastPost !== null && lastPost > 30 ? [prob(`Inactif depuis ${lastPost} jours — audience non engagée`, '#ef4444')] : []),
          ].slice(0, 3),
        }
      }

      case 'dev-web': {
        const auditDoneWD = !!(auditData?.pagespeed)
        const cmsRawWD    = auditData?.pagespeed?.cms
        const CMS_NAMES_WD = { wordpress: 'WordPress', shopify: 'Shopify', webflow: 'Webflow', wix: 'Wix', squarespace: 'Squarespace', jimdo: 'Jimdo' }
        const cmsNameWD   = cmsRawWD ? (CMS_NAMES_WD[cmsRawWD.cms ?? cmsRawWD] ?? cmsRawWD.cms ?? String(cmsRawWD)) : null
        const domainAgeData  = auditData?.pagespeed?.domainAge  ?? null
        const indexedDataWD  = auditData?.pagespeed?.indexedPages ?? null

        // webDev score (mirrors scoring.js webDevScore)
        let wdScore = hasWebsite ? 20 : 0
        if (psHttps)    wdScore += 15
        if (perfScore != null) wdScore += perfScore >= 80 ? 20 : perfScore >= 50 ? 10 : 5
        if (psSitemap)  wdScore += 10
        if (psRobots)   wdScore += 10
        if (psAccessibility != null && psAccessibility >= 80) wdScore += 10
        wdScore = Math.min(100, wdScore)
        const wdLabel = wdScore === 0 ? 'Inexistant' : wdScore < 30 ? 'Critique' : wdScore < 60 ? 'Basique' : wdScore < 80 ? 'Correct' : 'Optimisé'

        // Diagnostic text
        const diagLines = []
        if (!hasWebsite) {
          diagLines.push('Aucun site web — priorité absolue')
        } else {
          if (auditDoneWD && !psHttps)                              diagLines.push('HTTPS absent — site non sécurisé')
          if (perfScore != null && perfScore < 50)                  diagLines.push(`Performance critique : ${perfScore}/100`)
          else if (perfScore != null && perfScore < 70)             diagLines.push(`Performance insuffisante : ${perfScore}/100`)
          if (auditDoneWD && !psSitemap)                            diagLines.push('Sitemap XML manquant')
          if (auditDoneWD && !psRobots)                             diagLines.push('Robots.txt absent')
          if (psRenderBlocking != null && psRenderBlocking > 0)     diagLines.push(`${psRenderBlocking} ressource${psRenderBlocking > 1 ? 's' : ''} bloquant le rendu`)
        }
        const diagText = diagLines.length > 0
          ? diagLines.join(' · ')
          : auditDoneWD
            ? 'Aucun problème critique détecté'
            : 'Audit non effectué — cliquez sur "Analyser les performances"'

        // Stack recommendation
        const oldCMSWD = ['wix', 'jimdo', 'squarespace'].includes(cmsRawWD?.cms ?? cmsRawWD)
        let stackRec = hasWebsite ? 'Optimisation du site existant' : 'Création d\'un site vitrine modern'
        if (!hasWebsite)                                          stackRec = 'Site vitrine — CMS moderne ou solution sur mesure'
        else if (auditDoneWD && !psHttps && perfScore != null && perfScore < 50) stackRec = 'Refonte technique complète recommandée'
        else if (oldCMSWD)                                        stackRec = 'Migration vers une solution moderne et maintenable'
        else if (perfScore != null && perfScore < 50 && auditDoneWD) stackRec = 'Optimisation critique — cache + images + scripts'
        else if (cmsNameWD)                                       stackRec = 'Optimisation technique — cache, images, scripts'

        const kpis = [
          // Phase 1 — post-unlock
          kpi('Site web',    hasWebsite ? 'Présent' : 'Absent',              hasWebsite ? 'good' : 'danger'),
          kpi('HTTPS / SSL', auditDoneWD ? (psHttps ? 'Sécurisé' : 'Absent') : '—', auditDoneWD ? (psHttps ? 'good' : 'danger') : 'neutral'),
          kpi('Perf. mobile', perfScore != null ? `${perfScore}/100` : '—', perfScore != null ? (perfScore >= 70 ? 'good' : perfScore >= 50 ? 'warn' : 'danger') : 'neutral'),
          kpi('Chargement',  loadTimeSec ? `${loadTimeSec}s` : '—',          loadTimeSec ? (parseFloat(loadTimeSec) <= 3 ? 'good' : 'danger') : 'neutral'),
          kpi('Sitemap XML', auditDoneWD ? (psSitemap ? 'Présent' : 'Absent') : '—', auditDoneWD ? (psSitemap ? 'good' : 'warn') : 'neutral'),
          kpi('Robots.txt',  auditDoneWD ? (psRobots  ? 'Présent' : 'Absent') : '—', auditDoneWD ? (psRobots  ? 'good' : 'warn') : 'neutral'),
          { label: 'CMS DÉTECTÉ',    type: 'cms_detect',   cms: cmsNameWD, noSite: !hasWebsite, auditDone: auditDoneWD },
          { label: 'ÂGE DU DOMAINE', type: 'domainAge',    domainAge: domainAgeData },
          { label: 'PAGES INDEXÉES', type: 'indexedPages', indexedData: indexedDataWD },
          kpi('Accessibilité', psAccessibility != null ? `${Math.round(psAccessibility)}/100` : '—', psAccessibility != null ? (psAccessibility >= 80 ? 'good' : psAccessibility >= 60 ? 'warn' : 'danger') : 'neutral'),
          { type: 'webdev_full', subtype: 'diagnostic', label: 'DIAGNOSTIC TECHNIQUE', text: diagText, auditDone: auditDoneWD },
          { type: 'webdev_full', subtype: 'stack',      label: 'STACK RECOMMANDÉE',    text: stackRec },
        ]

        return {
          kpis,
          wdScore,
          wdLabel,
          problems: [
            ...(!hasWebsite                                              ? [prob('Aucun site web — les clients ne peuvent pas vous trouver en ligne', '#ef4444')] : []),
            ...(auditDoneWD && !psHttps                                  ? [prob('HTTPS absent — site non sécurisé, pénalisé par Google', '#ef4444')] : []),
            ...(perfScore != null && perfScore < 50                      ? [prob(`Performance critique : ${perfScore}/100 — taux de rebond élevé`, '#ef4444')] : []),
            ...(perfScore != null && perfScore >= 50 && perfScore < 70   ? [prob(`Performance insuffisante : ${perfScore}/100 — à optimiser`, '#f59e0b')] : []),
          ].slice(0, 3),
        }
      }

      case 'copywriter': {
        const hasReplies     = !!(lead.reviewAnalysis?.ownerReplies)
        const hasDescription = !!(lead.googleAudit?.descriptionText)
        const posKeywords    = lead.reviewAnalysis?.positive?.keywords?.length || 0

        // Données disponibles après "Analyser le contenu du site"
        const auditDoneCW    = auditState === 'done'
        const hasTitleTag    = auditData?.pagespeed?.title === 'Présente' ? true
                             : auditData?.pagespeed?.title === 'Absente'  ? false : null
        const indexedPages   = auditData?.pagespeed?.indexedPages ?? null
        const cmsDetected    = auditData?.pagespeed?.cms?.cms ?? (typeof auditData?.pagespeed?.cms === 'string' ? auditData?.pagespeed?.cms : null)
        // hasBlog : siteSignals (après analyse) prioritaire, puis unlock (enrichSocial) en fallback
        const hasBlog        = auditData?.pagespeed?.siteSignals?.hasBlog
                               ?? lead.social?.blogDetection?.hasBlog
                               ?? null

        const hasSite        = !!(lead.website)
        const domain         = lead.domain ?? lead.category ?? null

        return {
          kpis: [
            // ── 4 KPIs existants ──
            kpi('Meta description',   hasMeta ? 'Présente' : 'Absente',               hasMeta ? 'good' : 'danger'),
            kpi('Réponses avis',      hasReplies ? 'Personnalisées' : 'Absentes',      hasReplies ? 'good' : 'danger'),
            kpi('Description fiche',  hasDescription ? 'Présente' : 'Absente',        hasDescription ? 'good' : 'danger'),
            kpi('Mots-clés positifs', posKeywords > 0 ? posKeywords : '—',            posKeywords > 0 ? 'good' : 'neutral'),
            // ── 6 KPIs nouveaux ──
            kpi('Site web',           hasSite ? 'Présent' : 'Absent',                 hasSite ? 'good' : 'danger'),
            kpi('Balise title',       hasTitleTag === null ? '—' : hasTitleTag ? 'Présente' : 'Absente',
                                      hasTitleTag === null ? 'neutral' : hasTitleTag ? 'good' : 'danger',
                                      hasTitleTag === null ? 'Après analyse' : null),
            kpi('Blog détecté',       hasBlog === null ? '—' : hasBlog ? 'Oui' : 'Non (opportunité)',
                                      hasBlog === null ? 'neutral' : hasBlog ? 'warn' : 'good',
                                      hasBlog === null ? 'Après analyse' : null),
            kpi('Pages indexées',     indexedPages !== null ? indexedPages : auditDoneCW ? 'Non disponible' : '—',
                                      indexedPages !== null ? (indexedPages >= 10 ? 'good' : 'warn') : 'neutral',
                                      indexedPages === null && !auditDoneCW ? 'Après analyse' : null),
            kpi('CMS détecté',        cmsDetected ?? '—',                             cmsDetected ? 'neutral' : 'neutral',
                                      cmsDetected === null ? 'Après analyse' : null),
            kpi('Secteur',            domain ?? '—',                                  'neutral'),
          ],
          auditDoneCW,
          problems: [
            ...(!hasReplies     ? [prob("Réponses aux avis absentes — nuit à l'image", '#ef4444')] : []),
            ...(!hasMeta        ? [prob('Aucune meta description — Google affiche un texte aléatoire', '#ef4444')] : []),
            ...(!hasDescription ? [prob('Description fiche Google absente — fiche incomplète', '#f59e0b')] : []),
            ...(hasTitleTag === false ? [prob('Balise title absente ou non optimisée', '#ef4444')] : []),
            ...(hasBlog === false ? [prob('Pas de blog — aucun contenu SEO régulier', '#f59e0b')] : []),
          ],
        }
      }

      case 'email-marketing': {
        const social           = lead.social ?? {}
        // hasForm — auditData (siteSignals) prioritaire, puis social (unlock), puis googleAudit
        // Retourne null si aucune source ne dispose de données (→ affiche "—" au lieu d'"Absent")
        const hasFormAudit     = auditData?.pagespeed?.siteSignals?.hasContactForm ?? null
        const hasFormSocial    = social.contactFormDetection?.hasContactForm ?? null
        const hasFormGoogleAudit = lead.googleAudit?.hasContactForm ?? null
        const hasForm          = hasFormAudit ?? hasFormSocial ?? hasFormGoogleAudit  // null si aucune source
        const hasFormFromAudit = hasFormAudit !== null
        // hasNewsletter — unlock (enrichSocial) prioritaire, fallback sur siteSignals (après "Analyser les performances")
        const hasNewsletter    = social.newsletterDetection?.hasNewsletter ?? auditData?.pagespeed?.siteSignals?.hasNewsletter ?? null
        // Taux réponse & avis sans réponse — enrichis après chargement des 100 avis
        const ownerRatioBase   = lead.ownerReplyRatio ?? null  // sur 5 avis récents seulement
        const reviewsFull      = reviewsData !== null
        const totalFull        = reviewsData?.total      ?? null
        const unansweredFull   = reviewsData?.unanswered ?? null

        let unansweredVal, unansweredNote, unansweredStatus
        let replyRatioVal, replyRatioNote, replyRatioStatus, effectiveReplyRatio
        if (reviewsFull && totalFull != null && unansweredFull != null) {
          const answeredN     = totalFull - unansweredFull
          const ratioFull     = totalFull > 0 ? answeredN / totalFull : 0
          effectiveReplyRatio = ratioFull
          unansweredVal       = `${unansweredFull}/${totalFull}`
          unansweredNote      = null  // dataTag vert affiche déjà "données complètes"
          replyRatioVal       = `${Math.round(ratioFull * 100)}%`
          replyRatioNote      = null  // dataTag vert affiche déjà "données complètes"
          unansweredStatus    = ratioFull >= 0.7 ? 'good' : ratioFull >= 0.3 ? 'warn' : 'danger'
          replyRatioStatus    = unansweredStatus
        } else {
          effectiveReplyRatio   = ownerRatioBase
          const unansweredOf5   = ownerRatioBase != null ? 5 - Math.round(ownerRatioBase * 5) : null
          unansweredVal         = unansweredOf5 != null ? `${unansweredOf5}/5` : '—'
          unansweredNote        = unansweredOf5 != null ? '5 avis récents' : null
          replyRatioVal         = ownerRatioBase != null ? `${Math.round(ownerRatioBase * 100)}%` : '—'
          replyRatioNote        = ownerRatioBase != null ? '5 avis récents' : null
          replyRatioStatus      = ownerRatioBase != null ? (ownerRatioBase < 0.3 ? 'danger' : ownerRatioBase < 0.7 ? 'warn' : 'good') : 'neutral'
          unansweredStatus      = replyRatioStatus
        }
        const estimatedClients    = Math.round(totalReviews * 10)
        const socialNets       = [social.facebook, social.instagram, social.tiktok, social.linkedin, social.youtube, social.pinterest].filter(Boolean)
        const potentiel        = estimatedClients >= 500 ? { label: 'Fort', s: 'good' } : estimatedClients >= 100 ? { label: 'Moyen', s: 'warn' } : { label: 'Faible', s: 'danger' }

        // Audience sociale — disponible après "Analyser les performances digitales"
        const fbFollowers  = auditData?.facebookActivity?.followers  ?? null
        const igFollowers  = auditData?.instagramActivity?.followers ?? null
        const fmtFollowers = (n) => n >= 10000 ? `${Math.round(n / 1000)}k` : n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n)
        const audienceNote = (fbFollowers != null || igFollowers != null) ?
          [fbFollowers != null ? `FB ${fmtFollowers(fbFollowers)}` : null,
           igFollowers != null ? `IG ${fmtFollowers(igFollowers)}` : null].filter(Boolean).join(' · ')
          : null

        // Ancienneté depuis Pappers
        const dateCreation  = pappersData?.dateCreation ?? null
        const anciennete    = dateCreation ? (() => { const y = new Date().getFullYear() - new Date(dateCreation).getFullYear(); return y > 0 ? `${y} an${y > 1 ? 's' : ''}` : '< 1 an' })() : '—'

        // Signal 1 — Mentions fidélité dans les avis (enrichi après chargement des 100 avis)
        const loyalty        = reviewsData?.loyaltyAnalysis ?? lead.loyaltyAnalysis ?? null
        const loyaltyCount   = loyalty?.loyaltyMentions ?? 0
        const loyaltyTopics  = loyalty?.loyaltyTopics ?? []
        const loyaltyStatus  = loyaltyCount === 0 ? 'good' : loyaltyCount > 3 ? 'warn' : 'neutral'
        const loyaltyLabel   = loyaltyCount === 0 ? 'Aucune' : `${loyaltyCount} mention${loyaltyCount > 1 ? 's' : ''}`
        const loyaltySubtext = loyaltyTopics.length > 0 ? loyaltyTopics.slice(0, 2).join(', ') : null

        // Signal 2 — Fréquence de visite estimée (inline, 0 appel API)
        const catRaw = [(lead.keyword || lead.domain || ''), ...(lead.types || [])].join(' ')
          .toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        const FREQ_HIGH = ['restaurant', 'cafe', 'boulangerie', 'bakery', 'pharmacie', 'supermarche', 'epicerie', 'tabac', 'pressing', 'gym', 'sport', 'fitness', 'brasserie', 'pizz', 'burger', 'traiteur', 'bistrot']
        const FREQ_LOW  = ['avocat', 'notaire', 'comptable', 'assurance', 'immo', 'architecte', 'dentiste', 'orthodontiste', 'psy', 'psychiatre', 'psychologue']
        const visitFreq = FREQ_HIGH.some(k => catRaw.includes(k)) ? { label: 'Haute', potential: 'Très fort' }
                        : FREQ_LOW.some(k  => catRaw.includes(k)) ? { label: 'Faible', potential: 'Faible'   }
                        : { label: 'Modérée', potential: 'Fort' }
        const visitStatus = visitFreq.potential === 'Très fort' ? 'good' : visitFreq.potential === 'Fort' ? 'good' : 'warn'

        // Thèmes email-marketing — enrichis avec les 100 avis après chargement
        const emailThemesData = reviewsData?.emailThemes ?? lead.emailThemes ?? null
        const emailThemes     = emailThemesData?.themes ?? []

        // Signal 3 — Stabilité business
        const hasHours  = !!(lead.googleAudit?.hasHours)
        let stabScore   = hasHours ? 2 : 0
        if (pappersData) {
          const ca  = pappersData.chiffreAffaires ?? null
          const dc  = pappersData.dateCreation    ?? null
          const eff = pappersData.effectifs       ?? null
          if (dc) { const y = (Date.now() - new Date(dc).getTime()) / (365.25 * 24 * 3600 * 1000); stabScore += y >= 5 ? 3 : y >= 2 ? 2 : y >= 1 ? 1 : 0 }
          if (ca !== null) stabScore += ca >= 200000 ? 3 : ca >= 50000 ? 2 : 1
          if (eff !== null && eff >= 1) stabScore += 1
        }
        const stability    = stabScore >= 6 ? 'haute' : stabScore >= 3 ? 'moyenne' : 'faible'
        const canInvest    = stabScore >= 5 && (pappersData?.chiffreAffaires ?? 0) >= 50000
        const stabLabel    = stability === 'haute' ? 'Solide' : stability === 'moyenne' ? 'Correcte' : 'Incertaine'
        const stabStatus   = stability === 'haute' ? 'good' : stability === 'moyenne' ? 'warn' : 'danger'
        const stabSubtext  = canInvest ? 'Budget disponible' : null

        // Diagnostic
        const hasSite = !!(lead.website && lead.website !== 'null' && lead.website !== 'undefined')
        let diagnostic, diagnosticColor
        if (!hasSite) {
          diagnostic = 'Aucune stratégie email — mise en place complète recommandée'
          diagnosticColor = '#ef4444'
        } else if (hasSite && hasNewsletter === false) {
          diagnostic = 'Capture d\'emails inexistante — opportunité directe'
          diagnosticColor = '#f59e0b'
        } else if (hasSite && hasNewsletter === null) {
          diagnostic = 'Site présent — déverrouillez le lead pour analyser la stratégie email'
          diagnosticColor = '#64748b'
        } else if (hasNewsletter && totalReviews < 100) {
          diagnostic = 'Newsletter existante à optimiser'
          diagnosticColor = '#f59e0b'
        } else {
          diagnostic = 'Stratégie email en place — optimisation avancée possible'
          diagnosticColor = '#22c55e'
        }

        // Type campagne recommandé selon secteur
        const catLow = (lead.keyword || lead.domain || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        let campaignType
        if (/restaurant|cafe|brasserie|pizz|burger|traiteur|bistro/.test(catLow))     campaignType = 'Campagnes saisonnières + programme fidélité'
        else if (/boutique|commerce|magasin|retail|mode|vetement|bijou/.test(catLow)) campaignType = 'Emails promotionnels + relance clients inactifs'
        else if (/avocat|notaire|comptable|conseil|b2b|juridique/.test(catLow))       campaignType = 'Newsletter expertise + nurturing'
        else if (/beaute|coiffure|esthetique|soin|sante|kine|dentiste/.test(catLow))  campaignType = 'Rappels rendez-vous + offres personnalisées'
        else                                                                            campaignType = 'Séquences automatiques + fidélisation clients'

        return {
          kpis: [
            kpi('Volume avis',             totalReviews > 0 ? totalReviews : '0',           totalReviews >= 100 ? 'good' : totalReviews >= 30 ? 'warn' : 'danger'),
            kpi('Note Google',             rating > 0 ? `${rating}/5 ★` : '—',             rating >= 4 ? 'good' : rating >= 3 ? 'warn' : 'danger'),
            { ...kpi('Avis sans réponse', unansweredVal, unansweredStatus, unansweredNote), dataTag: reviewsFull ? 'données complètes' : 'estimation' },
            { ...kpi('Taux réponse',      replyRatioVal, replyRatioStatus, replyRatioNote), dataTag: reviewsFull ? 'données complètes' : 'estimation' },
            kpi('Site web',                hasSite ? 'Présent' : 'Absent',                  hasSite ? 'good' : 'danger'),
            kpi('Formulaire email',        hasForm === null ? '—' : hasForm ? 'Détecté' : 'Absent',  hasForm === null ? 'neutral' : hasForm ? 'good' : 'danger', hasFormFromAudit ? 'données audit' : null),
            kpi('Réseaux sociaux',         socialNets.length > 0 ? `${socialNets.length} réseau${socialNets.length > 1 ? 'x' : ''}` : 'Aucun', socialNets.length >= 2 ? 'good' : socialNets.length === 1 ? 'warn' : 'danger', audienceNote),
            kpi('Newsletter',              hasNewsletter === null ? '—' : hasNewsletter ? 'Détectée' : 'Absente', hasNewsletter === null ? 'neutral' : hasNewsletter ? 'warn' : 'good'),
            kpi('Secteur',                 lead.keyword || lead.domain || '—',              'neutral'),
            kpi('Ancienneté',              anciennete,                                       'neutral'),
            kpi('Clients estimés',         estimatedClients > 0 ? `~${estimatedClients}` : '—', potentiel.s),
            kpi('Potentiel fidélisation',  potentiel.label,                                 potentiel.s),
            { ...kpi('Mentions fidélité',    loyaltyLabel,                                    loyaltyStatus, loyaltySubtext), dataTag: reviewsFull ? 'données complètes' : 'estimation' },
            kpi('Fréquence visite',        visitFreq.label,                                 visitStatus,   `Potentiel ${visitFreq.potential}`),
            kpi('Stabilité business',      stabLabel,                                       stabStatus,    stabSubtext),
            { label: 'THÈMES DES AVIS', type: 'email_themes', themes: emailThemes, reviewsFull },
          ],
          problems: [
            ...(!hasSite          ? [prob('Aucun site — impossible de capturer des emails', '#ef4444')] : []),
            ...(hasNewsletter === false && hasSite ? [prob('Aucune newsletter — chaque client acquis est perdu après sa visite', '#ef4444')] : []),
            ...(hasForm === false          ? [prob('Pas de formulaire email — capture manuelle uniquement', '#f59e0b')] : []),
            ...(effectiveReplyRatio != null && effectiveReplyRatio < 0.3 ? [prob(`${Math.round((1 - effectiveReplyRatio) * 100)}% d'avis sans réponse — aucun suivi client visible`, '#f59e0b')] : []),
          ],
          // Sections supplémentaires pour l'affichage dans le panneau
          _emailExtra: { diagnostic, diagnosticColor, campaignType, hasNewsletter, estimatedClients, potentiel, loyaltyCount, visitFreq, stability, canInvest },
        }
      }

      case 'pub-google': {
        // ── Google Ads Readiness (inline — miroir de scoring.js) ──────────────────
        const domainRawAds = (lead.domain || lead.keyword || '').toLowerCase()
          .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        const hasDesc     = !!(lead.googleAudit?.hasDescription)
        const hasHours    = !!(lead.googleAudit?.hasHours)
        const negRatio    = (lead.reviewAnalysis?.negative ?? 0) / Math.max(1, totalReviews)

        let adsPoints = 0
        if (hasWebsite)               adsPoints += 20
        if (perfScore != null && perfScore >= 70) adsPoints += 20
        else if (perfScore != null && perfScore >= 50) adsPoints += 10
        if (rating >= 4.0)            adsPoints += 20
        else if (rating >= 3.5)       adsPoints += 10
        if (totalReviews >= 50)       adsPoints += 15
        else if (totalReviews >= 20)  adsPoints += 8
        if ((lead.googleAudit?.photoCount ?? 0) >= 5) adsPoints += 10
        if (hasDesc)                  adsPoints += 8
        if (hasHours)                 adsPoints += 7
        if (negRatio <= 0.15)         adsPoints += 10
        else if (negRatio <= 0.30)    adsPoints += 5
        const adsScore = Math.min(100, adsPoints)
        const adsLabel = adsScore >= 80 ? 'Idéal' : adsScore >= 60 ? 'Prêt' : adsScore >= 40 ? 'À préparer' : 'Non compatible'
        const adsStatus = adsScore >= 80 ? 'good' : adsScore >= 60 ? 'good' : adsScore >= 40 ? 'warn' : 'danger'

        // ── Concurrence sectorielle (inline) ─────────────────────────────────────
        const SECTOR_MAP_ADS = [
          { pattern: /avocat|notaire|cabinet|juridique|droit/, level: 'Très haute',  cpc: '8–25€',   budget: '1500–5000€/m' },
          { pattern: /assurance|mutuelle|courtier/,           level: 'Très haute',  cpc: '10–30€',  budget: '2000–8000€/m' },
          { pattern: /immobilier|agence immobiliere|promoteur/, level: 'Très haute', cpc: '5–20€',   budget: '1500–5000€/m' },
          { pattern: /plombier|electricien|serrurier|chauffagiste|artisan/, level: 'Haute', cpc: '4–15€', budget: '800–3000€/m' },
          { pattern: /dentiste|orthodontiste|chirurgien|clinique/, level: 'Haute', cpc: '5–18€',   budget: '1000–4000€/m' },
          { pattern: /restaurant|pizz|burger|brasserie|traiteur/, level: 'Modérée', cpc: '1–5€',   budget: '400–1500€/m' },
          { pattern: /coiffure|salon|spa|beaute|barbier/,        level: 'Modérée', cpc: '1–4€',   budget: '300–1200€/m' },
          { pattern: /garage|auto|mecanique|carrosserie/,        level: 'Haute',   cpc: '3–10€',  budget: '600–2500€/m' },
          { pattern: /hotel|gite|chambre|hebergement/,           level: 'Haute',   cpc: '3–12€',  budget: '800–3000€/m' },
          { pattern: /comptable|expert.comptable|comptabilite/,  level: 'Haute',   cpc: '4–12€',  budget: '800–2500€/m' },
        ]
        let adsConcurrence = { level: 'Faible', cpc: '0.5–2€', budget: '200–800€/m' }
        for (const s of SECTOR_MAP_ADS) {
          if (s.pattern.test(domainRawAds)) { adsConcurrence = { level: s.level, cpc: s.cpc, budget: s.budget }; break }
        }
        const concurStatus = adsConcurrence.level === 'Très haute' ? 'danger' : adsConcurrence.level === 'Haute' ? 'warn' : 'good'

        // ── KPIs (12) ─────────────────────────────────────────────────────────────
        const https = auditData?.pagespeed?.https ?? null
        const loadTime = auditData?.pagespeed?.loadTime ?? auditData?.pagespeed?.ttfb ?? null

        return {
          adsScore, adsLabel, adsStatus, adsConcurrence, concurStatus,
          kpis: [
            // Colonne 1 — Site & Perf
            kpi('Site web',        hasWebsite ? 'Présent' : 'Absent',            hasWebsite ? 'good' : 'danger'),
            kpi('Perf. mobile',    perfScore != null ? `${perfScore}/100` : '—', perfScore != null ? (perfScore >= 70 ? 'good' : perfScore >= 50 ? 'warn' : 'danger') : 'neutral'),
            kpi('HTTPS',           https != null ? (https ? 'Actif' : 'Absent') : '—', https ? 'good' : https === false ? 'danger' : 'neutral'),
            kpi('Temps de charge', loadTime != null ? `${loadTime}s` : '—',      loadTime != null ? (loadTime <= 2 ? 'good' : loadTime <= 4 ? 'warn' : 'danger') : 'neutral'),
            kpi('Sitemap XML',     auditData?.pagespeed?.sitemap != null ? (auditData.pagespeed.sitemap ? 'Présent' : 'Absent') : '—', auditData?.pagespeed?.sitemap ? 'good' : auditData?.pagespeed?.sitemap === false ? 'warn' : 'neutral'),
            kpi('Pages indexées',  auditData?.pagespeed?.indexedPages != null ? auditData.pagespeed.indexedPages : '—', auditData?.pagespeed?.indexedPages > 5 ? 'good' : auditData?.pagespeed?.indexedPages > 0 ? 'warn' : 'neutral'),
            // Colonne 2 — Fiche Google
            kpi('Note Google',     rating > 0 ? `${rating}/5` : '—',             rating >= 4 ? 'good' : rating >= 3 ? 'warn' : 'danger'),
            kpi('Volume avis',     totalReviews > 0 ? totalReviews : '0',         totalReviews >= 50 ? 'good' : totalReviews >= 20 ? 'warn' : 'danger'),
            kpi('Photos fiche',    (lead.googleAudit?.photoCount ?? 0) > 0 ? lead.googleAudit.photoCount : '0', (lead.googleAudit?.photoCount ?? 0) >= 10 ? 'good' : (lead.googleAudit?.photoCount ?? 0) >= 5 ? 'warn' : 'danger'),
            kpi('Description',     hasDesc ? 'Présente' : 'Absente',             hasDesc ? 'good' : 'warn'),
            kpi('Horaires',        hasHours ? 'Renseignés' : 'Absents',          hasHours ? 'good' : 'warn'),
            kpi('Compatibilité',   `${adsLabel} (${adsScore}/100)`,              adsStatus),
          ],
          problems: [
            ...(!hasWebsite                                 ? [prob('Aucun site pour recevoir les clics — les pubs ne peuvent pas convertir', '#ef4444')] : []),
            ...(perfScore != null && perfScore < 50         ? [prob('Landing page très lente (< 50/100) — taux de conversion effondré', '#ef4444')] : []),
            ...(perfScore != null && perfScore >= 50 && perfScore < 70 ? [prob('Performance mobile insuffisante (50-70) — coût par clic élevé', '#f59e0b')] : []),
            ...(https === false                             ? [prob('Site sans HTTPS — bloqué par les pubs Google Shopping', '#ef4444')] : []),
            ...(rating > 0 && rating < 3.5                 ? [prob('Note trop basse — les annonces perdent en crédibilité et en taux de clic', '#ef4444')] : []),
            ...(rating >= 3.5 && rating < 4.0              ? [prob('Note insuffisante (< 4★) — impact négatif sur le Quality Score', '#f59e0b')] : []),
            ...(totalReviews < 20                           ? [prob('Moins de 20 avis — crédibilité insuffisante pour convertir via pub', '#f59e0b')] : []),
            ...((lead.googleAudit?.photoCount ?? 0) < 5    ? [prob('Peu de photos fiche Google — impact sur le CTR des annonces locales', '#f59e0b')] : []),
            ...(!hasDesc                                    ? [prob('Description fiche Google absente — pénalise le Quality Score local', '#64748b')] : []),
          ],
        }
      }

      case 'designer': {
        const hasPinterest = !!(social.pinterest)

        // ── Données activité (phase 2 — après "Analyser les réseaux") ─────────────
        const igActivityD  = auditData?.instagramActivity ?? null
        const auditDoneD   = !!(igActivityD)
        const igFollowersD = igActivityD?.followers ?? null
        const igDaysAgoD   = igActivityD?.daysAgo   ?? null

        // ── Score branding (inline — scoring.js est CommonJS backend) ─────────────
        const VISUAL_NETS_D = [hasFacebook, hasInstagram, hasPinterest].filter(Boolean).length
        const BASE_D = [0, 20, 45, 75]
        let brandScore = BASE_D[Math.min(VISUAL_NETS_D, 3)]
        const hasDescD = !!(lead.googleAudit?.hasDescription)
        if (photoCount >= 10)  brandScore += 15
        else if (photoCount >= 5) brandScore += 7
        if (hasDescD)          brandScore += 10
        if (hasWebsite)        brandScore += 10
        brandScore = Math.max(0, Math.min(100, brandScore))
        const brandLabel = brandScore >= 80 ? 'Image forte' : brandScore >= 60 ? 'Image correcte' : brandScore >= 40 ? 'Image à améliorer' : brandScore >= 20 ? 'Image insuffisante' : 'Identité absente'

        // ── Recommandation sectorielle ────────────────────────────────────────────
        const domainRawD = (lead.domain || lead.keyword || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        const isRestaurantD = /restaurant|cafe|brasserie|pizz|burger|traiteur|bistrot|bar/.test(domainRawD)
        const isBeautyD     = /coiffure|salon|spa|beaute|barbier|esthetique/.test(domainRawD)
        const isRetailD     = /boutique|commerce|magasin|retail|mode|vetement|fleuriste/.test(domainRawD)
        const isArtisanD    = /artisan|menuisier|peintre|plombier|electricien|macon|couvreur/.test(domainRawD)
        let designerRec = 'Charte graphique + visuels réseaux recommandés'
        if (isRestaurantD)   designerRec = 'Shooting pro + charte graphique + templates réseaux'
        else if (isBeautyD)  designerRec = 'Visuels avant/après + identité visuelle premium'
        else if (isRetailD)  designerRec = 'Identité boutique + visuels produits + supports print/digital'
        else if (isArtisanD) designerRec = 'Logo + photos de réalisations + carte de visite pro'

        // ── Qualité photos ────────────────────────────────────────────────────────
        const photoQualityD      = photoCount === 0 ? 'Aucune' : photoCount <= 5 ? 'Insuffisant' : photoCount <= 15 ? 'Basique' : photoCount <= 30 ? 'Correct' : 'Excellent'
        const photoQualityStatus = photoCount === 0 ? 'danger' : photoCount <= 5 ? 'danger' : photoCount <= 15 ? 'warn' : 'good'

        const VISUAL_NETS_ALL = [
          { key: 'instagram', label: 'IG',  present: hasInstagram },
          { key: 'facebook',  label: 'FB',  present: hasFacebook },
          { key: 'pinterest', label: 'Pin', present: hasPinterest },
        ]

        const kpis = [
          // Phase 1 — post-unlock
          { label: 'RÉSEAUX VISUELS',        type: 'social_present', nets: VISUAL_NETS_ALL.filter(n => n.present) },
          { label: 'RÉSEAUX MANQUANTS',       type: 'social_missing', nets: VISUAL_NETS_ALL.filter(n => !n.present) },
          kpi('Photos Google',               `${photoCount} — ${photoQualityD}`, photoQualityStatus),
          kpi('Description fiche',           hasDescD ? 'Présente' : 'Absente',  hasDescD ? 'good' : 'warn'),
          kpi('Site web',                    hasWebsite ? 'Présent' : 'Absent',  hasWebsite ? 'good' : 'danger'),
          { label: 'SECTEUR',                type: 'sector_rec', sector: domainRawD ? (lead.domain || lead.keyword) : null, rec: designerRec },
          // Phase 2 — post-audit (null → "—" jusqu'au clic "Analyser les réseaux")
          { label: 'FOLLOWERS INSTAGRAM',    type: 'social_followers', network: 'Instagram', followers: igFollowersD, daysAgo: igDaysAgoD, auditDone: auditDoneD },
          { label: 'DERNIER POST IG',        type: 'social_last_post', network: 'Instagram', daysAgo: igDaysAgoD, auditDone: auditDoneD },
          kpi('Note Google',   rating != null ? `${rating}/5` : '—',  rating >= 4 ? 'good' : rating >= 3 ? 'warn' : 'danger'),
          kpi('Volume avis',   totalReviews > 0 ? totalReviews : '0', totalReviews >= 50 ? 'good' : 'warn'),
        ]

        return {
          kpis,
          brandScore,
          brandLabel,
          designerAuditDone: auditDoneD,
          problems: [
            ...(!hasInstagram  ? [prob('Instagram absent — vitrine visuelle principale manquante', '#ef4444')] : []),
            ...(photoCount < 5 ? [prob(`Seulement ${photoCount} photo${photoCount > 1 ? 's' : ''} Google — identité visuelle faible`, '#ef4444')] : []),
            ...(!hasDescD      ? [prob('Description fiche absente — personnalité de marque non exprimée', '#f59e0b')] : []),
            ...(!hasFacebook && !hasPinterest ? [prob('Aucun réseau visuel secondaire — audience limitée', '#f59e0b')] : []),
          ].slice(0, 3),
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
                Trouver le décideur — 1 crédit
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
                          {activeProfile?.id === 'copywriter' ? 'Analyser le contenu du site' : 'Analyser les performances digitales'}
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
                {/* Bandeau info email-marketing — disparaît après analyse IA */}
                {activeProfile?.id === 'email-marketing' && aiState !== 'done' && (
                  <div style={{ marginBottom: 10, padding: '10px 12px', background: 'rgba(237,250,54,0.08)', border: '1px solid rgba(237,250,54,0.2)', borderRadius: 8, display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                    <span style={{ fontSize: 14, lineHeight: 1, flexShrink: 0, marginTop: 1 }}>💡</span>
                    <span style={{ fontSize: 12, color: '#edfa36', lineHeight: 1.5 }}>Pour des données complètes sur ce lead, lancez l'analyse des avis ci-dessous</span>
                  </div>
                )}

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
                    if (kpi.type === 'social_present') {
                      const NET_COLORS = { facebook: '#1877f2', instagram: '#e1306c', linkedin: '#0a66c2', tiktok: '#010101', youtube: '#ff0000' }
                      return (
                        <div key={i} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '10px 12px' }}>
                          <div style={{ fontSize: 9, color: '#f5f5f0', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: 8 }}>{kpi.label}</div>
                          {kpi.nets.length === 0
                            ? <div style={{ fontSize: 13, color: '#ef4444', fontWeight: 700 }}>Aucun</div>
                            : <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                                {kpi.nets.map(n => (
                                  <span key={n.key} style={{ fontSize: 10.5, fontWeight: 700, color: NET_COLORS[n.key] ?? '#22c55e', background: (NET_COLORS[n.key] ?? '#22c55e') + '18', border: `1px solid ${NET_COLORS[n.key] ?? '#22c55e'}44`, borderRadius: 5, padding: '2px 8px' }}>{n.label}</span>
                                ))}
                              </div>
                          }
                        </div>
                      )
                    }
                    if (kpi.type === 'social_missing') {
                      return (
                        <div key={i} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '10px 12px' }}>
                          <div style={{ fontSize: 9, color: '#f5f5f0', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: 8 }}>{kpi.label}</div>
                          {kpi.nets.length === 0
                            ? <div style={{ fontSize: 13, color: '#22c55e', fontWeight: 700 }}>Aucun ✓</div>
                            : <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                                {kpi.nets.map(n => (
                                  <span key={n.key} style={{ fontSize: 10.5, fontWeight: 600, color: '#10bb54', background: 'rgba(16,187,84,0.08)', border: '1px solid rgba(16,187,84,0.25)', borderRadius: 5, padding: '2px 8px' }}>{n.label} +</span>
                                ))}
                              </div>
                          }
                          {kpi.nets.length > 0 && <div style={{ fontSize: 8.5, color: '#10bb54', marginTop: 5 }}>Opportunité à saisir</div>}
                        </div>
                      )
                    }
                    if (kpi.type === 'sector_rec') {
                      return (
                        <div key={i} style={{ gridColumn: '1 / -1', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '10px 12px' }}>
                          <div style={{ fontSize: 9, color: '#f5f5f0', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: 5 }}>{kpi.label}</div>
                          {kpi.sector && <div style={{ fontSize: 10, color: '#64748b', marginBottom: 4, textTransform: 'capitalize' }}>{kpi.sector}</div>}
                          <div style={{ fontSize: 11.5, fontWeight: 600, color: '#EDFA36', lineHeight: 1.3 }}>{kpi.rec}</div>
                        </div>
                      )
                    }
                    if (kpi.type === 'social_followers') {
                      const noData = !kpi.auditDone
                      const count  = kpi.followers
                      const color  = noData ? '#475569' : count === null ? '#475569' : count >= 10000 ? '#22c55e' : count >= 2000 ? '#10bb54' : count >= 500 ? '#f59e0b' : '#64748b'
                      const label  = noData ? '—' : count === null ? '—' : count.toLocaleString('fr-FR')
                      const note   = noData ? null : count === null ? null : count >= 10000 ? 'Excellent' : count >= 2000 ? 'Bon' : count >= 500 ? 'Moyen' : 'Faible'
                      return (
                        <div key={i} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '10px 12px' }}>
                          <div style={{ fontSize: 9, color: '#f5f5f0', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: 6 }}>{kpi.label}</div>
                          <div style={{ fontSize: 16, fontWeight: 700, color, lineHeight: 1.1 }}>{label}</div>
                          {note && <div style={{ fontSize: 8.5, color, marginTop: 4 }}>{note}</div>}
                        </div>
                      )
                    }
                    if (kpi.type === 'social_last_post') {
                      const noData = !kpi.auditDone
                      const days   = kpi.daysAgo
                      const color  = noData ? '#475569' : days === null ? '#ef4444' : days < 7 ? '#22c55e' : days < 30 ? '#f59e0b' : '#ef4444'
                      const label  = noData ? '—' : days === null ? 'Aucune activité' : days === 0 ? "Aujourd'hui" : `Il y a ${days}j`
                      const note   = noData ? null : days === null ? null : days < 7 ? 'Très actif' : days < 30 ? 'Actif' : 'Inactif'
                      return (
                        <div key={i} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '10px 12px' }}>
                          <div style={{ fontSize: 9, color: '#f5f5f0', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: 6 }}>{kpi.label}</div>
                          <div style={{ fontSize: 15, fontWeight: 700, color, lineHeight: 1.1 }}>{label}</div>
                          {note && <div style={{ fontSize: 8.5, color, marginTop: 4 }}>{note}</div>}
                        </div>
                      )
                    }
                    if (kpi.type === 'social_engagement') {
                      const noData = !kpi.auditDone
                      const val    = kpi.metric
                      const color  = noData ? '#475569' : val === null ? '#475569' : val >= kpi.goodThreshold ? '#22c55e' : val >= kpi.warnThreshold ? '#f59e0b' : '#ef4444'
                      const label  = noData ? '—' : val === null ? '—' : `${val.toLocaleString('fr-FR')} ${kpi.suffix}`
                      const loadingBadge = !noData && val === null && auditState === 'done'
                      return (
                        <div key={i} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '10px 12px' }}>
                          <div style={{ fontSize: 9, color: '#f5f5f0', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: 6 }}>{kpi.label}</div>
                          <div style={{ fontSize: 15, fontWeight: 700, color, lineHeight: 1.1 }}>{label}</div>
                          {loadingBadge && <div style={{ fontSize: 8, color: '#475569', marginTop: 4 }}>Chargement…</div>}
                        </div>
                      )
                    }
                    if (kpi.type === 'social_hashtags') {
                      return (
                        <div key={i} style={{ gridColumn: '1 / -1', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '10px 12px' }}>
                          <div style={{ fontSize: 9, color: '#f5f5f0', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: 8 }}>{kpi.label}</div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                            {kpi.hashtags.map((tag, ti) => (
                              <span key={ti} style={{ fontSize: 10.5, fontWeight: 600, color: '#e1306c', background: 'rgba(225,48,108,0.1)', border: '1px solid rgba(225,48,108,0.25)', borderRadius: 5, padding: '2px 8px' }}>{tag}</span>
                            ))}
                          </div>
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
                    if (kpi.type === 'question_count') {
                      const noData  = kpi.count === null
                      const ratio   = kpi.ratio ?? 0
                      const count   = kpi.count ?? 0
                      const color   = noData ? '#475569' : ratio > 10 ? '#22c55e' : count > 0 ? '#f59e0b' : '#475569'
                      const topicList = Object.entries(kpi.topics || {})
                        .sort((a, b) => b[1] - a[1]).slice(0, 2).map(([t]) => t).join(', ')
                      return (
                        <div key={i} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '10px 12px' }}>
                          <div style={{ fontSize: 9, color: '#f5f5f0', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: 6 }}>{kpi.label}</div>
                          <div style={{ fontSize: 16, fontWeight: 700, color, lineHeight: 1.1 }}>
                            {noData ? '—' : `${count} (${ratio}%)`}
                          </div>
                          {!noData && topicList && <div style={{ fontSize: 8.5, color: '#64748b', marginTop: 4, lineHeight: 1.35 }}>Sujets : {topicList}</div>}
                          {!noData && !topicList && count === 0 && <div style={{ fontSize: 8.5, color: '#475569', marginTop: 4 }}>Aucune question détectée</div>}
                        </div>
                      )
                    }
                    if (kpi.type === 'cms_detect') {
                      const CMS_LABELS = { wordpress: 'WordPress', wix: 'Wix', shopify: 'Shopify', squarespace: 'Squarespace', webflow: 'Webflow', jimdo: 'Jimdo' }
                      const noSite = kpi.noSite
                      const notYet = !kpi.auditDone && !noSite
                      const color  = noSite ? 'rgba(255,255,255,0.38)' : !kpi.auditDone ? '#475569' : kpi.cms ? '#10bb54' : '#f97316'
                      const label  = noSite ? 'Pas de site' : notYet ? '—' : kpi.cms ? (CMS_LABELS[kpi.cms] ?? kpi.cms.charAt(0).toUpperCase() + kpi.cms.slice(1)) : 'Non identifié'
                      const note   = noSite ? null : notYet ? null : kpi.cms ? 'Intégration facilitée' : 'Analyse manuelle requise'
                      return (
                        <div key={i} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '10px 12px' }}>
                          <div style={{ fontSize: 9, color: '#f5f5f0', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: 6 }}>{kpi.label}</div>
                          <div style={{ fontSize: 16, fontWeight: 700, color, lineHeight: 1.1 }}>{label}</div>
                          {note && <div style={{ fontSize: 8.5, color, marginTop: 4, lineHeight: 1.35 }}>{note}</div>}
                        </div>
                      )
                    }
                    if (kpi.type === 'faq_detect') {
                      // Non = green (opportunité — pas de FAQ existante), Oui = orange (déjà géré)
                      const noData = kpi.detected === null || kpi.detected === undefined
                      const color  = noData ? '#475569' : kpi.detected ? '#f97316' : '#10bb54'
                      return (
                        <div key={i} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '10px 12px' }}>
                          <div style={{ fontSize: 9, color: '#f5f5f0', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: 6 }}>{kpi.label}</div>
                          <div style={{ fontSize: 16, fontWeight: 700, color, lineHeight: 1.1 }}>
                            {noData ? '—' : kpi.detected ? 'Oui' : 'Non'}
                          </div>
                          {!noData && <div style={{ fontSize: 8.5, color, marginTop: 4, lineHeight: 1.35 }}>
                            {kpi.detected ? 'Déjà gérée — angle complémentaire' : 'Aucune FAQ — opportunité directe'}
                          </div>}
                        </div>
                      )
                    }
                    if (kpi.type === 'domain_complexity') {
                      const STAR_MAP   = { simple: 2, medium: 3, complex: 5 }
                      const LABEL_MAP  = { simple: 'Simple', medium: 'Standard', complex: 'Avancé' }
                      const COLOR_MAP  = { simple: '#64748b', medium: '#f59e0b', complex: '#22c55e' }
                      const NOTE_MAP   = { simple: 'Opportunité réduite', medium: 'Potentiel modéré', complex: 'Fort potentiel FAQ / chatbot' }
                      const noData     = !kpi.complexity
                      const starCount  = STAR_MAP[kpi.complexity] ?? 0
                      const c          = COLOR_MAP[kpi.complexity] ?? '#475569'
                      const stars      = noData ? null : Array.from({ length: 5 }, (_, idx) => (
                        <span key={idx} style={{ color: idx < starCount ? '#edfa36' : 'rgba(255,255,255,0.2)', fontSize: 14, lineHeight: 1 }}>★</span>
                      ))
                      return (
                        <div key={i} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '10px 12px' }}>
                          <div style={{ fontSize: 9, color: '#f5f5f0', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: 6 }}>{kpi.label}</div>
                          {noData
                            ? <div style={{ fontSize: 16, fontWeight: 700, color: '#475569', lineHeight: 1.1 }}>—</div>
                            : <>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, lineHeight: 1 }}>{stars}
                                  <span style={{ fontSize: 12, fontWeight: 600, color: c, marginLeft: 2 }}>{LABEL_MAP[kpi.complexity]}</span>
                                </div>
                                <div style={{ fontSize: 8.5, color: c, marginTop: 5, lineHeight: 1.35 }}>{NOTE_MAP[kpi.complexity]}</div>
                              </>
                          }
                        </div>
                      )
                    }
                    if (kpi.type === 'form_detect') {
                      const noData = kpi.detected === null || kpi.detected === undefined
                      const color  = noData ? '#475569' : kpi.detected ? '#22c55e' : '#475569'
                      return (
                        <div key={i} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '10px 12px' }}>
                          <div style={{ fontSize: 9, color: '#f5f5f0', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: 6 }}>{kpi.label}</div>
                          <div style={{ fontSize: 16, fontWeight: 700, color, lineHeight: 1.1 }}>
                            {noData ? '—' : kpi.detected ? 'Présent' : 'Absent'}
                          </div>
                          {!noData && <div style={{ fontSize: 8.5, color, marginTop: 4, lineHeight: 1.35 }}>
                            {kpi.detected ? 'Canal existant — chatbot en complément' : 'Aucun formulaire — besoin non couvert'}
                          </div>}
                        </div>
                      )
                    }
                    if (kpi.type === 'phone_mentions') {
                      const noData = kpi.mentions === null
                      const color  = noData ? '#475569' : kpi.hasDifficulty ? '#ef4444' : kpi.mentions > 0 ? '#f59e0b' : '#475569'
                      return (
                        <div key={i} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '10px 12px' }}>
                          <div style={{ fontSize: 9, color: '#f5f5f0', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: 6 }}>{kpi.label}</div>
                          <div style={{ fontSize: 16, fontWeight: 700, color, lineHeight: 1.1 }}>
                            {noData ? '—' : kpi.mentions > 0 ? `${kpi.mentions} mention${kpi.mentions > 1 ? 's' : ''}` : 'Aucune'}
                          </div>
                          {!noData && kpi.hasDifficulty && <div style={{ fontSize: 8.5, color, marginTop: 4, lineHeight: 1.35 }}>Difficulté à joindre — chatbot prioritaire</div>}
                          {!noData && !kpi.hasDifficulty && kpi.mentions > 0 && <div style={{ fontSize: 8.5, color, marginTop: 4 }}>Mentions neutres</div>}
                        </div>
                      )
                    }
                    if (kpi.type === 'off_hours') {
                      const noData = kpi.hasNeed === null
                      const color  = noData ? '#475569' : kpi.hasNeed ? '#a78bfa' : '#475569'
                      return (
                        <div key={i} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '10px 12px' }}>
                          <div style={{ fontSize: 9, color: '#f5f5f0', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: 6 }}>{kpi.label}</div>
                          <div style={{ fontSize: 16, fontWeight: 700, color, lineHeight: 1.1 }}>
                            {noData ? '—' : kpi.hasNeed ? `${kpi.count} avis (${kpi.ratio}%)` : 'Aucune'}
                          </div>
                          {!noData && kpi.hasNeed && <div style={{ fontSize: 8.5, color, marginTop: 4, lineHeight: 1.35 }}>Demande hors horaires — disponibilité 24/7</div>}
                        </div>
                      )
                    }
                    if (kpi.type === 'languages') {
                      const noData = kpi.isMultilingual === null
                      const color  = noData ? '#475569' : kpi.isMultilingual ? '#22c55e' : '#64748b'
                      const langList = (kpi.languages || ['fr']).filter(l => l !== 'fr').join(', ').toUpperCase()
                      return (
                        <div key={i} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '10px 12px' }}>
                          <div style={{ fontSize: 9, color: '#f5f5f0', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: 6 }}>{kpi.label}</div>
                          <div style={{ fontSize: 16, fontWeight: 700, color, lineHeight: 1.1 }}>
                            {noData ? '—' : kpi.isMultilingual ? `FR + ${langList}` : 'FR uniquement'}
                          </div>
                          {!noData && kpi.isMultilingual && <div style={{ fontSize: 8.5, color, marginTop: 4, lineHeight: 1.35 }}>{kpi.foreignRatio}% d'avis étrangers — chatbot multi-langue</div>}
                        </div>
                      )
                    }
                    if (kpi.type === 'rag_type') {
                      const noData = !kpi.ragType
                      const color  = noData ? '#475569' : (kpi.ragType?.color ?? '#64748b')
                      return (
                        <div key={i} style={{ gridColumn: '1 / -1', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '10px 12px' }}>
                          <div style={{ fontSize: 9, color: '#f5f5f0', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: 6 }}>{kpi.label}</div>
                          <div style={{ fontSize: 13, fontWeight: 700, color, lineHeight: 1.2 }}>
                            {noData ? '—' : kpi.ragType.label}
                          </div>
                        </div>
                      )
                    }
                    if (kpi.type === 'monthly_conv') {
                      const noData = kpi.count === null
                      const color  = noData ? '#475569' : kpi.count >= 100 ? '#22c55e' : kpi.count >= 30 ? '#f59e0b' : '#64748b'
                      return (
                        <div key={i} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '10px 12px' }}>
                          <div style={{ fontSize: 9, color: '#f5f5f0', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: 6 }}>{kpi.label}</div>
                          <div style={{ fontSize: 16, fontWeight: 700, color, lineHeight: 1.1 }}>
                            {noData ? '—' : `~${kpi.count}`}
                          </div>
                          {!noData && <div style={{ fontSize: 8.5, color: '#64748b', marginTop: 4 }}>Estimation basée sur le volume d'avis</div>}
                        </div>
                      )
                    }
                    if (kpi.type === 'stack_rec') {
                      const noData = !kpi.stack
                      return (
                        <div key={i} style={{ gridColumn: '1 / -1', background: 'rgba(29,110,85,0.06)', border: '1px solid rgba(29,110,85,0.2)', borderRadius: 12, padding: '10px 12px' }}>
                          <div style={{ fontSize: 9, color: '#1d6e55', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: 6 }}>{kpi.label}</div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: '#4ade80', lineHeight: 1.2 }}>
                            {noData ? '—' : kpi.stack}
                          </div>
                        </div>
                      )
                    }
                    if (kpi.type === 'webdev_full') {
                      const isStack    = kpi.subtype === 'stack'
                      const accentClr  = isStack ? '#00d4ff' : '#0ea5e9'
                      return (
                        <div key={i} style={{ gridColumn: '1 / -1', background: isStack ? 'rgba(0,212,255,0.06)' : 'rgba(14,165,233,0.06)', border: `1px solid ${accentClr}30`, borderRadius: 12, padding: '10px 12px' }}>
                          <div style={{ fontSize: 9, color: accentClr, letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: 5 }}>{kpi.label}</div>
                          <div style={{ fontSize: 11.5, fontWeight: 600, color: isStack ? '#00d4ff' : '#e2e8f0', lineHeight: 1.4 }}>{kpi.text}</div>
                          {!isStack && !kpi.auditDone && <div style={{ fontSize: 9, color: '#475569', marginTop: 4 }}>Effectuez l'audit de performance pour un diagnostic complet</div>}
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
                    if (kpi.type === 'email_themes') {
                      const themes = kpi.themes ?? []
                      return (
                        <div key={i} style={{ gridColumn: '1 / -1', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '10px 12px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                            <div style={{ fontSize: 9, color: '#f5f5f0', letterSpacing: '1.5px', textTransform: 'uppercase' }}>{kpi.label}</div>
                            <div style={{ fontSize: 8, fontStyle: 'italic', color: kpi.reviewsFull ? '#10bb54' : 'rgba(255,255,255,0.38)' }}>({kpi.reviewsFull ? 'données complètes' : 'estimation'})</div>
                          </div>
                          {themes.length > 0
                            ? <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                                {themes.map(({ label, count, type }) => {
                                  const isPositif = type === 'positif'
                                  const c  = isPositif ? '#10bb54' : '#edfa36'
                                  const bg = isPositif ? 'rgba(16,187,84,0.08)' : 'rgba(237,250,54,0.08)'
                                  const bd = isPositif ? 'rgba(16,187,84,0.25)' : 'rgba(237,250,54,0.25)'
                                  return (
                                    <span key={label} style={{ fontSize: 10.5, color: c, background: bg, border: `1px solid ${bd}`, borderRadius: 5, padding: '2px 8px' }}>
                                      {label} <span style={{ opacity: 0.55 }}>×{count}</span>
                                    </span>
                                  )
                                })}
                              </div>
                            : <div style={{ fontSize: 12, color: '#475569', fontStyle: 'italic' }}>Aucun thème détecté dans les avis</div>
                          }
                        </div>
                      )
                    }
                    if (kpi.type === 'topic_list') {
                      const hasTopics = (kpi.topics || []).length > 0
                      return (
                        <div key={i} style={{ gridColumn: '1 / -1', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '10px 12px' }}>
                          <div style={{ fontSize: 9, color: '#f5f5f0', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: 6 }}>{kpi.label}</div>
                          {hasTopics
                            ? <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                                {kpi.topics.map(([topic, count]) => (
                                  <span key={topic} style={{ fontSize: 10.5, color: '#f59e0b', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 5, padding: '2px 8px' }}>
                                    {topic} <span style={{ opacity: 0.6 }}>×{count}</span>
                                  </span>
                                ))}
                              </div>
                            : <div style={{ fontSize: 13, color: '#475569', fontStyle: 'italic' }}>Aucun thème détecté</div>
                          }
                        </div>
                      )
                    }
                    return (
                      <div key={i} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, padding: '10px 12px' }}>
                        <div style={{ fontSize: 9, color: '#f5f5f0', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: 6 }}>{kpi.label}</div>
                        <div style={{ fontSize: 16, fontWeight: 700, color: STATUS_COLOR[kpi.status] || '#64748b', lineHeight: 1.1 }}>{kpi.value}</div>
                        {kpi.note && <div style={{ fontSize: 8.5, color: '#f59e0b', marginTop: 4, lineHeight: 1.35 }}>{kpi.note}</div>}
                        {kpi.dataTag && <div style={{ fontSize: 8, marginTop: 3, color: kpi.dataTag === 'données complètes' ? '#10bb54' : 'rgba(255,255,255,0.38)', fontStyle: 'italic', lineHeight: 1.2 }}>({kpi.dataTag})</div>}
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

                {/* SCORE RÉGULARITÉ + RECOMMANDATION — social-media uniquement */}
                {activeProfile?.id === 'social-media' && (() => {
                  const rs    = profileData.regScore ?? 0
                  const rl    = profileData.regLabel ?? '—'
                  const rc    = rs >= 60 ? '#22c55e' : rs >= 40 ? '#f59e0b' : '#ef4444'
                  const adSM  = profileData.socialAuditDone
                  // Social recommendation (same logic as scoring.js getSocialRecommendation, inline)
                  const domainRaw2 = (lead.domain || lead.keyword || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
                  const isResto2   = /restaurant|cafe|brasserie|pizz|burger|traiteur|bistrot|bar/.test(domainRaw2)
                  const isBeauty2  = /coiffure|salon|spa|beaute|barbier|esthetique/.test(domainRaw2)
                  const isB2B2     = /avocat|notaire|comptable|assurance|cabinet|immo|consulting|finance/.test(domainRaw2)
                  const isRetail2  = /boutique|commerce|magasin|retail|mode|vetement|fleuriste/.test(domainRaw2)
                  const isHealth2  = /medecin|docteur|kine|psy|sante|pharmacie|dentiste/.test(domainRaw2)
                  const hasFB2  = !!(lead.social?.facebook)
                  const hasIG2  = !!(lead.social?.instagram)
                  const hasLI2  = !!(lead.social?.linkedin)
                  let recPriority = 'Développer l\'audience et augmenter l\'engagement'
                  let recPrice    = '200-350€/mois'
                  if (isResto2 && !hasIG2)       { recPriority = 'Créer et animer un compte photo + vidéos courtes'; recPrice = '300-600€/mois' }
                  else if (isBeauty2 && !hasIG2) { recPriority = 'Créer une présence visuelle forte'; recPrice = '300-600€/mois' }
                  else if (isB2B2 && !hasLI2)    { recPriority = 'Créer une présence professionnelle et articles de fond'; recPrice = '400-800€/mois' }
                  else if (isRetail2 && !hasFB2 && !hasIG2) { recPriority = 'Créer une présence sociale pour la boutique'; recPrice = '250-500€/mois' }
                  else if (isHealth2 && !hasFB2) { recPriority = 'Créer une page professionnelle rassurante'; recPrice = '300-600€/mois' }
                  return (
                    <div style={{ marginBottom: 8 }}>
                      <div style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '10px 12px', marginBottom: 6 }}>
                        <div style={{ fontSize: 9, color: '#f5f5f0', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: 6 }}>SCORE RÉGULARITÉ</div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                          <span style={{ fontSize: 12, fontWeight: 700, color: rc }}>{rl}</span>
                          <span style={{ fontSize: 16, fontWeight: 900, color: rc }}>{rs}/100</span>
                        </div>
                        <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 3, height: 5, overflow: 'hidden' }}>
                          <div style={{ width: `${rs}%`, height: '100%', background: rc, borderRadius: 3 }} />
                        </div>
                      </div>
                      {adSM && (
                        <div style={{ background: 'rgba(29,110,85,0.06)', border: '1px solid rgba(29,110,85,0.2)', borderRadius: 12, padding: '10px 12px' }}>
                          <div style={{ fontSize: 9, color: '#1d6e55', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: 5 }}>RECOMMANDATION</div>
                          <div style={{ fontSize: 12, fontWeight: 700, color: '#4ade80', lineHeight: 1.3, marginBottom: 4 }}>{recPriority}</div>
                          <div style={{ fontSize: 10, color: '#64748b' }}>Budget estimé : {recPrice}</div>
                        </div>
                      )}
                    </div>
                  )
                })()}

                {/* AUDIT RÉSEAUX + PDF — social-media uniquement */}
                {activeProfile?.id === 'social-media' && (() => {
                  if (auditState === 'idle' && !lead.social?.facebook && !lead.social?.instagram)
                    return <div style={{ fontSize: 11, color: '#475569', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 6, padding: '7px 12px', marginBottom: 8, textAlign: 'center' }}>Pas de réseaux détectés — analyse impossible</div>
                  if (auditState === 'idle')
                    return <button className="ld-btn" onClick={handleAnalyzePerformance} style={{ width: '100%', height: 28, borderRadius: 6, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.02)', color: '#64748b', fontSize: 10.5, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, marginBottom: 8 }}>Analyser les réseaux — followers + activité</button>
                  if (auditState === 'loading')
                    return <div style={{ height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10.5, color: '#64748b', marginBottom: 8 }}>Récupération en cours…</div>
                  return null
                })()}


                {/* ANALYSER LE CONTENU — copywriter uniquement, inline sous les KPIs */}
                {activeProfile?.id === 'copywriter' && lead.website && (() => {
                  if (auditState === 'idle')
                    return (
                      <button className="ld-btn" onClick={handleAnalyzePerformance}
                        style={{ width: '100%', height: 28, borderRadius: 6, border: '1px solid rgba(29,110,85,0.25)', background: 'rgba(29,110,85,0.08)', color: '#1d6e55', fontSize: 10.5, fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, marginBottom: 10 }}>
                        Analyser le contenu du site — 1 crédit
                      </button>
                    )
                  if (auditState === 'loading')
                    return <div style={{ height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10.5, color: '#64748b', marginBottom: 10 }}>Analyse en cours…</div>
                  return null
                })()}

                {/* SCORE IMAGE DE MARQUE + RECOMMANDATION — designer uniquement */}
                {activeProfile?.id === 'designer' && (() => {
                  const bs = profileData.brandScore ?? 0
                  const bl = profileData.brandLabel ?? '—'
                  const bc = bs >= 60 ? '#22c55e' : bs >= 40 ? '#f59e0b' : '#ef4444'
                  const adD = profileData.designerAuditDone
                  const photoCountD = lead.googleAudit?.photoCount ?? 0
                  // Designer recommendation (inline)
                  const domainRawD2 = (lead.domain || lead.keyword || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
                  const isResto3    = /restaurant|cafe|brasserie|pizz|burger|traiteur|bistrot|bar/.test(domainRawD2)
                  const isBeauty3   = /coiffure|salon|spa|beaute|barbier|esthetique/.test(domainRawD2)
                  const isRetail3   = /boutique|commerce|magasin|retail|mode|vetement|fleuriste/.test(domainRawD2)
                  const isArtisan3  = /artisan|menuisier|peintre|plombier|electricien|macon|couvreur/.test(domainRawD2)
                  const hasIG3  = !!(lead.social?.instagram)
                  const hasSite3 = !!(lead.website && lead.website !== 'null' && lead.website !== 'undefined')
                  let designerPriority = 'Optimiser et renforcer l\'identité visuelle existante'
                  let designerPrice    = '400–900€'
                  if (isResto3 && photoCountD < 5)             { designerPriority = 'Créer une identité visuelle forte pour la fiche Google'; designerPrice = '800–2000€' }
                  else if (isResto3 && !hasIG3)                { designerPriority = 'Déployer l\'identité visuelle sur Instagram'; designerPrice = '500–1200€' }
                  else if (isBeauty3 && !hasSite3 && !hasIG3)  { designerPriority = 'Créer une identité visuelle complète'; designerPrice = '1000–2500€' }
                  else if (isRetail3 && !hasSite3)             { designerPriority = 'Créer une identité digitale cohérente'; designerPrice = '800–2000€' }
                  else if (isArtisan3)                         { designerPriority = 'Créer une image professionnelle et rassurante'; designerPrice = '600–1500€' }
                  else if (photoCountD < 5)                    { designerPriority = 'Créer des visuels professionnels pour améliorer la perception'; designerPrice = '600–1500€' }
                  return (
                    <div style={{ marginBottom: 8 }}>
                      <div style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '10px 12px', marginBottom: 6 }}>
                        <div style={{ fontSize: 9, color: '#f5f5f0', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: 6 }}>SCORE IMAGE DE MARQUE</div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                          <span style={{ fontSize: 12, fontWeight: 700, color: bc }}>{bl}</span>
                          <span style={{ fontSize: 16, fontWeight: 900, color: bc }}>{bs}/100</span>
                        </div>
                        <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 3, height: 5, overflow: 'hidden' }}>
                          <div style={{ width: `${bs}%`, height: '100%', background: bc, borderRadius: 3 }} />
                        </div>
                      </div>
                      {adD && (
                        <div style={{ background: 'rgba(167,139,250,0.06)', border: '1px solid rgba(167,139,250,0.2)', borderRadius: 12, padding: '10px 12px' }}>
                          <div style={{ fontSize: 9, color: '#a78bfa', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: 5 }}>RECOMMANDATION</div>
                          <div style={{ fontSize: 12, fontWeight: 700, color: '#c4b5fd', lineHeight: 1.3, marginBottom: 4 }}>{designerPriority}</div>
                          <div style={{ fontSize: 10, color: '#64748b' }}>Budget estimé : {designerPrice}</div>
                        </div>
                      )}
                    </div>
                  )
                })()}

                {/* SCORE TECHNIQUE — dev-web uniquement */}
                {activeProfile?.id === 'dev-web' && (() => {
                  const ws = profileData.wdScore ?? 0
                  const wl = profileData.wdLabel ?? '—'
                  const wc = ws >= 80 ? '#22c55e' : ws >= 60 ? '#f59e0b' : '#ef4444'
                  return (
                    <div style={{ marginBottom: 8 }}>
                      <div style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '10px 12px' }}>
                        <div style={{ fontSize: 9, color: '#f5f5f0', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: 6 }}>SCORE TECHNIQUE</div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                          <span style={{ fontSize: 12, fontWeight: 700, color: wc }}>{wl}</span>
                          <span style={{ fontSize: 16, fontWeight: 900, color: wc }}>{ws}/100</span>
                        </div>
                        <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 3, height: 5, overflow: 'hidden' }}>
                          <div style={{ width: `${ws}%`, height: '100%', background: wc, borderRadius: 3 }} />
                        </div>
                      </div>
                    </div>
                  )
                })()}

                {/* AUDIT RÉSEAUX — designer (reuse handleAnalyzePerformance) */}
                {activeProfile?.id === 'designer' && (() => {
                  if (auditState === 'idle' && !lead.social?.instagram && !lead.social?.facebook)
                    return <div style={{ fontSize: 11, color: '#475569', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 6, padding: '7px 12px', marginBottom: 8, textAlign: 'center' }}>Pas de réseaux visuels détectés — analyse impossible</div>
                  if (auditState === 'idle')
                    return <button className="ld-btn" onClick={handleAnalyzePerformance} style={{ width: '100%', height: 28, borderRadius: 6, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.02)', color: '#64748b', fontSize: 10.5, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, marginBottom: 8 }}>Analyser les réseaux — followers Instagram</button>
                  if (auditState === 'loading')
                    return <div style={{ height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10.5, color: '#64748b', marginBottom: 8 }}>Récupération en cours…</div>
                  return null
                })()}

                {/* TYPE DE CHATBOT + STACK RECOMMANDÉ — chatbot uniquement, juste avant le bouton audit */}
                {['chatbot', 'dev-chatbot'].includes(activeProfile?.id) && (() => {
                  const ragType = lead.recommendedRAGType ?? null
                  const stack   = lead.recommendedStack   ?? null
                  if (!ragType && !stack) return null
                  return (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                      {ragType && (
                        <div style={{ gridColumn: '1 / -1', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '10px 12px' }}>
                          <div style={{ fontSize: 9, color: '#f5f5f0', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: 6 }}>TYPE DE CHATBOT</div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: ragType.color ?? '#64748b', lineHeight: 1.2 }}>{ragType.label}</div>
                        </div>
                      )}
                      {stack && (
                        <div style={{ gridColumn: '1 / -1', background: 'rgba(29,110,85,0.06)', border: '1px solid rgba(29,110,85,0.2)', borderRadius: 12, padding: '10px 12px' }}>
                          <div style={{ fontSize: 9, color: '#1d6e55', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: 6 }}>STACK RECOMMANDÉ</div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: '#4ade80', lineHeight: 1.2 }}>{stack}</div>
                        </div>
                      )}
                    </div>
                  )
                })()}

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

                {/* ── EMAIL MARKETING — diagnostic + campagne + audit IA ── */}
                {activeProfile?.id === 'email-marketing' && (() => {
                  const extra = profileData._emailExtra
                  if (!extra) return null
                  return (
                    <div style={{ marginBottom: 8 }}>
                      {/* Diagnostic */}
                      <div style={{ borderLeft: `3px solid ${extra.diagnosticColor}`, borderRadius: '0 8px 8px 0', background: `${extra.diagnosticColor}12`, padding: '8px 12px', marginBottom: 6 }}>
                        <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase', color: extra.diagnosticColor, marginBottom: 4 }}>DIAGNOSTIC EMAIL</div>
                        <div style={{ fontSize: 12, color: '#cbd5e1', lineHeight: 1.45 }}>{extra.diagnostic}</div>
                      </div>
                      {/* Type de campagne recommandé */}
                      <div style={{ background: 'rgba(29,110,85,0.06)', border: '1px solid rgba(29,110,85,0.2)', borderRadius: 8, padding: '8px 12px', marginBottom: 8 }}>
                        <div style={{ fontSize: 9, color: '#1d6e55', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: 4 }}>TYPE DE CAMPAGNE RECOMMANDÉ</div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: '#4ade80', lineHeight: 1.3 }}>{extra.campaignType}</div>
                      </div>
                    </div>
                  )
                })()}

                {/* Diagnostic pub-google */}
                {activeProfile?.id === 'pub-google' && (() => {
                  const adsScore  = profileData.adsScore  ?? 0
                  const adsLabel  = profileData.adsLabel  ?? '—'
                  const adsStatus = profileData.adsStatus ?? 'neutral'
                  const conc      = profileData.adsConcurrence ?? { level: '—', cpc: '—', budget: '—' }
                  const concStatus = profileData.concurStatus ?? 'neutral'
                  const scoreColor = adsStatus === 'good' ? '#22c55e' : adsStatus === 'warn' ? '#f59e0b' : '#ef4444'
                  const concColor  = concStatus === 'good' ? '#22c55e' : concStatus === 'warn' ? '#f59e0b' : '#ef4444'
                  return (
                    <div style={{ marginBottom: 8 }}>
                      {/* Compatibilité Google Ads */}
                      <div style={{ borderLeft: `3px solid ${scoreColor}`, borderRadius: '0 8px 8px 0', background: `${scoreColor}12`, padding: '8px 12px', marginBottom: 6 }}>
                        <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase', color: scoreColor, marginBottom: 4 }}>COMPATIBILITÉ GOOGLE ADS</div>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                          <span style={{ fontSize: 22, fontWeight: 700, color: scoreColor, fontFamily: 'var(--font-display)' }}>{adsScore}/100</span>
                          <span style={{ fontSize: 13, fontWeight: 600, color: scoreColor }}>{adsLabel}</span>
                        </div>
                      </div>
                      {/* Concurrence sectorielle */}
                      <div style={{ background: 'rgba(14,165,233,0.07)', border: '1px solid rgba(14,165,233,0.2)', borderRadius: 8, padding: '8px 12px', marginBottom: 8 }}>
                        <div style={{ fontSize: 9, color: '#0ea5e9', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: 6 }}>CONCURRENCE SECTORIELLE</div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                          <div>
                            <div style={{ fontSize: 9, color: '#475569', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: 3 }}>NIVEAU</div>
                            <div style={{ fontSize: 12, fontWeight: 700, color: concColor }}>{conc.level}</div>
                          </div>
                          <div>
                            <div style={{ fontSize: 9, color: '#475569', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: 3 }}>CPC ESTIMÉ</div>
                            <div style={{ fontSize: 12, fontWeight: 700, color: '#f5f5f0', fontFamily: 'var(--font-mono)' }}>{conc.cpc}</div>
                          </div>
                          <div>
                            <div style={{ fontSize: 9, color: '#475569', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: 3 }}>BUDGET REC.</div>
                            <div style={{ fontSize: 11, fontWeight: 600, color: '#94a3b8', fontFamily: 'var(--font-mono)' }}>{conc.budget}</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
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
                    Récupérer données SEMrush — 1 crédit
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

          {/* ── ANALYSE VISUELLE IA ── designer / photographe / dev-web uniquement */}
          {['designer', 'photographe', 'dev-web'].includes(activeProfile?.id) && lead.website && (() => {
            const isDevWeb      = activeProfile?.id === 'dev-web'
            const ZONE_OPTIONS  = [
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

                {/* Sélecteur de zone — masqué pour dev-web (auto-déclenché après audit perf) */}
                {!isDevWeb && (
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
                )}

                {/* Bouton lancer — masqué pour dev-web (a son propre bouton cyan ci-dessous) */}
                {!isDevWeb && (
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
                )}

                {/* Spinner dev-web (analyse auto après PageSpeed) */}
                {isDevWeb && visualLoading && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 0', marginBottom: 8, fontSize: 11, color: '#64748b' }}>
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ animation: 'spin 1s linear infinite', flexShrink: 0 }}>
                      <circle cx="7" cy="7" r="5.5" stroke="rgba(29,110,85,0.3)" strokeWidth="2"/>
                      <path d="M7 1.5A5.5 5.5 0 0 1 12.5 7" stroke="#1D6E55" strokeWidth="2" strokeLinecap="round"/>
                    </svg>
                    Capture du site en cours… (déclenché automatiquement)
                  </div>
                )}

                {/* dev-web : bouton si analyse pas encore lancée */}
                {isDevWeb && !visualLoading && !visualAnalysis && !visualError && (
                  <button onClick={handleVisualAnalysis} disabled={visualLoading}
                    style={{ width: '100%', height: 36, borderRadius: 10, border: '1px solid rgba(14,165,233,0.3)', background: 'rgba(14,165,233,0.08)', color: '#0ea5e9', fontSize: 11.5, fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 8 }}>
                    Analyser visuellement le site — 1 crédit
                  </button>
                )}

                {/* Erreur */}
                {visualError && (
                  <div style={{ padding: '8px 11px', background: 'rgba(239,68,68,0.06)', borderLeft: '3px solid #ef4444', borderRadius: '0 8px 8px 0', fontSize: 10.5, color: '#fca5a5', lineHeight: 1.5, marginBottom: 8 }}>
                    ⚠ {visualError.includes('ne permet pas') || visualError.includes('bloque') ? 'Ce site bloque les captures automatiques' : visualError.includes('indisponible') ? 'Capture indisponible — réessayez dans quelques secondes' : visualError}
                  </div>
                )}

                {/* Résultat */}
                {visualAnalysis && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {/* Screenshot — dev-web uniquement (backend l'inclut dans la réponse) */}
                    {visualAnalysis.screenshot && (
                      <div style={{ borderRadius: 8, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)', maxHeight: 180, position: 'relative' }}>
                        <img
                          src={`data:image/png;base64,${visualAnalysis.screenshot}`}
                          alt="Screenshot du site"
                          style={{ width: '100%', display: 'block', objectFit: 'cover', objectPosition: 'top' }}
                        />
                        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 40, background: 'linear-gradient(to bottom, transparent, rgba(10,20,30,0.7))' }} />
                      </div>
                    )}
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

          <ReviewsSection
            lead={lead}
            reviewsState={reviewsState}   setReviewsState={setReviewsState}
            reviewsData={reviewsData}     setReviewsData={setReviewsData}
            aiState={aiState}             setAiState={setAiState}
            aiError={aiError}
            aiReport={aiReport}
            pdfLoading={pdfLoading}
            onExportPDF={handleExportPDF}
            onReviewsLoaded={handleAnalyzeAI}
            onAnalyzeAI={handleAnalyzeAI}
          />

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
          {!['seo', 'consultant-seo', 'dev-web', 'pub-google', 'photographe', 'chatbot', 'dev-chatbot', 'email-marketing', 'copywriter'].includes(activeProfile?.id) && auditState === 'idle' && (lead.website || lead.social?.facebook || lead.social?.instagram) && (
            <div style={{ marginBottom: 20 }}>
              <button className="ld-btn" onClick={handleAnalyzePerformance} style={{ width: '100%', height: 40, borderRadius: 10, border: '1px solid rgba(29,110,85,0.25)', background: 'rgba(29,110,85,0.12)', color: '#1d6e55', fontSize: 12, fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                {activeProfile?.id === 'copywriter' ? 'Analyser le contenu du site — 1 crédit' : 'Analyser les performances digitales — 1 crédit'}
              </button>
            </div>
          )}
          {!['seo', 'consultant-seo', 'dev-web', 'pub-google', 'photographe', 'email-marketing', 'copywriter'].includes(activeProfile?.id) && auditState === 'loading' && (
            <div style={{ marginBottom: 20, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: '#64748b' }}>Audit en cours…</div>
          )}

          {/* ── EMAIL IA + AUDIT PDF ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>

            <AIEmailGenerator
              key={leadId}
              lead={lead}
              activeProfile={activeProfile}
              aiReport={aiReport}
              aiEmail={aiEmail}
              onEmailGenerated={setAiEmail}
              visualAnalysis={visualAnalysis}
              visualError={visualError}
              auditState={auditState}
              auditData={auditData}
              reviewsData={reviewsData}
              photoQuality={photoQuality}
            />

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

            {/* Audit PDF — bouton universel pour tous les profils */}
            <AuditPanel
              key={leadId}
              lead={lead}
              activeProfile={activeProfile}
              activeWeights={activeWeights}
              aiReport={aiReport}
              auditData={auditData}
              reviewsData={reviewsData}
              semrushData={semrushData}
              visualAnalysis={visualAnalysis}
            />

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
