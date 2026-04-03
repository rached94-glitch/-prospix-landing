import { useState, useEffect, Component } from 'react'
import './App.css'

class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { error: null } }
  static getDerivedStateFromError(error) { return { error } }
  componentDidCatch(error, info) { console.error('App crash:', error, info.componentStack) }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 40, color: 'var(--danger)', fontFamily: 'DM Mono, monospace', fontSize: 13 }}>
          <b>Erreur :</b> {this.state.error.message}
          <br /><br />
          <button onClick={() => this.setState({ error: null })} style={{ cursor: 'pointer' }}>Réessayer</button>
        </div>
      )
    }
    return this.props.children
  }
}

class MapErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { hasError: false } }
  static getDerivedStateFromError() { return { hasError: true } }
  componentDidCatch(error) { console.error('Map crash:', error) }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--muted)', fontSize: 13, flexDirection: 'column', gap: 10 }}>
          <span style={{ fontSize: 28 }}>🗺️</span>
          Erreur carte —{' '}
          <button onClick={() => this.setState({ hasError: false })} style={{ cursor: 'pointer', color: 'var(--accent)', background: 'none', border: 'none', fontSize: 13 }}>
            Recharger
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

import { useLeads } from './hooks/useLeads'
import { useScoringProfiles } from './hooks/useScoringProfiles'
import NavBar from './components/NavBar'
import SidebarSearch from './components/SidebarSearch'
import SidebarLeads from './components/SidebarLeads'
import SidebarFavorites from './components/SidebarFavorites'
import SidebarHistory from './components/SidebarHistory'
import ScoringProfileDrawer from './components/ScoringProfileDrawer'
import LeadMap from './components/Map'
import LeadDetail from './components/LeadDetail'

const LS_SEARCHES_KEY = 'leadgen_saved_searches'

function applyFilters(leads, f) {
  return leads.filter(lead => {
    const score = lead.score?.total ?? 0
    if (score < f.minScore) return false
    if ((lead.google?.rating ?? 0) < f.minRating) return false
    if ((lead.google?.totalReviews ?? 0) < f.minReviews) return false
    if (f.onlyNoWebsite && lead.website) return false
    if (f.onlyChatbotFree && lead.chatbotDetection?.hasChatbot !== false) return false
    if (f.onlyNew) {
      const age = lead.pappers?.anciennete
      if (age != null && age > 3) return false
    }
    return true
  })
}

// ─── Loading overlay ─────────────────────────────────────────────────────────
const LOADING_MESSAGES = [
  '🔍 Recherche des entreprises...',
  '📍 Analyse de la zone géographique...',
  '⭐ Calcul des scores...',
  '🤖 Détection des opportunités...',
  '✅ Leads prêts !',
]

