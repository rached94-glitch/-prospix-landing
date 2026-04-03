/**
 * env-guard — PreToolUse hook
 * Bloque toute modification ou lecture du fichier .env
 */

const chunks = [];
process.stdin.on('data', c => chunks.push(c));
process.stdin.on('end', () => {
  let input;
  try {
    input = JSON.parse(Buffer.concat(chunks).toString());
  } catch {
    process.exit(0);
  }

  const { tool_name, tool_input = {} } = input;
  const filePath = (tool_input.file_path || '').replace(/\\/g, '/');

  // Cible uniquement les fichiers .env (pas .env.example)
  const isEnvFile = /\.env(\.|$)/.test(filePath.split('/').pop());
  const isExample = filePath.endsWith('.env.example');

  if (isEnvFile && !isExample) {
    if (tool_name === 'Write' || tool_name === 'Edit') {
      console.log(JSON.stringify({
        hookSpecificOutput: {
          hookEventName: 'PreToolUse',
          permissionDecision: 'deny',
          permissionDecisionReason:
            '🔒 env-guard: Modification du fichier .env bloquée.\n' +
            'Les clés API doivent être éditées manuellement pour éviter toute fuite accidentelle.\n' +
            'Fichier visé : ' + filePath,
        },
      }));
      process.exit(0);
    }

    if (tool_name === 'Read') {
      console.log(JSON.stringify({
        hookSpecificOutput: {
          hookEventName: 'PreToolUse',
          permissionDecision: 'deny',
          permissionDecisionReason:
            '🔒 env-guard: Lecture du fichier .env bloquée.\n' +
            'Les clés API (GOOGLE_MAPS_API_KEY, APIFY_API_TOKEN, FACEBOOK_ACCESS_TOKEN) ' +
            'ne doivent pas être exposées dans le contexte. Utilise .env.example si tu as besoin du template.',
        },
      }));
      process.exit(0);
    }
  }

  // Tout le reste : autorisé
  process.exit(0);
});
