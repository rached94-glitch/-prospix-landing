# ⚡ FEATURES — Ce que fait chaque écran

## Écran principal (App.jsx)

Layout en 3 colonnes :
- **Colonne gauche (350px)** : SearchPanel + LeadsList
- **Colonne centre (flex)** : Carte Leaflet
- **Overlay droit** : LeadDetail (apparaît quand on clique un lead)

---

## 1. SearchPanel — Panneau de recherche

### Champs disponibles :

| Champ | Type | Description |
|-------|------|-------------|
| Ville | Input texte | Géocodé automatiquement en lat/lng |
| Rayon | Slider 1–50km | Dessine un cercle sur la carte |
| Domaine | Chips sélectionnables | Filtre le type de business |
| Mots-clés | Tags input | Affine la recherche Google Places |
| Sources | Checkboxes | Quelles plateformes enrichir |

### Domaines disponibles :
- 🍽️ Restaurant
- 🛍️ Commerce / Retail  
- 🏥 Santé
- 🏠 Immobilier
- 💄 Beauté / Bien-être
- 💻 Tech / Digital
- ⚖️ Juridique
- 💰 Finance / Comptabilité
- 📚 Éducation / Formation
- 🏋️ Sport / Fitness

### Sources activables :
- ✅ Google Maps (toujours actif)
- LinkedIn
- Facebook
- Instagram
- TikTok

---

## 2. Carte (Map.jsx)

- **Fond de carte** : OpenStreetMap avec filtre dark
- **Cercle de rayon** : Cyan semi-transparent, redimensionnable
- **Marqueurs** : Couleur selon score
  - 🟢 Vert `#10b981` : score > 80
  - 🟡 Orange `#f59e0b` : score 60–80
  - 🔴 Rouge `#f43f5e` : score < 60
- **Popup au survol** : Nom + score + rating
- **Clic marqueur** : Ouvre LeadDetail
- **Zoom auto** : S'adapte pour montrer tous les leads

---

## 3. LeadsList — Liste des leads

- Triée par score décroissant par défaut
- Possibilité de trier par : Score / Distance / Avis Google / Nom
- Chaque LeadCard montre :
  - Nom du business
  - Adresse courte
  - Score badge coloré
  - Étoiles Google + nombre d'avis
  - Icônes des réseaux sociaux détectés
  - Distance du centre de recherche
- Clic → ouvre LeadDetail + zoom carte sur le marqueur

---

## 4. LeadDetail — Fiche complète

Panneau qui s'ouvre à droite (ou en overlay sur mobile) :

### Sections :
1. **En-tête** : Nom, adresse, score global
2. **Contact** : Téléphone, site web, email si trouvé
3. **Google** : Note, nb avis, horaires, statut ouvert/fermé
4. **Avis Google** : 3 derniers avis avec étoiles et texte
5. **Présence sociale** : Liens directs vers chaque profil trouvé
6. **Score détaillé** : Breakdown des 4 composantes
7. **Actions** :
   - 📧 Marquer comme contacté
   - ⭐ Mettre en favori
   - 🗑️ Ignorer ce lead
   - 📋 Copier les infos

---

## 5. Algorithme de Score (scoring.js)

Score total sur 100 points :

### Composante 1 — Note Google (30 pts)
```
score += (rating / 5) × 30
```
Exemple : 4.3 étoiles → 25.8 pts

### Composante 2 — Volume d'avis = Flux clientèle (25 pts)
```
score += min(totalReviews / 500, 1) × 25
```
Exemple : 187 avis → 9.35 pts
Exemple : 600 avis → 25 pts (plafonné)

### Composante 3 — Présence digitale (25 pts)
```
+8 pts  → a un site web
+5 pts  → a un numéro de téléphone
+4 pts  → présent sur LinkedIn
+4 pts  → présent sur Facebook
+4 pts  → présent sur Instagram  
+3 pts  → présent sur TikTok
```
(plafonné à 25)

### Composante 4 — Opportunité chatbot (20 pts)
```
+10 pts → pas de chatbot détecté sur le site
+5 pts  → beaucoup d'avis négatifs (rating < 3.8 + > 50 avis) = besoin SAV
+5 pts  → ouvert en ce moment = business actif
```

---

## 6. Export CSV

Colonnes exportées :
```
Nom, Adresse, Téléphone, Site Web, Email,
Note Google, Nombre d'avis, Score Total,
LinkedIn, Facebook, Instagram, TikTok,
Latitude, Longitude, Distance (km), Domaine, Statut
```

---

## 7. Statuts des leads

| Statut | Couleur | Signification |
|--------|---------|---------------|
| `new` | Cyan | Pas encore traité |
| `contacted` | Vert | Déjà contacté |
| `favorite` | Or | À prioriser |
| `ignored` | Gris | À ignorer |

Les statuts sont sauvegardés en `localStorage` pour persister entre sessions.
