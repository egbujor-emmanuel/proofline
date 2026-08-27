const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

function listNodes(repoRoot) {
  const raw = execFileSync('kane-cli', ['context', 'list', '--json'], {
    cwd: repoRoot,
    encoding: 'utf-8',
    shell: true,
  });
  return raw
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => JSON.parse(l));
}

function readNode(repoRoot, cid) {
  const hash = cid.replace('sha256:', '');
  const file = path.join(repoRoot, '.context', 'derived', 'nodes', hash.slice(0, 2), hash.slice(2) + '.json');
  return JSON.parse(fs.readFileSync(file, 'utf-8'));
}

/**
 * Resolves an AC's logical id (e.g. "ac-1") to its full node content
 * (text, kind, expected_answer, risk) straight from the local graph.
 */
function getAc(repoRoot, nodes, acId) {
  const entry = nodes.find((n) => n.label === 'ac' && n.id === acId);
  if (!entry) return null;
  return { ...entry, ...readNode(repoRoot, entry.cid).content };
}

/**
 * Resolves a test's title (parsed from its live *_test.md H1) to its graph
 * node -- title-matching is used deliberately because editing+re-authoring a
 * test.md file can supersede its logical id (observed directly: t-1 drifted
 * to a raw hash id after re-authoring, until `context name --backfill` fixed
 * it). Title is the stable link between the file on disk and the graph.
 */
function getTestByTitle(repoRoot, nodes, title) {
  const entry = nodes.find((n) => n.label === 'test' && n.title === title);
  if (!entry) return null;
  return { ...entry, ...readNode(repoRoot, entry.cid).content };
}

module.exports = { listNodes, readNode, getAc, getTestByTitle };
