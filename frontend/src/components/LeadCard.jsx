const STATUS_LABELS = {
  new:       { label: 'Nouveau',  color: 'var(--accent)' },
  contacted: { label: 'Contacté', color: 'var(--success)' },
  favorite:  { label: 'Favori',   color: '#f59e0b' },
  ignored:   { label: 'Ignoré',   color: 'var(--muted)' },
}

const SOCIAL = {
  linkedin:  { abbr: 'LI', color: '#0077B5' },
  facebook:  { abbr: 'FB', color: '#1877F2' },
  instagram: { abbr: 'IG', color: '#E1306C' },
  tiktok:    { abbr: 'TK', color: '#111' },
}

function scoreColor(score) {
  if (score > 80) return 'var(--success)'
  if (score >= 60) return 'var(--warning)'
  return 'var(--danger)'
}

export function ScoreBadge({ score }) {
  const color = scoreColor(score)
  return (
    <span style={{
      background: `${color}18`,
      border: `1px solid ${color}55`,
      color,
      borderRadius: 5,
      padding: '2px 7px',
      fontSize: 12,
      fontWeight: 500,
      fontFamily: 'var(--font-mono)',
      whiteSpace: 'nowrap',
      letterSpacing: '-0.02em',
    }}>
      {score}<span style={{ opacity: 0.5, fontSize: 10 }}>/100</span>
    </span>
  )
}

function Stars({ rating = 0 }) {
  const full = Math.round(rating)
  return (
    <span style={{ fontSize: 11, letterSpacing: 0.5 }}>
      {Array.from({ length: 5 }, (_, i) => (
        <span key={i} style={{ color: i < full ? '#f59e0b' : 'rgba(255,255,255,0.12)' }}>★</span>
      ))}
    </span>
  )
}

