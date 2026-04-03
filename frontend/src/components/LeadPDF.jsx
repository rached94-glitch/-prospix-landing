import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer'

const C = {
  accent:  '#00d4ff',
  success: '#10b981',
  danger:  '#ef4444',
  warning: '#f59e0b',
  muted:   '#9ca3af',
  text:    '#f0f0f8',
  faint:   '#4b5563',
  white:   '#ffffff',
}

const s = StyleSheet.create({
  page:         { backgroundColor: '#1a1a24', paddingTop: 32, paddingBottom: 48, paddingLeft: 32, paddingRight: 32, fontFamily: 'Helvetica', color: C.white },
  header:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: '#ffffff18' },
  name:         { fontSize: 18, fontFamily: 'Helvetica-Bold', color: C.white, marginBottom: 4 },
  addressText:  { fontSize: 9, color: C.muted },
  scoreBubble:  { alignItems: 'center', backgroundColor: '#00d4ff18', borderRadius: 8, paddingTop: 8, paddingBottom: 8, paddingLeft: 14, paddingRight: 14, borderWidth: 1, borderColor: '#00d4ff44' },
  scoreNum:     { fontSize: 26, fontFamily: 'Helvetica-Bold' },
  scoreLabel:   { fontSize: 8, color: C.muted },
  section:      { marginBottom: 14 },
  sectionTitle: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#ffffff66', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 7, paddingBottom: 4, borderBottomWidth: 1, borderBottomColor: '#ffffff0d' },
  row:          { flexDirection: 'row', marginBottom: 4, alignItems: 'center' },
  label:        { fontSize: 9, color: C.muted, width: 80 },
  value:        { fontSize: 9, color: C.white, flex: 1 },
  card:         { backgroundColor: '#ffffff08', borderRadius: 6, paddingTop: 8, paddingBottom: 8, paddingLeft: 10, paddingRight: 10, marginBottom: 6, borderWidth: 1, borderColor: '#ffffff0d' },
  reviewText:   { fontSize: 8.5, color: C.muted, lineHeight: 1.5, marginTop: 3 },
  pitchBox:     { borderRadius: 8, paddingTop: 10, paddingBottom: 10, paddingLeft: 12, paddingRight: 12, marginBottom: 6 },
  pitchText:    { fontSize: 9.5, lineHeight: 1.6, fontFamily: 'Helvetica-Oblique' },
  footer:       { position: 'absolute', bottom: 20, left: 32, right: 32, flexDirection: 'row', justifyContent: 'space-between' },
  footerText:   { fontSize: 7.5, color: C.faint },
})

function starsText(rating = 0) {
  const full = Math.round(rating)
  return '*'.repeat(full) + '-'.repeat(5 - full)
}

function scoreColor(score) {
  if (score > 80) return C.success
  if (score >= 60) return C.warning
  return C.danger
}

function urgencyColor(urgency) {
  return { critical: C.danger, high: '#f97316', medium: C.warning, low: C.success }[urgency] || C.muted
}

