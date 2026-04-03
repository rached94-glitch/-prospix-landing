import { useState, useEffect } from 'react'

const DEFAULT_WEIGHTS = {
  googleRating:    30,
  reviewVolume:    25,
  digitalPresence: 25,
  opportunity:     20,
}

const CRITERIA = [
  { key: 'googleRating',    label: 'Note Google',      short: 'Note' },
  { key: 'reviewVolume',    label: "Volume d'avis",     short: 'Avis' },
  { key: 'digitalPresence', label: 'Présence digitale', short: 'Dig.' },
  { key: 'opportunity',     label: 'Opportunité',       short: 'Opp.' },
]

// Category grouping for presets (Défaut handled separately)
const PRESET_CATEGORIES = [
  { label: '🔥 Populaires',  ids: ['chatbot', 'seo', 'pub-google', 'social-media'] },
  { label: '🎨 Créatifs',    ids: ['photographe', 'videaste', 'designer', 'copywriter'] },
  { label: '💻 Tech',        ids: ['dev-web', 'consultant-seo'] },
  { label: '📊 Marketing',   ids: ['email-marketing', 'pub-google'] },
]

// ─── Mini bar chart shown on each profile card ────────────────────────────────
function MiniBars({ weights, active }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, marginTop: 8 }}>
      {CRITERIA.map(({ key, short }) => {
        const val = weights?.[key] ?? 0
        return (
          <div key={key}>
            <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--faint)', marginBottom: 3, letterSpacing: '0.05em' }}>
              {short}
            </div>
            <div style={{ height: 3, background: 'rgba(255,255,255,0.07)', borderRadius: 2, overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                width: `${val}%`,
                background: active ? 'var(--accent)' : 'rgba(255,255,255,0.28)',
                borderRadius: 2,
                transition: 'width 0.35s ease',
              }} />
            </div>
            <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 700, color: active ? 'var(--accent)' : 'var(--muted)', marginTop: 3 }}>
              {val}%
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Single weight slider row ─────────────────────────────────────────────────
function SliderRow({ label, value, onChange, disabled }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 5 }}>
        <label style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: disabled ? 'var(--faint)' : 'var(--text)' }}>
          {label}
        </label>
        <span style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 13,
          fontWeight: 700,
          color: disabled ? 'var(--faint)' : 'var(--accent)',
          minWidth: 34,
          textAlign: 'right',
        }}>
          {value}%
        </span>
      </div>
      <input
        type="range"
        min={5}
        max={90}
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        disabled={disabled}
        className="slider-premium"
        style={{ width: '100%', opacity: disabled ? 0.35 : 1, transition: 'opacity 0.2s' }}
      />
    </div>
  )
}

// ─── Sum indicator ────────────────────────────────────────────────────────────
function SumBadge({ total }) {
  const ok = total === 100
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '6px 12px',
      borderRadius: 6,
      marginBottom: 14,
      background: ok ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)',
      border: `1px solid ${ok ? 'rgba(16,185,129,0.25)' : 'rgba(239,68,68,0.25)'}`,
      fontFamily: 'var(--font-mono)',
      fontSize: 12,
      color: ok ? '#10b981' : '#ef4444',
      transition: 'background 0.2s, border-color 0.2s, color 0.2s',
    }}>
      <span>Total des poids</span>
      <span style={{ fontWeight: 700 }}>{total}/100 {ok ? '✓' : '⚠'}</span>
    </div>
  )
}

// ─── Category label ───────────────────────────────────────────────────────────
function CategoryLabel({ children }) {
  return (
    <div style={{
      fontFamily: 'var(--font-body)',
      fontSize: 10,
      fontWeight: 700,
      letterSpacing: '0.10em',
      textTransform: 'uppercase',
      color: 'var(--muted)',
      padding: '10px 16px 6px',
    }}>
      {children}
    </div>
  )
}

