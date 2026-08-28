#!/usr/bin/env node
const path = require('path');
const { changedFiles, diffText } = require('../src/git');
const { mapChangedFilesToCandidates } = require('../src/acMap');
const { refineCandidates } = require('../src/llmRank');
const { resolveTestFilesForAcs, runTargeted } = require('../src/kane');
const { classify } = require('../src/evidenceStrength');
const { render } = require('../src/verdict');
const { checkEnvironment } = require('../src/preflight');
const { buildReport } = require('../src/report');
const { checkAppFreshness } = require('../src/staleness');
const fs = require('fs');

const HELP = `
proofline -- which product requirements does this code change put at risk?

Usage:
  proofline [--dry-run] [--ref <git-ref>] [--repo <path>]

Options:
  --dry-run        Mapping only: shows affected ACs, no Kane verification,
                    no credits spent.
  --ref <ref>      Diff against this git ref instead of HEAD (e.g. HEAD~1,
                    a commit hash, a branch name).
  --repo <path>    Run against this repository instead of the current
                    directory. Must already have a Kane context graph
                    (requirements ingested) and live *_test.md files.
  --report <file>  Also write a self-contained HTML evidence report you can
                    open, share, or attach to a pull request.
  --allow-stale    Verify even if the running app looks older than your
                    changes. Only use this if you know the app is current.
  --help, -h       Show this help.

Requires: a git repository, kane-cli on PATH and authenticated, and the
target repo's requirements already run through Kane's assurance lifecycle
(context ingest / design tests) -- Proofline verifies against a project's
own existing requirements corpus, it does not invent one.
`.trim();

const KNOWN_FLAGS = new Set(['--dry-run', '--ref', '--repo', '--report', '--allow-stale', '--help', '-h']);
const VALUE_FLAGS = new Set(['--ref', '--repo', '--report']);

function parseArgs(argv) {
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--') || a === '-h') {
      if (!KNOWN_FLAGS.has(a)) {
        throw new Error(`Unknown flag "${a}". Run with --help for usage.`);
      }
      if (VALUE_FLAGS.has(a) && !argv[i + 1]) {
        throw new Error(`${a} requires a value. Run with --help for usage.`);
      }
    }
  }

  const dryRun = argv.includes('--dry-run');
  const allowStale = argv.includes('--allow-stale');
  const refIdx = argv.indexOf('--ref');
  const ref = refIdx >= 0 ? argv[refIdx + 1] : 'HEAD';
  const repoIdx = argv.indexOf('--repo');
  const repoRoot = repoIdx >= 0 ? path.resolve(argv[repoIdx + 1]) : process.cwd();
  const reportIdx = argv.indexOf('--report');
  const reportPath = reportIdx >= 0 ? path.resolve(argv[reportIdx + 1]) : null;
  const help = argv.includes('--help') || argv.includes('-h');

  return { dryRun, ref, repoRoot, reportPath, allowStale, help };
}

function writeReport(reportPath, data) {
  if (!reportPath) return;
  try {
    fs.writeFileSync(reportPath, buildReport(data), 'utf-8');
    console.log(`\nHTML evidence report written to: ${reportPath}`);
  } catch (err) {
    console.error(`\nCould not write report to ${reportPath}: ${err.message}`);
  }
}

