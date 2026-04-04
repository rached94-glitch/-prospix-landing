/**
 * exportAuditPDF — Rapport "audit prospect" à envoyer directement au client
 *
 * Page 1 : Couverture — "Audit Digital" + nom business + score
 * Page 2 : Résumé exécutif / Score / Présence digitale / Points d'amélioration / Avis
 * Page 3 : Recommandations + Call-to-action freelancer
 *
 * @param {{ lead, activeProfile, aiReport, auditData }} opts
 */
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'

const DEFAULT_WEIGHTS = { googleRating: 30, reviewVolume: 25, digitalPresence: 25, opportunity: 20 }

// ─── Helpers ─────────────────────────────────────────────────────────────────
function esc(s)  { return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;') }
function pct(val, max) { return max > 0 ? Math.min(Math.round((val / max) * 100), 100) : 0 }
function dash(v) { return (v != null && String(v).trim() !== '') ? esc(v) : '—' }

function badge(found) {
  return found
    ? `<span class="badge badge-green">✓ Présent</span>`
    : `<span class="badge badge-red">✗ Absent</span>`
}

function scoreBar(label, val, max) {
  return `
    <div class="score-bar-container">
      <div class="score-bar-label">${label}</div>
      <div class="score-bar-track"><div class="score-bar-fill" style="width:${pct(val, max)}%"></div></div>
      <div class="score-bar-value">${val} / ${max}</div>
    </div>`
}

function reviewCard(r, label, color) {
  if (!r) return ''
  return `
    <div class="review-card" style="border-color:${color}">
      <div class="review-author">${label} — ${esc(r.author ?? 'Anonyme')} · ${'★'.repeat(r.rating ?? 0)}</div>
      <div class="review-text">${esc((r.text ?? '(Sans texte)').slice(0, 360))}${(r.text ?? '').length > 360 ? '…' : ''}</div>
    </div>`
}

function cleanMarkdown(text) {
  return text
    .replace(/\|[^\n]*\|/g, '')
    .replace(/^[-*]{3,}$/gm, '')
    .replace(/#{1,6}\s+/g, '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/^[-*]\s/gm, '• ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function scoreColor(score) {
  return score >= 70 ? '#1d6e55' : score >= 40 ? '#f97316' : '#ef4444'
}

// ─── Auto-résumé exécutif (quand aiReport absent) ────────────────────────────
function buildAutoSummary({ lead, score }) {
  const rating = lead.google?.rating ?? 0
  const reviews = lead.google?.totalReviews ?? 0
  const hasWebsite = !!lead.website
  const hasSocial = !!(lead.social?.facebook || lead.social?.instagram)
  const ra = lead.reviewAnalysis

  const parts = []

  if (score >= 70) {
    parts.push(`${esc(lead.name)} dispose d'une présence digitale solide avec un score global de ${score}/100.`)
  } else if (score >= 40) {
    parts.push(`${esc(lead.name)} présente un potentiel d'amélioration significatif (score ${score}/100).`)
  } else {
    parts.push(`${esc(lead.name)} accuse un retard digital important qui représente une opportunité concrète (score ${score}/100).`)
  }

  if (rating >= 4.5) {
    parts.push(`Sa réputation en ligne est excellente (${rating}/5 sur ${reviews} avis).`)
  } else if (rating >= 4.0) {
    parts.push(`Sa note Google de ${rating}/5 (${reviews} avis) est bonne mais peut être renforcée.`)
  } else if (rating > 0) {
    parts.push(`La note Google de ${rating}/5 sur ${reviews} avis révèle des axes d'amélioration côté satisfaction client.`)
  }

  if (!hasWebsite) {
    parts.push(`L'absence de site web est le premier frein à sa visibilité en ligne.`)
  } else if (!hasSocial) {
    parts.push(`Malgré un site web, la présence sur les réseaux sociaux reste insuffisante.`)
  }

  if ((ra?.negative?.unanswered ?? 0) > 3) {
    parts.push(`${ra.negative.unanswered} avis négatifs restent sans réponse, ce qui nuit à la confiance des futurs clients.`)
  }

  return parts.join(' ')
}

// ─── Points d'amélioration détectés automatiquement ──────────────────────────
function buildOpportunities({ lead, auditData, profileId }) {
  const items = []
  const ps = auditData?.pagespeed

  if (!lead.website) {
    items.push({ icon: '🌐', label: 'Pas de site web', detail: 'Invisible pour les recherches Google locales', severity: 'critical' })
  } else {
    if (ps?.performance != null && ps.performance < 50) {
      items.push({ icon: '⚡', label: 'Site trop lent', detail: `Performance mobile : ${ps.performance}/100 — les visiteurs quittent avant que la page charge`, severity: 'high' })
    }
    if (ps?.seo != null && ps.seo < 70) {
      items.push({ icon: '🔍', label: 'SEO insuffisant', detail: `Score SEO : ${ps.seo}/100 — votre site n'est pas optimisé pour le référencement local`, severity: 'high' })
    }
    if (ps?.https === false) {
      items.push({ icon: '🔒', label: 'Site non sécurisé (HTTP)', detail: 'Google pénalise les sites sans HTTPS — perte de confiance et de classement', severity: 'high' })
    }
    if (ps?.sitemap === false) {
      items.push({ icon: '🗺️', label: 'Pas de sitemap', detail: 'Google ne peut pas explorer correctement votre site', severity: 'medium' })
    }
  }

  if (!lead.social?.facebook && !lead.social?.instagram) {
    items.push({ icon: '📱', label: 'Absence totale sur les réseaux sociaux', detail: 'Facebook et Instagram sont absents — vos concurrents y sont', severity: 'high' })
  } else if (!lead.social?.instagram) {
    items.push({ icon: '📸', label: 'Pas de compte Instagram', detail: 'Instagram est le réseau prioritaire pour attirer de nouveaux clients locaux', severity: 'medium' })
  }

  const photoCount = lead.googleAudit?.photoCount ?? 0
  if (photoCount < 5) {
    items.push({ icon: '📷', label: `Fiche Google sous-illustrée (${photoCount} photo${photoCount !== 1 ? 's' : ''})`, detail: 'Les fiches avec 10+ photos génèrent 3× plus de clics', severity: 'high' })
  }

  if (!lead.googleAudit?.hasDescription) {
    items.push({ icon: '📝', label: 'Fiche Google sans description', detail: 'Une description complète améliore le référencement local et la confiance', severity: 'medium' })
  }

  const unanswered = lead.reviewAnalysis?.negative?.unanswered ?? 0
  if (unanswered > 0) {
    items.push({ icon: '💬', label: `${unanswered} avis négatif${unanswered > 1 ? 's' : ''} sans réponse`, detail: 'Ne pas répondre aux avis négatifs fait fuir 70% des prospects', severity: unanswered > 5 ? 'critical' : 'medium' })
  }

  if (profileId === 'chatbot' || profileId === 'dev-chatbot') {
    if (!lead.chatbotDetection?.hasChatbot) {
      items.push({ icon: '🤖', label: 'Pas de chatbot sur le site', detail: '80% des demandes simples (horaires, tarifs, disponibilité) peuvent être automatisées', severity: 'high' })
    }
  }

  if (items.length === 0) {
    items.push({ icon: '✅', label: 'Présence digitale globalement correcte', detail: 'Quelques optimisations restent possibles pour se démarquer', severity: 'low' })
  }

  return items
}

// ─── Recommandations par profil ───────────────────────────────────────────────
function buildRecommendations({ profileId, lead, auditData }) {
  const hasWebsite = !!lead.website
  const ps = auditData?.pagespeed
  const rec = []

  const profiles = {
    photographe: [
      { title: 'Enrichir la fiche Google avec des photos professionnelles', detail: 'Vos futurs clients décident en regardant vos photos. Une fiche avec 20+ photos de qualité génère 3× plus de contacts.' },
      { title: 'Créer ou retravailler la présence Instagram', detail: 'Instagram est le premier réseau de découverte pour un commerce local. 3 posts par semaine suffisent pour gagner en visibilité.' },
      { title: 'Mettre en place une stratégie de contenu visuel cohérente', detail: 'Charte graphique, lumière, cadrage — une identité visuelle forte sur tous les canaux construit la confiance.' },
      { title: 'Répondre aux avis Google pour soigner la réputation', detail: 'Répondre aux avis (positifs ET négatifs) montre une entreprise impliquée. Google en tient compte dans le classement local.' },
    ],
    seo: [
      { title: 'Optimiser la fiche Google Business Profile', detail: 'Description complète, catégories précises, horaires à jour, photos régulières — chaque détail compte pour le référencement local.' },
      { title: 'Améliorer la vitesse et le score SEO du site', detail: `Score actuel : ${ps?.performance ?? '—'}/100 en performance, ${ps?.seo ?? '—'}/100 en SEO. Les standards Google exigent 80+ pour bien se positionner.` },
      { title: 'Créer du contenu local ciblé', detail: 'Des pages ou articles ciblant des mots-clés locaux ("coiffeur Lyon 7e", "restaurant bio Bordeaux") multiplient les chances d\'apparaître en tête.' },
      { title: 'Obtenir des avis Google régulièrement', detail: 'Le volume et la fraîcheur des avis est le 2e facteur de classement local après la proximité géographique.' },
    ],
    chatbot: [
      { title: 'Automatiser les réponses aux questions fréquentes', detail: 'Horaires, tarifs, disponibilité, réservation — un chatbot répond 24h/24 et réduit les appels de 40%.' },
      { title: 'Réduire le délai de réponse aux demandes en ligne', detail: 'Un prospect qui n\'obtient pas de réponse en moins de 5 minutes part chez un concurrent. Le chatbot élimine ce délai.' },
      { title: 'Qualifier les leads automatiquement', detail: 'Avant même de décrocher le téléphone, le chatbot collecte le nom, le besoin et les coordonnées du prospect.' },
      { title: 'Améliorer l\'expérience client sur le site', detail: 'Un chat visible dès l\'arrivée sur la page augmente le taux de conversion de 15 à 30%.' },
    ],
    'social-media': [
      { title: 'Définir une stratégie de contenu sur 30 jours', detail: 'Régularité > viralité. 3 posts/semaine avec une thématique claire construisent une audience engagée en 2 mois.' },
      { title: 'Créer une identité visuelle cohérente', detail: 'Couleurs, polices, ton — une charte visuelle simple rend chaque publication immédiatement reconnaissable.' },
      { title: 'Activer la publicité locale sur Facebook/Instagram', detail: 'Un budget de 5€/jour ciblé sur un rayon de 10km autour de votre commerce peut générer 20-50 nouveaux contacts par mois.' },
      { title: 'Interagir avec la communauté locale', detail: 'Commenter, partager, répondre — l\'algorithme favorise les comptes actifs et les algorithmes locaux récompensent l\'engagement.' },
    ],
  }

  const defaults = [
    { title: 'Optimiser votre fiche Google Business Profile', detail: 'Photos, description, horaires, catégories — une fiche complète améliore directement le référencement local et la confiance.' },
    { title: 'Renforcer votre présence sur les réseaux sociaux', detail: 'Facebook et Instagram sont des canaux gratuits pour toucher vos clients locaux. La régularité est la clé.' },
    { title: `${hasWebsite ? 'Améliorer' : 'Créer'} votre site web`, detail: hasWebsite ? 'Vitesse, mobile-first et SEO local sont les 3 piliers d\'un site qui génère des clients.' : 'Un site web est votre vitrine 24h/24. Sans site, vous êtes invisible pour 70% des recherches locales.' },
    { title: 'Solliciter activement des avis Google', detail: 'Demander un avis par email ou SMS après chaque prestation est la méthode la plus efficace pour augmenter votre note.' },
    { title: 'Répondre à tous les avis clients', detail: 'Répondre aux avis (positifs et négatifs) montre un commerce à l\'écoute — Google valorise cet engagement dans le classement.' },
  ]

  const chosen = profiles[profileId] ?? defaults
  return chosen.slice(0, 5)
}

// ─── HTML principal ───────────────────────────────────────────────────────────
function buildAuditHTML({ lead, activeProfile, aiReport, auditData, prospectAudit }) {
  const score      = lead.score?.total ?? 0
  const sColor     = scoreColor(score)
  const breakdown  = lead.score?.breakdown ?? {}
  const w          = activeProfile?.weights
  const weights    = (w && typeof w === 'object' && !Array.isArray(w)) ? w : DEFAULT_WEIGHTS
  const ra         = lead.reviewAnalysis
  const now        = new Date()
  const date       = now.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
  const profileId  = activeProfile?.id ?? 'default'

  const businessName = esc(lead.name ?? 'Business')
  const rating       = lead.google?.rating ?? '—'
  const totalReviews = lead.google?.totalReviews ?? 0

  // Résumé exécutif — priorité : prospectAudit.resume_executif > aiReport > auto
  const execSummary = prospectAudit?.resume_executif
    ? esc(prospectAudit.resume_executif)
    : typeof aiReport?.report === 'string'
      ? (() => {
          const clean = cleanMarkdown(aiReport.report)
          const sentences = clean.split(/[.!?]\s+/).slice(0, 4).join('. ').trim()
          return esc(sentences.length > 20 ? sentences + '.' : buildAutoSummary({ lead, score }))
        })()
      : buildAutoSummary({ lead, score })

  // Données score
  const noteVal     = breakdown.googleRating    ?? 0
  const avisVal     = breakdown.reviewVolume    ?? 0
  const presenceVal = breakdown.digitalPresence ?? 0
  const oppVal      = breakdown.opportunity     ?? 0

  // Avis
  const reviews = lead.google?.reviews ?? []
  const bestR  = ra?.positive?.bestReview  ?? [...reviews].sort((a,b)=>(b.rating??0)-(a.rating??0))[0]
  const worstR = ra?.negative?.worstReview ?? [...reviews].filter(r=>(r.rating??5)<=2).sort((a,b)=>(a.rating??5)-(b.rating??5))[0]

  // Opportunités — priorité : prospectAudit.faiblesses > auto
  const opportunities = prospectAudit?.faiblesses?.length > 0
    ? prospectAudit.faiblesses.map(f => ({ icon: '⚠', label: f.titre, detail: f.description, severity: 'high' }))
    : buildOpportunities({ lead, auditData, profileId })

  // Recommandations — priorité : prospectAudit.recommandations > auto
  const recommendations = prospectAudit?.recommandations?.length > 0
    ? [...prospectAudit.recommandations]
        .sort((a, b) => (a.priorite ?? 99) - (b.priorite ?? 99))
        .slice(0, 5)
        .map(r => ({ title: r.titre, detail: r.description }))
    : buildRecommendations({ profileId, lead, auditData })

  // Sévérité → couleur
  const sevColor = { critical: '#ef4444', high: '#f97316', medium: '#f59e0b', low: '#1d6e55' }

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<title>Audit Digital — ${businessName}</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: 'Segoe UI', system-ui, sans-serif; background:#fff; color:#0f172a; }

  /* ── PAGE 1 COUVERTURE ── */
  .cover {
    width:100%; height:1123px;
    background: linear-gradient(145deg, #0f172a 0%, #0d1410 60%, #0a1a10 100%);
    display:flex; flex-direction:column; justify-content:space-between;
    padding:56px 60px 0 60px;
    position:relative; overflow:hidden;
    page-break-after:always;
  }
  .cover::before {
    content:''; position:absolute; inset:0;
    background: radial-gradient(ellipse 55% 55% at 85% 15%, ${sColor}1a 0%, transparent 65%),
                radial-gradient(ellipse 40% 40% at 10% 80%, #edfa3608 0%, transparent 60%);
    pointer-events:none;
  }
  .cover-logo { font-size:8px; font-weight:700; letter-spacing:3px; text-transform:uppercase; color:rgba(255,255,255,0.35); opacity:0.4; }
  .cover-main { flex:1; display:flex; flex-direction:column; justify-content:center; gap:32px; }
  .cover-eyebrow { font-size:11px; font-weight:700; letter-spacing:5px; text-transform:uppercase; color:#1d6e55; }
  .cover-title { font-size:52px; font-weight:900; color:#ffffff; line-height:1.05; letter-spacing:-1.5px; }
  .cover-business { font-size:28px; font-weight:700; color:#edfa36; line-height:1.2; max-width:500px; letter-spacing:-0.5px; margin-top:-8px; }
  .cover-score-ring {
    width:120px; height:120px; border-radius:50%;
    border:4px solid ${sColor};
    display:flex; align-items:center; justify-content:center; flex-direction:column;
    box-shadow: 0 0 40px ${sColor}44, 0 0 80px ${sColor}18;
    background: ${sColor}0d;
  }
  .cover-score-number { font-size:36px; font-weight:900; color:${sColor}; line-height:1; }
  .cover-score-label  { font-size:9px; color:rgba(255,255,255,0.4); letter-spacing:2px; margin-top:2px; }
  .cover-score-row { display:flex; align-items:center; gap:20px; }
  .cover-score-meta { display:flex; flex-direction:column; gap:6px; }
  .cover-score-meta-item { display:flex; flex-direction:column; gap:2px; }
  .cover-score-meta-label { font-size:8px; color:rgba(255,255,255,0.3); text-transform:uppercase; letter-spacing:2px; }
  .cover-score-meta-value { font-size:14px; color:rgba(255,255,255,0.85); font-weight:700; }
  .cover-footer {
    margin:0 -60px; padding:20px 60px;
    border-top:1px solid rgba(255,255,255,0.06);
    display:flex; justify-content:space-between; align-items:center;
  }
  .cover-freelancer { font-size:12px; color:rgba(255,255,255,0.5); }
  .cover-freelancer strong { color:rgba(255,255,255,0.8); }
  .cover-date { font-size:10px; color:rgba(255,255,255,0.28); }
  .cover-watermark { font-size:7px; color:rgba(255,255,255,0.12); letter-spacing:1px; }

  /* ── PAGE 2 RAPPORT ── */
  .report { padding:48px 52px; page-break-after:always; }
  .section-title {
    font-size:8.5px; font-weight:800; letter-spacing:3.5px; text-transform:uppercase;
    color:#1d6e55; border-bottom:2px solid #1d6e55;
    padding-bottom:7px; margin-bottom:18px; margin-top:32px;
  }
  .section-title:first-child { margin-top:0; }
  .grid-2 { display:grid; grid-template-columns:1fr 1fr; gap:14px; }
  .card { background:#f8fafc; border-radius:10px; padding:16px 18px; border:1px solid #e2e8f0; }
  .card-title { font-size:8.5px; color:#94a3b8; text-transform:uppercase; letter-spacing:2px; font-weight:700; margin-bottom:10px; }
  .exec-box { background:linear-gradient(135deg,#f0fdf4,#f8fafc); border:1px solid #bbf7d0; border-left:3px solid #1d6e55; border-radius:8px; padding:16px 18px; font-size:11.5px; line-height:1.8; color:#1e293b; }
  .score-bar-container { display:flex; align-items:center; gap:10px; margin-bottom:9px; }
  .score-bar-label { font-size:11px; color:#334155; width:110px; flex-shrink:0; }
  .score-bar-track { flex:1; height:7px; background:#e2e8f0; border-radius:4px; overflow:hidden; }
  .score-bar-fill  { height:100%; border-radius:4px; background:linear-gradient(90deg,#1d6e55,#22c55e); }
  .score-bar-value { font-size:11px; font-weight:700; color:#0f172a; width:44px; text-align:right; flex-shrink:0; }
  .badge { display:inline-flex; align-items:center; gap:4px; padding:3px 10px; border-radius:20px; font-size:10px; font-weight:700; }
  .badge-green { background:#dcfce7; color:#16a34a; }
  .badge-red   { background:#fee2e2; color:#dc2626; }
  .stat-row { display:flex; justify-content:space-between; align-items:center; padding:8px 0; border-bottom:1px solid #f1f5f9; }
  .stat-row:last-child { border-bottom:none; }
  .stat-label { font-size:11px; color:#64748b; }
  .stat-value { font-size:12px; font-weight:700; color:#0f172a; text-align:right; max-width:180px; }
  .opp-item { display:flex; gap:12px; align-items:flex-start; padding:10px 14px; border-radius:8px; border:1px solid #e2e8f0; margin-bottom:8px; background:#fafbfc; }
  .opp-icon { font-size:16px; flex-shrink:0; margin-top:1px; }
  .opp-content { flex:1; }
  .opp-label { font-size:11.5px; font-weight:700; color:#0f172a; margin-bottom:2px; }
  .opp-detail { font-size:10px; color:#64748b; line-height:1.5; }
  .opp-sev { display:inline-block; width:8px; height:8px; border-radius:50%; flex-shrink:0; margin-top:5px; }
  .review-card { border-left:3px solid; padding:12px 14px; border-radius:0 8px 8px 0; margin-bottom:10px; background:#f8fafc; }
  .review-author { font-size:11px; font-weight:700; color:#0f172a; margin-bottom:5px; }
  .review-text   { font-size:10.5px; color:#475569; line-height:1.5; font-style:italic; }

  /* ── PAGE 3 RECOMMANDATIONS ── */
  .last-page { padding:40px 52px; }
  .rec-item { padding:13px 16px; border-radius:10px; border:1px solid #e2e8f0; margin-bottom:8px; background:#f8fafc; display:flex; gap:14px; align-items:flex-start; }
  .rec-num { width:24px; height:24px; border-radius:50%; background:#1d6e55; color:#fff; font-size:11px; font-weight:800; display:flex; align-items:center; justify-content:center; flex-shrink:0; margin-top:1px; }
  .rec-content { flex:1; }
  .rec-title { font-size:12px; font-weight:700; color:#0f172a; margin-bottom:3px; }
  .rec-detail { font-size:10.5px; color:#64748b; line-height:1.5; }
  .cta-block {
    background:linear-gradient(135deg, #1d6e55 0%, #166244 100%);
    border-radius:12px; padding:22px 28px; margin-top:16px;
    border:1px solid #1d6e5533;
  }
  .cta-headline { font-size:18px; font-weight:800; color:#fff; margin-bottom:6px; }
  .cta-sub { font-size:11px; color:rgba(255,255,255,0.65); margin-bottom:20px; line-height:1.5; }
  .cta-grid { display:grid; grid-template-columns:1fr 1fr; gap:10px; }
  .cta-item { display:flex; align-items:center; gap:9px; }
  .cta-item-icon { font-size:14px; flex-shrink:0; }
  .cta-item-text { font-size:11px; color:rgba(255,255,255,0.85); font-weight:600; }
  .cta-badge { display:inline-block; background:#edfa36; color:#0d1410; font-size:8px; font-weight:800; letter-spacing:1.5px; text-transform:uppercase; padding:3px 10px; border-radius:4px; margin-bottom:12px; }

  /* ── COMMUN ── */
  .page-footer { font-size:7.5px; color:rgba(0,0,0,0.18); text-align:center; margin-top:32px; letter-spacing:0.5px; }
  .card, .review-card, .score-bar-container, .opp-item, .rec-item, .cta-block,
  .exec-box, .grid-2, p { page-break-inside:avoid; break-inside:avoid; }

  @media print {
    body { -webkit-print-color-adjust:exact; print-color-adjust:exact; }
    @page { size:A4 portrait; margin:0; }
  }
</style>
</head>
<body>

<!-- ═══════ PAGE 1 : COUVERTURE ═══════ -->
<div class="cover">
  <div class="cover-logo">LeadGenPro</div>

  <div class="cover-main">
    <div>
      <div class="cover-title">Audit<br>Digital</div>
      <div class="cover-business" style="margin-top:20px">${businessName}</div>
    </div>

    <div class="cover-score-row">
      <div class="cover-score-ring">
        <div class="cover-score-number">${score}</div>
        <div class="cover-score-label">/ 100</div>
      </div>
      <div class="cover-score-meta">
        <div class="cover-score-meta-item">
          <div class="cover-score-meta-label">Note Google</div>
          <div class="cover-score-meta-value">⭐ ${rating}/5</div>
        </div>
        <div class="cover-score-meta-item">
          <div class="cover-score-meta-label">Avis clients</div>
          <div class="cover-score-meta-value">${totalReviews} avis</div>
        </div>
        <div class="cover-score-meta-item">
          <div class="cover-score-meta-label">Adresse</div>
          <div class="cover-score-meta-value" style="font-size:11px;color:rgba(255,255,255,0.6)">${esc((lead.address ?? '').split(',').slice(0,2).join(','))}</div>
        </div>
      </div>
    </div>
  </div>

  <div class="cover-footer">
    <div class="cover-freelancer">Rapport préparé par <strong>[Votre nom]</strong></div>
    <div class="cover-date">${date}</div>
    <div class="cover-watermark">Généré via LeadGenPro</div>
  </div>
</div>

<!-- ═══════ PAGE 2 : RAPPORT ═══════ -->
<div class="report">

  <div class="section-title">1 · Résumé Exécutif</div>
  <div class="exec-box">${execSummary}</div>

  <div class="section-title">2 · Score de présence digitale</div>
  <div class="card">
    ${scoreBar('Note Google',       Math.min(noteVal,     weights.googleRating),    weights.googleRating)}
    ${scoreBar("Volume d'avis",     Math.min(avisVal,     weights.reviewVolume),    weights.reviewVolume)}
    ${scoreBar('Présence digitale', Math.min(presenceVal, weights.digitalPresence), weights.digitalPresence)}
    ${scoreBar('Opportunité',       Math.min(oppVal,      weights.opportunity),     weights.opportunity)}
    <div style="display:flex;align-items:center;gap:10px;margin-top:10px;padding-top:10px;border-top:2px solid #e2e8f0">
      <div style="font-size:12px;font-weight:700;color:#0f172a;flex:1">Score total</div>
      <div style="flex:2;height:8px;background:#e2e8f0;border-radius:4px;overflow:hidden">
        <div style="width:${score}%;height:100%;background:${sColor};border-radius:4px"></div>
      </div>
      <div style="font-size:16px;font-weight:900;color:${sColor};width:60px;text-align:right">${score}/100</div>
    </div>
  </div>

  <div class="section-title">3 · Présence digitale</div>
  <div class="grid-2">
    <div class="card">
      <div class="card-title">Site &amp; Contact</div>
      <div class="stat-row"><span class="stat-label">Site web</span>${badge(lead.website)}</div>
      <div class="stat-row"><span class="stat-label">Téléphone</span>${badge(lead.phone)}</div>
      <div class="stat-row"><span class="stat-label">Fiche Google</span><span class="badge badge-green">✓ Présente</span></div>
      ${lead.googleAudit?.hasDescription != null ? `<div class="stat-row"><span class="stat-label">Description fiche</span><span class="badge ${lead.googleAudit.hasDescription ? 'badge-green':'badge-red'}">${lead.googleAudit.hasDescription ? '✓ Présente' : '✗ Absente'}</span></div>` : ''}
    </div>
    <div class="card">
      <div class="card-title">Réseaux sociaux</div>
      <div class="stat-row"><span class="stat-label">Facebook</span>${badge(lead.social?.facebook)}</div>
      <div class="stat-row"><span class="stat-label">Instagram</span>${badge(lead.social?.instagram)}</div>
      <div class="stat-row"><span class="stat-label">LinkedIn</span>${badge(lead.social?.linkedin)}</div>
      <div class="stat-row"><span class="stat-label">TikTok</span>${badge(lead.social?.tiktok)}</div>
    </div>
  </div>

  ${prospectAudit?.forces?.length > 0 ? `
  <div class="section-title">4 · Vos atouts</div>
  ${prospectAudit.forces.map(f => `
  <div class="opp-item">
    <div class="opp-sev" style="background:#1d6e55"></div>
    <div class="opp-icon">✓</div>
    <div class="opp-content">
      <div class="opp-label">${esc(f.titre)}</div>
      <div class="opp-detail">${esc(f.description)}</div>
    </div>
  </div>`).join('')}
  <div class="section-title">5 · Points d'amélioration</div>` : `
  <div class="section-title">4 · Points d'amélioration détectés</div>`}
  ${opportunities.map(o => `
  <div class="opp-item">
    <div class="opp-sev" style="background:${sevColor[o.severity] ?? '#94a3b8'}"></div>
    <div class="opp-icon">${esc(o.icon)}</div>
    <div class="opp-content">
      <div class="opp-label">${esc(o.label)}</div>
      <div class="opp-detail">${esc(o.detail)}</div>
    </div>
  </div>`).join('')}

  <div class="section-title">${prospectAudit?.forces?.length > 0 ? '6' : '5'} · Avis clients</div>
  <div class="grid-2" style="margin-bottom:0">
    <div class="card">
      <div class="card-title">Répartition des avis</div>
      <div class="stat-row"><span class="stat-label">Note moyenne</span><span class="stat-value" style="color:#f59e0b">⭐ ${rating}/5</span></div>
      <div class="stat-row"><span class="stat-label">Total avis</span><span class="stat-value">${totalReviews}</span></div>
      ${ra ? `<div class="stat-row"><span class="stat-label">Avis positifs (≥4★)</span><span class="stat-value" style="color:#16a34a">${ra.positiveScore}%</span></div>
      <div class="stat-row"><span class="stat-label">Avis négatifs (≤2★)</span><span class="stat-value" style="color:#dc2626">${ra.negativeScore}%</span></div>` : ''}
      ${(ra?.negative?.unanswered ?? 0) > 0 ? `<div class="stat-row"><span class="stat-label">Sans réponse</span><span class="stat-value" style="color:#dc2626">${ra.negative.unanswered} ignorés</span></div>` : ''}
    </div>
    <div style="display:flex;flex-direction:column;gap:8px">
      ${reviewCard(bestR, '⭐ Meilleur avis', '#1d6e55') || '<div class="card"><div class="stat-label">Aucun avis positif disponible</div></div>'}
    </div>
  </div>
  ${reviewCard(worstR && worstR !== bestR ? worstR : null, '⚠ Avis critique', '#dc2626')}

  <div class="page-footer">Rapport généré via LeadGenPro · ${date}</div>
</div>

<!-- ═══════ PAGE 3 : RECOMMANDATIONS ═══════ -->
<div class="last-page">

  <div class="section-title" style="margin-top:0">${prospectAudit?.forces?.length > 0 ? '6' : '5'} · Recommandations & Plan d'action</div>
  ${recommendations.map((r, i) => `
  <div class="rec-item">
    <div class="rec-num">${i + 1}</div>
    <div class="rec-content">
      <div class="rec-title">${r.title}</div>
      <div class="rec-detail">${r.detail}</div>
    </div>
  </div>`).join('')}

  <div class="cta-block" style="margin-top:16px">
    <div class="cta-badge">Votre partenaire digital</div>
    <div class="cta-headline">Prêt à améliorer votre présence digitale ?</div>
    <div class="cta-sub">Cet audit est offert. La mise en oeuvre, c'est mon métier.<br>Contactez-moi pour discuter de vos priorités sans engagement.</div>
    <div class="cta-grid">
      <div class="cta-item"><div class="cta-item-icon">👤</div><div class="cta-item-text">[Votre nom]</div></div>
      <div class="cta-item"><div class="cta-item-icon">📧</div><div class="cta-item-text">[votre@email.com]</div></div>
      <div class="cta-item"><div class="cta-item-icon">📞</div><div class="cta-item-text">[06 XX XX XX XX]</div></div>
      <div class="cta-item"><div class="cta-item-icon">🌐</div><div class="cta-item-text">[votre-site.com]</div></div>
    </div>
  </div>

  <div class="page-footer">Rapport généré via LeadGenPro · ${date}</div>
</div>

</body>
</html>`
}

// ─── Export function (même pipeline que exportLeadPDF) ────────────────────────
export async function exportAuditPDF({ lead, activeProfile, aiReport, auditData, prospectAudit = null }) {
  const container = document.createElement('div')
  container.style.cssText = `
    position: fixed;
    top: -9999px;
    left: -9999px;
    width: 794px;
    background: white;
    font-family: -apple-system, 'Segoe UI', sans-serif;
    font-size: 12px;
    color: #1a1a1a;
    box-sizing: border-box;
  `
  container.innerHTML = buildAuditHTML({ lead, activeProfile, aiReport, auditData, prospectAudit })
  document.body.appendChild(container)

  const PAGE_PX = Math.round(297 * 794 / 210) // ≈ 1123px par page A4 à 794px de large

  try {
    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      width: 794,
      windowWidth: 794,
    })

    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

    const pageWidthMm  = 210
    const pageHeightMm = 297
    const imgWidthMm   = pageWidthMm
    const pxPerMm      = canvas.width / imgWidthMm
    const pageHeightPx = Math.round(pageHeightMm * pxPerMm)
    const imgHeightMm  = (canvas.height * imgWidthMm) / canvas.width
    const totalPages   = Math.ceil(imgHeightMm / pageHeightMm)

    let firstPage = true
    for (let i = 0; i < totalPages; i++) {
      const srcY = i * pageHeightPx
      const srcH = Math.min(pageHeightPx, canvas.height - srcY)
      if (srcH < pageHeightPx * 0.10) continue

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

    const fileName = `Audit-${(lead.name ?? 'prospect').replace(/[^a-zA-Z0-9]/g, '-')}-${new Date().toISOString().slice(0, 10)}.pdf`
    pdf.save(fileName)

  } finally {
    document.body.removeChild(container)
  }
}
