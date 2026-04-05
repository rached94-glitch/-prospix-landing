import { useState } from 'react'
import { exportAuditPDF, exportAuditPhotographePDF, exportAuditChatbotPDF, exportAuditSocialMediaPDF, exportAuditDesignerPDF, exportAuditWebDevPDF, exportAuditEmailMarketingPDF, exportAuditGoogleAdsPDF } from '../utils/exportAuditPDF'

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001'

const AUDIT_LABEL = {
  'seo':             "Générer l'audit SEO — 2 crédits",
  'consultant-seo':  "Générer l'audit SEO — 2 crédits",
  'photographe':     "Générer l'audit photo — 2 crédits",
  'chatbot':         "Générer l'audit chatbot — 2 crédits",
  'dev-chatbot':     "Générer l'audit chatbot — 2 crédits",
  'social-media':    "Générer l'audit Community Manager — 2 crédits",
  'designer':        "Générer l'audit branding — 2 crédits",
  'dev-web':         "Générer l'audit technique — 2 crédits",
  'email-marketing': "Générer l'audit email marketing — 2 crédits",
  'pub-google':      "Générer l'audit Google Ads — 2 crédits",
  'copywriter':      "Générer l'audit contenu — 2 crédits",
}

/**
 * AuditPanel — génère et exporte l'audit IA prospect en PDF
 *
 * Props (données read-only depuis le parent) :
 *   lead          — objet lead complet
 *   activeProfile — profil scoring actif
 *   activeWeights — poids de scoring dérivés du profil
 *   aiReport      — rapport IA (utilisé dans l'export SEO par défaut)
 *   auditData     — données PageSpeed + social
 *   reviewsData   — avis chargés via Apify
 *   semrushData   — données SEMrush (profil pub-google)
 *   visualAnalysis — analyse visuelle IA (profil dev-web)
 */
