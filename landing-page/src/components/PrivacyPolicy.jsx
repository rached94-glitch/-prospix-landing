export default function PrivacyPolicy() {
  const goBack = () => {
    window.location.hash = ''
    window.scrollTo({ top: 0 })
  }

  const h2 = { fontSize: 18, fontWeight: 700, color: '#FFFFFF', margin: '32px 0 10px', fontFamily: 'Satoshi, system-ui, sans-serif' }
  const p  = { fontSize: 14, color: 'rgba(245,245,240,0.7)', lineHeight: 1.75, margin: '0 0 10px' }
  const ul = { fontSize: 14, color: 'rgba(245,245,240,0.7)', lineHeight: 1.75, paddingLeft: 20, margin: '0 0 10px' }

  return (
    <div style={{ minHeight: '100vh', background: '#0A0F0D', padding: '80px 24px' }}>
      <div style={{ maxWidth: 700, margin: '0 auto' }}>

        <a
          href="#"
          onClick={e => { e.preventDefault(); goBack() }}
          style={{ display: 'inline-block', marginBottom: 40, fontSize: 14, color: '#2A9D74', textDecoration: 'none', fontFamily: 'DM Sans, system-ui, sans-serif' }}
          onMouseEnter={e => e.currentTarget.style.opacity = '0.75'}
          onMouseLeave={e => e.currentTarget.style.opacity = '1'}
        >
          ← Retour à l'accueil
        </a>

        <h1 style={{ fontSize: 28, fontWeight: 700, color: '#FFFFFF', marginBottom: 6, fontFamily: 'Satoshi, system-ui, sans-serif', letterSpacing: '-0.02em' }}>
          Politique de confidentialité — Prospix
        </h1>
        <p style={{ ...p, color: 'rgba(245,245,240,0.35)', marginBottom: 40 }}>Dernière mise à jour : 6 avril 2026</p>

        <h2 style={h2}>1. Responsable du traitement</h2>
        <p style={p}>Prospix — outil de prospection intelligente pour freelances.</p>
        <p style={p}>Contact : <a href="mailto:contact@prospix.pro" style={{ color: '#2A9D74' }}>contact@prospix.pro</a></p>

        <h2 style={h2}>2. Données collectées</h2>
        <p style={p}>Lors de votre inscription à la waitlist, nous collectons :</p>
        <ul style={ul}>
          <li>Adresse email</li>
          <li>Prénom et nom</li>
          <li>Métier</li>
          <li>Ville</li>
          <li>Statut professionnel (freelance, agence, étudiant, etc.)</li>
          <li>Code de parrainage (optionnel)</li>
        </ul>

        <h2 style={h2}>3. Finalité du traitement</h2>
        <p style={p}>Vos données sont collectées uniquement pour :</p>
        <ul style={ul}>
          <li>Vous informer de l'ouverture de l'accès à Prospix</li>
          <li>Vous envoyer des communications liées au produit (lancement, mises à jour)</li>
          <li>Personnaliser votre expérience en fonction de votre métier et votre ville</li>
        </ul>

        <h2 style={h2}>4. Base légale</h2>
        <p style={p}>Le traitement repose sur votre consentement explicite (case cochée lors de l'inscription).</p>

        <h2 style={h2}>5. Durée de conservation</h2>
        <p style={p}>Vos données sont conservées tant que vous êtes inscrit à la waitlist ou utilisateur de Prospix. Vous pouvez demander leur suppression à tout moment.</p>

        <h2 style={h2}>6. Partage des données</h2>
        <p style={p}>Vos données ne sont jamais vendues ni partagées avec des tiers à des fins commerciales. Elles sont stockées sur :</p>
        <ul style={ul}>
          <li>Google Sheets (hébergé par Google, serveurs UE)</li>
          <li>n8n (notre outil d'automatisation)</li>
        </ul>

        <h2 style={h2}>7. Vos droits</h2>
        <p style={p}>Conformément au RGPD, vous disposez des droits suivants :</p>
        <ul style={ul}>
          <li>Droit d'accès à vos données</li>
          <li>Droit de rectification</li>
          <li>Droit de suppression</li>
          <li>Droit à la portabilité</li>
          <li>Droit d'opposition au traitement</li>
        </ul>
        <p style={p}>Pour exercer vos droits, contactez-nous à : <a href="mailto:contact@prospix.pro" style={{ color: '#2A9D74' }}>contact@prospix.pro</a></p>

        <h2 style={h2}>8. Cookies</h2>
        <p style={p}>Le site prospix.pro n'utilise aucun cookie tiers ni aucun tracker publicitaire.</p>

        <div style={{ marginTop: 48, paddingTop: 20, borderTop: '1px solid rgba(255,255,255,0.07)' }}>
          <a
            href="#"
            onClick={e => { e.preventDefault(); goBack() }}
            style={{ fontSize: 14, color: '#2A9D74', textDecoration: 'none', fontFamily: 'DM Sans, system-ui, sans-serif' }}
            onMouseEnter={e => e.currentTarget.style.opacity = '0.75'}
            onMouseLeave={e => e.currentTarget.style.opacity = '1'}
          >
            ← Retour à l'accueil
          </a>
        </div>

      </div>
    </div>
  )
}
