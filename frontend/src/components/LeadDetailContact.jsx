import { FaFacebookF, FaLinkedinIn, FaYoutube, FaTiktok, FaInstagram } from 'react-icons/fa'

const SOCIAL_DEFS = [
  { key: 'facebook',  Icon: FaFacebookF,  size: 11, activeBg: '#1877F2',  activeBorder: 'transparent' },
  { key: 'instagram', Icon: FaInstagram,  size: 11, activeBg: 'linear-gradient(45deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888)', activeBorder: 'transparent' },
  { key: 'linkedin',  Icon: FaLinkedinIn, size: 11, activeBg: '#0A66C2',  activeBorder: 'transparent' },
  { key: 'tiktok',    Icon: FaTiktok,     size: 11, activeBg: '#010101',  activeBorder: 'rgba(255,255,255,0.2)' },
  { key: 'youtube',   Icon: FaYoutube,    size: 11, activeBg: '#FF0000',  activeBorder: 'transparent' },
]

export default function LeadDetailContact({ lead, dmState, handleFindDecisionMaker }) {
  return (
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
      </div>
    </div>
  )
}
