import { useRef, useEffect, useState } from 'react'
import { Search, Zap, Send } from 'lucide-react'

const STEPS = [
  {
    number: '1',
    title: 'Cherchez',
    Icon: Search,
    description: "Entrez un secteur et une ville. Prospix trouve jusqu'à 200 commerces locaux avec leurs données Google.",
  },
  {
    number: '2',
    title: 'Analysez',
    Icon: Zap,
    description: "L'IA analyse les avis, le site web, les réseaux sociaux et génère un score d'opportunité pour chaque commerce.",
  },
  {
    number: '3',
    title: 'Prospectez',
    Icon: Send,
    description: "Générez un audit PDF et un email personnalisé. Prêt à envoyer en un clic.",
  },
]

function StepCard({ step, index }) {
  const ref = useRef(null)
  const [visible, setVisible] = useState(false)
  const [hovered, setHovered] = useState(false)
  const { Icon } = step

  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect() } }, { threshold: 0.3 })
    if (ref.current) obs.observe(ref.current)
    return () => obs.disconnect()
  }, [])

  return (
    <div
      ref={ref}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20,
        flex: 1, minWidth: 200,
        padding: '32px 24px',
        background: 'rgba(255,255,255,0.03)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: hovered ? '1px solid rgba(29,110,85,0.4)' : '1px solid rgba(255,255,255,0.06)',
        borderRadius: 20,
        boxShadow: hovered
          ? '0 16px 48px rgba(0,0,0,0.5), 0 0 32px rgba(29,110,85,0.1), inset 0 1px 0 rgba(255,255,255,0.08)'
          : '0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05)',
        opacity: visible ? 1 : 0,
        transform: visible
          ? (hovered ? 'translateY(-6px)' : 'translateY(0)')
          : 'translateY(40px)',
        transition: `opacity 0.6s ease ${index * 150}ms, transform 0.3s ease, border-color 0.3s, box-shadow 0.3s`,
      }}
    >
      {/* Number circle */}
      <div style={{
        width: 64, height: 64,
        borderRadius: '50%',
        background: 'linear-gradient(135deg, rgba(29,110,85,0.35), rgba(42,157,116,0.15))',
        border: '1.5px solid rgba(29,110,85,0.5)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 0 32px rgba(29,110,85,0.25)',
        transition: 'box-shadow 0.3s',
        ...(hovered ? { boxShadow: '0 0 48px rgba(29,110,85,0.45)' } : {}),
      }}>
        <span style={{ fontSize: 26, fontWeight: 800, color: '#4ade80', letterSpacing: '-0.03em', lineHeight: 1 }}>
          {step.number}
        </span>
      </div>

      {/* Lucide icon */}
      <div style={{
        width: 52, height: 52,
        background: 'rgba(29,110,85,0.1)',
        border: '1px solid rgba(29,110,85,0.2)',
        borderRadius: 14,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'transform 0.3s',
        transform: hovered ? 'translateY(-4px) scale(1.06)' : 'translateY(0) scale(1)',
      }}>
        <Icon size={24} color="#2A9D74" strokeWidth={1.75} />
      </div>

      {/* Text */}
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 20, fontWeight: 700, color: '#F5F5F0', marginBottom: 10, letterSpacing: '-0.01em' }}>
          {step.title}
        </div>
        <div style={{ fontSize: 14, color: 'rgba(245,245,240,0.5)', lineHeight: 1.68, maxWidth: 240 }}>
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
            Simple comme bonjour
          </div>
          <h2 style={{ fontSize: 'clamp(28px, 4vw, 44px)', fontWeight: 700, color: '#F5F5F0', letterSpacing: '-0.02em', margin: 0 }}>
            Comment ça marche
          </h2>
        </div>

        {/* Steps */}
        <div style={{ position: 'relative', display: 'flex', flexWrap: 'wrap', gap: 20, justifyContent: 'center', alignItems: 'stretch' }}>
          {/* Connector line */}
          <div style={{
            position: 'absolute',
            top: 32, left: '18%', right: '18%',
            height: 1,
            background: 'linear-gradient(90deg, transparent 0%, rgba(29,110,85,0.35) 30%, rgba(74,222,128,0.25) 50%, rgba(29,110,85,0.35) 70%, transparent 100%)',
            pointerEvents: 'none',
          }} />
          {STEPS.map((step, i) => <StepCard key={i} step={step} index={i} />)}
        </div>
      </div>
    </section>
  )
}
