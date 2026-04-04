# CLAUDE.md — Frontend LeadGen Pro

> Instructions spécifiques au frontend React/Vite. Complète le CLAUDE.md racine.

---

## STACK

React 18 (hooks fonctionnels) + Vite — port **5173**
ESM strict. Pas de TypeScript. Pas de class components.

---

## RÈGLE ABSOLUE : INLINE STYLES

**Jamais de Tailwind. Jamais de CSS modules. Jamais de className externe.**

```jsx
// ✅ Correct
<div style={{ background: '#0D1410', borderRadius: 12, padding: '12px 16px' }}>

// ❌ Interdit
<div className="bg-dark rounded-lg p-4">
<div className={styles.container}>
<div tw="bg-dark">
```

Seules exceptions autorisées :
- `App.css` — définit les `--tokens` CSS et les `@keyframes`
- `className="ld-btn"` ou `className="ld-scroll"` — classes utilitaires **déjà définies** dans App.css
- `var(--accent)` dans les inline styles → toujours préférer la valeur hex directe pour la cohérence

---

## DESIGN TOKENS — RÉFÉRENCE COMPLÈTE

### Couleurs hex — à utiliser directement en inline styles

```js
// Fonds
'#0D1410'    // fond principal (body, overlay)
'#111813'    // surface secondaire
'#161D18'    // fond carte
'#0a1109'    // fond très sombre (approfondissement, hover état actif)

// Accents
'#1D6E55'    // vert forêt — couleur primaire, texte accent vert
'#EDFA36'    // jaune vif — CTA principal, badges importants, texte highlight
'#4ade80'    // vert clair — succès vif, gradients

// États
'#22c55e'    // succès
'#f59e0b'    // warning
'#ef4444'    // danger
'#f87171'    // danger clair (texte d'erreur inline)

// Texte (du plus clair au plus sombre)
'#F5F5F0'    // texte principal
'#f1f5f9'    // texte légèrement bleuté (secondaire)
'#e2e8f0'    // texte tertiaire
'#94a3b8'    // muted clair
'#64748b'    // muted sombre
'#475569'    // labels très discrets
```

### RGBA — à mémoriser, utilisés partout

```js
// Fonds de surface / card
'rgba(255,255,255,0.06)'    // fond glassmorphism standard (LoadingCard, modales)
'rgba(255,255,255,0.05)'    // fond section card
'rgba(255,255,255,0.03)'    // fond section très léger
'rgba(255,255,255,0.02)'    // quasi-transparent (sub-sections)

// Bordures
'rgba(255,255,255,0.1)'     // bordure glassmorphism standard
'rgba(255,255,255,0.12)'    // bordure un peu plus visible
'rgba(255,255,255,0.15)'    // bordure hover
'rgba(255,255,255,0.08)'    // bordure standard douce
'rgba(255,255,255,0.06)'    // bordure très subtile
'rgba(255,255,255,0.05)'    // bordure quasi-invisible

// Accent vert
'rgba(29,110,85,0.25)'     // fond bouton secondaire (vert moyen)
'rgba(29,110,85,0.15)'     // fond badge vert discret
'rgba(29,110,85,0.12)'     // fond bouton secondaire doux
'rgba(29,110,85,0.06)'     // hover sur élément vert
'rgba(29,110,85,0.04)'     // hover très subtil
'rgba(29,110,85,0.4)'      // bordure bouton vert
'rgba(29,110,85,0.35)'     // ombre / glow card principale
'rgba(29,110,85,0.3)'      // bordure accent vert
'rgba(29,110,85,0.25)'     // bordure vert moyen
'rgba(29,110,85,0.12)'     // séparateur section vert

// Accent jaune
'rgba(237,250,54,0.15)'    // fond badge jaune
'rgba(237,250,54,0.1)'     // fond bouton favori
'rgba(237,250,54,0.3)'     // bordure jaune
'rgba(237,250,54,0.25)'    // bordure jaune douce
'rgba(237,250,54,0.5)'     // état loading bouton jaune

// Danger / Warning
'rgba(239,68,68,0.1)'      // fond erreur
'rgba(239,68,68,0.2)'      // bordure erreur
'rgba(239,68,68,0.25)'     // bordure bouton ignorer
'rgba(245,158,11,0.1)'     // fond warning
```

