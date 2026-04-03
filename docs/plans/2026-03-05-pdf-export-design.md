# Design — Export Fiche PDF

**Date :** 2026-03-05
**Statut :** Approuvé

## Objectif

Ajouter un bouton "📄 Exporter PDF" dans `LeadDetail.jsx` qui génère une fiche commerciale complète pour un lead, incluant un pitch client personnalisé selon l'analyse chatbot.

## Approche retenue

**`@react-pdf/renderer`** — rendu PDF côté frontend en JSX déclaratif. Pas de backend requis. Résultat propre (texte sélectionnable, vectoriel).

## Architecture

- Nouveau composant : `frontend/src/components/LeadPDF.jsx`
- Dépendance : `@react-pdf/renderer` (npm install côté frontend)
- Intégration : bouton dans la barre d'actions de `LeadDetail.jsx`
- Nom du fichier généré : `fiche-[nom-du-commerce].pdf`

## Structure de la fiche (1-2 pages A4)

1. **En-tête** — Nom, adresse, domaine, score /100
2. **Contact** — Téléphone, site web, décideur (nom + email si trouvé)
3. **Présence Google** — Note, volume avis, % positifs/négatifs
4. **Détection Chatbot** — Statut (aucun / déjà équipé), liste des outils détectés
5. **Pitch Commercial** — Texte adapté selon `chatbotDetection.hasChatbot` + niveau d'urgence + raisons clés
6. **3 Avis représentatifs** — 1 meilleur + 1 pire + 1 récent
7. **Pied de page** — Date de génération, "Généré par LeadGen Pro"

## Données

Uniquement l'objet `lead` existant — aucun appel API supplémentaire.
Sections absentes si données non chargées : affichage "Non analysé".

## Bouton

Ajouté dans la barre d'actions `LeadDetail.jsx` aux côtés de "Contacter" / "Favori" / "Ignorer".
Label : `📄 Exporter PDF`
Couleur : bleu-violet neutre (distinct des actions existantes).
