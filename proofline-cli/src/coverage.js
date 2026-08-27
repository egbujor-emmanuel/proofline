const { kaneExec } = require('./kaneExec');

/**
 * Reads Kane's own coverage computation for a specific, known evidence pack.
 * Deliberately pack-scoped rather than querying historical aggregate
 * coverage: Proofline's targeted testrun always knows exactly which pack it
 * just produced, so it never has to guess which execution a stat came from.
 */
function coverForPack(repoRoot, evidencePackPath) {
  const raw = kaneExec(['cover', '--json', '--from', evidencePackPath], { cwd: repoRoot });
  return JSON.parse(raw);
}

module.exports = { coverForPack };
