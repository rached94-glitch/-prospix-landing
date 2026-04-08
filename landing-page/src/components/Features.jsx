import { useRef, useEffect, useState } from 'react'
import { MapPin, Eye, Star, Building2, FileText, Mail, TrendingUp, Users } from 'lucide-react'

const FEATURES = [
  { Icon: MapPin,      colorRgb: '42,157,116',  title: 'Recherche Google Maps',     description: "Cherchez par ville et secteur. Jusqu'à 200 commerces avec nom, adresse, téléphone, site, avis, réseaux sociaux." },
  { Icon: Eye,         colorRgb: '124,58,237',  title: 'Analyse visuelle IA',       description: "L'IA capture et score le site web — qualité design, époque visuelle, verdict. Vous savez si le site date de 2009 avant d'appeler." },
  { Icon: Star,        colorRgb: '245,158,11',  title: 'Analyse des avis IA',       description: "L'IA lit chaque avis Google, détecte les plaintes récurrentes, les questions sans réponse, la réactivité du gérant." },
  { Icon: Building2,   colorRgb: '99,102,241',  title: 'Intelligence entreprise',   description: "Données légales via Pappers — nom, capital, date de création, décideur. Vous atteignez la bonne personne au premier appel." },
  { Icon: FileText,    colorRgb: '20,184,166',  title: 'Audit PDF personnalisé',    description: "Un rapport PDF complet avec forces, faiblesses, recommandations et plan d'action. Prêt à envoyer au prospect." },
  { Icon: Mail,        colorRgb: '237,250,54',  title: 'Email IA personnalisé',     description: "Un email de prospection basé sur les données réelles du commerce. Modifiable et reformulable par l'IA." },
  { Icon: TrendingUp,  colorRgb: '239,68,68',   title: "Score d'opportunité",       description: "Chaque commerce reçoit un score sur 100 adapté à votre profil. Plus le score est bas, plus l'opportunité est grande." },
  { Icon: Users,       colorRgb: '29,110,85',   title: 'Multi-profils',             description: "10 profils métier, chacun avec son scoring, son audit et son email adaptés. Un outil, tous les freelances." },
]

function FeatureCard({ feature, index }) {
  const ref = useRef(null)
  const [visible, setVisible] = useState(false)
  const [hovered, setHovered] = useState(false)
  const { Icon } = feature

  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect() } }, { threshold: 0.1 })
    if (ref.current) obs.observe(ref.current)
    return () => obs.disconnect()
  }, [])

  return (
    <div
      ref={ref}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        borderRadius: 18, overflow: 'hidden',
        minHeight: 320,
        display: 'flex', flexDirection: 'column',
        border: hovered ? '1px solid rgba(255,255,255,0.12)' : '1px solid rgba(255,255,255,0.06)',
        opacity: visible ? 1 : 0,
        transform: visible ? (hovered ? 'translateY(-6px)' : 'translateY(0)') : 'translateY(36px)',
        boxShadow: hovered ? '0 16px 48px rgba(0,0,0,0.5)' : '0 4px 16px rgba(0,0,0,0.3)',
        transition: `opacity 0.55s ease ${index * 55}ms, transform 0.28s ease, border-color 0.25s, box-shadow 0.28s`,
      }}
    >
      {/* TOP — glassmorphism dark avec icon */}
      <div style={{
        background: 'rgba(255,255,255,0.03)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        minHeight: 180,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        position: 'relative',
        padding: '28px 16px',
      }}>
        <div style={{
          position: 'absolute', bottom: 0, left: '50%', transform: 'translateX(-50%)',
          width: 80, height: 40,
          background: `radial-gradient(ellipse, rgba(${feature.colorRgb},0.3) 0%, transparent 70%)`,
          pointerEvents: 'none',
        }} />
        <div style={{
          width: 80, height: 80,
          background: 'rgba(255,255,255,0.05)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 18,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: `0 8px 28px rgba(0,0,0,0.35), 0 4px 16px rgba(${feature.colorRgb},0.15), inset 0 1px 0 rgba(255,255,255,0.1)`,
          position: 'relative', zIndex: 1,
          transition: 'transform 0.3s ease',
          transform: hovered ? 'translateY(-5px) scale(1.06)' : 'translateY(0) scale(1)',
        }}>
          <Icon size={32} color={`rgb(${feature.colorRgb})`} strokeWidth={1.5} />
        </div>
      </div>

      {/* BOTTOM — white */}
      <div style={{ background: '#ffffff', padding: '20px 18px 24px', minHeight: 140 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#131815', marginBottom: 6, letterSpacing: '-0.01em' }}>
          {feature.title}
        </div>
        <div style={{ fontSize: 12.5, color: '#666', lineHeight: 1.6 }}>
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
    <section id="fonctionnalites" style={{ padding: '112px 24px' }}>
      <div style={{ maxWidth: 1280, margin: '0 auto' }}>

        <div
          ref={titleRef}
          style={{
            textAlign: 'center', marginBottom: 48,
            opacity: titleVisible ? 1 : 0,
            transform: titleVisible ? 'scale(1) translateY(0)' : 'scale(0.96) translateY(20px)',
            transition: 'opacity 0.5s, transform 0.5s',
          }}
        >
          <h2 style={{ fontSize: 32, fontWeight: 700, color: '#FFFFFF', letterSpacing: '-0.02em', margin: 0 }}>
            Tout ce qu'il faut pour closer
          </h2>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
          gap: 16,
        }}>
          {FEATURES.map((f, i) => <FeatureCard key={i} feature={f} index={i} />)}
        </div>
      </div>
    </section>
  )
}
