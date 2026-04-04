import { useState } from 'react'

export default function LeadDetailActions({
  lead, activeProfile, auditState, handleAnalyzePerformance,
  pappersState, handleLoadPappers, pappersData,
  aiEmailState, aiEmail, copiedEmail, setCopiedEmail, handleGenerateAIEmail,
  visualError, visualAnalysis, aiReport,
  pdfLoading, handleExportPDF,
  auditPdfLoading, handleExportAuditPDF, prospectAuditState, auditPdfError,
}) {
  return (
    <>
      {/* ── DONNÉES FINANCIÈRES ── */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '2.5px', textTransform: 'uppercase', color: '#1D6E55', marginBottom: 10, paddingBottom: 6, borderBottom: '1px solid rgba(29,110,85,0.12)' }}>
          Données Financières
        </div>
        {pappersState === 'idle' && (
          <button className="ld-btn" onClick={handleLoadPappers} style={{ width: '100%', height: 40, borderRadius: 10, border: '1px solid rgba(29,110,85,0.25)', background: 'rgba(29,110,85,0.12)', color: '#1d6e55', fontSize: 12, fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            Charger les données Pappers — 1 crédit
          </button>
        )}
        {pappersState === 'loading' && (
          <div style={{ height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: '#64748b' }}>Chargement Pappers…</div>
        )}
        {pappersState === 'not_found' && (
          <div style={{ fontSize: 11, color: '#475569', textAlign: 'center', padding: '8px 0' }}>Aucune donnée Pappers trouvée.</div>
        )}
        {pappersState === 'done' && pappersData && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {[
              { label: "Chiffre d'affaires", value: pappersData.chiffreAffaires != null ? (typeof pappersData.chiffreAffaires === 'number' ? pappersData.chiffreAffaires.toLocaleString('fr-FR') + ' €' : pappersData.chiffreAffaires) : null },
              { label: 'Effectif',            value: pappersData.effectif },
              { label: 'Forme juridique',     value: pappersData.formeJuridique },
              { label: 'Créée le',            value: pappersData.dateCreation },
            ].filter(r => r.value).map((row, i) => (
              <div key={i} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, padding: '9px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 10.5, color: '#64748b' }}>{row.label}</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#f1f5f9', fontFamily: 'var(--font-mono)' }}>{row.value}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Perf audit on-demand — profils non spécialisés */}
      {!['seo', 'consultant-seo', 'dev-web', 'pub-google', 'photographe', 'chatbot', 'dev-chatbot'].includes(activeProfile?.id) && auditState === 'idle' && (lead.website || lead.social?.facebook || lead.social?.instagram) && (
        <div style={{ marginBottom: 20 }}>
          <button className="ld-btn" onClick={handleAnalyzePerformance} style={{ width: '100%', height: 40, borderRadius: 10, border: '1px solid rgba(29,110,85,0.25)', background: 'rgba(29,110,85,0.12)', color: '#1d6e55', fontSize: 12, fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            Analyser les performances digitales — 1 crédit
          </button>
        </div>
      )}
      {!['seo', 'consultant-seo', 'dev-web', 'pub-google', 'photographe'].includes(activeProfile?.id) && auditState === 'loading' && (
        <div style={{ marginBottom: 20, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: '#64748b' }}>Audit en cours…</div>
      )}

      {/* ── EMAIL IA ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>

        {/* Generated email display */}
        {aiEmailState === 'done' && aiEmail && (
          <div style={{ background: 'rgba(29,110,85,0.06)', border: '1px solid rgba(29,110,85,0.20)', borderRadius: 10, padding: '13px 14px', marginBottom: 2 }}>
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

        {/* Generate email button */}
        {(() => {
          const VISUAL_PROFILES = ['photographe', 'designer', 'copywriter']
          const AUDIT_PROFILES  = ['seo', 'consultant-seo', 'dev-web', 'pub-google', 'chatbot', 'dev-chatbot']
          const pid = activeProfile?.id
          const visualBlocked = VISUAL_PROFILES.includes(pid) && !!visualError && (visualError.includes('bloque') || visualError.includes('indisponible') || visualError.includes('ne permet pas'))
          const step2Done = VISUAL_PROFILES.includes(pid)
            ? visualAnalysis !== null || visualBlocked
            : AUDIT_PROFILES.includes(pid) ? auditState === 'done' : null
          const hasStep2 = step2Done !== null
          const emailReady = aiReport && (!hasStep2 || step2Done)
          const emailDisabled = aiEmailState === 'loading' || !emailReady
          let emailLabel = '✦ Générer email IA'
          if (aiEmailState === 'loading') emailLabel = '✨ Génération en cours…'
          else if (!aiReport) emailLabel = '✦ Générer l\'email — analysez d\'abord les avis'
          else if (hasStep2 && !step2Done) emailLabel = '✦ Générer l\'email — analysez d\'abord le site'
          return (
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
          )
        })()}

        {/* Export PDF */}
        <button
          className="ld-btn"
          onClick={handleExportPDF}
          disabled={pdfLoading}
          style={{ width: '100%', height: 32, borderRadius: 9, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.04)', color: pdfLoading ? '#475569' : 'rgba(255,255,255,0.48)', fontSize: 12, fontWeight: 500, cursor: pdfLoading ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}
          onMouseEnter={e => { if (!pdfLoading) { e.currentTarget.style.color = 'rgba(255,255,255,0.7)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)' } }}
          onMouseLeave={e => { e.currentTarget.style.color = pdfLoading ? '#475569' : 'rgba(255,255,255,0.48)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)' }}>
          {pdfLoading ? '⏳ Génération en cours…' : '↓ Exporter fiche PDF'}
        </button>

        {/* Audit prospect PDF */}
        <button
          className="ld-btn"
          onClick={handleExportAuditPDF}
          disabled={auditPdfLoading}
          style={{ width: '100%', height: 32, borderRadius: 10, border: '1px solid rgba(237,250,54,0.3)', background: 'rgba(237,250,54,0.15)', color: auditPdfLoading ? '#475569' : '#edfa36', fontSize: 12, fontWeight: 600, cursor: auditPdfLoading ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}
          onMouseEnter={e => { if (!auditPdfLoading) { e.currentTarget.style.background = 'rgba(237,250,54,0.22)'; e.currentTarget.style.borderColor = 'rgba(237,250,54,0.5)' } }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(237,250,54,0.15)'; e.currentTarget.style.borderColor = 'rgba(237,250,54,0.3)' }}>
          {prospectAuditState === 'loading' ? '⏳ Génération de l\'audit…' : auditPdfLoading ? '⏳ Mise en page PDF…' : '↓ Générer l\'audit prospect'}
        </button>
        {auditPdfError && (
          <div style={{ fontSize: 11, color: '#f87171', textAlign: 'center', marginTop: 5, lineHeight: 1.4, padding: '4px 8px', background: 'rgba(239,68,68,0.08)', borderRadius: 6, border: '1px solid rgba(239,68,68,0.2)' }}>
            ✗ {auditPdfError}
          </div>
        )}
      </div>
    </>
  )
}
