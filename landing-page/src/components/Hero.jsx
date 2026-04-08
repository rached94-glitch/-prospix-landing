import { useRef } from 'react'
import { motion, useInView } from 'framer-motion'
import { useClickSound } from '../hooks/useClickSound'

const CITIES = ['Paris', 'Lyon', 'Marseille', 'Bordeaux', 'Toulouse', 'Strasbourg', 'Lille', 'Nantes', 'Nice', 'Montpellier', 'Berlin', 'London', 'Dubai', 'Bruxelles', 'Genève', 'Barcelona', 'Amsterdam']

export default function Hero() {
  const playClick = useClickSound()
  const ref = useRef(null)
  const inView = useInView(ref, { once: true })

  const scrollToWaitlist = () => {
    try { playClick() } catch (_) {}
    document.querySelector('#cta-waitlist')?.scrollIntoView({ behavior: 'smooth' })
  }
  const scrollToDemo = () => {
    try { playClick() } catch (_) {}
    document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' })
  }

  const container = {
    hidden: {},
    visible: { transition: { staggerChildren: 0.08 } },
  }
  const item = {
    hidden:  { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.22, 0.61, 0.36, 1] } },
  }

  return (
    <section id="hero" style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '96px 24px 48px',
      position: 'relative', overflow: 'hidden',
      textAlign: 'center',
    }}>

      <motion.div
        ref={ref}
        variants={container}
        initial="hidden"
        animate={inView ? 'visible' : 'hidden'}
        style={{ position: 'relative', zIndex: 1, maxWidth: 860, width: '100%' }}
      >

        {/* Badge */}
        <motion.div variants={item} style={{ marginBottom: 16 }}>
          <span style={{
            fontSize: 11, fontWeight: 500,
            color: 'rgba(245,245,240,0.4)',
            letterSpacing: '3px',
            textTransform: 'uppercase',
            fontFamily: 'DM Sans, system-ui, sans-serif',
          }}>
            Prospection Intelligente
          </span>
        </motion.div>

        {/* H1 */}
        <motion.h1
          variants={item}
          style={{
            fontSize: 'clamp(32px, 6vw, 72px)',
            fontWeight: 300,
            lineHeight: 1.08,
            letterSpacing: '-0.04em',
            color: '#F5F5F0',
            marginBottom: 16,
          }}
        >
          Trouvez les{' '}
          <span style={{
            background: 'linear-gradient(135deg, #1D6E55, #2A9D74, #EDFA36)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}>commerces</span>
          {' '}qui ont{' '}
          <em style={{
            fontStyle: 'italic',
            fontFamily: 'Georgia, "Times New Roman", serif',
            fontWeight: 400,
            background: 'linear-gradient(135deg, #1D6E55, #2A9D74, #EDFA36)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}>besoin</em>
          {' '}de vous.
        </motion.h1>

        {/* Sous-ligne */}
        <motion.p
          variants={item}
          style={{
            fontSize: 18,
            fontStyle: 'italic',
            fontFamily: 'Georgia, serif',
            marginBottom: 24,
            letterSpacing: '-0.01em',
            background: 'linear-gradient(135deg, #1D6E55, #2A9D74, #EDFA36)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}
        >
          trouvés, analysés, prêts à closer.
        </motion.p>

        {/* Description */}
        <motion.p
          variants={item}
          style={{
            fontSize: 15,
            color: 'rgba(245,245,240,0.54)',
            lineHeight: 1.7,
            maxWidth: 600, margin: '0 auto 24px',
          }}
        >
          Votre prochain client a un site cassé, pas de SEO, et n'a rien publié depuis 3 mois.
          On vient d'en trouver 47 dans votre ville.
        </motion.p>

        {/* Boutons */}
        <motion.div
          variants={item}
          style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', marginTop: 16, marginBottom: 48 }}
        >
          <motion.button
            onClick={scrollToWaitlist}
            whileHover={{ y: -3, boxShadow: '0 12px 36px rgba(29,110,85,0.55)' }}
            whileTap={{ scale: 0.97 }}
            style={{
              padding: '13px 30px',
              background: '#1D6E55', color: '#F5F5F0',
              border: 'none', borderRadius: 12,
              fontSize: 15, fontWeight: 700,
              cursor: 'pointer',
              fontFamily: 'DM Sans, sans-serif',
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
              padding: '13px 30px',
              background: 'transparent', color: 'rgba(245,245,240,0.82)',
              border: '1.5px solid rgba(245,245,240,0.25)',
              borderRadius: 12, fontSize: 15, fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'DM Sans, sans-serif',
            }}
          >
            Voir la démo
          </motion.button>
        </motion.div>

        {/* Stats rapides */}
        <motion.div
          variants={item}
          style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: '10px 40px', marginBottom: 32 }}
        >
          {[
            { val: '10',   lab: 'profils métier' },
            { val: '1min', lab: 'Audit IA' },
            { val: '120',  lab: 'leads / recherche' },
          ].map((s, i) => (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
              <span style={{ fontSize: 'clamp(24px, 3.5vw, 36px)', fontWeight: 800, color: '#FFFFFF', letterSpacing: '-0.03em', lineHeight: 1 }}>{s.val}</span>
              <span style={{ fontSize: 11, color: 'rgba(245,245,240,0.5)', fontWeight: 500, letterSpacing: '0.02em' }}>{s.lab}</span>
            </div>
          ))}
        </motion.div>

      </motion.div>

      {/* Ticker villes */}
      <div style={{
        width: '100%', overflow: 'hidden',
        marginTop: 48,
        paddingTop: 32,
      }}>
        <div style={{ display: 'inline-flex', whiteSpace: 'nowrap', animation: 'marquee 35s linear infinite' }}>
          {[0, 1].map(n => (
            <span key={n} style={{ display: 'inline-flex', alignItems: 'center' }}>
              {CITIES.map((city, i) => (
                <span key={i} style={{ display: 'inline-flex', alignItems: 'center' }}>
                  <span style={{ fontSize: 13, fontWeight: 400, color: 'rgba(245,245,240,0.25)', fontFamily: 'DM Sans, system-ui, sans-serif' }}>{city}</span>
                  <span style={{ margin: '0 20px', color: 'rgba(245,245,240,0.15)', fontSize: 13 }}>·</span>
                </span>
              ))}
            </span>
          ))}
        </div>
      </div>
    </section>
  )
}
