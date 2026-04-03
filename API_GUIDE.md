# 🔑 API_GUIDE — Obtenir et configurer les APIs

## APIs nécessaires

| API | Gratuit ? | Pour quoi |
|-----|-----------|-----------|
| Google Maps JS | Oui (avec clé) | Afficher la carte |
| Google Places | 200$/mois gratuit | Chercher les business |
| Google Place Details | Inclus Places | Avis, horaires, phone |
| Apify | 5$/mois plan Starter | LinkedIn, Instagram, TikTok |
| Facebook Pages API | Gratuit | Pages Facebook publiques |

---

## Étape 1 — Google Cloud Console

### Créer une clé API Google

1. Va sur [console.cloud.google.com](https://console.cloud.google.com)
2. Crée un projet (bouton en haut : "Nouveau projet")
3. Dans le menu gauche → **APIs et services** → **Bibliothèque**
4. Active ces 3 APIs :
   - `Maps JavaScript API`
   - `Places API`
   - `Geocoding API`
5. Dans **APIs et services** → **Identifiants** → **+ Créer des identifiants** → **Clé API**
6. Copie la clé → colle dans `.env` à la ligne `GOOGLE_MAPS_API_KEY`

### Restrictions recommandées (sécurité)
- Dans la clé créée → **Restrictions d'application** → **Référents HTTP**
- Ajoute : `http://localhost:5173/*`

### Facturation
- Google offre **200$ de crédit/mois** = environ **40 000 recherches Places gratuites**
- Tu dois quand même ajouter une carte bancaire pour activer

---

## Étape 2 — Apify (LinkedIn/Instagram/TikTok)

1. Va sur [apify.com](https://apify.com) → Créer un compte gratuit
2. Dans le dashboard → **Settings** → **Integrations** → copie ton **API Token**
3. Colle dans `.env` à la ligne `APIFY_API_TOKEN`

### Scrapers Apify utilisés (gratuits sur plan Starter) :
- `bebity/linkedin-company-scraper` — LinkedIn
- `apify/instagram-scraper` — Instagram
- `clockworks/tiktok-scraper` — TikTok

> **Note** : L'enrichissement social est optionnel. L'app fonctionne avec Google seul.

---

## Étape 3 — Facebook

1. Va sur [developers.facebook.com](https://developers.facebook.com)
2. Crée une app → **Consumer**
3. Dans l'app → **Outils** → **Explorateur de l'API Graph**
4. Génère un token avec permission `pages_read_engagement`
5. Colle dans `.env` à la ligne `FACEBOOK_ACCESS_TOKEN`

> **Note** : Facebook Pages publiques ne nécessitent pas toujours un token.

---

## Fichier .env complet

```env
# ===========================
# GOOGLE APIs (OBLIGATOIRE)
# ===========================
GOOGLE_MAPS_API_KEY=AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX

# ===========================
# ENRICHISSEMENT SOCIAL (OPTIONNEL)
# ===========================
APIFY_API_TOKEN=apify_api_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
FACEBOOK_ACCESS_TOKEN=XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX

# ===========================
# SERVEUR
# ===========================
PORT=3001
NODE_ENV=development

# ===========================
# FRONTEND
# ===========================
VITE_API_URL=http://localhost:3001
VITE_GOOGLE_MAPS_KEY=AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
```

---

## Tester que Google Places fonctionne

Lance ce curl depuis ton terminal après avoir rempli le `.env` :

```bash
curl "https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=48.8566,2.3522&radius=5000&type=restaurant&key=TA_CLE_ICI"
```

Tu dois voir une réponse JSON avec `"status": "OK"` et des résultats.

---

## Limites et coûts estimés

| Action | Coût Google | 200$/mois = |
|--------|-------------|-------------|
| Nearby Search | 0.032$ / appel | ~6 250 recherches |
| Place Details | 0.017$ / appel | ~11 750 détails |
| Geocoding | 0.005$ / appel | ~40 000 géocodages |

**Pour une agence qui fait 50 recherches/jour** → environ 15$ / mois.