function LoadingOverlay({ isLoading, progress, leadsCount }) {
  const [msgIdx,  setMsgIdx]  = useState(0)
  const [fakePct, setFakePct] = useState(0)

  useEffect(() => {
    if (!isLoading) return
    setMsgIdx(0)
    setFakePct(0)
    const msgTimer = setInterval(() => setMsgIdx(i => Math.min(i + 1, LOADING_MESSAGES.length - 1)), 2000)
    const startTime = Date.now()
    const pctTimer  = setInterval(() => {
      const elapsed = (Date.now() - startTime) / 1000
      setFakePct(Math.min(88, Math.round((elapsed / 8) * 88)))
    }, 120)
    return () => { clearInterval(msgTimer); clearInterval(pctTimer) }
  }, [isLoading])

  if (!isLoading) return null

  const realPct = progress?.total ? Math.round((progress.current / progress.total) * 100) : null
  const pct = realPct ?? fakePct

  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 50,
      background: 'rgba(14,28,18,0.7)',
      backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    }}>

      {/* Top progress bar */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'rgba(255,255,255,0.04)' }}>
        <div style={{
          height: '100%', width: `${pct}%`,
          background: 'linear-gradient(90deg, #1d6e55, #4ade80)',
          boxShadow: '0 0 10px rgba(29,110,85,0.6)',
          transition: 'width 0.25s ease',
          borderRadius: '0 2px 2px 0',
        }} />
      </div>

      {/* Ellipse décorative haut-gauche */}
      <div style={{
        position: 'absolute', top: -80, left: -80,
        width: 320, height: 320, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(29,110,85,0.18) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      {/* Ellipse décorative bas-droite */}
      <div style={{
        position: 'absolute', bottom: -100, right: -60,
        width: 380, height: 380, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(29,110,85,0.12) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      {/* Loading Card */}
      <div style={{
        width: 420, height: 320,
        background: 'rgba(255,255,255,0.06)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 20,
        boxShadow: '0px 20px 60px rgba(0,0,0,0.5)',
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden', position: 'relative',
      }}>

        {/* Ligne décorative top */}
        <div style={{
          height: 2, flexShrink: 0,
          background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent)',
        }} />

        {/* Contenu centré */}
        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          gap: 10, padding: '20px 32px 0',
        }}>

          {/* Spinner */}
          <div style={{
            width: 44, height: 44, borderRadius: '50%',
            border: '2px solid rgba(29,110,85,0.15)',
            borderTopColor: '#1d6e55', borderRightColor: '#4ade80',
            animation: 'spin 0.85s linear infinite',
            flexShrink: 0,
          }} />

          {/* Étoile décorative */}
          <span style={{ fontSize: 18, lineHeight: 1 }}>⭐</span>

          {/* Message principal */}
          <span style={{
            fontFamily: 'var(--font-body)', fontSize: 18, fontWeight: 600,
            color: '#f5f5f0', textAlign: 'center', lineHeight: 1.3,
          }}>
            {LOADING_MESSAGES[msgIdx]}
          </span>

          {/* Texte progression */}
          {progress?.message && (
            <span style={{
              fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 400,
              color: 'rgba(255,255,255,0.38)', textAlign: 'center',
            }}>
              {progress.message}
            </span>
          )}
        </div>

        {/* Séparateur */}
        <div style={{ height: 1, background: 'rgba(255,255,255,0.07)', margin: '16px 32px 0' }} />

        {/* Stats */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '16px 32px 24px', gap: 0,
        }}>
          <div style={{ flex: 1, textAlign: 'center' }}>
            <div style={{ fontFamily: 'var(--font-body)', fontSize: 36, fontWeight: 700, color: '#1d6e55', lineHeight: 1 }}>
              {progress?.current ?? leadsCount}
            </div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.38)', fontFamily: 'var(--font-body)', marginTop: 4 }}>
              leads trouvés
            </div>
          </div>
          <div style={{ width: 1, height: 40, background: 'rgba(255,255,255,0.1)', flexShrink: 0 }} />
          <div style={{ flex: 1, textAlign: 'center' }}>
            <div style={{ fontFamily: 'var(--font-body)', fontSize: 36, fontWeight: 700, color: '#edfa36', lineHeight: 1 }}>
              {pct}%
            </div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.38)', fontFamily: 'var(--font-body)', marginTop: 4 }}>
              complété
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}

