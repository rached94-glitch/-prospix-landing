const SECTORS = [
  'Restaurant', 'Commerce', 'Santé', 'Beauté', 'Immobilier', 'Tech',
  'Juridique', 'Finance', 'Éducation', 'Sport', 'Artisan', 'Automobile',
  'Hôtellerie', 'Bien-être', 'Architecture',
]

export default function Sectors() {
  return (
    <section style={{ padding: '64px 24px' }}>
      <h2 style={{
        fontFamily: 'Satoshi, system-ui, sans-serif',
        fontSize: 28, fontWeight: 700, color: '#FFFFFF',
        textAlign: 'center', marginBottom: 32, letterSpacing: '-0.02em',
      }}>
        Prospectez dans tous les secteurs
      </h2>
      <div style={{
        display: 'flex', flexWrap: 'wrap', justifyContent: 'center',
        gap: 10, maxWidth: 800, margin: '0 auto',
      }}>
        {SECTORS.map(s => (
          <span
            key={s}
            style={{
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 20,
              padding: '8px 18px',
              fontSize: 13,
              fontFamily: 'DM Sans, system-ui, sans-serif',
              color: 'rgba(245,245,240,0.6)',
              cursor: 'default',
              transition: 'border-color 0.2s, color 0.2s',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(29,110,85,0.4)'; e.currentTarget.style.color = '#2A9D74' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = 'rgba(245,245,240,0.6)' }}
          >
            {s}
          </span>
        ))}
      </div>
    </section>
  )
}
