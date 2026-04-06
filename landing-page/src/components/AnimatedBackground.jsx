// Stable seeded particle data — generated once, never re-computed on render
const PARTICLES = Array.from({ length: 20 }, (_, i) => {
  const s1 = (i * 137.508 + 42) % 100
  const s2 = (i * 73.41  + 17) % 100
  const s3 = (i * 211.3  + 91) % 100
  return {
    id:       i,
    left:     `${(s1 * 1.03) % 100}%`,
    size:     2 + (s2 * 0.04) % 4,          // 2–6 px
    delay:    `${(s3 * 0.1)  % 10}s`,
    duration: `${15 + (s1 * 0.25) % 25}s`,  // 15–40 s
    opacity:  +(0.1 + (s2 * 0.002) % 0.2).toFixed(3),  // 0.10–0.30
    isYellow: i % 2 === 1,
  }
})

export default function AnimatedBackground() {
  return (
    <div style={{
      position: 'fixed', inset: 0,
      zIndex: 0, pointerEvents: 'none', overflow: 'hidden',
    }}>

      {/* ── Base ──────────────────────────────────────── */}
      <div style={{ position: 'absolute', inset: 0, background: '#0A0F0D' }} />

      {/* ── Couche 1 — Gradient mesh animé ───────────── */}
      {/* Gradient 1 : se déplace lentement gauche → droite en 20s */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'radial-gradient(ellipse 80% 50% at 30% 20%, rgba(29,110,85,0.15) 0%, transparent 70%)',
        animation: 'gradientMove1 20s ease-in-out infinite',
        willChange: 'transform',
      }} />

      {/* Gradient 2 : se déplace en sens inverse en 25s */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'radial-gradient(ellipse 60% 40% at 70% 60%, rgba(29,110,85,0.1) 0%, transparent 60%)',
        animation: 'gradientMove2 25s ease-in-out infinite',
        willChange: 'transform',
      }} />

      {/* Gradient 3 : monte et descend doucement en 30s */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'radial-gradient(ellipse 40% 30% at 50% 80%, rgba(237,250,54,0.03) 0%, transparent 50%)',
        animation: 'gradientMove3 30s ease-in-out infinite',
        willChange: 'transform',
      }} />

      {/* ── Couche 2 — Particules flottantes ─────────── */}
      {PARTICLES.map(p => (
        <div
          key={p.id}
          style={{
            position: 'absolute',
            bottom: '-10px',
            left: p.left,
            width: p.size,
            height: p.size,
            borderRadius: '50%',
            background: p.isYellow
              ? `rgba(237,250,54,${(p.opacity * 0.8).toFixed(3)})`
              : `rgba(42,157,116,${p.opacity})`,
            animation: `floatParticle ${p.duration} ${p.delay} linear infinite`,
            willChange: 'transform, opacity',
          }}
        />
      ))}

      {/* ── Couche 3 — Grille en perspective ─────────── */}
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

      {/* ── Couche 4 — Grain/noise overlay ───────────── */}
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
