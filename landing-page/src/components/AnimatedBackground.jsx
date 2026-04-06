// ── Particules stables (seeded) — 35 au total ──────────────────────────────
// 10 petites (0-9) · 15 moyennes (10-24) · 10 grosses (25-34)
const PARTICLES = Array.from({ length: 35 }, (_, i) => {
  const s1 = (i * 137.508 + 42)  % 100
  const s2 = (i * 73.41   + 17)  % 100
  const s3 = (i * 211.3   + 91)  % 100
  const s4 = (i * 53.7    + 63)  % 100
  const s5 = (i * 97.13   + 29)  % 100

  // Catégorie
  let size, opacity, blur
  if (i < 10) {
    // Petites : 2-4 px, opacity 0.10-0.20
    size    = 2 + (s2 * 0.02) % 2
    opacity = +(0.10 + (s3 * 0.001) % 0.10).toFixed(3)
    blur    = 0
  } else if (i < 25) {
    // Moyennes : 6-12 px, opacity 0.08-0.15
    size    = 6 + (s2 * 0.04) % 6
    opacity = +(0.08 + (s3 * 0.0007) % 0.07).toFixed(3)
    blur    = 0
  } else {
    // Grosses : 16-30 px, opacity 0.04-0.08, bokeh blur 4px
    size    = 16 + (s2 * 0.14) % 14
    opacity = +(0.04 + (s3 * 0.0004) % 0.04).toFixed(3)
    blur    = 4
  }

  // Couleur : 50% vert · 30% jaune · 20% blanc
  const colorRoll = s5 % 10
  let color
  if (colorRoll < 5)       color = `rgba(42,157,116,${opacity})`
  else if (colorRoll < 8)  color = `rgba(237,250,54,${opacity})`
  else                     color = `rgba(255,255,255,${opacity})`

  return {
    id:       i,
    left:     `${(s1 * 1.03) % 100}%`,
    size,
    color,
    blur,
    delay:    `${(s4 * 0.15) % 15}s`,
    duration: `${12 + (s1 * 0.38) % 38}s`,  // 12–50 s
  }
})

export default function AnimatedBackground() {
  return (
    <div style={{
      position: 'fixed', inset: 0,
      zIndex: 0, pointerEvents: 'none', overflow: 'hidden',
    }}>

      {/* ── Base — dégradé vert très foncé → noir → vert ── */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'linear-gradient(180deg, #0A1A14 0%, #0A0F0D 30%, #0D1210 60%, #0A1A14 100%)',
      }} />

      {/* ── Couche 1 — Gradient mesh animé ─────────────── */}
      {/* G1 : haut gauche → droite, 20s */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'radial-gradient(ellipse 80% 50% at 30% 20%, rgba(29,110,85,0.25) 0%, transparent 70%)',
        animation: 'gradientMove1 20s ease-in-out infinite',
        willChange: 'transform',
      }} />

      {/* G2 : centre droite → gauche, 25s */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'radial-gradient(ellipse 60% 40% at 70% 60%, rgba(29,110,85,0.15) 0%, transparent 60%)',
        animation: 'gradientMove2 25s ease-in-out infinite',
        willChange: 'transform',
      }} />

      {/* G3 : bas jaune, monte/descend, 30s */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'radial-gradient(ellipse 40% 30% at 50% 80%, rgba(237,250,54,0.05) 0%, transparent 50%)',
        animation: 'gradientMove3 30s ease-in-out infinite',
        willChange: 'transform',
      }} />

      {/* ── Couche 2 — Particules flottantes ───────────── */}
      {PARTICLES.map(p => (
        <div
          key={p.id}
          style={{
            position: 'absolute',
            bottom: '-40px',
            left: p.left,
            width:  p.size,
            height: p.size,
            borderRadius: '50%',
            background: p.color,
            filter: p.blur ? `blur(${p.blur}px)` : undefined,
            animation: `floatParticle ${p.duration} ${p.delay} linear infinite`,
            willChange: 'transform, opacity',
          }}
        />
      ))}

      {/* ── Couche 3 — Grille en perspective ───────────── */}
      <div style={{
        position: 'fixed',
        bottom: 0, left: 0, right: 0,
        height: '40vh',
        opacity: 0.3,
        transform: 'perspective(500px) rotateX(60deg)',
        transformOrigin: 'bottom center',
        backgroundImage: [
          'repeating-linear-gradient(0deg,  rgba(255,255,255,0.02) 0px, rgba(255,255,255,0.02) 1px, transparent 1px, transparent 80px)',
          'repeating-linear-gradient(90deg, rgba(255,255,255,0.02) 0px, rgba(255,255,255,0.02) 1px, transparent 1px, transparent 80px)',
        ].join(', '),
        pointerEvents: 'none',
      }} />

      {/* ── Couche 4 — Grain/noise overlay ─────────────── */}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="100%" height="100%"
        style={{ position: 'absolute', inset: 0 }}
      >
        <defs>
          <filter id="noise">
            <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch" />
          </filter>
        </defs>
        <rect width="100%" height="100%" filter="url(#noise)" opacity="0.03" />
      </svg>

    </div>
  )
}
