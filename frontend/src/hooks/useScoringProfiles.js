import { useState, useEffect } from 'react'

// Fallback used when the backend is unreachable
const BUILTIN_PROFILES = [
  {
    id: 'default',
    name: 'Défaut',
    icon: '⚖️',
    isPreset: true,
    weights: { googleRating: 30, reviewVolume: 25, digitalPresence: 25, opportunity: 20 },
  },
  // ── Populaires ────────────────────────────────────────────────────────────
  {
    id: 'chatbot',
    name: 'Dev Chatbot IA',
    icon: '🤖',
    isPreset: true,
    weights: { googleRating: 10, reviewVolume: 10, digitalPresence: 10, opportunity: 70 },
  },
  {
    id: 'seo',
    name: 'SEO',
    icon: '🔍',
    isPreset: true,
    weights: { googleRating: 15, reviewVolume: 15, digitalPresence: 60, opportunity: 10 },
  },
  {
    id: 'pub-google',
    name: 'Pub Google',
    icon: '📊',
    isPreset: true,
    weights: { googleRating: 50, reviewVolume: 20, digitalPresence: 20, opportunity: 10 },
  },
  {
    id: 'social-media',
    name: 'Community Manager',
    icon: '📱',
    isPreset: true,
    weights: { googleRating: 10, reviewVolume: 15, digitalPresence: 55, opportunity: 20 },
  },
  // ── Créatifs ──────────────────────────────────────────────────────────────
  {
    id: 'photographe',
    name: 'Photographe',
    icon: '📸',
    isPreset: true,
    // opportunity (45%) = opportunité (15%) + photos manquantes (30%)
    weights: { googleRating: 20, reviewVolume: 15, digitalPresence: 20, opportunity: 45 },
  },
  {
    id: 'videaste',
    name: 'Vidéaste',
    icon: '🎬',
    isPreset: true,
    // opportunity (35%) = opportunité (25%) + réseaux inactifs (10%)
    weights: { googleRating: 15, reviewVolume: 10, digitalPresence: 40, opportunity: 35 },
  },
  {
    id: 'designer',
    name: 'Designer / Branding',
    icon: '🎨',
    isPreset: true,
    weights: { googleRating: 15, reviewVolume: 10, digitalPresence: 35, opportunity: 40 },
  },
  {
    id: 'copywriter',
    name: 'Copywriter / SEO',
    icon: '✍️',
    isPreset: true,
    weights: { googleRating: 20, reviewVolume: 30, digitalPresence: 25, opportunity: 25 },
  },
  // ── Tech ──────────────────────────────────────────────────────────────────
  {
    id: 'dev-web',
    name: 'Développeur Web',
    icon: '💻',
    isPreset: true,
    weights: { googleRating: 15, reviewVolume: 10, digitalPresence: 45, opportunity: 30 },
  },
  {
    id: 'consultant-seo',
    name: 'Consultant SEO',
    icon: '🔎',
    isPreset: true,
    weights: { googleRating: 10, reviewVolume: 40, digitalPresence: 30, opportunity: 20 },
  },
  // ── Marketing ─────────────────────────────────────────────────────────────
  {
    id: 'email-marketing',
    name: 'Email Marketing',
    icon: '📧',
    isPreset: true,
    weights: { googleRating: 15, reviewVolume: 20, digitalPresence: 30, opportunity: 35 },
  },
]

export function useScoringProfiles() {
  const [profiles, setProfiles] = useState(BUILTIN_PROFILES)
  const [activeProfileId, setActiveProfileId] = useState(
    () => localStorage.getItem('activeProfileId') || 'default'
  )
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)

  // Fetch on mount — if API is unreachable, BUILTIN_PROFILES stay as fallback
  useEffect(() => {
    setIsLoading(true)
    fetch('/api/profiles')
      .then(r => r.json())
      .then(data => {
        if (data.profiles?.length) {
          // Merge: keep builtin presets, append any custom (non-preset) from backend
          const customFromBackend = data.profiles.filter(p => !p.isPreset)
          setProfiles([...BUILTIN_PROFILES, ...customFromBackend])
        }
      })
      .catch(() => {
        // backend not running — silently keep BUILTIN_PROFILES
      })
      .finally(() => setIsLoading(false))
  }, [])

  const activeProfile = profiles.find(p => p.id === activeProfileId) || profiles[0] || null

  const setActiveProfile = (profile) => {
    setActiveProfileId(profile.id)
    localStorage.setItem('activeProfileId', profile.id)
  }

  const createProfile = async (name, weights) => {
    const res = await fetch('/api/profiles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, weights }),
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({ error: res.statusText }))
      throw new Error(body.error || res.statusText)
    }
    const { profile } = await res.json()
    setProfiles(prev => [...prev, profile])
    return profile
  }

  const updateProfile = async (id, updates) => {
    const res = await fetch(`/api/profiles/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({ error: res.statusText }))
      throw new Error(body.error || res.statusText)
    }
    const { profile } = await res.json()
    setProfiles(prev => prev.map(p => p.id === id ? profile : p))
    return profile
  }

  const deleteProfile = async (id) => {
    const res = await fetch(`/api/profiles/${id}`, { method: 'DELETE' })
    if (!res.ok) {
      const body = await res.json().catch(() => ({ error: res.statusText }))
      throw new Error(body.error || res.statusText)
    }
    setProfiles(prev => prev.filter(p => p.id !== id))
    if (activeProfileId === id) {
      setActiveProfileId('default')
      localStorage.setItem('activeProfileId', 'default')
    }
  }

  return {
    profiles,
    activeProfile,
    setActiveProfile,
    createProfile,
    updateProfile,
    deleteProfile,
    isLoading,
    error,
  }
}
