import { useRef, useEffect, useState } from 'react'
import WaitlistForm from './WaitlistForm'

export default function CTABanner() {
  const ref = useRef(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect() } }, { threshold: 0.3 })
    if (ref.current) obs.observe(ref.current)
    return () => obs.disconnect()
  }, [])

  return (
    <section style={{ padding: '80px 24px' }}>
      <div
        ref={ref}
        style={{
          maxWidth: 760, margin: '0 auto',
          background: 'rgba(29,110,85,0.08)',
          border: '1px solid rgba(29,110,85,0.25)',
          borderRadius: 24,
          padding: 'clamp(40px, 6vw, 64px) clamp(24px, 6vw, 64px)',
          textAlign: 'center',
          position: 'relative', overflow: 'hidden',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          opacity: visible ? 1 : 0,
          transform: visible ? 'translateY(0)' : 'translateY(28px)',
          transition: 'opacity 0.6s, transform 0.6s',
        }}
      >
        {/* Background glow */}
        <div style={{
          position: 'absolute', top: -60, left: '50%', transform: 'translateX(-50%)',
          width: 400, height: 200,
          background: 'radial-gradient(ellipse, rgba(29,110,85,0.25) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />

        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{
            display: 'inline-block', marginBottom: 20,
            padding: '5px 14px',
            background: 'rgba(237,250,54,0.1)',
            border: '1px solid rgba(237,250,54,0.25)',
            borderRadius: 20, fontSize: 12, fontWeight: 600, color: '#EDFA36',
          }}>
            ⚡ Accès anticipé
          </div>

          <h2 style={{
            fontSize: 'clamp(26px, 4vw, 40px)',
            fontWeight: 700, letterSpacing: '-0.02em',
            color: '#F5F5F0', marginBottom: 14,
          }}>
            Prêt à prospecter intelligemment ?
          </h2>

          <p style={{
            fontSize: 16, color: 'rgba(245,245,240,0.55)', lineHeight: 1.6,
            marginBottom: 36, maxWidth: 480, margin: '0 auto 36px',
          }}>
            Rejoignez la waitlist et soyez parmi les premiers à utiliser Prospix.
          </p>

          <div style={{ maxWidth: 500, margin: '0 auto' }}>
            <WaitlistForm />
          </div>
        </div>
      </div>
    </section>
  )
}