export default function LeadPDF({ lead }) {
  const score   = lead.score?.total ?? 0
  const ra      = lead.reviewAnalysis
  const opp     = ra?.chatbotOpportunity
  const cd      = lead.chatbotDetection
  const dm      = lead.decisionMaker
  const reviews = lead.google?.reviews || []
  const color   = scoreColor(score)
  const date    = new Date().toLocaleDateString('fr-FR')

  const pitch = cd?.hasChatbot
    ? `Votre solution actuelle peut être améliorée - notre chatbot IA offre des réponses 10x plus précises et une intégration plus poussée que ${cd.chatbotsDetected?.join(', ') || 'votre outil actuel'}.`
    : `Vos concurrents utilisent déjà des chatbots - installez-en un maintenant pour capturer chaque visiteur avant eux et ne plus jamais manquer un client potentiel.`

  return (
    <Document>
      <Page size="A4" style={s.page}>

        {/* HEADER */}
        <View style={s.header}>
          <View style={{ flex: 1 }}>
            <Text style={s.name}>{lead.name}</Text>
            <Text style={s.addressText}>{lead.address}</Text>
            {lead.domain && (
              <Text style={[s.addressText, { marginTop: 3, color: C.accent }]}>
                {lead.domain}
              </Text>
            )}
          </View>
          <View style={s.scoreBubble}>
            <Text style={[s.scoreNum, { color }]}>{score}</Text>
            <Text style={s.scoreLabel}>/100</Text>
          </View>
        </View>

        {/* CONTACT */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Contact</Text>
          {lead.phone && (
            <View style={s.row}>
              <Text style={s.label}>Téléphone</Text>
              <Text style={s.value}>{lead.phone}</Text>
            </View>
          )}
          {lead.website && (
            <View style={s.row}>
              <Text style={s.label}>Site web</Text>
              <Text style={[s.value, { color: C.accent }]}>{lead.website}</Text>
            </View>
          )}
          {dm?.name && (
            <View style={s.row}>
              <Text style={s.label}>Décideur</Text>
              <Text style={s.value}>{dm.name}{dm.title ? ` - ${dm.title}` : ''}</Text>
            </View>
          )}
          {(dm?.email || dm?.hunterData?.email) && (
            <View style={s.row}>
              <Text style={s.label}>Email</Text>
              <Text style={[s.value, { color: C.accent }]}>{dm.email || dm.hunterData?.email}</Text>
            </View>
          )}
        </View>

        {/* GOOGLE */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Présence Google</Text>
          <View style={s.row}>
            <Text style={s.label}>Note</Text>
            <Text style={[s.value, { color: C.warning }]}>{starsText(lead.google?.rating)}  {lead.google?.rating ?? '-'}/5</Text>
            <Text style={[s.value, { color: C.muted, textAlign: 'right' }]}>{lead.google?.totalReviews ?? 0} avis</Text>
          </View>
          {ra && ra.total > 0 && (
            <View style={s.row}>
              <Text style={s.label}>Sentiment</Text>
              <Text style={[s.value, { color: C.success }]}>{ra.positiveScore}% positifs</Text>
              <Text style={[s.value, { color: C.danger }]}>{ra.negativeScore}% négatifs</Text>
            </View>
          )}
          {(ra?.negative?.unanswered ?? 0) > 0 && (
            <View style={s.row}>
              <Text style={s.label}>Sans réponse</Text>
              <Text style={[s.value, { color: C.danger }]}>{ra.negative.unanswered} avis négatifs ignorés</Text>
            </View>
          )}
        </View>

        {/* CHATBOT */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Détection chatbot</Text>
          {cd ? (
            <View style={[s.card, { borderColor: cd.hasChatbot ? '#ef444433' : '#10b98133' }]}>
              <Text style={{ fontSize: 10, color: cd.hasChatbot ? C.danger : C.success, fontFamily: 'Helvetica-Bold' }}>
                {cd.opportunity}
              </Text>
              {cd.hasChatbot && cd.chatbotsDetected?.length > 0 && (
                <Text style={[s.addressText, { marginTop: 4 }]}>
                  Outils détectés : {cd.chatbotsDetected.join(', ')}
                </Text>
              )}
            </View>
          ) : (
            <Text style={s.addressText}>Non analysé</Text>
          )}
        </View>

        {/* PITCH */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Pitch commercial</Text>
          <View style={[s.pitchBox, { backgroundColor: '#00d4ff0d', borderWidth: 1, borderColor: '#00d4ff22' }]}>
            <Text style={[s.pitchText, { color: C.text }]}>{pitch}</Text>
          </View>
          {opp && (
            <View>
              <View style={[s.row, { marginTop: 4 }]}>
                <Text style={s.label}>Urgence</Text>
                <Text style={[s.value, { color: urgencyColor(opp.urgency), fontFamily: 'Helvetica-Bold' }]}>
                  {opp.urgency?.toUpperCase() ?? ''}
                </Text>
              </View>
              {(opp.reasons || []).map((reason, i) => (
                <View key={i} style={s.row}>
                  <Text style={[s.label, { width: 12, color: C.accent }]}>!</Text>
                  <Text style={[s.value, { color: C.muted }]}>{reason}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* AVIS */}
        {reviews.length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Avis représentatifs</Text>
            {reviews.slice(0, 3).map((rev, i) => (
              <View key={i} style={s.card}>
                <View style={s.row}>
                  <Text style={{ fontSize: 9, color: C.warning }}>{starsText(rev.rating)}</Text>
                  <Text style={{ fontSize: 9, color: C.text, fontFamily: 'Helvetica-Bold', marginLeft: 6, flex: 1 }}>
                    {rev.author}
                  </Text>
                  {rev.time && (
                    <Text style={s.footerText}>{rev.time}</Text>
                  )}
                </View>
                {rev.text && (
                  <Text style={[s.reviewText, { maxLines: 3 }]}>{rev.text}</Text>
                )}
              </View>
            ))}
          </View>
        )}

        {/* FOOTER */}
        <View style={s.footer} fixed>
          <Text style={s.footerText}>Généré le {date} · LeadGen Pro</Text>
          <Text style={s.footerText}>{lead.name} · Score {score}/100</Text>
        </View>

      </Page>
    </Document>
  )
}
