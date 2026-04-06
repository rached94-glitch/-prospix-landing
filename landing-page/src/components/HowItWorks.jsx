import { useRef, useEffect, useState } from 'react'

/* ── Maquettes ───────────────────────────────────────── */

function MockupSearch() {
  const fields = [
    { label: 'VILLE',    value: 'Strasbourg, France' },
    { label: 'SECTEUR',  value: 'Restaurant' },
    { label: 'PROFIL',   value: 'Dev Chatbot & IA' },
  ]
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {fields.map((f) => (
        <div key={f.label}>
          <div style={{ fontSize: 10, fontWeight: 600, color: 'rgba(245,245,240,0.3)', letterSpacing: '0.08em', marginBottom: 5 }}>{f.label}</div>
          <div style={{
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 8, padding: '12px 14px',
            fontSize: 13, color: '#F5F5F0',
            fontFamily: 'DM Sans, system-ui, sans-serif',
          }}>{f.value}</div>
        </div>
      ))}
    </div>
  )
}

function SocialIcons({ li, fb, ig, tk }) {
  const icons = [
    { key: 'LI', active: li, bg: '#0077b5' },
    { key: 'FB', active: fb, bg: '#1877f2' },
    { key: 'IG', active: ig, bg: '#e1306c' },
    { key: 'TK', active: tk, bg: '#010101' },
  ]
  return (
    <div style={{ display: 'flex', gap: 4 }}>
      {icons.map(({ key, active, bg }) => (
        <div key={key} style={{
          width: 22, height: 22, borderRadius: 4,
          background: active ? bg : 'rgba(255,255,255,0.1)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 9, fontWeight: 700, color: active ? '#fff' : 'rgba(245,245,240,0.3)',
          fontFamily: 'DM Sans, system-ui, sans-serif',
        }}>{key}</div>
      ))}
    </div>
  )
}

function ScoreBadge({ score }) {
  const color = score > 60 ? '#2A9D74' : score > 40 ? '#f59e0b' : '#ef4444'
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
      <span style={{ fontSize: 28, fontWeight: 800, color, lineHeight: 1, fontFamily: 'Satoshi, system-ui, sans-serif' }}>{score}</span>
      <span style={{ fontSize: 11, color: 'rgba(245,245,240,0.4)', fontFamily: 'DM Sans, system-ui, sans-serif' }}>/100</span>
    </div>
  )
}

function LeadCard({ lead }) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.05)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 12, padding: '14px 16px',
      display: 'flex', gap: 12, alignItems: 'flex-start',
    }}>
      {/* Left */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 5 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#F5F5F0', fontFamily: 'DM Sans, system-ui, sans-serif', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {lead.name}
        </div>
        {/* Progress bar */}
        <div style={{ height: 3, background: 'rgba(255,255,255,0.08)', borderRadius: 2 }}>
          <div style={{ height: '100%', width: `${lead.bar}%`, background: '#2A9D74', borderRadius: 2 }} />
        </div>
        <div style={{ fontSize: 10, color: 'rgba(245,245,240,0.35)', fontFamily: 'DM Sans, system-ui, sans-serif', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {lead.address}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: '#f59e0b' }}>{lead.stars}</span>
          <span style={{ fontSize: 10, color: 'rgba(245,245,240,0.35)', fontFamily: 'DM Sans, system-ui, sans-serif' }}>{lead.dist}</span>
        </div>
        {lead.badge && (
          <span style={{ fontSize: 10, color: 'rgba(245,245,240,0.5)', background: 'rgba(255,255,255,0.08)', borderRadius: 4, padding: '2px 7px', width: 'fit-content', fontFamily: 'DM Sans, system-ui, sans-serif' }}>
            {lead.badge}
          </span>
        )}
        {lead.pos !== undefined && (
          <div style={{ display: 'flex', gap: 8, fontSize: 11, fontFamily: 'DM Sans, system-ui, sans-serif' }}>
            <span style={{ color: '#2A9D74', fontWeight: 600 }}>{lead.pos}%</span>
            <span style={{ color: '#ef4444', fontWeight: 600 }}>{lead.neg}%</span>
          </div>
        )}
        <SocialIcons li={lead.li} fb={lead.fb} ig={lead.ig} tk={lead.tk} />
      </div>
      {/* Score */}
      <ScoreBadge score={lead.score} />
    </div>
  )
}

