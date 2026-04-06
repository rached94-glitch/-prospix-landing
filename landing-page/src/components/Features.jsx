import { useRef, useEffect, useState } from 'react'

const FEATURES = [
  {
    icon: '🗺️',
    color: '#2A9D74',
    title: 'Recherche locale intelligente',
    description: "Cherchez par ville et secteur. Prospix scanne Google Maps et trouve les commerces avec le plus de potentiel pour votre métier.",
  },
  {
    icon: '🤖',
    color: '#7c3aed',
    title: 'Audit IA personnalisé',
    description: "Un rapport complet avec forces, faiblesses, recommandations et plan d'action. Généré en 30 secondes par l'IA, adapté au profil du freelance.",
  },
  {
    icon: '✉️',
    color: '#EDFA36',
    title: 'Email de prospection IA',
    description: "Un email prêt à envoyer basé sur les données réelles du commerce. Pas de template générique — chaque email est unique.",
  },
  {
    icon: '🎯',
    color: '#f59e0b',
    title: "Score d'opportunité",
    description: "Chaque commerce reçoit un score sur 100. Plus le score est bas, plus l'opportunité est grande. Vous ne perdez plus de temps sur les mauvais leads.",
  },
]

function FeatureCard({ feature, index }) {
  const ref = useRef(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect() } }, { threshold: 0.2 })
    if (ref.current) obs.observe(ref.current)
    return () => obs.disconnect()
  }, [])

  return (
    <div
      ref={ref}
      style={{
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: 18,
        padding: '28px 26px',
        display: 'flex', gap: 20,
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateX(0)' : `translateX(${index % 2 === 0 ? '-24px' : '24px'})`,
        transition: `opacity 0.55s ease ${index * 80}ms, transform 0.55s ease ${index * 80}ms, border-color 0.2s`,
      }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.13)'; e.currentTarget.style.background = 'rgba(255,255,255,0.05)' }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)'; e.currentTarget.style.background = 'rgba(255,255,255,0.03)' }}
    >
      {/* Icon */}
      <div style={{
        width: 48, height: 48, flexShrink: 0,
        background: `rgba(${feature.color === '#EDFA36' ? '237,250,54' : feature.color === '#2A9D74' ? '42,157,116' : feature.color === '#7c3aed' ? '124,58,237' : '245,158,11'}, 0.12)`,
        border: `1px solid rgba(${feature.color === '#EDFA36' ? '237,250,54' : feature.color === '#2A9D74' ? '42,157,116' : feature.color === '#7c3aed' ? '124,58,237' : '245,158,11'}, 0.25)`,
        borderRadius: 12,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 22,
      }}>
        {feature.icon}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ fontSize: 17, fontWeight: 700, color: '#F5F5F0', letterSpacing: '-0.01em' }}>
          {feature.title}
        </div>
        <div style={{ fontSize: 14, color: 'rgba(245,245,240,0.52)', lineHeight: 1.65 }}>
          {feature.description}
        </div>
      </div>
    </div>
  )
}

export default function Features() {
  const titleRef = useRef(null)
  const [titleVisible, setTitleVisible] = useState(false)

  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setTitleVisible(true); obs.disconnect() } }, { threshold: 0.3 })
    if (titleRef.current) obs.observe(titleRef.current)
    return () => obs.disconnect()
  }, [])

  return (
    <section id="fonctionnalites" style={{ padding: '96px 24px', background: 'rgba(255,255,255,0.015)' }}>
      <div style={{ maxWidth: 1000, margin: '0 auto' }}>

        {/* Title */}
        <div
          ref={titleRef}
          style={{
            textAlign: 'center', marginBottom: 56,
            opacity: titleVisible ? 1 : 0,
            transform: titleVisible ? 'translateY(0)' : 'translateY(24px)',
            transition: 'opacity 0.5s, transform 0.5s',
          }}
        >
          <div style={{
            display: 'inline-block', marginBottom: 14,
            padding: '4px 12px',
            background: 'rgba(237,250,54,0.1)',
            border: '1px solid rgba(237,250,54,0.25)',
            borderRadius: 20, fontSize: 11, fontWeight: 600, color: '#EDFA36', letterSpacing: '0.06em', textTransform: 'uppercase',
          }}>
            Fonctionnalités
          </div>
          <h2 style={{ fontSize: 'clamp(28px, 4vw, 42px)', fontWeight: 700, color: '#F5F5F0', letterSpacing: '-0.02em' }}>
            Ce que Prospix fait pour vous
          </h2>
        </div>

        {/* 2x2 grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: 16 }}>
          {FEATURES.map((f, i) => <FeatureCard key={i} feature={f} index={i} />)}
        </div>
      </div>
    </section>
  )
}
