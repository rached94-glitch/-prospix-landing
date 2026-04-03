import { Search, BarChart2, Star, Clock, Layers, Settings, User } from 'lucide-react'

const TOP_ITEMS = [
  { id: 'search',    icon: Search,    label: 'Recherche' },
  { id: 'leads',     icon: BarChart2, label: 'Mes Leads' },
  { id: 'favorites', icon: Star,      label: 'Favoris' },
  { id: 'history',   icon: Clock,     label: 'Historique' },
  { id: 'pipeline',  icon: Layers,    label: 'Pipeline CRM', disabled: true, badge: 'soon' },
]

const BOTTOM_ITEMS = [
  { id: 'scoring',  icon: Settings, label: 'Profils scoring' },
  { id: 'account',  icon: User,     label: 'Mon compte', disabled: true },
]

function NavItem({ icon, label, active, disabled, badge, onClick }) {
  const IconComp = icon
  return (
    <div style={{ position: 'relative', width: '100%', display: 'flex', justifyContent: 'center' }}>
      <button
        onClick={!disabled ? onClick : undefined}
        title={label}
        style={{
          width: 38, height: 38, borderRadius: 9,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: active ? 'rgba(99,102,241,0.9)' : 'transparent',
          border: 'none',
          cursor: disabled ? 'not-allowed' : 'pointer',
          color: disabled ? 'rgba(255,255,255,0.18)' : active ? 'white' : 'rgba(255,255,255,0.38)',
          transition: 'background 0.15s, color 0.15s',
          boxShadow: active ? '0 0 14px rgba(99,102,241,0.45)' : 'none',
          position: 'relative',
        }}
        onMouseEnter={e => { if (!active && !disabled) e.currentTarget.style.background = 'rgba(255,255,255,0.06)' }}
        onMouseLeave={e => { if (!active && !disabled) e.currentTarget.style.background = 'transparent' }}
      >
        <IconComp size={17} strokeWidth={active ? 2.2 : 1.6} />
        {badge && (
          <span style={{
            position: 'absolute', top: 3, right: 3,
            fontSize: 7, fontFamily: 'var(--font-mono)', color: 'rgba(255,255,255,0.22)',
            background: 'rgba(255,255,255,0.07)',
            borderRadius: 3, padding: '1px 2px', lineHeight: 1, letterSpacing: '0.02em',
          }}>
            {badge}
          </span>
        )}
      </button>
    </div>
  )
}

export default function NavBar({ activeTab, onTabChange }) {
  return (
    <div style={{
      width: 52,
      flexShrink: 0,
      height: '100vh',
      background: '#0c0c18',
      borderRight: '1px solid rgba(255,255,255,0.05)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      paddingTop: 10,
      paddingBottom: 10,
      gap: 3,
    }}>

      {/* Logo */}
      <div style={{
        width: 30, height: 30, borderRadius: 8, flexShrink: 0,
        background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 14,
        color: 'white', marginBottom: 14,
        boxShadow: '0 0 18px rgba(99,102,241,0.45)',
        userSelect: 'none',
      }}>
        L
      </div>

      {/* Top nav items */}
      {TOP_ITEMS.map(item => (
        <NavItem
          key={item.id}
          icon={item.icon}
          label={item.label}
          active={activeTab === item.id}
          disabled={item.disabled}
          badge={item.badge}
          onClick={() => onTabChange(item.id)}
        />
      ))}

      <div style={{ flex: 1 }} />

      {/* Divider */}
      <div style={{ width: 24, height: 1, background: 'rgba(255,255,255,0.07)', margin: '6px 0' }} />

      {/* Bottom nav items */}
      {BOTTOM_ITEMS.map(item => (
        <NavItem
          key={item.id}
          icon={item.icon}
          label={item.label}
          active={activeTab === item.id}
          disabled={item.disabled}
          onClick={() => onTabChange(item.id)}
        />
      ))}
    </div>
  )
}
