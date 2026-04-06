import { motion } from 'framer-motion'
import WaitlistForm from './WaitlistForm'

const STATS = [
  { value: '10',    label: 'profils métier' },
  { value: '30s',   label: 'Audit IA' },
  { value: '1 clic',label: 'Email personnalisé' },
]

export default function Hero() {
  return (
    <section style={{
      minHeight: '100vh',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '120px 24px 80px',
      position: 'relative', overflow: 'hidden',
    }}>

      <div style={{ position: 'relative', zIndex: 1, maxWidth: 760, width: '100%', textAlign: 'center' }}>

        {/* Badge avec pulse ring */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 7, marginBottom: 32 }}
        >
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '7px 16px',
            background: 'rgba(29,110,85,0.12)',
            border: '1px solid rgba(29,110,85,0.35)',
            borderRadius: 30,
            fontSize: 12, fontWeight: 600,
            color: '#4ade80',
            letterSpacing: '0.04em',
            backdropFilter: 'blur(12px)',
            animation: 'badgePulseRing 2.5s ease-out infinite',
          }}>
            <span style={{
              width: 7, height: 7, borderRadius: '50%',
              background: '#4ade80',
              boxShadow: '0 0 8px #4ade80',
              display: 'inline-block',
              flexShrink: 0,
            }} />
            Outil de prospection IA pour freelances
          </span>
        </motion.div>

        {/* H1 avec gradient text sur "besoin" */}
        <motion.h1
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          style={{
            fontSize: 'clamp(36px, 6vw, 68px)',
            fontWeight: 700,
            lineHeight: 1.08,
            letterSpacing: '-0.03em',
            color: '#F5F5F0',
            marginBottom: 24,
            textShadow: '0 0 80px rgba(29,110,85,0.3)',
          }}
        >
          Trouvez les commerces
          <br />
          qui ont{' '}
          <em style={{
            fontStyle: 'italic',
            fontFamily: 'Georgia, serif',
            background: 'linear-gradient(135deg, #2A9D74 0%, #EDFA36 60%, #fff 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}>besoin</em>
          {' '}de vous.
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          style={{
            fontSize: 'clamp(15px, 2vw, 18px)',
            color: 'rgba(245,245,240,0.58)',
            lineHeight: 1.7,
            maxWidth: 580,
            margin: '0 auto 44px',
          }}
        >
          Prospix analyse les commerces locaux, détecte leurs faiblesses digitales
          et génère des emails personnalisés. Vous prospectez avec des données, pas au hasard.
        </motion.p>

        {/* Waitlist form */}
        <motion.div
          id="hero-waitlist"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          style={{ maxWidth: 520, margin: '0 auto 52px' }}
        >
          <WaitlistForm />
          <p style={{ marginTop: 10, fontSize: 12, color: 'rgba(245,245,240,0.28)', textAlign: 'center' }}>
            Gratuit · Aucune carte bancaire requise · Accès anticipé
          </p>
        </motion.div>

        {/* Stats 48px */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.5 }}
          style={{
            display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: '16px 48px',
          }}
        >
          {STATS.map((s, i) => (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <span style={{
                fontSize: 'clamp(32px, 5vw, 48px)',
                fontWeight: 800,
                color: '#EDFA36',
                letterSpacing: '-0.03em',
                lineHeight: 1,
                textShadow: '0 0 30px rgba(237,250,54,0.4)',
              }}>
                {s.value}
              </span>
              <span style={{ fontSize: 12, color: 'rgba(245,245,240,0.4)', fontWeight: 500, letterSpacing: '0.03em' }}>
                {s.label}
              </span>
            </div>
          ))}
        </motion.div>

      </div>
    </section>
  )
}