async function main() {
  const { dryRun, ref, repoRoot, reportPath, allowStale, help } = parseArgs(process.argv.slice(2));

  if (help) {
    console.log(HELP);
    return;
  }

  const problems = checkEnvironment(repoRoot);
  if (problems.length > 0) {
    console.log(`Proofline can't run against "${repoRoot}":\n`);
    for (const p of problems) console.log(`  - ${p}`);
    process.exitCode = 1;
    return;
  }

  const files = changedFiles(repoRoot, ref);
  if (files.length === 0) {
    console.log('No changed files against ' + ref + '.');
    return;
  }

  const { candidates, uncoveredFiles, allAcs } = mapChangedFilesToCandidates(files, repoRoot);

  if (candidates.length === 0) {
    console.log(render({ changedFiles: files, uncoveredFiles, candidates: [], evidenceByAc: {} }).text);
    writeReport(reportPath, { repoRoot, ref, changedFiles: files, uncoveredFiles, candidates: [], evidenceByAc: {}, evidencePath: null, dryRun });
    return;
  }

  const refined = await refineCandidates(diffText(repoRoot, ref), candidates, allAcs);

  if (dryRun) {
    console.log('DRY RUN -- mapping only, no Kane verification executed (no credits spent).\n');
    console.log(render({ changedFiles: files, uncoveredFiles, candidates: refined, evidenceByAc: {}, notYetVerified: true }).text);
    writeReport(reportPath, { repoRoot, ref, changedFiles: files, uncoveredFiles, candidates: refined, evidenceByAc: {}, evidencePath: null, dryRun: true, allAcs });
    return;
  }

  const acIds = refined.map((c) => c.ac);
  const { files: testFiles, unresolved } = resolveTestFilesForAcs(repoRoot, acIds);

  if (testFiles.length === 0) {
    console.log('No live Kane tests resolve for the affected ACs:', unresolved.join(', '));
    return;
  }

  // Guard against verifying a running app that predates the code being
  // analyzed -- the false-assurance case this tool exists to prevent.
  //
  // Only files the mapper actually tied to a requirement are considered.
  // Checking every changed file made this fire on Proofline's own source
  // and on the report it had just written, neither of which the app under
  // test serves -- a false alarm that would train people to pass
  // --allow-stale reflexively, defeating the guard.
  const relevantToApp = [...new Set(refined.flatMap((c) => (c.files || []).map((f) => f.path)))];
  const fresh = checkAppFreshness(repoRoot, relevantToApp);
  if (fresh.stale === true && !allowStale) {
    console.log('STALE APP -- refusing to verify.\n');
    console.log(`  ${fresh.reason}.`);
    console.log('  These changed files are newer than the running app:');
    for (const f of fresh.staleFiles) console.log(`    - ${f}`);
    console.log('\n  Kane would test code that is no longer what you changed, and a PASS');
    console.log('  would mean nothing. Restart your app server, then run this again.');
    console.log('\n  (Re-run with --allow-stale if you know the app is already current.)');
    process.exitCode = 1;
    return;
  }
  if (fresh.stale === null) {
    console.log(`Note: could not confirm the running app includes your changes (${fresh.reason}).`);
    console.log('If your app server was started before these edits, restart it first.\n');
  }

  console.log(`Running targeted Kane verification for: ${testFiles.map((f) => path.basename(f)).join(', ')}`);
  console.log('(NOTE: any test not yet authored/cached will consume real Kane credits.)\n');

  const { events, evidencePath, raw, memberStatus } = runTargeted(repoRoot, testFiles);
  const runEnd = events.find((e) => e.type === 'run_end' || e.type === 'test_md_summary');

  console.log(`Evidence pack used: ${evidencePath || '(none)'}`);
  console.log(`Member status: ${JSON.stringify(memberStatus)}\n`);

  if (!evidencePath) {
    console.log('Targeted run finished but no evidence pack path could be recovered.');
    console.log('Last NDJSON event seen:', JSON.stringify(runEnd, null, 2));
    console.log('\nRaw tail of output for debugging:\n' + raw.slice(-1500));
    process.exitCode = 1;
    return;
  }

  const evidenceByAc = classify(repoRoot, acIds, evidencePath, memberStatus);
  const report = render({ changedFiles: files, uncoveredFiles, candidates: refined, evidenceByAc });
  console.log(report.text);
  writeReport(reportPath, { repoRoot, ref, changedFiles: files, uncoveredFiles, candidates: refined, evidenceByAc, evidencePath, dryRun: false, allAcs });

  // Non-zero exit on BLOCK so this can gate a pre-commit hook or CI step.
  if (report.verdict === 'BLOCK') process.exitCode = 1;
}

main().catch((err) => {
  console.error('proofline error:', err.message);
  process.exit(1);
});
