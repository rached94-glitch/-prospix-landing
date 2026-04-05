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
function buildAuditHTML({ lead, activeProfile, activeWeights, aiReport, auditData, prospectAudit }) {
  const score      = lead.score?.total ?? 0
  const sColor     = scoreColor(score)
  const breakdown  = lead.score?.breakdown ?? {}
  // activeWeights passed directly from LeadDetail (same source as the score panel) — fallback to activeProfile.weights then DEFAULT_WEIGHTS
  const weights    = (activeWeights && typeof activeWeights === 'object' && !Array.isArray(activeWeights))
    ? activeWeights
    : ((activeProfile?.weights && typeof activeProfile.weights === 'object' && !Array.isArray(activeProfile.weights)) ? activeProfile.weights : DEFAULT_WEIGHTS)
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

  // Nouveaux champs audit enrichis
  const comparaison  = prospectAudit?.comparaison_concurrents ?? null
  const timeline     = prospectAudit?.timeline ?? null
  const titreAudit   = esc(prospectAudit?.titre_audit ?? 'Audit Digital')

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
  .report { padding:48px 52px; }
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

  /* ── RECOMMANDATIONS ── */
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
      <div class="cover-subtitle" style="font-size:16px;font-weight:600;color:#edfa36;letter-spacing:0.5px;margin-top:8px">${titreAudit}</div>
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

  <div class="section-title">${prospectAudit?.forces?.length > 0 ? '6' : '5'} · Recommandations & Plan d'action</div>
  ${recommendations.map((r, i) => `
  <div class="rec-item">
    <div class="rec-num">${i + 1}</div>
    <div class="rec-content">
      <div class="rec-title">${r.title}</div>
      <div class="rec-detail">${r.detail}</div>
    </div>
  </div>`).join('')}

  ${comparaison ? `
  <div class="section-title" style="margin-top:24px">· Positionnement concurrentiel</div>
  <div class="card">
    <div class="stat-row"><span class="stat-label" style="font-weight:600">Position</span><span class="stat-value" style="font-size:11px;max-width:260px;text-align:right">${esc(comparaison.position)}</span></div>
    ${(comparaison.avantages?.length ?? 0) > 0 ? `<div style="margin-top:8px"><div class="card-title" style="color:#16a34a">Points forts</div>${comparaison.avantages.map(a => `<div class="stat-row"><span class="stat-label">✓ ${esc(a)}</span></div>`).join('')}</div>` : ''}
    ${(comparaison.retards?.length ?? 0) > 0 ? `<div style="margin-top:8px"><div class="card-title" style="color:#dc2626">Points en retard</div>${comparaison.retards.map(r => `<div class="stat-row"><span class="stat-label">→ ${esc(r)}</span></div>`).join('')}</div>` : ''}
  </div>` : ''}

  ${timeline ? `
  <div class="section-title" style="margin-top:24px">· Calendrier de mise en oeuvre</div>
  <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px">
    <div class="card"><div class="card-title">Semaine 1</div><div class="rec-detail">${esc(timeline.semaine_1)}</div></div>
    <div class="card"><div class="card-title">Semaines 2–3</div><div class="rec-detail">${esc(timeline.semaine_2_3)}</div></div>
    <div class="card"><div class="card-title">Mois 2–3</div><div class="rec-detail">${esc(timeline.mois_2_3)}</div></div>
  </div>` : ''}

  <div class="cta-block" style="margin-top:16px">
    <div class="cta-badge">Votre partenaire digital</div>
    <div class="cta-headline">${prospectAudit?.accroche ? esc(prospectAudit.accroche) : 'Prêt à améliorer votre présence digitale ?'}</div>
    <div class="cta-sub">Discutons de vos priorités — sans engagement.</div>
    <div class="cta-grid">
      <div class="cta-item"><div class="cta-item-icon">👤</div><div class="cta-item-text">[Votre nom]</div></div>
      <div class="cta-item"><div class="cta-item-icon">📧</div><div class="cta-item-text">[votre@email.com]</div></div>
      <div class="cta-item"><div class="cta-item-icon">📞</div><div class="cta-item-text">[06 XX XX XX XX]</div></div>
      <div class="cta-item"><div class="cta-item-icon">🌐</div><div class="cta-item-text">[votre-site.com]</div></div>
    </div>
  </div>

  <div class="page-footer">Rapport généré via LeadGenPro · ${date}</div>
</div>  <!-- /.report -->

</body>
</html>`
}

// ─── Export function (même pipeline que exportLeadPDF) ────────────────────────
export async function exportAuditPDF({ lead, activeProfile, activeWeights, aiReport, auditData, prospectAudit = null }) {
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
  container.innerHTML = buildAuditHTML({ lead, activeProfile, activeWeights, aiReport, auditData, prospectAudit })
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

// ─────────────────────────────────────────────────────────────────────────────
// exportAuditPhotographePDF — Rapport "Audit Image & Photographie"
// Page 1 : Couverture dark vert + nom business + score + type d'audit
// Page 2 : Résumé exécutif + forces/faiblesses + stats photos + réseaux visuels
// Page 3 : Opportunités + recommandations priorisées + CTA photographe
// ─────────────────────────────────────────────────────────────────────────────
export async function exportAuditPhotographePDF({ lead, activeProfile, photoAudit, auditData }) {
  const { jsPDF }      = await import('jspdf')
  const html2canvasLib = (await import('html2canvas')).default

  const businessName = esc(lead.name ?? 'Ce commerce')
  const score        = lead.score?.total ?? 0
  const rating       = lead.google?.rating       ?? '—'
  const totalReviews = lead.google?.totalReviews ?? 0
  const photoCount   = lead.googleAudit?.photoCount ?? 0
  const date         = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
  const city         = (lead.address ?? '').split(',').pop()?.trim() || ''
  const profileName  = activeProfile?.name ?? 'Photographe professionnel'

  // Score → couleur
  const sColor = score >= 75 ? '#22c55e' : score >= 50 ? '#f59e0b' : '#ef4444'

  // Données audit photo
  const resumeExecutif = esc(photoAudit?.resume_executif ?? '')
  const forces         = photoAudit?.forces         ?? []
  const faiblesses     = photoAudit?.faiblesses     ?? []
  const opportunites   = photoAudit?.opportunites   ?? []
  const recommandations = photoAudit?.recommandations ?? []
  const accroche       = esc(photoAudit?.accroche ?? '')
  const comparaison    = photoAudit?.comparaison_concurrents ?? null
  const timeline       = photoAudit?.timeline ?? null
  const titreAudit     = esc(photoAudit?.titre_audit ?? 'Audit Image & Photographie')

  // Réseaux sociaux visuels
  const social      = lead.social ?? {}
  const hasIG       = !!(social.instagram)
  const hasTT       = !!(social.tiktok)
  const hasFB       = !!(social.facebook)
  const socialBadge = (has, label) =>
    `<span class="badge ${has ? 'badge-green' : 'badge-red'}">${has ? '✓' : '✗'} ${label}</span>`

  // Helpers HTML
  const forceFaiblCard = (items, color) => items.slice(0, 3).map(item => `
    <div class="ff-item" style="border-left-color:${color}">
      <div class="ff-title">${esc(item.titre ?? '')}</div>
      <div class="ff-desc">${esc(item.description ?? '')}</div>
    </div>`).join('')

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<title>Audit Image — ${businessName}</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:'Segoe UI',system-ui,sans-serif; background:#fff; color:#0f172a; }

  /* ── PAGE 1 COUVERTURE ── */
  .cover {
    width:100%; height:1123px;
    background:linear-gradient(145deg,#0d1410 0%,#0a1a10 55%,#0f172a 100%);
    display:flex; flex-direction:column; justify-content:space-between;
    padding:56px 60px 0 60px; position:relative; overflow:hidden;
    page-break-after:always;
  }
  .cover::before {
    content:''; position:absolute; inset:0;
    background:radial-gradient(ellipse 50% 50% at 80% 20%,#1d6e5522 0%,transparent 65%),
               radial-gradient(ellipse 35% 35% at 15% 75%,#edfa3608 0%,transparent 55%);
    pointer-events:none;
  }
  .cover-logo { font-size:8px; font-weight:700; letter-spacing:3px; text-transform:uppercase; color:rgba(255,255,255,0.3); }
  .cover-eyebrow { font-size:10px; font-weight:700; letter-spacing:5px; text-transform:uppercase; color:#1d6e55; margin-bottom:12px; }
  .cover-title { font-size:48px; font-weight:900; color:#fff; line-height:1.0; letter-spacing:-1.5px; }
  .cover-subtitle { font-size:18px; font-weight:600; color:#edfa36; letter-spacing:0.5px; margin-top:8px; }
  .cover-business { font-size:26px; font-weight:700; color:rgba(255,255,255,0.85); line-height:1.2; max-width:460px; letter-spacing:-0.3px; margin-top:28px; }
  .cover-main { flex:1; display:flex; flex-direction:column; justify-content:center; gap:0; }
  .cover-score-ring {
    width:110px; height:110px; border-radius:50%;
    border:4px solid ${sColor};
    display:flex; align-items:center; justify-content:center; flex-direction:column;
    box-shadow:0 0 36px ${sColor}44, 0 0 70px ${sColor}18;
    background:${sColor}0d;
    margin-top:36px;
  }
  .cover-score-number { font-size:32px; font-weight:900; color:${sColor}; line-height:1; }
  .cover-score-label  { font-size:8px; color:rgba(255,255,255,0.4); letter-spacing:2px; margin-top:2px; }
  .cover-score-row { display:flex; align-items:center; gap:20px; margin-top:36px; }
  .cover-score-meta { display:flex; flex-direction:column; gap:8px; }
  .cover-score-meta-item { display:flex; flex-direction:column; gap:1px; }
  .cover-score-meta-label { font-size:8px; color:rgba(255,255,255,0.3); text-transform:uppercase; letter-spacing:2px; }
  .cover-score-meta-value { font-size:13px; color:rgba(255,255,255,0.82); font-weight:700; }
  .cover-footer {
    margin:0 -60px; padding:20px 60px;
    border-top:1px solid rgba(255,255,255,0.06);
    display:flex; justify-content:space-between; align-items:center;
  }
  .cover-freelancer { font-size:12px; color:rgba(255,255,255,0.45); }
  .cover-freelancer strong { color:rgba(255,255,255,0.75); }
  .cover-date { font-size:10px; color:rgba(255,255,255,0.25); }
  .cover-watermark { font-size:7px; color:rgba(255,255,255,0.1); letter-spacing:1px; }

  /* ── PAGES 2 & 3 ── */
  .report { padding:48px 52px; }
  .page-break { page-break-before:always; padding-top:48px; padding-left:52px; padding-right:52px; padding-bottom:48px; }
  .section-title {
    font-size:8.5px; font-weight:800; letter-spacing:3.5px; text-transform:uppercase;
    color:#1d6e55; border-bottom:2px solid #1d6e55;
    padding-bottom:7px; margin-bottom:18px; margin-top:32px;
  }
  .section-title:first-child { margin-top:0; }
  .exec-box { background:linear-gradient(135deg,#f0fdf4,#f8fafc); border:1px solid #bbf7d0; border-left:3px solid #1d6e55; border-radius:8px; padding:16px 18px; font-size:11.5px; line-height:1.8; color:#1e293b; }
  .grid-2 { display:grid; grid-template-columns:1fr 1fr; gap:14px; }
  .card { background:#f8fafc; border-radius:10px; padding:16px 18px; border:1px solid #e2e8f0; }
  .card-title { font-size:8.5px; color:#94a3b8; text-transform:uppercase; letter-spacing:2px; font-weight:700; margin-bottom:12px; }
  .ff-item { padding:10px 14px; border-left:3px solid; border-radius:0 8px 8px 0; background:#f8fafc; margin-bottom:8px; }
  .ff-title { font-size:11.5px; font-weight:700; color:#0f172a; margin-bottom:3px; }
  .ff-desc  { font-size:10px; color:#64748b; line-height:1.5; }
  .stat-row { display:flex; justify-content:space-between; align-items:center; padding:8px 0; border-bottom:1px solid #f1f5f9; }
  .stat-row:last-child { border-bottom:none; }
  .stat-label { font-size:11px; color:#64748b; }
  .stat-value { font-size:12px; font-weight:700; color:#0f172a; }
  .badge { display:inline-flex; align-items:center; gap:4px; padding:3px 10px; border-radius:20px; font-size:10px; font-weight:700; margin:3px; }
  .badge-green { background:#dcfce7; color:#16a34a; }
  .badge-red   { background:#fee2e2; color:#dc2626; }
  .opp-item { display:flex; gap:12px; align-items:flex-start; padding:10px 14px; border-radius:8px; border:1px solid #e2e8f0; margin-bottom:8px; background:#fafbfc; }
  .opp-icon { font-size:16px; flex-shrink:0; }
  .opp-content { flex:1; }
  .opp-label  { font-size:11.5px; font-weight:700; color:#0f172a; margin-bottom:2px; }
  .opp-detail { font-size:10px; color:#64748b; line-height:1.5; }
  .rec-item { padding:13px 16px; border-radius:10px; border:1px solid #e2e8f0; margin-bottom:8px; background:#f8fafc; display:flex; gap:14px; align-items:flex-start; }
  .rec-num { width:24px; height:24px; border-radius:50%; background:#1d6e55; color:#fff; font-size:11px; font-weight:800; display:flex; align-items:center; justify-content:center; flex-shrink:0; margin-top:1px; }
  .rec-content { flex:1; }
  .rec-title  { font-size:12px; font-weight:700; color:#0f172a; margin-bottom:3px; }
  .rec-detail { font-size:10.5px; color:#64748b; line-height:1.5; }
  .cta-block {
    background:linear-gradient(135deg,#1d6e55 0%,#166244 100%);
    border-radius:12px; padding:22px 28px; margin-top:16px; border:1px solid #1d6e5533;
  }
  .cta-badge    { display:inline-block; background:#edfa36; color:#0d1410; font-size:8px; font-weight:800; letter-spacing:1.5px; text-transform:uppercase; padding:3px 10px; border-radius:4px; margin-bottom:12px; }
  .cta-headline { font-size:18px; font-weight:800; color:#fff; margin-bottom:6px; }
  .cta-sub      { font-size:11px; color:rgba(255,255,255,0.65); margin-bottom:20px; line-height:1.5; }
  .cta-grid     { display:grid; grid-template-columns:1fr 1fr; gap:10px; }
  .cta-item     { display:flex; align-items:center; gap:9px; }
  .cta-item-icon { font-size:14px; flex-shrink:0; }
  .cta-item-text { font-size:11px; color:rgba(255,255,255,0.85); font-weight:600; }
  .page-footer  { font-size:7.5px; color:rgba(0,0,0,0.18); text-align:center; margin-top:32px; letter-spacing:0.5px; }
  .card,.ff-item,.opp-item,.rec-item,.cta-block,.exec-box,.grid-2 { page-break-inside:avoid; break-inside:avoid; }
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
      <div class="cover-eyebrow">Audit prospect</div>
      <div class="cover-title">Image &<br>Photo</div>
      <div class="cover-subtitle">${titreAudit}</div>
      <div class="cover-business">${businessName}</div>
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
          <div class="cover-score-meta-label">Photos Google</div>
          <div class="cover-score-meta-value">${photoCount} photo${photoCount !== 1 ? 's' : ''}</div>
        </div>
      </div>
    </div>
  </div>

  <div class="cover-footer">
    <div class="cover-freelancer">Rapport préparé par <strong>${esc(profileName)}</strong>${city ? ` — ${esc(city)}` : ''}</div>
    <div class="cover-date">${date}</div>
    <div class="cover-watermark">Rapport généré via LeadGenPro</div>
  </div>
</div>

<!-- ═══════ PAGE 2 : RÉSUMÉ + FORCES/FAIBLESSES + STATS ═══════ -->
<div class="report">

  <div class="section-title">1 · Résumé exécutif</div>
  <div class="exec-box">${resumeExecutif}</div>

  <div class="section-title" style="margin-top:28px">2 · Forces &amp; faiblesses visuelles</div>
  <div class="grid-2">
    <div>
      <div class="card-title" style="color:#16a34a;font-size:8px;letter-spacing:2px;font-weight:700;text-transform:uppercase;margin-bottom:10px">✓ Forces</div>
      ${forceFaiblCard(forces, '#1d6e55')}
    </div>
    <div>
      <div class="card-title" style="color:#dc2626;font-size:8px;letter-spacing:2px;font-weight:700;text-transform:uppercase;margin-bottom:10px">✗ Faiblesses</div>
      ${forceFaiblCard(faiblesses, '#ef4444')}
    </div>
  </div>

  <div class="section-title" style="margin-top:28px">3 · Présence photo &amp; réseaux visuels</div>
  <div class="grid-2">
    <div class="card">
      <div class="card-title">Photos Google</div>
      <div class="stat-row">
        <span class="stat-label">Nombre de photos</span>
        <span class="stat-value">${photoCount}</span>
      </div>
      <div class="stat-row">
        <span class="stat-label">Note Google</span>
        <span class="stat-value">⭐ ${rating}/5</span>
      </div>
      <div class="stat-row">
        <span class="stat-label">Avis clients</span>
        <span class="stat-value">${totalReviews}</span>
      </div>
    </div>
    <div class="card">
      <div class="card-title">Réseaux visuels</div>
      <div style="margin-top:4px;line-height:2">
        ${socialBadge(hasIG, 'Instagram')}
        ${socialBadge(hasTT, 'TikTok')}
        ${socialBadge(hasFB, 'Facebook')}
      </div>
    </div>
  </div>

</div>

<!-- ═══════ PAGE 3 : OPPORTUNITÉS + RECOMMANDATIONS + CTA ═══════ -->
<div class="page-break">

  <div class="section-title" style="margin-top:0">4 · Opportunités identifiées</div>
  ${opportunites.slice(0, 3).map(o => `
  <div class="opp-item">
    <div class="opp-icon">📸</div>
    <div class="opp-content">
      <div class="opp-label">${esc(o.titre ?? '')}</div>
      <div class="opp-detail">${esc(o.description ?? '')}</div>
    </div>
  </div>`).join('')}

  <div class="section-title" style="margin-top:28px">5 · Recommandations prioritaires</div>
  ${recommandations.slice(0, 4).map((r, i) => `
  <div class="rec-item">
    <div class="rec-num">${i + 1}</div>
    <div class="rec-content">
      <div class="rec-title">${esc(r.titre ?? '')}</div>
      <div class="rec-detail">${esc(r.description ?? '')}</div>
    </div>
  </div>`).join('')}

  ${comparaison ? `
  <div class="section-title" style="margin-top:28px">6 · Positionnement concurrentiel</div>
  <div class="card">
    <div class="stat-row"><span class="stat-label" style="font-weight:600">Position</span><span class="stat-value" style="font-size:11px;max-width:260px;text-align:right">${esc(comparaison.position)}</span></div>
    ${(comparaison.avantages?.length ?? 0) > 0 ? `<div style="margin-top:8px"><div class="card-title" style="color:#16a34a">Points forts</div>${comparaison.avantages.map(a => `<div class="stat-row"><span class="stat-label">✓ ${esc(a)}</span></div>`).join('')}</div>` : ''}
    ${(comparaison.retards?.length ?? 0) > 0 ? `<div style="margin-top:8px"><div class="card-title" style="color:#dc2626">Points en retard</div>${comparaison.retards.map(r => `<div class="stat-row"><span class="stat-label">→ ${esc(r)}</span></div>`).join('')}</div>` : ''}
  </div>` : ''}

  ${timeline ? `
  <div class="section-title" style="margin-top:28px">7 · Calendrier de mise en oeuvre</div>
  <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px">
    <div class="card"><div class="card-title">Semaine 1</div><div class="ff-desc">${esc(timeline.semaine_1)}</div></div>
    <div class="card"><div class="card-title">Semaines 2–3</div><div class="ff-desc">${esc(timeline.semaine_2_3)}</div></div>
    <div class="card"><div class="card-title">Mois 2–3</div><div class="ff-desc">${esc(timeline.mois_2_3)}</div></div>
  </div>` : ''}

  <div class="cta-block">
    <div class="cta-badge">Passons à l'action</div>
    <div class="cta-headline">${accroche || 'Vos photos sont votre première impression — soignons-la.'}</div>
    <div class="cta-sub">Discutons de vos priorités — sans engagement.</div>
    <div class="cta-grid">
      <div class="cta-item"><div class="cta-item-icon">📷</div><div class="cta-item-text">[Votre prénom]</div></div>
      <div class="cta-item"><div class="cta-item-icon">📍</div><div class="cta-item-text">${city ? esc(city) : '[Votre ville]'}</div></div>
      <div class="cta-item"><div class="cta-item-icon">📞</div><div class="cta-item-text">[Votre numéro]</div></div>
      <div class="cta-item"><div class="cta-item-icon">🌐</div><div class="cta-item-text">[Votre site]</div></div>
    </div>
  </div>

  <div class="page-footer">Rapport généré via LeadGenPro — ${date}</div>
</div>

</body>
</html>`

  const container = document.createElement('div')
  container.style.cssText = 'position:fixed;left:-9999px;top:0;width:794px;z-index:-1'
  container.innerHTML = html
  document.body.appendChild(container)

  try {
    const canvas = await html2canvasLib(container, {
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

    const fileName = `AuditPhoto-${(lead.name ?? 'prospect').replace(/[^a-zA-Z0-9]/g, '-')}-${new Date().toISOString().slice(0, 10)}.pdf`
    pdf.save(fileName)

  } finally {
    document.body.removeChild(container)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// exportAuditChatbotPDF — Rapport "Audit Chatbot & IA Conversationnelle"
// Page 1 : Couverture dark vert + nom business + score
// Page 2 : Résumé exécutif + forces/faiblesses + KPIs chatbot
// Page 3 : Recommandations priorisées + CTA dev chatbot
// ─────────────────────────────────────────────────────────────────────────────
export async function exportAuditChatbotPDF({ lead, activeProfile, chatbotAudit, reviewsData, auditData }) {
  const { jsPDF }      = await import('jspdf')
  const html2canvasLib = (await import('html2canvas')).default

  const businessName  = esc(lead.name ?? 'Ce commerce')
  const score         = lead.score?.total ?? 0
  const rating        = lead.google?.rating       ?? '—'
  const totalReviews  = lead.google?.totalReviews ?? 0
  const date          = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
  const city          = (lead.address ?? '').split(',').pop()?.trim() || ''
  const profileName   = activeProfile?.name ?? 'Développeur Chatbot IA'

  const sColor = score >= 75 ? '#22c55e' : score >= 50 ? '#f59e0b' : '#ef4444'

  // Données audit
  const resumeExecutif  = esc(chatbotAudit?.resume_executif ?? '')
  const forces          = chatbotAudit?.forces          ?? []
  const faiblesses      = chatbotAudit?.faiblesses      ?? []
  const opportunites    = chatbotAudit?.opportunites    ?? []
  const recommandations = chatbotAudit?.recommandations ?? []
  const accroche        = esc(chatbotAudit?.accroche ?? '')
  const comparaison     = chatbotAudit?.comparaison_concurrents ?? null
  const timeline        = chatbotAudit?.timeline ?? null
  const titreAudit      = esc(chatbotAudit?.titre_audit ?? 'Audit Chatbot & IA Conversationnelle')

  // KPIs chatbot
  const unanswered     = reviewsData?.unanswered ?? lead.reviewAnalysis?.negative?.unanswered ?? 0
  const questionCount  = reviewsData?.questionAnalysis?.totalQuestions ?? 0
  const questionRatio  = reviewsData?.questionAnalysis?.questionRatio  ?? 0
  const hasChatbot     = !!(lead.chatbotDetection?.hasChatbot)
  const hasFAQ         = auditData?.pagespeed?.hasFAQ         ?? null
  const hasForm        = auditData?.pagespeed?.hasContactForm  ?? null
  const complexity     = lead.domainComplexity ?? null
  const bookingPlatform = lead.chatbotDetection?.bookingPlatform
    ?? auditData?.pagespeed?.bookingPlatform              // getSiteSignals (flat, chatbot profile)
    ?? auditData?.pagespeed?.siteSignals?.bookingPlatform // getPageSpeed (nested, SEO profile)
    ?? null
  const cms            = auditData?.pagespeed?.cms?.cms ?? auditData?.pagespeed?.cms ?? null

  // Type RAG
  let ragType = 'FAQ bot simple'
  if (bookingPlatform)               ragType = `Assistant réservation (${bookingPlatform})`
  else if (complexity === 'complex') ragType = 'Assistant IA avancé (RAG multi-source)'
  else if (complexity === 'medium')  ragType = 'Assistant réservation & FAQ'

  // Helpers
  const forceFaiblCard = (items, color) => items.slice(0, 3).map(item => `
    <div class="ff-item" style="border-left-color:${color}">
      <div class="ff-title">${esc(item.titre ?? '')}</div>
      <div class="ff-desc">${esc(item.description ?? '')}</div>
    </div>`).join('')

  const kpiRow = (label, value, note) => `
    <div class="stat-row">
      <span class="stat-label">${label}</span>
      <span class="stat-value">${value}${note ? `<span style="font-size:9px;color:#94a3b8;font-weight:400"> ${note}</span>` : ''}</span>
    </div>`

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<title>Audit Chatbot — ${businessName}</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:'Segoe UI',system-ui,sans-serif; background:#fff; color:#0f172a; }
  .cover {
    width:100%; height:1123px;
    background:linear-gradient(145deg,#0d1410 0%,#0a1a10 55%,#0d1117 100%);
    display:flex; flex-direction:column; justify-content:space-between;
    padding:56px 60px 0 60px; position:relative; overflow:hidden;
    page-break-after:always;
  }
  .cover::before {
    content:''; position:absolute; inset:0;
    background:radial-gradient(ellipse 50% 50% at 80% 20%,#edfa3614 0%,transparent 65%),
               radial-gradient(ellipse 35% 35% at 15% 75%,#1d6e5510 0%,transparent 55%);
    pointer-events:none;
  }
  .cover-logo { font-size:8px; font-weight:700; letter-spacing:3px; text-transform:uppercase; color:rgba(255,255,255,0.3); }
  .cover-eyebrow { font-size:10px; font-weight:700; letter-spacing:5px; text-transform:uppercase; color:#edfa36; margin-bottom:12px; }
  .cover-title { font-size:42px; font-weight:900; color:#fff; line-height:1.0; letter-spacing:-1.5px; }
  .cover-subtitle { font-size:16px; font-weight:600; color:#1d6e55; letter-spacing:0.5px; margin-top:8px; }
  .cover-business { font-size:26px; font-weight:700; color:rgba(255,255,255,0.85); line-height:1.2; max-width:460px; letter-spacing:-0.3px; margin-top:28px; }
  .cover-main { flex:1; display:flex; flex-direction:column; justify-content:center; gap:0; }
  .cover-score-ring { width:110px; height:110px; border-radius:50%; border:4px solid ${sColor}; display:flex; align-items:center; justify-content:center; flex-direction:column; box-shadow:0 0 36px ${sColor}44,0 0 70px ${sColor}18; background:${sColor}0d; margin-top:36px; }
  .cover-score-number { font-size:32px; font-weight:900; color:${sColor}; line-height:1; }
  .cover-score-label  { font-size:8px; color:rgba(255,255,255,0.4); letter-spacing:2px; margin-top:2px; }
  .cover-score-row { display:flex; align-items:center; gap:20px; margin-top:36px; }
  .cover-score-meta { display:flex; flex-direction:column; gap:8px; }
  .cover-score-meta-item { display:flex; flex-direction:column; gap:1px; }
  .cover-score-meta-label { font-size:8px; color:rgba(255,255,255,0.3); text-transform:uppercase; letter-spacing:2px; }
  .cover-score-meta-value { font-size:13px; color:rgba(255,255,255,0.82); font-weight:700; }
  .cover-footer { padding-bottom:32px; display:flex; flex-direction:column; gap:5px; }
  .cover-freelancer { font-size:12px; color:rgba(255,255,255,0.45); }
  .cover-freelancer strong { color:rgba(255,255,255,0.75); }
  .cover-date { font-size:10px; color:rgba(255,255,255,0.25); }
  .cover-watermark { font-size:7px; color:rgba(255,255,255,0.1); letter-spacing:1px; }
  .report { padding:48px 52px; }
  .page-break { page-break-before:always; padding:48px 52px; }
  .section-title { font-size:8.5px; font-weight:800; letter-spacing:3.5px; text-transform:uppercase; color:#1d6e55; border-bottom:2px solid #1d6e55; padding-bottom:7px; margin-bottom:18px; margin-top:32px; }
  .section-title:first-child { margin-top:0; }
  .exec-box { background:linear-gradient(135deg,#f0fdf4,#f8fafc); border:1px solid #bbf7d0; border-left:3px solid #1d6e55; border-radius:8px; padding:16px 18px; font-size:11.5px; line-height:1.8; color:#1e293b; }
  .grid-2 { display:grid; grid-template-columns:1fr 1fr; gap:14px; }
  .card { background:#f8fafc; border-radius:10px; padding:16px 18px; border:1px solid #e2e8f0; }
  .card-title { font-size:8.5px; color:#94a3b8; text-transform:uppercase; letter-spacing:2px; font-weight:700; margin-bottom:12px; }
  .ff-item { padding:10px 14px; border-left:3px solid; border-radius:0 8px 8px 0; background:#f8fafc; margin-bottom:8px; }
  .ff-title { font-size:11.5px; font-weight:700; color:#0f172a; margin-bottom:3px; }
  .ff-desc  { font-size:10px; color:#64748b; line-height:1.5; }
  .stat-row { display:flex; justify-content:space-between; align-items:center; padding:8px 0; border-bottom:1px solid #f1f5f9; }
  .stat-row:last-child { border-bottom:none; }
  .stat-label { font-size:11px; color:#64748b; }
  .stat-value { font-size:12px; font-weight:700; color:#0f172a; }
  .badge { display:inline-flex; align-items:center; gap:4px; padding:3px 10px; border-radius:20px; font-size:10px; font-weight:700; margin:3px; }
  .badge-green { background:#dcfce7; color:#16a34a; }
  .badge-red   { background:#fee2e2; color:#dc2626; }
  .opp-item { display:flex; gap:12px; align-items:flex-start; padding:10px 14px; border-radius:8px; border:1px solid #e2e8f0; margin-bottom:8px; background:#fafbfc; }
  .opp-icon { font-size:16px; flex-shrink:0; }
  .opp-content { flex:1; }
  .opp-label  { font-size:11.5px; font-weight:700; color:#0f172a; margin-bottom:2px; }
  .opp-detail { font-size:10px; color:#64748b; line-height:1.5; }
  .rec-item { padding:13px 16px; border-radius:10px; border:1px solid #e2e8f0; margin-bottom:8px; background:#f8fafc; display:flex; gap:14px; align-items:flex-start; }
  .rec-num { width:24px; height:24px; border-radius:50%; background:#1d6e55; color:#fff; font-size:11px; font-weight:800; display:flex; align-items:center; justify-content:center; flex-shrink:0; margin-top:1px; }
  .rec-content { flex:1; }
  .rec-title  { font-size:12px; font-weight:700; color:#0f172a; margin-bottom:3px; }
  .rec-detail { font-size:10.5px; color:#64748b; line-height:1.5; }
  .cta-block { background:linear-gradient(135deg,#0d1410 0%,#0a1a10 100%); border:1px solid #1d6e5540; border-radius:12px; padding:22px 28px; margin-top:16px; }
  .cta-badge    { display:inline-block; background:#edfa36; color:#0d1410; font-size:8px; font-weight:800; letter-spacing:1.5px; text-transform:uppercase; padding:3px 10px; border-radius:4px; margin-bottom:12px; }
  .cta-headline { font-size:18px; font-weight:800; color:#fff; margin-bottom:6px; }
  .cta-sub      { font-size:11px; color:rgba(255,255,255,0.6); margin-bottom:20px; line-height:1.5; }
  .cta-grid     { display:grid; grid-template-columns:1fr 1fr; gap:10px; }
  .cta-item     { display:flex; align-items:center; gap:9px; }
  .cta-item-icon { font-size:14px; flex-shrink:0; }
  .cta-item-text { font-size:11px; color:rgba(255,255,255,0.85); font-weight:600; }
  .rag-badge { display:inline-block; background:#fef9c3; color:#854d0e; border:1px solid #fde68a; border-radius:6px; padding:4px 12px; font-size:10.5px; font-weight:700; margin-top:6px; }
  .page-footer { font-size:7.5px; color:rgba(0,0,0,0.18); text-align:center; margin-top:32px; letter-spacing:0.5px; }
  .card,.ff-item,.opp-item,.rec-item,.cta-block,.exec-box,.grid-2 { page-break-inside:avoid; break-inside:avoid; }
  @media print { body { -webkit-print-color-adjust:exact; print-color-adjust:exact; } @page { size:A4 portrait; margin:0; } }
</style>
</head>
<body>

<!-- PAGE 1 -->
<div class="cover">
  <div class="cover-logo">LeadGenPro</div>
  <div class="cover-main">
    <div>
      <div class="cover-eyebrow">Audit prospect</div>
      <div class="cover-title">Chatbot<br>&amp; IA</div>
      <div class="cover-subtitle">${titreAudit}</div>
      <div class="cover-business">${businessName}</div>
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
          <div class="cover-score-meta-label">Chatbot actuel</div>
          <div class="cover-score-meta-value">${hasChatbot ? '✓ Présent' : '✗ Absent'}</div>
        </div>
      </div>
    </div>
  </div>
  <div class="cover-footer">
    <div class="cover-freelancer">Rapport préparé par <strong>${esc(profileName)}</strong>${city ? ` — ${esc(city)}` : ''}</div>
    <div class="cover-date">${date}</div>
    <div class="cover-watermark">Rapport généré via LeadGenPro</div>
  </div>
</div>

<!-- PAGE 2 -->
<div class="report">
  <div class="section-title">1 · Résumé exécutif</div>
  <div class="exec-box">${resumeExecutif}</div>

  <div class="section-title" style="margin-top:28px">2 · Forces &amp; faiblesses</div>
  <div class="grid-2">
    <div>
      <div class="card-title" style="color:#16a34a;font-size:8px;letter-spacing:2px;font-weight:700;text-transform:uppercase;margin-bottom:10px">✓ Forces</div>
      ${forceFaiblCard(forces, '#1d6e55')}
    </div>
    <div>
      <div class="card-title" style="color:#dc2626;font-size:8px;letter-spacing:2px;font-weight:700;text-transform:uppercase;margin-bottom:10px">✗ Faiblesses</div>
      ${forceFaiblCard(faiblesses, '#ef4444')}
    </div>
  </div>

  <div class="section-title" style="margin-top:28px">3 · KPIs chatbot détectés</div>
  <div class="grid-2">
    <div class="card">
      <div class="card-title">Signaux d'automatisation</div>
      ${kpiRow('Chatbot existant', hasChatbot ? '✓ Oui' : '✗ Non')}
      ${kpiRow('Avis sans réponse', unanswered > 0 ? String(unanswered) : '0', unanswered > 0 ? '— charge non gérée' : '')}
      ${kpiRow('Questions dans avis', questionCount > 0 ? `${questionCount} (${questionRatio}%)` : '—')}
    </div>
    <div class="card">
      <div class="card-title">Présence sur le site</div>
      ${kpiRow('FAQ détectée', hasFAQ === null ? '—' : hasFAQ ? '✓ Oui' : '✗ Non')}
      ${kpiRow('Formulaire contact', hasForm === null ? '—' : hasForm ? '✓ Oui' : '✗ Non')}
      ${kpiRow('Réservation en ligne', bookingPlatform ? `✓ ${esc(bookingPlatform)}` : 'Aucune détectée')}
      ${kpiRow('CMS détecté', cms ? esc(cms) : '—')}
    </div>
  </div>
  <div style="margin-top:14px">
    <div class="card-title" style="font-size:8px;color:#94a3b8;text-transform:uppercase;letter-spacing:2px;font-weight:700;margin-bottom:8px">Type de RAG recommandé</div>
    <div class="rag-badge">🤖 ${esc(ragType)}</div>
    ${complexity ? `<div style="font-size:10px;color:#64748b;margin-top:8px">Complexité domaine : <strong>${esc(complexity)}</strong> — ${complexity === 'complex' ? 'configuration avancée requise' : complexity === 'medium' ? 'configuration intermédiaire' : 'déploiement rapide possible'}</div>` : ''}
  </div>
</div>

<!-- PAGE 3 -->
<div class="page-break">
  <div class="section-title" style="margin-top:0">4 · Opportunités identifiées</div>
  ${opportunites.slice(0, 3).map(o => `
  <div class="opp-item">
    <div class="opp-icon">🤖</div>
    <div class="opp-content">
      <div class="opp-label">${esc(o.titre ?? '')}</div>
      <div class="opp-detail">${esc(o.description ?? '')}</div>
    </div>
  </div>`).join('')}

  <div class="section-title" style="margin-top:28px">5 · Recommandations prioritaires</div>
  ${recommandations.slice(0, 4).map((r, i) => `
  <div class="rec-item">
    <div class="rec-num">${i + 1}</div>
    <div class="rec-content">
      <div class="rec-title">${esc(r.titre ?? '')}</div>
      <div class="rec-detail">${esc(r.description ?? '')}</div>
    </div>
  </div>`).join('')}

  ${comparaison ? `
  <div class="section-title" style="margin-top:28px">6 · Positionnement concurrentiel</div>
  <div class="card">
    <div class="stat-row"><span class="stat-label" style="font-weight:600">Position</span><span class="stat-value" style="font-size:11px;max-width:260px;text-align:right">${esc(comparaison.position)}</span></div>
    ${(comparaison.avantages?.length ?? 0) > 0 ? `<div style="margin-top:8px"><div class="card-title" style="color:#16a34a">Points forts</div>${comparaison.avantages.map(a => `<div class="stat-row"><span class="stat-label">✓ ${esc(a)}</span></div>`).join('')}</div>` : ''}
    ${(comparaison.retards?.length ?? 0) > 0 ? `<div style="margin-top:8px"><div class="card-title" style="color:#dc2626">Points en retard</div>${comparaison.retards.map(r => `<div class="stat-row"><span class="stat-label">→ ${esc(r)}</span></div>`).join('')}</div>` : ''}
  </div>` : ''}

  ${timeline ? `
  <div class="section-title" style="margin-top:28px">7 · Calendrier de mise en oeuvre</div>
  <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px">
    <div class="card"><div class="card-title">Semaine 1</div><div style="font-size:10.5px;color:#64748b;line-height:1.5">${esc(timeline.semaine_1)}</div></div>
    <div class="card"><div class="card-title">Semaines 2–3</div><div style="font-size:10.5px;color:#64748b;line-height:1.5">${esc(timeline.semaine_2_3)}</div></div>
    <div class="card"><div class="card-title">Mois 2–3</div><div style="font-size:10.5px;color:#64748b;line-height:1.5">${esc(timeline.mois_2_3)}</div></div>
  </div>` : ''}

  <div class="cta-block">
    <div class="cta-badge">Passons à l'action</div>
    <div class="cta-headline">${accroche || 'Chaque question sans réponse est une vente perdue — automatisons.'}</div>
    <div class="cta-sub">Discutons de vos priorités — sans engagement.</div>
    <div class="cta-grid">
      <div class="cta-item"><div class="cta-item-icon">🤖</div><div class="cta-item-text">[Votre prénom]</div></div>
      <div class="cta-item"><div class="cta-item-icon">📍</div><div class="cta-item-text">${city ? esc(city) : '[Votre ville]'}</div></div>
      <div class="cta-item"><div class="cta-item-icon">📞</div><div class="cta-item-text">[Votre numéro]</div></div>
      <div class="cta-item"><div class="cta-item-icon">🌐</div><div class="cta-item-text">[Votre site]</div></div>
    </div>
  </div>

  <div class="page-footer">Rapport généré via LeadGenPro — ${date}</div>
</div>

</body>
</html>`

  const container = document.createElement('div')
  container.style.cssText = 'position:fixed;left:-9999px;top:0;width:794px;z-index:-1'
  container.innerHTML = html
  document.body.appendChild(container)

  try {
    const canvas = await html2canvasLib(container, {
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

    const fileName = `AuditChatbot-${(lead.name ?? 'prospect').replace(/[^a-zA-Z0-9]/g, '-')}-${new Date().toISOString().slice(0, 10)}.pdf`
    pdf.save(fileName)

  } finally {
    document.body.removeChild(container)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// exportAuditSocialMediaPDF — Rapport "Audit Community Manager"
// Page 1 : Couverture dark + réseaux présents/absents + score régularité
// Page 2 : Résumé exécutif + forces/faiblesses + KPIs activité
// Page 3 : Opportunités + recommandations + CTA
// ─────────────────────────────────────────────────────────────────────────────
export async function exportAuditSocialMediaPDF({ lead, activeProfile, socialAudit, auditData, city: cityProp }) {
  const { jsPDF }      = await import('jspdf')
  const html2canvasLib = (await import('html2canvas')).default

  const businessName  = esc(lead.name ?? 'Ce commerce')
  const score         = lead.score?.total ?? 0
  const rating        = lead.google?.rating       ?? '—'
  const totalReviews  = lead.google?.totalReviews ?? 0
  const photoCount    = lead.googleAudit?.photoCount ?? 0
  const date          = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
  const city          = cityProp || (lead.address ?? '').split(',').pop()?.trim() || ''
  const sColor        = score >= 75 ? '#22c55e' : score >= 50 ? '#f59e0b' : '#ef4444'

  const resumeExecutif  = esc(socialAudit?.resume_executif ?? '')
  const tonalite        = esc(socialAudit?.tonalite        ?? '')
  const forces          = socialAudit?.forces          ?? []
  const faiblesses      = socialAudit?.faiblesses      ?? []
  const opportunites    = socialAudit?.opportunites    ?? []
  const recommandations = socialAudit?.recommandations ?? []
  const accroche        = esc(socialAudit?.accroche    ?? '')
  const comparaison     = socialAudit?.comparaison_concurrents ?? null
  const timeline        = socialAudit?.timeline ?? null
  const titreAudit      = esc(socialAudit?.titre_audit ?? 'Audit Community Management & E-Réputation')

  const igActivity  = auditData?.instagramActivity ?? null
  const fbActivity  = auditData?.facebookActivity  ?? null
  const igDeep      = auditData?.instagramDeep     ?? null

  // E-réputation metrics
  const unanswered = lead.reviewAnalysis?.negative?.unanswered ?? 0
  const replyRate  = totalReviews > 0 ? Math.round(((totalReviews - unanswered) / totalReviews) * 100) : null
  const replyColor = replyRate === null ? '#94a3b8' : replyRate >= 80 ? '#16a34a' : replyRate >= 50 ? '#d97706' : '#dc2626'

  // Deep IG engagement
  const igAvgLikes   = igDeep?.avgLikes    ?? null
  const igPostsMo    = igDeep?.postsPerMonth ?? null
  const igTopHash    = igDeep?.topHashtags ?? []

  const NETWORKS = [
    { key: 'instagram', label: 'Instagram', color: '#e1306c' },
    { key: 'facebook',  label: 'Facebook',  color: '#1877f2' },
    { key: 'linkedin',  label: 'LinkedIn',  color: '#0a66c2' },
    { key: 'tiktok',    label: 'TikTok',    color: '#010101' },
    { key: 'youtube',   label: 'YouTube',   color: '#ff0000' },
    { key: 'pinterest', label: 'Pinterest', color: '#e60023' },
  ]
  const presentNets = NETWORKS.filter(n => !!(lead.social?.[n.key]))
  const missingNets = NETWORKS.filter(n => !(lead.social?.[n.key]))

  const networkBadge = (n, present) => `
    <span style="display:inline-flex;align-items:center;gap:4px;padding:4px 10px;border-radius:20px;font-size:10px;font-weight:700;margin:3px;
      background:${present ? n.color + '18' : '#f1f5f9'};color:${present ? n.color : '#94a3b8'};
      border:1px solid ${present ? n.color + '44' : '#e2e8f0'}">
      ${esc(n.label)}
    </span>`

  // Régularité sociale
  const igDays  = igActivity?.daysAgo    ?? null
  const fbDays  = fbActivity?.daysAgo    ?? null
  const igFoll  = igActivity?.followers  ?? null
  const fbFoll  = fbActivity?.followers  ?? null
  const netCount = presentNets.length
  const BASE = [0, 15, 30, 50, 70, 85, 100]
  let regScore = BASE[Math.min(netCount, 6)]
  if (igFoll !== null && igFoll > 1000) regScore += 10
  const lastPost = igDays !== null && fbDays !== null ? Math.min(igDays, fbDays) : igDays ?? fbDays
  if (lastPost !== null && lastPost < 7)  regScore += 15
  if (photoCount > 15)                    regScore += 10
  if (lastPost !== null && lastPost > 30) regScore -= 15
  regScore = Math.max(0, Math.min(100, regScore))
  const regLabel = regScore >= 80 ? 'Très actif' : regScore >= 60 ? 'Actif' : regScore >= 40 ? 'En développement' : regScore >= 20 ? 'Faible' : 'Inexistant'
  const regColor = regScore >= 60 ? '#22c55e' : regScore >= 40 ? '#f59e0b' : '#ef4444'

  const photoQualityLabel = photoCount === 0 ? 'Aucune' : photoCount <= 5 ? 'Insuffisant' : photoCount <= 15 ? 'Basique' : photoCount <= 30 ? 'Correct' : 'Excellent'
  const photoColor = photoCount === 0 ? '#ef4444' : photoCount <= 5 ? '#ef4444' : photoCount <= 15 ? '#f59e0b' : '#22c55e'

  const kpiRow = (label, value, note) => `
    <div class="stat-row">
      <span class="stat-label">${label}</span>
      <span class="stat-value">${value}${note ? `<span style="font-size:9px;color:#94a3b8;font-weight:400"> ${note}</span>` : ''}</span>
    </div>`

  const forceFaiblCard = (items, color) => items.slice(0, 3).map(item => `
    <div class="ff-item" style="border-left-color:${color}">
      <div class="ff-title">${esc(item.titre ?? '')}</div>
      <div class="ff-desc">${esc(item.description ?? '')}</div>
    </div>`).join('')

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<title>Audit Community Manager — ${businessName}</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:'Segoe UI',system-ui,sans-serif; background:#fff; color:#0f172a; }
  .cover { width:100%; height:1123px; background:linear-gradient(145deg,#0d1410 0%,#0a1a10 55%,#0d1117 100%); display:flex; flex-direction:column; justify-content:space-between; padding:56px 60px 0 60px; position:relative; overflow:hidden; page-break-after:always; }
  .cover::before { content:''; position:absolute; inset:0; background:radial-gradient(ellipse 50% 50% at 80% 20%,#edfa3614 0%,transparent 65%),radial-gradient(ellipse 35% 35% at 15% 75%,#1d6e5510 0%,transparent 55%); pointer-events:none; }
  .cover-logo { font-size:8px; font-weight:700; letter-spacing:3px; text-transform:uppercase; color:rgba(255,255,255,0.3); }
  .cover-eyebrow { font-size:10px; font-weight:700; letter-spacing:5px; text-transform:uppercase; color:#edfa36; margin-bottom:12px; }
  .cover-title { font-size:42px; font-weight:900; color:#fff; line-height:1.0; letter-spacing:-1.5px; }
  .cover-subtitle { font-size:16px; font-weight:600; color:#1d6e55; letter-spacing:0.5px; margin-top:8px; }
  .cover-business { font-size:26px; font-weight:700; color:rgba(255,255,255,0.85); line-height:1.2; max-width:460px; letter-spacing:-0.3px; margin-top:28px; }
  .cover-main { flex:1; display:flex; flex-direction:column; justify-content:center; gap:0; }
  .cover-score-ring { width:110px; height:110px; border-radius:50%; border:4px solid ${sColor}; display:flex; align-items:center; justify-content:center; flex-direction:column; box-shadow:0 0 36px ${sColor}44,0 0 70px ${sColor}18; background:${sColor}0d; margin-top:36px; }
  .cover-score-number { font-size:32px; font-weight:900; color:${sColor}; line-height:1; }
  .cover-score-label  { font-size:8px; color:rgba(255,255,255,0.4); letter-spacing:2px; margin-top:2px; }
  .cover-score-row { display:flex; align-items:center; gap:20px; margin-top:36px; }
  .cover-score-meta { display:flex; flex-direction:column; gap:8px; }
  .cover-score-meta-item { display:flex; flex-direction:column; gap:1px; }
  .cover-score-meta-label { font-size:8px; color:rgba(255,255,255,0.3); text-transform:uppercase; letter-spacing:2px; }
  .cover-score-meta-value { font-size:13px; color:rgba(255,255,255,0.82); font-weight:700; }
  .cover-footer { padding-bottom:32px; display:flex; flex-direction:column; gap:5px; }
  .cover-date { font-size:10px; color:rgba(255,255,255,0.25); }
  .report { padding:48px 52px; }
  .page-break { page-break-before:always; padding:48px 52px; }
  .section-title { font-size:8.5px; font-weight:800; letter-spacing:3.5px; text-transform:uppercase; color:#1d6e55; border-bottom:2px solid #1d6e55; padding-bottom:7px; margin-bottom:18px; margin-top:32px; }
  .section-title:first-child { margin-top:0; }
  .exec-box { background:linear-gradient(135deg,#f0fdf4,#f8fafc); border:1px solid #bbf7d0; border-left:3px solid #1d6e55; border-radius:8px; padding:16px 18px; font-size:11.5px; line-height:1.8; color:#1e293b; }
  .grid-2 { display:grid; grid-template-columns:1fr 1fr; gap:14px; }
  .card { background:#f8fafc; border-radius:10px; padding:16px 18px; border:1px solid #e2e8f0; }
  .card-title { font-size:8.5px; color:#94a3b8; text-transform:uppercase; letter-spacing:2px; font-weight:700; margin-bottom:12px; }
  .ff-item { padding:10px 14px; border-left:3px solid; border-radius:0 8px 8px 0; background:#f8fafc; margin-bottom:8px; }
  .ff-title { font-size:11.5px; font-weight:700; color:#0f172a; margin-bottom:3px; }
  .ff-desc  { font-size:10px; color:#64748b; line-height:1.5; }
  .stat-row { display:flex; justify-content:space-between; align-items:center; padding:8px 0; border-bottom:1px solid #f1f5f9; }
  .stat-row:last-child { border-bottom:none; }
  .stat-label { font-size:11px; color:#64748b; }
  .stat-value { font-size:12px; font-weight:700; color:#0f172a; }
  .reg-bar-bg { background:#e2e8f0; border-radius:4px; height:8px; overflow:hidden; margin-top:8px; }
  .reg-bar-fill { height:8px; border-radius:4px; background:${regColor}; width:${regScore}%; }
  .opp-item { display:flex; gap:12px; align-items:flex-start; padding:10px 14px; border-radius:8px; border:1px solid #e2e8f0; margin-bottom:8px; background:#fafbfc; }
  .opp-icon { font-size:16px; flex-shrink:0; }
  .opp-content { flex:1; }
  .opp-label  { font-size:11.5px; font-weight:700; color:#0f172a; margin-bottom:2px; }
  .opp-detail { font-size:10px; color:#64748b; line-height:1.5; }
  .rec-item { padding:13px 16px; border-radius:10px; border:1px solid #e2e8f0; margin-bottom:8px; background:#f8fafc; display:flex; gap:14px; align-items:flex-start; }
  .rec-num { width:24px; height:24px; border-radius:50%; background:#1d6e55; color:#fff; font-size:11px; font-weight:800; display:flex; align-items:center; justify-content:center; flex-shrink:0; margin-top:1px; }
  .rec-content { flex:1; }
  .rec-title  { font-size:12px; font-weight:700; color:#0f172a; margin-bottom:3px; }
  .rec-detail { font-size:10.5px; color:#64748b; line-height:1.5; }
  .cta-block { background:linear-gradient(135deg,#0d1410 0%,#0a1a10 100%); border:1px solid #1d6e5540; border-radius:12px; padding:22px 28px; margin-top:16px; }
  .cta-badge    { display:inline-block; background:#edfa36; color:#0d1410; font-size:8px; font-weight:800; letter-spacing:1.5px; text-transform:uppercase; padding:3px 10px; border-radius:4px; margin-bottom:12px; }
  .cta-headline { font-size:18px; font-weight:800; color:#fff; margin-bottom:6px; }
  .cta-sub      { font-size:11px; color:rgba(255,255,255,0.6); margin-bottom:20px; line-height:1.5; }
  .cta-grid     { display:grid; grid-template-columns:1fr 1fr; gap:10px; }
  .cta-item     { display:flex; align-items:center; gap:9px; }
  .cta-item-icon { font-size:14px; flex-shrink:0; }
  .cta-item-text { font-size:11px; color:rgba(255,255,255,0.85); font-weight:600; }
  .page-footer { font-size:7.5px; color:rgba(0,0,0,0.18); text-align:center; margin-top:32px; letter-spacing:0.5px; }
  .card,.ff-item,.opp-item,.rec-item,.cta-block,.exec-box,.grid-2 { page-break-inside:avoid; break-inside:avoid; }
  @media print { body { -webkit-print-color-adjust:exact; print-color-adjust:exact; } @page { size:A4 portrait; margin:0; } }
</style>
</head>
<body>

<!-- PAGE 1 — COUVERTURE -->
<div class="cover">
  <div class="cover-logo">LeadGenPro</div>
  <div class="cover-main">
    <div>
      <div class="cover-eyebrow">Audit prospect</div>
      <div class="cover-title">Community<br>Management</div>
      <div class="cover-subtitle">${titreAudit}</div>
      <div class="cover-business">${businessName}</div>
    </div>
    <div class="cover-score-row">
      <div class="cover-score-ring">
        <div class="cover-score-number">${score}</div>
        <div class="cover-score-label">/ 100</div>
      </div>
      <div class="cover-score-meta">
        <div class="cover-score-meta-item">
          <div class="cover-score-meta-label">Note Google</div>
          <div class="cover-score-meta-value">${rating}/5</div>
        </div>
        <div class="cover-score-meta-item">
          <div class="cover-score-meta-label">Avis</div>
          <div class="cover-score-meta-value">${totalReviews}</div>
        </div>
        <div class="cover-score-meta-item">
          <div class="cover-score-meta-label">Réseaux présents</div>
          <div class="cover-score-meta-value">${presentNets.length} / ${NETWORKS.length}</div>
        </div>
      </div>
    </div>
  </div>
  <div class="cover-footer">
    <div class="cover-date">${date}${city ? ' · ' + city : ''}</div>
  </div>
</div>

<!-- PAGE 2 — ANALYSE -->
<div class="report">

  <div class="section-title">Résumé exécutif</div>
  <div class="exec-box">${resumeExecutif || 'Analyse en cours de génération.'}</div>

  <div class="section-title" style="margin-top:24px">Réseaux présents / absents</div>
  <div style="margin-bottom:8px">
    ${presentNets.map(n => networkBadge(n, true)).join('')}
    ${missingNets.map(n => networkBadge(n, false)).join('')}
  </div>

  <div class="section-title" style="margin-top:24px">Score de régularité</div>
  <div class="card">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
      <span style="font-size:13px;font-weight:700;color:${regColor}">${regLabel}</span>
      <span style="font-size:20px;font-weight:900;color:${regColor}">${regScore}/100</span>
    </div>
    <div class="reg-bar-bg"><div class="reg-bar-fill"></div></div>
  </div>

  <div class="section-title" style="margin-top:24px">KPIs E-Réputation &amp; Réseaux</div>
  <div class="card">
    ${kpiRow('Note Google', `${rating}/5`, `${totalReviews} avis`)}
    ${kpiRow('Avis sans réponse', unanswered > 0 ? `${unanswered} non répondus` : 'Tous répondus ✓', unanswered > 0 ? '⚠ Risque e-réputation' : '')}
    ${replyRate !== null ? kpiRow('Taux de réponse', `<span style="color:${replyColor};font-weight:800">${replyRate}%</span>`, replyRate >= 80 ? 'Excellent' : replyRate >= 50 ? 'À améliorer' : 'Insuffisant') : ''}
    ${tonalite ? kpiRow('Tonalité avis', esc(tonalite.split(' — ')[0] || tonalite), '') : ''}
    ${kpiRow('Abonnés Instagram', igFoll !== null ? igFoll.toLocaleString('fr-FR') : '—', igDays !== null ? `(dernier post il y a ${igDays}j)` : '')}
    ${kpiRow('Abonnés Facebook', fbFoll !== null ? fbFoll.toLocaleString('fr-FR') : '—', fbDays !== null ? `(dernier post il y a ${fbDays}j)` : '')}
    ${igAvgLikes !== null ? kpiRow('Likes moyens / post IG', igAvgLikes.toLocaleString('fr-FR'), igPostsMo !== null ? `${igPostsMo} posts/mois` : '') : ''}
    ${igTopHash.length > 0 ? kpiRow('Top hashtags IG', igTopHash.slice(0, 3).join(' · '), '') : ''}
    ${kpiRow('Photos Google', `${photoCount} (${photoQualityLabel})`, '')}
  </div>

  <div class="section-title" style="margin-top:24px">Forces / Faiblesses</div>
  <div class="grid-2">
    <div>
      <div class="card-title">✅ Forces</div>
      ${forceFaiblCard(forces, '#16a34a')}
    </div>
    <div>
      <div class="card-title">⚠️ Faiblesses</div>
      ${forceFaiblCard(faiblesses, '#dc2626')}
    </div>
  </div>

  <div class="page-footer">Rapport généré via LeadGenPro · ${businessName} · ${date}</div>
</div>

<!-- PAGE 3 — OPPORTUNITÉS + RECOMMANDATIONS -->
<div class="page-break">

  <div class="section-title">Opportunités identifiées</div>
  ${opportunites.slice(0, 3).map(o => `
  <div class="opp-item">
    <div class="opp-icon">📈</div>
    <div class="opp-content">
      <div class="opp-label">${esc(o.label ?? '')}</div>
      <div class="opp-detail">${esc(o.detail ?? '')}</div>
    </div>
  </div>`).join('')}

  <div class="section-title" style="margin-top:24px">Plan d'action recommandé</div>
  ${recommandations.slice(0, 3).map((r, i) => `
  <div class="rec-item">
    <div class="rec-num">${i + 1}</div>
    <div class="rec-content">
      <div class="rec-title">${esc(r.titre ?? '')}</div>
      <div class="rec-detail">${esc(r.description ?? '')}</div>
    </div>
  </div>`).join('')}

  ${comparaison ? `
  <div class="section-title" style="margin-top:28px">6 · Positionnement concurrentiel</div>
  <div class="card">
    <div class="stat-row"><span class="stat-label" style="font-weight:600">Position</span><span class="stat-value" style="font-size:11px;max-width:260px;text-align:right">${esc(comparaison.position)}</span></div>
    ${(comparaison.avantages?.length ?? 0) > 0 ? `<div style="margin-top:8px"><div class="card-title" style="color:#16a34a">Points forts</div>${comparaison.avantages.map(a => `<div class="stat-row"><span class="stat-label">✓ ${esc(a)}</span></div>`).join('')}</div>` : ''}
    ${(comparaison.retards?.length ?? 0) > 0 ? `<div style="margin-top:8px"><div class="card-title" style="color:#dc2626">Points en retard</div>${comparaison.retards.map(r => `<div class="stat-row"><span class="stat-label">→ ${esc(r)}</span></div>`).join('')}</div>` : ''}
  </div>` : ''}

  ${timeline ? `
  <div class="section-title" style="margin-top:28px">7 · Calendrier de mise en oeuvre</div>
  <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px">
    <div class="card"><div class="card-title">Semaine 1</div><div style="font-size:10.5px;color:#64748b;line-height:1.5">${esc(timeline.semaine_1)}</div></div>
    <div class="card"><div class="card-title">Semaines 2–3</div><div style="font-size:10.5px;color:#64748b;line-height:1.5">${esc(timeline.semaine_2_3)}</div></div>
    <div class="card"><div class="card-title">Mois 2–3</div><div style="font-size:10.5px;color:#64748b;line-height:1.5">${esc(timeline.mois_2_3)}</div></div>
  </div>` : ''}

  <div class="cta-block">
    <div class="cta-badge">Passons à l'action</div>
    <div class="cta-headline">${accroche || 'Chaque client satisfait est un contenu — apprenons à le montrer.'}</div>
    <div class="cta-sub">Discutons de vos priorités — sans engagement.</div>
    <div class="cta-grid">
      <div class="cta-item"><div class="cta-item-icon">📱</div><div class="cta-item-text">Ligne éditoriale sur mesure</div></div>
      <div class="cta-item"><div class="cta-item-icon">💬</div><div class="cta-item-text">Gestion des avis &amp; interactions</div></div>
      <div class="cta-item"><div class="cta-item-icon">🎬</div><div class="cta-item-text">Contenus visuels et vidéos</div></div>
      <div class="cta-item"><div class="cta-item-icon">📊</div><div class="cta-item-text">Reporting mensuel</div></div>
    </div>
    <div style="margin-top:20px;padding-top:16px;border-top:1px solid rgba(255,255,255,0.1);font-size:10px;color:rgba(255,255,255,0.45);text-align:right;font-style:italic">
      Community Manager${city ? ' — ' + city : ''}
    </div>
  </div>

  <div class="page-footer">Rapport généré via LeadGenPro · ${date}</div>
</div>

</body>
</html>`

  const container = document.createElement('div')
  container.style.cssText = 'position:fixed;left:-9999px;top:0;width:794px;z-index:-1'
  container.innerHTML = html
  document.body.appendChild(container)

  try {
    const canvas = await html2canvasLib(container, { scale: 2, useCORS: true, allowTaint: true, backgroundColor: '#ffffff', width: 794, windowWidth: 794 })
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
    const pageWidthMm = 210, pageHeightMm = 297
    const pxPerMm     = canvas.width / pageWidthMm
    const pageHeightPx = Math.round(pageHeightMm * pxPerMm)
    const imgHeightMm  = (canvas.height * pageWidthMm) / canvas.width
    const totalPages   = Math.ceil(imgHeightMm / pageHeightMm)
    let firstPage = true
    for (let i = 0; i < totalPages; i++) {
      const srcY = i * pageHeightPx
      const srcH = Math.min(pageHeightPx, canvas.height - srcY)
      if (srcH < pageHeightPx * 0.10) continue
      if (!firstPage) pdf.addPage()
      firstPage = false
      const slice = document.createElement('canvas')
      slice.width = canvas.width; slice.height = pageHeightPx
      const ctx = slice.getContext('2d')
      ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, slice.width, slice.height)
      ctx.drawImage(canvas, 0, srcY, canvas.width, srcH, 0, 0, canvas.width, srcH)
      pdf.addImage(slice.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, pageWidthMm, pageHeightMm)
    }
    const fileName = `AuditSocialMedia-${(lead.name ?? 'prospect').replace(/[^a-zA-Z0-9]/g, '-')}-${new Date().toISOString().slice(0, 10)}.pdf`
    pdf.save(fileName)
  } finally {
    document.body.removeChild(container)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// exportAuditDesignerPDF — Rapport "Audit Branding & Identité Visuelle"
// Page 1 : Couverture dark violet + nom business + score branding
// Page 2 : Résumé exécutif + réseaux visuels + KPIs + forces/faiblesses
// Page 3 : Opportunités + recommandations + CTA
// ─────────────────────────────────────────────────────────────────────────────
export async function exportAuditDesignerPDF({ lead, activeProfile, designerAudit, auditData }) {
  const { jsPDF }      = await import('jspdf')
  const html2canvasLib = (await import('html2canvas')).default

  const businessName  = esc(lead.name ?? 'Ce commerce')
  const score         = lead.score?.total ?? 0
  const rating        = lead.google?.rating       ?? '—'
  const totalReviews  = lead.google?.totalReviews ?? 0
  const photoCount    = lead.googleAudit?.photoCount ?? 0
  const date          = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
  const city          = (lead.address ?? '').split(',').pop()?.trim() || ''
  const sColor        = score >= 75 ? '#22c55e' : score >= 50 ? '#f59e0b' : '#ef4444'

  const resumeExecutif  = esc(designerAudit?.resume_executif ?? '')
  const forces          = designerAudit?.forces          ?? []
  const faiblesses      = designerAudit?.faiblesses      ?? []
  const opportunites    = designerAudit?.opportunites    ?? []
  const recommandations = designerAudit?.recommandations ?? []
  const accroche        = esc(designerAudit?.accroche    ?? '')
  const comparaison     = designerAudit?.comparaison_concurrents ?? null
  const timeline        = designerAudit?.timeline ?? null
  const titreAudit      = esc(designerAudit?.titre_audit ?? 'Audit Identité Visuelle & Branding')

  const igActivity = auditData?.instagramActivity ?? null
  const igFoll     = igActivity?.followers ?? null
  const igDays     = igActivity?.daysAgo   ?? null

  const VISUAL_NETWORKS = [
    { key: 'instagram', label: 'Instagram', color: '#e1306c' },
    { key: 'facebook',  label: 'Facebook',  color: '#1877f2' },
    { key: 'pinterest', label: 'Pinterest', color: '#e60023' },
    { key: 'tiktok',    label: 'TikTok',    color: '#010101' },
    { key: 'linkedin',  label: 'LinkedIn',  color: '#0a66c2' },
  ]
  const presentNets = VISUAL_NETWORKS.filter(n => !!(lead.social?.[n.key]))
  const missingNets = VISUAL_NETWORKS.filter(n => !(lead.social?.[n.key]))

  // Branding score (mirrors scoring.js brandingScore)
  const visualNetCount = [lead.social?.facebook, lead.social?.instagram, lead.social?.pinterest].filter(Boolean).length
  const BASE = [0, 20, 45, 75]
  let brandScore = BASE[Math.min(visualNetCount, 3)]
  if (photoCount >= 10)                        brandScore += 15
  else if (photoCount >= 5)                    brandScore += 7
  if (lead.googleAudit?.hasDescription)        brandScore += 10
  if (lead.website && lead.website !== 'null') brandScore += 10
  brandScore = Math.max(0, Math.min(100, brandScore))
  const brandLabel = brandScore >= 80 ? 'Image forte' : brandScore >= 60 ? 'Image correcte' : brandScore >= 40 ? 'Image à améliorer' : brandScore >= 20 ? 'Image insuffisante' : 'Identité absente'
  const brandColor = brandScore >= 60 ? '#22c55e' : brandScore >= 40 ? '#f59e0b' : '#ef4444'

  const photoQualityLabel = photoCount === 0 ? 'Aucune' : photoCount <= 5 ? 'Insuffisant' : photoCount <= 15 ? 'Basique' : photoCount <= 30 ? 'Correct' : 'Excellent'

  const networkBadge = (n, present) => `
    <span style="display:inline-flex;align-items:center;gap:4px;padding:4px 10px;border-radius:20px;font-size:10px;font-weight:700;margin:3px;
      background:${present ? n.color + '18' : '#f1f5f9'};color:${present ? n.color : '#94a3b8'};
      border:1px solid ${present ? n.color + '44' : '#e2e8f0'}">
      ${esc(n.label)}
    </span>`

  const kpiRow = (label, value, note) => `
    <div class="stat-row">
      <span class="stat-label">${label}</span>
      <span class="stat-value">${value}${note ? `<span style="font-size:9px;color:#94a3b8;font-weight:400"> ${note}</span>` : ''}</span>
    </div>`

  const forceFaiblCard = (items, color) => items.slice(0, 3).map(item => `
    <div class="ff-item" style="border-left-color:${color}">
      <div class="ff-title">${esc(item.titre ?? '')}</div>
      <div class="ff-desc">${esc(item.description ?? '')}</div>
    </div>`).join('')

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<title>Audit Designer — ${businessName}</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:'Segoe UI',system-ui,sans-serif; background:#fff; color:#0f172a; }
  .cover { width:100%; height:1123px; background:linear-gradient(145deg,#0d1410 0%,#0a0f1a 55%,#0d0a1a 100%); display:flex; flex-direction:column; justify-content:space-between; padding:56px 60px 0 60px; position:relative; overflow:hidden; page-break-after:always; }
  .cover::before { content:''; position:absolute; inset:0; background:radial-gradient(ellipse 50% 50% at 80% 20%,#a78bfa14 0%,transparent 65%),radial-gradient(ellipse 35% 35% at 15% 75%,#1d6e5510 0%,transparent 55%); pointer-events:none; }
  .cover-logo { font-size:8px; font-weight:700; letter-spacing:3px; text-transform:uppercase; color:rgba(255,255,255,0.3); }
  .cover-eyebrow { font-size:10px; font-weight:700; letter-spacing:5px; text-transform:uppercase; color:#a78bfa; margin-bottom:12px; }
  .cover-title { font-size:42px; font-weight:900; color:#fff; line-height:1.0; letter-spacing:-1.5px; }
  .cover-subtitle { font-size:16px; font-weight:600; color:#7c3aed; letter-spacing:0.5px; margin-top:8px; }
  .cover-business { font-size:26px; font-weight:700; color:rgba(255,255,255,0.85); line-height:1.2; max-width:460px; letter-spacing:-0.3px; margin-top:28px; }
  .cover-main { flex:1; display:flex; flex-direction:column; justify-content:center; gap:0; }
  .cover-score-ring { width:110px; height:110px; border-radius:50%; border:4px solid ${brandColor}; display:flex; align-items:center; justify-content:center; flex-direction:column; box-shadow:0 0 36px ${brandColor}44,0 0 70px ${brandColor}18; background:${brandColor}0d; margin-top:36px; }
  .cover-score-number { font-size:32px; font-weight:900; color:${brandColor}; line-height:1; }
  .cover-score-label  { font-size:8px; color:rgba(255,255,255,0.4); letter-spacing:2px; margin-top:2px; }
  .cover-score-row { display:flex; align-items:center; gap:20px; margin-top:36px; }
  .cover-score-meta { display:flex; flex-direction:column; gap:8px; }
  .cover-score-meta-item { display:flex; flex-direction:column; gap:1px; }
  .cover-score-meta-label { font-size:8px; color:rgba(255,255,255,0.3); text-transform:uppercase; letter-spacing:2px; }
  .cover-score-meta-value { font-size:13px; color:rgba(255,255,255,0.82); font-weight:700; }
  .cover-footer { padding-bottom:32px; display:flex; flex-direction:column; gap:5px; }
  .cover-date { font-size:10px; color:rgba(255,255,255,0.25); }
  .report { padding:48px 52px; }
  .page-break { page-break-before:always; padding:48px 52px; }
  .section-title { font-size:8.5px; font-weight:800; letter-spacing:3.5px; text-transform:uppercase; color:#7c3aed; border-bottom:2px solid #7c3aed; padding-bottom:7px; margin-bottom:18px; margin-top:32px; }
  .section-title:first-child { margin-top:0; }
  .exec-box { background:linear-gradient(135deg,#f5f3ff,#f8fafc); border:1px solid #ddd6fe; border-left:3px solid #7c3aed; border-radius:8px; padding:16px 18px; font-size:11.5px; line-height:1.8; color:#1e293b; }
  .grid-2 { display:grid; grid-template-columns:1fr 1fr; gap:14px; }
  .card { background:#f8fafc; border-radius:10px; padding:16px 18px; border:1px solid #e2e8f0; }
  .card-title { font-size:8.5px; color:#94a3b8; text-transform:uppercase; letter-spacing:2px; font-weight:700; margin-bottom:12px; }
  .ff-item { padding:10px 14px; border-left:3px solid; border-radius:0 8px 8px 0; background:#f8fafc; margin-bottom:8px; }
  .ff-title { font-size:11.5px; font-weight:700; color:#0f172a; margin-bottom:3px; }
  .ff-desc  { font-size:10px; color:#64748b; line-height:1.5; }
  .stat-row { display:flex; justify-content:space-between; align-items:center; padding:8px 0; border-bottom:1px solid #f1f5f9; }
  .stat-row:last-child { border-bottom:none; }
  .stat-label { font-size:11px; color:#64748b; }
  .stat-value { font-size:12px; font-weight:700; color:#0f172a; }
  .brand-bar-bg { background:#e2e8f0; border-radius:4px; height:8px; overflow:hidden; margin-top:8px; }
  .brand-bar-fill { height:8px; border-radius:4px; background:${brandColor}; width:${brandScore}%; }
  .opp-item { display:flex; gap:12px; align-items:flex-start; padding:10px 14px; border-radius:8px; border:1px solid #e2e8f0; margin-bottom:8px; background:#fafbfc; }
  .opp-icon { font-size:16px; flex-shrink:0; }
  .opp-content { flex:1; }
  .opp-label  { font-size:11.5px; font-weight:700; color:#0f172a; margin-bottom:2px; }
  .opp-detail { font-size:10px; color:#64748b; line-height:1.5; }
  .rec-item { padding:13px 16px; border-radius:10px; border:1px solid #e2e8f0; margin-bottom:8px; background:#f8fafc; display:flex; gap:14px; align-items:flex-start; }
  .rec-num { width:24px; height:24px; border-radius:50%; background:#7c3aed; color:#fff; font-size:11px; font-weight:800; display:flex; align-items:center; justify-content:center; flex-shrink:0; margin-top:1px; }
  .rec-content { flex:1; }
  .rec-title  { font-size:12px; font-weight:700; color:#0f172a; margin-bottom:3px; }
  .rec-detail { font-size:10.5px; color:#64748b; line-height:1.5; }
  .cta-block { background:linear-gradient(135deg,#0d0a1a 0%,#0a0e1a 100%); border:1px solid #7c3aed40; border-radius:12px; padding:22px 28px; margin-top:16px; }
  .cta-badge    { display:inline-block; background:#a78bfa; color:#0d0a1a; font-size:8px; font-weight:800; letter-spacing:1.5px; text-transform:uppercase; padding:3px 10px; border-radius:4px; margin-bottom:12px; }
  .cta-headline { font-size:18px; font-weight:800; color:#fff; margin-bottom:6px; }
  .cta-sub      { font-size:11px; color:rgba(255,255,255,0.6); margin-bottom:20px; line-height:1.5; }
  .cta-grid     { display:grid; grid-template-columns:1fr 1fr; gap:10px; }
  .cta-item     { display:flex; align-items:center; gap:9px; }
  .cta-item-icon { font-size:14px; flex-shrink:0; }
  .cta-item-text { font-size:11px; color:rgba(255,255,255,0.85); font-weight:600; }
  .page-footer { font-size:7.5px; color:rgba(0,0,0,0.18); text-align:center; margin-top:32px; letter-spacing:0.5px; }
  .card,.ff-item,.opp-item,.rec-item,.cta-block,.exec-box,.grid-2 { page-break-inside:avoid; break-inside:avoid; }
  @media print { body { -webkit-print-color-adjust:exact; print-color-adjust:exact; } @page { size:A4 portrait; margin:0; } }
</style>
</head>
<body>

<!-- PAGE 1 — COUVERTURE -->
<div class="cover">
  <div class="cover-logo">LeadGenPro</div>
  <div class="cover-main">
    <div>
      <div class="cover-eyebrow">Audit prospect</div>
      <div class="cover-title">Branding<br>&amp; Design</div>
      <div class="cover-subtitle">${titreAudit}</div>
      <div class="cover-business">${businessName}</div>
    </div>
    <div class="cover-score-row">
      <div class="cover-score-ring">
        <div class="cover-score-number">${brandScore}</div>
        <div class="cover-score-label">IMAGE</div>
      </div>
      <div class="cover-score-meta">
        <div class="cover-score-meta-item">
          <div class="cover-score-meta-label">Note Google</div>
          <div class="cover-score-meta-value">${rating}/5</div>
        </div>
        <div class="cover-score-meta-item">
          <div class="cover-score-meta-label">Photos Google</div>
          <div class="cover-score-meta-value">${photoCount}</div>
        </div>
        <div class="cover-score-meta-item">
          <div class="cover-score-meta-label">Réseaux visuels</div>
          <div class="cover-score-meta-value">${presentNets.length} / ${VISUAL_NETWORKS.length}</div>
        </div>
      </div>
    </div>
  </div>
  <div class="cover-footer">
    <div class="cover-date">${date}${city ? ' · ' + city : ''}</div>
  </div>
</div>

<!-- PAGE 2 — ANALYSE -->
<div class="report">

  <div class="section-title">Résumé exécutif</div>
  <div class="exec-box">${resumeExecutif || 'Analyse en cours de génération.'}</div>

  <div class="section-title" style="margin-top:24px">Présence sur les réseaux visuels</div>
  <div style="margin-bottom:8px">
    ${presentNets.map(n => networkBadge(n, true)).join('')}
    ${missingNets.map(n => networkBadge(n, false)).join('')}
  </div>

  <div class="section-title" style="margin-top:24px">Score d'image de marque</div>
  <div class="card">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
      <span style="font-size:13px;font-weight:700;color:${brandColor}">${brandLabel}</span>
      <span style="font-size:20px;font-weight:900;color:${brandColor}">${brandScore}/100</span>
    </div>
    <div class="brand-bar-bg"><div class="brand-bar-fill"></div></div>
  </div>

  <div class="section-title" style="margin-top:24px">KPIs visuels</div>
  <div class="card">
    ${kpiRow('Photos Google', `${photoCount} (${photoQualityLabel})`, '')}
    ${kpiRow('Abonnés Instagram', igFoll !== null ? igFoll.toLocaleString('fr-FR') : '—', igDays !== null ? `(dernier post il y a ${igDays}j)` : '')}
    ${kpiRow('Note Google', `${rating}/5`, `${totalReviews} avis`)}
    ${kpiRow('Description fiche', lead.googleAudit?.hasDescription ? '✅ Présente' : '❌ Absente', '')}
    ${kpiRow('Site web', (lead.website && lead.website !== 'null') ? '✅ Présent' : '❌ Absent', '')}
  </div>

  <div class="section-title" style="margin-top:24px">Forces / Faiblesses</div>
  <div class="grid-2">
    <div>
      <div class="card-title">✅ Forces</div>
      ${forceFaiblCard(forces, '#16a34a')}
    </div>
    <div>
      <div class="card-title">⚠️ Faiblesses</div>
      ${forceFaiblCard(faiblesses, '#dc2626')}
    </div>
  </div>

  <div class="page-footer">LeadGenPro · Audit Branding — ${businessName} · ${date}</div>
</div>

<!-- PAGE 3 — OPPORTUNITÉS + RECOMMANDATIONS -->
<div class="page-break">

  <div class="section-title">Opportunités identifiées</div>
  ${opportunites.slice(0, 3).map(o => `
  <div class="opp-item">
    <div class="opp-icon">🎨</div>
    <div class="opp-content">
      <div class="opp-label">${esc(o.titre ?? o.label ?? '')}</div>
      <div class="opp-detail">${esc(o.description ?? o.detail ?? '')}</div>
    </div>
  </div>`).join('')}

  <div class="section-title" style="margin-top:24px">Plan d'action recommandé</div>
  ${recommandations.slice(0, 3).map((r, i) => `
  <div class="rec-item">
    <div class="rec-num">${i + 1}</div>
    <div class="rec-content">
      <div class="rec-title">${esc(r.titre ?? '')}</div>
      <div class="rec-detail">${esc(r.description ?? '')}</div>
    </div>
  </div>`).join('')}

  ${comparaison ? `
  <div class="section-title" style="margin-top:28px">6 · Positionnement concurrentiel</div>
  <div class="card">
    <div class="stat-row"><span class="stat-label" style="font-weight:600">Position</span><span class="stat-value" style="font-size:11px;max-width:260px;text-align:right">${esc(comparaison.position)}</span></div>
    ${(comparaison.avantages?.length ?? 0) > 0 ? `<div style="margin-top:8px"><div class="card-title" style="color:#16a34a">Points forts</div>${comparaison.avantages.map(a => `<div class="stat-row"><span class="stat-label">✓ ${esc(a)}</span></div>`).join('')}</div>` : ''}
    ${(comparaison.retards?.length ?? 0) > 0 ? `<div style="margin-top:8px"><div class="card-title" style="color:#dc2626">Points en retard</div>${comparaison.retards.map(r => `<div class="stat-row"><span class="stat-label">→ ${esc(r)}</span></div>`).join('')}</div>` : ''}
  </div>` : ''}

  ${timeline ? `
  <div class="section-title" style="margin-top:28px">7 · Calendrier de mise en oeuvre</div>
  <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px">
    <div class="card"><div class="card-title">Semaine 1</div><div style="font-size:10.5px;color:#64748b;line-height:1.5">${esc(timeline.semaine_1)}</div></div>
    <div class="card"><div class="card-title">Semaines 2–3</div><div style="font-size:10.5px;color:#64748b;line-height:1.5">${esc(timeline.semaine_2_3)}</div></div>
    <div class="card"><div class="card-title">Mois 2–3</div><div style="font-size:10.5px;color:#64748b;line-height:1.5">${esc(timeline.mois_2_3)}</div></div>
  </div>` : ''}

  <div class="cta-block">
    <div class="cta-badge">Proposition</div>
    <div class="cta-headline">${accroche || 'Votre réputation mérite une image à sa hauteur.'}</div>
    <div class="cta-sub">Discutons de vos priorités — sans engagement.</div>
    <div class="cta-grid">
      <div class="cta-item"><div class="cta-item-icon">🎨</div><div class="cta-item-text">Charte graphique sur mesure</div></div>
      <div class="cta-item"><div class="cta-item-icon">📸</div><div class="cta-item-text">Visuels professionnels</div></div>
      <div class="cta-item"><div class="cta-item-icon">📱</div><div class="cta-item-text">Templates réseaux sociaux</div></div>
      <div class="cta-item"><div class="cta-item-icon">🌐</div><div class="cta-item-text">Cohérence digitale complète</div></div>
    </div>
  </div>

  <div class="page-footer">LeadGenPro · Audit Branding — ${businessName} · ${date}</div>
</div>

</body>
</html>`

  const container = document.createElement('div')
  container.style.cssText = 'position:fixed;left:-9999px;top:0;width:794px;z-index:-1'
  container.innerHTML = html
  document.body.appendChild(container)

  try {
    const canvas = await html2canvasLib(container, { scale: 2, useCORS: true, allowTaint: true, backgroundColor: '#ffffff', width: 794, windowWidth: 794 })
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
    const pageWidthMm = 210, pageHeightMm = 297
    const pxPerMm     = canvas.width / pageWidthMm
    const pageHeightPx = Math.round(pageHeightMm * pxPerMm)
    const imgHeightMm  = (canvas.height * pageWidthMm) / canvas.width
    const totalPages   = Math.ceil(imgHeightMm / pageHeightMm)
    let firstPage = true
    for (let i = 0; i < totalPages; i++) {
      const srcY = i * pageHeightPx
      const srcH = Math.min(pageHeightPx, canvas.height - srcY)
      if (srcH < pageHeightPx * 0.10) continue
      if (!firstPage) pdf.addPage()
      firstPage = false
      const slice = document.createElement('canvas')
      slice.width = canvas.width; slice.height = pageHeightPx
      const ctx = slice.getContext('2d')
      ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, slice.width, slice.height)
      ctx.drawImage(canvas, 0, srcY, canvas.width, srcH, 0, 0, canvas.width, srcH)
      pdf.addImage(slice.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, pageWidthMm, pageHeightMm)
    }
    const fileName = `AuditDesigner-${(lead.name ?? 'prospect').replace(/[^a-zA-Z0-9]/g, '-')}-${new Date().toISOString().slice(0, 10)}.pdf`
    pdf.save(fileName)
  } finally {
    document.body.removeChild(container)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// exportAuditWebDevPDF — Rapport "Audit Technique Web"
// Page 1 : Couverture dark blue/cyan + nom business + score technique
// Page 2 : Résumé exécutif + métriques perf + sécurité + stack + forces/faiblesses
// Page 3 : Opportunités + recommandations + CTA
// ─────────────────────────────────────────────────────────────────────────────
export async function exportAuditWebDevPDF({ lead, activeProfile, webDevAudit, auditData, visualAnalysis }) {
  const { jsPDF }      = await import('jspdf')
  const html2canvasLib = (await import('html2canvas')).default

  const businessName  = esc(lead.name ?? 'Ce commerce')
  const score         = lead.score?.total ?? 0
  const rating        = lead.google?.rating       ?? '—'
  const totalReviews  = lead.google?.totalReviews ?? 0
  const date          = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
  const city          = (lead.address ?? '').split(',').pop()?.trim() || ''
  const hasWebsite    = !!(lead.website && !['null', 'undefined', ''].includes(String(lead.website)))

  const resumeExecutif  = esc(webDevAudit?.resume_executif ?? '')
  const forces          = webDevAudit?.forces          ?? []
  const faiblesses      = webDevAudit?.faiblesses      ?? []
  const opportunites    = webDevAudit?.opportunites    ?? []
  const recommandations = webDevAudit?.recommandations ?? []
  const accroche        = esc(webDevAudit?.accroche    ?? '')
  const comparaison     = webDevAudit?.comparaison_concurrents ?? null
  const timeline        = webDevAudit?.timeline ?? null
  const titreAudit      = esc(webDevAudit?.titre_audit ?? 'Audit Technique & Performance Web')

  const ps            = auditData?.pagespeed ?? null
  const rawPerf       = ps?.performance
  const perfScore     = rawPerf != null ? (rawPerf <= 1 ? Math.round(rawPerf * 100) : Math.round(rawPerf)) : null
  const loadTime      = ps?.loadTime ?? null
  const hasHttps      = ps?.https ?? false
  const hasSitemap    = ps?.sitemap ?? false
  const hasRobots     = ps?.robots ?? false
  const cmsRaw        = ps?.cms?.cms ?? null
  const CMS_NAMES     = { wordpress: 'WordPress', shopify: 'Shopify', webflow: 'Webflow', wix: 'Wix', squarespace: 'Squarespace', jimdo: 'Jimdo' }
  const cmsLabel      = cmsRaw ? (CMS_NAMES[cmsRaw] ?? cmsRaw) : null
  const accessibility = ps?.accessibility ?? null
  const perfDesktop   = ps?.performanceDesktop ?? ps?.desktopPerf ?? null
  const domainAge     = ps?.domainAge ?? null
  const indexedPages  = ps?.indexedPages ?? null

  // Visual analysis data
  const visScore    = visualAnalysis?.score    ?? null
  const visVerdict  = visualAnalysis?.verdict  ?? null
  const visEpoch    = visualAnalysis?.epoch    ?? null
  const visObs      = visualAnalysis?.observations ?? []
  const visShot     = visualAnalysis?.screenshot   ?? null  // base64 PNG
  const visColor    = visScore != null ? (visScore >= 65 ? '#16a34a' : visScore >= 40 ? '#d97706' : '#dc2626') : '#64748b'

  // webDev score (mirrors scoring.js webDevScore)
  let wdScore = hasWebsite ? 20 : 0
  if (hasHttps)    wdScore += 15
  if (perfScore != null) wdScore += perfScore >= 80 ? 20 : perfScore >= 50 ? 10 : 5
  if (hasSitemap)  wdScore += 10
  if (hasRobots)   wdScore += 10
  if (accessibility != null && accessibility >= 80) wdScore += 10
  wdScore = Math.min(100, wdScore)
  const wdLabel  = wdScore === 0 ? 'Inexistant' : wdScore < 30 ? 'Critique' : wdScore < 60 ? 'Basique' : wdScore < 80 ? 'Correct' : 'Optimisé'
  const wdColor  = wdScore >= 80 ? '#22c55e' : wdScore >= 60 ? '#f59e0b' : '#ef4444'

  const accentColor = '#00d4ff'
  const secColor    = '#0284c7'

  const kpiRow = (label, value, ok) => `
    <div class="stat-row">
      <span class="stat-label">${label}</span>
      <span class="stat-value" style="color:${ok === true ? '#16a34a' : ok === false ? '#dc2626' : '#0f172a'}">${value}</span>
    </div>`

  const forceFaiblCard = (items, color) => items.slice(0, 3).map(item => `
    <div class="ff-item" style="border-left-color:${color}">
      <div class="ff-title">${esc(item.titre ?? '')}</div>
      <div class="ff-desc">${esc(item.description ?? '')}</div>
    </div>`).join('')

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<title>Audit Web — ${businessName}</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:'Segoe UI',system-ui,sans-serif; background:#fff; color:#0f172a; }
  .cover { width:100%; height:1123px; background:linear-gradient(145deg,#060d1a 0%,#0a1628 55%,#071224 100%); display:flex; flex-direction:column; justify-content:space-between; padding:56px 60px 0 60px; position:relative; overflow:hidden; page-break-after:always; }
  .cover::before { content:''; position:absolute; inset:0; background:radial-gradient(ellipse 50% 50% at 80% 20%,${accentColor}18 0%,transparent 65%),radial-gradient(ellipse 35% 35% at 15% 75%,#0ea5e910 0%,transparent 55%); pointer-events:none; }
  .cover-logo { font-size:8px; font-weight:700; letter-spacing:3px; text-transform:uppercase; color:rgba(255,255,255,0.3); }
  .cover-eyebrow { font-size:10px; font-weight:700; letter-spacing:5px; text-transform:uppercase; color:${accentColor}; margin-bottom:12px; }
  .cover-title { font-size:42px; font-weight:900; color:#fff; line-height:1.0; letter-spacing:-1.5px; }
  .cover-subtitle { font-size:16px; font-weight:600; color:${secColor}; letter-spacing:0.5px; margin-top:8px; }
  .cover-business { font-size:26px; font-weight:700; color:rgba(255,255,255,0.85); line-height:1.2; max-width:460px; letter-spacing:-0.3px; margin-top:28px; }
  .cover-main { flex:1; display:flex; flex-direction:column; justify-content:center; gap:0; }
  .cover-score-ring { width:110px; height:110px; border-radius:50%; border:4px solid ${wdColor}; display:flex; align-items:center; justify-content:center; flex-direction:column; box-shadow:0 0 36px ${wdColor}44,0 0 70px ${wdColor}18; background:${wdColor}0d; margin-top:36px; }
  .cover-score-number { font-size:32px; font-weight:900; color:${wdColor}; line-height:1; }
  .cover-score-label  { font-size:8px; color:rgba(255,255,255,0.4); letter-spacing:2px; margin-top:2px; }
  .cover-score-row { display:flex; align-items:center; gap:20px; margin-top:36px; }
  .cover-score-meta { display:flex; flex-direction:column; gap:8px; }
  .cover-score-meta-item { display:flex; flex-direction:column; gap:1px; }
  .cover-score-meta-label { font-size:8px; color:rgba(255,255,255,0.3); text-transform:uppercase; letter-spacing:2px; }
  .cover-score-meta-value { font-size:13px; color:rgba(255,255,255,0.82); font-weight:700; }
  .cover-footer { padding-bottom:32px; display:flex; flex-direction:column; gap:5px; }
  .cover-date { font-size:10px; color:rgba(255,255,255,0.25); }
  .report { padding:48px 52px; }
  .page-break { page-break-before:always; padding:48px 52px; }
  .section-title { font-size:8.5px; font-weight:800; letter-spacing:3.5px; text-transform:uppercase; color:${secColor}; border-bottom:2px solid ${secColor}; padding-bottom:7px; margin-bottom:18px; margin-top:32px; }
  .section-title:first-child { margin-top:0; }
  .exec-box { background:linear-gradient(135deg,#f0f9ff,#f8fafc); border:1px solid #bae6fd; border-left:3px solid ${secColor}; border-radius:8px; padding:16px 18px; font-size:11.5px; line-height:1.8; color:#1e293b; }
  .grid-2 { display:grid; grid-template-columns:1fr 1fr; gap:14px; }
  .card { background:#f8fafc; border-radius:10px; padding:16px 18px; border:1px solid #e2e8f0; }
  .card-title { font-size:8.5px; color:#94a3b8; text-transform:uppercase; letter-spacing:2px; font-weight:700; margin-bottom:12px; }
  .ff-item { padding:10px 14px; border-left:3px solid; border-radius:0 8px 8px 0; background:#f8fafc; margin-bottom:8px; }
  .ff-title { font-size:11.5px; font-weight:700; color:#0f172a; margin-bottom:3px; }
  .ff-desc  { font-size:10px; color:#64748b; line-height:1.5; }
  .stat-row { display:flex; justify-content:space-between; align-items:center; padding:8px 0; border-bottom:1px solid #f1f5f9; }
  .stat-row:last-child { border-bottom:none; }
  .stat-label { font-size:11px; color:#64748b; }
  .stat-value { font-size:12px; font-weight:700; color:#0f172a; }
  .wd-bar-bg { background:#e2e8f0; border-radius:4px; height:8px; overflow:hidden; margin-top:8px; }
  .wd-bar-fill { height:8px; border-radius:4px; background:${wdColor}; width:${wdScore}%; }
  .badge-ok  { display:inline-block; padding:2px 8px; border-radius:4px; font-size:9px; font-weight:700; background:#dcfce7; color:#16a34a; }
  .badge-ko  { display:inline-block; padding:2px 8px; border-radius:4px; font-size:9px; font-weight:700; background:#fee2e2; color:#dc2626; }
  .opp-item { display:flex; gap:12px; align-items:flex-start; padding:10px 14px; border-radius:8px; border:1px solid #e2e8f0; margin-bottom:8px; background:#fafbfc; }
  .opp-icon { font-size:16px; flex-shrink:0; }
  .opp-content { flex:1; }
  .opp-label  { font-size:11.5px; font-weight:700; color:#0f172a; margin-bottom:2px; }
  .opp-detail { font-size:10px; color:#64748b; line-height:1.5; }
  .rec-item { padding:13px 16px; border-radius:10px; border:1px solid #e2e8f0; margin-bottom:8px; background:#f8fafc; display:flex; gap:14px; align-items:flex-start; }
  .rec-num { width:24px; height:24px; border-radius:50%; background:${secColor}; color:#fff; font-size:11px; font-weight:800; display:flex; align-items:center; justify-content:center; flex-shrink:0; margin-top:1px; }
  .rec-content { flex:1; }
  .rec-title  { font-size:12px; font-weight:700; color:#0f172a; margin-bottom:3px; }
  .rec-detail { font-size:10.5px; color:#64748b; line-height:1.5; }
  .cta-block { background:linear-gradient(135deg,#060d1a 0%,#0a1628 100%); border:1px solid ${accentColor}40; border-radius:12px; padding:22px 28px; margin-top:16px; }
  .cta-badge    { display:inline-block; background:${accentColor}; color:#060d1a; font-size:8px; font-weight:800; letter-spacing:1.5px; text-transform:uppercase; padding:3px 10px; border-radius:4px; margin-bottom:12px; }
  .cta-headline { font-size:18px; font-weight:800; color:#fff; margin-bottom:6px; }
  .cta-sub      { font-size:11px; color:rgba(255,255,255,0.6); margin-bottom:20px; line-height:1.5; }
  .cta-grid     { display:grid; grid-template-columns:1fr 1fr; gap:10px; }
  .cta-item     { display:flex; align-items:center; gap:9px; }
  .cta-item-icon { font-size:14px; flex-shrink:0; }
  .cta-item-text { font-size:11px; color:rgba(255,255,255,0.85); font-weight:600; }
  .page-footer { font-size:7.5px; color:rgba(0,0,0,0.18); text-align:center; margin-top:32px; letter-spacing:0.5px; }
  .card,.ff-item,.opp-item,.rec-item,.cta-block,.exec-box,.grid-2 { page-break-inside:avoid; break-inside:avoid; }
  @media print { body { -webkit-print-color-adjust:exact; print-color-adjust:exact; } @page { size:A4 portrait; margin:0; } }
</style>
</head>
<body>

<!-- PAGE 1 — COUVERTURE -->
<div class="cover">
  <div class="cover-logo">LeadGenPro</div>
  <div class="cover-main">
    <div>
      <div class="cover-eyebrow">Audit prospect</div>
      <div class="cover-title">Technique<br>Web</div>
      <div class="cover-subtitle">${titreAudit}</div>
      <div class="cover-business">${businessName}</div>
    </div>
    <div class="cover-score-row">
      <div class="cover-score-ring">
        <div class="cover-score-number">${wdScore}</div>
        <div class="cover-score-label">SCORE</div>
      </div>
      <div class="cover-score-meta">
        <div class="cover-score-meta-item">
          <div class="cover-score-meta-label">Niveau</div>
          <div class="cover-score-meta-value">${wdLabel}</div>
        </div>
        <div class="cover-score-meta-item">
          <div class="cover-score-meta-label">Note Google</div>
          <div class="cover-score-meta-value">${rating}/5</div>
        </div>
        <div class="cover-score-meta-item">
          <div class="cover-score-meta-label">Site web</div>
          <div class="cover-score-meta-value">${hasWebsite ? 'Présent' : 'Absent'}</div>
        </div>
      </div>
    </div>
  </div>
  <div class="cover-footer">
    <div class="cover-date">${date}${city ? ' · ' + city : ''}</div>
  </div>
</div>

<!-- PAGE 2 — ANALYSE -->
<div class="report">

  <div class="section-title">Résumé exécutif</div>
  <div class="exec-box">${resumeExecutif || 'Analyse en cours de génération.'}</div>

  <div class="section-title" style="margin-top:24px">Score technique global</div>
  <div class="card">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
      <span style="font-size:13px;font-weight:700;color:${wdColor}">${wdLabel}</span>
      <span style="font-size:20px;font-weight:900;color:${wdColor}">${wdScore}/100</span>
    </div>
    <div class="wd-bar-bg"><div class="wd-bar-fill"></div></div>
  </div>

  <div class="section-title" style="margin-top:24px">Métriques de performance</div>
  <div class="card">
    ${kpiRow('Performance mobile', perfScore != null ? `${perfScore}/100` : '—', perfScore != null ? perfScore >= 70 : null)}
    ${kpiRow('Performance desktop', perfDesktop != null ? `${perfDesktop}/100` : '—', perfDesktop != null ? perfDesktop >= 70 : null)}
    ${kpiRow('Chargement', loadTime != null ? `${Number(loadTime).toFixed(1)}s` : '—', loadTime != null ? loadTime <= 3 : null)}
    ${kpiRow('Accessibilité', accessibility != null ? `${Math.round(accessibility)}/100` : '—', accessibility != null ? accessibility >= 80 : null)}
  </div>

  <div class="section-title" style="margin-top:24px">Sécurité &amp; SEO technique</div>
  <div class="card">
    ${kpiRow('HTTPS / SSL', hasHttps ? '✅ Sécurisé' : '❌ Absent', hasHttps)}
    ${kpiRow('Sitemap XML', hasSitemap ? '✅ Présent' : '❌ Absent', hasSitemap)}
    ${kpiRow('Robots.txt', hasRobots ? '✅ Présent' : '❌ Absent', hasRobots)}
    ${kpiRow('CMS détecté', cmsLabel ? cmsLabel : '—', null)}
    ${kpiRow('Âge du domaine', domainAge ? `${domainAge.ageYears ?? '?'} ans` : '—', domainAge ? domainAge.ageYears >= 2 : null)}
    ${kpiRow('Pages indexées', indexedPages ? `${indexedPages.count ?? '?'}` : '—', indexedPages ? indexedPages.signal === 'good' : null)}
  </div>

  <div class="section-title" style="margin-top:24px">Forces / Faiblesses</div>
  <div class="grid-2">
    <div>
      <div class="card-title">✅ Forces</div>
      ${forceFaiblCard(forces, '#16a34a')}
    </div>
    <div>
      <div class="card-title">⚠️ Faiblesses</div>
      ${forceFaiblCard(faiblesses, '#dc2626')}
    </div>
  </div>

  <div class="page-footer">LeadGenPro · Audit Technique Web — ${businessName} · ${date}</div>
</div>

<!-- PAGE 3 — ANALYSE VISUELLE + OPPORTUNITÉS + RECOMMANDATIONS -->
<div class="page-break">

  ${visVerdict ? `
  <div class="section-title">Analyse visuelle du site</div>
  <div style="display:grid;grid-template-columns:${visShot ? '1fr 1fr' : '1fr'};gap:16px;margin-bottom:0">
    ${visShot ? `
    <div style="border-radius:10px;overflow:hidden;border:1px solid #e2e8f0;max-height:220px;position:relative">
      <img src="data:image/png;base64,${visShot}" alt="Screenshot" style="width:100%;display:block;object-fit:cover;object-position:top" />
      <div style="position:absolute;bottom:0;left:0;right:0;height:48px;background:linear-gradient(to bottom,transparent,rgba(15,23,42,0.55))"></div>
    </div>` : ''}
    <div>
      <div style="background:#f8fafc;border-radius:10px;padding:14px 16px;border:1px solid #e2e8f0;margin-bottom:10px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
          <span style="font-size:13px;font-weight:700;color:${visColor}">${esc(visVerdict)}</span>
          <span style="font-size:18px;font-weight:900;color:${visColor}">${visScore ?? '—'}/100</span>
        </div>
        ${visEpoch ? `<div style="font-size:9px;color:#94a3b8;margin-top:2px">Style estimé : ${esc(visEpoch)}</div>` : ''}
      </div>
      ${visObs.slice(0, 3).map(o => {
        const c = o.level === 'red' ? '#dc2626' : o.level === 'green' ? '#16a34a' : '#d97706'
        return `<div style="display:flex;gap:8px;align-items:flex-start;margin-bottom:6px">
          <span style="width:8px;height:8px;border-radius:50%;background:${c};flex-shrink:0;margin-top:3px"></span>
          <span style="font-size:10.5px;color:#334155;line-height:1.5">${esc(o.text ?? '')}</span>
        </div>`
      }).join('')}
    </div>
  </div>
  ` : ''}

  <div class="section-title" style="margin-top:${visVerdict ? '28px' : '0'}">Opportunités identifiées</div>
  ${opportunites.slice(0, 3).map(o => `
  <div class="opp-item">
    <div class="opp-icon">💻</div>
    <div class="opp-content">
      <div class="opp-label">${esc(o.titre ?? o.label ?? '')}</div>
      <div class="opp-detail">${esc(o.description ?? o.detail ?? '')}</div>
    </div>
  </div>`).join('')}

  <div class="section-title" style="margin-top:24px">Plan d'action recommandé</div>
  ${recommandations.slice(0, 3).map((r, i) => `
  <div class="rec-item">
    <div class="rec-num">${i + 1}</div>
    <div class="rec-content">
      <div class="rec-title">${esc(r.titre ?? '')}</div>
      <div class="rec-detail">${esc(r.description ?? '')}</div>
    </div>
  </div>`).join('')}

  ${comparaison ? `
  <div class="section-title" style="margin-top:28px">6 · Positionnement concurrentiel</div>
  <div class="card">
    <div class="stat-row"><span class="stat-label" style="font-weight:600">Position</span><span class="stat-value" style="font-size:11px;max-width:260px;text-align:right">${esc(comparaison.position)}</span></div>
    ${(comparaison.avantages?.length ?? 0) > 0 ? `<div style="margin-top:8px"><div class="card-title" style="color:#16a34a">Points forts</div>${comparaison.avantages.map(a => `<div class="stat-row"><span class="stat-label">✓ ${esc(a)}</span></div>`).join('')}</div>` : ''}
    ${(comparaison.retards?.length ?? 0) > 0 ? `<div style="margin-top:8px"><div class="card-title" style="color:#dc2626">Points en retard</div>${comparaison.retards.map(r => `<div class="stat-row"><span class="stat-label">→ ${esc(r)}</span></div>`).join('')}</div>` : ''}
  </div>` : ''}

  ${timeline ? `
  <div class="section-title" style="margin-top:28px">7 · Calendrier de mise en oeuvre</div>
  <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px">
    <div class="card"><div class="card-title">Semaine 1</div><div style="font-size:10.5px;color:#64748b;line-height:1.5">${esc(timeline.semaine_1)}</div></div>
    <div class="card"><div class="card-title">Semaines 2–3</div><div style="font-size:10.5px;color:#64748b;line-height:1.5">${esc(timeline.semaine_2_3)}</div></div>
    <div class="card"><div class="card-title">Mois 2–3</div><div style="font-size:10.5px;color:#64748b;line-height:1.5">${esc(timeline.mois_2_3)}</div></div>
  </div>` : ''}

  <div class="cta-block">
    <div class="cta-badge">Proposition</div>
    <div class="cta-headline">${accroche || 'Un site rapide, sécurisé et visible, c\'est plus de clients.'}</div>
    <div class="cta-sub">Discutons de vos priorités — sans engagement.</div>
    <div class="cta-grid">
      <div class="cta-item"><div class="cta-item-icon">⚡</div><div class="cta-item-text">Optimisation des performances</div></div>
      <div class="cta-item"><div class="cta-item-icon">🔒</div><div class="cta-item-text">Sécurisation HTTPS &amp; SSL</div></div>
      <div class="cta-item"><div class="cta-item-icon">🔍</div><div class="cta-item-text">SEO technique complet</div></div>
      <div class="cta-item"><div class="cta-item-icon">📱</div><div class="cta-item-text">Compatibilité mobile parfaite</div></div>
    </div>
  </div>

  <div class="page-footer">LeadGenPro · Audit Technique Web — ${businessName} · ${date}</div>
</div>

</body>
</html>`

  const container = document.createElement('div')
  container.style.cssText = 'position:fixed;left:-9999px;top:0;width:794px;z-index:-1'
  container.innerHTML = html
  document.body.appendChild(container)

  try {
    const canvas = await html2canvasLib(container, { scale: 2, useCORS: true, allowTaint: true, backgroundColor: '#ffffff', width: 794, windowWidth: 794 })
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
    const pageWidthMm = 210, pageHeightMm = 297
    const pxPerMm     = canvas.width / pageWidthMm
    const pageHeightPx = Math.round(pageHeightMm * pxPerMm)
    const imgHeightMm  = (canvas.height * pageWidthMm) / canvas.width
    const totalPages   = Math.ceil(imgHeightMm / pageHeightMm)
    let firstPage = true
    for (let i = 0; i < totalPages; i++) {
      const srcY = i * pageHeightPx
      const srcH = Math.min(pageHeightPx, canvas.height - srcY)
      if (srcH < pageHeightPx * 0.10) continue
      if (!firstPage) pdf.addPage()
      firstPage = false
      const slice = document.createElement('canvas')
      slice.width = canvas.width; slice.height = pageHeightPx
      const ctx = slice.getContext('2d')
      ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, slice.width, slice.height)
      ctx.drawImage(canvas, 0, srcY, canvas.width, srcH, 0, 0, canvas.width, srcH)
      pdf.addImage(slice.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, pageWidthMm, pageHeightMm)
    }
    const fileName = `AuditWebDev-${(lead.name ?? 'prospect').replace(/[^a-zA-Z0-9]/g, '-')}-${new Date().toISOString().slice(0, 10)}.pdf`
    pdf.save(fileName)
  } finally {
    document.body.removeChild(container)
  }
}

// exportAuditEmailMarketingPDF — Rapport "Audit Email Marketing & Fidélisation"
// Page 1 : Couverture dark vert + nom business + score + titre
// Page 2 : Résumé exécutif + KPIs email + forces/faiblesses
// Page 3 : Recommandations priorisées + type de campagne + CTA
// ─────────────────────────────────────────────────────────────────────────────
export async function exportAuditEmailMarketingPDF({
  lead, activeProfile, emailAudit, auditData, reviewsData,
  // Pre-computed enriched signals (computed at click time in handleAuditEmail)
  visitFrequency = null, businessStability = null, canInvest = false,
  loyaltyTopics = [], aiReportSummary = null,
}) {
  const { jsPDF }      = await import('jspdf')
  const html2canvasLib = (await import('html2canvas')).default

  const businessName  = esc(lead.name ?? 'Ce commerce')
  const score         = lead.score?.total ?? 0
  const rating        = lead.google?.rating       ?? '—'
  const totalReviews  = lead.google?.totalReviews ?? 0
  const date          = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
  const city          = (lead.address ?? '').split(',').pop()?.trim() || ''

  const resumeExecutif  = esc(emailAudit?.resume_executif ?? '')
  const forces          = emailAudit?.forces          ?? []
  const faiblesses      = emailAudit?.faiblesses      ?? []
  const opportunites    = emailAudit?.opportunites    ?? []
  const recommandations = emailAudit?.recommandations ?? []
  const accroche        = esc(emailAudit?.accroche    ?? '')
  const comparaison     = emailAudit?.comparaison_concurrents ?? null
  const timeline        = emailAudit?.timeline ?? null
  const titreAudit      = esc(emailAudit?.titre_audit ?? 'Audit Email Marketing & Fidélisation')

  // KPIs email-marketing — données les plus complètes disponibles
  const social          = lead.social ?? {}
  const ownerRatioBase  = lead.ownerReplyRatio ?? null
  const totalFull       = reviewsData?.total      ?? null
  const unansweredFull  = reviewsData?.unanswered ?? null
  const hasNewsletter   = social.newsletterDetection?.hasNewsletter ?? auditData?.pagespeed?.siteSignals?.hasNewsletter ?? null
  const hasForm         = auditData?.pagespeed?.siteSignals?.hasContactForm ?? social.contactFormDetection?.hasContactForm ?? null
  const estimatedClients = Math.round(totalReviews * 10)
  const socialNets      = ['facebook', 'instagram', 'tiktok', 'linkedin', 'youtube', 'pinterest'].filter(k => !!(social[k]))

  let unansweredVal
  if (totalFull != null && unansweredFull != null) {
    unansweredVal = `${unansweredFull}/${totalFull} (données complètes)`
  } else if (ownerRatioBase != null) {
    const n = 5 - Math.round(ownerRatioBase * 5)
    unansweredVal = `${n}/5 (5 avis récents)`
  } else {
    unansweredVal = '—'
  }

  const loyaltyMentions = (reviewsData?.loyaltyAnalysis?.loyaltyMentions ?? lead.loyaltyAnalysis?.loyaltyMentions ?? 0)
  const loyaltyLabel    = loyaltyMentions === 0 ? 'Aucune' : `${loyaltyMentions} mention${loyaltyMentions > 1 ? 's' : ''}`
  const loyaltyTopicsStr = loyaltyTopics.length > 0 ? loyaltyTopics.slice(0, 3).join(', ') : null
  const potentiel       = estimatedClients >= 500 ? 'Fort' : estimatedClients >= 100 ? 'Moyen' : 'Faible'

  // Enriched signals — labels pour affichage PDF
  const visitFreqLabel  = visitFrequency ?? '—'
  const stabLabel       = businessStability === 'haute' ? 'Solide' : businessStability === 'moyenne' ? 'Correcte' : businessStability === 'faible' ? 'Incertaine' : '—'
  const stabNote        = canInvest ? ' · Budget disponible' : ''
  const dataSource      = totalFull ? `Basé sur ${totalFull} avis complets` : 'Basé sur 5 avis récents'

  // Scoring visual
  const sColor    = score >= 75 ? '#22c55e' : score >= 50 ? '#f59e0b' : '#ef4444'
  const accentColor = '#edfa36'
  const darkBg    = '#0D1410'
  const darkBg2   = '#111813'
  const greenMain = '#1D6E55'

  const kpiRow = (label, value, ok) => `
    <div class="kpi-row">
      <span class="kpi-label">${label}</span>
      <span class="kpi-value" style="color:${ok === true ? '#16a34a' : ok === false ? '#dc2626' : '#0f172a'}">${value}</span>
    </div>`

  const ffCard = (items, color, limit = 3) => items.slice(0, limit).map(item => `
    <div class="ff-item" style="border-left-color:${color}">
      <div class="ff-title">${esc(item.titre ?? item)}</div>
      ${item.description ? `<div class="ff-desc">${esc(item.description)}</div>` : ''}
    </div>`).join('')

  const recCard = (r, i) => `
    <div class="rec-item">
      <div class="rec-num">${i + 1}</div>
      <div>
        <div class="rec-title">${esc(r.titre ?? '')}</div>
        <div class="rec-desc">${esc(r.description ?? '')}</div>
      </div>
    </div>`

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<title>Audit Email Marketing — ${businessName}</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:'Segoe UI',system-ui,sans-serif; background:#fff; color:#0f172a; }

  /* ── COVER ── */
  .cover { width:100%; height:1123px; background:linear-gradient(145deg,${darkBg} 0%,${darkBg2} 55%,#0a1109 100%); display:flex; flex-direction:column; justify-content:space-between; padding:56px 60px 40px 60px; position:relative; overflow:hidden; page-break-after:always; }
  .cover::before { content:''; position:absolute; inset:0; background:radial-gradient(ellipse 50% 50% at 80% 20%,${greenMain}22 0%,transparent 65%),radial-gradient(ellipse 35% 35% at 15% 75%,${greenMain}10 0%,transparent 55%); pointer-events:none; }
  .cover-logo    { font-size:8px; font-weight:700; letter-spacing:3px; text-transform:uppercase; color:rgba(255,255,255,0.3); }
  .cover-eyebrow { font-size:10px; font-weight:700; letter-spacing:5px; text-transform:uppercase; color:${accentColor}; margin-bottom:12px; }
  .cover-title   { font-size:38px; font-weight:900; color:#fff; line-height:1.05; letter-spacing:-1.5px; }
  .cover-subtitle{ font-size:15px; font-weight:600; color:rgba(255,255,255,0.55); margin-top:6px; }
  .cover-business{ font-size:24px; font-weight:700; color:rgba(255,255,255,0.88); line-height:1.2; max-width:460px; margin-top:32px; }
  .cover-main    { flex:1; display:flex; flex-direction:column; justify-content:center; }
  .cover-score-row { display:flex; align-items:center; gap:24px; margin-top:40px; }
  .score-ring    { width:110px; height:110px; border-radius:50%; border:4px solid ${sColor}; display:flex; align-items:center; justify-content:center; flex-direction:column; box-shadow:0 0 36px ${sColor}44; background:${sColor}0d; flex-shrink:0; }
  .score-number  { font-size:32px; font-weight:900; color:${sColor}; line-height:1; }
  .score-lbl     { font-size:8px; color:rgba(255,255,255,0.4); letter-spacing:2px; margin-top:2px; }
  .meta-col      { display:flex; flex-direction:column; gap:10px; }
  .meta-item-lbl { font-size:8px; color:rgba(255,255,255,0.3); text-transform:uppercase; letter-spacing:2px; }
  .meta-item-val { font-size:13px; color:rgba(255,255,255,0.82); font-weight:700; }
  .cover-footer  { display:flex; flex-direction:column; gap:4px; }
  .cover-date    { font-size:10px; color:rgba(255,255,255,0.25); }
  .cover-footer-brand { font-size:9px; color:rgba(255,255,255,0.18); letter-spacing:2px; }

  /* ── PAGES ── */
  .page { padding:48px 52px; min-height:1123px; position:relative; page-break-after:always; }
  .page:last-child { page-break-after:auto; }
  .section-title { font-size:8.5px; font-weight:800; letter-spacing:3.5px; text-transform:uppercase; color:${greenMain}; border-bottom:2px solid ${greenMain}; padding-bottom:7px; margin-bottom:16px; margin-top:28px; }
  .section-title:first-child { margin-top:0; }
  .exec-box { background:linear-gradient(135deg,#f0fdf4,#f8fafc); border:1px solid #bbf7d0; border-left:3px solid ${greenMain}; border-radius:8px; padding:16px 18px; font-size:11.5px; line-height:1.8; color:#1e293b; margin-bottom:20px; }

  /* KPIs */
  .kpi-grid { display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:20px; }
  .kpi-card { background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:12px 14px; }
  .kpi-card-title { font-size:8px; color:#94a3b8; text-transform:uppercase; letter-spacing:2px; font-weight:700; margin-bottom:10px; }
  .kpi-row { display:flex; justify-content:space-between; align-items:center; padding:6px 0; border-bottom:1px solid #f1f5f9; }
  .kpi-row:last-child { border-bottom:none; }
  .kpi-label { font-size:10.5px; color:#64748b; }
  .kpi-value { font-size:11px; font-weight:700; color:#0f172a; }

  /* Forces/Faiblesses */
  .grid-2 { display:grid; grid-template-columns:1fr 1fr; gap:14px; margin-bottom:20px; }
  .card { background:#f8fafc; border-radius:10px; padding:14px 16px; border:1px solid #e2e8f0; }
  .card-title { font-size:8px; color:#94a3b8; text-transform:uppercase; letter-spacing:2px; font-weight:700; margin-bottom:10px; }
  .ff-item { padding:9px 12px; border-left:3px solid; border-radius:0 8px 8px 0; background:#f8fafc; margin-bottom:7px; }
  .ff-title { font-size:11px; font-weight:700; color:#0f172a; margin-bottom:2px; }
  .ff-desc  { font-size:9.5px; color:#64748b; line-height:1.5; }

  /* Recommandations */
  .rec-item { display:flex; gap:14px; align-items:flex-start; padding:12px 14px; border-radius:8px; border:1px solid #e2e8f0; margin-bottom:10px; background:#fafbfc; }
  .rec-num  { width:24px; height:24px; border-radius:50%; background:${greenMain}; color:#fff; font-size:11px; font-weight:800; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
  .rec-title { font-size:11.5px; font-weight:700; color:#0f172a; margin-bottom:3px; }
  .rec-desc  { font-size:10px; color:#64748b; line-height:1.55; }

  /* Campagne */
  .campagne-box { background:linear-gradient(135deg,#f0fdf4,#ecfdf5); border:1px solid #86efac; border-left:4px solid ${greenMain}; border-radius:8px; padding:16px 18px; margin-bottom:20px; }
  .campagne-label { font-size:8px; color:${greenMain}; text-transform:uppercase; letter-spacing:2.5px; font-weight:700; margin-bottom:6px; }
  .campagne-value { font-size:16px; font-weight:800; color:#065f46; line-height:1.3; }

  /* CTA */
  .cta-box { background:${darkBg}; border-radius:12px; padding:28px 32px; color:#fff; text-align:center; margin-top:28px; }
  .cta-title { font-size:18px; font-weight:800; color:${accentColor}; margin-bottom:8px; }
  .cta-sub   { font-size:12px; color:rgba(255,255,255,0.65); margin-bottom:18px; line-height:1.6; }
  .cta-contact { display:flex; justify-content:center; gap:32px; flex-wrap:wrap; }
  .cta-item  { font-size:11px; color:rgba(255,255,255,0.6); }
  .cta-item strong { color:rgba(255,255,255,0.9); display:block; font-size:12px; }

  /* Accroche */
  .accroche  { font-size:12px; font-style:italic; color:#64748b; text-align:center; padding:12px 24px; border-top:1px solid #e2e8f0; margin-top:20px; line-height:1.7; }

  /* Footer */
  .page-footer { position:absolute; bottom:24px; left:52px; right:52px; display:flex; justify-content:space-between; align-items:center; border-top:1px solid #f1f5f9; padding-top:10px; }
  .footer-brand { font-size:8px; color:#94a3b8; letter-spacing:2px; text-transform:uppercase; }
  .footer-page  { font-size:8px; color:#cbd5e1; }
</style>
</head>
<body>

<!-- ══ PAGE 1 : COUVERTURE ══════════════════════════════════════════════════ -->
<div class="cover">
  <div class="cover-logo">LeadGenPro</div>
  <div class="cover-main">
    <div class="cover-eyebrow">Rapport confidentiel</div>
    <div class="cover-title">Audit Email Marketing<br>&amp; Fidélisation</div>
    <div class="cover-subtitle">${titreAudit}</div>
    <div class="cover-business">${businessName}${city ? ` · ${city}` : ''}</div>
    <div class="cover-score-row">
      <div class="score-ring">
        <div class="score-number">${score}</div>
        <div class="score-lbl">SCORE</div>
      </div>
      <div class="meta-col">
        <div><div class="meta-item-lbl">Note Google</div><div class="meta-item-val">${rating} ★ · ${totalReviews} avis</div></div>
        <div><div class="meta-item-lbl">Newsletter</div><div class="meta-item-val">${hasNewsletter ? 'Présente' : 'Absente'}</div></div>
        <div><div class="meta-item-lbl">Clients estimés</div><div class="meta-item-val">~${estimatedClients.toLocaleString('fr-FR')}</div></div>
      </div>
    </div>
  </div>
  <div class="cover-footer">
    <div class="cover-date">Rapport généré le ${date}</div>
    <div class="cover-footer-brand">Rapport généré via LeadGenPro</div>
  </div>
</div>

<!-- ══ PAGE 2 : ANALYSE ═════════════════════════════════════════════════════ -->
<div class="page">

  <div class="section-title">Résumé exécutif</div>
  ${resumeExecutif ? `<div class="exec-box">${resumeExecutif}</div>` : ''}

  <div class="section-title">Indicateurs clés</div>
  <div class="kpi-grid">
    <div class="kpi-card">
      <div class="kpi-card-title">Réactivité &amp; avis</div>
      ${kpiRow('Note Google', `${rating} / 5 ★`, null)}
      ${kpiRow('Volume avis', totalReviews, null)}
      ${kpiRow('Avis sans réponse', unansweredVal, null)}
    </div>
    <div class="kpi-card">
      <div class="kpi-card-title">Présence digitale</div>
      ${kpiRow('Site web',        lead.website && lead.website !== 'null' ? 'Présent' : 'Absent',   !!(lead.website && lead.website !== 'null'))}
      ${kpiRow('Newsletter',      hasNewsletter === null ? '—' : hasNewsletter ? 'Présente' : 'Absente',  hasNewsletter === null ? null : !hasNewsletter)}
      ${kpiRow('Formulaire email',hasForm === null ? '—' : hasForm ? 'Détecté' : 'Absent',          hasForm === null ? null : hasForm)}
      ${kpiRow('Réseaux sociaux', `${socialNets.length} réseau${socialNets.length !== 1 ? 'x' : ''}`, socialNets.length >= 2)}
    </div>
    <div class="kpi-card">
      <div class="kpi-card-title">Potentiel fidélisation</div>
      ${kpiRow('Clients estimés',      `~${estimatedClients.toLocaleString('fr-FR')}`, null)}
      ${kpiRow('Potentiel',            potentiel,                                       potentiel === 'Fort')}
      ${kpiRow('Mentions fidélité',    `${loyaltyLabel}${loyaltyTopicsStr ? ` · ${loyaltyTopicsStr}` : ''}`, loyaltyMentions === 0)}
      ${kpiRow('Fréquence visite',     visitFreqLabel,                                  visitFreqLabel === 'Haute')}
      ${kpiRow('Stabilité',            `${stabLabel}${stabNote}`,                       businessStability === 'haute')}
    </div>
  </div>

  <div style="font-size:8.5px;color:#94a3b8;text-align:right;margin-bottom:14px;font-style:italic">${dataSource}</div>

  ${aiReportSummary ? `
  <div class="section-title">Analyse IA des avis clients</div>
  <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-left:3px solid #1D6E55;border-radius:8px;padding:12px 16px;font-size:10.5px;line-height:1.75;color:#1e293b;margin-bottom:20px;white-space:pre-wrap">${esc(aiReportSummary)}</div>
  ` : ''}

  <div class="grid-2">
    <div class="card">
      <div class="card-title">Points forts</div>
      ${forces.length > 0 ? ffCard(forces, '#16a34a') : '<div class="ff-desc" style="color:#94a3b8">—</div>'}
    </div>
    <div class="card">
      <div class="card-title">Points faibles</div>
      ${faiblesses.length > 0 ? ffCard(faiblesses, '#dc2626') : '<div class="ff-desc" style="color:#94a3b8">—</div>'}
    </div>
  </div>

  <div class="page-footer">
    <span class="footer-brand">Rapport généré via LeadGenPro</span>
    <span class="footer-page">Page 2 / 3</span>
  </div>
</div>

<!-- ══ PAGE 3 : RECOMMANDATIONS + CTA ══════════════════════════════════════ -->
<div class="page">

  ${recommandations.length > 0 ? `
  <div class="section-title">Recommandations priorisées</div>
  ${recommandations.slice(0, 4).map((r, i) => recCard(r, i)).join('')}
  ` : ''}

  ${opportunites.length > 0 ? `
  <div class="section-title">Opportunités identifiées</div>
  ${opportunites.slice(0, 3).map(o => `<div class="ff-item" style="border-left-color:#f59e0b"><div class="ff-title">${esc(o.titre ?? o)}</div>${o.description ? `<div class="ff-desc">${esc(o.description)}</div>` : ''}</div>`).join('')}
  ` : ''}

  <div class="section-title">Stratégie recommandée</div>
  <div class="campagne-box">
    <div class="campagne-label">Type de campagne</div>
    <div class="campagne-value">${accroche || 'Séquences automatiques + fidélisation clients'}</div>
  </div>

  ${comparaison ? `
  <div class="section-title" style="margin-top:28px">6 · Positionnement concurrentiel</div>
  <div style="background:#f8fafc;border-radius:10px;padding:16px 18px;border:1px solid #e2e8f0;margin-bottom:14px">
    <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid #f1f5f9"><span style="font-size:11px;color:#64748b;font-weight:600">Position</span><span style="font-size:11px;font-weight:700;color:#0f172a;max-width:260px;text-align:right">${esc(comparaison.position)}</span></div>
    ${(comparaison.avantages?.length ?? 0) > 0 ? `<div style="margin-top:8px;font-size:8.5px;font-weight:800;letter-spacing:2px;text-transform:uppercase;color:#16a34a;margin-bottom:6px">Points forts</div>${comparaison.avantages.map(a => `<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #f1f5f9"><span style="font-size:11px;color:#64748b">✓ ${esc(a)}</span></div>`).join('')}` : ''}
    ${(comparaison.retards?.length ?? 0) > 0 ? `<div style="margin-top:8px;font-size:8.5px;font-weight:800;letter-spacing:2px;text-transform:uppercase;color:#dc2626;margin-bottom:6px">Points en retard</div>${comparaison.retards.map(r => `<div style="display:flex;padding:6px 0;border-bottom:1px solid #f1f5f9"><span style="font-size:11px;color:#64748b">→ ${esc(r)}</span></div>`).join('')}` : ''}
  </div>` : ''}

  ${timeline ? `
  <div class="section-title" style="margin-top:28px">7 · Calendrier de mise en oeuvre</div>
  <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px;margin-bottom:14px">
    <div style="background:#f8fafc;border-radius:10px;padding:16px 18px;border:1px solid #e2e8f0"><div style="font-size:8.5px;font-weight:800;letter-spacing:2px;text-transform:uppercase;color:#64748b;margin-bottom:8px">Semaine 1</div><div style="font-size:10.5px;color:#475569;line-height:1.5">${esc(timeline.semaine_1)}</div></div>
    <div style="background:#f8fafc;border-radius:10px;padding:16px 18px;border:1px solid #e2e8f0"><div style="font-size:8.5px;font-weight:800;letter-spacing:2px;text-transform:uppercase;color:#64748b;margin-bottom:8px">Semaines 2–3</div><div style="font-size:10.5px;color:#475569;line-height:1.5">${esc(timeline.semaine_2_3)}</div></div>
    <div style="background:#f8fafc;border-radius:10px;padding:16px 18px;border:1px solid #e2e8f0"><div style="font-size:8.5px;font-weight:800;letter-spacing:2px;text-transform:uppercase;color:#64748b;margin-bottom:8px">Mois 2–3</div><div style="font-size:10.5px;color:#475569;line-height:1.5">${esc(timeline.mois_2_3)}</div></div>
  </div>` : ''}

  <div class="cta-box">
    <div class="cta-title">${accroche || 'Passons à l\'action'}</div>
    <div class="cta-sub">Discutons de vos priorités — sans engagement.</div>
    <div class="cta-contact">
      <div class="cta-item"><strong>Votre consultant</strong>[Prénom Nom]</div>
      <div class="cta-item"><strong>Email</strong>[email@exemple.com]</div>
      <div class="cta-item"><strong>Téléphone</strong>[06 XX XX XX XX]</div>
    </div>
  </div>

  ${accroche ? `<div class="accroche">"${accroche}"</div>` : ''}

  <div class="page-footer">
    <span class="footer-brand">Rapport généré via LeadGenPro</span>
    <span class="footer-page">Page 3 / 3</span>
  </div>
</div>

</body>
</html>`

  const container = document.createElement('div')
  container.style.cssText = 'position:fixed;left:-9999px;top:0;width:794px;background:#fff;z-index:-1'
  container.innerHTML = html
  document.body.appendChild(container)

  try {
    const canvas = await html2canvasLib(container, {
      scale: 2, useCORS: true, allowTaint: true,
      backgroundColor: '#ffffff', logging: false,
      windowWidth: 794,
    })
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
    const pageWidthMm  = 210, pageHeightMm = 297
    const pxPerMm      = canvas.width / pageWidthMm
    const pageHeightPx = Math.round(pageHeightMm * pxPerMm)
    const imgHeightMm  = (canvas.height * pageWidthMm) / canvas.width
    const totalPages   = Math.ceil(imgHeightMm / pageHeightMm)
    let firstPage = true
    for (let i = 0; i < totalPages; i++) {
      const srcY = i * pageHeightPx
      const srcH = Math.min(pageHeightPx, canvas.height - srcY)
      if (srcH < pageHeightPx * 0.10) continue
      if (!firstPage) pdf.addPage()
      firstPage = false
      const slice = document.createElement('canvas')
      slice.width = canvas.width; slice.height = pageHeightPx
      const ctx = slice.getContext('2d')
      ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, slice.width, slice.height)
      ctx.drawImage(canvas, 0, srcY, canvas.width, srcH, 0, 0, canvas.width, srcH)
      pdf.addImage(slice.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, pageWidthMm, pageHeightMm)
    }
    const fileName = `AuditEmailMarketing-${(lead.name ?? 'prospect').replace(/[^a-zA-Z0-9]/g, '-')}-${new Date().toISOString().slice(0, 10)}.pdf`
    pdf.save(fileName)
  } finally {
    document.body.removeChild(container)
  }
}

// exportAuditGoogleAdsPDF — Rapport "Audit Google Ads"
// Page 1 : Couverture bleu/cyan + nom business + score compatibilité Ads
// Page 2 : Résumé exécutif + KPIs (site, perf, fiche) + forces/faiblesses
// Page 3 : Recommandations priorisées + budget estimé + CTA
// ─────────────────────────────────────────────────────────────────────────────
export async function exportAuditGoogleAdsPDF({ lead, activeProfile, googleAdsAudit, auditData }) {
  const { jsPDF }      = await import('jspdf')
  const html2canvasLib = (await import('html2canvas')).default

  const businessName  = esc(lead.name ?? 'Ce commerce')
  const score         = lead.score?.total ?? 0
  const rating        = lead.google?.rating       ?? '—'
  const totalReviews  = lead.google?.totalReviews ?? 0
  const date          = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
  const city          = (lead.address ?? '').split(',').pop()?.trim() || ''
  const profileName   = activeProfile?.name ?? 'Consultant Google Ads'
  const hasWebsite    = !!(lead.website && !['null', 'undefined', ''].includes(String(lead.website)))

  const resumeExecutif  = esc(googleAdsAudit?.resume_executif ?? '')
  const forces          = googleAdsAudit?.forces          ?? []
  const faiblesses      = googleAdsAudit?.faiblesses      ?? []
  const recommandations = googleAdsAudit?.recommandations ?? []
  const accroche        = esc(googleAdsAudit?.accroche    ?? '')
  const comparaison     = googleAdsAudit?.comparaison_concurrents ?? null
  const timeline        = googleAdsAudit?.timeline ?? null
  const titreAudit      = esc(googleAdsAudit?.titre_audit ?? 'Audit Google Ads & Acquisition Locale')

  const ps        = auditData?.pagespeed ?? null
  const rawPerf   = ps?.performance
  const perfScore = rawPerf != null ? (rawPerf <= 1 ? Math.round(rawPerf * 100) : Math.round(rawPerf)) : null
  const loadTime  = ps?.loadTime  ?? null
  const hasHttps  = ps?.https     ?? false
  const hasSitemap = ps?.sitemap  ?? false

  // Score compatibilité Ads (mirrors scoring.js googleAdsReadiness)
  let adsScore = 0
  const rt = Number(rating) || 0
  if (rt >= 4.0) adsScore += 20; else if (rt >= 3.5) adsScore += 10; else adsScore += 5
  const rev = Number(totalReviews) || 0
  if (rev > 50) adsScore += 15; else if (rev >= 20) adsScore += 10; else adsScore += 5
  if (hasWebsite)  adsScore += 15
  if (perfScore != null) { if (perfScore >= 70) adsScore += 15; else if (perfScore >= 50) adsScore += 10; else adsScore += 5 }
  if (hasHttps)    adsScore += 10
  const loadSec = loadTime !== null ? parseFloat(String(loadTime).replace('s', '')) : null
  if (loadSec !== null) { if (loadSec < 3) adsScore += 10; else if (loadSec < 5) adsScore += 5 }
  const photoCount = lead.googleAudit?.photoCount ?? 0
  const hasDesc    = lead.googleAudit?.hasDescription ?? false
  const hasHours   = lead.googleAudit?.hasHours ?? false
  if (photoCount > 10 && hasDesc && hasHours) adsScore += 10
  adsScore = Math.min(100, adsScore)
  const adsLabel = adsScore >= 75 ? 'Idéal' : adsScore >= 55 ? 'Prêt' : adsScore >= 35 ? 'À préparer' : 'Non compatible'
  const adsColor = adsScore >= 75 ? '#22c55e' : adsScore >= 55 ? '#3b82f6' : adsScore >= 35 ? '#f59e0b' : '#ef4444'

  const accentColor = '#0ea5e9'

  const kpiRow = (label, value, ok) => `
    <div class="stat-row">
      <span class="stat-label">${label}</span>
      <span class="stat-value" style="color:${ok === true ? '#16a34a' : ok === false ? '#dc2626' : '#0f172a'}">${value}</span>
    </div>`

  const forceFaiblCard = (items, color) => items.slice(0, 3).map(item => `
    <div class="ff-item" style="border-left-color:${color}">
      <div class="ff-title">${esc(item.titre ?? '')}</div>
      <div class="ff-desc">${esc(item.description ?? '')}</div>
    </div>`).join('')

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<title>Audit Google Ads — ${businessName}</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:'Segoe UI',system-ui,sans-serif; background:#fff; color:#0f172a; }
  .cover { width:100%; height:1123px; background:linear-gradient(145deg,#030d1f 0%,#051830 55%,#041526 100%); display:flex; flex-direction:column; justify-content:space-between; padding:56px 60px 0 60px; position:relative; overflow:hidden; page-break-after:always; }
  .cover::before { content:''; position:absolute; inset:0; background:radial-gradient(ellipse 50% 50% at 80% 20%,${accentColor}20 0%,transparent 65%),radial-gradient(ellipse 35% 35% at 15% 75%,#4338ca12 0%,transparent 55%); pointer-events:none; }
  .cover-logo { font-size:8px; font-weight:700; letter-spacing:3px; text-transform:uppercase; color:rgba(255,255,255,0.3); }
  .cover-eyebrow { font-size:10px; font-weight:700; letter-spacing:5px; text-transform:uppercase; color:${accentColor}; margin-bottom:12px; }
  .cover-title { font-size:56px; font-weight:800; color:#fff; line-height:1.05; margin-bottom:8px; }
  .cover-subtitle { font-size:13px; color:rgba(255,255,255,0.55); margin-bottom:32px; }
  .cover-business { font-size:22px; font-weight:700; color:#fff; background:rgba(255,255,255,0.07); border:1px solid rgba(255,255,255,0.15); border-radius:10px; padding:12px 20px; display:inline-block; }
  .cover-main { flex:1; display:flex; flex-direction:column; justify-content:center; gap:28px; }
  .cover-score-row { display:flex; align-items:center; gap:28px; }
  .cover-score-ring { width:90px; height:90px; border-radius:50%; border:4px solid ${adsColor}; display:flex; flex-direction:column; align-items:center; justify-content:center; background:rgba(255,255,255,0.04); }
  .cover-score-number { font-size:30px; font-weight:800; color:${adsColor}; line-height:1; }
  .cover-score-label  { font-size:9px; color:rgba(255,255,255,0.45); font-weight:600; }
  .cover-score-meta { display:flex; flex-direction:column; gap:10px; }
  .cover-score-meta-item { display:flex; flex-direction:column; gap:1px; }
  .cover-score-meta-label { font-size:9px; color:rgba(255,255,255,0.4); font-weight:600; letter-spacing:0.5px; text-transform:uppercase; }
  .cover-score-meta-value { font-size:15px; font-weight:700; color:#fff; }
  .cover-ads-badge { display:inline-block; background:${adsColor}22; border:1px solid ${adsColor}55; border-radius:8px; padding:8px 16px; font-size:13px; font-weight:700; color:${adsColor}; margin-top:10px; }
  .cover-footer { padding:24px 0 32px; display:flex; justify-content:space-between; align-items:flex-end; border-top:1px solid rgba(255,255,255,0.08); }
  .cover-freelancer { font-size:11px; color:rgba(255,255,255,0.45); }
  .cover-date { font-size:11px; color:rgba(255,255,255,0.3); font-family:monospace; }
  .cover-watermark { font-size:8px; color:rgba(255,255,255,0.15); letter-spacing:1px; text-transform:uppercase; }
  .report { padding:48px 56px; max-width:100%; }
  .section-title { font-size:9px; font-weight:700; letter-spacing:3px; text-transform:uppercase; color:${accentColor}; margin-bottom:14px; padding-bottom:8px; border-bottom:2px solid ${accentColor}22; }
  .exec-box { background:#f8faff; border:1px solid #e0edff; border-left:4px solid ${accentColor}; border-radius:0 10px 10px 0; padding:16px 18px; font-size:12.5px; color:#1e293b; line-height:1.65; margin-bottom:8px; }
  .grid-2 { display:grid; grid-template-columns:1fr 1fr; gap:20px; margin-bottom:8px; }
  .card { background:#fafbfc; border:1px solid #e2e8f0; border-radius:10px; padding:16px 18px; }
  .card-title { font-size:10px; font-weight:700; letter-spacing:1.5px; text-transform:uppercase; color:#64748b; margin-bottom:12px; }
  .ff-item { padding:10px 14px; border-left:3px solid #e2e8f0; border-radius:0 8px 8px 0; margin-bottom:8px; background:#fafbfc; }
  .ff-title { font-size:11.5px; font-weight:700; color:#0f172a; margin-bottom:3px; }
  .ff-desc  { font-size:10px; color:#64748b; line-height:1.5; }
  .stat-row { display:flex; justify-content:space-between; align-items:center; padding:8px 0; border-bottom:1px solid #f1f5f9; }
  .stat-row:last-child { border-bottom:none; }
  .stat-label { font-size:11px; color:#64748b; }
  .stat-value { font-size:12px; font-weight:700; color:#0f172a; }
  .badge { display:inline-flex; align-items:center; gap:4px; padding:3px 10px; border-radius:20px; font-size:10px; font-weight:700; margin:3px; }
  .badge-green { background:#dcfce7; color:#16a34a; }
  .badge-red   { background:#fee2e2; color:#dc2626; }
  .badge-blue  { background:#dbeafe; color:#1d4ed8; }
  .rec-item { padding:13px 16px; border-radius:10px; border:1px solid #e2e8f0; margin-bottom:8px; background:#f8fafc; display:flex; gap:14px; align-items:flex-start; }
  .rec-num { width:24px; height:24px; border-radius:50%; background:${accentColor}; color:#fff; font-size:11px; font-weight:800; display:flex; align-items:center; justify-content:center; flex-shrink:0; margin-top:1px; }
  .rec-content { flex:1; }
  .rec-title  { font-size:12px; font-weight:700; color:#0f172a; margin-bottom:3px; }
  .rec-detail { font-size:10.5px; color:#64748b; line-height:1.5; }
  .cta-block { background:linear-gradient(135deg,${accentColor} 0%,#0369a1 100%); border-radius:12px; padding:22px 28px; margin-top:16px; }
  .cta-badge    { display:inline-block; background:rgba(255,255,255,0.2); color:#fff; font-size:8px; font-weight:800; letter-spacing:1.5px; text-transform:uppercase; padding:3px 10px; border-radius:4px; margin-bottom:12px; }
  .cta-headline { font-size:18px; font-weight:800; color:#fff; margin-bottom:6px; }
  .cta-sub      { font-size:11px; color:rgba(255,255,255,0.7); margin-bottom:20px; line-height:1.5; }
  .accroche-box { background:#f0f9ff; border:1px solid #bae6fd; border-radius:10px; padding:14px 18px; margin-bottom:20px; font-size:12px; font-style:italic; color:#0369a1; line-height:1.6; }
  .page-footer { font-size:7.5px; color:rgba(0,0,0,0.18); text-align:center; margin-top:32px; letter-spacing:0.5px; }
  .card,.ff-item,.rec-item,.cta-block,.exec-box,.grid-2 { page-break-inside:avoid; break-inside:avoid; }
  @media print { body { -webkit-print-color-adjust:exact; print-color-adjust:exact; } @page { size:A4 portrait; margin:0; } }
</style>
</head>
<body>

<!-- ═══════ PAGE 1 : COUVERTURE ═══════ -->
<div class="cover">
  <div class="cover-logo">LeadGenPro</div>
  <div class="cover-main">
    <div>
      <div class="cover-eyebrow">Audit prospect</div>
      <div class="cover-title">Google<br>Ads</div>
      <div class="cover-subtitle">${titreAudit}</div>
      <div class="cover-business">${businessName}</div>
      <div class="cover-ads-badge">Compatibilité : ${adsLabel} — ${adsScore}/100</div>
    </div>
    <div class="cover-score-row">
      <div class="cover-score-ring">
        <div class="cover-score-number">${adsScore}</div>
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
          <div class="cover-score-meta-label">Site web</div>
          <div class="cover-score-meta-value">${hasWebsite ? '✅ Présent' : '❌ Absent'}</div>
        </div>
      </div>
    </div>
  </div>
  <div class="cover-footer">
    <div class="cover-freelancer">Rapport préparé par <strong>${esc(profileName)}</strong>${city ? ` — ${esc(city)}` : ''}</div>
    <div class="cover-date">${date}</div>
    <div class="cover-watermark">Rapport généré via LeadGenPro</div>
  </div>
</div>

<!-- ═══════ PAGE 2 : RÉSUMÉ + KPIS + FORCES/FAIBLESSES ═══════ -->
<div class="report">

  <div class="section-title">1 · Résumé exécutif</div>
  <div class="exec-box">${resumeExecutif || '—'}</div>

  <div class="section-title" style="margin-top:28px">2 · Compatibilité Google Ads</div>
  <div class="grid-2">
    <div class="card">
      <div class="card-title">Site &amp; Performances</div>
      ${kpiRow('Site web',           hasWebsite ? '✅ Présent' : '❌ Absent',  hasWebsite)}
      ${kpiRow('Performance mobile', perfScore !== null ? `${perfScore}/100` : '—', perfScore !== null ? perfScore >= 70 : null)}
      ${kpiRow('HTTPS',              hasHttps ? '✅ Sécurisé' : '❌ Non sécurisé', hasHttps)}
      ${kpiRow('Temps chargement',   loadTime ?? '—',  loadSec !== null ? loadSec < 3 : null)}
      ${kpiRow('Sitemap XML',        hasSitemap ? '✅ Présent' : 'Absent',  hasSitemap || null)}
    </div>
    <div class="card">
      <div class="card-title">Fiche Google &amp; Avis</div>
      ${kpiRow('Note Google',     `${rating}/5`,   rt >= 4.0 ? true : rt >= 3.5 ? null : false)}
      ${kpiRow('Volume avis',     `${totalReviews} avis`, rev >= 50 ? true : rev >= 20 ? null : false)}
      ${kpiRow('Photos fiche',    `${photoCount} photos`, photoCount > 10 ? true : photoCount > 3 ? null : false)}
      ${kpiRow('Description',     hasDesc ? '✅ Présente' : '❌ Absente', hasDesc)}
      ${kpiRow('Horaires',        hasHours ? '✅ Renseignés' : '❌ Absents', hasHours)}
    </div>
  </div>

  <div class="section-title" style="margin-top:28px">3 · Forces &amp; faiblesses</div>
  <div class="grid-2">
    <div>
      <div style="font-size:8px;letter-spacing:2px;font-weight:700;text-transform:uppercase;color:#16a34a;margin-bottom:10px">✓ Forces</div>
      ${forces.length > 0 ? forceFaiblCard(forces, '#16a34a') : '<div class="ff-item" style="border-left-color:#e2e8f0"><div class="ff-desc">Non identifié</div></div>'}
    </div>
    <div>
      <div style="font-size:8px;letter-spacing:2px;font-weight:700;text-transform:uppercase;color:#dc2626;margin-bottom:10px">✗ Faiblesses</div>
      ${faiblesses.length > 0 ? forceFaiblCard(faiblesses, '#dc2626') : '<div class="ff-item" style="border-left-color:#e2e8f0"><div class="ff-desc">Aucune critique détectée</div></div>'}
    </div>
  </div>

  <div class="page-footer">LeadGenPro · ${date}</div>
</div>

<!-- ═══════ PAGE 3 : RECOMMANDATIONS + CTA ═══════ -->
<div class="report" style="padding-top:40px">
  ${accroche ? `<div class="accroche-box">"${accroche}"</div>` : ''}

  <div class="section-title">4 · Recommandations priorisées</div>
  ${recommandations.slice(0, 4).map((r, i) => `
    <div class="rec-item">
      <div class="rec-num">${r.priorite ?? i + 1}</div>
      <div class="rec-content">
        <div class="rec-title">${esc(r.titre ?? '')}</div>
        <div class="rec-detail">${esc(r.description ?? '')}</div>
      </div>
    </div>`).join('')}

  ${comparaison ? `
  <div class="section-title" style="margin-top:28px">6 · Positionnement concurrentiel</div>
  <div style="background:rgba(255,255,255,0.04);border-radius:10px;padding:16px 18px;border:1px solid rgba(255,255,255,0.1);margin-bottom:14px">
    <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.08)"><span style="font-size:11px;color:#94a3b8;font-weight:600">Position</span><span style="font-size:11px;font-weight:700;color:#e2e8f0;max-width:260px;text-align:right">${esc(comparaison.position)}</span></div>
    ${(comparaison.avantages?.length ?? 0) > 0 ? `<div style="margin-top:8px;font-size:8px;font-weight:800;letter-spacing:2px;text-transform:uppercase;color:#22c55e;margin-bottom:6px">Points forts</div>${comparaison.avantages.map(a => `<div style="font-size:10.5px;color:#94a3b8;padding:4px 0;border-bottom:1px solid rgba(255,255,255,0.05)">✓ ${esc(a)}</div>`).join('')}` : ''}
    ${(comparaison.retards?.length ?? 0) > 0 ? `<div style="margin-top:8px;font-size:8px;font-weight:800;letter-spacing:2px;text-transform:uppercase;color:#f87171;margin-bottom:6px">Points en retard</div>${comparaison.retards.map(r => `<div style="font-size:10.5px;color:#94a3b8;padding:4px 0;border-bottom:1px solid rgba(255,255,255,0.05)">→ ${esc(r)}</div>`).join('')}` : ''}
  </div>` : ''}

  ${timeline ? `
  <div class="section-title" style="margin-top:28px">7 · Calendrier de mise en oeuvre</div>
  <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px;margin-bottom:14px">
    <div style="background:rgba(255,255,255,0.04);border-radius:10px;padding:16px 18px;border:1px solid rgba(255,255,255,0.1)"><div style="font-size:8px;font-weight:800;letter-spacing:2px;text-transform:uppercase;color:#64748b;margin-bottom:8px">Semaine 1</div><div style="font-size:10.5px;color:#94a3b8;line-height:1.5">${esc(timeline.semaine_1)}</div></div>
    <div style="background:rgba(255,255,255,0.04);border-radius:10px;padding:16px 18px;border:1px solid rgba(255,255,255,0.1)"><div style="font-size:8px;font-weight:800;letter-spacing:2px;text-transform:uppercase;color:#64748b;margin-bottom:8px">Semaines 2–3</div><div style="font-size:10.5px;color:#94a3b8;line-height:1.5">${esc(timeline.semaine_2_3)}</div></div>
    <div style="background:rgba(255,255,255,0.04);border-radius:10px;padding:16px 18px;border:1px solid rgba(255,255,255,0.1)"><div style="font-size:8px;font-weight:800;letter-spacing:2px;text-transform:uppercase;color:#64748b;margin-bottom:8px">Mois 2–3</div><div style="font-size:10.5px;color:#94a3b8;line-height:1.5">${esc(timeline.mois_2_3)}</div></div>
  </div>` : ''}

  <div class="cta-block">
    <div class="cta-badge">Prochaine étape</div>
    <div class="cta-headline">${accroche || 'Passons à la mise en oeuvre'}</div>
    <div class="cta-sub">Discutons de vos priorités — sans engagement.</div>
  </div>

  <div class="page-footer">LeadGenPro · ${date} · Confidentiel — Préparé pour ${businessName}</div>
</div>

</body>
</html>`

  const container = document.createElement('div')
  container.style.cssText = 'position:fixed;left:-9999px;top:0;width:794px;background:#fff;z-index:-1'
  container.innerHTML = html
  document.body.appendChild(container)

  try {
    const canvas = await html2canvasLib(container, { scale: 2, useCORS: true, logging: false, backgroundColor: '#ffffff', width: 794 })
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
    const pageWidthMm = 210, pageHeightMm = 297
    const pxPerMm    = canvas.width / pageWidthMm
    const pageHeightPx = Math.round(pageHeightMm * pxPerMm)
    const imgHeightMm  = (canvas.height * pageWidthMm) / canvas.width
    const totalPages   = Math.ceil(imgHeightMm / pageHeightMm)
    let firstPage = true
    for (let i = 0; i < totalPages; i++) {
      const srcY = i * pageHeightPx
      const srcH = Math.min(pageHeightPx, canvas.height - srcY)
      if (srcH < pageHeightPx * 0.10) continue
      if (!firstPage) pdf.addPage()
      firstPage = false
      const slice = document.createElement('canvas')
      slice.width = canvas.width; slice.height = pageHeightPx
      const ctx = slice.getContext('2d')
      ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, slice.width, slice.height)
      ctx.drawImage(canvas, 0, srcY, canvas.width, srcH, 0, 0, canvas.width, srcH)
      pdf.addImage(slice.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, pageWidthMm, pageHeightMm)
    }
    const fileName = `AuditGoogleAds-${(lead.name ?? 'prospect').replace(/[^a-zA-Z0-9]/g, '-')}-${new Date().toISOString().slice(0, 10)}.pdf`
    pdf.save(fileName)
  } finally {
    document.body.removeChild(container)
  }
}
