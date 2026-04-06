import { useRef, useEffect, useState } from 'react'
import { Search, Code, Bot, Camera, Users, PenTool, Video, Palette, Mail, Megaphone } from 'lucide-react'

const PROFILES = [
  { Icon: Search,    title: 'Consultant SEO',       subtitle: 'Positionnement local',    description: 'Classement Maps, pages indexées, balises manquantes, temps de chargement. Arrivez avec les données.' },
  { Icon: Code,      title: 'Développeur Web',       subtitle: 'Performance & Sécurité',  description: 'Sites lents, non sécurisés, pas optimisés mobile. Le pitch refonte se fait tout seul.' },
  { Icon: Bot,       title: 'Dev Chatbot & IA',      subtitle: 'Automatisation',          description: "Pas de chatbot, pas de FAQ, pas d'automatisation. Score pondéré à 70% sur le potentiel." },
  { Icon: Camera,    title: 'Photographe',           subtitle: 'Présence visuelle',       description: "Fiches Google sans photos, pas d'Instagram. Score basé sur l'absence visuelle." },
  { Icon: Users,     title: 'Community Manager',     subtitle: 'E-réputation & Réseaux',  description: "Audite tous les réseaux sociaux. Score l'e-réputation et l'activité pour cibler les bons commerces." },
  { Icon: PenTool,   title: 'Rédacteur SEO',         subtitle: 'Contenu & Mots-clés',    description: 'Descriptions absentes, meta vides, pas de blog. Score les lacunes de contenu.' },
  { Icon: Video,     title: 'Vidéaste',              subtitle: 'Vidéo & YouTube',         description: 'Pas de YouTube, pas de TikTok, pas de vidéo sur le site. Score le potentiel vidéo.' },
  { Icon: Palette,   title: 'Designer / Branding',   subtitle: 'Identité visuelle',       description: "Photos de mauvaise qualité, pas de cohérence visuelle, description absente. Score l'identité de marque." },
  { Icon: Mail,      title: 'Email Marketing',       subtitle: 'Rétention client',        description: 'Pas de newsletter, pas de fidélisation, avis sans réponse. Score le potentiel de rétention client.' },
  { Icon: Megaphone, title: 'Consultant Google Ads', subtitle: 'Visibilité & ROI',        description: 'Invisible sur Maps malgré de bons avis, site lent, concurrence locale. Score la rentabilité pub.' },
]

function SplitCard({ profile, index }) {
  const ref = useRef(null)
  const [visible, setVisible] = useState(false)
  const [hovered, setHovered] = useState(false)
  const { Icon } = profile

  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect() } }, { threshold: 0.12 })
    if (ref.current) obs.observe(ref.current)
    return () => obs.disconnect()
  }, [])

  return (
    <div
      ref={ref}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        borderRadius: 20, overflow: 'hidden',
        border: hovered ? '1px solid rgba(29,110,85,0.4)' : '1px solid rgba(255,255,255,0.07)',
        opacity: visible ? 1 : 0,
        transform: visible ? (hovered ? 'translateY(-6px)' : 'translateY(0)') : 'translateY(40px)',
        boxShadow: hovered ? '0 20px 60px rgba(0,0,0,0.55), 0 0 0 1px rgba(29,110,85,0.12)' : '0 4px 20px rgba(0,0,0,0.3)',
        transition: `opacity 0.55s ease ${index * 70}ms, transform 0.3s ease, border-color 0.25s, box-shadow 0.3s`,
      }}
    >
      {/* TOP — glassmorphism dark */}
      <div style={{
        background: 'rgba(255,255,255,0.03)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        minHeight: 190,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        position: 'relative',
        padding: '36px 20px',
      }}>
        {/* Green ambient glow below icon */}
        <div style={{
          position: 'absolute', bottom: 0, left: '50%', transform: 'translateX(-50%)',
          width: 100, height: 60,
          background: 'radial-gradient(ellipse, rgba(29,110,85,0.35) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />

        {/* Icon container glassmorphism 3D */}
        <div style={{
          width: 110, height: 110,
          background: 'rgba(255,255,255,0.06)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: 24,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 12px 40px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.12)',
          position: 'relative', zIndex: 1,
          transition: 'transform 0.35s ease',
          transform: hovered ? 'translateY(-6px) scale(1.04)' : 'translateY(0) scale(1)',
        }}>
          <Icon size={40} color="#2A9D74" strokeWidth={1.5} />
        </div>
      </div>

      {/* BOTTOM — white */}
      <div style={{
        background: '#ffffff',
        padding: '20px 22px 24px',
      }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#131815', marginBottom: 4, letterSpacing: '-0.01em' }}>
          {profile.title}
        </div>
        <div style={{ fontSize: 11, fontWeight: 600, color: '#1D6E55', marginBottom: 10, letterSpacing: '0.03em', textTransform: 'uppercase' }}>
          {profile.subtitle}
        </div>
        <div style={{ fontSize: 13, color: '#555', lineHeight: 1.65 }}>
          {profile.description}
        </div>
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
    <section id="profils" style={{ padding: '112px 24px', maxWidth: 1280, margin: '0 auto', width: '100%' }}>

      <div
        ref={titleRef}
        style={{
          textAlign: 'center', marginBottom: 64,
          opacity: titleVisible ? 1 : 0,
          transform: titleVisible ? 'scale(1) translateY(0)' : 'scale(0.96) translateY(20px)',
          transition: 'opacity 0.5s, transform 0.5s',
        }}
      >
        <div style={{
          display: 'inline-block', marginBottom: 16,
          padding: '5px 14px',
          background: 'rgba(29,110,85,0.12)', border: '1px solid rgba(29,110,85,0.25)',
          borderRadius: 20, fontSize: 11, fontWeight: 600, color: '#4ade80',
          letterSpacing: '0.07em', textTransform: 'uppercase',
        }}>
          10 profils métier
        </div>
        <h2 style={{ fontSize: 'clamp(30px, 4vw, 48px)', fontWeight: 700, color: '#F5F5F0', letterSpacing: '-0.02em', margin: '0 0 14px' }}>
          Conçu pour chaque freelance
        </h2>
        <p style={{ fontSize: 16, color: 'rgba(245,245,240,0.45)', maxWidth: 480, margin: '0 auto' }}>
          Chaque profil a son propre algorithme de scoring, son audit et son email adaptés.
        </p>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
        gap: 18,
      }}>
        {PROFILES.map((p, i) => <SplitCard key={i} profile={p} index={i} />)}
      </div>
    </section>
  )
}