// ─── Mini header for the main area ───────────────────────────────────────────
function MainHeader({ totalLeads, searchCity, activeTab }) {
  const tabLabels = { search: 'Recherche', leads: 'Mes Leads', favorites: 'Favoris', history: 'Historique', scoring: 'Profils scoring' }
  return (
    <div style={{
      height: 44, flexShrink: 0,
      background: 'rgba(13,13,20,0.88)',
      backdropFilter: 'blur(14px)',
      WebkitBackdropFilter: 'blur(14px)',
      borderBottom: '1px solid rgba(255,255,255,0.06)',
      display: 'flex', alignItems: 'center',
      padding: '0 18px', gap: 14,
    }}>
      {/* Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
        <div style={{ position: 'relative' }}>
          <div style={{
            width: 26, height: 26, borderRadius: 7,
            background: 'linear-gradient(135deg, rgba(0,212,255,0.15), rgba(139,92,246,0.15))',
            border: '1px solid rgba(0,212,255,0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
              <path d="M8 1L10.5 6H15L11 9.5L12.5 15L8 12L3.5 15L5 9.5L1 6H5.5L8 1Z" fill="url(#hGrad)" />
              <defs>
                <linearGradient id="hGrad" x1="1" y1="1" x2="15" y2="15">
                  <stop offset="0%" stopColor="#00d4ff" />
                  <stop offset="100%" stopColor="#8b5cf6" />
                </linearGradient>
              </defs>
            </svg>
          </div>
          {totalLeads > 0 && (
            <div style={{ position: 'absolute', top: -2, right: -2, width: 7, height: 7, borderRadius: '50%', background: '#10b981', border: '1.5px solid var(--bg)', animation: 'pulse 2.2s ease infinite' }} />
          )}
        </div>
        <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 13, letterSpacing: '-0.01em' }}>
          <span className="gradient-text">LeadGen</span>
          <span style={{ color: 'var(--text)', opacity: 0.85 }}> Pro</span>
        </span>
      </div>

      <div style={{ width: 1, height: 18, background: 'rgba(255,255,255,0.08)' }} />

      {/* Breadcrumb */}
      <span style={{ fontSize: 12, fontFamily: 'var(--font-body)', color: 'var(--muted)' }}>
        {tabLabels[activeTab] ?? activeTab}
        {searchCity && (
          <> <span style={{ color: 'var(--faint)' }}>·</span> <span style={{ color: 'var(--text)' }}>{searchCity}</span></>
        )}
      </span>

      <div style={{ flex: 1 }} />

      {/* Stats */}
      {totalLeads > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontFamily: 'var(--font-body)', color: '#10b981' }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981', boxShadow: '0 0 6px rgba(16,185,129,0.7)', animation: 'pulse 2.2s ease infinite', display: 'inline-block' }} />
            Session active
          </div>
          <div style={{ fontSize: 13, fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--accent)' }}>
            {totalLeads} leads
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Sidebar wrapper ──────────────────────────────────────────────────────────
function Sidebar({ children }) {
  return (
    <div style={{
      width: 260, flexShrink: 0,
      height: '100vh',
      background: 'rgba(17,24,20,0.75)',
      borderRight: '1px solid rgba(255,255,255,0.06)',
      display: 'flex', flexDirection: 'column',
      overflow: 'hidden',
    }}>
      {children}
    </div>
  )
}

// ─── App ─────────────────────────────────────────────────────────────────────
export default function App() {
  const { leads, isLoading, progress, searchLeads, updateLeadStatus, updateLeadDecisionMaker } = useLeads()
  const safeLeads = leads || []

  const { profiles, activeProfile, setActiveProfile, createProfile, updateProfile, deleteProfile } = useScoringProfiles()

  const [activeTab,     setActiveTab]     = useState('search')
  const [selectedLead,  setSelectedLead]  = useState(null)
  const [searchCity,    setSearchCity]    = useState('')
  const [searchParams,  setSearchParams]  = useState({ city: '', lat: null, lng: null, radius: 5, domain: '', keywords: [], sources: [] })
  const [filters,       setFilters]       = useState({ minScore: 0, minRating: 0, minReviews: 0, onlyNoWebsite: false, onlyChatbotFree: false, onlyNew: false })
  const [loadedSearch,  setLoadedSearch]  = useState(null) // fills SidebarSearch form

  // Saved searches (lifted from SearchPanel)
  const [savedSearches, setSavedSearches] = useState(() => {
    try { return JSON.parse(localStorage.getItem(LS_SEARCHES_KEY)) || [] } catch { return [] }
  })
  const persistSearches = (next) => {
    setSavedSearches(next)
    localStorage.setItem(LS_SEARCHES_KEY, JSON.stringify(next))
  }

  const handleAutoSave = (entry) => {
    const existing = savedSearches.find(s => s.label === entry.label)
    let next
    if (existing && !existing.pinned) {
      next = savedSearches.map(s => s.id === existing.id ? { ...s, savedAt: entry.savedAt } : s)
    } else if (!existing) {
      const pinned   = savedSearches.filter(s => s.pinned)
      const unpinned = savedSearches.filter(s => !s.pinned)
      const maxUnpinned = Math.max(0, 9 - pinned.length)
      next = [...pinned, entry, ...unpinned.slice(0, maxUnpinned)]
    } else {
      return
    }
    persistSearches(next)
  }

  const handleDeleteSearch = (id) => persistSearches(savedSearches.filter(s => s.id !== id))
  const handleTogglePin = (id) => persistSearches(savedSearches.map(s => s.id === id ? { ...s, pinned: !s.pinned } : s))
  const handleLoadSearch = (params) => {
    setLoadedSearch({ ...params, _ts: Date.now() })
    setActiveTab('search')
  }

  const onSearch = (params) => {
    console.log('[App] onSearch — lat:', params.lat, 'lng:', params.lng)
    setSearchParams(params)
    setSearchCity(params.city)
    setSelectedLead(null)
    searchLeads({ ...params, weights: activeProfile?.weights ?? null, profileId: activeProfile?.id ?? null })
    setActiveTab('leads') // switch to leads tab after search
  }

  const onStatusChange = (leadId, status) => {
    updateLeadStatus(leadId, status)
    setSelectedLead(prev => prev?._id === leadId || prev?.id === leadId ? { ...prev, status } : prev)
  }
  const onDecisionMakerFound = (leadId, decisionMaker) => {
    updateLeadDecisionMaker(leadId, decisionMaker)
    setSelectedLead(prev => prev?._id === leadId || prev?.id === leadId ? { ...prev, decisionMaker } : prev)
  }

  const filteredLeads = applyFilters(safeLeads, filters)

  return (
    <ErrorBoundary>
      <div className="orb-violet" />
      <div className="orb-cyan" />
      <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>

        {/* 1. NavBar */}
        <NavBar activeTab={activeTab} onTabChange={setActiveTab} />

        {/* 2. Sidebar contextuelle */}
        <Sidebar>
          {activeTab === 'search' && (
            <SidebarSearch
              onSearch={onSearch}
              isLoading={isLoading}
              progress={progress}
              activeProfile={activeProfile}
              onOpenScoring={() => setActiveTab('scoring')}
              savedSearches={savedSearches}
              onAutoSave={handleAutoSave}
              loadedSearch={loadedSearch}
            />
          )}
          {activeTab === 'leads' && (
            <SidebarLeads
              leads={filteredLeads}
              selectedLead={selectedLead}
              onSelectLead={setSelectedLead}
              onFiltersChange={setFilters}
            />
          )}
          {activeTab === 'favorites' && (
            <SidebarFavorites
              leads={safeLeads}
              selectedLead={selectedLead}
              onSelectLead={setSelectedLead}
            />
          )}
          {activeTab === 'history' && (
            <SidebarHistory
              savedSearches={savedSearches}
              onLoad={handleLoadSearch}
              onDelete={handleDeleteSearch}
              onTogglePin={handleTogglePin}
            />
          )}
          {activeTab === 'scoring' && (
            <ScoringProfileDrawer
              profiles={profiles}
              activeProfile={activeProfile}
              onSetActive={setActiveProfile}
              onCreateProfile={createProfile}
              onUpdateProfile={updateProfile}
              onDeleteProfile={deleteProfile}
              onClose={() => setActiveTab('search')}
            />
          )}
        </Sidebar>

        {/* 3. Zone principale */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
          <MainHeader
            totalLeads={safeLeads.length}
            searchCity={searchCity}
            activeTab={activeTab}
          />
          <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
            <MapErrorBoundary>
              <LeadMap
                leads={filteredLeads}
                selectedLead={selectedLead}
                searchParams={searchParams}
                onSelectLead={setSelectedLead}
              />
            </MapErrorBoundary>
            <LoadingOverlay isLoading={isLoading} progress={progress} leadsCount={safeLeads.length} />
            {selectedLead && (
              <LeadDetail
                lead={selectedLead}
                leads={safeLeads}
                onClose={() => setSelectedLead(null)}
                onStatusChange={onStatusChange}
                onDecisionMakerFound={onDecisionMakerFound}
                activeProfile={activeProfile}
              />
            )}
          </div>
        </div>

      </div>
    </ErrorBoundary>
  )
}
