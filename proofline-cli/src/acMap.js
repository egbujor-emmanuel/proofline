const fs = require('fs');
const path = require('path');
const { listAcs } = require('./contextGraph');

/**
 * Deterministic candidate narrowing: changed file -> real structural
 * signals extracted from the file itself, with NO per-project answer key.
 * This replaced an earlier hand-authored config/ac-map.json that hardcoded
 * "this file affects these ACs" per file -- that undermined the product's
 * own promise (give Proofline a real repo and it determines what's at risk,
 * not "tell Proofline first"). The mechanism below is the same regardless
 * of which project it's pointed at; only the live AC corpus it reasons over
 * (from that project's own Kane context graph) differs.
 *
 * Signals extracted per file:
 *  - filename tokens (e.g. "upgrade.js" -> "upgrade")
 *  - HTTP route registrations (router.get('/path', ...)) -> method + path
 *    segments
 *  - require/import targets -> their basename tokens
 *  - declared/exported function and const names, split on camelCase
 *
 * Matching is IDF-WEIGHTED, not binary. A plain "any overlap counts" rule
 * was tried first and confirmed by direct testing to be near-useless for
 * precision: on this project's own corpus it flagged all 6 ACs for one
 * changed file, because a term like "upgrade" appears in almost every AC of
 * an upgrade-focused use-case and therefore discriminates nothing. Terms are
 * now weighted by how rare they are across the live AC corpus, so a match on
 * a term appearing in 1 of 6 ACs counts far more than one appearing in 6 of
 * 6. Zero-information terms (present in every AC) contribute exactly 0.
 */

// Structural noise that appears in source files but says nothing about
// which requirement a change affects.
const STOPWORDS = new Set([
  'the', 'and', 'for', 'that', 'this', 'with', 'from', 'not', 'must', 'are',
  'was', 'has', 'have', 'its', 'been', 'were', 'their', 'them', 'they',
  'require', 'module', 'exports', 'const', 'let', 'var', 'function', 'return',
  'async', 'await', 'index', 'src', 'app', 'lib', 'utils', 'util', 'js',
]);

function addToken(set, raw) {
  const tok = String(raw).toLowerCase();
  if (tok.length > 2 && !STOPWORDS.has(tok)) set.add(tok);
}

function extractSignals(fileContent, filePath) {
  const signals = new Set();

  for (const tok of path.basename(filePath).replace(/\.[jt]sx?$/, '').split(/[-_/]+/)) {
    addToken(signals, tok);
  }

  if (!fileContent) return [...signals];

  const routeRe = /\.(get|post|put|patch|delete)\(\s*['"`]([^'"`]*)['"`]/g;
  let m;
  while ((m = routeRe.exec(fileContent))) {
    addToken(signals, m[1]);
    for (const seg of m[2].split('/')) {
      if (seg && !seg.startsWith(':')) addToken(signals, seg);
    }
  }

  const reqRe = /require\(\s*['"`]([^'"`]+)['"`]\s*\)|from\s+['"`]([^'"`]+)['"`]/g;
  while ((m = reqRe.exec(fileContent))) {
    const target = m[1] || m[2];
    // Split on separators AND camelCase: a require of
    // '../services/subscriptionService' should yield "subscription" and
    // "service", not the single opaque token "subscriptionservice".
    for (const part of path.basename(target).split(/[-_./]+/)) {
      for (const tok of part.split(/(?=[A-Z])/)) addToken(signals, tok);
    }
  }

  const fnRe = /function\s+(\w+)|const\s+(\w+)\s*=\s*(?:async\s*)?\(|exports\.(\w+)\s*=/g;
  while ((m = fnRe.exec(fileContent))) {
    const name = m[1] || m[2] || m[3];
    if (!name) continue;
    for (const tok of name.split(/(?=[A-Z])|_/)) addToken(signals, tok);
  }

  // String literals carry real domain vocabulary ('pro', 'free', 'passed')
  // that identifiers alone miss -- but ONLY short, single-word, enum-like
  // literals. An earlier version accepted literals with spaces and pulled
  // prose out of human-readable UI/log strings instead: confirmed by a real
  // test, that made Proofline's own verdict.js match an app requirement on
  // the word "change", scraped from its 'CHANGE DETECTED' banner. Domain
  // enums are single words; sentences are noise.
  const strRe = /['"`]([a-zA-Z][a-zA-Z0-9_-]{2,20})['"`]/g;
  while ((m = strRe.exec(fileContent))) {
    for (const tok of m[1].split(/[_-]+/)) addToken(signals, tok);
  }

  return [...signals];
}

function tokenizeAcText(text) {
  const out = new Set();
  for (const tok of text.toLowerCase().match(/[a-z]{3,}/g) || []) {
    if (!STOPWORDS.has(tok)) out.add(tok);
  }
  return out;
}

/**
 * Inverse document frequency across the live AC corpus. A term in every AC
 * scores 0 (no discriminating power); a term in one AC of many scores high.
 */
function buildIdf(acTokenSets) {
  const df = new Map();
  for (const tokens of acTokenSets) {
    for (const t of tokens) df.set(t, (df.get(t) || 0) + 1);
  }
  const n = acTokenSets.length || 1;
  const idf = new Map();
  for (const [term, count] of df) idf.set(term, Math.log(n / count));
  return idf;
}

function confidenceFor(score, topScore) {
  if (topScore <= 0) return 'low';
  const ratio = score / topScore;
  if (ratio >= 0.66) return 'high';
  if (ratio >= 0.33) return 'medium';
  return 'low';
}

function mapChangedFilesToCandidates(changedFiles, repoRoot) {
  const acs = listAcs(repoRoot);
  const acTokens = new Map(acs.map((ac) => [ac.id, tokenizeAcText(ac.text || '')]));
  const idf = buildIdf([...acTokens.values()]);

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
    const scored = [];

    for (const ac of acs) {
      const tokens = acTokens.get(ac.id);
      const overlap = signals.filter((s) => tokens.has(s));
      // Sum IDF weights: a match only counts for as much as the term is
      // actually discriminating across this project's own AC corpus.
      const score = overlap.reduce((sum, t) => sum + (idf.get(t) || 0), 0);
      if (score <= 0) continue;
      scored.push({ ac, overlap, score });
    }

    if (scored.length === 0) {
      uncoveredFiles.push({
        path: file,
        reason: acs.length === 0
          ? "no ACs exist yet in this project's Kane context graph"
          : "no discriminating term overlap between this file's extracted signals and any live AC text",
      });
      continue;
    }

    const topScore = Math.max(...scored.map((s) => s.score));
    for (const { ac, overlap, score } of scored) {
      const conf = confidenceFor(score, topScore);
      if (!candidates.has(ac.id)) {
        candidates.set(ac.id, { ac: ac.id, confidence: conf, score: 0, files: [] });
      }
      const entry = candidates.get(ac.id);
      entry.score = Math.max(entry.score, score);
      // Keep the strongest confidence this AC earned from any changed file.
      if (conf === 'high' || (conf === 'medium' && entry.confidence === 'low')) {
        entry.confidence = conf;
      }
      const weighted = overlap
        .map((t) => `${t}(${(idf.get(t) || 0).toFixed(2)})`)
        .sort()
        .join(', ');
      entry.files.push({
        path: file,
        reason: `discriminating term overlap [${weighted}], score ${score.toFixed(2)}`,
      });
    }
  }

  const ordered = [...candidates.values()].sort((a, b) => b.score - a.score);
  return { candidates: ordered, uncoveredFiles, allAcs: acs };
}

module.exports = { mapChangedFilesToCandidates, extractSignals, tokenizeAcText, buildIdf };
