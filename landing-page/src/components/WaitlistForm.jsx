import { useState } from 'react'

const METIERS = [
  'Consultant SEO',
  'Développeur Web',
  'Dev Chatbot & IA',
  'Photographe',
  'Community Manager',
  'Rédacteur SEO',
  'Vidéaste',
  'Designer / Branding',
  'Email Marketing',
  'Consultant Google Ads',
  'Autre',
]

const STATUTS = ['Freelance', 'Agence / Entreprise', 'Étudiant', 'En reconversion', 'Autre']

const inputStyle = {
  width: '100%',
  padding: '12px 16px',
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 8,
  color: '#F5F5F0',
  fontSize: 14,
  outline: 'none',
  transition: 'border-color 0.2s, box-shadow 0.2s',
  fontFamily: 'DM Sans, system-ui, sans-serif',
  boxSizing: 'border-box',
  appearance: 'none',
  WebkitAppearance: 'none',
}

function Field({ children }) {
  return <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>{children}</div>
}

function Row({ children }) {
  return (
    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
      {children}
    </div>
  )
}

export default function WaitlistForm() {
  const [form, setForm] = useState({
    email: '', prenom: '', nom: '', metier: '', ville: '', statut: '', referral: '',
  })
  const [status, setStatus] = useState('idle') // idle | loading | success | error

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }))

  const focusStyle = (e) => {
    e.target.style.borderColor = 'rgba(29,110,85,0.5)'
    e.target.style.boxShadow = '0 0 12px rgba(29,110,85,0.2)'
  }
  const blurStyle = (e) => {
    e.target.style.borderColor = 'rgba(255,255,255,0.1)'
    e.target.style.boxShadow = 'none'
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.email.trim() || !form.prenom.trim() || !form.metier) return
    setStatus('loading')
    try {
      // TODO: envoyer vers Google Sheets API
      const entries = JSON.parse(localStorage.getItem('prospix_waitlist') || '[]')
      entries.push({ ...form, date: new Date().toISOString() })
      localStorage.setItem('prospix_waitlist', JSON.stringify(entries))
      await new Promise(r => setTimeout(r, 600))
      setStatus('success')
    } catch (_) {
      setStatus('error')
    }
  }

  if (status === 'success') {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
        padding: '28px 32px',
        background: 'rgba(29,110,85,0.12)',
        border: '1px solid rgba(29,110,85,0.3)',
        borderRadius: 14,
        backdropFilter: 'blur(12px)',
        animation: 'fadeSlideUp 0.4s ease forwards',
        textAlign: 'center',
      }}>
        <div style={{ fontSize: 32 }}>✅</div>
        <div style={{ fontSize: 18, fontWeight: 700, color: '#F5F5F0' }}>
          Merci {form.prenom} ! Vous êtes sur la liste.
        </div>
        <div style={{ fontSize: 14, color: 'rgba(245,245,240,0.55)', lineHeight: 1.6 }}>
          On vous contacte en priorité au lancement de Prospix.
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%' }}>

      {/* Email — pleine largeur */}
      <input
        type="email" required
        placeholder="votre@email.com"
        value={form.email}
        onChange={set('email')}
        style={{ ...inputStyle }}
        onFocus={focusStyle} onBlur={blurStyle}
      />

      {/* Prénom + Nom */}
      <Row>
        <Field>
          <input
            type="text" required
            placeholder="Prénom"
            value={form.prenom}
            onChange={set('prenom')}
            style={{ ...inputStyle }}
            onFocus={focusStyle} onBlur={blurStyle}
          />
        </Field>
        <Field>
          <input
            type="text"
            placeholder="Nom"
            value={form.nom}
            onChange={set('nom')}
            style={{ ...inputStyle }}
            onFocus={focusStyle} onBlur={blurStyle}
          />
        </Field>
      </Row>

      {/* Métier + Ville */}
      <Row>
        <Field>
          <select
            required
            value={form.metier}
            onChange={set('metier')}
            style={{
              ...inputStyle,
              color: form.metier ? '#F5F5F0' : 'rgba(245,245,240,0.3)',
              cursor: 'pointer',
            }}
            onFocus={focusStyle} onBlur={blurStyle}
          >
            <option value="" disabled style={{ color: '#666', background: '#1C2020' }}>Choisir votre métier...</option>
            {METIERS.map(m => (
              <option key={m} value={m} style={{ color: '#F5F5F0', background: '#1C2020' }}>{m}</option>
            ))}
          </select>
        </Field>
        <Field>
          <input
            type="text"
            placeholder="Votre ville"
            value={form.ville}
            onChange={set('ville')}
            style={{ ...inputStyle }}
            onFocus={focusStyle} onBlur={blurStyle}
          />
        </Field>
      </Row>

      {/* Statut + Code parrainage */}
      <Row>
        <Field>
          <select
            required
            value={form.statut}
            onChange={set('statut')}
            style={{
              ...inputStyle,
              color: form.statut ? '#F5F5F0' : 'rgba(245,245,240,0.3)',
              cursor: 'pointer',
            }}
            onFocus={focusStyle} onBlur={blurStyle}
          >
            <option value="" disabled style={{ color: '#666', background: '#1C2020' }}>Vous êtes...</option>
            {STATUTS.map(s => (
              <option key={s} value={s} style={{ color: '#F5F5F0', background: '#1C2020' }}>{s}</option>
            ))}
          </select>
        </Field>
        <Field>
          <input
            type="text"
            placeholder="Code parrainage (optionnel)"
            value={form.referral}
            onChange={set('referral')}
            style={{ ...inputStyle }}
            onFocus={focusStyle} onBlur={blurStyle}
          />
        </Field>
      </Row>

      {/* Bouton submit */}
      <button
        type="submit"
        disabled={status === 'loading'}
        style={{
          width: '100%',
          padding: '14px',
          background: status === 'loading' ? 'rgba(29,110,85,0.5)' : '#1D6E55',
          color: '#FFFFFF',
          border: 'none',
          borderRadius: 8,
          fontSize: 15, fontWeight: 600,
          cursor: status === 'loading' ? 'default' : 'pointer',
          fontFamily: 'DM Sans, system-ui, sans-serif',
          transition: 'background 0.2s, transform 0.15s',
          marginTop: 4,
        }}
        onMouseEnter={e => { if (status !== 'loading') e.currentTarget.style.background = '#2A9D74' }}
        onMouseLeave={e => { if (status !== 'loading') e.currentTarget.style.background = '#1D6E55' }}
      >
        {status === 'loading' ? '...' : 'Rejoindre la waitlist'}
      </button>

      {status === 'error' && (
        <div style={{ fontSize: 12, color: '#f87171', textAlign: 'center' }}>
          Une erreur est survenue — réessayez.
        </div>
      )}

    </form>
  )
}
