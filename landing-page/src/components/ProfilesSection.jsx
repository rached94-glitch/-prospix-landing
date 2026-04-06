import { useState, useRef } from 'react'
import { motion, useInView } from 'framer-motion'

/* ── Icônes SVG 3D avec gradient ─────────────────────── */

function IconSEO({ hovered }) {
  return (
    <svg width="44" height="44" viewBox="0 0 44 44" fill="none">
      <defs>
        <linearGradient id="g-seo" x1="0" y1="0" x2="44" y2="44" gradientUnits="userSpaceOnUse">
          <stop stopColor="#2A9D74" /><stop offset="1" stopColor="#4ade80" />
        </linearGradient>
      </defs>
      <circle cx="20" cy="20" r="12" stroke="url(#g-seo)" strokeWidth="2.5" />
      <motion.line x1="29" y1="29" x2="38" y2="38" stroke="url(#g-seo)" strokeWidth="2.5" strokeLinecap="round"
        animate={{ scaleX: hovered ? 1.15 : 1, scaleY: hovered ? 1.15 : 1 }}
        style={{ transformOrigin: '29px 29px' }} />
      <circle cx="20" cy="20" r="5" fill="url(#g-seo)" opacity="0.4" />
    </svg>
  )
}
function IconCode({ hovered }) {
  return (
    <svg width="44" height="44" viewBox="0 0 44 44" fill="none">
      <defs><linearGradient id="g-code" x1="0" y1="0" x2="44" y2="44" gradientUnits="userSpaceOnUse">
        <stop stopColor="#2A9D74" /><stop offset="1" stopColor="#6ee7b7" />
      </linearGradient></defs>
      <motion.polyline points="14,16 6,22 14,28" stroke="url(#g-code)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
        animate={{ x: hovered ? -3 : 0 }} />
      <motion.polyline points="30,16 38,22 30,28" stroke="url(#g-code)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
        animate={{ x: hovered ? 3 : 0 }} />
      <motion.line x1="26" y1="12" x2="18" y2="32" stroke="url(#g-code)" strokeWidth="2" strokeLinecap="round"
        animate={{ opacity: hovered ? 1 : 0.6 }} />
    </svg>
  )
}
function IconBot({ hovered }) {
  return (
    <svg width="44" height="44" viewBox="0 0 44 44" fill="none">
      <defs><linearGradient id="g-bot" x1="0" y1="0" x2="44" y2="44" gradientUnits="userSpaceOnUse">
        <stop stopColor="#2A9D74" /><stop offset="1" stopColor="#a3e635" />
      </linearGradient></defs>
      <rect x="8" y="16" width="28" height="20" rx="6" stroke="url(#g-bot)" strokeWidth="2.2" />
      <motion.circle cx="17" cy="26" r="3" fill="url(#g-bot)" animate={{ scale: hovered ? 1.3 : 1 }} />
      <motion.circle cx="27" cy="26" r="3" fill="url(#g-bot)" animate={{ scale: hovered ? 1.3 : 1 }} />
      <line x1="22" y1="16" x2="22" y2="10" stroke="url(#g-bot)" strokeWidth="2" strokeLinecap="round" />
      <circle cx="22" cy="8" r="2.5" fill="url(#g-bot)" />
    </svg>
  )
}
function IconCamera({ hovered }) {
  return (
    <svg width="44" height="44" viewBox="0 0 44 44" fill="none">
      <defs><linearGradient id="g-cam" x1="0" y1="0" x2="44" y2="44" gradientUnits="userSpaceOnUse">
        <stop stopColor="#2A9D74" /><stop offset="1" stopColor="#34d399" />
      </linearGradient></defs>
      <path d="M6 16h4l3-4h18l3 4h4a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V18a2 2 0 0 1 2-2z" stroke="url(#g-cam)" strokeWidth="2.2" />
      <motion.circle cx="22" cy="26" r="6" stroke="url(#g-cam)" strokeWidth="2"
        animate={{ r: hovered ? 7 : 6 }} />
      <circle cx="22" cy="26" r="2.5" fill="url(#g-cam)" opacity="0.5" />
    </svg>
  )
}
function IconUsers({ hovered }) {
  return (
    <svg width="44" height="44" viewBox="0 0 44 44" fill="none">
      <defs><linearGradient id="g-users" x1="0" y1="0" x2="44" y2="44" gradientUnits="userSpaceOnUse">
        <stop stopColor="#2A9D74" /><stop offset="1" stopColor="#4ade80" />
      </linearGradient></defs>
      <circle cx="16" cy="17" r="5" stroke="url(#g-users)" strokeWidth="2.2" />
      <path d="M6 34c0-5.5 4.5-9 10-9" stroke="url(#g-users)" strokeWidth="2.2" strokeLinecap="round" />
      <motion.circle cx="29" cy="17" r="5" stroke="url(#g-users)" strokeWidth="2.2"
        animate={{ scale: hovered ? 1.08 : 1 }} style={{ transformOrigin: '29px 17px' }} />
      <motion.path d="M22 34c0-5.5 4.5-9 10-9 5.5 0 10 3.5 10 9" stroke="url(#g-users)" strokeWidth="2.2" strokeLinecap="round"
        animate={{ opacity: hovered ? 1 : 0.7 }} />
    </svg>
  )
}
function IconPen({ hovered }) {
  return (
    <svg width="44" height="44" viewBox="0 0 44 44" fill="none">
      <defs><linearGradient id="g-pen" x1="0" y1="0" x2="44" y2="44" gradientUnits="userSpaceOnUse">
        <stop stopColor="#2A9D74" /><stop offset="1" stopColor="#86efac" />
      </linearGradient></defs>
      <motion.path d="M32 8l4 4L16 32l-6 2 2-6L32 8z" stroke="url(#g-pen)" strokeWidth="2.2" strokeLinejoin="round"
        animate={{ rotate: hovered ? 5 : 0 }} style={{ transformOrigin: '32px 8px' }} />
      <line x1="10" y1="38" x2="34" y2="38" stroke="url(#g-pen)" strokeWidth="2" strokeLinecap="round" opacity="0.5" />
    </svg>
  )
}
function IconVideo({ hovered }) {
  return (
    <svg width="44" height="44" viewBox="0 0 44 44" fill="none">
      <defs><linearGradient id="g-vid" x1="0" y1="0" x2="44" y2="44" gradientUnits="userSpaceOnUse">
        <stop stopColor="#2A9D74" /><stop offset="1" stopColor="#fde047" />
      </linearGradient></defs>
      <rect x="4" y="13" width="26" height="18" rx="4" stroke="url(#g-vid)" strokeWidth="2.2" />
      <motion.path d="M30 18l10-5v18l-10-5V18z" stroke="url(#g-vid)" strokeWidth="2.2" strokeLinejoin="round"
        animate={{ x: hovered ? 2 : 0 }} />
    </svg>
  )
}
function IconPalette({ hovered }) {
  return (
    <svg width="44" height="44" viewBox="0 0 44 44" fill="none">
      <defs><linearGradient id="g-pal" x1="0" y1="0" x2="44" y2="44" gradientUnits="userSpaceOnUse">
        <stop stopColor="#2A9D74" /><stop offset="1" stopColor="#a78bfa" />
      </linearGradient></defs>
      <path d="M22 6a16 16 0 0 0 0 32c2.2 0 4-1.8 4-4 0-1-.4-1.9-1-2.6-.6-.7-1-1.6-1-2.4 0-2.2 1.8-4 4-4h3a8 8 0 0 0 8-8A16 16 0 0 0 22 6z" stroke="url(#g-pal)" strokeWidth="2.2" />
      <motion.circle cx="14" cy="18" r="2.5" fill="url(#g-pal)" animate={{ scale: hovered ? 1.4 : 1 }} />
      <circle cx="22" cy="12" r="2.5" fill="url(#g-pal)" opacity="0.6" />
      <circle cx="30" cy="18" r="2.5" fill="url(#g-pal)" opacity="0.8" />
    </svg>
  )
}
function IconMail({ hovered }) {
  return (
    <svg width="44" height="44" viewBox="0 0 44 44" fill="none">
      <defs><linearGradient id="g-mail" x1="0" y1="0" x2="44" y2="44" gradientUnits="userSpaceOnUse">
        <stop stopColor="#2A9D74" /><stop offset="1" stopColor="#67e8f9" />
      </linearGradient></defs>
      <rect x="4" y="10" width="36" height="26" rx="4" stroke="url(#g-mail)" strokeWidth="2.2" />
      <motion.path d="M4 14l18 13 18-13" stroke="url(#g-mail)" strokeWidth="2.2" strokeLinecap="round"
        animate={{ y: hovered ? -2 : 0 }} />
    </svg>
  )
}
function IconMegaphone({ hovered }) {
  return (
    <svg width="44" height="44" viewBox="0 0 44 44" fill="none">
      <defs><linearGradient id="g-mega" x1="0" y1="0" x2="44" y2="44" gradientUnits="userSpaceOnUse">
        <stop stopColor="#2A9D74" /><stop offset="1" stopColor="#fb923c" />
      </linearGradient></defs>
      <path d="M6 16h6l16-10v28L12 24H6a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2z" stroke="url(#g-mega)" strokeWidth="2.2" strokeLinejoin="round" />
      <motion.path d="M12 24l4 12" stroke="url(#g-mega)" strokeWidth="2.2" strokeLinecap="round"
        animate={{ opacity: hovered ? 1 : 0.5 }} />
      <motion.path d="M32 10a10 10 0 0 1 0 20" stroke="url(#g-mega)" strokeWidth="2" strokeLinecap="round" strokeDasharray="4 3"
        animate={{ opacity: hovered ? 1 : 0.4 }} />
    </svg>
  )
}

