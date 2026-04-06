import { useState, useEffect } from 'react'
import { useClickSound } from '../hooks/useClickSound'

export default function StickyButtons() {
  const [show, setShow] = useState(false)
  const playClick = useClickSound()

  useEffect(() => {
    const hero = document.querySelector('#hero')
    const cta  = document.querySelector('#cta-waitlist')

    const check = () => {
      const scrollY = window.scrollY
      const heroBottom = hero ? hero.offsetTop + hero.offsetHeight : 600
      const ctaTop     = cta  ? cta.offsetTop - window.innerHeight * 0.5 : Infinity
      setShow(scrollY > heroBottom * 0.7 && scrollY < ctaTop)
    }

    window.addEventListener('scroll', check, { passive: true })
    check()
    return () => window.removeEventListener('scroll', check)
  }, [])

  const scrollToWaitlist = () => {
    playClick()
    document.querySelector('#cta-waitlist')?.scrollIntoView({ behavior: 'smooth' })
  }
  const scrollToDemo = () => {
    playClick()
    document.querySelector('#fonctionnalites')?.scrollIntoView({ behavior: 'smooth' })
  }

  if (!show) return null

  return (
    <div style={{
      position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
      zIndex: 999,
      display: 'flex', gap: 10,
      padding: '10px 12px',
      background: 'rgba(19,24,21,0.88)',
      backdropFilter: 'blur(16px)',
      WebkitBackdropFilter: 'blur(16px)',
      border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: 40,
      boxShadow: '0 8px 40px rgba(0,0,0,0.5), 0 0 0 1px rgba(29,110,85,0.15)',
      animation: show ? 'fadeSlideUp 0.3s ease forwards' : 'none',
    }}>
      <button
        onClick={scrollToWaitlist}
        style={{
          padding: '10px 22px',
          background: '#1D6E55',
          color: '#F5F5F0',
          border: 'none',
          borderRadius: 30, fontSize: 13, fontWeight: 700,
          cursor: 'pointer', fontFamily: 'Instrument Sans, sans-serif',
          transition: 'all 0.15s',
          boxShadow: '0 2px 12px rgba(29,110,85,0.4)',
          whiteSpace: 'nowrap',
        }}
        onMouseEnter={e => { e.currentTarget.style.background = '#2A9D74'; e.currentTarget.style.transform = 'scale(1.03)' }}
        onMouseLeave={e => { e.currentTarget.style.background = '#1D6E55'; e.currentTarget.style.transform = 'scale(1)' }}
      >
        Rejoindre la waitlist
      </button>

      <button
        onClick={scrollToDemo}
        style={{
          padding: '10px 20px',
          background: 'transparent',
          color: 'rgba(245,245,240,0.7)',
          border: '1.5px solid rgba(255,255,255,0.18)',
          borderRadius: 30, fontSize: 13, fontWeight: 600,
          cursor: 'pointer', fontFamily: 'Instrument Sans, sans-serif',
          transition: 'all 0.15s',
          whiteSpace: 'nowrap',
        }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.4)'; e.currentTarget.style.color = '#F5F5F0' }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.18)'; e.currentTarget.style.color = 'rgba(245,245,240,0.7)' }}
      >
        Voir la démo
      </button>
    </div>
  )
}
