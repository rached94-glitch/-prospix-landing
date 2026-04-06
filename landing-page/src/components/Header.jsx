import { useState, useEffect } from 'react'
import { useClickSound } from '../hooks/useClickSound'

const NAV_LINKS = [
  { label: 'Profils',               href: '#profils' },
  { label: 'Fonctionnalités',       href: '#fonctionnalites' },
  { label: 'Comment ça marche',     href: '#comment' },
  { label: 'Tarifs',                href: '#tarifs' },
]

export default function Header() {
  const [scrolled,     setScrolled]     = useState(false)
  const [menuOpen,     setMenuOpen]     = useState(false)
  const playClick = useClickSound()

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', handler, { passive: true })
    return () => window.removeEventListener('scroll', handler)
  }, [])

  const scrollTo = (href) => {
    try { playClick() } catch (_) {}
    setMenuOpen(false)
    const el = document.querySelector(href)
    if (el) el.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <header style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 1000,
      background: scrolled ? 'rgba(10,15,13,0.92)' : 'rgba(10,15,13,0.6)',
      backdropFilter: 'blur(14px)',
      WebkitBackdropFilter: 'blur(14px)',
      borderBottom: '1px solid rgba(255,255,255,0.08)',
      transition: 'background 0.3s',
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
          <span style={{ fontSize: 20, lineHeight: 1 }}>⚡</span>
          <span style={{ fontSize: 18, fontWeight: 700, color: '#F5F5F0', letterSpacing: '-0.02em' }}>Prospix</span>
        </a>

        {/* Nav desktop */}
        <nav style={{ display: 'flex', alignItems: 'center', gap: 4 }} className="nav-desktop">
          {NAV_LINKS.map(link => (
            <a
              key={link.href}
              href={link.href}
              onClick={e => { e.preventDefault(); scrollTo(link.href) }}
              style={{
                padding: '6px 14px',
                fontSize: 14,
                fontWeight: 500,
                color: 'rgba(245,245,240,0.65)',
                textDecoration: 'none',
                borderRadius: 8,
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.color = '#F5F5F0'; e.currentTarget.style.background = 'rgba(255,255,255,0.05)' }}
              onMouseLeave={e => { e.currentTarget.style.color = 'rgba(245,245,240,0.65)'; e.currentTarget.style.background = 'transparent' }}
            >
              {link.label}
            </a>
          ))}
        </nav>

        {/* CTA desktop */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <a
            href="#waitlist"
            onClick={e => { e.preventDefault(); playClick(); document.querySelector('#hero-waitlist')?.scrollIntoView({ behavior: 'smooth' }) }}
            style={{
              padding: '9px 18px',
              background: '#EDFA36',
              color: '#0A0F0D',
              borderRadius: 9,
              fontSize: 13,
              fontWeight: 700,
              textDecoration: 'none',
              transition: 'all 0.15s',
              boxShadow: '0 2px 12px rgba(237,250,54,0.2)',
              display: 'flex', alignItems: 'center', gap: 5,
            }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.03)'; e.currentTarget.style.boxShadow = '0 4px 20px rgba(237,250,54,0.35)' }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = '0 2px 12px rgba(237,250,54,0.2)' }}
          >
            Rejoindre la waitlist
          </a>

          {/* Burger mobile */}
          <button
            onClick={() => setMenuOpen(v => !v)}
            aria-label="Menu"
            style={{
              display: 'none',
              background: 'none', border: 'none', cursor: 'pointer',
              color: '#F5F5F0', padding: 6,
            }}
            className="burger-btn"
          >
            {menuOpen ? '✕' : '☰'}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div style={{
          borderTop: '1px solid rgba(255,255,255,0.06)',
          background: 'rgba(10,15,13,0.98)',
          padding: '12px 24px 20px',
          display: 'flex', flexDirection: 'column', gap: 4,
        }}>
          {NAV_LINKS.map(link => (
            <a
              key={link.href}
              href={link.href}
              onClick={e => { e.preventDefault(); scrollTo(link.href) }}
              style={{
                padding: '10px 12px',
                fontSize: 15, fontWeight: 500,
                color: 'rgba(245,245,240,0.7)',
                textDecoration: 'none', borderRadius: 8,
              }}
            >
              {link.label}
            </a>
          ))}
          <a
            href="#waitlist"
            onClick={e => { e.preventDefault(); playClick(); document.querySelector('#hero-waitlist')?.scrollIntoView({ behavior: 'smooth' }); setMenuOpen(false) }}
            style={{
              marginTop: 8,
              padding: '12px 18px',
              background: '#EDFA36', color: '#0A0F0D',
              borderRadius: 9, fontSize: 14, fontWeight: 700,
              textDecoration: 'none', textAlign: 'center',
            }}
          >
            ⚡ Rejoindre la waitlist
          </a>
        </div>
      )}

      <style>{`
        @media (max-width: 768px) {
          .nav-desktop { display: none !important; }
          .burger-btn  { display: block !important; }
        }
      `}</style>
    </header>
  )
}
