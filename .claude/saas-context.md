# Contexte SaaS LeadGen Pro
_Dernière sauvegarde : 2026-04-04 13:26:44 (trigger: auto)_

## Features implémentées
- [x] Export Google Sheets
- [x] Analyse IA des avis (Claude API)
- [x] Scraping LinkedIn (Apify)
- [x] Algorithme de score (0-100)

## Personnalisation des opportunités (scoring.js)
Algorithme 4 composantes :
- Note Google → 30 pts  (rating / 5 × 30)
- Volume d'avis → 25 pts  (min(reviews/500, 1) × 25)
- Présence digitale → 25 pts  (site +8, tel +5, LI +4, FB +4, IG +4, TT +3)
- Opportunité chatbot → 20 pts  (pas de chatbot +10, avis négatifs +5, ouvert +5)

## Système d'authentification
_(À documenter quand implémenté — ex: JWT, session, OAuth)_

## Plans tarifaires
_(À documenter quand définis — ex: Starter / Pro / Agency)_

## Historique des sauvegardes
- 2026-04-04 13:26:44 — compaction auto
- 2026-04-04 12:37:09 — compaction auto
- 2026-04-04 08:48:31 — compaction auto
- 2026-04-04 00:41:48 — compaction auto
- 2026-04-03 23:26:53 — compaction auto
- 2026-04-03 21:27:44 — compaction auto
- 2026-04-03 19:06:36 — compaction auto
- 2026-04-02 07:28:09 — compaction auto
- 2026-04-01 18:41:56 — compaction auto
- 2026-04-01 15:44:42 — compaction auto
