Ne code rien. Analyse la demande et produis un plan d'implémentation : fichiers à modifier, ordre des étapes, dépendances, risques potentiels, impact sur l'architecture existante.

---

## Instructions

1. Lire les fichiers concernés pour comprendre l'état actuel du code
2. Analyser l'impact sur l'architecture (SSE, cache, scoring, frontend/backend)
3. Produire le plan structuré ci-dessous
4. Poser les questions bloquantes AVANT de commencer
5. Attendre la validation explicite avant de coder quoi que ce soit

---

## Template de plan

### 1. Compréhension de la demande

Reformuler en une phrase ce qui est demandé, et confirmer la compréhension.

### 2. Fichiers impactés

```
À modifier :
  backend/routes/leads.js          ← raison courte
  frontend/src/components/LeadDetail.jsx  ← raison courte

À créer :
  backend/services/newService.js   ← raison courte

À ne PAS toucher :
  backend/server.js                ← pas d'impact
  frontend/src/App.css             ← pas de changement de tokens
```

### 3. Changements de structure de données

Si la structure de l'objet `lead` change, montrer le before/after :

```js
// Avant
{ id, name, score: { total, breakdown } }

// Après
{ id, name, score: { total, breakdown }, locked: boolean }
```

**Impact cache** : les entrées de cache existantes sont-elles compatibles ?
→ Si non : préciser quel namespace invalider ou comment migrer.

### 4. Plan d'implémentation — étapes ordonnées

Chaque étape doit être **indépendante et testable** avant de passer à la suivante.

```
Étape 1 : backend/services/googlePlaces.js
  - Ajouter getPlaceDetailsBasic() — fields: photos, rating, user_ratings_total
  - Modifier enrichBatch() pour utiliser getPlaceDetailsBasic()
  - Tester : curl POST /api/leads/search/stream → vérifier locked:true sur les leads

Étape 2 : backend/routes/leads.js
  - Ajouter POST /unlock/:placeId
  - Tester : curl POST /api/leads/unlock/PLACE_ID

Étape 3 : frontend/src/hooks/useLeads.js
  - Ajouter updateLeadData(id, enrichedData)
  - Tester : appeler manuellement depuis la console

Étape 4 : frontend/src/components/LeadDetail.jsx
  - Ajouter isUnlocked state + handleUnlock + lock overlay
  - Tester visuellement dans le navigateur
```

### 5. Dépendances entre étapes

```
Étape 2 dépend de Étape 1 (googlePlaces.js doit exporter cleanWebsiteUrl)
Étape 4 dépend de Étapes 2 + 3
```

### 6. Risques et points d'attention

- **Cache** : changement de structure → préciser si les caches existants doivent être vidés
- **SSE** : tout appel lent dans processPlaces doit avoir withTimeout() → vérifier
- **Compatibilité** : si la réponse d'une route change → vérifier l'impact sur LeadDetail.jsx
- **Profils** : si scoring change → vérifier l'impact sur useScoringProfiles.js et scoringProfiles.json
- **server.js** : si une nouvelle route est ajoutée → ajouter le montage dans server.js

### 7. Questions bloquantes

Lister toute ambiguïté qui nécessite une décision :

- "Faut-il vider le cache `placeDetails` existant ou le garder tel quel ?"
- "Le score doit-il être recalculé à l'unlock ou réutiliser celui de la phase 1 ?"
- "L'unlock doit-il fonctionner pour les leads mock (VITE_MOCK=true) ?"

---

Répondre uniquement avec ce plan structuré. Ne pas commencer à coder avant validation.
