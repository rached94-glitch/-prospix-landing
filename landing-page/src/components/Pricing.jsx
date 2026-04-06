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
  const [hovered, setHovered] = useState(false)
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
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: 'relative',
        background: plan.popular ? 'rgba(29,110,85,0.08)' : 'rgba(255,255,255,0.03)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: plan.popular
          ? '1.5px solid rgba(29,110,85,0.5)'
          : (hovered ? '1px solid rgba(255,255,255,0.12)' : '1px solid rgba(255,255,255,0.06)'),
        borderRadius: 20,
        padding: '30px 24px',
        display: 'flex', flexDirection: 'column', gap: 20,
        transform: plan.popular
          ? (visible ? 'scale(1.04)' : 'scale(1)')
          : (hovered ? 'translateY(-6px)' : (visible ? 'translateY(0)' : 'translateY(32px)')),
        boxShadow: plan.popular
          ? (hovered ? '0 20px 60px rgba(29,110,85,0.3), 0 0 0 1px rgba(29,110,85,0.2)' : '0 0 48px rgba(29,110,85,0.2)')
          : (hovered ? '0 16px 48px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.07)' : '0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05)'),
        opacity: visible ? 1 : 0,
        transition: `opacity 0.5s ease ${index * 80}ms, transform 0.3s ease, border-color 0.3s, box-shadow 0.3s`,
      }}
    >
      {plan.popular && (
        <div style={{
          position: 'absolute', top: -13, left: '50%', transform: 'translateX(-50%)',
          background: 'linear-gradient(90deg, #EDFA36, #c8f000)',
          color: '#0A0F0D',
          fontSize: 10, fontWeight: 800,
          padding: '4px 14px', borderRadius: 20,
          letterSpacing: '0.1em', textTransform: 'uppercase',
          whiteSpace: 'nowrap',
          boxShadow: '0 4px 16px rgba(237,250,54,0.35)',
        }}>
          POPULAIRE
        </div>
      )}

      {/* Header */}
      <div>
        <div style={{ fontSize: 13, fontWeight: 700, color: plan.popular ? '#4ade80' : 'rgba(245,245,240,0.4)', marginBottom: 10, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
          {plan.name}
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
          <span style={{ fontSize: 40, fontWeight: 800, color: '#F5F5F0', letterSpacing: '-0.03em' }}>{plan.price}</span>
          <span style={{ fontSize: 14, color: 'rgba(245,245,240,0.4)', fontWeight: 500 }}>{plan.period}</span>
        </div>
        <div style={{ marginTop: 6, fontSize: 12, color: plan.popular ? '#4ade80' : 'rgba(245,245,240,0.35)', fontWeight: 600 }}>
          {plan.credits}
        </div>
      </div>

      {/* Divider */}
      <div style={{ height: 1, background: plan.popular ? 'rgba(29,110,85,0.3)' : 'rgba(255,255,255,0.06)' }} />

      {/* Features */}
      <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>
        {plan.features.map((f, i) => (
          <li key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13.5, color: 'rgba(245,245,240,0.72)' }}>
            <span style={{
              width: 18, height: 18, flexShrink: 0,
              background: plan.popular ? 'rgba(74,222,128,0.15)' : 'rgba(29,110,85,0.12)',
              border: plan.popular ? '1px solid rgba(74,222,128,0.25)' : '1px solid rgba(29,110,85,0.2)',
              borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 10, color: plan.popular ? '#4ade80' : 'rgba(42,157,116,0.9)',
            }}>✓</span>
            {f}
          </li>
        ))}
      </ul>

      {/* CTA */}
      <button
        onClick={scrollToWaitlist}
        style={{
          padding: '13px 20px',
          background: plan.popular
            ? 'linear-gradient(135deg, #1D6E55, #2A9D74)'
            : 'rgba(255,255,255,0.07)',
          color: plan.popular ? '#F5F5F0' : 'rgba(245,245,240,0.65)',
          border: plan.popular ? 'none' : '1px solid rgba(255,255,255,0.1)',
          borderRadius: 12,
          fontSize: 14, fontWeight: 700,
          cursor: 'pointer',
          fontFamily: 'Instrument Sans, sans-serif',
          transition: 'all 0.2s',
          boxShadow: plan.popular ? '0 4px 24px rgba(29,110,85,0.35)' : 'none',
          backdropFilter: 'blur(8px)',
        }}
        onMouseEnter={e => {
          e.currentTarget.style.transform = 'scale(1.03) translateY(-1px)'
          e.currentTarget.style.boxShadow = plan.popular ? '0 8px 32px rgba(29,110,85,0.5)' : '0 4px 16px rgba(0,0,0,0.3)'
        }}
        onMouseLeave={e => {
          e.currentTarget.style.transform = 'scale(1) translateY(0)'
          e.currentTarget.style.boxShadow = plan.popular ? '0 4px 24px rgba(29,110,85,0.35)' : 'none'
        }}
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
    <section id="tarifs" style={{ padding: '96px 24px', background: 'rgba(255,255,255,0.01)' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>

        <div
          ref={titleRef}
          style={{
            textAlign: 'center', marginBottom: 64,
            opacity: titleVisible ? 1 : 0,
            transform: titleVisible ? 'scale(1) translateY(0)' : 'scale(0.95) translateY(24px)',
            transition: 'opacity 0.5s, transform 0.5s',
          }}
        >
          <div style={{
            display: 'inline-block', marginBottom: 14,
            padding: '4px 14px',
            background: 'rgba(29,110,85,0.12)',
            border: '1px solid rgba(29,110,85,0.25)',
            borderRadius: 20, fontSize: 11, fontWeight: 600, color: '#4ade80', letterSpacing: '0.07em', textTransform: 'uppercase',
          }}>
            Tarifs
          </div>
          <h2 style={{ fontSize: 'clamp(28px, 4vw, 44px)', fontWeight: 700, color: '#F5F5F0', letterSpacing: '-0.02em', margin: '0 0 12px' }}>
            Simple. Tout en crédits.
          </h2>
          <p style={{ fontSize: 15, color: 'rgba(245,245,240,0.42)', maxWidth: 460, margin: '0 auto' }}>
            Chaque action coûte 1 crédit. Analysez, générez, exportez — et ne payez que ce que vous utilisez.
          </p>
        </div>

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
