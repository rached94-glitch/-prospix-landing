import { motion } from 'framer-motion'
import { useClickSound } from '../hooks/useClickSound'

const CITIES = ['Paris', 'Lyon', 'Marseille', 'Bordeaux', 'Toulouse', 'Strasbourg', 'Lille', 'Nantes', 'Nice', 'Montpellier', 'Rennes', 'Grenoble']
const TICKER = CITIES.map(c => `${c}`).join('  ·  ') + '  ·  '

export default function Hero() {
  const playClick = useClickSound()

  const scrollToWaitlist = () => {
    playClick()
    document.querySelector('#cta-waitlist')?.scrollIntoView({ behavior: 'smooth' })
  }
  const scrollToDemo = () => {
    playClick()
    document.querySelector('#fonctionnalites')?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <section id="hero" style={{
      minHeight: '100vh',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '120px 24px 0',
      position: 'relative', overflow: 'hidden',
      textAlign: 'center',
    }}>

      <div style={{ position: 'relative', zIndex: 1, maxWidth: 900, width: '100%' }}>

        {/* Badge pill */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
          style={{ marginBottom: 36 }}
        >
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '6px 18px',
            background: 'rgba(29,110,85,0.15)',
            border: '1px solid rgba(29,110,85,0.35)',
            borderRadius: 40,
            fontSize: 12, fontWeight: 600, color: '#4ade80',
            letterSpacing: '0.05em',
            backdropFilter: 'blur(12px)',
          }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#4ade80', boxShadow: '0 0 8px #4ade80', flexShrink: 0, animation: 'pulse 2s infinite' }} />
            Outil de prospection pour freelances
          </span>
        </motion.div>

        {/* H1 — très grand, font-light */}
        <motion.h1
          initial={{ opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.65, delay: 0.08 }}
          style={{
            fontSize: 'clamp(44px, 8vw, 96px)',
            fontWeight: 300,
            lineHeight: 1.05,
            letterSpacing: '-0.04em',
            color: '#F5F5F0',
            marginBottom: 18,
          }}
        >
          Trouvez les commerces<br />
          qui ont{' '}
          <em style={{
            fontStyle: 'italic',
            fontFamily: 'Georgia, "Times New Roman", serif',
            fontWeight: 400,
            background: 'linear-gradient(130deg, #2A9D74 0%, #EDFA36 55%, #fff 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}>besoin</em>
          {' '}de vous.
        </motion.h1>

        {/* Sous-ligne jaune italic */}
        <motion.p
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.18 }}
          style={{
            fontSize: 'clamp(18px, 3vw, 28px)',
            fontStyle: 'italic',
            fontFamily: 'Georgia, serif',
            color: '#EDFA36',
            marginBottom: 24,
            letterSpacing: '-0.01em',
            opacity: 0.9,
          }}
        >
          trouvés, scorés, prêts à closer.
        </motion.p>

        {/* Description */}
        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.26 }}
          style={{
            fontSize: 'clamp(15px, 1.8vw, 18px)',
            color: 'rgba(245,245,240,0.55)',
            lineHeight: 1.7,
            maxWidth: 560, margin: '0 auto 44px',
          }}
        >
          Votre prochain client a un site cassé, pas de SEO, et n'a rien publié depuis 3 mois.
          On vient d'en trouver 47 dans votre ville.
        </motion.p>

        {/* 2 boutons CTA */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.34 }}
          style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 64 }}
        >
          <button
            onClick={scrollToWaitlist}
            style={{
              padding: '15px 32px',
              background: '#1D6E55',
              color: '#F5F5F0',
              border: 'none',
              borderRadius: 12,
              fontSize: 15, fontWeight: 700,
              cursor: 'pointer',
              fontFamily: 'Instrument Sans, sans-serif',
              transition: 'all 0.2s',
              boxShadow: '0 4px 24px rgba(29,110,85,0.45)',
              letterSpacing: '0.01em',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = '#2A9D74'; e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 32px rgba(29,110,85,0.55)' }}
            onMouseLeave={e => { e.currentTarget.style.background = '#1D6E55'; e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 24px rgba(29,110,85,0.45)' }}
          >
            Rejoindre la waitlist
          </button>

          <button
            onClick={scrollToDemo}
            style={{
              padding: '15px 32px',
              background: 'transparent',
              color: 'rgba(245,245,240,0.85)',
              border: '1.5px solid rgba(245,245,240,0.25)',
              borderRadius: 12,
              fontSize: 15, fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'Instrument Sans, sans-serif',
              transition: 'all 0.2s',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(245,245,240,0.55)'; e.currentTarget.style.color = '#F5F5F0'; e.currentTarget.style.transform = 'translateY(-2px)' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(245,245,240,0.25)'; e.currentTarget.style.color = 'rgba(245,245,240,0.85)'; e.currentTarget.style.transform = 'translateY(0)' }}
          >
            Voir la démo ▶
          </button>
        </motion.div>

      </div>

      {/* Ticker villes */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        borderTop: '1px solid rgba(255,255,255,0.06)',
        background: 'rgba(19,24,21,0.8)',
        backdropFilter: 'blur(8px)',
        overflow: 'hidden',
        padding: '12px 0',
      }}>
        <div style={{
          display: 'inline-flex',
          whiteSpace: 'nowrap',
          animation: 'marquee 22s linear infinite',
          gap: 0,
        }}>
          {/* Duplicate for seamless loop */}
          {[0, 1].map(n => (
            <span key={n} style={{
              fontSize: 12, fontWeight: 500,
              color: 'rgba(245,245,240,0.35)',
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              paddingRight: 0,
            }}>
              {CITIES.map((city, i) => (
                <span key={i}>
                  <span style={{ color: 'rgba(245,245,240,0.35)' }}>{city}</span>
                  <span style={{ margin: '0 20px', color: 'rgba(29,110,85,0.6)' }}>·</span>
                </span>
              ))}
            </span>
          ))}
        </div>
      </div>
    </section>
  )
}
