import { motion } from 'framer-motion'
import WaitlistForm from './WaitlistForm'

const STATS = [
  { value: '10',   label: 'profils métier' },
  { value: '30s',  label: 'Audit IA' },
  { value: '1 clic', label: 'Email personnalisé' },
]

export default function Hero() {
  return (
    <section style={{
      minHeight: '100vh',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '120px 24px 80px',
      position: 'relative', overflow: 'hidden',
    }}>
      {/* Background glow */}
      <div style={{
        position: 'absolute', top: '20%', left: '50%',
        transform: 'translateX(-50%)',
        width: 700, height: 400,
        background: 'radial-gradient(ellipse, rgba(29,110,85,0.18) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', bottom: '10%', right: '10%',
        width: 300, height: 300,
        background: 'radial-gradient(ellipse, rgba(237,250,54,0.06) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      <div style={{ position: 'relative', zIndex: 1, maxWidth: 760, width: '100%', textAlign: 'center' }}>

        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 7, marginBottom: 32 }}
        >
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 7,
            padding: '6px 14px',
            background: 'rgba(29,110,85,0.15)',
            border: '1px solid rgba(29,110,85,0.3)',
            borderRadius: 30,
            fontSize: 12, fontWeight: 600,
            color: '#4ade80',
            letterSpacing: '0.04em',
          }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#4ade80', boxShadow: '0 0 6px #4ade80', display: 'inline-block', animation: 'pulse 2s infinite' }} />
            Outil de prospection IA pour freelances
          </span>
        </motion.div>

        {/* H1 */}
        <motion.h1
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          style={{
            fontSize: 'clamp(36px, 6vw, 64px)',
            fontWeight: 700,
            lineHeight: 1.1,
            letterSpacing: '-0.03em',
            color: '#F5F5F0',
            marginBottom: 22,
          }}
        >
          Trouvez les commerces
          <br />
          qui ont <em style={{ color: '#EDFA36', fontStyle: 'italic', fontFamily: 'Georgia, serif' }}>besoin</em> de vous.
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          style={{
            fontSize: 'clamp(15px, 2vw, 18px)',
            color: 'rgba(245,245,240,0.6)',
            lineHeight: 1.65,
            marginBottom: 42,
            maxWidth: 600,
            margin: '0 auto 42px',
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
          <p style={{ marginTop: 10, fontSize: 12, color: 'rgba(245,245,240,0.3)', textAlign: 'center' }}>
            Gratuit · Aucune carte bancaire requise · Accès anticipé
          </p>
        </motion.div>

        {/* Stats */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.5 }}
          style={{
            display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: '8px 40px',
          }}
        >
          {STATS.map((s, i) => (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
              <span style={{ fontSize: 26, fontWeight: 700, color: '#EDFA36', letterSpacing: '-0.02em' }}>
                {s.value}
              </span>
              <span style={{ fontSize: 12, color: 'rgba(245,245,240,0.45)', fontWeight: 500 }}>
                {s.label}
              </span>
            </div>
          ))}
        </motion.div>

      </div>
    </section>
  )
}
