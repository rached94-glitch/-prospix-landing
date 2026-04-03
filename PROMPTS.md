# 💬 PROMPTS — Les prompts exacts à donner à Claude dans VS Code

## Comment utiliser ce fichier

1. Ouvre VS Code dans le dossier `leadgen-pro/`
2. Ouvre Claude dans VS Code (Ctrl+Shift+P → "Claude")
3. **Dans chaque prompt, dis d'abord à Claude** :
   > "Lis d'abord ARCHITECTURE.md et FEATURES.md avant de commencer."
4. Copie-colle le prompt du fichier que tu veux créer
5. Claude génère le fichier, vérifie, passe au suivant

---

## ORDRE DE CRÉATION RECOMMANDÉ

```
1. package.json (backend)
2. server.js
3. services/googlePlaces.js
4. services/googleReviews.js
5. services/scoring.js
6. services/socialEnrichment.js
7. routes/leads.js
8. routes/export.js
── TEST BACKEND ICI ──
9. frontend/package.json + vite.config.js
10. frontend/src/App.css
11. frontend/src/App.jsx
12. frontend/src/components/Map.jsx
13. frontend/src/components/SearchPanel.jsx
14. frontend/src/components/LeadCard.jsx
15. frontend/src/components/LeadDetail.jsx
16. frontend/src/components/SocialBadges.jsx
17. frontend/src/components/ReviewsPanel.jsx
18. frontend/src/hooks/useLeads.js
19. frontend/src/hooks/useMap.js
```

---

## ── BACKEND ──

### PROMPT 1 — backend/package.json

```
Crée le fichier backend/package.json pour un serveur Node.js Express.
Inclure les dépendances :
- express, cors, dotenv, axios
- @googlemaps/google-maps-services-js
- nodemon en devDependency
Scripts : "start": "node server.js", "dev": "nodemon server.js"
```

---

### PROMPT 2 — backend/server.js

```
Crée backend/server.js. C'est le point d'entrée Express.
- Charge dotenv
- Active cors pour http://localhost:5173
- Parse le JSON
- Importe et monte les routes : /api/leads depuis ./routes/leads.js
- Importe et monte les routes : /api/export depuis ./routes/export.js
- Route GET / qui répond { status: "LeadGen API running" }
- Écoute sur process.env.PORT ou 3001
- Log "🚀 Server running on port X" au démarrage
```

---

### PROMPT 3 — backend/services/googlePlaces.js

```
Crée backend/services/googlePlaces.js.
Ce service fait des appels à l'API Google Places.

Exporte une fonction async searchPlaces({ lat, lng, radius, keyword, type }) qui :
1. Appelle Google Places Nearby Search avec ces params
2. Pour chaque résultat (max 20), appelle Place Details pour récupérer :
   phone, website, opening_hours, price_level, rating, user_ratings_total
3. Retourne un tableau d'objets avec tous ces champs + lat/lng + place_id + name + vicinity
4. Gère les erreurs avec try/catch et log les erreurs
5. Utilise axios pour les appels HTTP
6. L'URL base Google Places : https://maps.googleapis.com/maps/api/place/
7. Utilise process.env.GOOGLE_MAPS_API_KEY pour la clé
```

---

### PROMPT 4 — backend/services/googleReviews.js

```
Crée backend/services/googleReviews.js.
Exporte une fonction async getReviews(placeId) qui :
1. Appelle Google Place Details avec fields=reviews,rating,user_ratings_total
2. Retourne les 5 premiers avis avec : author_name, rating, text, relative_time_description
3. Si pas d'avis, retourne un tableau vide
4. Gère les erreurs silencieusement (return [])
```

---

### PROMPT 5 — backend/services/scoring.js

