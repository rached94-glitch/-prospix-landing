const SCORE_BREAKDOWN = [
  { key: 'googleRating',      label: 'Note Google',        color: '#f59e0b' },
  { key: 'reviewVolume',      label: 'Volume avis',         color: '#10b981' },
  { key: 'digitalPresence',   label: 'Présence digitale',   color: '#EDFA36' },
  { key: 'opportunity',       label: 'Opportunité',         color: '#00d4ff' },
  { key: 'financialCapacity', label: 'Capacité financière', color: '#f97316' },
]

export default function LeadDetailScore({ lead, leads, score, activeProfile, activeWeights, breakdown }) {
  return (
    <>
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
        </div>
      </div>

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
              const peers = (leads || [])
                .filter(l => l.score?.total != null)
                .sort((a, b) => (b.score?.total ?? 0) - (a.score?.total ?? 0))
                .slice(0, 5)
              const peerCount = (leads || []).length
              return (
                <div style={{ background: '#111813', border: '0.5px solid rgba(29,110,85,0.25)', borderRadius: 8, padding: '10px 12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 7 }}>
                    <span style={{ fontSize: 10, color: '#64748b', letterSpacing: '0.04em' }}>Benchmark sectoriel</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: barColor, fontFamily: 'var(--font-mono)' }}>{pct}<span style={{ fontSize: 9, fontWeight: 400, color: '#475569' }}>%</span></span>
                  </div>
                  <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 3, height: 4, marginBottom: 8, overflow: 'hidden' }}>
                    <div style={{ width: `${pct}%`, height: '100%', borderRadius: 3, background: barColor, transition: 'width 0.4s ease' }} />
                  </div>
                  <div style={{ fontSize: 10.5, color: '#94a3b8', marginBottom: 8 }}>Meilleur que {pct}% des {label}</div>
                  <div style={{ background: 'rgba(255,255,255,0.03)', borderLeft: '2px solid rgba(29,110,85,0.4)', borderRadius: '0 4px 4px 0', padding: '7px 10px', marginBottom: 10 }}>
                    <span style={{ fontSize: 10, color: '#64748b', lineHeight: 1.5 }}>
                      Sur les {peerCount} établissements similaires analysés dans cette ville, celui-ci {tierText}
                    </span>
                  </div>
                  <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', marginBottom: 9 }} />
                  {peers.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                      {peers.map(peer => {
                        const isCurrent = peer.id === lead.id
                        const peerScore = peer.score?.total ?? 0
                        const peerColor = peerScore >= 70 ? '#10b981' : peerScore >= 40 ? '#f59e0b' : '#ef4444'
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
    </>
  )
}
