# PDF Export Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a "📄 Exporter PDF" button in LeadDetail that generates a formatted commercial lead sheet using @react-pdf/renderer.

**Architecture:** Pure frontend solution — a `LeadPDF.jsx` component composes the PDF using `@react-pdf/renderer` JSX primitives. The button in `LeadDetail.jsx` calls `pdf(<LeadPDF lead={lead} />).toBlob()` and triggers a download. No backend changes needed.

**Tech Stack:** React 19, @react-pdf/renderer, Vite (ESM), existing lead data object.

---

### Task 1: Install @react-pdf/renderer

**Files:**
- Modify: `frontend/package.json` (via npm install)

**Step 1: Install the package**

```bash
cd C:/Users/kimra/Desktop/applica/leadgen-project/frontend
npm install @react-pdf/renderer
```

Expected output: `added N packages` with no errors.

**Step 2: Verify import resolves**

```bash
node -e "require('./node_modules/@react-pdf/renderer/dist/react-pdf.cjs.js'); console.log('OK')"
```

Expected: `OK`

**Step 3: Commit**

```bash
git add frontend/package.json frontend/package-lock.json
git commit -m "feat: add @react-pdf/renderer dependency"
```

---

### Task 2: Create LeadPDF.jsx component

**Files:**
- Create: `frontend/src/components/LeadPDF.jsx`

**Context:** `@react-pdf/renderer` exports `Document`, `Page`, `View`, `Text`, `StyleSheet`, `pdf`. All layout uses flexbox. No HTML tags — only these primitives. Fonts default to Helvetica.

**Step 1: Create the file with full content**