/* ── Data ─────────────────────────────────────────────── */

const PROFILES = [
  { IconComp: IconSEO,       title: 'Consultant SEO',       subtitle: 'Positionnement local',   description: 'Classement Maps, pages indexées, balises manquantes, temps de chargement. Arrivez avec les données.' },
  { IconComp: IconCode,      title: 'Développeur Web',       subtitle: 'Performance & Sécurité',  description: 'Sites lents, non sécurisés, pas optimisés mobile. Le pitch refonte se fait tout seul.' },
  { IconComp: IconBot,       title: 'Dev Chatbot & IA',      subtitle: 'Automatisation',          description: "Pas de chatbot, pas de FAQ, pas d'automatisation. Score pondéré à 70% sur le potentiel." },
  { IconComp: IconCamera,    title: 'Photographe',           subtitle: 'Présence visuelle',       description: "Fiches Google sans photos, pas d'Instagram. Score basé sur l'absence visuelle." },
  { IconComp: IconUsers,     title: 'Community Manager',     subtitle: 'E-réputation & Réseaux',  description: "Audite tous les réseaux sociaux. Score l'e-réputation et l'activité pour cibler les bons commerces." },
  { IconComp: IconPen,       title: 'Rédacteur SEO',         subtitle: 'Contenu & Mots-clés',     description: 'Descriptions absentes, meta vides, pas de blog. Score les lacunes de contenu.' },
  { IconComp: IconVideo,     title: 'Vidéaste',              subtitle: 'Vidéo & YouTube',          description: 'Pas de YouTube, pas de TikTok, pas de vidéo sur le site. Score le potentiel vidéo.' },
  { IconComp: IconPalette,   title: 'Designer / Branding',   subtitle: 'Identité visuelle',       description: "Photos de mauvaise qualité, pas de cohérence visuelle, description absente. Score l'identité de marque." },
  { IconComp: IconMail,      title: 'Email Marketing',       subtitle: 'Rétention client',        description: 'Pas de newsletter, pas de fidélisation, avis sans réponse. Score le potentiel de rétention client.' },
  { IconComp: IconMegaphone, title: 'Consultant Google Ads', subtitle: 'Visibilité & ROI',        description: 'Invisible sur Maps malgré de bons avis, site lent, concurrence locale. Score la rentabilité pub.' },
]

