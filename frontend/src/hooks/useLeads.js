import { useState, useEffect } from 'react'
import axios from 'axios'

const STORAGE_KEY = 'leadgen_statuses'
const IS_MOCK = import.meta.env.VITE_MOCK === 'true'

const MOCK_LEADS = [
  { id: 'mock-1', name: 'Brasserie Le Marais', address: '12 rue de Bretagne, Paris 75003', phone: '+33 1 42 72 00 01', website: 'https://brasserie-lemarais.fr', lat: 48.8605, lng: 2.3612, distance: 0.8, domain: 'restaurant', status: 'new', google: { rating: 4.6, totalReviews: 312, openNow: true, reviews: [{ author: 'Sophie M.', rating: 5, text: 'Cadre magnifique, cuisine excellente !', time: '2024-12-10' }, { author: 'Thomas L.', rating: 4, text: 'Très bon rapport qualité-prix, service attentionné.', time: '2024-11-28' }, { author: 'Camille R.', rating: 5, text: 'On y revient chaque semaine !', time: '2024-11-15' }] }, social: { linkedin: null, facebook: 'https://facebook.com/brasseriemarais', instagram: 'https://instagram.com/brasseriemarais', tiktok: null }, score: { total: 87, breakdown: { googleRating: 28, reviewVolume: 16, digitalPresence: 25, opportunity: 18 } } },
  { id: 'mock-2', name: 'Salon Éclat Beauté', address: '45 avenue de la République, Paris 75011', phone: '+33 1 43 55 12 34', website: 'https://eclat-beaute.fr', lat: 48.8635, lng: 2.3790, distance: 1.4, domain: 'beaute', status: 'new', google: { rating: 4.8, totalReviews: 528, openNow: true, reviews: [{ author: 'Léa D.', rating: 5, text: 'Coiffeuse au top, résultat impeccable !', time: '2024-12-12' }, { author: 'Julie P.', rating: 5, text: 'Accueil super chaleureux, je recommande.', time: '2024-12-01' }] }, social: { linkedin: 'https://linkedin.com/company/eclat-beaute', facebook: 'https://facebook.com/eclatbeaute', instagram: 'https://instagram.com/eclatbeaute', tiktok: 'https://tiktok.com/@eclatbeaute' }, score: { total: 94, breakdown: { googleRating: 29, reviewVolume: 25, digitalPresence: 25, opportunity: 15 } } },
  { id: 'mock-3', name: 'Cabinet Juridique Moreau', address: '8 boulevard Beaumarchais, Paris 75004', phone: '+33 1 48 87 56 78', website: null, lat: 48.8558, lng: 2.3649, distance: 2.1, domain: 'juridique', status: 'new', google: { rating: 3.9, totalReviews: 42, openNow: false, reviews: [{ author: 'Pierre V.', rating: 4, text: 'Professionnel et efficace.', time: '2024-10-20' }] }, social: { linkedin: 'https://linkedin.com/company/moreau-avocats', facebook: null, instagram: null, tiktok: null }, score: { total: 54, breakdown: { googleRating: 23, reviewVolume: 2, digitalPresence: 14, opportunity: 15 } } },
  { id: 'mock-4', name: 'FitZone Paris République', address: '22 place de la République, Paris 75010', phone: '+33 1 40 37 89 00', website: 'https://fitzone-paris.com', lat: 48.8672, lng: 2.3638, distance: 1.9, domain: 'sport', status: 'new', google: { rating: 4.4, totalReviews: 189, openNow: true, reviews: [{ author: 'Marc T.', rating: 5, text: 'Super salle, équipements récents !', time: '2024-12-08' }, { author: 'Amina B.', rating: 4, text: 'Bons coachs, ambiance motivante.', time: '2024-11-30' }] }, social: { linkedin: null, facebook: 'https://facebook.com/fitzoneparis', instagram: 'https://instagram.com/fitzone_paris', tiktok: 'https://tiktok.com/@fitzoneparis' }, score: { total: 76, breakdown: { googleRating: 26, reviewVolume: 9, digitalPresence: 22, opportunity: 19 } } },
  { id: 'mock-5', name: 'Agence Immobilière Bastille', address: '3 rue de la Roquette, Paris 75011', phone: '+33 1 43 57 22 11', website: 'https://immo-bastille.fr', lat: 48.8530, lng: 2.3710, distance: 2.5, domain: 'immobilier', status: 'new', google: { rating: 4.2, totalReviews: 97, openNow: true, reviews: [{ author: 'Claire F.', rating: 4, text: 'Équipe réactive, transaction rapide.', time: '2024-11-18' }] }, social: { linkedin: 'https://linkedin.com/company/immo-bastille', facebook: 'https://facebook.com/immobastille', instagram: null, tiktok: null }, score: { total: 68, breakdown: { googleRating: 25, reviewVolume: 5, digitalPresence: 21, opportunity: 17 } } },
  { id: 'mock-6', name: 'Restaurant Pho Saïgon', address: '67 rue Oberkampf, Paris 75011', phone: '+33 1 43 57 44 55', website: null, lat: 48.8643, lng: 2.3742, distance: 1.7, domain: 'restaurant', status: 'new', google: { rating: 4.7, totalReviews: 445, openNow: true, reviews: [{ author: 'Yuki H.', rating: 5, text: 'Meilleur pho de Paris, sans hésiter !', time: '2024-12-14' }, { author: 'Antoine G.', rating: 5, text: 'Authentique et généreux.', time: '2024-12-05' }] }, social: { linkedin: null, facebook: 'https://facebook.com/phosaigon75', instagram: 'https://instagram.com/phosaigon_paris', tiktok: null }, score: { total: 81, breakdown: { googleRating: 28, reviewVolume: 22, digitalPresence: 17, opportunity: 14 } } },
  { id: 'mock-7', name: 'Dr. Cabinet Santé Centre', address: '15 rue du Temple, Paris 75004', phone: '+33 1 42 78 33 44', website: 'https://sante-centre-paris.fr', lat: 48.8575, lng: 2.3530, distance: 3.2, domain: 'sante', status: 'new', google: { rating: 3.5, totalReviews: 78, openNow: false, reviews: [{ author: 'Nadia K.', rating: 3, text: 'Attente longue mais médecin compétent.', time: '2024-10-30' }] }, social: { linkedin: 'https://linkedin.com/company/sante-centre', facebook: null, instagram: null, tiktok: null }, score: { total: 49, breakdown: { googleRating: 21, reviewVolume: 4, digitalPresence: 14, opportunity: 10 } } },
  { id: 'mock-8', name: 'Studio Digital Pixel', address: '99 rue du Faubourg Saint-Antoine, Paris 75011', phone: '+33 1 43 48 77 66', website: 'https://studio-pixel.io', lat: 48.8512, lng: 2.3782, distance: 2.9, domain: 'tech', status: 'new', google: { rating: 4.9, totalReviews: 63, openNow: true, reviews: [{ author: 'Hugo B.', rating: 5, text: 'Agence créative, résultats au-delà des attentes.', time: '2024-12-11' }] }, social: { linkedin: 'https://linkedin.com/company/studio-pixel', facebook: 'https://facebook.com/studiopixel', instagram: 'https://instagram.com/studiopixel_io', tiktok: 'https://tiktok.com/@studiopixel' }, score: { total: 83, breakdown: { googleRating: 29, reviewVolume: 3, digitalPresence: 25, opportunity: 26 } } },
  { id: 'mock-9', name: 'Comptabilité & Finance Plus', address: '5 rue Beaubourg, Paris 75003', phone: '+33 1 42 71 88 99', website: 'https://finance-plus-paris.fr', lat: 48.8617, lng: 2.3501, distance: 3.8, domain: 'finance', status: 'new', google: { rating: 4.1, totalReviews: 31, openNow: true, reviews: [{ author: 'Isabelle M.', rating: 4, text: 'Cabinet sérieux, conseils avisés.', time: '2024-11-22' }] }, social: { linkedin: 'https://linkedin.com/company/finance-plus', facebook: null, instagram: null, tiktok: null }, score: { total: 58, breakdown: { googleRating: 25, reviewVolume: 2, digitalPresence: 16, opportunity: 15 } } },
  { id: 'mock-10', name: 'École de Cuisine Saveurs', address: '31 rue de Turenne, Paris 75003', phone: '+33 1 42 74 55 66', website: 'https://ecole-saveurs.fr', lat: 48.8590, lng: 2.3620, distance: 1.2, domain: 'education', status: 'new', google: { rating: 4.5, totalReviews: 156, openNow: false, reviews: [{ author: 'Emma S.', rating: 5, text: 'Cours passionnants, chef pédagogue !', time: '2024-12-03' }, { author: 'Romain C.', rating: 4, text: 'Super expérience, je recommande vivement.', time: '2024-11-25' }] }, social: { linkedin: null, facebook: 'https://facebook.com/ecolesaveurs', instagram: 'https://instagram.com/ecole_saveurs', tiktok: 'https://tiktok.com/@ecolesaveurs' }, score: { total: 72, breakdown: { googleRating: 27, reviewVolume: 8, digitalPresence: 21, opportunity: 16 } } },
]