```jsx
import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer'

const C = {
  bg:       '#0d0d12',
  accent:   '#00d4ff',
  success:  '#10b981',
  danger:   '#ef4444',
  warning:  '#f59e0b',
  muted:    '#9ca3af',
  text:     '#f0f0f8',
  faint:    '#4b5563',
  white:    '#ffffff',
  card:     '#13131a',
}

const s = StyleSheet.create({
  page:        { backgroundColor: '#1a1a24', padding: 32, fontFamily: 'Helvetica', color: C.white },
  header:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: '#ffffff18' },
  name:        { fontSize: 18, fontFamily: 'Helvetica-Bold', color: C.white, marginBottom: 4 },
  address:     { fontSize: 9, color: C.muted },
  scoreBubble: { alignItems: 'center', backgroundColor: '#00d4ff18', borderRadius: 8, padding: '8 14', borderWidth: 1, borderColor: '#00d4ff44' },
  scoreNum:    { fontSize: 26, fontFamily: 'Helvetica-Bold', color: C.accent },
  scoreLabel:  { fontSize: 8, color: C.muted },
  section:     { marginBottom: 14 },
  sectionTitle:{ fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#ffffff44', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 7, paddingBottom: 4, borderBottomWidth: 1, borderBottomColor: '#ffffff0d' },
  row:         { flexDirection: 'row', gap: 6, marginBottom: 4, alignItems: 'center' },
  label:       { fontSize: 9, color: C.muted, width: 80 },
  value:       { fontSize: 9, color: C.white, flex: 1 },
  badge:       { borderRadius: 4, padding: '2 7', fontSize: 8, fontFamily: 'Helvetica-Bold' },
  card:        { backgroundColor: '#ffffff08', borderRadius: 6, padding: '8 10', marginBottom: 6, borderWidth: 1, borderColor: '#ffffff0d' },
  reviewText:  { fontSize: 8.5, color: C.muted, lineHeight: 1.5, marginTop: 3 },
  pitchBox:    { borderRadius: 8, padding: '10 12', marginBottom: 6 },
  pitchText:   { fontSize: 9.5, lineHeight: 1.6, fontFamily: 'Helvetica-Oblique' },
  footer:      { position: 'absolute', bottom: 20, left: 32, right: 32, flexDirection: 'row', justifyContent: 'space-between' },
  footerText:  { fontSize: 7.5, color: C.faint },
})

function stars(rating = 0) {
  const full  = Math.round(rating)
  return '★'.repeat(full) + '☆'.repeat(5 - full)
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
  const score    = lead.score?.total ?? 0
  const bd       = lead.score?.breakdown ?? {}
  const ra       = lead.reviewAnalysis
  const opp      = ra?.chatbotOpportunity
  const cd       = lead.chatbotDetection
  const dm       = lead.decisionMaker
  const reviews  = lead.google?.reviews || []
  const color    = scoreColor(score)
  const date     = new Date().toLocaleDateString('fr-FR')

  const pitch = cd?.hasChatbot
    ? `Votre solution actuelle peut être améliorée — notre chatbot IA offre des réponses 10× plus précises et une intégration plus poussée que ${cd.chatbotsDetected?.join(', ') || 'votre outil actuel'}.`
    : `Vos concurrents utilisent déjà des chatbots — installez-en un maintenant pour capturer chaque visiteur avant eux et ne plus jamais manquer un client potentiel.`

  return (
    <Document>
      <Page size="A4" style={s.page}>

        {/* HEADER */}
        <View style={s.header}>
          <View style={{ flex: 1 }}>
            <Text style={s.name}>{lead.name}</Text>
            <Text style={s.address}>{lead.address}</Text>
            {lead.domain && (
              <Text style={[s.address, { marginTop: 3, color: C.accent }]}>
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
              <Text style={s.value}>
                {dm.name}{dm.title ? ` — ${dm.title}` : ''}
              </Text>
            </View>
          )}
          {(dm?.email || dm?.hunterData?.email) && (
            <View style={s.row}>
              <Text style={s.label}>Email</Text>
              <Text style={[s.value, { color: C.accent }]}>
                {dm.email || dm.hunterData?.email}
              </Text>
            </View>
          )}
        </View>

        {/* GOOGLE */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Présence Google</Text>
          <View style={s.row}>
            <Text style={[s.label]}>Note</Text>
            <Text style={[s.value, { color: C.warning }]}>
              {stars(lead.google?.rating)}  {lead.google?.rating ?? '—'}/5
            </Text>
            <Text style={[s.value, { color: C.muted, textAlign: 'right' }]}>
              {lead.google?.totalReviews ?? 0} avis
            </Text>
          </View>
          {ra && ra.total > 0 && (
            <View style={s.row}>
              <Text style={s.label}>Sentiment</Text>
              <Text style={[s.value, { color: C.success }]}>😊 {ra.positiveScore}% positifs</Text>
              <Text style={[s.value, { color: C.danger }]}>😠 {ra.negativeScore}% négatifs</Text>
            </View>
          )}
          {ra?.negative?.unanswered > 0 && (
            <View style={s.row}>
              <Text style={s.label}>Sans réponse</Text>
              <Text style={[s.value, { color: C.danger }]}>
                {ra.negative.unanswered} avis négatifs ignorés
              </Text>
            </View>
          )}
        </View>

        {/* CHATBOT DETECTION */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Détection chatbot</Text>
          {cd ? (
            <View style={[s.card, { borderColor: cd.hasChatbot ? '#ef444433' : '#10b98133' }]}>
              <Text style={{ fontSize: 10, color: cd.hasChatbot ? C.danger : C.success, fontFamily: 'Helvetica-Bold' }}>
                {cd.opportunity}
              </Text>
              {cd.hasChatbot && cd.chatbotsDetected?.length > 0 && (
                <Text style={[s.address, { marginTop: 4 }]}>
                  Outils détectés : {cd.chatbotsDetected.join(', ')}
                </Text>
              )}
            </View>
          ) : (
            <Text style={[s.address]}>Non analysé</Text>
          )}
        </View>

        {/* PITCH COMMERCIAL */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Pitch commercial</Text>
          <View style={[s.pitchBox, { backgroundColor: '#00d4ff0d', borderWidth: 1, borderColor: '#00d4ff22' }]}>
            <Text style={[s.pitchText, { color: C.text }]}>{pitch}</Text>
          </View>
          {opp && (
            <>
              <View style={[s.row, { marginTop: 4 }]}>
                <Text style={s.label}>Urgence</Text>
                <Text style={[s.value, { color: urgencyColor(opp.urgency), fontFamily: 'Helvetica-Bold' }]}>
                  {opp.urgency?.toUpperCase()}
                </Text>
              </View>
              {opp.reasons?.map((reason, i) => (
                <View key={i} style={s.row}>
                  <Text style={[s.label, { width: 10, color: C.accent }]}>⚡</Text>
                  <Text style={[s.value, { color: C.muted }]}>{reason}</Text>
                </View>
              ))}
            </>
          )}
        </View>

        {/* AVIS */}
        {reviews.length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Avis représentatifs</Text>
            {reviews.slice(0, 3).map((rev, i) => (
              <View key={i} style={s.card}>
                <View style={s.row}>
                  <Text style={{ fontSize: 9, color: C.warning }}>{stars(rev.rating)}</Text>
                  <Text style={[s.label, { width: 'auto', marginLeft: 6, color: C.text, fontFamily: 'Helvetica-Bold' }]}>
                    {rev.author}
                  </Text>
                  {rev.time && (
                    <Text style={[s.footerText, { marginLeft: 'auto' }]}>{rev.time}</Text>
                  )}
                </View>
                {rev.text && (
                  <Text style={s.reviewText} numberOfLines={3}>{rev.text}</Text>
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
```