function MockupResults() {
  const leads = [
    { name: 'Abou Plombier',                    address: '24 Rue du Champ de Manœuvre, Str...', stars: '★★★★★ 5 (170)', dist: '0.0 km', bar: 60, pos: 100, neg: 0,  li: false, fb: true,  ig: false, tk: false, score: 36 },
    { name: 'R plombier',                        address: '40 All. du Bohrie, Ostwald',          stars: '★★★★★ 5 (7)',   dist: '5.1 km', bar: 40, badge: 'Potentiel nouveau', li: false, fb: false, ig: false, tk: false, score: 32 },
    { name: 'Sanixpress - Plomberie Générale',   address: '5 Quai Kléber, Strasbourg',           stars: '★★★★★ 5 (1)',   dist: '0.7 km', bar: 35, badge: 'Potentiel nouveau', li: false, fb: false, ig: false, tk: false, score: 32 },
  ]
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: 'rgba(245,245,240,0.3)', letterSpacing: '0.08em', fontFamily: 'DM Sans, system-ui, sans-serif' }}>LEADS</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 10, color: 'rgba(245,245,240,0.3)', fontFamily: 'DM Sans, system-ui, sans-serif' }}>SCORE MIN</span>
          <div style={{ width: 60, height: 4, background: 'rgba(255,255,255,0.1)', borderRadius: 2, position: 'relative' }}>
            <div style={{ width: '40%', height: '100%', background: '#2A9D74', borderRadius: 2 }} />
            <div style={{ position: 'absolute', top: '50%', left: '40%', transform: 'translate(-50%,-50%)', width: 8, height: 8, background: '#2A9D74', borderRadius: '50%', border: '1px solid #131815' }} />
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {leads.map((l) => <LeadCard key={l.name} lead={l} />)}
      </div>
    </div>
  )
}

function MockupAudit() {
  const auditKpis = [
    { label: 'Chatbot existant',      value: 'Aucun — opportunité directe',          color: '#ef4444' },
    { label: 'Questions récurrentes', value: 'tarif, services, contact',              color: '#f59e0b' },
    { label: 'CMS détecté',           value: 'WordPress — intégration facilitée',    color: '#2A9D74' },
    { label: 'Formulaire contact',    value: 'Absent',                               color: '#ef4444' },
  ]
  const fakeLines = [90, 70, 55, 80]
  return (
    <div style={{ display: 'flex', gap: 12 }}>
      {/* Audit PDF */}
      <div style={{ flex: 1, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: '16px 14px' }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(245,245,240,0.3)', letterSpacing: '0.08em', marginBottom: 10 }}>AUDIT PDF</div>
        <div style={{ fontSize: 20, fontWeight: 800, color: '#2A9D74', letterSpacing: '-0.02em', marginBottom: 12 }}>23<span style={{ fontSize: 12, fontWeight: 400, color: 'rgba(245,245,240,0.3)' }}>/100</span></div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {auditKpis.map((k) => (
            <div key={k.label}>
              <div style={{ fontSize: 10, color: 'rgba(245,245,240,0.4)', marginBottom: 1, fontFamily: 'DM Sans, system-ui, sans-serif' }}>{k.label}</div>
              <div style={{ fontSize: 11, fontWeight: 600, color: k.color, fontFamily: 'DM Sans, system-ui, sans-serif', lineHeight: 1.3 }}>{k.value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Email IA */}
      <div style={{ flex: 1, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: '16px 14px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(245,245,240,0.3)', letterSpacing: '0.08em', marginBottom: 12 }}>EMAIL IA</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {fakeLines.map((w, i) => (
              <div key={i} style={{ height: 7, borderRadius: 4, background: 'rgba(245,245,240,0.1)', width: `${w}%` }} />
            ))}
          </div>
        </div>
        <div style={{
          marginTop: 16, padding: '8px 12px', textAlign: 'center',
          background: '#1D6E55', borderRadius: 6,
          fontSize: 11, fontWeight: 600, color: '#F5F5F0',
          fontFamily: 'DM Sans, system-ui, sans-serif',
        }}>Envoyer</div>
      </div>
    </div>
  )
}

/* ── Helpers pour texte coloré ───────────────────────── */

function HighlightText({ text, highlights }) {
  // Split text on highlight phrases and wrap them in green spans
  let parts = [text]
  highlights.forEach(h => {
    parts = parts.flatMap(part => {
      if (typeof part !== 'string') return [part]
      const idx = part.indexOf(h)
      if (idx === -1) return [part]
      return [
        part.slice(0, idx),
        <span key={h} style={{ fontWeight: 600, color: '#2A9D74' }}>{h}</span>,
        part.slice(idx + h.length),
      ]
    })
  })
  return <>{parts}</>
}

/* ── Step ────────────────────────────────────────────── */

const STEPS = [
  {
    num: '01',
    title: "Vous définissez la cible",
    desc: "Ville, secteur, profil freelance. Trois champs. C'est tout. Prospix fait le reste.",
    highlights: ['Trois champs'],
    mockup: <MockupSearch />,
    reverse: false,
  },
  {
    num: '02',
    title: "Prospix scanne Google Maps",
    desc: "Jusqu'à 120 commerces locaux avec nom, adresse, téléphone, site, avis et réseaux sociaux détectés. Chaque commerce reçoit un score d'opportunité adapté à votre métier.",
    highlights: ["score d'opportunité"],
    mockup: <MockupResults />,
    reverse: true,
  },
  {
    num: '03',
    title: "Vous prospectez avec des données",
    desc: "Un audit PDF complet avec forces, faiblesses et recommandations. Un email personnalisé basé sur les données réelles. Prêt à envoyer.",
    highlights: ['audit PDF', 'email personnalisé'],
    mockup: <MockupAudit />,
    reverse: false,
  },
]

function Step({ step, index }) {
  const ref = useRef(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect() } }, { threshold: 0.15 })
    if (ref.current) obs.observe(ref.current)
    return () => obs.disconnect()
  }, [])

  const cardBase = {
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 16,
    flex: 1,
    minWidth: 0,
  }

  const textCard = (
    <div style={{ ...cardBase, padding: '32px' }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: '#2A9D74', letterSpacing: '2px', marginBottom: 12, fontFamily: 'DM Sans, system-ui, sans-serif' }}>
        {step.num}
      </div>
      <h3 style={{ fontSize: 24, fontWeight: 700, color: '#FFFFFF', margin: '0 0 12px', fontFamily: 'Satoshi, system-ui, sans-serif', letterSpacing: '-0.02em', lineHeight: 1.2 }}>
        {step.title}
      </h3>
      <p style={{ fontSize: 14, lineHeight: 1.6, color: 'rgba(245,245,240,0.5)', margin: 0, fontFamily: 'DM Sans, system-ui, sans-serif' }}>
        <HighlightText text={step.desc} highlights={step.highlights} />
      </p>
    </div>
  )

  const mockupCard = (
    <div style={{ ...cardBase, padding: '24px', overflow: 'hidden' }}>
      {step.mockup}
    </div>
  )

  return (
    <div
      ref={ref}
      style={{
        display: 'flex', gap: 24, flexWrap: 'wrap',
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(40px)',
        transition: `opacity 0.6s ease ${index * 0.12}s, transform 0.6s ease ${index * 0.12}s`,
      }}
    >
      {step.reverse ? <>{mockupCard}{textCard}</> : <>{textCard}{mockupCard}</>}
    </div>
  )
}

