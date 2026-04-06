import { useRef, useEffect, useState } from 'react'

/* ── UI Mockups ─────────────────────────────────────── */

function MockupForm() {
  return (
    <div style={{
      background: '#1C2020', border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: 16, padding: '20px 22px',
      fontFamily: 'Instrument Sans, sans-serif',
      boxShadow: '0 16px 48px rgba(0,0,0,0.5)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 20 }}>
        <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#4ade80', boxShadow: '0 0 6px #4ade80' }} />
        <span style={{ fontSize: 10, fontWeight: 700, color: '#4ade80', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Nouvelle recherche</span>
      </div>
      {[
        { label: 'Ville', value: 'Paris, France', icon: '📍' },
        { label: 'Secteur', value: 'Restaurant', icon: '🍽️' },
        { label: 'Profil', value: 'Consultant SEO', icon: '🔍' },
      ].map((f, i) => (
        <div key={i} style={{ marginBottom: i < 2 ? 12 : 20 }}>
          <div style={{ fontSize: 10, color: 'rgba(245,245,240,0.35)', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 5 }}>{f.label}</div>
          <div style={{
            padding: '9px 12px',
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 8,
            fontSize: 13, color: '#F5F5F0',
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <span>{f.icon}</span>{f.value}
          </div>
        </div>
      ))}
      <div style={{
        padding: '11px', background: '#1D6E55', borderRadius: 9,
        fontSize: 13, fontWeight: 700, color: '#F5F5F0',
        textAlign: 'center', cursor: 'default',
        boxShadow: '0 4px 16px rgba(29,110,85,0.4)',
      }}>
        Trouver des leads ⚡
      </div>
    </div>
  )
}

function MockupResults() {
  const results = [
    { name: 'Brasserie Le Marais', rating: '4.2 ★', tags: ['Pas de site', 'Pas d\'Instagram'], score: 78 },
    { name: 'Restaurant Chez Paul', rating: '3.8 ★', tags: ['Site lent', 'Pas de Facebook'], score: 85 },
    { name: 'Café de la Gare', rating: '4.5 ★', tags: ['Pas de Google Ads', 'Pas de chatbot'], score: 62 },
  ]
  return (
    <div style={{
      background: '#1C2020', border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: 16, padding: '18px 18px',
      fontFamily: 'Instrument Sans, sans-serif',
      boxShadow: '0 16px 48px rgba(0,0,0,0.5)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <span style={{ fontSize: 10, color: '#4ade80', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>● 47 commerces trouvés</span>
        <span style={{ fontSize: 10, color: 'rgba(245,245,240,0.3)' }}>Paris · Restaurant</span>
      </div>
      {results.map((r, i) => (
        <div key={i} style={{
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: 10, padding: '11px 12px',
          marginBottom: i < results.length - 1 ? 8 : 0,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 7 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#F5F5F0' }}>{r.name}</div>
            <div style={{
              fontSize: 11, fontWeight: 700, color: '#EDFA36',
              background: 'rgba(237,250,54,0.1)', border: '1px solid rgba(237,250,54,0.2)',
              borderRadius: 6, padding: '2px 7px',
            }}>
              {r.score}
            </div>
          </div>
          <div style={{ fontSize: 11, color: 'rgba(245,245,240,0.4)', marginBottom: 7 }}>{r.rating} · Paris 4e</div>
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
            {r.tags.map((t, j) => (
              <span key={j} style={{
                fontSize: 10, fontWeight: 600,
                background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)',
                color: '#f87171', borderRadius: 4, padding: '2px 7px',
              }}>{t}</span>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function MockupAudit() {
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12,
      fontFamily: 'Instrument Sans, sans-serif',
    }}>
      {/* PDF preview */}
      <div style={{
        background: '#1C2020', border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 14, padding: '16px 16px',
        boxShadow: '0 12px 40px rgba(0,0,0,0.5)',
      }}>
        <div style={{ fontSize: 9, color: '#4ade80', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 12 }}>📄 AUDIT PDF</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div style={{ fontSize: 11, color: 'rgba(245,245,240,0.5)' }}>Score global</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#EDFA36' }}>73<span style={{ fontSize: 12, fontWeight: 400, color: 'rgba(245,245,240,0.3)' }}>/100</span></div>
        </div>
        {[{ label: '✦ Forces', color: '#4ade80' }, { label: '✦ Faiblesses', color: '#f87171' }, { label: '✦ Actions', color: '#EDFA36' }].map((s, i) => (
          <div key={i} style={{ marginBottom: 7 }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: s.color, letterSpacing: '0.04em', marginBottom: 3 }}>{s.label}</div>
            <div style={{ height: 5, background: 'rgba(255,255,255,0.06)', borderRadius: 3 }}>
              <div style={{ height: '100%', width: `${[70, 40, 90][i]}%`, background: s.color, borderRadius: 3, opacity: 0.7 }} />
            </div>
          </div>
        ))}
      </div>

      {/* Email preview */}
      <div style={{
        background: '#1C2020', border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 14, padding: '16px 16px',
        boxShadow: '0 12px 40px rgba(0,0,0,0.5)',
      }}>
        <div style={{ fontSize: 9, color: '#EDFA36', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 12 }}>✉️ EMAIL IA</div>
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 9, color: 'rgba(245,245,240,0.3)', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Objet</div>
          <div style={{ fontSize: 11, color: '#F5F5F0', fontWeight: 600, lineHeight: 1.4 }}>Brasserie Le Marais — j'ai analysé votre présence en ligne</div>
        </div>
        <div style={{ height: 1, background: 'rgba(255,255,255,0.07)', margin: '8px 0' }} />
        <div style={{ fontSize: 10.5, color: 'rgba(245,245,240,0.5)', lineHeight: 1.6 }}>
          Bonjour,<br />
          J'ai analysé la fiche Google de votre restaurant — 4.2 étoiles, mais 12 avis sans réponse...
        </div>
      </div>
    </div>
  )
}

/* ── Step component ─────────────────────────────────── */

function Step({ number, title, textContent, mockup, reverse, index }) {
  const ref = useRef(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect() } }, { threshold: 0.2 })
    if (ref.current) obs.observe(ref.current)
    return () => obs.disconnect()
  }, [])

  const textCol = (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 20, padding: '8px 0' }}>
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 10,
        padding: '5px 14px 5px 10px',
        background: 'rgba(29,110,85,0.12)', border: '1px solid rgba(29,110,85,0.25)',
        borderRadius: 20, width: 'fit-content',
      }}>
        <span style={{
          width: 28, height: 28, borderRadius: '50%',
          background: 'linear-gradient(135deg, rgba(29,110,85,0.5), rgba(42,157,116,0.3))',
          border: '1px solid rgba(29,110,85,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 12, fontWeight: 800, color: '#4ade80', flexShrink: 0,
        }}>{number}</span>
        <span style={{ fontSize: 11, fontWeight: 600, color: '#4ade80', letterSpacing: '0.05em', textTransform: 'uppercase' }}>{title}</span>
      </div>
      {textContent}
    </div>
  )

  const mockupCol = (
    <div style={{ flex: 1 }}>
      {mockup}
    </div>
  )

  return (
    <div
      ref={ref}
      style={{
        display: 'flex', flexWrap: 'wrap',
        flexDirection: reverse ? 'row-reverse' : 'row',
        gap: 'clamp(32px, 5vw, 72px)',
        alignItems: 'center',
        padding: '48px 0',
        borderBottom: index < 2 ? '1px solid rgba(255,255,255,0.05)' : 'none',
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(40px)',
        transition: 'opacity 0.65s ease, transform 0.65s ease',
      }}
    >
      {reverse ? <>{mockupCol}{textCol}</> : <>{textCol}{mockupCol}</>}
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

        <div
          ref={titleRef}
          style={{
            textAlign: 'center', marginBottom: 80,
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
            3 étapes
          </div>
          <h2 style={{ fontSize: 'clamp(30px, 4vw, 48px)', fontWeight: 700, color: '#F5F5F0', letterSpacing: '-0.02em', margin: 0 }}>
            Comment ça marche
          </h2>
        </div>

        {/* STEP 01 */}
        <Step
          number="01" title="Vous définissez la cible" index={0}
          reverse={false}
          mockup={<MockupForm />}
          textContent={
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <p style={{ fontSize: 'clamp(17px, 2.2vw, 22px)', color: '#F5F5F0', lineHeight: 1.55, fontWeight: 400, letterSpacing: '-0.01em' }}>
                Ville, secteur, profil freelance.<br />
                <strong>Trois champs. C'est tout.</strong> Prospix fait le reste.
              </p>
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                padding: '8px 14px',
                background: 'rgba(237,250,54,0.08)', border: '1px solid rgba(237,250,54,0.2)',
                borderRadius: 8, width: 'fit-content',
              }}>
                <span style={{ fontSize: 14 }}>⏱</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#EDFA36' }}>10 secondes</span>
              </div>
            </div>
          }
        />

        {/* STEP 02 */}
        <Step
          number="02" title="On scanne Google Maps" index={1}
          reverse={true}
          mockup={<MockupResults />}
          textContent={
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <p style={{ fontSize: 'clamp(17px, 2.2vw, 22px)', color: '#F5F5F0', lineHeight: 1.55, fontWeight: 400, letterSpacing: '-0.01em' }}>
                Jusqu'à <strong>200 commerces locaux</strong> — nom, adresse, téléphone, site, avis, et tous les réseaux détectés.
              </p>
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                padding: '8px 14px',
                background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.2)',
                borderRadius: 8, width: 'fit-content',
              }}>
                <span style={{ fontSize: 14 }}>🗺️</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#4ade80' }}>Score d'opportunité pour chaque commerce</span>
              </div>
            </div>
          }
        />

        {/* STEP 03 */}
        <Step
          number="03" title="Prospectez avec des données" index={2}
          reverse={false}
          mockup={<MockupAudit />}
          textContent={
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <p style={{ fontSize: 'clamp(17px, 2.2vw, 22px)', color: '#F5F5F0', lineHeight: 1.55, fontWeight: 400, letterSpacing: '-0.01em' }}>
                Générez un <strong>audit PDF complet</strong> et un <strong>email personnalisé</strong> basé sur les données réelles du commerce. Score d'opportunité, forces, faiblesses, recommandations. Prêt à envoyer.
              </p>
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                padding: '8px 14px',
                background: 'rgba(237,250,54,0.08)', border: '1px solid rgba(237,250,54,0.2)',
                borderRadius: 8, width: 'fit-content',
              }}>
                <span style={{ fontSize: 14 }}>⚡</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#EDFA36' }}>Généré en 30 secondes par l'IA</span>
              </div>
            </div>
          }
        />

        {/* Paragraphe temps gagné */}
        <div style={{ marginTop: 64, textAlign: 'center' }}>
          <p style={{ maxWidth: 700, margin: '0 auto', color: 'rgba(245,245,240,0.5)', fontSize: 16, lineHeight: 1.7 }}>
            Sans Prospix, prospecter un seul commerce prend <strong style={{ color: '#EDFA36', fontWeight: 700 }}>35 minutes</strong> : chercher sur Google Maps, analyser le site, lire les avis, vérifier les réseaux sociaux, rédiger un email. Pour 10 prospects, c'est 6 heures de travail. Avec Prospix, c'est <strong style={{ color: '#EDFA36', fontWeight: 700 }}>1 minute</strong> par prospect. L'IA analyse tout — site, avis, réseaux, données légales — et génère un <strong style={{ color: '#2A9D74', fontWeight: 700 }}>audit PDF</strong> et un <strong style={{ color: '#2A9D74', fontWeight: 700 }}>email personnalisé</strong> adaptés à votre métier. Vous n'envoyez plus un email froid. Vous offrez une analyse gratuite. Le prospect voit ses faiblesses. Il vous répond.
          </p>
        </div>

      </div>
    </section>
  )
}
