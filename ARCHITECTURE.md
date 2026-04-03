# 🏗️ ARCHITECTURE — Structure des fichiers

## Arborescence complète

```
leadgen-pro/
│
├── README.md                    ← Tu es ici
├── ARCHITECTURE.md              ← Ce fichier
├── FEATURES.md                  ← Détail de chaque feature
├── API_GUIDE.md                 ← Guide des APIs
├── PROMPTS.md                   ← Prompts pour Claude Code
├── .env.example                 ← Template variables d'environnement
│
├── backend/
│   ├── server.js                ← Point d'entrée Express
│   ├── package.json
│   │
│   ├── routes/
│   │   ├── leads.js             ← POST /api/leads/search
│   │   └── export.js            ← GET /api/leads/export/csv
│   │
│   └── services/
│       ├── googlePlaces.js      ← Appels Google Places API
│       ├── googleReviews.js     ← Récupération des avis Google
│       ├── socialEnrichment.js  ← Détection LinkedIn/FB/IG/TikTok
│       └── scoring.js           ← Algorithme de score 0-100
│
└── frontend/
    ├── index.html
    ├── vite.config.js
    ├── package.json
    │
    └── src/
        ├── main.jsx
        ├── App.jsx              ← Layout principal + état global
        ├── App.css              ← Variables CSS + styles globaux
        │
        ├── components/
        │   ├── Header.jsx           ← Logo + stats session
        │   ├── SearchPanel.jsx      ← Panneau gauche (filtres)
        │   ├── Map.jsx              ← Carte Leaflet interactive
        │   ├── LeadsList.jsx        ← Liste scrollable des leads
        │   ├── LeadCard.jsx         ← Card individuelle d'un lead
        │   ├── LeadDetail.jsx       ← Panneau détail (overlay)
        │   ├── ScoreBadge.jsx       ← Badge score coloré
        │   ├── SocialBadges.jsx     ← Icônes LinkedIn/FB/IG/TikTok
        │   ├── ReviewsPanel.jsx     ← Avis Google avec étoiles
        │   └── ExportButton.jsx     ← Bouton export CSV
        │
        └── hooks/
            ├── useLeads.js          ← Fetch leads + état
            ├── useMap.js            ← Géocodage + centre carte
            └── useExport.js         ← Logique export CSV
```

---

## Flux de données

```
Utilisateur remplit SearchPanel
        ↓
useLeads.js envoie POST /api/leads/search
        ↓
backend/routes/leads.js reçoit la requête
        ↓
services/googlePlaces.js cherche les business Google
        ↓
services/googleReviews.js récupère les avis pour chaque place
        ↓
services/socialEnrichment.js détecte la présence sociale
        ↓
services/scoring.js calcule le score 0-100
        ↓
Réponse JSON avec tableau de leads enrichis
        ↓
App.jsx met à jour l'état
        ↓
Map.jsx + LeadsList.jsx s'affichent simultanément
```

---

## Modèle de données — Un Lead

```json
{
  "id": "ChIJxxxx",
  "name": "Salon Coiffure Lumière",
  "address": "12 rue du Faubourg, Paris 75011",
  "phone": "+33 1 42 00 00 00",
  "website": "https://salon-lumiere.fr",
  "lat": 48.8566,
  "lng": 2.3522,
  "distance": 2.4,

  "google": {
    "rating": 4.3,
    "totalReviews": 187,
    "priceLevel": 2,
    "openNow": true,
    "reviews": [
      {
        "author": "Marie D.",
        "rating": 5,
        "text": "Excellent service, je recommande !",
        "time": "2024-01-15"
      }
    ]
  },

  "social": {
    "linkedin": "https://linkedin.com/company/salon-lumiere",
    "facebook": "https://facebook.com/salonlumiere",
    "instagram": "https://instagram.com/salonlumiere",
    "tiktok": null,
    "googleBusiness": "https://maps.google.com/?cid=xxx"
  },

  "score": {
    "total": 78,
    "breakdown": {
      "googleRating": 26,
      "reviewVolume": 21,
      "digitalPresence": 18,
      "opportunity": 13
    }
  },

  "status": "new",
  "domain": "beaute",
  "keyword": "coiffure"
}
```
