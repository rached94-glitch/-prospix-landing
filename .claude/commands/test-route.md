Teste la route backend spécifiée avec curl. Vérifie le status code, le format de la réponse, la gestion d'erreur, et le comportement avec des inputs invalides.

---

## Instructions

1. Lire la route concernée dans `backend/routes/leads.js` (ou le fichier de route approprié)
2. Identifier les paramètres requis et optionnels
3. Construire et exécuter les commandes curl ci-dessous
4. Analyser et rapporter les résultats

## Templates curl par type

### POST JSON standard

```bash
curl -s -X POST http://localhost:3001/api/leads/MA-ROUTE \
  -H "Content-Type: application/json" \
  -d '{"param1":"valeur1","param2":"valeur2"}' \
  | jq .
```

### POST avec mesure du temps de réponse

```bash
curl -s -X POST http://localhost:3001/api/leads/MA-ROUTE \
  -H "Content-Type: application/json" \
  -d '{"param1":"valeur1"}' \
  -w "\n--- HTTP %{http_code} | %{time_total}s ---\n" \
  | jq .
```

### Route SSE (search/stream) — affiche les 20 premiers événements

```bash
curl -s -X POST http://localhost:3001/api/leads/search/stream \
  -H "Content-Type: application/json" \
  -d '{
    "lat": 48.8566,
    "lng": 2.3522,
    "radius": 1,
    "domain": "restaurant",
    "keywords": [],
    "sources": [],
    "city": "Paris"
  }' --no-buffer 2>&1 | head -40
```

### Route unlock

```bash
curl -s -X POST http://localhost:3001/api/leads/unlock/PLACE_ID_ICI \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Nom du business",
    "vicinity": "123 rue Exemple, Paris",
    "lat": 48.8566,
    "lng": 2.3522,
    "city": "Paris",
    "profileId": null
  }' | jq '{name:.name,score:.score.total,phone:.phone,website:.website}'
```

### GET avec query params

```bash
curl -s "http://localhost:3001/api/cache/stats" | jq .
curl -s "http://localhost:3001/api/profiles" | jq '.[].name'
```

### Test gestion d'erreur (inputs invalides)

```bash
# Body vide
curl -s -X POST http://localhost:3001/api/leads/MA-ROUTE \
  -H "Content-Type: application/json" \
  -d '{}' | jq .

# Paramètre manquant
curl -s -X POST http://localhost:3001/api/leads/MA-ROUTE \
  -H "Content-Type: application/json" \
  -d '{"param_invalide":"test"}' | jq .
```

## Référence rapide des routes

| Route | Méthode | Paramètres principaux |
|-------|---------|----------------------|
| `/api/leads/search/stream` | POST SSE | lat, lng, radius, domain, keywords, city |
| `/api/leads/unlock/:placeId` | POST | name, vicinity, lat, lng, city, profileId |
| `/api/leads/analyze/:placeId` | POST | leadData, profileId, reviewsData |
| `/api/leads/generate-email` | POST | leadData, profileId, reviewsData |
| `/api/leads/reviews/:placeId` | POST | — |
| `/api/leads/pappers` | POST | name, city |
| `/api/leads/decision-maker` | POST | name, website, placeId |
| `/api/leads/audit` | GET | website, facebook, instagram, profileId |
| `/api/leads/semrush` | POST | website |
| `/api/export/csv` | GET | leads[] en query |
| `/api/sheets/lead` | POST | lead |
| `/api/cache/stats` | GET | — |
| `/api/profiles` | GET/POST/PUT/DELETE | — |

## Ce que vérifier dans la réponse

- **Status HTTP** : 200 (succès) / 400 (input invalide) / 500 (erreur serveur)
- **Structure** : tous les champs attendus sont présents ? Pas de `undefined` ou `null` inattendus ?
- **Erreur** : le message `{ error: "..." }` est-il clair et utile ?
- **Gestion input invalide** : retourne bien un 400 avec message explicite ?
- **Performance** : temps de réponse cohérent avec les appels effectués ?
- **Cache** : un deuxième appel identique est-il plus rapide (cache HIT) ?
