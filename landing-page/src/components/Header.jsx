import { useState, useEffect } from 'react'
import { useClickSound } from '../hooks/useClickSound'

export default function Header() {
  const [scrolled, setScrolled] = useState(false)
  const playClick = useClickSound()

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', handler, { passive: true })
    return () => window.removeEventListener('scroll', handler)
  }, [])

  const scrollToWaitlist = () => {
    try { playClick() } catch (_) {}
    document.querySelector('#cta-waitlist')?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <header style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 1000,
      background: scrolled ? 'rgba(19,24,21,0.92)' : 'rgba(19,24,21,0.5)',
      backdropFilter: scrolled ? 'blur(20px)' : 'blur(8px)',
      WebkitBackdropFilter: scrolled ? 'blur(20px)' : 'blur(8px)',
      borderBottom: '1px solid rgba(255,255,255,0.07)',
      boxShadow: scrolled ? '0 1px 32px rgba(0,0,0,0.5)' : 'none',
      transition: 'background 0.3s, box-shadow 0.3s',
    }}>
      <div style={{
        maxWidth: 1180, margin: '0 auto',
        padding: '0 24px',
        height: 62,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        {/* Logo */}
        <a
          href="#"
          onClick={e => { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
          style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 8 }}
        >
          <span style={{
            fontSize: 20, lineHeight: 1, display: 'inline-block',
            animation: 'logoPulse 2.5s ease-in-out infinite',
          }}>⚡</span>
          <span style={{
            fontSize: 18, fontWeight: 700, color: '#F5F5F0',
            letterSpacing: '-0.02em', fontFamily: 'Satoshi, system-ui, sans-serif',
          }}>Prospix</span>
        </a>

        {/* CTA */}
        <button
          onClick={scrollToWaitlist}
          style={{
            padding: '9px 20px',
            background: '#EDFA36',
            color: '#0A0F0D',
            border: 'none',
            borderRadius: 9,
            fontSize: 13, fontWeight: 700,
            cursor: 'pointer',
            fontFamily: 'DM Sans, system-ui, sans-serif',
            boxShadow: '0 2px 12px rgba(237,250,54,0.2)',
            transition: 'transform 0.15s, box-shadow 0.15s',
            whiteSpace: 'nowrap',
          }}
          onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.03)'; e.currentTarget.style.boxShadow = '0 4px 20px rgba(237,250,54,0.35)' }}
          onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = '0 2px 12px rgba(237,250,54,0.2)' }}
        >
          Rejoindre la waitlist
        </button>
      </div>
    </header>
  )
}
