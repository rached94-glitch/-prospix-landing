import { useRef, useEffect, useState } from 'react'
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
    features: ["Tout dans Starter", "Analyse réseaux sociaux", "Email reformulable par IA", "120 leads / recherche", "30 recherches / jour"],
    popular: true,
    cta: 'Commencer',
  },
  {
    name: 'Business',
    price: '99€',
    period: '/mois',
    credits: '600 crédits / mois',
    features: ["Tout dans Pro", "Rapports white-label", "Accès équipe", "200 leads / recherche", "Support prioritaire"],
    popular: false,
    cta: 'Commencer',
  },
]

function PlanCard({ plan, index }) {
  const ref = useRef(null)
  const [visible, setVisible] = useState(false)
  const playClick = useClickSound()

  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect() } }, { threshold: 0.15 })
    if (ref.current) obs.observe(ref.current)
    return () => obs.disconnect()
  }, [])

  const scrollToWaitlist = () => {
    playClick()
    document.querySelector('#hero-waitlist')?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <div
      ref={ref}
      style={{
        position: 'relative',
        background: plan.popular ? '#1C2020' : 'rgba(255,255,255,0.03)',
        border: plan.popular ? '1.5px solid rgba(29,110,85,0.5)' : '1px solid rgba(255,255,255,0.08)',
        borderRadius: 18,
        padding: '28px 24px',
        display: 'flex', flexDirection: 'column', gap: 20,
        transform: plan.popular ? 'scale(1.03)' : 'none',
        boxShadow: plan.popular ? '0 0 40px rgba(29,110,85,0.18)' : 'none',
        opacity: visible ? 1 : 0,
        transition: `opacity 0.5s ease ${index * 80}ms, border-color 0.2s`,
      }}
    >
      {plan.popular && (
        <div style={{
          position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)',
          background: '#EDFA36',
          color: '#0A0F0D',
          fontSize: 10, fontWeight: 800,
          padding: '3px 12px', borderRadius: 20,
          letterSpacing: '0.08em', textTransform: 'uppercase',
          whiteSpace: 'nowrap',
        }}>
          POPULAIRE
        </div>
      )}

      {/* Header */}
      <div>
        <div style={{ fontSize: 14, fontWeight: 600, color: plan.popular ? '#4ade80' : 'rgba(245,245,240,0.5)', marginBottom: 8 }}>
          {plan.name}
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
          <span style={{ fontSize: 38, fontWeight: 800, color: '#F5F5F0', letterSpacing: '-0.03em' }}>{plan.price}</span>
          <span style={{ fontSize: 14, color: 'rgba(245,245,240,0.4)', fontWeight: 500 }}>{plan.period}</span>
        </div>
        <div style={{ marginTop: 6, fontSize: 12, color: plan.popular ? '#4ade80' : 'rgba(245,245,240,0.4)', fontWeight: 600 }}>
          {plan.credits}
        </div>
      </div>

      {/* Features */}
      <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 9, flex: 1 }}>
        {plan.features.map((f, i) => (
          <li key={i} style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 13.5, color: 'rgba(245,245,240,0.75)' }}>
            <span style={{ color: plan.popular ? '#4ade80' : 'rgba(29,110,85,0.8)', fontSize: 13, flexShrink: 0 }}>✓</span>
            {f}
          </li>
        ))}
      </ul>

      {/* CTA */}
      <button
        onClick={scrollToWaitlist}
        style={{
          padding: '12px 20px',
          background: plan.popular ? 'linear-gradient(135deg, #1D6E55, #2A9D74)' : 'rgba(255,255,255,0.07)',
          color: plan.popular ? '#F5F5F0' : 'rgba(245,245,240,0.7)',
          border: plan.popular ? 'none' : '1px solid rgba(255,255,255,0.1)',
          borderRadius: 10,
          fontSize: 14, fontWeight: 700,
          cursor: 'pointer',
          fontFamily: 'Instrument Sans, sans-serif',
          transition: 'all 0.15s',
          boxShadow: plan.popular ? '0 4px 20px rgba(29,110,85,0.3)' : 'none',
        }}
        onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.02)'; e.currentTarget.style.opacity = '0.9' }}
        onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.opacity = '1' }}
      >
        {plan.cta}
      </button>
    </div>
  )
}

export default function Pricing() {
  const titleRef = useRef(null)
  const [titleVisible, setTitleVisible] = useState(false)

  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setTitleVisible(true); obs.disconnect() } }, { threshold: 0.3 })
    if (titleRef.current) obs.observe(titleRef.current)
    return () => obs.disconnect()
  }, [])

  return (
    <section id="tarifs" style={{ padding: '96px 24px', background: 'rgba(255,255,255,0.015)' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>

        <div
          ref={titleRef}
          style={{
            textAlign: 'center', marginBottom: 64,
            opacity: titleVisible ? 1 : 0,
            transform: titleVisible ? 'translateY(0)' : 'translateY(24px)',
            transition: 'opacity 0.5s, transform 0.5s',
          }}
        >
          <div style={{
            display: 'inline-block', marginBottom: 14,
            padding: '4px 12px',
            background: 'rgba(29,110,85,0.12)',
            border: '1px solid rgba(29,110,85,0.25)',
            borderRadius: 20, fontSize: 11, fontWeight: 600, color: '#4ade80', letterSpacing: '0.06em', textTransform: 'uppercase',
          }}>
            Tarifs
          </div>
          <h2 style={{ fontSize: 'clamp(28px, 4vw, 42px)', fontWeight: 700, color: '#F5F5F0', letterSpacing: '-0.02em' }}>
            Simple. Tout en crédits.
          </h2>
          <p style={{ marginTop: 14, fontSize: 15, color: 'rgba(245,245,240,0.45)', maxWidth: 460, margin: '14px auto 0' }}>
            Chaque action coûte 1 crédit. Analysez, générez, exportez — et ne payez que ce que vous utilisez.
          </p>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))',
          gap: 18, alignItems: 'center',
        }}>
          {PLANS.map((p, i) => <PlanCard key={i} plan={p} index={i} />)}
        </div>
      </div>
    </section>
  )
}
