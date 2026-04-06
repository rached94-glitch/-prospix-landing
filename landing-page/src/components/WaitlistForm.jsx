import { useState } from 'react'
import { useClickSound } from '../hooks/useClickSound'

export default function WaitlistForm({ size = 'normal' }) {
  const [email,    setEmail]    = useState('')
  const [referral, setReferral] = useState('')
  const [status,   setStatus]   = useState('idle') // 'idle' | 'loading' | 'success' | 'error'
  const playClick = useClickSound()

  const isCompact = size === 'compact'

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!email.trim() || status === 'loading') return
    playClick()
    setStatus('loading')
    try {
      // TODO: envoyer vers Google Sheets API
      const entries = JSON.parse(localStorage.getItem('prospix_waitlist') || '[]')
      entries.push({ email: email.trim(), referral: referral.trim(), date: new Date().toISOString() })
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
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
        padding: '22px 28px',
        background: 'rgba(29,110,85,0.12)',
        border: '1px solid rgba(29,110,85,0.3)',
        borderRadius: 14,
        backdropFilter: 'blur(12px)',
        animation: 'fadeSlideUp 0.4s ease forwards',
      }}>
        <div style={{ fontSize: 30 }}>✅</div>
        <div style={{ fontSize: 17, fontWeight: 700, color: '#F5F5F0' }}>Merci ! Vous êtes sur la liste.</div>
        <div style={{ fontSize: 13, color: 'rgba(245,245,240,0.55)', textAlign: 'center', lineHeight: 1.5 }}>
          On vous contacte en priorité au lancement de Prospix.
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} style={{
      display: 'flex',
      flexDirection: isCompact ? 'row' : 'column',
      gap: isCompact ? 8 : 10,
      width: '100%',
    }}>
      <div style={{
        display: 'flex',
        flexDirection: isCompact ? 'row' : 'column',
        gap: 8,
        flex: 1,
      }}>
        {/* Email input */}
        <input
          type="email"
          required
          placeholder="votre@email.com"
          value={email}
          onChange={e => setEmail(e.target.value)}
          style={{
            flex: 1,
            padding: isCompact ? '11px 14px' : '13px 16px',
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 10,
            color: '#F5F5F0',
            fontSize: 14,
            outline: 'none',
            transition: 'border-color 0.2s, box-shadow 0.2s',
            fontFamily: 'Instrument Sans, sans-serif',
            backdropFilter: 'blur(8px)',
          }}
          onFocus={e => {
            e.target.style.borderColor = 'rgba(29,110,85,0.7)'
            e.target.style.boxShadow = '0 0 20px rgba(29,110,85,0.25), inset 0 0 12px rgba(29,110,85,0.05)'
          }}
          onBlur={e => {
            e.target.style.borderColor = 'rgba(255,255,255,0.12)'
            e.target.style.boxShadow = 'none'
          }}
        />

        {/* Referral input */}
        {!isCompact && (
          <input
            type="text"
            placeholder="Code parrainage (optionnel) — Ex: TIKTOK50"
            value={referral}
            onChange={e => setReferral(e.target.value)}
            style={{
              padding: '13px 16px',
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 10,
              color: 'rgba(245,245,240,0.7)',
              fontSize: 13,
              outline: 'none',
              transition: 'border-color 0.2s, box-shadow 0.2s',
              fontFamily: 'Instrument Sans, sans-serif',
            }}
            onFocus={e => {
              e.target.style.borderColor = 'rgba(29,110,85,0.4)'
              e.target.style.boxShadow = '0 0 14px rgba(29,110,85,0.15)'
            }}
            onBlur={e => {
              e.target.style.borderColor = 'rgba(255,255,255,0.08)'
              e.target.style.boxShadow = 'none'
            }}
          />
        )}
      </div>

      {/* Shimmer CTA button */}
      <button
        type="submit"
        disabled={status === 'loading'}
        onClick={playClick}
        style={{
          position: 'relative',
          overflow: 'hidden',
          padding: isCompact ? '11px 20px' : '14px 28px',
          background: status === 'loading'
            ? 'rgba(237,250,54,0.5)'
            : 'linear-gradient(90deg, #EDFA36 0%, #c8f000 40%, #EDFA36 60%, #fff880 80%, #EDFA36 100%)',
          backgroundSize: '300% auto',
          animation: status === 'loading' ? 'none' : 'btnShimmer 3s linear infinite',
          color: '#0A0F0D',
          border: 'none',
          borderRadius: 10,
          fontSize: isCompact ? 13 : 15,
          fontWeight: 700,
          cursor: status === 'loading' ? 'default' : 'pointer',
          fontFamily: 'Instrument Sans, sans-serif',
          whiteSpace: 'nowrap',
          transition: 'transform 0.15s, box-shadow 0.15s',
          boxShadow: '0 4px 24px rgba(237,250,54,0.3)',
        }}
        onMouseEnter={e => {
          if (status !== 'loading') {
            e.currentTarget.style.transform = 'scale(1.03) translateY(-1px)'
            e.currentTarget.style.boxShadow = '0 8px 32px rgba(237,250,54,0.45)'
          }
        }}
        onMouseLeave={e => {
          e.currentTarget.style.transform = 'scale(1) translateY(0)'
          e.currentTarget.style.boxShadow = '0 4px 24px rgba(237,250,54,0.3)'
        }}
      >
        {status === 'loading' ? '...' : '⚡ Rejoindre la waitlist'}
      </button>

      {status === 'error' && (
        <div style={{ fontSize: 12, color: '#f87171', textAlign: 'center' }}>
          Une erreur est survenue — réessayez.
        </div>
      )}
    </form>
  )
}
