# 🚀 QUICKSTART — Lancer le projet de A à Z

## Prérequis

Vérifie que tu as installé :
- [ ] Node.js v18+ → `node --version`
- [ ] npm → `npm --version`
- [ ] VS Code avec l'extension Claude

---

## Étape 1 — Ouvrir dans VS Code

```bash
# Dans ton terminal
cd leadgen-pro
code .
```

---

## Étape 2 — Configurer les APIs

```bash
cp .env.example .env
```

Ouvre `.env` et colle ta clé Google Maps à la place de `COLLE_TA_CLE_GOOGLE_ICI`.

> Si tu n'as pas encore de clé : lis `API_GUIDE.md` section "Étape 1"

---

## Étape 3 — Créer les fichiers avec Claude

Ouvre Claude dans VS Code et suis les prompts dans `PROMPTS.md` dans l'ordre.

**Conseil** : Commence chaque session Claude par :
> "Je construis une app de génération de leads. Lis README.md, ARCHITECTURE.md et FEATURES.md pour comprendre le projet, puis je vais te donner les prompts un par un."

---

## Étape 4 — Installer les dépendances

```bash
# Backend
cd backend
npm install

# Frontend
cd ../frontend
npm install
```

---

## Étape 5 — Lancer l'application

**Terminal 1 (backend) :**
```bash
cd backend
npm run dev
```
Tu dois voir : `🚀 Server running on port 3001`

**Terminal 2 (frontend) :**
```bash
cd frontend
npm run dev
```
Tu dois voir : `Local: http://localhost:5173`

---

## Étape 6 — Tester

1. Ouvre `http://localhost:5173`
2. Dans le champ Ville : tape "Paris"
3. Choisis un domaine : "Restaurant"
4. Rayon : 5 km
5. Clique "Générer les leads"
6. Les leads apparaissent sur la carte et dans la liste

---

## Si quelque chose ne marche pas

### Erreur CORS
→ Vérifie que `vite.config.js` a bien le proxy vers localhost:3001

### Erreur Google API
→ Vérifie ta clé dans `.env`
→ Vérifie que Places API est activée dans Google Cloud Console

### Carte qui ne s'affiche pas
→ Vérifie que le CSS Leaflet est bien importé dans `Map.jsx`

### Leads vides
→ Teste d'abord le backend directement avec le curl dans PROMPTS.md

---

## Demander de l'aide à Claude

Si un fichier ne marche pas, dis à Claude :
> "Le fichier [nom] a cette erreur : [colle l'erreur]. Voici le code actuel : [colle le code]. Fixe le problème."
