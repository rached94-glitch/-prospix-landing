const SECTORS = [
  'Restaurant', 'Commerce', 'Santé', 'Beauté', 'Immobilier', 'Tech',
  'Juridique', 'Finance', 'Éducation', 'Sport', 'Artisan', 'Automobile',
  'Hôtellerie', 'Bien-être', 'Architecture',
]

export default function Sectors() {
  return (
    <section style={{ padding: '24px 0', overflow: 'hidden' }}>
      <div style={{ display: 'inline-flex', whiteSpace: 'nowrap', animation: 'marquee 40s linear infinite', gap: 12 }}>
        {[0, 1].map(n => (
          <span key={n} style={{ display: 'inline-flex', alignItems: 'center', gap: 12 }}>
            {SECTORS.map(s => (
              <span key={s} style={{
                display: 'inline-block',
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 20,
                padding: '8px 20px',
                fontSize: 13,
                fontFamily: 'DM Sans, system-ui, sans-serif',
                color: 'rgba(245,245,240,0.5)',
                flexShrink: 0,
              }}>
                {s}
              </span>
            ))}
            {/* Séparateur entre les deux copies */}
            <span style={{ display: 'inline-block', width: 12, flexShrink: 0 }} />
          </span>
        ))}
      </div>
    </section>
  )
}