export default function AuditPanel({
  lead,
  activeProfile,
  activeWeights,
  aiReport,
  auditData,
  reviewsData,
  semrushData,
  visualAnalysis,
}) {
  const [auditPdfLoading,    setAuditPdfLoading]    = useState(false)
  const [auditPdfError,      setAuditPdfError]      = useState(null)
  const [prospectAuditState, setProspectAuditState] = useState('idle') // 'idle' | 'loading' | 'done' | 'error'
  const [prospectAudit,      setProspectAudit]      = useState(null)

  const handleExportAuditPDF = async () => {
    if (auditPdfLoading || prospectAuditState === 'loading') return
    // TODO: Supabase — déduire 2 crédits avant l'appel
    setAuditPdfLoading(true)
    setAuditPdfError(null)
    setProspectAuditState('loading')
    try {
      const placeId   = lead.id || lead._id || 'unknown'
      const profileId = activeProfile?.id ?? 'seo'
      const leadCity  = lead.address?.split(',').pop()?.trim() || ''
      const social    = lead.social ?? null
      const pappersData = lead.pappers ?? null

      // ── Signaux enrichis (email-marketing + autres profils) ─────────────────
      const loyaltyAnalysis    = reviewsData?.loyaltyAnalysis ?? lead.loyaltyAnalysis ?? null
      const loyaltyMentions    = loyaltyAnalysis?.loyaltyMentions ?? 0
      const loyaltyTopics      = loyaltyAnalysis?.loyaltyTopics   ?? []
      const totalReviewsFull   = reviewsData?.total      ?? null
      const unansweredCount    = reviewsData?.unanswered ?? null
      const ownerReplyRatioFull = (totalReviewsFull != null && totalReviewsFull > 0 && unansweredCount != null)
        ? (totalReviewsFull - unansweredCount) / totalReviewsFull
        : null
      const catRaw = [(lead.keyword || lead.domain || ''), ...(lead.types || [])].join(' ')
        .toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      const _FREQ_HIGH = ['restaurant', 'cafe', 'boulangerie', 'bakery', 'pharmacie', 'supermarche', 'epicerie', 'tabac', 'pressing', 'gym', 'sport', 'fitness', 'brasserie', 'pizz', 'burger', 'traiteur', 'bistrot']
      const _FREQ_LOW  = ['avocat', 'notaire', 'comptable', 'assurance', 'immo', 'architecte', 'dentiste', 'orthodontiste', 'psy', 'psychiatre', 'psychologue']
      const visitFrequency = _FREQ_HIGH.some(k => catRaw.includes(k)) ? 'Haute'
                           : _FREQ_LOW.some(k  => catRaw.includes(k)) ? 'Faible'
                           : 'Modérée'
      let stabScore = !!(lead.googleAudit?.hasHours) ? 2 : 0
      if (pappersData) {
        const ca  = pappersData.chiffreAffaires ?? null
        const dc  = pappersData.dateCreation    ?? null
        const eff = pappersData.effectifs       ?? null
        if (dc) { const y = (Date.now() - new Date(dc).getTime()) / (365.25 * 24 * 3600 * 1000); stabScore += y >= 5 ? 3 : y >= 2 ? 2 : y >= 1 ? 1 : 0 }
        if (ca !== null) stabScore += ca >= 200000 ? 3 : ca >= 50000 ? 2 : 1
        if (eff !== null && eff >= 1) stabScore += 1
      }
      const businessStability = stabScore >= 6 ? 'haute' : stabScore >= 3 ? 'moyenne' : 'faible'
      const canInvest         = stabScore >= 5 && (pappersData?.chiffreAffaires ?? 0) >= 50000
      const _aiReportStr      = typeof aiReport === 'string' ? aiReport : (aiReport?.report ?? '')
      const aiReportSummary   = _aiReportStr ? _aiReportStr.slice(0, 600) : null

      // Step 1 — generate AI audit via backend (fat payload)
      const r = await fetch(`${API}/api/leads/audit-prospect/${placeId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profileId,
          // SEO / générique
          leadData: {
            name:        lead.name        ?? '',
            address:     lead.address     ?? '',
            city:        leadCity,
            category:    lead.keyword     ?? lead.domain ?? '',
            website:     lead.website     ?? null,
            rating:      lead.google?.rating       ?? null,
            reviewCount: lead.google?.totalReviews  ?? null,
            googleAudit: lead.googleAudit ?? null,
          },
          pagespeedData:    auditData?.pagespeed         ?? null,
          localRank:        auditData?.localRank         ?? null,
          reviewsData:      reviewsData                  ?? null,
          napData:          auditData?.napData           ?? null,
          facebookActivity: auditData?.facebookActivity  ?? null,
          instagramActivity:auditData?.instagramActivity ?? null,
          // Champs communs
          businessName:  lead.name    ?? '',
          websiteUrl:    lead.website ?? null,
          googleRating:  lead.google?.rating        ?? null,
          totalReviews:  lead.google?.totalReviews  ?? 0,
          domain:        lead.domain ?? lead.keyword ?? null,
          city:          leadCity,
          photoCount:    lead.googleAudit?.photoCount ?? 0,
          socialPresence: social,
          // Photographe
          googlePhotos:  [],
          social:        social ?? {},
          // Chatbot
          chatbotDetection:     lead.chatbotDetection ?? null,
          questionsAnalysis:    reviewsData?.questionAnalysis ?? lead.reviewAnalysis?.questionAnalysis ?? null,
          domainComplexity:     lead.domainComplexity ?? null,
          faqDetection:         auditData?.pagespeed?.hasFAQ         ?? null,
          contactFormDetection: auditData?.pagespeed?.hasContactForm  ?? null,
          // Social / Community Manager
          socialMediaActivity: {
            instagramActivity: auditData?.instagramActivity ?? null,
            facebookActivity:  auditData?.facebookActivity  ?? null,
          },
          instagramDeep: auditData?.instagramDeep ?? null,
          // Designer
          googleAudit:   lead.googleAudit ?? null,
          // Web Dev
          cms:           auditData?.pagespeed?.cms?.cms ?? null,
          hasHttps:      auditData?.pagespeed?.https    ?? null,
          hasSitemap:    auditData?.pagespeed?.sitemap  ?? null,
          hasRobots:     auditData?.pagespeed?.robots   ?? null,
          domainAge:     auditData?.pagespeed?.domainAge    ?? null,
          indexedPages:  auditData?.pagespeed?.indexedPages ?? null,
          // Email Marketing
          ownerReplyRatio:     lead.ownerReplyRatio ?? null,
          hasNewsletter:       social?.newsletterDetection?.hasNewsletter ?? auditData?.pagespeed?.siteSignals?.hasNewsletter ?? null,
          hasContactForm:      auditData?.pagespeed?.siteSignals?.hasContactForm ?? social?.contactFormDetection?.hasContactForm ?? null,
          loyaltyMentions, loyaltyTopics,
          unansweredCount, totalReviewsFull,
          ownerReplyRatioFull: ownerReplyRatioFull ?? lead.ownerReplyRatio ?? null,
          visitFrequency, businessStability, canInvest,
          aiReport: aiReportSummary,
          // Google Ads
          hasDescription: lead.googleAudit?.hasDescription ?? false,
          hasHours:       lead.googleAudit?.hasHours       ?? false,
          semrushData:    semrushData ?? null,
        }),
      })
      if (!r.ok) {
        const err = await r.json().catch(() => ({}))
        throw new Error(err.error ?? `Erreur serveur ${r.status}`)
      }
      const prospectAuditResult = await r.json()
      setProspectAudit(prospectAuditResult)
      setProspectAuditState('done')

      // Step 2 — generate PDF with AI content, dispatch by profile
      switch (profileId) {
        case 'photographe':
          await exportAuditPhotographePDF({ lead, activeProfile, photoAudit: prospectAuditResult, auditData })
          break
        case 'chatbot':
        case 'dev-chatbot':
          await exportAuditChatbotPDF({ lead, activeProfile, chatbotAudit: prospectAuditResult, reviewsData, auditData })
          break
        case 'social-media':
          await exportAuditSocialMediaPDF({ lead, activeProfile, socialAudit: prospectAuditResult, auditData, city: leadCity })
          break
        case 'designer':
          await exportAuditDesignerPDF({ lead, activeProfile, designerAudit: prospectAuditResult, auditData })
          break
        case 'dev-web':
          await exportAuditWebDevPDF({ lead, activeProfile, webDevAudit: prospectAuditResult, auditData, visualAnalysis })
          break
        case 'email-marketing':
          await exportAuditEmailMarketingPDF({ lead, activeProfile, emailAudit: prospectAuditResult, auditData, reviewsData, visitFrequency, businessStability, canInvest, loyaltyTopics, aiReportSummary })
          break
        case 'pub-google':
          await exportAuditGoogleAdsPDF({ lead, activeProfile, googleAdsAudit: prospectAuditResult, auditData })
          break
        default:
          await exportAuditPDF({ lead, activeProfile, activeWeights, aiReport, auditData, prospectAudit: prospectAuditResult })
          break
      }
    } catch (err) {
      console.error('[AuditPDF]', err)
      setProspectAuditState('error')
      setAuditPdfError(err.message ?? 'Erreur inconnue')
    } finally {
      setAuditPdfLoading(false)
    }
  }

  return (
    <>
      <button
        className="ld-btn"
        onClick={handleExportAuditPDF}
        disabled={auditPdfLoading || prospectAuditState === 'loading'}
        style={{ width: '100%', height: 32, borderRadius: 10, border: '1px solid rgba(237,250,54,0.3)', background: 'rgba(237,250,54,0.15)', color: (auditPdfLoading || prospectAuditState === 'loading') ? '#475569' : '#edfa36', fontSize: 12, fontWeight: 600, cursor: (auditPdfLoading || prospectAuditState === 'loading') ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}
        onMouseEnter={e => { if (!auditPdfLoading && prospectAuditState !== 'loading') { e.currentTarget.style.background = 'rgba(237,250,54,0.22)'; e.currentTarget.style.borderColor = 'rgba(237,250,54,0.5)' } }}
        onMouseLeave={e => { e.currentTarget.style.background = 'rgba(237,250,54,0.15)'; e.currentTarget.style.borderColor = 'rgba(237,250,54,0.3)' }}>
        {prospectAuditState === 'loading' ? '⏳ Génération de l\'audit…' : auditPdfLoading ? '⏳ Mise en page PDF…' : prospectAuditState === 'done' ? '✅ Audit téléchargé' : (AUDIT_LABEL[activeProfile?.id] ?? "Générer l'audit prospect — 2 crédits")}
      </button>
      {auditPdfError && (
        <div style={{ fontSize: 11, color: '#f87171', textAlign: 'center', marginTop: 5, lineHeight: 1.4, padding: '4px 8px', background: 'rgba(239,68,68,0.08)', borderRadius: 6, border: '1px solid rgba(239,68,68,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>✗ {auditPdfError}</span>
          <button onClick={() => { setProspectAuditState('idle'); setAuditPdfError(null) }} style={{ fontSize: 10, color: '#EDFA36', background: 'none', border: '1px solid rgba(29,110,85,0.25)', borderRadius: 5, padding: '2px 8px', cursor: 'pointer', marginLeft: 8 }}>Réessayer</button>
        </div>
      )}
      {prospectAuditState === 'done' && (
        <button onClick={() => { setProspectAuditState('idle'); setProspectAudit(null) }} style={{ width: '100%', marginTop: 4, fontSize: 10, color: '#64748b', background: 'none', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 6, padding: '4px 0', cursor: 'pointer' }}>
          ↺ Regénérer l'audit
        </button>
      )}
    </>
  )
}
