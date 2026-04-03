import { useState, useMemo } from 'react'
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

export default function LeadsList({ leads = [], selectedLead, onSelectLead }) {
  const [sortBy, setSortBy] = useState('score')
  const sorted = useMemo(() => sortLeads(leads, sortBy), [leads, sortBy])

  return (
    <div style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      overflowY: 'auto',
      overflowX: 'hidden',
      minHeight: 0,
    }}>
      {/* Sort bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        padding: '7px 12px',
        borderBottom: '1px solid var(--border)',
        background: 'var(--surface)',
        flexShrink: 0,
        position: 'sticky',
        top: 0,
        zIndex: 5,
      }}>
        <span style={{
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: '0.10em',
          textTransform: 'uppercase',
          color: 'var(--faint)',
          fontFamily: 'var(--font-body)',
          marginRight: 4,
          whiteSpace: 'nowrap',
        }}>
          Tri
        </span>
        {SORT_OPTIONS.map(opt => (
          <button
            key={opt.value}
            onClick={() => setSortBy(opt.value)}
            style={{
              padding: '3px 9px',
              borderRadius: 5,
              border: `1px solid ${sortBy === opt.value ? 'rgba(0,212,255,0.4)' : 'rgba(255,255,255,0.07)'}`,
              background: sortBy === opt.value ? 'rgba(0,212,255,0.09)' : 'transparent',
              color: sortBy === opt.value ? 'var(--accent)' : 'var(--muted)',
              fontSize: 11,
              fontFamily: 'var(--font-body)',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s',
              boxShadow: sortBy === opt.value ? '0 0 8px rgba(0,212,255,0.12)' : 'none',
            }}
          >
            {opt.label}
          </button>
        ))}
        <span style={{
          marginLeft: 'auto',
          fontSize: 11,
          color: 'var(--faint)',
          fontFamily: 'var(--font-mono)',
        }}>
          {leads.length}
        </span>
      </div>

      {/* List */}
      <div style={{ paddingBottom: 12 }}>
        {sorted.length === 0 ? (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: 180,
            gap: 12,
            color: 'var(--muted)',
            padding: 32,
            textAlign: 'center',
          }}>
            <div style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 20,
            }}>
              🗺️
            </div>
            <span style={{ fontSize: 12, fontFamily: 'var(--font-body)', lineHeight: 1.5, maxWidth: 200 }}>
              Lance une recherche pour voir les leads apparaître ici
            </span>
          </div>
        ) : (
          sorted.map((lead, index) => (
            <LeadCard
              key={lead._id ?? lead.id}
              lead={lead}
              index={index}
              isSelected={selectedLead?._id === lead._id || selectedLead?.id === lead.id}
              onClick={onSelectLead}
            />
          ))
        )}
      </div>
    </div>
  )
}