### Typographie

```js
fontFamily: 'var(--font-display)'    // 'Clash Display' — titres, grands scores
fontFamily: 'var(--font-body)'       // 'Cabinet Grotesk' — corps, boutons, labels
fontFamily: 'var(--font-mono)'       // 'DM Mono' — téléphones, codes, données techniques
```

### Rayons et espacements standards

```js
borderRadius: 6     // micro-éléments (petits badges, retry buttons)
borderRadius: 8     // inputs, tags, petites cards
borderRadius: 9     // badges de statut
borderRadius: 10    // boutons
borderRadius: 12    // cards moyennes, boutons larges
borderRadius: 16    // panels principaux
borderRadius: 20    // overlay / modales
borderRadius: '50%' // cercles, avatars, score circles
```

---

## PATTERNS DE BOUTONS — depuis le code réel

### Bouton secondaire (action douce — ex: "Contacter")

```jsx
style={{
  height: 36, borderRadius: 10,
  border: '1px solid rgba(29,110,85,0.4)',
  background: 'rgba(29,110,85,0.25)',
  color: '#1d6e55',
  fontSize: 12, fontWeight: 600, cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
}}
```

### Bouton accent jaune (action principale — ex: "Favori", "Générer")

```jsx
style={{
  height: 36, borderRadius: 10,
  border: '1px solid rgba(237,250,54,0.25)',
  background: 'rgba(237,250,54,0.1)',
  color: '#edfa36',
  fontSize: 12, fontWeight: 600, cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
}}
```

### Bouton CTA solide (unlock, action critique)

```jsx
style={{
  padding: '10px 24px', borderRadius: 10, border: 'none',
  background: '#edfa36',
  color: '#0d1410',
  fontSize: 14, fontWeight: 700, cursor: 'pointer',
  display: 'flex', alignItems: 'center', gap: 8,
}}
```

### Bouton danger (ex: "Ignorer")

```jsx
style={{
  height: 36, borderRadius: 10,
  border: '1px solid rgba(239,68,68,0.25)',
  background: 'rgba(239,68,68,0.1)',
  color: '#ef4444',
  fontSize: 12, fontWeight: 600, cursor: 'pointer',
}}
```

### Micro-bouton (retry, réessayer)

```jsx
style={{
  fontSize: 10, color: '#EDFA36',
  background: 'none',
  border: '1px solid rgba(29,110,85,0.25)',
  borderRadius: 5, padding: '2px 8px', cursor: 'pointer',
}}
```

---

## GLASSMORPHISM — depuis le code réel

### Card glassmorphism standard (LoadingOverlay, modales)

```jsx
style={{
  background: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 20,
  backdropFilter: 'blur(12px)',
  WebkitBackdropFilter: 'blur(12px)',
  boxShadow: '0px 20px 60px rgba(0,0,0,0.5)',
}}
```

### Overlay de fond (lock overlay, modales sombres)

```jsx
style={{
  position: 'absolute', inset: 0, zIndex: 10,
  background: 'rgba(13,20,16,0.75)',
  backdropFilter: 'blur(6px)',
  WebkitBackdropFilter: 'blur(6px)',
}}
```

### Panel principal (LeadDetail container)

```jsx
style={{
  background: 'rgba(17,24,20,0.96)',
  border: '1px solid rgba(29,110,85,0.35)',
  borderRadius: 16,
  boxShadow: '0px 8px 32px rgba(29,110,85,0.28)',
  backdropFilter: 'blur(12px)',
  WebkitBackdropFilter: 'blur(12px)',
}}
```

---

## COMPOSANTS — RÈGLES

### Hooks fonctionnels uniquement

