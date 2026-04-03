/**
 * exportLeadPDF — Génère un PDF via jsPDF + html2canvas
 *
 * Page 1 : Couverture (dark, score en anneau, méta)
 * Page 2 : Rapport détaillé (identité, score, Google, avis, mots-clés)
 * Page 3 : Analyse IA + Email de prospection
 *
 * @param {{ lead, activeProfile, aiReport, aiEmail, pappersData, auditData }} opts
 */
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'

const DEFAULT_WEIGHTS = { googleRating: 30, reviewVolume: 25, digitalPresence: 25, opportunity: 20 }

function buildReportHTML({ lead, activeProfile, aiReport, aiEmail, pappersData, auditData }) {

  // ── Extraction des données ─────────────────────────────────────────────────
  const score      = lead.score?.total ?? 0
  const scoreColor = score >= 70 ? '#22c55e' : score >= 40 ? '#f59e0b' : '#ef4444'
  const breakdown  = lead.score?.breakdown ?? {}

  // ── Weights : use active profile weights (same as panel) ───────────────────
  const w = activeProfile?.weights
  const weights = (w && typeof w === 'object' && !Array.isArray(w)) ? w : DEFAULT_WEIGHTS

  // ── Diagnostic log ─────────────────────────────────────────────────────────
  console.log('[PDF] score total        :', score)
  console.log('[PDF] lead.score.total   :', lead.score?.total ?? 'absent')
  console.log('[PDF] profil actif       :', activeProfile?.id ?? 'défaut')
  console.log('[PDF] weights utilisés   :', weights)
  console.log('[PDF] breakdown          :', breakdown)
  const ra         = lead.reviewAnalysis
  const now        = new Date()
  const date       = now.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
  const profileId   = activeProfile?.id   ?? null
  const profileName = activeProfile?.name ?? 'Défaut'

  // ── Helpers ────────────────────────────────────────────────────────────────
  const esc  = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
  const pct  = (val, max) => max > 0 ? Math.min(Math.round((val / max) * 100), 100) : 0
  const dash = (v) => (v != null && String(v).trim() !== '') ? esc(v) : '—'
  const badge = (found) => found
    ? `<span class="badge badge-green">✓ Trouvé</span>`
    : `<span class="badge badge-red">✗ Absent</span>`

  // ── Champs lead ────────────────────────────────────────────────────────────
  const businessName    = esc(lead.name ?? 'Lead')
  const businessAddress = esc(lead.address ?? '')
  const phone    = dash(lead.phone)
  const sector   = esc(lead.keyword ?? lead.domain ?? 'Local')
  const status   = lead.google?.openNow === true  ? '🟢 Ouvert'
                 : lead.google?.openNow === false ? '🔴 Fermé' : '—'
  const websiteRaw  = lead.website
  const websiteDisp = websiteRaw
    ? `<a href="${esc(websiteRaw)}" style="color:#6366f1;text-decoration:none">${esc(websiteRaw.replace(/^https?:\/\//, '').slice(0, 45))}</a>`
    : '<span style="color:#dc2626;font-weight:600">Absent</span>'

  const facebook  = lead.social?.facebook
  const instagram = lead.social?.instagram
  const linkedin  = lead.social?.linkedin
  const tiktok    = lead.social?.tiktok

  // ── Barres de score ────────────────────────────────────────────────────────
  const noteVal     = breakdown.googleRating    ?? 0
  const avisVal     = breakdown.reviewVolume    ?? 0
  const presenceVal = breakdown.digitalPresence ?? 0
  const oppVal      = breakdown.opportunity     ?? 0
  const finVal      = breakdown.financialCapacity ?? null

  const scoreBar = (label, val, max) => `
    <div class="score-bar-container">
      <div class="score-bar-label">${label}</div>
      <div class="score-bar-track"><div class="score-bar-fill" style="width:${pct(val, max)}%"></div></div>
      <div class="score-bar-value">${val} / ${max}</div>
    </div>`

  // ── Données Google ─────────────────────────────────────────────────────────
  const rating          = lead.google?.rating ?? '—'
  const totalRatings    = lead.google?.totalReviews ?? 0
  const positivePercent = ra?.positiveScore ?? 0
  const negativePercent = ra?.negativeScore ?? 0

  // ── Audit digital ──────────────────────────────────────────────────────────
  const ps          = auditData?.pagespeed
  const performance = ps?.performance != null ? ps.performance : '—'
  const seoScore    = ps?.seo != null ? ps.seo : '—'
  const loadTime    = ps?.loadTime ?? '—'
  const photoCount  = lead.googleAudit?.photoCount ?? 0
  const cmsName     = ps?.cms?.cms ?? null
  const domainAge   = ps?.domainAge?.ageLabel ?? null
  const httpsOk     = ps?.https ?? null
  const sitemapOk   = ps?.sitemap ?? null
  const rankData    = auditData?.localRank ?? null
  const pdfNapData  = (auditData?.napData != null) ? auditData.napData : null

  // ── Avis représentatifs ────────────────────────────────────────────────────
  const reviews = lead.google?.reviews ?? []
  const bestR  = ra?.positive?.bestReview
    ?? [...reviews].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))[0]
  const worstR = ra?.negative?.worstReview
    ?? [...reviews].filter(r => (r.rating ?? 5) <= 2).sort((a, b) => (a.rating ?? 5) - (b.rating ?? 5))[0]

  const reviewCard = (r, label, color) => !r ? '' : `
    <div class="review-card" style="border-color:${color}">
      <div class="review-author">${label} — ${esc(r.author ?? 'Anonyme')} · ${'★'.repeat(r.rating ?? 0)}</div>
      <div class="review-text">${esc((r.text ?? '(Sans texte)').slice(0, 380))}${(r.text ?? '').length > 380 ? '…' : ''}</div>
    </div>`

  // ── Mots-clés ──────────────────────────────────────────────────────────────
  const posKw = (ra?.positive?.keywords ?? []).slice(0, 10)
  const negKw = (ra?.negative?.keywords ?? []).slice(0, 10)

  // ── Nettoyage markdown résiduel ────────────────────────────────────────────
  function cleanMarkdown(text) {
    return text
      .replace(/\|[^\n]*\|/g, '')          // supprimer les tableaux
      .replace(/^[-*]{3,}$/gm, '')          // supprimer --- ou ***
      .replace(/#{1,6}\s+/g, '')            // supprimer les # titres
      .replace(/\*\*(.*?)\*\*/g, '$1')      // supprimer le **gras**
      .replace(/\*(.*?)\*/g, '$1')          // supprimer le *italique*
      .replace(/^[-*]\s/gm, '• ')           // remplacer - ou * par •
      .replace(/\n{3,}/g, '\n\n')           // max 2 sauts de ligne
      .trim()
  }

  // ── Analyse IA → HTML propre ───────────────────────────────────────────────
  const aiText = typeof aiReport?.report === 'string'
    ? (() => {
        const clean = cleanMarkdown(aiReport.report)
        return clean
          .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
          .replace(/^([A-ZÀÂÉÈÊËÏÎÔÙÛÜ\s]{4,})\s*:/gm, '<div style="font-size:9px;font-weight:800;letter-spacing:2px;color:#6366f1;text-transform:uppercase;margin:14px 0 5px;padding-bottom:3px;border-bottom:1px solid #e0e7ff">$1</div>')
          .replace(/^•\s(.+)$/gm, '<div style="padding:2px 0 2px 12px;border-left:2px solid #e0e7ff;margin:3px 0;font-size:11px">$1</div>')
          .replace(/\n/g, '<br>')
      })()
    : null

  // ── Email généré ───────────────────────────────────────────────────────────
  const emailSubject = aiEmail?.subject ?? null
  const emailBody    = aiEmail?.body
    ? esc(cleanMarkdown(aiEmail.body)).replace(/\n/g, '<br>')
    : null

  // ── Pappers ────────────────────────────────────────────────────────────────
  const finRow = (label, val) => val != null ? `
    <div class="stat-row">
      <span class="stat-label">${label}</span>
      <span class="stat-value">${esc(String(val))}</span>
    </div>` : ''

  // ══════════════════════════════════════════════════════════════════════════
  // HTML COMPLET
  // ══════════════════════════════════════════════════════════════════════════
  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<title>Rapport — ${businessName}</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: 'Segoe UI', system-ui, sans-serif; background:#fff; color:#0f172a; }

  /* ── PAGE 1 COUVERTURE ── */
  .cover {
    width:100%; height:1123px;
    background: linear-gradient(135deg, #0f0f1a 0%, #1e1b4b 50%, #0f172a 100%);
    display:flex; flex-direction:column; justify-content:space-between;
    padding:60px; page-break-after:always;
    position:relative; overflow:hidden;
  }
  .cover::before {
    content:''; position:absolute; inset:0;
    background: radial-gradient(ellipse 60% 60% at 80% 20%, ${scoreColor}18 0%, transparent 70%);
    pointer-events:none;
  }
  .cover-logo { color:#6366f1; font-size:13px; font-weight:800; letter-spacing:4px; text-transform:uppercase; }
  .cover-main { flex:1; display:flex; flex-direction:column; justify-content:center; gap:28px; padding-top:20px; }
  .cover-score-ring {
    width:128px; height:128px; border-radius:50%;
    border:5px solid ${scoreColor};
    display:flex; align-items:center; justify-content:center; flex-direction:column;
    box-shadow: 0 0 48px ${scoreColor}44, 0 0 96px ${scoreColor}18;
    background: ${scoreColor}0a;
  }
  .cover-score-number { font-size:38px; font-weight:900; color:${scoreColor}; line-height:1; }
  .cover-score-label  { font-size:10px; color:#94a3b8; letter-spacing:3px; margin-top:2px; }
  .cover-name     { font-size:38px; font-weight:900; color:#ffffff; line-height:1.1; max-width:460px; }
  .cover-subtitle { font-size:15px; color:#64748b; font-weight:400; letter-spacing:0.5px; }
  .cover-meta     { display:flex; gap:36px; flex-wrap:wrap; }
  .cover-meta-item { display:flex; flex-direction:column; gap:5px; }
  .cover-meta-label { font-size:9px; color:#475569; text-transform:uppercase; letter-spacing:2.5px; }
  .cover-meta-value { font-size:13px; color:#e2e8f0; font-weight:600; }
  .cover-footer {
    background:#6366f1; margin:-60px; margin-top:0; padding:18px 60px;
    color:#fff; font-size:11px; display:flex; justify-content:space-between; align-items:center;
    position:relative; z-index:1;
  }

  /* ── PAGE 2 RAPPORT ── */
  .report { padding:44px 50px; page-break-after:always; }
  .section-title {
    font-size:9px; font-weight:800; letter-spacing:3.5px; text-transform:uppercase;
    color:#6366f1; border-bottom:2px solid #6366f1;
    padding-bottom:7px; margin-bottom:18px; margin-top:30px;
  }
  .section-title:first-child { margin-top:0; }
  .grid-2 { display:grid; grid-template-columns:1fr 1fr; gap:16px; }
  .card { background:#f8fafc; border-radius:10px; padding:16px 18px; border:1px solid #e2e8f0; }
  .card-title { font-size:9px; color:#94a3b8; text-transform:uppercase; letter-spacing:2px; font-weight:700; margin-bottom:10px; }
  .score-bar-container { display:flex; align-items:center; gap:10px; margin-bottom:9px; }
  .score-bar-label { font-size:11px; color:#334155; width:110px; flex-shrink:0; }
  .score-bar-track { flex:1; height:7px; background:#e2e8f0; border-radius:4px; overflow:hidden; }
  .score-bar-fill  { height:100%; border-radius:4px; background:linear-gradient(90deg, #6366f1, #8b5cf6); }
  .score-bar-value { font-size:11px; font-weight:700; color:#0f172a; width:44px; text-align:right; flex-shrink:0; }
  .badge { display:inline-flex; align-items:center; gap:4px; padding:3px 10px; border-radius:20px; font-size:10px; font-weight:700; }
  .badge-green { background:#dcfce7; color:#16a34a; }
  .badge-red   { background:#fee2e2; color:#dc2626; }
  .badge-gray  { background:#f1f5f9; color:#64748b; }
  .stat-row { display:flex; justify-content:space-between; align-items:center; padding:8px 0; border-bottom:1px solid #f1f5f9; }
  .stat-row:last-child { border-bottom:none; }
  .stat-label { font-size:11px; color:#64748b; }
  .stat-value { font-size:12px; font-weight:700; color:#0f172a; text-align:right; max-width:180px; }
  .review-card { border-left:3px solid; padding:12px 14px; border-radius:0 8px 8px 0; margin-bottom:10px; background:#f8fafc; }
  .review-author { font-size:11px; font-weight:700; color:#0f172a; margin-bottom:5px; }
  .review-text   { font-size:10.5px; color:#475569; line-height:1.5; font-style:italic; }
  .keyword { display:inline-block; padding:3px 9px; border-radius:12px; font-size:9.5px; font-weight:600; margin:2px 3px 2px 0; }
  .keyword-pos { background:#dcfce7; color:#15803d; }
  .keyword-neg { background:#fee2e2; color:#b91c1c; }
  .kw-none { font-size:10px; color:#94a3b8; font-style:italic; }

  /* ── PAGE 3 EMAIL + ANALYSE ── */
  .last-page { padding:44px 50px; }
  .ai-box { background:#faf5ff; border:1px solid #ddd6fe; border-radius:10px; padding:16px 18px; font-size:11px; line-height:1.7; color:#1e1b2e; }
  .email-container { border:2px solid #e2e8f0; border-radius:10px; overflow:hidden; }
  .email-header  { background:#6366f1; padding:14px 22px; }
  .email-subject { color:#fff; font-size:13px; font-weight:700; }
  .email-body    { padding:22px; font-size:12px; line-height:1.8; color:#334155; }
  .email-footer-bar { background:#f8fafc; padding:10px 22px; font-size:9px; color:#94a3b8; border-top:1px solid #e2e8f0; letter-spacing:0.5px; }

  /* ── PAGINATION — évite les coupures au milieu des blocs ── */
  .card, .review-card, .score-bar-container, .ai-box, .email-container,
  .grid-2, blockquote, p {
    page-break-inside: avoid;
    break-inside: avoid;
  }
  #email-section {
    page-break-before: always;
    break-before: page;
  }

  @media print {
    body { -webkit-print-color-adjust:exact; print-color-adjust:exact; }
    .cover { height:100vh; min-height:100vh; }
    @page { size:A4 portrait; margin:0; }
  }
</style>
</head>
<body>

<!-- ═══════════════ PAGE 1 : COUVERTURE ═══════════════ -->
<div class="cover">
  <div class="cover-logo">⚡ LeadGen Pro</div>

  <div class="cover-main">
    <div class="cover-score-ring">
      <div class="cover-score-number">${score}</div>
      <div class="cover-score-label">/ 100</div>
    </div>
    <div class="cover-name">${businessName}</div>
    <div class="cover-subtitle">Rapport de prospection digitale</div>
    <div class="cover-meta">
      <div class="cover-meta-item">
        <div class="cover-meta-label">Profil analysé</div>
        <div class="cover-meta-value">${esc(profileName)}</div>
      </div>
      <div class="cover-meta-item">
        <div class="cover-meta-label">Date</div>
        <div class="cover-meta-value">${date}</div>
      </div>
      <div class="cover-meta-item">
        <div class="cover-meta-label">Secteur</div>
        <div class="cover-meta-value">${sector}</div>
      </div>
      <div class="cover-meta-item">
        <div class="cover-meta-label">Note Google</div>
        <div class="cover-meta-value">⭐ ${rating}/5</div>
      </div>
    </div>
  </div>

  <div class="cover-footer">
    <span>LeadGen Pro — Rapport confidentiel</span>
    <span>${businessAddress}</span>
    <span style="color:rgba(255,255,255,0.6)">${date}</span>
  </div>
</div>

<!-- ═══════════════ PAGE 2 : RAPPORT ═══════════════ -->
<div class="report">

  <div class="section-title">1 · Identité &amp; Contact</div>
  <div class="grid-2">
    <div class="card">
      <div class="card-title">Coordonnées</div>
      <div class="stat-row"><span class="stat-label">📞 Téléphone</span><span class="stat-value">${phone}</span></div>
      <div class="stat-row"><span class="stat-label">🌐 Site web</span><span class="stat-value">${websiteDisp}</span></div>
      <div class="stat-row"><span class="stat-label">📍 Adresse</span><span class="stat-value" style="font-size:10px">${esc(lead.address ?? '—')}</span></div>
      <div class="stat-row"><span class="stat-label">🕐 Statut</span><span class="stat-value">${status}</span></div>
      ${lead.distance != null ? `<div class="stat-row"><span class="stat-label">📏 Distance</span><span class="stat-value">${lead.distance.toFixed(1)} km</span></div>` : ''}
    </div>
    <div class="card">
      <div class="card-title">Présence digitale</div>
      <div class="stat-row"><span class="stat-label">Facebook</span>${badge(facebook)}</div>
      ${profileId !== 'seo' ? `<div class="stat-row"><span class="stat-label">Instagram</span>${badge(instagram)}</div>` : ''}
      <div class="stat-row"><span class="stat-label">LinkedIn</span>${badge(linkedin)}</div>
      ${profileId !== 'seo' ? `<div class="stat-row"><span class="stat-label">TikTok</span>${badge(tiktok)}</div>` : ''}
      ${lead.chatbotDetection && !['photographe', 'seo', 'consultant-seo'].includes(profileId) ? `<div class="stat-row"><span class="stat-label">Chatbot</span><span class="badge ${lead.chatbotDetection.hasChatbot ? 'badge-red' : 'badge-green'}">${lead.chatbotDetection.hasChatbot ? '⚠ Présent' : '✓ Absent'}</span></div>` : ''}
    </div>
  </div>

  <div class="section-title">2 · Score Détaillé</div>
  <div class="card">
    ${scoreBar('Note Google',       noteVal,     weights.googleRating    ?? 30)}
    ${scoreBar("Volume d'avis",    avisVal,     weights.reviewVolume    ?? 25)}
    ${scoreBar('Présence digitale', presenceVal, weights.digitalPresence ?? 25)}
    ${scoreBar('Opportunité',       oppVal,      weights.opportunity     ?? 20)}
    ${finVal != null && (profileId !== 'photographe' || finVal > 0) ? scoreBar('Cap. financière', finVal, 30) : ''}
    <div style="display:flex;align-items:center;gap:10px;margin-top:10px;padding-top:10px;border-top:2px solid #e2e8f0">
      <div style="font-size:12px;font-weight:700;color:#0f172a;flex:1">Score total</div>
      <div style="flex:2;height:8px;background:#e2e8f0;border-radius:4px;overflow:hidden">
        <div style="width:${score}%;height:100%;background:${scoreColor};border-radius:4px"></div>
      </div>
      <div style="font-size:16px;font-weight:900;color:${scoreColor};width:60px;text-align:right">${score}/100</div>
    </div>
  </div>

  <div class="section-title">3 · Données Google &amp; Audit Digital</div>
  <div class="grid-2">
    <div class="card">
      <div class="card-title">Avis clients</div>
      <div class="stat-row"><span class="stat-label">Note moyenne</span><span class="stat-value" style="color:#f59e0b">⭐ ${rating}/5</span></div>
      <div class="stat-row"><span class="stat-label">Total avis</span><span class="stat-value">${totalRatings}</span></div>
      <div class="stat-row"><span class="stat-label">Avis positifs (≥4★)</span><span class="stat-value" style="color:#16a34a">${positivePercent}%</span></div>
      <div class="stat-row"><span class="stat-label">Avis négatifs (≤2★)</span><span class="stat-value" style="color:#dc2626">${negativePercent}%</span></div>
      ${(ra?.negative?.unanswered ?? 0) > 0 ? `<div class="stat-row"><span class="stat-label">Sans réponse</span><span class="stat-value" style="color:#dc2626">${ra.negative.unanswered} ignorés</span></div>` : ''}
    </div>
    ${profileId !== 'photographe' ? `<div class="card">
      <div class="card-title">Audit digital</div>
      <div class="stat-row"><span class="stat-label">Perf. mobile</span><span class="stat-value" style="color:${typeof performance === 'number' && performance >= 80 ? '#16a34a' : typeof performance === 'number' && performance >= 50 ? '#f59e0b' : '#dc2626'}">${performance}${typeof performance === 'number' ? '/100' : ''}</span></div>
      <div class="stat-row"><span class="stat-label">Score SEO</span><span class="stat-value">${seoScore}${typeof seoScore === 'number' ? '/100' : ''}</span></div>
      <div class="stat-row"><span class="stat-label">Chargement</span><span class="stat-value">${loadTime}</span></div>
      ${profileId !== 'seo' ? `<div class="stat-row"><span class="stat-label">Photos fiche Google</span><span class="stat-value">${photoCount} photo${photoCount !== 1 ? 's' : ''}</span></div>` : ''}
      <div class="stat-row"><span class="stat-label">Description fiche</span><span class="badge ${lead.googleAudit?.hasDescription ? 'badge-green' : 'badge-red'}">${lead.googleAudit?.hasDescription ? '✓ Présente' : '✗ Absente'}</span></div>
      ${rankData != null ? `<div class="stat-row"><span class="stat-label">Position locale</span><span class="stat-value" style="color:${rankData.found ? (rankData.topThree ? '#16a34a' : '#f59e0b') : '#dc2626'}">${rankData.found ? (rankData.topThree ? `Top 3 (pos. ${rankData.rank})` : rankData.topTen ? `Top 10 (pos. ${rankData.rank})` : `Pos. ${rankData.rank}`) : 'Hors top 20'}</span></div>` : ''}
      ${cmsName != null ? `<div class="stat-row"><span class="stat-label">CMS détecté</span><span class="stat-value">${esc(cmsName === 'inconnu' ? 'Non identifié' : cmsName)}</span></div>` : ''}
      ${domainAge != null ? `<div class="stat-row"><span class="stat-label">Âge du domaine</span><span class="stat-value">${esc(domainAge)}</span></div>` : ''}
      ${httpsOk != null ? `<div class="stat-row"><span class="stat-label">HTTPS</span><span class="badge ${httpsOk ? 'badge-green' : 'badge-red'}">${httpsOk ? '✓ Actif' : '✗ Absent'}</span></div>` : ''}
      ${sitemapOk != null ? `<div class="stat-row"><span class="stat-label">Sitemap</span><span class="badge ${sitemapOk ? 'badge-green' : 'badge-red'}">${sitemapOk ? '✓ Présent' : '✗ Absent'}</span></div>` : ''}
      ${pdfNapData != null ? `<div class="stat-row"><span class="stat-label">Cohérence NAP</span><span class="badge" style="${pdfNapData.napScore === 'consistent' ? 'background:#dcfce7;color:#16a34a' : pdfNapData.napScore === 'inconsistent' ? 'background:#fef3c7;color:#d97706' : 'background:#fee2e2;color:#dc2626'}">${pdfNapData.napScore === 'consistent' ? '✓ Cohérent' : pdfNapData.napScore === 'inconsistent' ? '⚠ Incohérent' : '✗ Absent'}</span></div>` : ''}
    </div>` : ''}
  </div>

  <div class="section-title">4 · Avis Représentatifs</div>
  ${reviewCard(bestR,  '⭐ Meilleur avis', '#16a34a')}
  ${reviewCard(worstR !== bestR ? worstR : null, '⚠ Avis critique', '#dc2626')}
  ${!bestR && !worstR ? '<div style="font-size:10px;color:#94a3b8;font-style:italic;padding:12px;background:#f9fafb;border-radius:8px;border:1px dashed #e5e7eb">Aucun avis disponible pour ce lead.</div>' : ''}

  <div class="section-title">5 · Mots-clés Détectés</div>
  <div style="margin-bottom:8px">
    ${posKw.length > 0 ? posKw.map(k => `<span class="keyword keyword-pos">${esc(k)}</span>`).join('') : '<span class="kw-none">Aucun mot-clé positif détecté</span>'}
  </div>
  <div>
    ${negKw.length > 0 ? negKw.map(k => `<span class="keyword keyword-neg">${esc(k)}</span>`).join('') : '<span class="kw-none">Aucun mot-clé négatif détecté</span>'}
  </div>

  ${pappersData ? `
  <div class="section-title">6 · Données Financières</div>
  <div class="card">
    <div class="grid-2">
      ${finRow('Dirigeant',         pappersData.dirigeant)}
      ${finRow('Forme juridique',   pappersData.formeJuridique)}
      ${pappersData.chiffreAffaires != null ? finRow("Chiffre d'affaires", `${(pappersData.chiffreAffaires / 1000).toFixed(0)} k€`) : ''}
      ${pappersData.resultatNet     != null ? finRow('Résultat net',        `${(pappersData.resultatNet    / 1000).toFixed(0)} k€`) : ''}
      ${finRow('Effectifs',   pappersData.effectifs  != null ? `${pappersData.effectifs} pers.`               : null)}
      ${finRow('Ancienneté',  pappersData.anciennete != null ? `${pappersData.anciennete} an${pappersData.anciennete > 1 ? 's' : ''}` : null)}
      ${finRow('SIRET',       pappersData.siret)}
    </div>
  </div>` : ''}

</div>

<!-- ═══════════════ PAGE 3 : ANALYSE IA + EMAIL ═══════════════ -->
<div class="last-page">

  ${aiText ? `
  <div class="section-title" style="margin-top:0">${ pappersData ? '7' : '6' } · Rapport Analyse IA</div>
  <div class="ai-box" style="margin-bottom:28px">${aiText}</div>
  ` : `
  <div class="section-title" style="margin-top:0">${pappersData ? '7' : '6'} · Rapport Analyse IA</div>
  <div style="font-size:10px;color:#94a3b8;font-style:italic;padding:14px;background:#f9fafb;border-radius:8px;border:1px dashed #e5e7eb;margin-bottom:28px">
    Analyse IA non générée pour ce lead.<br>
    Dans LeadGen Pro : chargez les avis puis cliquez « Analyser avec IA ».
  </div>`}

  ${emailSubject && emailBody ? `
  <div id="email-section">
  <div class="section-title">${pappersData ? (aiText ? '8' : '7') : (aiText ? '7' : '6')} · Email de Prospection</div>
  <div class="email-container">
    <div class="email-header">
      <div class="email-subject">📧 ${esc(emailSubject)}</div>
    </div>
    <div class="email-body">${emailBody}</div>
    <div class="email-footer-bar">Généré par LeadGen Pro · ${date} · Profil ${esc(profileName)}</div>
  </div>
  </div>
  ` : ''}

</div>

<script>window.onload = () => { window.print(); }</script>
</body>
</html>`

  return html
}

export async function exportLeadPDF({ lead, activeProfile, aiReport, aiEmail, pappersData, auditData }) {
  // 1. Créer un div temporaire invisible avec le HTML du rapport
  const container = document.createElement('div')
  container.style.cssText = `
    position: fixed;
    top: -9999px;
    left: -9999px;
    width: 794px;
    background: white;
    font-family: -apple-system, Inter, sans-serif;
    font-size: 12px;
    color: #1a1a1a;
    padding: 40px;
    box-sizing: border-box;
  `

  container.innerHTML = buildReportHTML({ lead, activeProfile, aiReport, aiEmail, pappersData, auditData })
  document.body.appendChild(container)

  // Remove bottom padding — prevents a trailing near-blank page from container padding
  container.style.paddingBottom = '0'

  // Force email section onto a clean page if it starts near the bottom of a page
  const PAGE_PX = Math.round(297 * 794 / 210)  // ≈ 1123px per A4 page at 794px width
  const emailEl = container.querySelector('#email-section')
  if (emailEl) {
    const posOnPage = emailEl.offsetTop % PAGE_PX
    const remaining = PAGE_PX - posOnPage
    if (posOnPage > 0 && remaining < 200) {
      emailEl.style.paddingTop = `${remaining}px`
    }
  }

  try {
    // 2. Capturer en canvas
    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      width: 794,
      windowWidth: 794,
    })

    // 3. Créer le PDF A4
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    })

    const pageWidthMm  = 210
    const pageHeightMm = 297
    const imgWidthMm   = pageWidthMm
    const imgHeightMm  = (canvas.height * imgWidthMm) / canvas.width
    const pxPerMm      = canvas.width / imgWidthMm     // px/mm dans l'espace canvas
    const pageHeightPx = Math.round(pageHeightMm * pxPerMm)
    const totalPages   = Math.ceil(imgHeightMm / pageHeightMm)

    // 4. Découper le canvas en tranches A4 et ajouter chaque tranche sur sa propre page
    let firstPage = true
    for (let i = 0; i < totalPages; i++) {
      const srcY    = i * pageHeightPx
      const srcH    = Math.min(pageHeightPx, canvas.height - srcY)
      if (srcH < pageHeightPx * 0.10) continue  // skip near-blank trailing page

      if (!firstPage) pdf.addPage()
      firstPage = false
      const slice   = document.createElement('canvas')
      slice.width   = canvas.width
      slice.height  = pageHeightPx
      const ctx     = slice.getContext('2d')
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, slice.width, slice.height)
      ctx.drawImage(canvas, 0, srcY, canvas.width, srcH, 0, 0, canvas.width, srcH)

      pdf.addImage(slice.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, imgWidthMm, pageHeightMm)
    }

    // 5. Télécharger directement
    const fileName = `LeadGen-${(lead.name ?? 'lead').replace(/[^a-zA-Z0-9]/g, '-')}-${new Date().toISOString().slice(0, 10)}.pdf`
    pdf.save(fileName)

  } finally {
    document.body.removeChild(container)
  }
}
