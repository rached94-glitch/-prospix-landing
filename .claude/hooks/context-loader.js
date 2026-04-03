/**
 * context-loader — SessionStart hook
 * Charge automatiquement au démarrage :
 *   - Architecture du projet (CLAUDE.md)
 *   - Plan SaaS en cours (.claude/saas-context.md si existant)
 *   - Dernières modifications (docs/changelog.md, 10 dernières lignes)
 */

const fs = require('fs');
const path = require('path');

const chunks = [];
process.stdin.on('data', c => chunks.push(c));
process.stdin.on('end', () => {
  const cwd = process.env.PWD || process.cwd();
  const lines = [];

  lines.push('=== CONTEXTE PROJET LEADGEN PRO ===\n');

  // ── Architecture (CLAUDE.md) ─────────────────────────────────────────────
  const claudeMdPath = path.join(cwd, 'CLAUDE.md');
  if (fs.existsSync(claudeMdPath)) {
    const content = fs.readFileSync(claudeMdPath, 'utf8');
    // On extrait uniquement les sections de commandes et architecture (pas les modifs)
    const sections = content.split('\n## ');
    const relevant = sections.filter(s =>
      s.startsWith('Commands') ||
      s.startsWith('Architecture') ||
      s.startsWith('CLAUDE.md') ||
      s.startsWith('# CLAUDE')
    );
    lines.push('--- Architecture & Commandes ---');
    lines.push(relevant.join('\n## ').trim());
    lines.push('');
  }

  // ── Plan SaaS en cours ───────────────────────────────────────────────────
  const saasContextPath = path.join(cwd, '.claude', 'saas-context.md');
  if (fs.existsSync(saasContextPath)) {
    const content = fs.readFileSync(saasContextPath, 'utf8');
    lines.push('--- Plan SaaS en cours ---');
    lines.push(content.trim());
    lines.push('');
  } else {
    lines.push('--- Plan SaaS ---');
    lines.push('(Aucun contexte SaaS sauvegardé. Il sera créé automatiquement via /compact)');
    lines.push('');
  }

  // ── Dernières modifications ──────────────────────────────────────────────
  const changelogPath = path.join(cwd, 'docs', 'changelog.md');
  if (fs.existsSync(changelogPath)) {
    const content = fs.readFileSync(changelogPath, 'utf8');
    const tableLines = content.split('\n').filter(l => l.startsWith('| 20'));
    const recent = tableLines.slice(0, 10);
    if (recent.length > 0) {
      lines.push('--- 10 dernières modifications ---');
      lines.push('| Date | Action | Fichier |');
      lines.push('|------|--------|---------| ');
      lines.push(recent.join('\n'));
      lines.push('');
    }
  } else {
    lines.push('--- Dernières modifications ---');
    lines.push('(Aucune modification enregistrée pour cette session)');
    lines.push('');
  }

  lines.push('=== FIN DU CONTEXTE ===');

  // Sortie vers Claude comme contexte additionnel
  const output = {
    hookSpecificOutput: {
      hookEventName: 'SessionStart',
      additionalContext: lines.join('\n'),
    },
  };

  console.log(JSON.stringify(output));
  process.exit(0);
});