const cardVariants = {
  hidden:  { opacity: 0, y: 40 },
  visible: (i) => ({ opacity: 1, y: 0, transition: { duration: 0.55, ease: 'easeOut', delay: i * 0.07 } }),
}

/* ── Card ─────────────────────────────────────────────── */

function ProfileCard({ profile, index }) {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-60px' })
  const [hovered, setHovered] = useState(false)
  const { IconComp } = profile

  return (
    <motion.div
      ref={ref}
      custom={index}
      variants={cardVariants}
      initial="hidden"
      animate={inView ? 'visible' : 'hidden'}
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => setHovered(false)}
      style={{
        borderRadius: 20, overflow: 'hidden',
        minHeight: 420,
        display: 'flex', flexDirection: 'column',
        border: hovered ? '1px solid rgba(29,110,85,0.45)' : '1px solid rgba(255,255,255,0.07)',
        boxShadow: hovered
          ? '0 24px 64px rgba(0,0,0,0.6), 0 0 0 1px rgba(29,110,85,0.15)'
          : '0 4px 24px rgba(0,0,0,0.3)',
        transition: 'border-color 0.25s, box-shadow 0.3s',
        cursor: 'default',
      }}
      whileHover={{ y: -7 }}
      transition={{ type: 'spring', stiffness: 300, damping: 24 }}
    >
      {/* TOP — glassmorphism dark */}
      <div style={{
        background: 'rgba(255,255,255,0.03)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        minHeight: 188,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        position: 'relative', padding: '36px 20px',
      }}>
        {/* Glow below icon */}
        <motion.div
          style={{
            position: 'absolute', bottom: 0, left: '50%', transform: 'translateX(-50%)',
            width: 120, height: 60,
            background: 'radial-gradient(ellipse, rgba(29,110,85,0.4) 0%, transparent 70%)',
            pointerEvents: 'none',
          }}
          animate={{ opacity: hovered ? 1 : 0.5 }}
        />

        {/* 3D icon container */}
        <motion.div
          style={{
            width: 110, height: 110,
            background: 'rgba(255,255,255,0.055)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            border: '1px solid rgba(255,255,255,0.13)',
            borderRadius: 24,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: hovered
              ? '0 16px 48px rgba(0,0,0,0.5), 0 4px 16px rgba(29,110,85,0.3), inset 0 1px 0 rgba(255,255,255,0.15)'
              : '0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.1)',
            position: 'relative', zIndex: 1,
            transition: 'box-shadow 0.3s',
          }}
          animate={{ y: hovered ? -6 : 0, scale: hovered ? 1.05 : 1 }}
          transition={{ type: 'spring', stiffness: 280, damping: 20 }}
        >
          <IconComp hovered={hovered} />
        </motion.div>
      </div>

      {/* BOTTOM — white */}
      <div style={{ background: '#ffffff', padding: '20px 22px 26px' }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#131815', marginBottom: 4, letterSpacing: '-0.01em' }}>
          {profile.title}
        </div>
        <div style={{ fontSize: 11, fontWeight: 600, color: '#1D6E55', marginBottom: 10, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
          {profile.subtitle}
        </div>
        <div style={{ fontSize: 13, color: '#555', lineHeight: 1.65 }}>
          {profile.description}
        </div>
      </div>
    </motion.div>
  )
}

/* ── Section ─────────────────────────────────────────── */

export default function ProfilesSection() {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-80px' })

  return (
    <section id="profils" style={{ padding: '112px 24px', maxWidth: 1280, margin: '0 auto', width: '100%' }}>

      <motion.div
        ref={ref}
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={inView ? { opacity: 1, y: 0, scale: 1 } : {}}
        transition={{ duration: 0.55 }}
        style={{ textAlign: 'center', marginBottom: 64 }}
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
      </motion.div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
        gap: 18,
      }}>
        {PROFILES.map((p, i) => <ProfileCard key={i} profile={p} index={i} />)}
      </div>
    </section>
  )
}
