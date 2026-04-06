import { useRef, useState } from 'react'
import { motion, useInView } from 'framer-motion'
import { useClickSound } from '../hooks/useClickSound'

const PLANS = [
  {
    name: 'Essai',
    price: '0€',
    period: 'gratuit',
    credits: '15 crédits',
    features: ["Recherche Google Maps", "Score d'opportunité", "Email IA", "Export PDF", "30 leads / recherche"],
    popular: false,
    cta: 'Commencer gratuitement',
  },
  {
    name: 'Starter',
    price: '19€',
    period: '/mois',
    credits: '80 crédits / mois',
    features: ["Tout dans Essai", "Audit IA personnalisé", "Analyse PageSpeed", "60 leads / recherche", "10 recherches / jour"],
    popular: false,
    cta: 'Commencer',
  },
  {
    name: 'Pro',
    price: '49€',
    period: '/mois',
    credits: '250 crédits / mois',
    features: ["Tout dans Starter", "Analyse réseaux sociaux", "Email reformulable par IA", "120 leads par recherche", "30 recherches / jour"],
    popular: true,
    cta: 'Commencer',
  },
  {
    name: 'Business',
    price: '99€',
    period: '/mois',
    credits: '600 crédits / mois',
    features: ["Tout dans Pro", "Rapports white-label", "Accès équipe", "200 leads par recherche", "Support prioritaire"],
    popular: false,
    cta: 'Commencer',
  },
]

function PlanCard({ plan, index }) {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-60px' })
  const [hovered, setHovered] = useState(false)
  const playClick = useClickSound()

  const scrollToWaitlist = () => {
    playClick()
    document.querySelector('#cta-waitlist')?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 36 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.55, delay: index * 0.08, ease: 'easeOut' }}
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => setHovered(false)}
      whileHover={{ y: -7 }}
      style={{
        position: 'relative',
        background: plan.popular ? 'rgba(29,110,85,0.1)' : 'rgba(255,255,255,0.03)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: plan.popular
          ? '1.5px solid rgba(29,110,85,0.55)'
          : (hovered ? '1px solid rgba(255,255,255,0.12)' : '1px solid rgba(255,255,255,0.06)'),
        borderRadius: 20,
        padding: '32px 24px',
        display: 'flex', flexDirection: 'column', gap: 20,
        boxShadow: plan.popular
          ? '0 0 48px rgba(29,110,85,0.22)'
          : (hovered ? '0 16px 48px rgba(0,0,0,0.5)' : '0 4px 20px rgba(0,0,0,0.3)'),
        transition: 'border-color 0.25s, box-shadow 0.3s',
      }}
    >
      {plan.popular && (
        <div style={{
          position: 'absolute', top: -13, left: '50%', transform: 'translateX(-50%)',
          background: 'linear-gradient(90deg, #EDFA36, #c8f000)',
          color: '#0A0F0D',
          fontSize: 10, fontWeight: 800,
          padding: '4px 16px', borderRadius: 20,
          letterSpacing: '0.1em', textTransform: 'uppercase',
          whiteSpace: 'nowrap',
          boxShadow: '0 4px 18px rgba(237,250,54,0.4)',
        }}>
          POPULAIRE
        </div>
      )}

      {/* Header */}
      <div>
        <div style={{ fontSize: 12, fontWeight: 700, color: plan.popular ? '#4ade80' : 'rgba(245,245,240,0.4)', marginBottom: 10, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
          {plan.name}
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
          <span style={{ fontSize: 42, fontWeight: 800, color: '#F5F5F0', letterSpacing: '-0.04em', lineHeight: 1 }}>{plan.price}</span>
          <span style={{ fontSize: 14, color: 'rgba(245,245,240,0.35)', fontWeight: 500 }}>{plan.period}</span>
        </div>
        <div style={{ marginTop: 7, fontSize: 12, fontWeight: 600, color: plan.popular ? '#4ade80' : 'rgba(245,245,240,0.35)' }}>
          {plan.credits}
        </div>
      </div>

      {/* Divider */}
      <div style={{ height: 1, background: plan.popular ? 'rgba(29,110,85,0.35)' : 'rgba(255,255,255,0.06)' }} />

      {/* Features */}
      <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>
        {plan.features.map((f, i) => (
          <li key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13.5, color: 'rgba(245,245,240,0.72)' }}>
            <span style={{
              width: 18, height: 18, flexShrink: 0,
              background: plan.popular ? 'rgba(74,222,128,0.15)' : 'rgba(29,110,85,0.12)',
              border: plan.popular ? '1px solid rgba(74,222,128,0.3)' : '1px solid rgba(29,110,85,0.2)',
              borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 10, color: plan.popular ? '#4ade80' : '#2A9D74',
            }}>✓</span>
            {f}
          </li>
        ))}
      </ul>

      {/* CTA */}
      <motion.button
        onClick={scrollToWaitlist}
        whileHover={{ scale: 1.03 }}
        whileTap={{ scale: 0.97 }}
        style={{
          padding: '13px 20px',
          background: plan.popular ? 'linear-gradient(135deg, #1D6E55, #2A9D74)' : 'rgba(255,255,255,0.08)',
          color: plan.popular ? '#F5F5F0' : 'rgba(245,245,240,0.65)',
          border: plan.popular ? 'none' : '1px solid rgba(255,255,255,0.1)',
          borderRadius: 12, fontSize: 14, fontWeight: 700,
          cursor: 'pointer',
          fontFamily: 'Instrument Sans, sans-serif',
          boxShadow: plan.popular ? '0 4px 24px rgba(29,110,85,0.4)' : 'none',
        }}
      >
        {plan.cta}
      </motion.button>

      <div style={{ fontSize: 11, color: 'rgba(245,245,240,0.2)', textAlign: 'center' }}>
        Tous les plans incluent l'accès anticipé
      </div>
    </motion.div>
  )
}

export default function Pricing() {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-80px' })

  return (
    <section id="tarifs" style={{ padding: '112px 24px', background: 'rgba(0,0,0,0.15)' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>

        <motion.div
          ref={ref}
          initial={{ opacity: 0, y: 24, scale: 0.97 }}
          animate={inView ? { opacity: 1, y: 0, scale: 1 } : {}}
          transition={{ duration: 0.55 }}
          style={{ textAlign: 'center', marginBottom: 64 }}
        >
          <h2 style={{ fontSize: 'clamp(30px, 4vw, 48px)', fontWeight: 700, color: '#F5F5F0', letterSpacing: '-0.02em', margin: '0 0 14px' }}>
            Simple. Tout en crédits.
          </h2>
          <p style={{ fontSize: 16, color: 'rgba(245,245,240,0.45)', maxWidth: 520, margin: '0 auto' }}>
            Recherche, audit, email, export — chaque action consomme des crédits. Choisissez le plan adapté à votre volume de prospection.
          </p>
        </motion.div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))',
          gap: 20, alignItems: 'center',
        }}>
          {PLANS.map((p, i) => <PlanCard key={i} plan={p} index={i} />)}
        </div>
      </div>
    </section>
  )
}
