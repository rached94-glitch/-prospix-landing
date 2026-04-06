import { useMemo } from 'react'

// Stable seeded particle data — generated once, never random on re-render
const PARTICLES = Array.from({ length: 18 }, (_, i) => {
  // Deterministic pseudo-random based on index
  const seed = (i * 137.508 + 42) % 100
  const seed2 = (i * 73.41  + 17) % 100
  const seed3 = (i * 211.3  + 91) % 100
  return {
    id: i,
    left:    `${(seed  * 1.03) % 100}%`,
    size:    2 + (seed2 * 0.03) % 2,            // 2–4 px
    delay:   `${(seed3 * 0.18) % 18}s`,
    duration:`${18 + (seed * 0.14) % 14}s`,   // 18–32s
    opacity: 0.06 + (seed2 * 0.001) % 0.05,   // 0.06–0.11
  }
})

const GRAIN_SVG = `<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/><feColorMatrix type='saturate' values='0'/></filter><rect width='200' height='200' filter='url(#n)' opacity='0.4'/></svg>`
const GRAIN_URL = `url("data:image/svg+xml,${encodeURIComponent(GRAIN_SVG)}")`

export default function AnimatedBackground() {
  return (
    <div style={{
      position: 'fixed', inset: 0,
      zIndex: 0, pointerEvents: 'none', overflow: 'hidden',
    }}>

      {/* Base background */}
      <div style={{ position: 'absolute', inset: 0, background: '#131815' }} />

      {/* Grand radial vert — centré en haut */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'radial-gradient(ellipse 80% 50% at 50% 0%, rgba(29,110,85,0.25) 0%, transparent 70%)',
      }} />

      {/* Petit radial vert — centré au milieu */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'radial-gradient(ellipse 60% 40% at 50% 50%, rgba(29,110,85,0.1) 0%, transparent 60%)',
      }} />

      {/* Particles */}
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
            background: `rgba(74,222,128,${p.opacity})`,
            animation: `floatParticle ${p.duration} ${p.delay} linear infinite`,
            willChange: 'transform, opacity',
          }}
        />
      ))}

      {/* Grain overlay */}
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: GRAIN_URL,
        backgroundRepeat: 'repeat',
        opacity: 0.03,
        mixBlendMode: 'overlay',
      }} />
    </div>
  )
}
