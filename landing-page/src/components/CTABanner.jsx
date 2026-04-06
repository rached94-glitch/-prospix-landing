import { useRef, useEffect, useState } from 'react'
import WaitlistForm from './WaitlistForm'

export default function CTABanner() {
  const ref = useRef(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect() } }, { threshold: 0.2 })
    if (ref.current) obs.observe(ref.current)
    return () => obs.disconnect()
  }, [])

  return (
    <section id="cta-waitlist" style={{ padding: '96px 24px' }}>
      <div
        ref={ref}
        style={{
          maxWidth: 760, margin: '0 auto',
          background: 'rgba(29,110,85,0.06)',
          border: '1px solid rgba(29,110,85,0.2)',
          borderRadius: 24,
          padding: 'clamp(48px, 7vw, 72px) clamp(28px, 7vw, 72px)',
          textAlign: 'center',
          position: 'relative', overflow: 'hidden',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          opacity: visible ? 1 : 0,
          transform: visible ? 'translateY(0)' : 'translateY(32px)',
          transition: 'opacity 0.6s, transform 0.6s',
        }}
      >
        <div style={{
          position: 'absolute', top: -80, left: '50%', transform: 'translateX(-50%)',
          width: 500, height: 260,
          background: 'radial-gradient(ellipse, rgba(29,110,85,0.2) 0%, transparent 65%)',
          pointerEvents: 'none',
        }} />

        <div style={{ position: 'relative', zIndex: 1 }}>
          <h2 style={{
            fontSize: 'clamp(28px, 4.5vw, 46px)',
            fontWeight: 700, letterSpacing: '-0.025em',
            color: '#F5F5F0', margin: '0 0 14px',
          }}>
            Commencez à prospecter aujourd'hui.
          </h2>

          <p style={{ fontSize: 16, color: 'rgba(245,245,240,0.5)', lineHeight: 1.65, margin: '0 auto 40px', maxWidth: 400 }}>
            Gratuit. Pas de carte bancaire. Accès anticipé.
          </p>

          <div style={{ maxWidth: 520, margin: '0 auto' }}>
            <WaitlistForm />
          </div>
        </div>
      </div>
    </section>
  )
}