```
Crée backend/services/scoring.js.
Exporte une fonction calculateScore(placeData, socialPresence) qui retourne un objet :

{
  total: 78,  // 0-100
  breakdown: {
    googleRating: 26,    // max 30
    reviewVolume: 21,    // max 25
    digitalPresence: 18, // max 25
    opportunity: 13      // max 20
  }
}

Algorithme exact :
- googleRating = (placeData.rating / 5) * 30, arrondi, min 0
- reviewVolume = Math.min(placeData.user_ratings_total / 500, 1) * 25, arrondi
- digitalPresence :
  +8 si placeData.website existe
  +5 si placeData.phone existe
  +4 si socialPresence.linkedin
  +4 si socialPresence.facebook
  +4 si socialPresence.instagram
  +3 si socialPresence.tiktok
  plafonné à 25
- opportunity :
  +10 si !socialPresence.hasChatbot
  +5 si placeData.rating < 3.8 ET user_ratings_total > 50
  +5 si placeData.openNow === true
  plafonné à 20

total = somme des 4, plafonné à 100, minimum 0
```

---

### PROMPT 6 — backend/services/socialEnrichment.js

```
Crée backend/services/socialEnrichment.js.
Exporte une fonction async enrichSocial(business) qui prend { name, website, address }.

Retourne :
{
  linkedin: "url ou null",
  facebook: "url ou null", 
  instagram: "url ou null",
  tiktok: "url ou null",
  hasChatbot: false
}

Logique :
1. Si website existe, fetch le HTML de la page et cherche des liens contenant :
   - "linkedin.com/company/" → linkedin
   - "facebook.com/" → facebook
   - "instagram.com/" → instagram
   - "tiktok.com/" → tiktok
   - "intercom", "tidio", "crisp", "zendesk", "livechat" → hasChatbot = true

2. Si pas de résultat depuis le site, construire des URLs probables :
   - Nettoyer le nom : enlever espaces, accents, caractères spéciaux
   - Chercher "https://facebook.com/[nomNettoyé]" 
   (ne pas faire de vraie requête, juste construire l'URL candidate)

3. Timeout de 3 secondes par requête
4. Si erreur sur une source, continuer les autres (try/catch individuel)
```

---

### PROMPT 7 — backend/routes/leads.js

```
Crée backend/routes/leads.js.
Route POST /search qui reçoit { city, lat, lng, radius, domain, keywords, sources }.

Workflow :
1. Valider que lat, lng, radius sont présents
2. Construire le keyword Google Places depuis domain + keywords
3. Appeler searchPlaces() depuis ../services/googlePlaces.js
4. Pour chaque place (en parallèle avec Promise.all) :
   a. Appeler getReviews(place.place_id)
   b. Appeler enrichSocial(place) si sources inclut des réseaux sociaux
   c. Appeler calculateScore(place, socialPresence)
5. Construire l'objet lead complet (voir modèle dans ARCHITECTURE.md)
6. Trier par score décroissant
7. Répondre avec { leads: [...], total: N, searchParams: {...} }
8. Gérer les erreurs avec status 500

Utiliser express.Router().
```

---

### PROMPT 8 — backend/routes/export.js

```
Crée backend/routes/export.js.
Route POST /csv qui reçoit un tableau { leads: [...] }.

Génère un fichier CSV avec ces colonnes :
Nom, Adresse, Téléphone, Site Web, Note Google, Nombre Avis,
Score Total, Score Rating, Score Avis, Score Digital, Score Opportunité,
LinkedIn, Facebook, Instagram, TikTok, 
Latitude, Longitude, Distance km, Domaine, Statut

Retourner le CSV avec headers :
- Content-Type: text/csv
- Content-Disposition: attachment; filename="leads-[date].csv"

Gérer les virgules dans les valeurs (entourer de guillemets).
```

---

## ── FRONTEND ──

### PROMPT 9 — frontend/package.json + vite.config.js

```
Crée frontend/package.json pour une app React + Vite.
Dépendances : react, react-dom, leaflet, react-leaflet, axios, lucide-react
DevDependencies : vite, @vitejs/plugin-react

Crée aussi frontend/vite.config.js avec :
- Plugin React
- Proxy : /api → http://localhost:3001 (pour éviter les CORS en dev)
```

---

### PROMPT 10 — frontend/src/App.css