function loadStatuses() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
  } catch {
    return {}
  }
}

function saveStatuses(statuses) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(statuses))
}

export function useLeads() {
  const [leads, setLeads] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const [progress, setProgress] = useState(null) // { message, current, total }

  // Au montage : restaurer les statuts depuis localStorage
  useEffect(() => {
    const statuses = loadStatuses()
    if (Object.keys(statuses).length === 0) return
    setLeads((prev) =>
      prev.map((lead) => {
        const id = lead._id ?? lead.id
        return statuses[id] ? { ...lead, status: statuses[id] } : lead
      })
    )
  }, [])

  function applyStatuses(raw) {
    const statuses = loadStatuses()
    return raw.map((lead) => {
      const id = lead._id ?? lead.id
      const individual = localStorage.getItem(`lead_status_${id}`)
      const saved = individual ?? statuses[id]
      const dmRaw = localStorage.getItem(`dm_${id}`)
      const decisionMaker = dmRaw ? JSON.parse(dmRaw) : undefined
      return {
        ...lead,
        ...(saved        ? { status: saved }       : {}),
        ...(decisionMaker ? { decisionMaker }        : {}),
      }
    })
  }

  const searchLeads = async (params) => {
    console.log('[useLeads] searchLeads — lat:', params.lat, 'lng:', params.lng, '| weights:', params.weights)
    try {
      setIsLoading(true)
      setError(null)
      setProgress({ message: 'Démarrage...' })

      if (IS_MOCK) {
        setProgress({ message: 'Chargement des données mock...' })
        await new Promise((r) => setTimeout(r, 800))
        const raw = MOCK_LEADS.filter((l) => !params.domain || l.domain === params.domain)
        setLeads(applyStatuses(raw))
        return
      }

      // Streaming SSE via fetch
      console.log('[useLeads] Connexion SSE → /api/leads/search/stream')
      const response = await fetch('/api/leads/search/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      })
      console.log('[useLeads] SSE réponse reçue, status:', response.status)

      const reader  = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer    = ''
      let gotDone   = false

      while (true) {
        const { done, value } = await reader.read()
        if (done) { console.log('[useLeads] SSE stream fermé par le serveur (done)'); break }

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() // ligne incomplète

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          try {
            const event = JSON.parse(line.slice(6))
            console.log('[useLeads] SSE event:', event.type, event.message ?? '', event.current != null ? `${event.current}/${event.total}` : '')

            if (event.type === 'page' || event.type === 'progress' || event.type === 'enrich' || event.type === 'cache') {
              setProgress({ message: event.message, current: event.current, total: event.total })
            } else if (event.type === 'done') {
              console.log('[useLeads] ✅ type:done reçu —', event.leads?.length, 'leads — fermeture overlay dans 2s')
              setLeads(applyStatuses(event.leads))
              gotDone = true
              break
            } else if (event.type === 'error') {
              console.error('[useLeads] SSE error event:', event.message)
              setError(event.message)
            }
          } catch { /* ligne incomplète ou invalide */ }
        }
        if (gotDone) break
      }

      if (gotDone) {
        await new Promise(r => setTimeout(r, 2000))
        console.log('[useLeads] Fermeture overlay (2s écoulées)')
      }
    } catch (err) {
      console.error('[useLeads] Search error:', err)
      setError(err.message)
    } finally {
      console.log('[useLeads] finally → setIsLoading(false)')
      setIsLoading(false)
      setProgress(null)
    }
  }

  const updateLeadStatus = async (id, status) => {
    // Capture lead AVANT la mise à jour d'état
    const lead = leads.find((l) => l._id === id || l.id === id)

    // Mise à jour locale
    setLeads((prev) =>
      prev.map((l) =>
        (l._id === id || l.id === id) ? { ...l, status } : l
      )
    )

    // Persistance localStorage
    const statuses = loadStatuses()
    statuses[id] = status
    saveStatuses(statuses)

    // Si favori → envoie vers Google Sheets
    if (status === 'favorite' && lead) {
      try {
        await axios.post('/api/sheets/lead', { lead: { ...lead, status: 'favorite' } })
        console.log('✅ Lead favori sauvegardé dans Sheets:', lead.name)
      } catch (e) {
        console.error('Sheets error:', e.message)
      }
    }
  }

  const exportLeads = () => {
    try {
      const headers = ['Nom', 'Adresse', 'Score', 'Note', 'Avis', 'Site web', 'Téléphone', 'Distance', 'LinkedIn', 'Facebook', 'Instagram', 'Statut']
      const rows = leads.map(l => [
        l.name ?? '',
        l.address ?? '',
        l.score?.total ?? 0,
        l.google?.rating ?? '',
        l.google?.totalReviews ?? '',
        l.website ?? '',
        l.phone ?? '',
        l.distance != null ? `${l.distance}km` : '',
        l.social?.linkedin ?? '',
        l.social?.facebook ?? '',
        l.social?.instagram ?? '',
        l.status ?? 'new',
      ])
      const csv = [headers, ...rows]
        .map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
        .join('\n')
      const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' })
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = url
      a.download = `leads_${new Date().toISOString().slice(0, 10)}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      setError(err.message)
    }
  }

  const updateLeadDecisionMaker = (id, decisionMaker) => {
    setLeads((prev) =>
      prev.map((l) =>
        (l._id === id || l.id === id) ? { ...l, decisionMaker } : l
      )
    )
    localStorage.setItem(`dm_${id}`, JSON.stringify(decisionMaker))
  }

  const forceCloseOverlay = () => { console.log('[useLeads] forceCloseOverlay appelé'); setIsLoading(false); setProgress(null) }

  return { leads, isLoading, error, progress, searchLeads, updateLeadStatus, updateLeadDecisionMaker, exportLeads, forceCloseOverlay }
}
