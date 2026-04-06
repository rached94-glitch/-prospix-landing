import { useState } from 'react'
import PrivacyModal from './PrivacyModal'

const NAV = [
  { label: 'Profils',           href: '#profils' },
  { label: 'Fonctionnalités',   href: '#fonctionnalites' },
  { label: 'Tarifs',            href: '#tarifs' },
  { label: 'Contact',           href: 'mailto:contact@prospix.fr' },
]

function IconLinkedIn() {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="currentColor">
      <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/>
      <rect x="2" y="9" width="4" height="12"/><circle cx="4" cy="4" r="2"/>
    </svg>
  )
}

function IconTikTok() {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="currentColor">
      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.18 8.18 0 0 0 4.78 1.52V6.76a4.85 4.85 0 0 1-1.01-.07z"/>
    </svg>
  )
}

export default function Footer() {
  const [showPrivacy, setShowPrivacy] = useState(false)
  const scrollTo = (href) => {
    if (href.startsWith('mailto')) { window.location.href = href; return }
    const el = document.querySelector(href)
    if (el) el.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <>
    {showPrivacy && <PrivacyModal onClose={() => setShowPrivacy(false)} />}
    <footer style={{
      borderTop: '1px solid rgba(255,255,255,0.08)',
      padding: '44px 24px 32px',
      marginTop: 'auto',
    }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>

        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-start', gap: 32, marginBottom: 40 }}>

          {/* Brand */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <span style={{ fontSize: 17, fontWeight: 700, color: '#F5F5F0' }}>Prospix</span>
            </div>
            <p style={{ fontSize: 13, color: 'rgba(245,245,240,0.4)', lineHeight: 1.6, maxWidth: 240 }}>
              Prospection IA pour freelances du digital. Trouvez les bons clients, avec les bonnes données.
            </p>

            {/* Social */}
            <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
              {[
                { icon: <IconTikTok />,   href: '#', label: 'TikTok' },
                { icon: <IconLinkedIn />, href: '#', label: 'LinkedIn' },
              ].map(s => (
                <a
                  key={s.label}
                  href={s.href}
                  aria-label={s.label}
                  style={{
                    width: 34, height: 34,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 9,
                    color: 'rgba(245,245,240,0.5)',
                    textDecoration: 'none',
                    transition: 'all 0.15s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(29,110,85,0.15)'; e.currentTarget.style.color = '#4ade80'; e.currentTarget.style.borderColor = 'rgba(29,110,85,0.3)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = 'rgba(245,245,240,0.5)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)' }}
                >
                  {s.icon}
                </a>
              ))}
            </div>
          </div>

          {/* Links */}
          <nav style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'rgba(245,245,240,0.3)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>Navigation</span>
            {NAV.map(link => (
              <a
                key={link.href}
                href={link.href}
                onClick={e => { e.preventDefault(); scrollTo(link.href) }}
                style={{
                  fontSize: 14, color: 'rgba(245,245,240,0.55)',
                  textDecoration: 'none', transition: 'color 0.15s',
                }}
                onMouseEnter={e => e.currentTarget.style.color = '#F5F5F0'}
                onMouseLeave={e => e.currentTarget.style.color = 'rgba(245,245,240,0.55)'}
              >
                {link.label}
              </a>
            ))}
          </nav>
        </div>

        {/* Bottom */}
        <div style={{
          paddingTop: 20,
          borderTop: '1px solid rgba(255,255,255,0.05)',
          display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 8,
        }}>
          <span style={{ fontSize: 12, color: 'rgba(245,245,240,0.3)' }}>
            © 2026 Prospix. Tous droits réservés.
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <button
              type="button"
              onClick={() => setShowPrivacy(true)}
              style={{ background: 'none', border: 'none', padding: 0, fontSize: 12, color: 'rgba(245,245,240,0.3)', cursor: 'pointer', fontFamily: 'inherit', transition: 'color 0.15s' }}
              onMouseEnter={e => e.currentTarget.style.color = '#2A9D74'}
              onMouseLeave={e => e.currentTarget.style.color = 'rgba(245,245,240,0.3)'}
            >Politique de confidentialité</button>
            <span style={{ fontSize: 12, color: 'rgba(245,245,240,0.15)' }}>Fait pour les freelances ambitieux</span>
          </div>
        </div>
      </div>
    </footer>
    </>
  )
}