```
Crée frontend/src/App.css avec le design system complet.

Variables CSS :
--bg: #0a0a0f
--surface: #12121a
--card: #1a1a26
--border: #2a2a3e
--accent: #00e5ff
--accent2: #7c3aed
--success: #10b981
--warning: #f59e0b
--danger: #f43f5e
--text: #e8e8f0
--muted: #6b7280

Import Google Fonts : Syne (400,600,700,800) + DM Mono (400,500)

Styles globaux :
- Reset CSS complet
- Body : background var(--bg), color var(--text), font Syne
- Grille de fond subtile (lignes CSS rgba cyan 0.03)
- Scrollbar custom dark
- Classes utilitaires : .mono (DM Mono), .muted (--muted), .accent (--accent)
- Animations : @keyframes fadeIn, slideUp, pulse, spin
```

---

### PROMPT 11 — frontend/src/App.jsx

```
Crée frontend/src/App.jsx. C'est le composant racine.

Layout CSS Grid : 
- Header en haut (65px)
- En dessous : sidebar gauche (380px fixe) + zone carte (flex)
- Hauteur totale : 100vh

State géré ici :
- leads : tableau (défaut [])
- selectedLead : objet ou null
- isLoading : boolean
- searchParams : { city, lat, lng, radius, domain, keywords, sources }

Importe et utilise :
- Header (passe : totalLeads=leads.length)
- SearchPanel (passe : onSearch, isLoading)
- LeadsList (passe : leads, selectedLead, onSelectLead)
- Map (passe : leads, selectedLead, searchParams, onSelectLead)
- LeadDetail (passe : lead=selectedLead, onClose, onStatusChange)

La fonction onSearch appelle POST /api/leads/search via axios.
Si erreur, afficher une alerte simple.
Importe App.css.
```

---

### PROMPT 12 — frontend/src/components/Map.jsx

```
Crée frontend/src/components/Map.jsx avec react-leaflet.

Props : { leads, selectedLead, searchParams, onSelectLead }

Composants Leaflet utilisés : MapContainer, TileLayer, Circle, CircleMarker, Popup, useMap

Comportements :
1. Centre de carte = searchParams.lat/lng (défaut Paris 48.8566, 2.3522)
2. Cercle cyan semi-transparent = searchParams.radius en km × 1000
3. Un CircleMarker par lead :
   - Couleur : vert si score>80, orange si 60-80, rouge si <60
   - Rayon : 8px (10px si selectedLead)
   - Au clic : appelle onSelectLead(lead)
   - Popup : <b>nom</b><br/>⭐ rating (nb avis)<br/>Score: XX/100
4. Quand selectedLead change, recentrer la carte sur ce lead (zoom 15)
5. Quand leads change (nouvelle recherche), fitBounds pour montrer tous les marqueurs
6. Tile layer : OpenStreetMap standard (pas besoin de clé)
7. Style inline : hauteur 100%, fond #0a0a0f
8. Filtre CSS sur les tuiles : brightness(0.7) contrast(1.1) saturate(0.4)

IMPORTANT : importer le CSS Leaflet dans ce fichier.
```

---

### PROMPT 13 — frontend/src/components/SearchPanel.jsx

```
Crée frontend/src/components/SearchPanel.jsx.
Props : { onSearch, isLoading }

Sections dans ce panneau :

1. CHAMP VILLE
   Input texte, placeholder "Paris, Lyon, Marseille..."
   Au submit, géocoder via : https://nominatim.openstreetmap.org/search?format=json&q=[ville]
   Extraire lat/lon du premier résultat

2. RAYON
   Slider de 1 à 50km
   Afficher la valeur en gros avec unité "km"
   Calculer et afficher la surface couverte (π×r²)

3. DOMAINES (chips cliquables)
   Un seul sélectionné à la fois
   Options : Tous, Restaurant, Commerce, Santé, Immobilier, Beauté, Tech, Juridique, Finance, Éducation, Sport
   Chip actif = border cyan + bg cyan 15%

4. MOTS-CLÉS (tags input)
   Appuyer Entrée ou virgule pour ajouter un tag
   Backspace supprime le dernier tag
   Max 6 tags
   Tags affichés avec × pour supprimer

5. SOURCES (checkboxes)
   Google Maps (coché, désactivé - toujours actif)
   LinkedIn, Facebook, Instagram, TikTok (cochables)
   Icône pour chaque réseau

6. BOUTON "Générer les leads"
   Loading state avec spinner
   Désactivé si ville vide ou chargement en cours
   Appelle onSearch avec tous les params

Style : fond var(--surface), bordure droite var(--border), overflow-y scroll
```

