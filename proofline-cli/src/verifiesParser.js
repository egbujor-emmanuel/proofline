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

  const verifiesMatch = content.match(/@verifies\s+([a-z0-9,\-\s]+)/i);
  const verifies = verifiesMatch
    ? verifiesMatch[1]
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    : [];

  return { filePath, title, verifies };
}

function allTests(repoRoot) {
  return findTestFiles(repoRoot).map(parseTestFile);
}

module.exports = { allTests, parseTestFile };
