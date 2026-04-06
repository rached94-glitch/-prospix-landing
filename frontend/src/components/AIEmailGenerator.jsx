import { useState, useEffect } from 'react'

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001'

/**
 * AIEmailGenerator — génère et affiche un email IA de prospection
 *
 * Props:
 *   lead              — objet lead complet
 *   activeProfile     — profil scoring actif
 *   aiReport          — rapport IA (nécessaire pour générer l'email)
 *   aiEmail           — { subject, body } | null  — géré dans le parent
 *   onEmailGenerated  — (data) => void  — remonte aiEmail vers le parent
 *   visualAnalysis    — null | object
 *   visualError       — string | null
 *   auditState        — 'idle' | 'loading' | 'done' | 'error'
 *   auditData         — null | object
 *   reviewsData       — null | object
 *   photoQuality      — null | object
 */
export default function AIEmailGenerator({
  lead,
  activeProfile,
  aiReport,
  aiEmail,
  onEmailGenerated,
  visualAnalysis,
  visualError,
  auditState,
  auditData,
  reviewsData,
  photoQuality,
}) {
  const [aiEmailState, setAiEmailState] = useState('idle') // 'idle' | 'loading' | 'done' | 'error'
  const [copiedEmail,  setCopiedEmail]  = useState(false)

  // Reset sur changement de lead (géré par key={leadId} dans le parent)
  useEffect(() => {
    setAiEmailState('idle')
    setCopiedEmail(false)
  }, [lead?.id, lead?._id])

  const handleGenerateAIEmail = async () => {
    if (aiEmailState === 'loading' || !aiReport) return
    setAiEmailState('loading')
    try {
      const res = await fetch(`${API}/api/leads/generate-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessName:   lead.name,
          profileId:      activeProfile?.id   ?? 'chatbot',
          profileName:    activeProfile?.name ?? 'Défaut',
          aiAnalysis:     aiReport,
          leadData: {
            rating:       lead.google?.rating,
            totalReviews: lead.google?.totalReviews,
            reviewCount:  lead.google?.totalReviews,
            website:      lead.website,
            social:       lead.social,
            address:      lead.address,
          },
          visualAnalysis:    visualAnalysis ?? null,
          googleData: {
            photoCount:   lead.googleAudit?.photoCount ?? 0,
            hasInstagram: !!(lead.social?.instagram),
          },
          // pagespeedData contient siteSignals.bookingPlatform, hasFAQ, cms, etc.
          pagespeedData:     auditData?.pagespeed         ?? null,
          localRank:         auditData?.localRank         ?? null,
          siteAnalysis:      auditData?.siteAnalysis      ?? null,
          reviewsData:       reviewsData                  ?? null,
          facebookActivity:  auditData?.facebookActivity  ?? null,
          instagramActivity: auditData?.instagramActivity ?? null,
          photoQuality:      photoQuality                  ?? null,
          socialPresence:    lead.social                  ?? null,
          decisionMaker:     lead.decisionMaker            ?? null,
          city:              lead.city ?? lead.vicinity    ?? null,
          category:          lead.keyword ?? lead.domain ?? lead.types?.[0] ?? null,
          napData:           auditData?.napData            ?? null,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erreur serveur')
      onEmailGenerated(data)
      setAiEmailState('done')
    } catch (e) {
      console.error('Generate email error:', e)
      setAiEmailState('error')
    }
  }

  const VISUAL_PROFILES = ['photographe', 'designer', 'copywriter']
  const AUDIT_PROFILES  = ['seo', 'consultant-seo', 'dev-web', 'pub-google', 'social-media', 'videaste']
  const pid = activeProfile?.id
  const visualBlocked = VISUAL_PROFILES.includes(pid) && !!visualError && (visualError.includes('bloque') || visualError.includes('indisponible') || visualError.includes('ne permet pas'))
  const step2Done = VISUAL_PROFILES.includes(pid)
    ? visualAnalysis !== null || visualBlocked
    : AUDIT_PROFILES.includes(pid) ? auditState === 'done' : null
  const hasStep2 = step2Done !== null
  const emailReady = aiReport && (!hasStep2 || step2Done)
  const emailDisabled = aiEmailState === 'loading' || !emailReady
  let emailLabel = '✦ Générer email IA — 1 crédit'
  if (aiEmailState === 'loading') emailLabel = '✨ Génération en cours…'
  else if (!aiReport) emailLabel = "✦ Générer l'email — analysez d'abord les avis"
  else if (hasStep2 && !step2Done) emailLabel = '✦ Générer l\'email — analysez d\'abord le site'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>

      {/* Generate email button */}
      <>
        <button
          className="ld-btn"
          onClick={emailReady ? handleGenerateAIEmail : undefined}
          disabled={emailDisabled}
          style={{ width: '100%', height: 48, borderRadius: 14, border: emailDisabled ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(255,255,255,0.28)', background: emailDisabled ? 'rgba(255,255,255,0.03)' : 'linear-gradient(to bottom, rgba(29,110,85,0.92), rgba(29,110,85,0.72))', color: emailDisabled ? '#475569' : '#edfa36', fontSize: 13, fontWeight: 700, cursor: emailDisabled ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, boxShadow: !emailDisabled ? '0px 6px 20px rgba(29,110,85,0.55)' : 'none', position: 'relative', overflow: 'hidden', transition: 'all 0.15s' }}>
          {!emailDisabled && <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 20, background: 'linear-gradient(to bottom, rgba(255,255,255,0.2), transparent)', borderRadius: '14px 14px 0 0', pointerEvents: 'none' }} />}
          {emailLabel}
        </button>
        {visualBlocked && (
          <div style={{ fontSize: 10, color: '#475569', textAlign: 'center', marginTop: 5, lineHeight: 1.4 }}>
            Analyse visuelle indisponible — email généré sans données visuelles du site
          </div>
        )}
      </>

      {/* Generated email display */}
      {aiEmailState === 'done' && aiEmail && (
        <div style={{ background: 'rgba(29,110,85,0.06)', border: '1px solid rgba(29,110,85,0.20)', borderRadius: 10, padding: '13px 14px' }}>
          <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase', color: '#1D6E55', marginBottom: 9 }}>Email généré</div>
          {aiEmail.subject && (
            <div style={{ fontSize: 11.5, fontWeight: 600, color: '#f1f5f9', marginBottom: 7, lineHeight: 1.4 }}>Objet : {aiEmail.subject}</div>
          )}
          <div style={{ fontSize: 11, color: '#94a3b8', lineHeight: 1.65, maxHeight: 180, overflowY: 'auto', whiteSpace: 'pre-wrap', marginBottom: 9, scrollbarWidth: 'thin', scrollbarColor: '#2d3748 transparent' }}>
            {aiEmail.body}
          </div>
          <button className="ld-btn" onClick={() => { navigator.clipboard.writeText(`${aiEmail.subject}\n\n${aiEmail.body}`); setCopiedEmail(true); setTimeout(() => setCopiedEmail(false), 2000) }} style={{ width: '100%', height: 30, borderRadius: 6, border: '1px solid rgba(29,110,85,0.25)', background: 'transparent', color: copiedEmail ? '#22c55e' : '#EDFA36', fontSize: 11, cursor: 'pointer', fontWeight: 600 }}>
            {copiedEmail ? '✓ Copié !' : '📋 Copier'}
          </button>
        </div>
      )}
      {aiEmailState === 'error' && (
        <div style={{ fontSize: 11, color: '#f87171', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 7, padding: '8px 10px' }}>
          ✗ Erreur lors de la génération — vérifiez la console ou réessayez.
          <button onClick={() => setAiEmailState('idle')} style={{ marginLeft: 8, fontSize: 10, color: 'rgba(255,255,255,0.4)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>Réessayer</button>
        </div>
      )}

    </div>
  )
}
