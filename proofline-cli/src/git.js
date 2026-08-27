const { execFileSync } = require('child_process');
const path = require('path');

function run(args, cwd) {
  return execFileSync('git', args, { cwd, encoding: 'utf-8' });
}

/**
 * Kane's own artifacts are requirement and test DEFINITIONS, not the
 * application implementation under test. They must never be analyzed as
 * changed application code: .context/ literally contains the acceptance
 * criteria text, so matching a changed .context/ blob against the AC corpus
 * scores every AC against its own definition -- confirmed by a real run,
 * which flagged all six ACs off Kane's own graph files.
 *
 * A change to these paths means the REQUIREMENTS moved, which is a real but
 * different question -- Kane's own `maintain reconcile` owns it.
 */
const KANE_OWNED = [/^\.context\//, /^\.testmuai\//, /^\.evidence\//];

function isKaneOwned(file) {
  return KANE_OWNED.some((re) => re.test(file));
}

/**
 * Returns changed file paths (relative to repo root, forward-slash) between
 * `ref` and the working tree, including uncommitted and staged changes.
 * Kane-owned requirement/test artifacts are excluded -- see above.
 */
function changedFiles(cwd, ref = 'HEAD') {
  const tracked = run(['diff', '--name-only', ref], cwd).trim();
  const untracked = run(['ls-files', '--others', '--exclude-standard'], cwd).trim();
  const files = new Set();
  for (const line of tracked.split('\n')) {
    if (line) files.add(line.trim());
  }
  for (const line of untracked.split('\n')) {
    if (line) files.add(line.trim());
  }
  return [...files]
    .map((f) => f.split(path.sep).join('/'))
    .filter((f) => !isKaneOwned(f));
}

function diffText(cwd, ref = 'HEAD') {
  return run(['diff', ref], cwd);
}

module.exports = { changedFiles, diffText, isKaneOwned };
