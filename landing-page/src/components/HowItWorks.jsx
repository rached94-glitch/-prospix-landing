import { useRef, useEffect, useState } from 'react'

const STEPS = [
  {
    number: '1',
    title: 'Cherchez',
    description: "Entrez un secteur et une ville. Prospix trouve jusqu'à 200 commerces locaux avec leurs données Google.",
    icon: '🔍',
  },
  {
    number: '2',
    title: 'Analysez',
    description: "L'IA analyse les avis, le site web, les réseaux sociaux et génère un score d'opportunité pour chaque commerce.",
    icon: '⚡',
  },
  {
    number: '3',
    title: 'Prospectez',
    description: "Générez un audit PDF et un email personnalisé. Prêt à envoyer en un clic.",
    icon: '✉️',
  },
]

function StepCard({ step, index }) {
  const ref = useRef(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect() } }, { threshold: 0.3 })
    if (ref.current) obs.observe(ref.current)
    return () => obs.disconnect()
  }, [])

  return (
    <div
      ref={ref}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18,
        flex: 1, minWidth: 200,
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(32px)',
        transition: `opacity 0.55s ease ${index * 150}ms, transform 0.55s ease ${index * 150}ms`,
      }}
    >
      {/* Number circle */}
      <div style={{
        position: 'relative',
        width: 72, height: 72,
        borderRadius: '50%',
        background: 'linear-gradient(135deg, rgba(29,110,85,0.3), rgba(42,157,116,0.15))',
        border: '1.5px solid rgba(29,110,85,0.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 0 28px rgba(29,110,85,0.2)',
      }}>
        <span style={{ fontSize: 28, fontWeight: 800, color: '#4ade80', letterSpacing: '-0.03em' }}>
          {step.number}
        </span>
      </div>

      {/* Icon */}
      <span style={{ fontSize: 28 }}>{step.icon}</span>

      {/* Text */}
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 20, fontWeight: 700, color: '#F5F5F0', marginBottom: 10 }}>
          {step.title}
        </div>
        <div style={{ fontSize: 14, color: 'rgba(245,245,240,0.52)', lineHeight: 1.65, maxWidth: 260 }}>
          {step.description}
        </div>
      </div>
    </div>
  )
}

export default function HowItWorks() {
  const titleRef = useRef(null)
  const [titleVisible, setTitleVisible] = useState(false)

  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setTitleVisible(true); obs.disconnect() } }, { threshold: 0.3 })
    if (titleRef.current) obs.observe(titleRef.current)
    return () => obs.disconnect()
  }, [])

  return (
    <section id="comment" style={{ padding: '96px 24px' }}>
      <div style={{ maxWidth: 1000, margin: '0 auto' }}>

        {/* Title */}
        <div
          ref={titleRef}
          style={{
            textAlign: 'center', marginBottom: 72,
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
            Simple comme bonjour
          </div>
          <h2 style={{ fontSize: 'clamp(28px, 4vw, 42px)', fontWeight: 700, color: '#F5F5F0', letterSpacing: '-0.02em' }}>
            Comment ça marche
          </h2>
        </div>

        {/* Steps */}
        <div style={{ position: 'relative', display: 'flex', flexWrap: 'wrap', gap: 32, justifyContent: 'center', alignItems: 'flex-start' }}>

          {/* Connector line — visible only on wide screens */}
          <div style={{
            position: 'absolute',
            top: 36, left: '16.6%', right: '16.6%',
            height: 1,
            background: 'linear-gradient(90deg, transparent, rgba(29,110,85,0.4), transparent)',
            pointerEvents: 'none',
          }} />

          {STEPS.map((step, i) => <StepCard key={i} step={step} index={i} />)}
        </div>
      </div>
    </section>
  )
}
