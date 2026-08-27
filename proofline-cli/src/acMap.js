const fs = require('fs');
const path = require('path');
const { listAcs } = require('./contextGraph');

/**
 * Deterministic candidate narrowing: changed file -> real structural
 * signals extracted from the file itself, with NO per-project answer key.
 * This replaced an earlier hand-authored config/ac-map.json that hardcoded
 * "this file affects these ACs" per file -- that was flagged as undermining
 * the product's own promise (give Proofline a real repo and it determines
 * what's at risk, not "tell Proofline first"). The mechanism below is the
 * same regardless of which project it's pointed at; only the live AC corpus
 * it reasons over (from that project's own Kane context graph) differs.
 *
 * Signals extracted per file:
 *  - filename tokens (e.g. "upgrade.js" -> "upgrade")
 *  - HTTP route registrations (router.get('/path', ...)) -> method + path
 *    segments
 *  - require/import targets -> their basename tokens
 *  - declared/exported function and const names, split on camelCase
 *
 * These are matched against a simple lowercase-word tokenization of each
 * live AC's actual text. Any non-empty overlap makes that AC a candidate,
 * with the exact overlapping terms recorded so the mapping stays
 * inspectable rather than a black box.
 */
function extractSignals(fileContent, filePath) {
  const signals = new Set();

  for (const tok of path.basename(filePath).replace(/\.[jt]sx?$/, '').split(/[-_/]+/)) {
    if (tok.length > 2) signals.add(tok.toLowerCase());
  }

  if (!fileContent) return [...signals];

  const routeRe = /\.(get|post|put|patch|delete)\(\s*['"`]([^'"`]*)['"`]/g;
  let m;
  while ((m = routeRe.exec(fileContent))) {
    signals.add(m[1].toLowerCase());
    for (const seg of m[2].split('/')) {
      if (seg && !seg.startsWith(':')) signals.add(seg.toLowerCase());
    }
  }

  const reqRe = /require\(\s*['"`]([^'"`]+)['"`]\s*\)|from\s+['"`]([^'"`]+)['"`]/g;
  while ((m = reqRe.exec(fileContent))) {
    const target = m[1] || m[2];
    for (const tok of path.basename(target).split(/[-_./]+/)) {
      if (tok.length > 2) signals.add(tok.toLowerCase());
    }
  }

  const fnRe = /function\s+(\w+)|const\s+(\w+)\s*=\s*(?:async\s*)?\(|exports\.(\w+)\s*=/g;
  while ((m = fnRe.exec(fileContent))) {
    const name = m[1] || m[2] || m[3];
    if (!name) continue;
    for (const tok of name.split(/(?=[A-Z])|_/)) {
      if (tok.length > 2) signals.add(tok.toLowerCase());
    }
  }

  return [...signals];
}

function tokenizeAcText(text) {
  return new Set((text.toLowerCase().match(/[a-z]{3,}/g) || []));
}

function mapChangedFilesToCandidates(changedFiles, repoRoot) {
  const acs = listAcs(repoRoot);
  const candidates = new Map();
  const uncoveredFiles = [];

  for (const file of changedFiles) {
    let content = null;
    try {
      content = fs.readFileSync(path.join(repoRoot, file), 'utf-8');
    } catch {
      // deleted, binary, or otherwise unreadable -- signals fall back to
      // filename tokens only, computed inside extractSignals(null, file).
    }

    const signals = extractSignals(content, file);
    let matchedAny = false;

    for (const ac of acs) {
      const acTokens = tokenizeAcText(ac.text || '');
      const overlap = signals.filter((s) => acTokens.has(s));
      if (overlap.length === 0) continue;

      matchedAny = true;
      if (!candidates.has(ac.id)) {
        candidates.set(ac.id, { ac: ac.id, confidence: 'rule-based', files: [] });
      }
      candidates.get(ac.id).files.push({
        path: file,
        reason: `structural term overlap: [${overlap.join(', ')}]`,
      });
    }

    if (!matchedAny) {
      uncoveredFiles.push({
        path: file,
        reason: acs.length === 0
          ? 'no ACs exist yet in this project\'s Kane context graph'
          : 'no structural term overlap between this file\'s extracted signals and any live AC text',
      });
    }
  }

  return { candidates: [...candidates.values()], uncoveredFiles, allAcs: acs };
}

module.exports = { mapChangedFilesToCandidates, extractSignals, tokenizeAcText };
