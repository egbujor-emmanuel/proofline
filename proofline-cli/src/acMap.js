const fs = require('fs');
const path = require('path');

function loadRules() {
  const raw = fs.readFileSync(path.join(__dirname, '..', 'config', 'ac-map.json'), 'utf-8');
  return JSON.parse(raw).rules;
}

/**
 * Deterministic candidate narrowing: changed file paths -> candidate ACs.
 * No LLM involved. Every candidate carries the exact rule that produced it,
 * so the mapping is inspectable rather than a black box.
 */
function mapChangedFilesToCandidates(changedFiles) {
  const rules = loadRules();
  const byPath = new Map(rules.map((r) => [r.path, r]));

  const candidates = new Map(); // ac -> { ac, confidence, files: [{path, reason}] }
  const uncoveredFiles = [];

  for (const file of changedFiles) {
    const rule = byPath.get(file);
    if (!rule) {
      uncoveredFiles.push({ path: file, reason: 'no entry in ac-map.json for this file' });
      continue;
    }
    if (rule.acs.length === 0) {
      uncoveredFiles.push({ path: file, reason: rule.reason });
      continue;
    }
    for (const ac of rule.acs) {
      if (!candidates.has(ac)) {
        candidates.set(ac, { ac, confidence: 'rule-based', files: [] });
      }
      candidates.get(ac).files.push({ path: file, reason: rule.reason });
    }
  }

  return {
    candidates: [...candidates.values()],
    uncoveredFiles,
  };
}

module.exports = { mapChangedFilesToCandidates };
