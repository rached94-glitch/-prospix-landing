import { useState, useEffect, useRef } from 'react'

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001'

/**
 * AIEmailGenerator — génère, affiche et permet d'éditer un email IA de prospection
 *
 * Props:
 *   lead              — objet lead complet
 *   activeProfile     — profil scoring actif
 *   aiReport          — rapport IA (nécessaire pour générer l'email)
 *   aiEmail           — { subject, body } | null  — géré dans le parent
 *   onEmailGenerated  — (data) => void  — remonte aiEmail vers le parent
 *   onReformulated    — () => void      — notifie le parent après reformulation IA
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
  onReformulated,
  visualAnalysis,
  visualError,
  auditState,
  auditData,
  reviewsData,
  photoQuality,
}) {
  const [aiEmailState,      setAiEmailState]      = useState('idle') // 'idle' | 'loading' | 'done' | 'error'
  const [emailSubject,      setEmailSubject]       = useState('')
  const [emailBody,         setEmailBody]          = useState('')
  const [isEdited,          setIsEdited]           = useState(false)
  const [copiedEmail,       setCopiedEmail]        = useState(false)
  const [reformulateState,  setReformulateState]   = useState('idle') // 'idle' | 'loading' | 'done' | 'error'
  const [reformulateBadge,  setReformulateBadge]   = useState(false)
  const textareaRef = useRef(null)

  // Reset sur changement de lead (géré par key={leadId} dans le parent)
  useEffect(() => {
    setAiEmailState('idle')
    setCopiedEmail(false)
    setEmailSubject('')
    setEmailBody('')
    setIsEdited(false)
    setReformulateBadge(false)
    setReformulateState('idle')
  }, [lead?.id, lead?._id])

  // Sync local editable state quand aiEmail change
  useEffect(() => {
    if (aiEmail) {
      setEmailSubject(aiEmail.subject || '')
      setEmailBody(aiEmail.body || '')
      setIsEdited(false)
      setReformulateBadge(false)
    }
  }, [aiEmail])

  // Auto-ajustement hauteur du textarea
  const adjustTextareaHeight = () => {
    const ta = textareaRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = Math.max(200, ta.scrollHeight) + 'px'
  }

  useEffect(() => {
    if (aiEmail) adjustTextareaHeight()
  }, [emailBody, aiEmail])

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

  const handleReformulate = async () => {
    if (reformulateState === 'loading') return
    setReformulateState('loading')
    try {
      const res = await fetch(`${API}/api/leads/reformulate-email`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ subject: emailSubject, body: emailBody, profileId: activeProfile?.id ?? 'seo' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erreur serveur')
      setEmailSubject(data.subject || emailSubject)
      setEmailBody(data.body    || emailBody)
      setIsEdited(false)
      setReformulateBadge(true)
      setReformulateState('done')
      if (onReformulated) onReformulated()
    } catch (e) {
      console.error('[ReformulateEmail] error:', e)
      setReformulateState('error')
      setTimeout(() => setReformulateState('idle'), 3000)
    }
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(`${emailSubject}\n\n${emailBody}`)
    setCopiedEmail(true)
    setTimeout(() => setCopiedEmail(false), 2000)
  }

  const handleMailto = () => {
    const mailto = `mailto:?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`
    window.location.href = mailto
  }

  const handleRevert = () => {
    if (!aiEmail) return
    setEmailSubject(aiEmail.subject || '')
    setEmailBody(aiEmail.body    || '')
    setIsEdited(false)
    setReformulateBadge(false)
    setReformulateState('idle')
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

      {/* ── Bouton de génération ── */}
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

      {/* ── Email éditable ── */}
      {aiEmailState === 'done' && (emailSubject || emailBody) && (
        <div style={{ background: 'rgba(29,110,85,0.06)', border: '1px solid rgba(29,110,85,0.20)', borderRadius: 10, padding: '13px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>

          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase', color: '#1D6E55' }}>
              Email généré
            </div>
            {reformulateBadge && (
              <div style={{ fontSize: 9, color: '#4ade80', background: 'rgba(74,222,128,0.12)', border: '1px solid rgba(74,222,128,0.25)', borderRadius: 4, padding: '2px 7px', letterSpacing: '0.5px' }}>
                ✓ Reformulé par l'IA
              </div>
            )}
          </div>

          {/* Objet éditable */}
          <div>
            <div style={{ fontSize: 9, color: '#475569', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: 4 }}>Objet</div>
            <input
              type="text"
              value={emailSubject}
              onChange={e => { setEmailSubject(e.target.value); setIsEdited(true) }}
              style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(29,110,85,0.25)', borderRadius: 6, padding: '7px 10px', fontSize: 12, fontWeight: 600, color: '#f1f5f9', outline: 'none', boxSizing: 'border-box', fontFamily: 'var(--font-body)' }}
            />
          </div>

          {/* Corps éditable */}
          <div>
            <div style={{ fontSize: 9, color: '#475569', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: 4 }}>Corps</div>
            <textarea
              ref={textareaRef}
              value={emailBody}
              onChange={e => { setEmailBody(e.target.value); setIsEdited(true); adjustTextareaHeight() }}
              style={{ width: '100%', minHeight: 200, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(29,110,85,0.25)', borderRadius: 6, padding: '8px 10px', fontSize: 11.5, color: '#F5F5F0', lineHeight: 1.65, resize: 'none', outline: 'none', boxSizing: 'border-box', fontFamily: 'var(--font-body)', overflowY: 'hidden' }}
              spellCheck={true}
            />
          </div>

          {/* Boutons d'action */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>

            {/* Reformuler */}
            <button
              className="ld-btn"
              onClick={handleReformulate}
              disabled={reformulateState === 'loading'}
              style={{ width: '100%', height: 34, borderRadius: 9, border: reformulateState === 'loading' ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(237,250,54,0.3)', background: reformulateState === 'loading' ? 'rgba(255,255,255,0.03)' : 'rgba(237,250,54,0.1)', color: reformulateState === 'loading' ? '#475569' : '#edfa36', fontSize: 12, fontWeight: 600, cursor: reformulateState === 'loading' ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              {reformulateState === 'loading' ? '✨ Reformulation en cours…' : '✨ Reformuler avec l\'IA — 1 crédit'}
            </button>
            {reformulateState === 'error' && (
              <div style={{ fontSize: 10.5, color: '#f87171', textAlign: 'center' }}>Erreur lors de la reformulation — réessayez</div>
            )}

            {/* Copier + Mailto sur la même ligne */}
            <div style={{ display: 'flex', gap: 5 }}>
              <button
                className="ld-btn"
                onClick={handleCopy}
                style={{ flex: 1, height: 30, borderRadius: 6, border: '1px solid rgba(29,110,85,0.25)', background: 'transparent', color: copiedEmail ? '#22c55e' : '#EDFA36', fontSize: 11, cursor: 'pointer', fontWeight: 600 }}>
                {copiedEmail ? '✓ Copié !' : '📋 Copier'}
              </button>
              <button
                className="ld-btn"
                onClick={handleMailto}
                style={{ flex: 1, height: 30, borderRadius: 6, border: '1px solid rgba(255,255,255,0.08)', background: 'transparent', color: 'rgba(255,255,255,0.45)', fontSize: 11, cursor: 'pointer', fontWeight: 500 }}>
                📧 Ouvrir dans mailto
              </button>
            </div>

            {/* Revenir à l'original — visible seulement si édité */}
            {isEdited && (
              <button
                className="ld-btn"
                onClick={handleRevert}
                style={{ width: '100%', height: 26, borderRadius: 6, border: 'none', background: 'transparent', color: '#475569', fontSize: 10.5, cursor: 'pointer', fontWeight: 400 }}>
                ↩ Revenir à l'original
              </button>
            )}
          </div>

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
