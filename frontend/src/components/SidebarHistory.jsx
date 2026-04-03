function timeAgo(ts) {
  const diff = Date.now() - ts
  const m = Math.floor(diff / 60000)
  if (m < 1)   return 'à l\'instant'
  if (m < 60)  return `il y a ${m} min`
  const h = Math.floor(m / 60)
  if (h < 24)  return `il y a ${h}h`
  const d = Math.floor(h / 24)
  return `il y a ${d}j`
}

export default function SidebarHistory({ savedSearches = [], onLoad, onDelete, onTogglePin }) {
  const sorted = [...savedSearches].sort((a, b) => {
    if (a.pinned && !b.pinned) return -1
    if (!a.pinned && b.pinned) return 1
    return (b.savedAt ?? b.id) - (a.savedAt ?? a.id)
  })

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

      {/* Header */}
      <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontFamily: 'var(--font-body)', fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--muted)' }}>
            Historique
          </span>
          {savedSearches.length > 0 && (
            <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--faint)' }}>
              {savedSearches.length}/10
            </span>
          )}
        </div>
      </div>

      {/* List */}
      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, padding: '10px 10px' }}>
        {sorted.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 200, gap: 10, textAlign: 'center', padding: 24 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>
              🕐
            </div>
            <span style={{ fontSize: 12, fontFamily: 'var(--font-body)', color: 'var(--muted)', lineHeight: 1.6, maxWidth: 200 }}>
              Tes recherches apparaîtront ici automatiquement
            </span>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {sorted.map(s => (
              <div key={s.id} style={{
                display: 'flex', alignItems: 'center', gap: 8,
                background: s.pinned ? 'rgba(139,92,246,0.06)' : 'rgba(255,255,255,0.025)',
                border: `1px solid ${s.pinned ? 'rgba(139,92,246,0.22)' : 'rgba(255,255,255,0.06)'}`,
                borderRadius: 9, padding: '9px 10px',
                transition: 'border-color 0.15s, background 0.15s',
              }}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = s.pinned ? 'rgba(139,92,246,0.38)' : 'rgba(255,255,255,0.13)'
                  e.currentTarget.style.background  = s.pinned ? 'rgba(139,92,246,0.10)' : 'rgba(255,255,255,0.04)'
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = s.pinned ? 'rgba(139,92,246,0.22)' : 'rgba(255,255,255,0.06)'
                  e.currentTarget.style.background  = s.pinned ? 'rgba(139,92,246,0.06)' : 'rgba(255,255,255,0.025)'
                }}
              >
                {/* Icon */}
                <span style={{ fontSize: 13, opacity: 0.45, flexShrink: 0 }}>
                  {s.pinned ? '📌' : '🔍'}
                </span>

                {/* Label + time */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 12, fontFamily: 'var(--font-body)', fontWeight: 600,
                    color: s.pinned ? '#c4b5fd' : 'var(--text)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    lineHeight: 1.3,
                  }}>
                    {s.label}
                  </div>
                  {s.savedAt && (
                    <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--faint)', marginTop: 2 }}>
                      {timeAgo(s.savedAt)}
                    </div>
                  )}
                </div>

                {/* Pin toggle */}
                <button
                  onClick={() => onTogglePin(s.id)}
                  title={s.pinned ? 'Désépingler' : 'Épingler'}
                  style={{
                    background: s.pinned ? 'rgba(139,92,246,0.15)' : 'none',
                    border: `1px solid ${s.pinned ? 'rgba(139,92,246,0.35)' : 'rgba(255,255,255,0.08)'}`,
                    borderRadius: 5, cursor: 'pointer',
                    color: s.pinned ? '#a78bfa' : 'var(--faint)',
                    fontSize: 11, padding: '2px 5px', lineHeight: 1.2,
                    flexShrink: 0, transition: 'all 0.15s',
                    fontFamily: 'var(--font-mono)',
                  }}
                  onMouseEnter={e => { if (!s.pinned) e.currentTarget.style.borderColor = 'rgba(139,92,246,0.3)' }}
                  onMouseLeave={e => { if (!s.pinned) e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)' }}
                >
                  📌
                </button>

                {/* Reload */}
                <button
                  onClick={() => onLoad(s.params)}
                  title="Relancer cette recherche"
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'var(--accent)', fontSize: 14, padding: '2px 3px', lineHeight: 1,
                    flexShrink: 0, transition: 'opacity 0.15s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.opacity = '0.65')}
                  onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
                >
                  🔄
                </button>

                {/* Delete */}
                <button
                  onClick={() => onDelete(s.id)}
                  title="Supprimer"
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'var(--faint)', fontSize: 13, padding: '2px 3px', lineHeight: 1,
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
    </div>
  )
}
