const fs = require('fs');
const path = require('path');
const { kaneExec } = require('./kaneExec');

/**
 * Reads the live context graph as NDJSON.
 *
 * kane-cli intermittently crashes on exit with a libuv assertion
 * ("!(handle->flags & UV_HANDLE_CLOSING)") AFTER having already written
 * complete, valid output -- observed repeatedly on this platform. A
 * non-zero exit therefore does not imply unusable output, so stdout is
 * salvaged and parsed either way; only genuinely unparseable output is an
 * error. Malformed individual lines are skipped rather than aborting the
 * whole read, since one bad line should not cost the entire graph.
 */
function listNodes(repoRoot) {
  let raw;
  try {
    raw = kaneExec(['context', 'list', '--json'], { cwd: repoRoot });
  } catch (err) {
    raw = (err.stdout && err.stdout.toString()) || '';
  }

  const nodes = [];
  for (const line of raw.split('\n')) {
    const t = line.trim();
    if (!t.startsWith('{')) continue;
    try {
      nodes.push(JSON.parse(t));
    } catch {
      // partial/interleaved line -- skip it, keep the rest of the graph
    }
  }

  if (nodes.length === 0) {
    throw new Error(
      'Could not read the Kane context graph ("kane-cli context list --json" returned no usable JSON). ' +
        'Check that kane-cli is authenticated (kane-cli whoami) and that this repo has an ingested requirements graph.'
    );
  }
  return nodes;
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
