import { useRef } from 'react'
import { motion, useInView } from 'framer-motion'
import { useClickSound } from '../hooks/useClickSound'

const CITIES = ['Paris', 'Lyon', 'Marseille', 'Bordeaux', 'Toulouse', 'Strasbourg', 'Lille', 'Nantes', 'Nice', 'Montpellier', 'Rennes', 'Grenoble', 'Dijon', 'Metz', 'Rouen']

export default function Hero() {
  const playClick = useClickSound()
  const ref = useRef(null)
  const inView = useInView(ref, { once: true })

  const scrollToWaitlist = () => {
    playClick()
    document.querySelector('#cta-waitlist')?.scrollIntoView({ behavior: 'smooth' })
  }
  const scrollToDemo = () => {
    playClick()
    document.querySelector('#fonctionnalites')?.scrollIntoView({ behavior: 'smooth' })
  }

  const container = {
    hidden: {},
    visible: { transition: { staggerChildren: 0.1 } },
  }
  const item = {
    hidden:  { opacity: 0, y: 28 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.22, 0.61, 0.36, 1] } },
  }

  return (
    <section id="hero" style={{
      minHeight: '100vh',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '130px 24px 0',
      position: 'relative', overflow: 'hidden',
      textAlign: 'center',
    }}>

      <motion.div
        ref={ref}
        variants={container}
        initial="hidden"
        animate={inView ? 'visible' : 'hidden'}
        style={{ position: 'relative', zIndex: 1, maxWidth: 920, width: '100%' }}
      >

        {/* Badge */}
        <motion.div variants={item} style={{ marginBottom: 36 }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '7px 18px',
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
          variants={item}
          style={{
            fontSize: 'clamp(42px, 8.5vw, 96px)',
            fontWeight: 300,
            lineHeight: 1.04,
            letterSpacing: '-0.04em',
            color: '#F5F5F0',
            marginBottom: 16,
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
          variants={item}
          style={{
            fontSize: 'clamp(17px, 3vw, 28px)',
            fontStyle: 'italic',
            fontFamily: 'Georgia, serif',
            color: '#EDFA36',
            marginBottom: 22,
            letterSpacing: '-0.01em',
            opacity: 0.88,
          }}
        >
          trouvés, scorés, prêts à closer.
        </motion.p>

        {/* Description */}
        <motion.p
          variants={item}
          style={{
            fontSize: 'clamp(15px, 1.8vw, 18px)',
            color: 'rgba(245,245,240,0.54)',
            lineHeight: 1.72,
            maxWidth: 560, margin: '0 auto 44px',
          }}
        >
          Votre prochain client a un site cassé, pas de SEO, et n'a rien publié depuis 3 mois.
          On vient d'en trouver 47 dans votre ville.
        </motion.p>

        {/* Boutons */}
        <motion.div
          variants={item}
          style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 68 }}
        >
          <motion.button
            onClick={scrollToWaitlist}
            whileHover={{ y: -3, boxShadow: '0 12px 36px rgba(29,110,85,0.55)' }}
            whileTap={{ scale: 0.97 }}
            style={{
              padding: '15px 34px',
              background: '#1D6E55', color: '#F5F5F0',
              border: 'none', borderRadius: 12,
              fontSize: 15, fontWeight: 700,
              cursor: 'pointer',
              fontFamily: 'Instrument Sans, sans-serif',
              boxShadow: '0 4px 24px rgba(29,110,85,0.45)',
              letterSpacing: '0.01em',
            }}
          >
            Rejoindre la waitlist
          </motion.button>

          <motion.button
            onClick={scrollToDemo}
            whileHover={{ y: -3, borderColor: 'rgba(245,245,240,0.6)', color: '#F5F5F0' }}
            whileTap={{ scale: 0.97 }}
            style={{
              padding: '15px 34px',
              background: 'transparent', color: 'rgba(245,245,240,0.82)',
              border: '1.5px solid rgba(245,245,240,0.25)',
              borderRadius: 12, fontSize: 15, fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'Instrument Sans, sans-serif',
            }}
          >
            Voir la démo ▶
          </motion.button>
        </motion.div>

        {/* Stats rapides */}
        <motion.div
          variants={item}
          style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: '14px 48px', marginBottom: 72 }}
        >
          {[
            { val: '10',    lab: 'profils métier' },
            { val: '30s',   lab: 'Audit IA' },
            { val: '200',   lab: 'leads / recherche' },
          ].map((s, i) => (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <span style={{ fontSize: 'clamp(28px, 4vw, 44px)', fontWeight: 800, color: '#EDFA36', letterSpacing: '-0.03em', lineHeight: 1, textShadow: '0 0 28px rgba(237,250,54,0.35)' }}>{s.val}</span>
              <span style={{ fontSize: 12, color: 'rgba(245,245,240,0.38)', fontWeight: 500, letterSpacing: '0.02em' }}>{s.lab}</span>
            </div>
          ))}
        </motion.div>

      </motion.div>

      {/* Ticker villes */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        borderTop: '1px solid rgba(255,255,255,0.06)',
        background: 'rgba(19,24,21,0.8)',
        backdropFilter: 'blur(8px)',
        overflow: 'hidden',
        padding: '11px 0',
      }}>
        <div style={{ display: 'inline-flex', whiteSpace: 'nowrap', animation: 'marquee 26s linear infinite' }}>
          {[0, 1].map(n => (
            <span key={n} style={{ display: 'inline-flex', alignItems: 'center', gap: 0 }}>
              {CITIES.map((city, i) => (
                <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 0 }}>
                  <span style={{ fontSize: 11, fontWeight: 500, color: 'rgba(245,245,240,0.32)', letterSpacing: '0.14em', textTransform: 'uppercase' }}>{city}</span>
                  <span style={{ margin: '0 18px', color: 'rgba(29,110,85,0.5)', fontSize: 12 }}>·</span>
                </span>
              ))}
            </span>
          ))}
        </div>
      </div>
    </section>
  )
}
