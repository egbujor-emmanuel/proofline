const { execFileSync } = require('child_process');

/**
 * Reads Kane's own coverage computation for a specific, known evidence pack.
 * Deliberately pack-scoped rather than querying historical aggregate
 * coverage: Proofline's targeted testrun always knows exactly which pack it
 * just produced, so it never has to guess which execution a stat came from.
 */
function coverForPack(repoRoot, evidencePackPath) {
  const raw = execFileSync(
    'kane-cli',
    ['cover', '--json', '--from', evidencePackPath],
    { cwd: repoRoot, encoding: 'utf-8', shell: true }
  );
  return JSON.parse(raw);
}

module.exports = { coverForPack };