// ─── Single profile card ──────────────────────────────────────────────────────
function ProfileCard({ profile, isActive, onActivate, onDelete }) {
  return (
    <div
      onClick={() => !isActive && onActivate(profile)}
      style={{
        padding: '10px 12px',
        marginBottom: 5,
        borderRadius: 10,
        cursor: isActive ? 'default' : 'pointer',
        background: isActive ? 'rgba(29,110,85,0.07)' : 'rgba(255,255,255,0.025)',
        border: `1px solid ${isActive ? 'rgba(29,110,85,0.38)' : 'rgba(255,255,255,0.07)'}`,
        boxShadow: isActive ? '0 0 14px rgba(29,110,85,0.07)' : 'none',
        transition: 'background 0.2s, border-color 0.2s, box-shadow 0.2s',
      }}
      onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'rgba(255,255,255,0.05)' }}
      onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'rgba(255,255,255,0.025)' }}
    >
      {/* Name row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
          {profile.icon && (
            <span style={{ fontSize: 13, lineHeight: 1, flexShrink: 0 }}>{profile.icon}</span>
          )}
          <span style={{
            fontFamily: 'var(--font-body)',
            fontSize: 12,
            fontWeight: 600,
            color: isActive ? 'var(--accent)' : 'var(--text)',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {profile.name}
          </span>
          {profile.isPreset && (
            <span style={{ fontSize: 9, color: 'var(--faint)', fontFamily: 'var(--font-mono)', flexShrink: 0 }}>
              preset
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0, marginLeft: 6 }}>
          {isActive ? (
            <span style={{
              fontSize: 9, fontWeight: 700, letterSpacing: 0.6,
              color: 'var(--accent)', background: 'rgba(29,110,85,0.12)',
              border: '1px solid rgba(29,110,85,0.28)', borderRadius: 4,
              padding: '2px 6px', textTransform: 'uppercase', fontFamily: 'var(--font-mono)',
            }}>
              Actif
            </span>
          ) : (
            <button
              type="button"
              onClick={e => { e.stopPropagation(); onActivate(profile) }}
              style={{
                fontSize: 10, padding: '2px 7px', borderRadius: 5,
                border: '1px solid rgba(29,110,85,0.28)',
                background: 'none', color: 'var(--accent)',
                fontFamily: 'var(--font-mono)', cursor: 'pointer',
                transition: 'background 0.15s',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(29,110,85,0.09)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'none')}
            >
              Activer
            </button>
          )}
          {!profile.isPreset && onDelete && (
            <button
              type="button"
              onClick={e => { e.stopPropagation(); onDelete(e, profile.id) }}
              style={{
                background: 'none', border: 'none', color: 'var(--muted)',
                fontSize: 14, cursor: 'pointer', lineHeight: 1,
                padding: '2px 4px', borderRadius: 4, transition: 'color 0.15s',
              }}
              onMouseEnter={e => (e.currentTarget.style.color = 'var(--danger)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--muted)')}
              title={`Supprimer ${profile.name}`}
            >×</button>
          )}
        </div>
      </div>

      <MiniBars weights={profile.weights} active={isActive} />
    </div>
  )
}

// ─── Main drawer ──────────────────────────────────────────────────────────────
export default function ScoringProfileDrawer({
  profiles = [],
  activeProfile,
  onSetActive,
  onCreateProfile,
  onUpdateProfile,
  onDeleteProfile,
  onClose,
}) {
  const [editWeights, setEditWeights] = useState(DEFAULT_WEIGHTS)
  const [newName,     setNewName]     = useState('')
  const [showCreate,  setShowCreate]  = useState(false)
  const [saving,      setSaving]      = useState(false)
  const [localError,  setLocalError]  = useState(null)

  // Sync sliders with active profile (not while create form is open)
  useEffect(() => {
    if (!showCreate && activeProfile?.weights) {
      setEditWeights(activeProfile.weights)
    }
    setLocalError(null)
  }, [activeProfile?.id, showCreate])

  const total    = CRITERIA.reduce((s, c) => s + (editWeights[c.key] ?? 0), 0)
  const isValid  = total === 100
  const isPreset = activeProfile?.isPreset === true

  const setW = (key, val) => setEditWeights(prev => ({ ...prev, [key]: val }))

  // ── handlers ────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!isValid || saving || isPreset) return
    setSaving(true); setLocalError(null)
    try {
      const updated = await onUpdateProfile(activeProfile.id, { weights: editWeights })
      onSetActive(updated)
    } catch (e) { setLocalError(e.message) }
    finally { setSaving(false) }
  }

  const handleCreate = async () => {
    if (!isValid || !newName.trim() || saving) return
    setSaving(true); setLocalError(null)
    try {
      const profile = await onCreateProfile(newName.trim(), editWeights)
      onSetActive(profile)
      setNewName(''); setShowCreate(false)
    } catch (e) { setLocalError(e.message) }
    finally { setSaving(false) }
  }

  const handleDelete = async (e, id) => {
    e.stopPropagation()
    try { await onDeleteProfile(id) }
    catch (e) { setLocalError(e.message) }
  }

  const openCreate = () => {
    setEditWeights(DEFAULT_WEIGHTS)
    setNewName(''); setLocalError(null); setShowCreate(true)
  }

  const cancelCreate = () => {
    setShowCreate(false)
    setEditWeights(activeProfile?.weights ?? DEFAULT_WEIGHTS)
    setNewName(''); setLocalError(null)
  }

  // ── derived lists ────────────────────────────────────────────────────────────
  const defaultProfile  = profiles.find(p => p.id === 'default')
  const presetProfiles  = profiles.filter(p => p.isPreset && p.id !== 'default')
  const customProfiles  = profiles.filter(p => !p.isPreset)

  const cardProps = (profile) => ({
    profile,
    isActive: activeProfile?.id === profile.id,
    onActivate: onSetActive,
    onDelete: handleDelete,
  })

  // ── render ───────────────────────────────────────────────────────────────────
  return (
    <div style={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      background: 'var(--surface)',
      overflow: 'hidden',
    }}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 16px',
        borderBottom: '1px solid var(--border)',
        flexShrink: 0,
      }}>
        <span style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 600, color: 'var(--text)', letterSpacing: 0.3 }}>
          Profils de scoring
        </span>
        <button
          onClick={onClose}
          style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: 18, cursor: 'pointer', lineHeight: 1, padding: '2px 5px', borderRadius: 4, transition: 'color 0.15s' }}
          onMouseEnter={e => (e.currentTarget.style.color = 'var(--text)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'var(--muted)')}
        >×</button>
      </div>

      {/* ── Scrollable body ─────────────────────────────────────────────────── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '10px 0' }}>

        {/* ── Défaut (always at top) ─────────────────────────────────────────── */}
        {defaultProfile && (
          <div style={{ padding: '0 10px', marginBottom: 2 }}>
            <ProfileCard {...cardProps(defaultProfile)} />
          </div>
        )}

        {/* ── Mes profils (custom) ──────────────────────────────────────────── */}
        {customProfiles.length > 0 && (
          <>
            <CategoryLabel>📌 Mes profils</CategoryLabel>
            <div style={{ padding: '0 10px', marginBottom: 2 }}>
              {customProfiles.map(p => <ProfileCard key={p.id} {...cardProps(p)} />)}
            </div>
          </>
        )}

        {/* ── Preset categories ─────────────────────────────────────────────── */}
        {PRESET_CATEGORIES.map(cat => {
          const catProfiles = cat.ids
            .map(id => presetProfiles.find(p => p.id === id))
            .filter(Boolean)
          // deduplicate within category (pub-google appears in 2 categories)
          const seen = new Set()
          const unique = catProfiles.filter(p => { if (seen.has(p.id)) return false; seen.add(p.id); return true })
          if (unique.length === 0) return null
          return (
            <div key={cat.label}>
              <CategoryLabel>{cat.label}</CategoryLabel>
              <div style={{ padding: '0 10px', marginBottom: 2 }}>
                {unique.map(p => <ProfileCard key={p.id} {...cardProps(p)} />)}
              </div>
            </div>
          )
        })}

        {/* ── Separator ─────────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 16px', margin: '6px 0' }}>
          <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
          <span style={{ fontSize: 10, color: 'var(--faint)', fontFamily: 'var(--font-mono)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            Créer
          </span>
          <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
        </div>

        {/* ── Collapsible create form ────────────────────────────────────────── */}
        <div style={{ padding: '0 10px' }}>

          {/* Toggle header */}
          <button
            type="button"
            onClick={() => showCreate ? cancelCreate() : openCreate()}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 14px',
              borderRadius: showCreate ? '8px 8px 0 0' : 8,
              border: '1px solid rgba(29,110,85,0.22)',
              background: showCreate ? 'rgba(29,110,85,0.07)' : 'rgba(29,110,85,0.04)',
              color: 'var(--accent)',
              fontFamily: 'var(--font-body)',
              fontSize: 13,
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'background 0.2s, border-radius 0.2s',
              textAlign: 'left',
            }}
            onMouseEnter={e => { if (!showCreate) e.currentTarget.style.background = 'rgba(29,110,85,0.09)' }}
            onMouseLeave={e => { if (!showCreate) e.currentTarget.style.background = 'rgba(29,110,85,0.04)' }}
          >
            <span>+ Créer un profil</span>
            <span style={{
              fontSize: 16,
              fontWeight: 300,
              lineHeight: 1,
              transform: showCreate ? 'rotate(45deg)' : 'rotate(0deg)',
              transition: 'transform 0.25s ease',
              display: 'inline-block',
            }}>+</span>
          </button>

          {/* Animated expansion */}
          <div style={{
            overflow: 'hidden',
            maxHeight: showCreate ? '560px' : '0px',
            transition: 'max-height 0.3s ease-in-out',
          }}>
            <div style={{
              padding: '14px',
              border: '1px solid rgba(29,110,85,0.22)',
              borderTop: 'none',
              borderRadius: '0 0 8px 8px',
              background: 'rgba(29,110,85,0.03)',
            }}>

              {/* Name input */}
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontFamily: 'var(--font-body)', fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 6 }}>
                  Nom du profil
                </label>
                <input
                  type="text"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleCreate()
                    if (e.key === 'Escape') cancelCreate()
                  }}
                  placeholder="ex: Agence SEO"
                  autoFocus={showCreate}
                  style={{
                    width: '100%',
                    padding: '7px 10px',
                    borderRadius: 6,
                    border: '1px solid var(--border)',
                    background: 'rgba(255,255,255,0.05)',
                    color: 'var(--text)',
                    fontFamily: 'var(--font-body)',
                    fontSize: 13,
                    outline: 'none',
                    boxSizing: 'border-box',
                    transition: 'border-color 0.15s',
                  }}
                  onFocus={e => (e.target.style.borderColor = 'rgba(29,110,85,0.5)')}
                  onBlur={e => (e.target.style.borderColor = 'var(--border)')}
                />
              </div>

              {/* Sliders */}
              {CRITERIA.map(({ key, label }) => (
                <SliderRow
                  key={key}
                  label={label}
                  value={editWeights[key]}
                  onChange={val => setW(key, val)}
                  disabled={false}
                />
              ))}

              <SumBadge total={total} />

              {localError && (
                <div style={{ padding: '7px 10px', borderRadius: 6, marginBottom: 10, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--danger)' }}>
                  {localError}
                </div>
              )}

              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  onClick={handleCreate}
                  disabled={!isValid || !newName.trim() || saving}
                  style={{
                    flex: 1, padding: '9px 0', borderRadius: 7, border: 'none',
                    background: isValid && newName.trim() && !saving ? 'var(--accent)' : 'rgba(255,255,255,0.07)',
                    color: isValid && newName.trim() && !saving ? '#0a0a0f' : 'var(--muted)',
                    fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 700,
                    cursor: isValid && newName.trim() && !saving ? 'pointer' : 'not-allowed',
                    transition: 'background 0.2s, color 0.2s',
                  }}
                >
                  {saving ? 'Création…' : 'Créer le profil'}
                </button>
                <button
                  type="button"
                  onClick={cancelCreate}
                  style={{
                    padding: '9px 12px', borderRadius: 7,
                    border: '1px solid var(--border)', background: 'none',
                    color: 'var(--muted)', fontFamily: 'var(--font-body)', fontSize: 13, cursor: 'pointer',
                    transition: 'color 0.15s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.color = 'var(--text)')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'var(--muted)')}
                >
                  Annuler
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ── Active profile edit (non-preset only) ─────────────────────────── */}
        {activeProfile && !isPreset && !showCreate && (
          <div style={{ padding: '14px 10px 0' }}>
            <div style={{
              padding: 14,
              borderRadius: 8,
              border: '1px solid var(--border)',
              background: 'rgba(255,255,255,0.02)',
            }}>
              <div style={{
                fontFamily: 'var(--font-body)',
                fontSize: 10, fontWeight: 700,
                letterSpacing: '0.12em', textTransform: 'uppercase',
                color: 'var(--muted)', padding: '0 2px', marginBottom: 12,
              }}>
                Modifier — {activeProfile.name}
              </div>
              {CRITERIA.map(({ key, label }) => (
                <SliderRow
                  key={key}
                  label={label}
                  value={editWeights[key]}
                  onChange={val => setW(key, val)}
                  disabled={false}
                />
              ))}
              <SumBadge total={total} />
              {localError && (
                <div style={{ padding: '7px 10px', borderRadius: 6, marginBottom: 10, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--danger)' }}>
                  {localError}
                </div>
              )}
              <button
                type="button"
                onClick={handleSave}
                disabled={!isValid || saving}
                style={{
                  width: '100%', padding: '9px 0', borderRadius: 7, border: 'none',
                  background: isValid && !saving ? 'rgba(29,110,85,0.15)' : 'rgba(255,255,255,0.05)',
                  color: isValid && !saving ? 'var(--accent)' : 'var(--muted)',
                  fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 600,
                  cursor: isValid && !saving ? 'pointer' : 'not-allowed',
                  transition: 'background 0.2s, color 0.2s',
                  border: `1px solid ${isValid && !saving ? 'rgba(29,110,85,0.3)' : 'transparent'}`,
                }}
              >
                {saving ? 'Sauvegarde…' : 'Sauvegarder les poids'}
              </button>
            </div>
          </div>
        )}

        <div style={{ height: 20 }} />
      </div>
    </div>
  )
}
