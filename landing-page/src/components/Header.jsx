import { useClickSound } from '../hooks/useClickSound'

export default function Header() {
  const playClick = useClickSound()

  const scrollToWaitlist = () => {
    try { playClick() } catch (_) {}
    document.querySelector('#cta-waitlist')?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <header style={{
      position: 'absolute', top: 0, left: 0, right: 0,
      zIndex: 50,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '24px 32px',
    }}>
      {/* Logo */}
      <a
        href="#"
        onClick={e => { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
        style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 8 }}
      >
        <span style={{
          fontSize: 20, lineHeight: 1,
          animation: 'logoPulse 2.5s ease-in-out infinite',
          display: 'inline-block',
        }}>⚡</span>
        <span style={{
          fontSize: 20, fontWeight: 700, color: '#F5F5F0',
          letterSpacing: '-0.02em',
          fontFamily: 'Satoshi, system-ui, sans-serif',
        }}>Prospix</span>
      </a>

      {/* CTA */}
      <button
        onClick={scrollToWaitlist}
        style={{
          padding: '10px 20px',
          background: '#EDFA36',
          color: '#131815',
          border: 'none',
          borderRadius: 8,
          fontSize: 14, fontWeight: 600,
          cursor: 'pointer',
          fontFamily: 'DM Sans, system-ui, sans-serif',
          transition: 'opacity 0.15s, transform 0.15s',
          whiteSpace: 'nowrap',
        }}
        onMouseEnter={e => { e.currentTarget.style.opacity = '0.88'; e.currentTarget.style.transform = 'scale(1.03)' }}
        onMouseLeave={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.transform = 'scale(1)' }}
      >
        Rejoindre la waitlist
      </button>
    </header>
  )
}
