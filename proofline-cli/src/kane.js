const { execFileSync } = require('child_process');
const { allTests } = require('./verifiesParser');
const { listNodes } = require('./contextGraph');

/**
 * Resolves candidate ACs -> the minimal set of live test logical ids that
 * verify them, then runs exactly those tests as one sealed evidence pack via
 * `kane-cli testrun run --from-context T-1,T-2` (confirmed real flag on the
 * installed v0.8.6 binary). Never runs the whole suite for a targeted check.
 */
function resolveTestIdsForAcs(repoRoot, acIds) {
  const tests = allTests(repoRoot);
  const nodes = listNodes(repoRoot);

  const testIds = new Set();
  const unresolved = [];

  for (const acId of acIds) {
    const test = tests.find((t) => t.verifies.includes(acId));
    if (!test) {
      unresolved.push(acId);
      continue;
    }
    const node = nodes.find((n) => n.label === 'test' && n.title === test.title);
    if (node) testIds.add(node.id);
  }

  return { testIds: [...testIds], unresolved };
}

function runTargeted(repoRoot, testIds, variables) {
  const args = ['testrun', 'run', '--from-context', testIds.join(','), '--headless', '--agent'];
  let stdout;
  try {
    stdout = execFileSync('kane-cli', args, { cwd: repoRoot, encoding: 'utf-8', maxBuffer: 50 * 1024 * 1024, shell: true });
  } catch (err) {
    // kane-cli exits non-zero on a failed run; stdout still carries the NDJSON we need.
    stdout = err.stdout ? err.stdout.toString() : '';
  }

  const lines = stdout.split('\n').filter(Boolean);
  const events = lines
    .map((l) => {
      try {
        return JSON.parse(l);
      } catch {
        return null;
      }
    })
    .filter(Boolean);

  // The evidence path is printed as a plain text line, not NDJSON:
  //   evidence: view locally with `kane-cli evidence serve <path>`
  // Confirmed format from real testmd run output; recovered here by regex
  // since it never appears as a parseable JSON event.
  const evidenceMatch = stdout.match(/evidence:\s*view locally with `kane-cli evidence serve ([^`]+)`/);
  const evidencePath = evidenceMatch ? evidenceMatch[1].trim() : null;

  return { events, raw: stdout, evidencePath };
}

module.exports = { resolveTestIdsForAcs, runTargeted };