**Step 2: Verify no syntax errors**

Open the app in browser (`npm run dev` in frontend/) and check console — no import errors.

**Step 3: Commit**

```bash
git add frontend/src/components/LeadPDF.jsx
git commit -m "feat: add LeadPDF component with @react-pdf/renderer"
```

---

### Task 3: Add export button in LeadDetail.jsx

**Files:**
- Modify: `frontend/src/components/LeadDetail.jsx`

**Context:** The actions bar is at the bottom of the component (look for `{/* ACTIONS */}`). It renders a flex row of buttons. The button must:
1. Import `pdf` from `@react-pdf/renderer` and `LeadPDF`
2. Call `pdf(<LeadPDF lead={lead} />).toBlob()` on click
3. Create an object URL and trigger `<a>.click()` to download

**Step 1: Add imports at top of LeadDetail.jsx**

Find the existing imports block (first 5 lines of the file) and add:

```js
import { pdf } from '@react-pdf/renderer'
import LeadPDF from './LeadPDF'
```

**Step 2: Add the handler inside the component** (after `handleIgnore`):

```js
const handleExportPDF = async () => {
  const blob = await pdf(<LeadPDF lead={lead} />).toBlob()
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = `fiche-${lead.name.toLowerCase().replace(/\s+/g, '-')}.pdf`
  a.click()
  URL.revokeObjectURL(url)
}
```

**Step 3: Add the button to the actions array**

Find the array of action buttons (the one with `label: contactedConfirm ? ...`) and add a fourth entry:

```js
{
  label:   '📄 Exporter PDF',
  onClick: handleExportPDF,
  active:  false,
  color:   '#8b5cf6',
},
```

**Step 4: Verify in browser**

- Click a lead → panneau s'ouvre
- Click "📄 Exporter PDF"
- Un fichier `fiche-[nom].pdf` doit se télécharger
- Ouvrir le PDF → vérifier que nom, score, contact, chatbot et pitch s'affichent

**Step 5: Commit**

```bash
git add frontend/src/components/LeadDetail.jsx
git commit -m "feat: wire PDF export button in LeadDetail"
```

---

### Task 4: Handle @react-pdf/renderer Vite compatibility

**Context:** `@react-pdf/renderer` uses some Node.js internals that can cause Vite ESM issues. If the browser console shows errors like `process is not defined` or `Cannot use import statement`, add this to `vite.config.js`.

**Files:**
- Modify: `frontend/vite.config.js` (only if errors appear)

**Step 1: Check for Vite errors after Task 3**

Run `npm run dev`, open browser console. If no errors → skip this task.

**Step 2: If errors — update vite.config.js**

```js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    include: ['@react-pdf/renderer'],
  },
  build: {
    commonjsOptions: {
      include: [/@react-pdf\/renderer/, /node_modules/],
    },
  },
})
```

**Step 3: Restart dev server and retest**

```bash
# Ctrl+C to stop, then:
npm run dev
```

**Step 4: Commit if changed**

```bash
git add frontend/vite.config.js
git commit -m "fix: add @react-pdf/renderer Vite compatibility config"
```
