import { useState, useMemo, useRef, useEffect } from 'react'
import LeadCard from './LeadCard'

const SORT_OPTIONS = [
  { label: 'Score',    value: 'score' },
  { label: 'Distance', value: 'distance' },
  { label: 'Avis',     value: 'reviews' },
  { label: 'Nom',      value: 'name' },
]

function sortLeads(leads, sortBy) {
  return [...leads].sort((a, b) => {
    switch (sortBy) {
      case 'score':    return (b.score?.total ?? 0) - (a.score?.total ?? 0)
      case 'distance': return (a.distance ?? 999) - (b.distance ?? 999)
      case 'reviews':  return (b.google?.totalReviews ?? 0) - (a.google?.totalReviews ?? 0)
      case 'name':     return a.name.localeCompare(b.name)
      default:         return 0
    }
  })
}

const sectionLabel = {
  fontFamily: 'var(--font-body)', fontSize: 10, fontWeight: 700,
  letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--muted)',
}

export default function SidebarLeads({ leads = [], selectedLead, onSelectLead, onFiltersChange }) {
  const [sortBy,          setSortBy]          = useState('score')
  const [advancedOpen,    setAdvancedOpen]    = useState(false)
  const [minRating,       setMinRating]       = useState(0)
  const [minReviews,      setMinReviews]      = useState(0)
  const [onlyNoWebsite,   setOnlyNoWebsite]   = useState(false)
  const [onlyChatbotFree, setOnlyChatbotFree] = useState(false)
  const [onlyNew,         setOnlyNew]         = useState(false)
  const [minScore,        setMinScore]        = useState(0)

  const onFiltersChangeRef = useRef(onFiltersChange)
  useEffect(() => { onFiltersChangeRef.current = onFiltersChange })
  useEffect(() => {
    onFiltersChangeRef.current?.({ minScore, minRating, minReviews, onlyNoWebsite, onlyChatbotFree, onlyNew })
  }, [minScore, minRating, minReviews, onlyNoWebsite, onlyChatbotFree, onlyNew])

  const activeFiltersCount = [minRating > 0, minReviews > 0, onlyNoWebsite, onlyChatbotFree, onlyNew].filter(Boolean).length
  const sorted = useMemo(() => sortLeads(leads, sortBy), [leads, sortBy])

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

      {/* Header: count + sort */}
      <div style={{
        padding: '10px 14px 8px',
        borderBottom: '1px solid var(--border)',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ ...sectionLabel }}>Leads</span>
          <span style={{ fontSize: 11, color: 'var(--accent)', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
            {leads.length}
          </span>
        </div>
        {/* Sort pills */}
        <div style={{ display: 'flex', gap: 4 }}>
          {SORT_OPTIONS.map(opt => (
            <button key={opt.value} onClick={() => setSortBy(opt.value)} style={{
              flex: 1, padding: '4px 0', borderRadius: 5,
              border: `1px solid ${sortBy === opt.value ? 'rgba(29,110,85,0.4)' : 'rgba(255,255,255,0.07)'}`,
              background: sortBy === opt.value ? 'rgba(29,110,85,0.09)' : 'transparent',
              color: sortBy === opt.value ? 'var(--accent)' : 'var(--muted)',
              fontSize: 10, fontFamily: 'var(--font-body)', fontWeight: 600,
              cursor: 'pointer', transition: 'all 0.15s',
            }}>
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Score minimum */}
      <div style={{ padding: '12px 14px 0', flexShrink: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 7 }}>
          <span style={{ fontSize: 10, color: 'var(--muted)', fontFamily: 'var(--font-body)', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            Score min
          </span>
          <span style={{
            fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 700,
            color: minScore >= 70 ? '#10b981' : minScore >= 40 ? '#f97316' : minScore > 0 ? '#ef4444' : 'var(--faint)',
          }}>
            {minScore > 0 ? `≥ ${minScore}` : 'Tout'}
          </span>
        </div>
        <input type="range" className="slider-premium" min={0} max={100} step={5} value={minScore} onChange={e => setMinScore(Number(e.target.value))} />
        <div style={{ position: 'relative', height: 3, borderRadius: 2, marginTop: 4, overflow: 'hidden' }}>
          <div style={{ position: 'absolute', left: '0%',  width: '40%', height: '100%', background: 'rgba(239,68,68,0.35)', borderRadius: '2px 0 0 2px' }} />
          <div style={{ position: 'absolute', left: '40%', width: '30%', height: '100%', background: 'rgba(249,115,22,0.35)' }} />
          <div style={{ position: 'absolute', left: '70%', width: '30%', height: '100%', background: 'rgba(16,185,129,0.35)', borderRadius: '0 2px 2px 0' }} />
        </div>
      </div>

      {/* Filtres avancés */}
      <div style={{ padding: '10px 14px 8px', flexShrink: 0, borderBottom: '1px solid var(--border)' }}>
        <button type="button" onClick={() => setAdvancedOpen(o => !o)} style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'none', border: 'none', cursor: 'pointer', padding: 0,
        }}>
          <span style={{ ...sectionLabel, display: 'flex', alignItems: 'center', gap: 6 }}>
            Filtres
            {activeFiltersCount > 0 && (
              <span style={{ fontSize: 9, fontWeight: 700, fontFamily: 'var(--font-mono)', background: 'rgba(237,250,54,0.12)', border: '1px solid rgba(237,250,54,0.30)', color: '#EDFA36', borderRadius: 4, padding: '1px 5px' }}>
                {activeFiltersCount}
              </span>
            )}
          </span>
          <span style={{ fontSize: 10, color: 'var(--faint)', transition: 'transform 0.2s', display: 'inline-block', transform: advancedOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}>▼</span>
        </button>

        <div style={{ overflow: 'hidden', maxHeight: advancedOpen ? 300 : 0, transition: 'max-height 0.25s cubic-bezier(0.4,0,0.2,1)' }}>
          <div style={{ paddingTop: 10, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* Note min */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                <span style={{ fontSize: 10, color: 'var(--muted)', fontFamily: 'var(--font-body)' }}>Note Google min</span>
                <span style={{ fontSize: 10, color: '#f59e0b', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                  {minRating > 0 ? `${minRating.toFixed(1)}★` : 'Toutes'}
                </span>
              </div>
              <input type="range" className="slider-premium" min={0} max={5} step={0.5} value={minRating} onChange={e => setMinRating(Number(e.target.value))} />
            </div>
            {/* Avis min */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                <span style={{ fontSize: 10, color: 'var(--muted)', fontFamily: 'var(--font-body)' }}>Avis minimum</span>
                <span style={{ fontSize: 10, color: 'var(--accent)', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                  {minReviews > 0 ? `≥ ${minReviews}` : 'Tous'}
                </span>
              </div>
              <input type="range" className="slider-premium" min={0} max={500} step={10} value={minReviews} onChange={e => setMinReviews(Number(e.target.value))} />
            </div>
            {/* Checkboxes */}
            {[
              { label: 'Sans site web', value: onlyNoWebsite,   set: setOnlyNoWebsite },
              { label: 'Sans chatbot',  value: onlyChatbotFree, set: setOnlyChatbotFree },
              { label: 'Nouveaux établ.', value: onlyNew,       set: setOnlyNew },
            ].map(({ label, value, set }) => (
              <label key={label} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', userSelect: 'none' }}>
                <input type="checkbox" style={{ accentColor: 'var(--accent)', width: 13, height: 13 }} checked={value} onChange={e => set(e.target.checked)} />
                <span style={{ fontSize: 11, fontFamily: 'var(--font-body)', color: value ? 'var(--text)' : 'var(--muted)' }}>{label}</span>
              </label>
            ))}
          </div>
        </div>
      </div>

      {/* Liste scrollable */}
      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
        {sorted.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 200, gap: 10, color: 'var(--muted)', padding: 24, textAlign: 'center' }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>
              🗺️
            </div>
            <span style={{ fontSize: 12, fontFamily: 'var(--font-body)', lineHeight: 1.5 }}>
              Lance une recherche pour voir les leads ici
            </span>
          </div>
        ) : (
          <div style={{ paddingBottom: 12 }}>
            {sorted.map((lead, index) => (
              <LeadCard
                key={lead._id ?? lead.id}
                lead={lead}
                index={index}
                isSelected={selectedLead?._id === lead._id || selectedLead?.id === lead.id}
                onClick={onSelectLead}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
