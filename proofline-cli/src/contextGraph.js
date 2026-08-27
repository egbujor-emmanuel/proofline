const fs = require('fs');
const path = require('path');
const { kaneExec } = require('./kaneExec');

function listNodes(repoRoot) {
  const raw = kaneExec(['context', 'list', '--json'], { cwd: repoRoot });
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

/**
 * Every live AC currently in the graph, fully resolved (text/kind/risk).
 * Used by the structural mapper so it never needs a per-project, hand-
 * maintained file->AC table -- it reasons over whatever ACs actually exist
 * for THIS project's own ingested requirements.
 */
function listAcs(repoRoot) {
  const nodes = listNodes(repoRoot);
  return nodes.filter((n) => n.label === 'ac').map((n) => getAc(repoRoot, nodes, n.id));
}

module.exports = { listNodes, readNode, getAc, getTestByTitle, listAcs };