export default function LeadCard({ lead, isSelected, onClick, index = 0 }) {
  const score      = lead.score?.total ?? lead.score ?? 0
  const status     = STATUS_LABELS[lead.status] ?? STATUS_LABELS.new
  const color      = scoreColor(score)
  const isFavorite = lead.status === 'favorite'

  return (
    <div
      className="lead-card"
      onClick={() => onClick(lead)}
      style={{
        margin: '6px 10px',
        padding: '14px 16px',
        borderRadius: 12,
        cursor: 'pointer',
        background: isSelected
          ? 'rgba(29,110,85,0.06)'
          : isFavorite ? 'rgba(245,166,35,0.04)' : 'rgba(19,19,26,0.85)',
        border: `1px solid ${
          isSelected   ? 'rgba(29,110,85,0.35)'
          : isFavorite ? 'rgba(245,166,35,0.30)'
          : 'rgba(255,255,255,0.05)'
        }`,
        boxShadow: isSelected
          ? '0 0 0 1px rgba(29,110,85,0.12), 0 4px 20px rgba(0,0,0,0.5)'
          : isFavorite ? '0 0 0 1px rgba(245,166,35,0.08), 0 2px 12px rgba(0,0,0,0.35)'
          : '0 1px 4px rgba(0,0,0,0.35)',
        animationDelay: `${index * 38}ms`,
        opacity: lead.status === 'ignored' ? 0.35 : undefined,
        pointerEvents: lead.status === 'ignored' ? 'none' : 'auto',
      }}
    >
      {/* Row 1 : nom + favori + score */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 6, marginBottom: 5 }}>
        <span style={{
          fontFamily: 'var(--font-body)',
          fontWeight: 700,
          fontSize: 13,
          lineHeight: 1.3,
          flex: 1,
          color: 'var(--text)',
        }}>
          {lead.name}
        </span>

        {/* Favorite star */}
        {isFavorite && (
          <span style={{
            fontSize: 13,
            lineHeight: 1,
            flexShrink: 0,
            alignSelf: 'flex-start',
            filter: 'drop-shadow(0 0 5px rgba(245,166,35,0.7))',
          }}>⭐</span>
        )}

        {/* Score orb */}
        <div style={{ flexShrink: 0, textAlign: 'right' }}>
          <div style={{
            fontFamily: 'var(--font-display)',
            fontSize: 28,
            fontWeight: 700,
            lineHeight: 1,
            color,
            letterSpacing: '-0.04em',
            textShadow: `0 0 18px ${color}66`,
          }}>
            {score}
          </div>
          <div style={{ fontSize: 8, color: 'var(--faint)', textAlign: 'center', fontFamily: 'var(--font-mono)', marginTop: 1 }}>
            /100
          </div>
        </div>
      </div>

      {/* Score bar */}
      <div style={{
        background: 'rgba(255,255,255,0.05)',
        borderRadius: 2,
        height: 2,
        overflow: 'hidden',
        marginBottom: 7,
      }}>
        <div
          className="score-bar-inner"
          style={{
            '--w': `${score}%`,
            background: `linear-gradient(90deg, ${color}, ${color}88)`,
            borderRadius: 2,
            animationDelay: `${index * 38 + 150}ms`,
            boxShadow: `0 0 6px ${color}66`,
          }}
        />
      </div>

      {/* Row 2 : adresse */}
      <div style={{
        fontSize: 11,
        color: 'var(--muted)',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        marginBottom: 7,
        fontFamily: 'var(--font-body)',
      }}>
        <span style={{ opacity: 0.5 }}>📍</span> {lead.address}
      </div>

      {/* Row 3 : étoiles + sentiment + distance */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 7, flexWrap: 'wrap' }}>
        <Stars rating={lead.google?.rating} />
        <span style={{ fontSize: 10.5, color: 'var(--muted)', fontFamily: 'var(--font-mono)', letterSpacing: '-0.01em' }}>
          {lead.google?.rating ?? '—'} ({lead.google?.totalReviews ?? 0})
        </span>
        {lead.reviewAnalysis?.total > 0 && (
          <>
            <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--success)', fontFamily: 'var(--font-mono)' }}>
              😊 {lead.reviewAnalysis.positiveScore}%
            </span>
            <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--danger)', fontFamily: 'var(--font-mono)' }}>
              😠 {lead.reviewAnalysis.negativeScore}%
            </span>
          </>
        )}
        {lead.distance != null && (
          <span style={{ marginLeft: 'auto', fontSize: 10.5, color: 'var(--faint)', fontFamily: 'var(--font-mono)' }}>
            {lead.distance.toFixed(1)} km
          </span>
        )}
      </div>

      {/* Row 4 : réseaux + statut + badge avis */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap', width: '100%', overflow: 'hidden' }}>
        {Object.entries(SOCIAL).map(([key, cfg]) => {
          const active = !!lead.social?.[key]
          return (
            <span
              key={key}
              title={key}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 20,
                height: 20,
                borderRadius: 4,
                background: active ? cfg.color : 'rgba(255,255,255,0.05)',
                fontSize: 8,
                fontWeight: 700,
                fontFamily: 'var(--font-mono)',
                color: active ? '#fff' : 'rgba(255,255,255,0.2)',
                letterSpacing: 0,
                flexShrink: 0,
                transition: 'opacity 0.15s',
              }}
            >
              {cfg.abbr}
            </span>
          )
        })}

        {(lead.reviewAnalysis?.negative?.unanswered ?? 0) > 5 && (
          <span style={{
            fontSize: 9.5, fontWeight: 700,
            color: 'var(--danger)',
            background: 'rgba(239,68,68,0.10)',
            border: '1px solid rgba(239,68,68,0.25)',
            borderRadius: 4,
            padding: '1px 5px',
            marginLeft: 3,
            fontFamily: 'var(--font-body)',
          }}>
            💬 {lead.reviewAnalysis.negative.unanswered} sans réponse
          </span>
        )}

        <div style={{ marginLeft: 'auto', display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end', maxWidth: '100%' }}>
          {lead.isActiveOwner && (
            <span style={{
              fontSize: 9,
              fontWeight: 700,
              color: '#10b981',
              background: 'rgba(16,185,129,0.10)',
              border: '1px solid rgba(16,185,129,0.25)',
              borderRadius: 4,
              padding: '1px 5px',
              fontFamily: 'var(--font-body)',
            }}>
              Gérant actif ✓
            </span>
          )}
          {lead.newBusinessBadge === 'confirmed' && (
            <span style={{
              fontSize: 9,
              fontWeight: 700,
              color: '#f97316',
              background: 'rgba(249,115,22,0.10)',
              border: '1px solid rgba(249,115,22,0.25)',
              borderRadius: 4,
              padding: '1px 5px',
              fontFamily: 'var(--font-body)',
            }}>
              Nouveau business
            </span>
          )}
          {lead.newBusinessBadge === 'probable' && (
            <span style={{
              fontSize: 9,
              fontWeight: 700,
              color: 'var(--muted)',
              background: 'rgba(148,163,184,0.08)',
              border: '1px solid rgba(148,163,184,0.20)',
              borderRadius: 4,
              padding: '1px 5px',
              fontFamily: 'var(--font-body)',
            }}>
              Potentiel nouveau
            </span>
          )}
          {lead.chatbotDetection && (
            <span style={{
              fontSize: 9,
              fontWeight: 700,
              color:      lead.chatbotDetection.hasChatbot ? 'rgba(255,255,255,0.35)' : '#10b981',
              background: lead.chatbotDetection.hasChatbot ? 'rgba(255,255,255,0.05)' : 'rgba(16,185,129,0.10)',
              border:     `1px solid ${lead.chatbotDetection.hasChatbot ? 'rgba(255,255,255,0.10)' : 'rgba(16,185,129,0.25)'}`,
              borderRadius: 4,
              padding: '1px 5px',
              fontFamily: 'var(--font-body)',
            }}>
              {lead.chatbotDetection.hasChatbot ? '🤖 Déjà équipé' : '🎯 Sans chatbot'}
            </span>
          )}
          {lead.decisionMaker && (
            <span style={{
              fontSize: 9,
              fontWeight: 700,
              color: '#10b981',
              background: 'rgba(16,185,129,0.10)',
              border: '1px solid rgba(16,185,129,0.25)',
              borderRadius: 4,
              padding: '1px 5px',
              fontFamily: 'var(--font-body)',
            }}>
              👤 Décideur identifié
            </span>
          )}
          {isFavorite && (
            <span style={{
              fontSize: 9,
              fontWeight: 700,
              color: 'var(--success)',
              background: 'rgba(16,185,129,0.10)',
              border: '1px solid rgba(16,185,129,0.25)',
              borderRadius: 4,
              padding: '1px 5px',
              fontFamily: 'var(--font-mono)',
            }}>
              Sheets ✓
            </span>
          )}
          <span style={{
            fontSize: 9.5,
            fontWeight: 700,
            color: status.color,
            background: `${status.color}14`,
            border: `1px solid ${status.color}33`,
            borderRadius: 4,
            padding: '1px 6px',
            fontFamily: 'var(--font-body)',
          }}>
            {status.label}
          </span>
        </div>
      </div>

    </div>
  )
}
