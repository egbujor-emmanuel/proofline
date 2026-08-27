const path = require('path');
const { kaneExec } = require('./kaneExec');
const { allTests } = require('./verifiesParser');

/**
 * Resolves candidate ACs -> the minimal set of live test FILE PATHS that
 * verify them. Uses file-path matching rather than `testrun --from-context
 * T-1,T-2`: --from-context resolves by the graph's logical test id, and that
 * resolution broke in real testing after `context name --backfill` rewrote
 * a drifted id (confirmed error: "has no minted test file under
 * .testmuai\tests"). File-path matching via --match is immune to that graph
 * id/file bookkeeping and was confirmed working directly.
 */
function resolveTestFilesForAcs(repoRoot, acIds) {
  const tests = allTests(repoRoot);
  const files = new Set();
  const unresolved = [];

  for (const acId of acIds) {
    const test = tests.find((t) => t.verifies.includes(acId));
    if (!test) {
      unresolved.push(acId);
      continue;
    }
    files.add(test.filePath);
  }

  return { files: [...files], unresolved };
}

function runTargeted(repoRoot, testFilePaths) {
  // Build a --match regex that matches only these specific files' basenames,
  // so the run stays targeted rather than picking up every test in the dir.
  const basenames = testFilePaths.map((f) => path.basename(f).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const matchPattern = `(${basenames.join('|')})$`;

  const args = ['testrun', 'run', '--match', matchPattern, '--headless'];
  let stdout;
  try {
    stdout = kaneExec(args, { cwd: repoRoot, maxBuffer: 50 * 1024 * 1024 });
  } catch (err) {
    // kane-cli exits non-zero on a failed/partially-failed run; stdout still carries the NDJSON we need.
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

  // Evidence path is NOT reliably regexable from the human-readable text
  // block (confirmed: it line-wraps mid-path in the terminal, and the format
  // differs entirely from testmd run's single-line version). Instead, build
  // it from the reliable structured evidence_id field plus the confirmed
  // real on-disk pattern for testrun packs: .testmuai/evidence/<id>.evidence
  const summary = events.find((e) => e.type === 'testrun_summary');
  const evidenceId = summary && summary.execution && summary.execution.evidence_id;
  const evidencePath = evidenceId
    ? path.join(repoRoot, '.testmuai', 'evidence', `${evidenceId}.evidence`)
    : null;

  // Per-test (not per-use-case) pass/fail, straight from testrun's own
  // member-level events -- this is more precise than cover's use-case-level
  // aggregate, which would incorrectly conflate an unrelated test's failure
  // with a passing test in the same use-case (confirmed real case: t-1
  // passed, t-2 failed, both roll up into the same use-case in `cover`).
  const memberStatus = {};
  for (const e of events) {
    if (e.type === 'testrun_member_end' || e.type === 'testrun_authored_member_end') {
      memberStatus[path.basename(e.path)] = e.status;
    }
  }

  return { events, raw: stdout, evidencePath, summary, memberStatus };
}

module.exports = { resolveTestFilesForAcs, runTargeted };