/* ── Section ─────────────────────────────────────────── */

export default function HowItWorks() {
  const titleRef = useRef(null)
  const [titleVisible, setTitleVisible] = useState(false)

  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setTitleVisible(true); obs.disconnect() } }, { threshold: 0.3 })
    if (titleRef.current) obs.observe(titleRef.current)
    return () => obs.disconnect()
  }, [])

  return (
    <section id="comment" style={{ padding: '112px 24px' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>

        {/* Titre */}
        <div
          ref={titleRef}
          style={{
            textAlign: 'center', marginBottom: 64,
            opacity: titleVisible ? 1 : 0,
            transform: titleVisible ? 'translateY(0)' : 'translateY(20px)',
            transition: 'opacity 0.5s, transform 0.5s',
          }}
        >
          <h2 style={{ fontSize: 32, fontWeight: 700, color: '#FFFFFF', letterSpacing: '-0.02em', margin: 0, fontFamily: 'Satoshi, system-ui, sans-serif' }}>
            Comment ça marche
          </h2>
        </div>

        {/* Étapes */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 64 }}>
          {STEPS.map((step, i) => <Step key={step.num} step={step} index={i} />)}
        </div>

        {/* Paragraphe temps gagné */}
        <div style={{ marginTop: 64, textAlign: 'center' }}>
          <p style={{ maxWidth: 700, margin: '0 auto', color: 'rgba(245,245,240,0.5)', fontSize: 16, lineHeight: 1.7, fontFamily: 'DM Sans, system-ui, sans-serif' }}>
            Sans Prospix, prospecter un seul commerce prend <strong style={{ color: '#EDFA36', fontWeight: 700 }}>35 minutes</strong> : chercher sur Google Maps, analyser le site, lire les avis, vérifier les réseaux sociaux, rédiger un email. Pour 10 prospects, c'est 6 heures de travail. Avec Prospix, c'est <strong style={{ color: '#EDFA36', fontWeight: 700 }}>1 minute</strong> par prospect. L'IA analyse tout — site, avis, réseaux, données légales — et génère un <strong style={{ color: '#2A9D74', fontWeight: 700 }}>audit PDF</strong> et un <strong style={{ color: '#2A9D74', fontWeight: 700 }}>email personnalisé</strong> adaptés à votre métier. Vous n'envoyez plus un email froid. Vous offrez une analyse gratuite. Le prospect voit ses faiblesses. Il vous répond.
          </p>
        </div>

      </div>
    </section>
  )
}
