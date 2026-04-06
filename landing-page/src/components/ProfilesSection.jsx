import { useRef, useEffect, useState } from 'react'

const PROFILES = [
  { icon: '🔍', title: 'Consultant SEO',         description: 'Classement Maps, pages indexées, balises manquantes, temps de chargement. Arrivez avec les données.' },
  { icon: '💻', title: 'Développeur Web',         description: 'Sites lents, non sécurisés, pas optimisés mobile. Le pitch refonte se fait tout seul.' },
  { icon: '🤖', title: 'Dev Chatbot & IA',        description: "Pas de chatbot, pas de FAQ, pas d'automatisation. Score pondéré à 70% sur le potentiel." },
  { icon: '📸', title: 'Photographe',             description: "Fiches Google sans photos, pas d'Instagram. Score basé sur l'absence visuelle." },
  { icon: '📱', title: 'Community Manager',       description: "Audite tous les réseaux sociaux. Score l'e-réputation et l'activité pour cibler les bons commerces." },
  { icon: '✍️', title: 'Rédacteur SEO',           description: 'Descriptions absentes, meta vides, pas de blog. Score les lacunes de contenu.' },
  { icon: '🎬', title: 'Vidéaste',                description: 'Pas de YouTube, pas de TikTok, pas de vidéo sur le site. Score le potentiel vidéo.' },
  { icon: '🎨', title: 'Designer / Branding',     description: "Photos de mauvaise qualité, pas de cohérence visuelle, description absente. Score l'identité de marque." },
  { icon: '📧', title: 'Email Marketing',         description: 'Pas de newsletter, pas de fidélisation, avis sans réponse. Score le potentiel de rétention client.' },
  { icon: '📣', title: 'Consultant Google Ads',   description: 'Invisible sur Maps malgré de bons avis, site lent, concurrence locale. Score la rentabilité pub.' },
]

function ProfileCard({ profile, index }) {
  const ref = useRef(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); obs.disconnect() } },
      { threshold: 0.15 }
    )
    if (ref.current) obs.observe(ref.current)
    return () => obs.disconnect()
  }, [])

  return (
    <div
      ref={ref}
      style={{
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 16,
        padding: '24px 22px',
        display: 'flex', flexDirection: 'column', gap: 12,
        cursor: 'default',
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(28px)',
        transition: `opacity 0.5s ease ${index * 60}ms, transform 0.5s ease ${index * 60}ms, border-color 0.2s, box-shadow 0.2s`,
      }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = 'rgba(29,110,85,0.45)'
        e.currentTarget.style.transform = 'translateY(-4px)'
        e.currentTarget.style.boxShadow = '0 12px 40px rgba(29,110,85,0.15)'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'
        e.currentTarget.style.transform = visible ? 'translateY(0)' : 'translateY(28px)'
        e.currentTarget.style.boxShadow = 'none'
      }}
    >
      <span style={{ fontSize: 32, lineHeight: 1 }}>{profile.icon}</span>
      <div style={{ fontSize: 16, fontWeight: 700, color: '#F5F5F0', letterSpacing: '-0.01em' }}>{profile.title}</div>
      <div style={{ fontSize: 13.5, color: 'rgba(245,245,240,0.52)', lineHeight: 1.6 }}>{profile.description}</div>
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
    <section id="profils" style={{ padding: '96px 24px', maxWidth: 1180, margin: '0 auto', width: '100%' }}>

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
          background: 'rgba(29,110,85,0.12)',
          border: '1px solid rgba(29,110,85,0.25)',
          borderRadius: 20, fontSize: 11, fontWeight: 600, color: '#4ade80', letterSpacing: '0.06em', textTransform: 'uppercase',
        }}>
          Profils métier
        </div>
        <h2 style={{ fontSize: 'clamp(28px, 4vw, 42px)', fontWeight: 700, color: '#F5F5F0', letterSpacing: '-0.02em' }}>
          Conçu pour chaque profil freelance
        </h2>
        <p style={{ marginTop: 14, fontSize: 16, color: 'rgba(245,245,240,0.5)', maxWidth: 500, margin: '14px auto 0' }}>
          Chaque profil a son propre algorithme de scoring et ses propres KPIs.
        </p>
      </div>

      {/* Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
        gap: 16,
      }}>
        {PROFILES.map((p, i) => <ProfileCard key={i} profile={p} index={i} />)}
      </div>
    </section>
  )
}
