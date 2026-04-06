import { useRef, useEffect, useState } from 'react'
import { MapPin, Sparkles, Mail, Target } from 'lucide-react'

const FEATURES = [
  {
    Icon: MapPin,
    color: '#2A9D74',
    colorRgb: '42,157,116',
    title: 'Recherche locale intelligente',
    description: "Cherchez par ville et secteur. Prospix scanne Google Maps et trouve les commerces avec le plus de potentiel pour votre métier.",
  },
  {
    Icon: Sparkles,
    color: '#7c3aed',
    colorRgb: '124,58,237',
    title: 'Audit IA personnalisé',
    description: "Un rapport complet avec forces, faiblesses, recommandations et plan d'action. Généré en 30 secondes par l'IA, adapté au profil du freelance.",
  },
  {
    Icon: Mail,
    color: '#EDFA36',
    colorRgb: '237,250,54',
    title: 'Email de prospection IA',
    description: "Un email prêt à envoyer basé sur les données réelles du commerce. Pas de template générique — chaque email est unique.",
  },
  {
    Icon: Target,
    color: '#f59e0b',
    colorRgb: '245,158,11',
    title: "Score d'opportunité",
    description: "Chaque commerce reçoit un score sur 100. Plus le score est bas, plus l'opportunité est grande. Vous ne perdez plus de temps sur les mauvais leads.",
  },
]

function FeatureCard({ feature, index }) {
  const ref = useRef(null)
  const [visible, setVisible] = useState(false)
  const [hovered, setHovered] = useState(false)
  const { Icon } = feature

  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect() } }, { threshold: 0.2 })
    if (ref.current) obs.observe(ref.current)
    return () => obs.disconnect()
  }, [])

  return (
    <div
      ref={ref}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: 'rgba(255,255,255,0.03)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: hovered ? '1px solid rgba(255,255,255,0.13)' : '1px solid rgba(255,255,255,0.06)',
        borderRadius: 20,
        padding: '28px 26px',
        display: 'flex', gap: 20,
        opacity: visible ? 1 : 0,
        transform: visible
          ? (hovered ? 'translateY(-6px)' : 'translateY(0)')
          : `translateX(${index % 2 === 0 ? '-32px' : '32px'})`,
        boxShadow: hovered
          ? '0 16px 48px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.08)'
          : '0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05)',
        transition: `opacity 0.55s ease ${index * 80}ms, transform 0.3s ease, border-color 0.3s, box-shadow 0.3s`,
      }}
    >
      {/* Icon */}
      <div style={{
        width: 52, height: 52, flexShrink: 0,
        background: `rgba(${feature.colorRgb}, 0.1)`,
        border: `1px solid rgba(${feature.colorRgb}, 0.25)`,
        borderRadius: 14,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: `0 4px 16px rgba(${feature.colorRgb}, 0.15)`,
        transition: 'transform 0.3s',
        transform: hovered ? 'scale(1.08)' : 'scale(1)',
      }}>
        <Icon size={24} color={feature.color} strokeWidth={1.75} />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
        <div style={{ fontSize: 17, fontWeight: 700, color: '#F5F5F0', letterSpacing: '-0.01em' }}>
          {feature.title}
        </div>
        <div style={{ fontSize: 14, color: 'rgba(245,245,240,0.5)', lineHeight: 1.68 }}>
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
    <section id="fonctionnalites" style={{ padding: '96px 24px', background: 'rgba(255,255,255,0.01)' }}>
      <div style={{ maxWidth: 1000, margin: '0 auto' }}>

        <div
          ref={titleRef}
          style={{
            textAlign: 'center', marginBottom: 56,
            opacity: titleVisible ? 1 : 0,
            transform: titleVisible ? 'scale(1) translateY(0)' : 'scale(0.95) translateY(24px)',
            transition: 'opacity 0.5s, transform 0.5s',
          }}
        >
          <div style={{
            display: 'inline-block', marginBottom: 14,
            padding: '4px 14px',
            background: 'rgba(237,250,54,0.1)',
            border: '1px solid rgba(237,250,54,0.25)',
            borderRadius: 20, fontSize: 11, fontWeight: 600, color: '#EDFA36', letterSpacing: '0.07em', textTransform: 'uppercase',
          }}>
            Fonctionnalités
          </div>
          <h2 style={{ fontSize: 'clamp(28px, 4vw, 44px)', fontWeight: 700, color: '#F5F5F0', letterSpacing: '-0.02em', margin: 0 }}>
            Ce que Prospix fait pour vous
          </h2>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: 16 }}>
          {FEATURES.map((f, i) => <FeatureCard key={i} feature={f} index={i} />)}
        </div>
      </div>
    </section>
  )
}
