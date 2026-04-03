# 🤖 LeadGen Pro — Application de Génération de Leads

## Ce que fait cette application

Une app web complète pour trouver des prospects locaux via Google Maps, et enrichir leur profil avec leur présence sur LinkedIn, Facebook, Instagram et TikTok. Chaque lead reçoit un **score d'opportunité** basé sur ses avis Google et son flux de clientèle.

---

## Stack technique

| Couche | Technologie |
|--------|-------------|
| Frontend | React + Vite |
| Carte | Leaflet.js |
| Backend | Node.js + Express |
| APIs | Google Places API, Google Maps JS API |
| Scraping social | Apify (LinkedIn, Instagram, TikTok) |
| Base de données | Fichier JSON local (pas de DB) |
| Style | CSS variables + Syne font |

---

## Lire dans cet ordre

1. `ARCHITECTURE.md` — structure des fichiers
2. `FEATURES.md` — ce que fait chaque écran
3. `API_GUIDE.md` — comment obtenir et configurer les clés API
4. `PROMPTS.md` — les prompts exacts à donner à Claude pour construire chaque fichier
5. `.env.example` — variables d'environnement à configurer

---

## Démarrage rapide

```bash
# 1. Installer les dépendances backend
cd backend && npm install

# 2. Installer les dépendances frontend
cd frontend && npm install

# 3. Copier et remplir les variables d'environnement
cp .env.example .env

# 4. Lancer le backend
cd backend && node server.js

# 5. Lancer le frontend (nouveau terminal)
cd frontend && npm run dev
```

L'app sera accessible sur `http://localhost:5173`

---

## Design System

- **Background** : `#0a0a0f`
- **Surface** : `#12121a`
- **Accent** : `#00e5ff` (cyan)
- **Succès** : `#10b981` (vert)
- **Alerte** : `#f59e0b` (orange)
- **Danger** : `#f43f5e` (rouge)
- **Fonts** : Syne (titres) + DM Mono (données)
