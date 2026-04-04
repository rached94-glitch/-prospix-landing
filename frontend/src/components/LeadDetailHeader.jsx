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

export default function LeadDetailHeader({
  lead, score, activeProfile, wide, setWide, onClose,
  handleContact, contactedConfirm, handleFavorite, isFavorite, handleIgnore,
}) {
  return (
    <>
      {/* ══ HEADER ══ */}
      <div style={{ padding: 14, flexShrink: 0, background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.08)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>

          {/* Score circle */}
          <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'radial-gradient(circle at 40% 35%, #f89e1e, #c97000)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 2px 8px rgba(248,158,30,0.35)' }}>
            <span style={{ fontSize: 16, fontWeight: 700, color: '#edfa36', fontFamily: 'var(--font-body)' }}>{score}</span>
          </div>

          {/* Name + address + tags */}
          <div style={{ flex: 1, minWidth: 0 }}>
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
            {lead.address && (
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.38)', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {lead.address}
              </div>
            )}
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
    </>
  )
}
