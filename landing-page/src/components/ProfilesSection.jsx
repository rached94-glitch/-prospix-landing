import { useRef, useEffect, useState } from 'react'
import { Search, Code, Bot, Camera, Users, PenTool, Video, Palette, Mail, Megaphone } from 'lucide-react'

const PROFILES = [
  { Icon: Search,    title: 'Consultant SEO',       description: 'Classement Maps, pages indexées, balises manquantes, temps de chargement. Arrivez avec les données.' },
  { Icon: Code,      title: 'Développeur Web',       description: 'Sites lents, non sécurisés, pas optimisés mobile. Le pitch refonte se fait tout seul.' },
  { Icon: Bot,       title: 'Dev Chatbot & IA',      description: "Pas de chatbot, pas de FAQ, pas d'automatisation. Score pondéré à 70% sur le potentiel." },
  { Icon: Camera,    title: 'Photographe',           description: "Fiches Google sans photos, pas d'Instagram. Score basé sur l'absence visuelle." },
  { Icon: Users,     title: 'Community Manager',     description: "Audite tous les réseaux sociaux. Score l'e-réputation et l'activité pour cibler les bons commerces." },
  { Icon: PenTool,   title: 'Rédacteur SEO',         description: 'Descriptions absentes, meta vides, pas de blog. Score les lacunes de contenu.' },
  { Icon: Video,     title: 'Vidéaste',              description: 'Pas de YouTube, pas de TikTok, pas de vidéo sur le site. Score le potentiel vidéo.' },
  { Icon: Palette,   title: 'Designer / Branding',   description: "Photos de mauvaise qualité, pas de cohérence visuelle, description absente. Score l'identité de marque." },
  { Icon: Mail,      title: 'Email Marketing',       description: 'Pas de newsletter, pas de fidélisation, avis sans réponse. Score le potentiel de rétention client.' },
  { Icon: Megaphone, title: 'Consultant Google Ads', description: 'Invisible sur Maps malgré de bons avis, site lent, concurrence locale. Score la rentabilité pub.' },
]

function ProfileCard({ profile, index }) {
  const ref = useRef(null)
  const [visible, setVisible] = useState(false)
  const [hovered, setHovered] = useState(false)

  useEffect(() => {
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); obs.disconnect() } },
      { threshold: 0.12 }
    )
    if (ref.current) obs.observe(ref.current)
    return () => obs.disconnect()
  }, [])

  const { Icon } = profile

  return (
    <div
      ref={ref}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: 'rgba(255,255,255,0.03)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: hovered ? '1px solid rgba(29,110,85,0.4)' : '1px solid rgba(255,255,255,0.06)',
        borderRadius: 20,
        padding: '26px 22px',
        display: 'flex', flexDirection: 'column', gap: 14,
        cursor: 'default',
        opacity: visible ? 1 : 0,
        transform: visible
          ? (hovered ? 'translateY(-6px)' : 'translateY(0)')
          : 'translateY(40px)',
        boxShadow: hovered
          ? '0 16px 48px rgba(0,0,0,0.5), 0 0 0 1px rgba(29,110,85,0.15), inset 0 1px 0 rgba(255,255,255,0.08)'
          : '0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05)',
        transition: `opacity 0.6s ease ${index * 60}ms, transform 0.3s ease, border-color 0.3s, box-shadow 0.3s`,
      }}
    >
      {/* Icon container glassmorphism 3D */}
      <div style={{
        width: 64, height: 64,
        background: 'rgba(255,255,255,0.05)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 16,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 8px 32px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.1)',
        transition: 'transform 0.3s ease',
        transform: hovered ? 'translateY(-4px)' : 'translateY(0)',
        flexShrink: 0,
      }}>
        <Icon size={28} color="#2A9D74" strokeWidth={1.75} />
      </div>

      <div style={{ fontSize: 16, fontWeight: 700, color: '#F5F5F0', letterSpacing: '-0.01em' }}>
        {profile.title}
      </div>
      <div style={{ fontSize: 13.5, color: 'rgba(245,245,240,0.5)', lineHeight: 1.65 }}>
        {profile.description}
      </div>
    </div>
  )
}

export default function ProfilesSection() {
  const titleRef = useRef(null)
  const [titleVisible, setTitleVisible] = useState(false)

  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setTitleVisible(true); obs.disconnect() } }, { threshold: 0.3 })
    if (titleRef.current) obs.observe(titleRef.current)
    return () => obs.disconnect()
  }, [])

  return (
    <section id="profils" style={{ padding: '96px 24px', maxWidth: 1200, margin: '0 auto', width: '100%' }}>

      {/* Title */}
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
          background: 'rgba(29,110,85,0.12)',
          border: '1px solid rgba(29,110,85,0.25)',
          borderRadius: 20, fontSize: 11, fontWeight: 600, color: '#4ade80', letterSpacing: '0.07em', textTransform: 'uppercase',
        }}>
          Profils métier
        </div>
        <h2 style={{ fontSize: 'clamp(28px, 4vw, 44px)', fontWeight: 700, color: '#F5F5F0', letterSpacing: '-0.02em', margin: '0 0 12px' }}>
          Conçu pour chaque profil freelance
        </h2>
        <p style={{ fontSize: 16, color: 'rgba(245,245,240,0.45)', maxWidth: 500, margin: '0 auto' }}>
          Chaque profil a son propre algorithme de scoring et ses propres KPIs.
        </p>
      </div>

      {/* Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
        gap: 16,
      }}>
        {PROFILES.map((p, i) => <ProfileCard key={i} profile={p} index={i} />)}
      </div>
    </section>
  )
}
