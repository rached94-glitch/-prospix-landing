import { useState, useEffect, useRef } from 'react'

function useCountUp(target, duration = 700) {
  const [value, setValue] = useState(target)
  const prev = useRef(target)

  useEffect(() => {
    const from = prev.current
    prev.current = target
    if (from === target) return

    const start = Date.now()
    const diff  = target - from

    const tick = () => {
      const t = Math.min((Date.now() - start) / duration, 1)
      const eased = 1 - Math.pow(1 - t, 3)
      setValue(Math.round(from + diff * eased))
      if (t < 1) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }, [target, duration])

  return value
}

export default function Header({ totalLeads, favoritesCount = 0 }) {
  const count    = useCountUp(totalLeads)
  const favCount = useCountUp(favoritesCount)

  return (
    <header style={{
      height: 58,
      background: 'rgba(13,13,18,0.92)',
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
      borderBottom: '1px solid var(--border)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 22px',
      flexShrink: 0,
      position: 'relative',
      zIndex: 10,
    }}>

      {/* Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {/* Icon mark */}
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <div style={{
            width: 34,
            height: 34,
            borderRadius: 9,
            background: 'linear-gradient(135deg, rgba(0,212,255,0.15), rgba(139,92,246,0.15))',
            border: '1px solid rgba(0,212,255,0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M8 1L10.5 6H15L11 9.5L12.5 15L8 12L3.5 15L5 9.5L1 6H5.5L8 1Z"
                fill="url(#starGrad)" />
              <defs>
                <linearGradient id="starGrad" x1="1" y1="1" x2="15" y2="15">
                  <stop offset="0%" stopColor="#00d4ff" />
                  <stop offset="100%" stopColor="#8b5cf6" />
                </linearGradient>
              </defs>
            </svg>
          </div>
          {/* Live dot */}
          <div style={{
            position: 'absolute',
            top: -2,
            right: -2,
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: totalLeads > 0 ? '#10b981' : 'var(--border-strong)',
            border: '1.5px solid var(--bg)',
            animation: totalLeads > 0 ? 'pulse 2.2s ease infinite' : 'none',
            transition: 'background 0.4s',
          }} />
        </div>

        {/* Name + tagline */}
        <div>
          <div style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 700,
            fontSize: 16,
            lineHeight: 1.15,
            letterSpacing: '-0.01em',
          }}>
            <span className="gradient-text">LeadGen</span>
            <span style={{ color: 'var(--text)', opacity: 0.9 }}> Pro</span>
          </div>
          <div style={{
            fontFamily: 'var(--font-body)',
            fontSize: 9.5,
            fontWeight: 700,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: 'var(--faint)',
            marginTop: 1,
          }}>
            Intelligence commerciale
          </div>
        </div>
      </div>

      {/* Right stats */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>

        {/* Favorites count */}
        {favoritesCount > 0 && (
          <>
            <div style={{ textAlign: 'right' }}>
              <div style={{
                fontFamily: 'var(--font-mono)',
                fontWeight: 500,
                fontSize: 18,
                lineHeight: 1,
                color: '#f59e0b',
                letterSpacing: '-0.03em',
                animation: favoritesCount > 0 ? 'countUp 0.35s ease' : 'none',
              }}>
                ⭐ {favCount}
              </div>
              <div style={{
                fontFamily: 'var(--font-body)',
                fontSize: 9,
                fontWeight: 700,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                color: 'rgba(245,158,11,0.5)',
                marginTop: 2,
              }}>
                Favoris
              </div>
            </div>
            <div style={{ width: 1, height: 26, background: 'var(--border)' }} />
          </>
        )}

        {/* Lead count */}
        <div style={{ textAlign: 'right' }}>
          <div style={{
            fontFamily: 'var(--font-mono)',
            fontWeight: 500,
            fontSize: 22,
            lineHeight: 1,
            color: 'var(--accent)',
            letterSpacing: '-0.03em',
            animation: totalLeads > 0 ? 'countUp 0.35s ease' : 'none',
            key: count,
          }}>
            {count}
          </div>
          <div style={{
            fontFamily: 'var(--font-body)',
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: 'var(--faint)',
            marginTop: 2,
          }}>
            Leads
          </div>
        </div>

        {/* Divider */}
        <div style={{ width: 1, height: 26, background: 'var(--border)' }} />

        {/* Status */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 7,
          fontSize: 12,
          fontFamily: 'var(--font-body)',
          fontWeight: 500,
          color: totalLeads > 0 ? '#10b981' : 'var(--muted)',
          transition: 'color 0.4s',
        }}>
          <span style={{
            width: 7,
            height: 7,
            borderRadius: '50%',
            background: totalLeads > 0 ? '#10b981' : 'rgba(255,255,255,0.12)',
            boxShadow: totalLeads > 0 ? '0 0 6px rgba(16,185,129,0.7)' : 'none',
            animation: totalLeads > 0 ? 'pulse 2.2s ease infinite' : 'none',
            transition: 'all 0.4s',
          }} />
          {totalLeads > 0 ? 'Session active' : 'En attente'}
        </div>

      </div>
    </header>
  )
}