```jsx
// ✅ Correct
export default function MyComponent({ lead, onClose }) {
  const [state, setState] = useState('idle')
  // ...
}

// ❌ Interdit
class MyComponent extends Component { render() {} }
```

### Pattern état on-demand (idle → loading → done | error)

```jsx
const [myState, setMyState] = useState('idle')  // 'idle' | 'loading' | 'done' | 'error'
const [myData,  setMyData]  = useState(null)
const [myError, setMyError] = useState(null)

const handleLoad = async () => {
  if (myState === 'loading') return  // guard anti-double-clic
  setMyState('loading')
  try {
    const res = await fetch('/api/...', { method: 'POST', ... })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    setMyData(data)
    setMyState('done')
  } catch (e) {
    setMyError(e.message)
    setMyState('error')
  }
}
```

### Réinitialisation sur changement de lead (useEffect dans LeadDetail)

Toujours reset les états on-demand dans le `useEffect([lead?.id, lead?._id])` :
```js
useEffect(() => {
  setMyState('idle')
  setMyData(null)
  setMyError(null)
}, [lead?.id, lead?._id])
```

### Sons — try/catch obligatoire

```jsx
import { playClick, playSuccess, playError } from '../utils/sounds'

// Sons dans un try/catch
const handleClick = () => {
  try { playClick() } catch {}
  // ... action
}
```

`sounds.js` gère lui-même `window.leadgenSoundEnabled` — ne pas ajouter de guard manuel.

---

## HOOKS DISPONIBLES

### `useLeads()`

```js
const {
  leads,                    // Lead[] — liste complète
  isLoading,                // boolean
  error,                    // string | null
  progress,                 // { message, current?, total? } | null
  searchLeads,              // (params) → void — lance la recherche SSE
  updateLeadStatus,         // (id, status) → void — persiste localStorage + Sheets si 'favorite'
  updateLeadDecisionMaker,  // (id, dm) → void — persiste localStorage
  updateLeadData,           // (id, enrichedData) → void — merge dans leads[] (utilisé par unlock)
  exportLeads,              // () → void — télécharge CSV
  forceCloseOverlay,        // () → void — force isLoading=false
} = useLeads()
```

### `useScoringProfiles()`

```js
const {
  profiles,          // Profile[] — 12 preset + custom
  activeProfile,     // Profile | null
  setActiveProfile,  // (profile) → void
  createProfile,     // (profile) → void — persiste dans scoringProfiles.json via API
  updateProfile,     // (id, updates) → void
  deleteProfile,     // (id) → void
} = useScoringProfiles()
```

---

## PERSISTANCE LOCALSTORAGE

| Clé | Contenu | Type |
|-----|---------|------|
| `leadgen_statuses` | `{ [leadId]: status }` | Object JSON |
| `lead_status_{id}` | `status` individuel (prioritaire sur leadgen_statuses) | String |
| `dm_{id}` | décisionnaire JSON stringifié | JSON string |
| `leadgen_saved_searches` | recherches sauvegardées | Array JSON |
| `activeProfileId` | id du profil scoring actif | String |

`window.leadgenSoundEnabled` — session uniquement, pas localStorage.

---

## FICHIERS ACTIFS VS INACTIFS

| Fichier | Statut |
|---------|--------|
| `components/SidebarSearch.jsx` | **ACTIF** — formulaire de recherche branché dans App.jsx |
| `components/SearchPanel.jsx` | **INUTILISÉ** — ne pas modifier, ne pas supprimer sans accord |
| `components/LeadDetail.jsx` | **ACTIF** — ~3000 lignes, toute l'interactivité on-demand |

---

## NE JAMAIS MODIFIER SANS DEMANDE

- `App.jsx` — état global (`leads`, `selectedLead`, `activeTab`) et layout principal
- `App.css` — design tokens (seule source de vérité CSS)
- `vite.config.js` — proxy SSE (`proxyTimeout: 0` est intentionnel)
- `hooks/useScoringProfiles.js` — 12 profils preset hardcodés
