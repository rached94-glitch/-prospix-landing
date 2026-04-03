/**
 * auto-save — PostToolUse hook
 * Après chaque Write/Edit :
 *   1. Log la modification dans docs/changelog.md
 *   2. Met à jour la section "Dernières modifications" de CLAUDE.md
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

  const { tool_name, tool_input = {}, tool_response = {} } = input;
  const cwd = process.env.PWD || process.cwd();

  // Récupère le fichier modifié
  const filePath = (tool_input.file_path || '').replace(/\\/g, '/');
  if (!filePath) process.exit(0);

  // Ignore les fichiers système / docs auto-générés pour éviter les boucles
  const ignored = ['docs/changelog.md', 'CLAUDE.md', '.claude/'];
  if (ignored.some(p => filePath.includes(p))) process.exit(0);

  const now = new Date();
  const timestamp = now.toISOString().replace('T', ' ').slice(0, 19);
  const relPath = filePath.replace(cwd.replace(/\\/g, '/') + '/', '');
  const action = tool_name === 'Write' ? 'créé/réécrit' : 'modifié';

  // ── 1. docs/changelog.md ────────────────────────────────────────────────
  const docsDir = path.join(cwd, 'docs');
  const changelogPath = path.join(docsDir, 'changelog.md');

  if (!fs.existsSync(docsDir)) fs.mkdirSync(docsDir, { recursive: true });

  const entry = `| ${timestamp} | ${action} | \`${relPath}\` |\n`;

  if (!fs.existsSync(changelogPath)) {
    fs.writeFileSync(
      changelogPath,
      '# Changelog des modifications\n\n' +
      '| Date | Action | Fichier |\n' +
      '|------|--------|---------|\n' +
      entry,
    );
  } else {
    // Insère après l'en-tête du tableau
    let content = fs.readFileSync(changelogPath, 'utf8');
    const headerEnd = content.indexOf('|------|--------|---------|\n');
    if (headerEnd !== -1) {
      const insertAt = headerEnd + '|------|--------|---------|\n'.length;
      content = content.slice(0, insertAt) + entry + content.slice(insertAt);
    } else {
      content += entry;
    }
    fs.writeFileSync(changelogPath, content);
  }

  // ── 2. CLAUDE.md — section "Dernières modifications" ────────────────────
  const claudeMdPath = path.join(cwd, 'CLAUDE.md');
  if (fs.existsSync(claudeMdPath)) {
    let claudeContent = fs.readFileSync(claudeMdPath, 'utf8');
    const sectionHeader = '## Dernières modifications\n';
    const newLine = `- \`${timestamp}\` — ${action} \`${relPath}\`\n`;

    if (claudeContent.includes(sectionHeader)) {
      // Remplace les entrées existantes (garde les 5 dernières)
      const start = claudeContent.indexOf(sectionHeader) + sectionHeader.length;
      const lines = claudeContent.slice(start).split('\n');
      const modLines = lines.filter(l => l.startsWith('- `'));
      const kept = [newLine.trimEnd(), ...modLines.slice(0, 4)];
      const rest = lines.find((_, i) => !lines.slice(0, i + 1).every(l => l.startsWith('- `') || l === ''));
      const afterSection = claudeContent.slice(start).replace(/^(- `[^\n]*\n)*/m, '');
      claudeContent =
        claudeContent.slice(0, start) +
        kept.join('\n') + '\n' +
        (afterSection.startsWith('\n') ? afterSection : '\n' + afterSection);
    } else {
      claudeContent += '\n' + sectionHeader + newLine;
    }
    fs.writeFileSync(claudeMdPath, claudeContent);
  }

  process.exit(0);
});
