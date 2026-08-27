const fs = require('fs');
const path = require('path');

function findTestFiles(repoRoot) {
  const dir = path.join(repoRoot, '.testmuai', 'tests');
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('_test.md'))
    .map((f) => path.join(dir, f));
}

/**
 * Parses a live *_test.md file for:
 *  - its H1 title (the stable link into the context graph, see contextGraph.js)
 *  - the full @verifies ac-N[, ac-M...] list from its assertion step heading
 * This is the literal, on-disk source of truth for "which ACs does this test
 * claim to verify" -- confirmed by direct inspection, not documentation.
 */
function parseTestFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const titleMatch = content.match(/^#\s+(.+)$/m);
  const title = titleMatch ? titleMatch[1].trim() : null;

  // Real bug found in production use: the old pattern's [\s] in the
  // character class matches newlines with no line anchor, so it greedily
  // consumed into the step's body text on the next line (e.g. captured
  // "ac-6\n\nConfirm state-transition check" as one garbled entry instead
  // of "ac-6"), which silently broke `.includes('ac-6')` lookups. Confirmed
  // by a real run reporting a live AC as NOT_VERIFIED. Anchored to the
  // heading line only, and each entry is validated against the ac-N shape.
  const verifiesMatch = content.match(/@verifies\s+([^\n]+)/i);
  const verifies = verifiesMatch
    ? verifiesMatch[1]
        .split(',')
        .map((s) => s.trim())
        .filter((s) => /^ac-\d+$/i.test(s))
    : [];

  return { filePath, title, verifies };
}

function allTests(repoRoot) {
  return findTestFiles(repoRoot).map(parseTestFile);
}

module.exports = { allTests, parseTestFile };
