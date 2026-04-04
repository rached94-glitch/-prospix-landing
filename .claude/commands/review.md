Relis le dernier changement de code. Vérifie : sécurité (XSS, injection), cohérence avec l'architecture existante, respect des design tokens, gestion d'erreurs, impact sur le cache et le SSE. Ne modifie rien, liste les problèmes trouvés.

---

## Checklist de review

### Sécurité

- [ ] Pas d'interpolation directe de `req.body` dans des commandes shell, requêtes SQL, ou eval
- [ ] Pas de données utilisateur injectées dans du HTML sans échappement (`esc()` dans exportPDF.js)
- [ ] Pas de clé API exposée côté frontend (pas de `process.env.GOOGLE_MAPS_API_KEY` dans le code React)
- [ ] Pas de `innerHTML` avec contenu non échappé
- [ ] Réponses d'erreur : ne pas exposer les stack traces en production (`e.message` seulement)

### Architecture et cohérence

- [ ] Les services backend utilisent `createCache()` de `cache/searchCache.js` — pas de `new Map()` pour du cache persistant
- [ ] Tout appel API externe est wrappé dans `withTimeout(promise, ms, fallback)` — jamais sans
- [ ] La structure de l'objet `lead` est cohérente entre `buildLead()` et `LeadDetail.jsx`
- [ ] Un nouveau namespace de cache est unique (pas de doublon avec les namespaces existants)
- [ ] Les routes SSE vérifient `if (res.writableEnded) return` avant chaque `res.write()`
- [ ] `SearchPanel.jsx` n'est pas utilisé dans `App.jsx` — c'est `SidebarSearch.jsx` le composant actif

### Design tokens frontend

- [ ] Pas de couleur hardcodée hors des tokens (`#0D1410`, `#1D6E55`, `#EDFA36`, etc.)
- [ ] Pas de `className` CSS externe (Tailwind, Bootstrap, modules)
- [ ] Inline styles uniquement (`style={{ ... }}`)
- [ ] Glassmorphism : `bg rgba(255,255,255,0.06)` + `border rgba(255,255,255,0.1)` + `backdropFilter blur(12px)`
- [ ] Bouton secondaire : `bg rgba(29,110,85,0.12)` ou `rgba(29,110,85,0.25)` + `border rgba(29,110,85,0.4)`
- [ ] Bouton accent jaune : `bg rgba(237,250,54,0.15)` ou `rgba(237,250,54,0.1)` + `color #edfa36`

### Gestion d'erreurs

- [ ] Tout `async/await` a un `try/catch` ou une gestion d'erreur explicite
- [ ] Les états on-demand suivent `idle → loading → done | error`
- [ ] Les appels à `sounds.js` sont dans un `try/catch`
- [ ] Les `console.log` de services backend ont le préfixe `[NomService]`

### Impact sur le cache et le SSE

- [ ] Un changement de structure de données invalide-t-il le cache existant ? (→ vider ou migrer)
- [ ] Un nouveau service lent a-t-il un `withTimeout` pour ne pas bloquer le stream SSE ?
- [ ] `nodemonConfig.ignore` dans `package.json` couvre les nouveaux fichiers JSON écrits par le backend ?

---

## Format de sortie

```
## Review — [nom du fichier ou de la feature]

### Sécurité
- [CRITIQUE] : ...
- Rien à signaler

### Architecture
- [IMPORTANT] ligne 42 : withTimeout() manquant sur l'appel à pappersService
- [MINEUR] : clé de cache potentiellement ambiguë

### Design tokens
- [STYLE] : couleur '#1a1a1a' au lieu de '#0D1410'

### Gestion d'erreurs
- [IMPORTANT] : pas de catch sur l'appel fetch ligne 87

### Impact cache/SSE
- Rien à signaler
```

Sévérités : **CRITIQUE** | **IMPORTANT** | **MINEUR** | **STYLE**
