/**
 * memory-save — PreCompact hook
 * Avant le nettoyage mémoire, sauvegarde le contexte SaaS dans
 * .claude/saas-context.md pour qu'il soit rechargé à la prochaine session.
 *
 * Contexte sauvegardé :
 *   - Personnalisation des opportunités (scoring)
 *   - Système d'authentification
 *   - Plans tarifaires
 *   - Notes de session
 */

const fs = require('fs');
const path = require('path');

const chunks = [];
process.stdin.on('data', c => chunks.push(c));
process.stdin.on('end', () => {
  let input;
  try {
    input = JSON.parse(Buffer.concat(chunks).toString());
  } catch {
    process.exit(0);
  }

  const cwd = process.env.PWD || process.cwd();
  const { custom_instructions = '', trigger = 'auto' } = input;
  const saasContextPath = path.join(cwd, '.claude', 'saas-context.md');
  const now = new Date().toISOString().replace('T', ' ').slice(0, 19);

  // Récupère le contexte existant si présent
  let existing = '';
  if (fs.existsSync(saasContextPath)) {
    existing = fs.readFileSync(saasContextPath, 'utf8');
  }

  // Extrait les instructions personnalisées passées à /compact
  // Elles contiennent les notes de session à retenir
  const sessionNotes = custom_instructions
    ? `\n### Notes de session (${now})\n${custom_instructions}\n`
    : '';

  // Lit les services existants pour détecter les features SaaS implémentées
  const detectedFeatures = [];
  const checkPaths = [
    ['backend/routes/sheets.js',       'Export Google Sheets'],
    ['backend/services/aiReviewAnalysis.js', 'Analyse IA des avis (Claude API)'],
    ['backend/services/linkedinScraper.js',  'Scraping LinkedIn (Apify)'],
    ['backend/services/scoring.js',    'Algorithme de score (0-100)'],
    ['frontend/src/hooks/useExport.js','Export CSV / PDF'],
  ];
  for (const [filePath, feature] of checkPaths) {
    if (fs.existsSync(path.join(cwd, filePath))) {
      detectedFeatures.push(`- [x] ${feature}`);
    }
  }

  const content =
    `# Contexte SaaS LeadGen Pro\n` +
    `_Dernière sauvegarde : ${now} (trigger: ${trigger})_\n\n` +

    `## Features implémentées\n` +
    (detectedFeatures.length > 0 ? detectedFeatures.join('\n') : '_(aucune détectée)_') +
    '\n\n' +

    `## Personnalisation des opportunités (scoring.js)\n` +
    `Algorithme 4 composantes :\n` +
    `- Note Google → 30 pts  (rating / 5 × 30)\n` +
    `- Volume d'avis → 25 pts  (min(reviews/500, 1) × 25)\n` +
    `- Présence digitale → 25 pts  (site +8, tel +5, LI +4, FB +4, IG +4, TT +3)\n` +
    `- Opportunité chatbot → 20 pts  (pas de chatbot +10, avis négatifs +5, ouvert +5)\n\n` +

    `## Système d'authentification\n` +
    `_(À documenter quand implémenté — ex: JWT, session, OAuth)_\n\n` +

    `## Plans tarifaires\n` +
    `_(À documenter quand définis — ex: Starter / Pro / Agency)_\n\n` +

    (sessionNotes ? `## Notes de session\n${sessionNotes}\n` : '') +

    `## Historique des sauvegardes\n` +
    `- ${now} — compaction ${trigger}\n` +
    // Conserve les 9 dernières entrées d'historique
    (existing.match(/^- .+ — compaction .+$/gm) || []).slice(0, 9).join('\n') +
    '\n';

  fs.writeFileSync(saasContextPath, content);

  // Informe Claude que le contexte a été sauvegardé
  console.log(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PreCompact',
      additionalContext:
        `💾 memory-save : Contexte SaaS sauvegardé dans .claude/saas-context.md\n` +
        `Features détectées : ${detectedFeatures.length}\n` +
        `Il sera rechargé automatiquement à la prochaine session.`,
    },
  }));

  process.exit(0);
});
