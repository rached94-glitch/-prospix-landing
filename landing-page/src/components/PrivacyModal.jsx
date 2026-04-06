export default function PrivacyModal({ onClose }) {
  const p = { fontSize: 13, color: 'rgba(245,245,240,0.6)', lineHeight: 1.7, margin: '0 0 12px' }
  const email = <a href="mailto:contact@prospix.pro" style={{ color: '#2A9D74', textDecoration: 'none' }}>contact@prospix.pro</a>

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
        background: 'rgba(0,0,0,0.7)',
        zIndex: 1000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '16px',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          maxWidth: 600, width: '100%',
          maxHeight: '80vh', overflowY: 'auto',
          background: '#1C2020',
          borderRadius: 16,
          padding: '32px',
          border: '1px solid rgba(255,255,255,0.1)',
          position: 'relative',
        }}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute', top: 16, right: 16,
            background: 'none', border: 'none',
            color: 'rgba(245,245,240,0.5)', fontSize: 18,
            cursor: 'pointer', lineHeight: 1, padding: '4px 8px',
            transition: 'color 0.15s',
            fontFamily: 'inherit',
          }}
          onMouseEnter={e => e.currentTarget.style.color = '#F5F5F0'}
          onMouseLeave={e => e.currentTarget.style.color = 'rgba(245,245,240,0.5)'}
        >
          ✕
        </button>

        <h2 style={{ fontSize: 20, fontWeight: 700, color: '#FFFFFF', marginBottom: 24, fontFamily: 'Satoshi, system-ui, sans-serif', letterSpacing: '-0.01em' }}>
          Politique de confidentialité
        </h2>

        <p style={p}><strong style={{ color: 'rgba(245,245,240,0.85)' }}>Données collectées :</strong> email, prénom, nom, métier, ville, statut professionnel, code parrainage.</p>

        <p style={p}><strong style={{ color: 'rgba(245,245,240,0.85)' }}>Finalité :</strong> vous informer de l'ouverture de l'accès à Prospix et vous envoyer des communications liées au produit.</p>

        <p style={p}><strong style={{ color: 'rgba(245,245,240,0.85)' }}>Base légale :</strong> votre consentement explicite (case cochée).</p>

        <p style={p}><strong style={{ color: 'rgba(245,245,240,0.85)' }}>Conservation :</strong> tant que vous êtes inscrit. Suppression sur demande à {email}.</p>

        <p style={p}><strong style={{ color: 'rgba(245,245,240,0.85)' }}>Partage :</strong> vos données ne sont jamais vendues ni partagées avec des tiers.</p>

        <p style={p}><strong style={{ color: 'rgba(245,245,240,0.85)' }}>Vos droits (RGPD) :</strong> accès, rectification, suppression, portabilité, opposition. Contactez {email}.</p>

        <p style={{ ...p, marginBottom: 0 }}><strong style={{ color: 'rgba(245,245,240,0.85)' }}>Cookies :</strong> aucun cookie tiers ni tracker publicitaire.</p>
      </div>
    </div>
  )
}
