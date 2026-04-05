import { playSuccess, playError } from '../utils/sounds'

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001'

function Stars({ rating = 0, size = 13 }) {
  const full = Math.round(rating)
  return (
    <span style={{ fontSize: size, letterSpacing: 0.5 }}>
      {Array.from({ length: 5 }, (_, i) => (
        <span key={i} style={{ color: i < full ? '#f59e0b' : 'rgba(255,255,255,0.10)' }}>★</span>
      ))}
    </span>
  )
}

/**
 * ReviewsSection — charge les avis, déclenche l'analyse IA
 *
 * Props:
 *   lead            — objet lead complet
 *   reviewsState    — 'idle' | 'loading' | 'done'
 *   setReviewsState — setter
 *   reviewsData     — null | { reviews[], total, unanswered }
 *   setReviewsData  — setter
 *   aiState         — 'idle' | 'loading' | 'done' | 'error'
 *   setAiState      — setter (utilisé pour reset sur "Réessayer")
 *   aiError         — string | null
 *   aiReport        — null | object (présent quand aiState==='done')
 *   pdfLoading      — boolean
 *   onExportPDF     — () => void
 *   onReviewsLoaded — (data) => void  — appelé après chargement ; le parent chaîne handleAnalyzeAI
 *   onAnalyzeAI     — () => void      — appelé quand avis déjà chargés
 */
export default function ReviewsSection({
  lead,
  reviewsState, setReviewsState,
  reviewsData,  setReviewsData,
  aiState,      setAiState,
  aiError,
  aiReport,
  pdfLoading,
  onExportPDF,
  onReviewsLoaded,
  onAnalyzeAI,
}) {
  const handleLoadReviews = async () => {
    if (reviewsState === 'loading') return
    setReviewsState('loading')
    setReviewsData(null)
    try {
      const placeId = lead._id ?? lead.id
      const res  = await fetch(`${API}/api/leads/reviews/${placeId}`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erreur serveur')
      setReviewsData(data)
      setReviewsState('done')
      // Le parent chaîne l'analyse IA avec les données fraîches
      onReviewsLoaded(data)
    } catch (e) {
      console.error('Load reviews error:', e)
      setReviewsState('idle')
    }
  }

  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '2.5px', textTransform: 'uppercase', color: '#1D6E55', marginBottom: 10, paddingBottom: 6, borderBottom: '1px solid rgba(29,110,85,0.12)' }}>
        Analyse des Avis
      </div>

      {/* AI done state */}
      {aiState === 'done' && aiReport && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ background: 'rgba(29,110,85,0.12)', border: '1px solid rgba(29,110,85,0.35)', borderRadius: 10, padding: 14, textAlign: 'center' }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#1d6e55', fontFamily: 'var(--font-body)' }}>
              ✅ Analyse terminée — consultez le rapport PDF pour voir les résultats détaillés.
            </span>
          </div>
          <button
            className="ld-btn"
            onClick={onExportPDF}
            disabled={pdfLoading}
            style={{ width: '100%', height: 32, borderRadius: 9, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.04)', color: pdfLoading ? '#475569' : 'rgba(255,255,255,0.48)', fontSize: 12, fontWeight: 500, cursor: pdfLoading ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}
            onMouseEnter={e => { if (!pdfLoading) { e.currentTarget.style.color = 'rgba(255,255,255,0.7)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)' } }}
            onMouseLeave={e => { e.currentTarget.style.color = pdfLoading ? '#475569' : 'rgba(255,255,255,0.48)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)' }}>
            {pdfLoading ? '⏳ Génération en cours…' : '↓ Télécharger le rapport PDF'}
          </button>
        </div>
      )}

      {/* Error message */}
      {aiState === 'error' && aiError && (
        <div style={{ fontSize: 11, color: '#ef4444', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 7, padding: '8px 10px', marginBottom: 8 }}>
          ⚠ {aiError}
          <button onClick={() => setAiState('idle')} style={{ marginLeft: 8, fontSize: 10, color: 'rgba(255,255,255,0.4)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>Réessayer</button>
        </div>
      )}

      {/* Load / analyze button */}
      {aiState !== 'done' && (
        <button
          className="ld-btn"
          onClick={reviewsState === 'done' ? onAnalyzeAI : handleLoadReviews}
          disabled={reviewsState === 'loading' || aiState === 'loading'}
          style={{ width: '100%', height: 40, borderRadius: 10, border: '1px solid rgba(29,110,85,0.25)', background: 'rgba(29,110,85,0.12)', color: reviewsState === 'loading' || aiState === 'loading' ? '#64748b' : '#1d6e55', fontSize: 12, fontWeight: 500, cursor: reviewsState === 'loading' || aiState === 'loading' ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 10 }}>
          {reviewsState === 'loading' && '⏳ Chargement des avis…'}
          {aiState === 'loading' && '✨ Analyse IA en cours…'}
          {reviewsState !== 'loading' && aiState !== 'loading' && (reviewsState === 'done' ? "Analyser avec l'IA — 1 crédit" : 'Charger et analyser 300 avis — 2 crédits')}
        </button>
      )}

      {/* Basic reviews preview (no AI yet) */}
      {aiState !== 'done' && lead.google?.reviews?.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {lead.google.reviews.slice(0, 2).map((review, i) => (
            <div key={i} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 7, padding: '8px 10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                <Stars rating={review.rating} size={10} />
                <span style={{ fontSize: 10.5, color: '#475569' }}>{review.author}</span>
              </div>
              <div style={{ fontSize: 11, color: '#94a3b8', lineHeight: 1.5 }}>
                {review.text?.substring(0, 100)}{(review.text?.length || 0) > 100 ? '…' : ''}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
