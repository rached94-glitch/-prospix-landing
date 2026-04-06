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
    size:    3 + (seed2 * 0.05) % 6,          // 3–9 px
    delay:   `${(seed3 * 0.18) % 18}s`,
    duration:`${14 + (seed * 0.12) % 12}s`,   // 14–26s
    opacity: 0.08 + (seed2 * 0.001) % 0.12,   // 0.08–0.2
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

      {/* Animated gradient blobs */}
      <div style={{
        position: 'absolute', inset: 0,
        background: `
          radial-gradient(ellipse 60% 50% at 20% 40%, rgba(29,110,85,0.12) 0%, transparent 60%),
          radial-gradient(ellipse 40% 40% at 80% 20%, rgba(42,157,116,0.08) 0%, transparent 55%),
          radial-gradient(ellipse 50% 40% at 50% 80%, rgba(237,250,54,0.04) 0%, transparent 60%)
        `,
        backgroundSize: '200% 200%',
        animation: 'gradientDrift 20s ease-in-out infinite',
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
            background: `rgba(29,110,85,${p.opacity})`,
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