---

### PROMPT 14 — frontend/src/components/LeadCard.jsx

```
Crée frontend/src/components/LeadCard.jsx.
Props : { lead, isSelected, onClick }

Affiche dans la card :
- Nom du business (bold)
- Adresse courte (1 ligne, overflow ellipsis)  
- Score badge (composant ScoreBadge à créer dans le même fichier ou séparé)
- Étoiles Google : afficher ★ pleines selon lead.google.rating
- Nombre d'avis : "(187 avis)"
- Icônes réseaux sociaux détectés (petites icônes, grises si absent, colorées si présent)
  LinkedIn=bleu, Facebook=bleu foncé, Instagram=gradient rose, TikTok=noir/rose
- Distance : "2.4 km"
- Badge statut : "Nouveau" / "Contacté" / "Favori" / "Ignoré"

État selected : bordure cyan + fond cyan 5%
Animation entrée : fadeIn + translateX depuis gauche

Au clic sur la card → onClick(lead)
```

---

### PROMPT 15 — frontend/src/components/LeadDetail.jsx

```
Crée frontend/src/components/LeadDetail.jsx.
Props : { lead, onClose, onStatusChange }

Panel positionné en absolute sur la carte (bottom-right) ou en overlay selon taille écran.
Largeur 340px, fond var(--card), border var(--border), border-radius 14px.
Animation slideUp à l'apparition.

Sections :
1. HEADER : Nom + bouton ✕ fermer + score badge grand format

2. CONTACT :
   📞 Téléphone (cliquable tel:)
   🌐 Site web (lien externe)
   📍 Adresse complète

3. GOOGLE STATS :
   Étoiles + note + "(X avis)"
   Barre de jauge pour le score review volume
   Statut : "Ouvert maintenant" vert ou "Fermé" rouge

4. AVIS GOOGLE (ReviewsPanel) :
   3 derniers avis avec étoiles + texte tronqué + auteur + date relative

5. PRÉSENCE SOCIALE :
   Grille 2×2 des réseaux
   Chaque réseau : icône + nom + "Trouvé ✓" vert ou "Non détecté" gris
   Si URL trouvée : lien cliquable

6. SCORE DÉTAILLÉ :
   4 barres de progression avec label et valeur
   Note Google / Volume avis / Présence digitale / Opportunité

7. ACTIONS (bas du panneau) :
   [📧 Contacter] → onStatusChange('contacted')
   [⭐ Favori] → onStatusChange('favorite')
   [🗑️ Ignorer] → onStatusChange('ignored')

Si lead est null, ne rien afficher.
```

---

### PROMPT 16 — frontend/src/hooks/useLeads.js

```
Crée frontend/src/hooks/useLeads.js.
Hook React qui gère l'état des leads et les appels API.

Retourne : { leads, isLoading, error, searchLeads, updateLeadStatus, exportLeads }

- searchLeads(params) : POST /api/leads/search, met à jour leads
- updateLeadStatus(id, status) : met à jour le statut localement + sauvegarde en localStorage
- exportLeads() : POST /api/export/csv avec leads actuels, déclenche téléchargement
- Au montage : restaurer les statuts depuis localStorage
- Gestion d'erreur : stocker dans error state
```

---

## ── TESTS RAPIDES ──

### Tester le backend seul (sans frontend)

```bash
# Dans un terminal
cd backend && node server.js

# Dans un autre terminal
curl -X POST http://localhost:3001/api/leads/search \
  -H "Content-Type: application/json" \
  -d '{"lat":48.8566,"lng":2.3522,"radius":5,"domain":"restaurant","keywords":["paris"],"sources":["google"]}'
```

Si tu vois un JSON avec des leads → ✅ backend OK

### Tester le frontend seul (mode mock)

```
Dis à Claude : "Ajoute un mode mock dans useLeads.js qui retourne 10 leads 
fictifs sans appeler le backend, activé quand VITE_MOCK=true dans .env"
```
