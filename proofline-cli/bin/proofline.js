#!/usr/bin/env node
const path = require('path');
const { changedFiles, diffText } = require('../src/git');
const { mapChangedFilesToCandidates } = require('../src/acMap');
const { refineCandidates } = require('../src/llmRank');
const { resolveTestFilesForAcs, runTargeted } = require('../src/kane');
const { classify } = require('../src/evidenceStrength');
const { render } = require('../src/verdict');
const { checkEnvironment } = require('../src/preflight');

const HELP = `
proofline -- which product requirements does this code change put at risk?

Usage:
  proofline [--dry-run] [--ref <git-ref>] [--repo <path>]

Options:
  --dry-run       Mapping only: shows affected ACs, no Kane verification,
                   no credits spent.
  --ref <ref>     Diff against this git ref instead of HEAD (e.g. HEAD~1,
                   a commit hash, a branch name).
  --repo <path>   Run against this repository instead of the current
                   directory. Must already have a Kane context graph
                   (requirements ingested) and live *_test.md files.
  --help, -h      Show this help.

Requires: a git repository, kane-cli on PATH and authenticated, and the
target repo's requirements already run through Kane's assurance lifecycle
(context ingest / design tests) -- Proofline verifies against a project's
own existing requirements corpus, it does not invent one.
`.trim();

const KNOWN_FLAGS = new Set(['--dry-run', '--ref', '--repo', '--help', '-h']);

function parseArgs(argv) {
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--') || a === '-h') {
      if (!KNOWN_FLAGS.has(a)) {
        throw new Error(`Unknown flag "${a}". Run with --help for usage.`);
      }
      if ((a === '--ref' || a === '--repo') && !argv[i + 1]) {
        throw new Error(`${a} requires a value. Run with --help for usage.`);
      }
    }
  }

  const dryRun = argv.includes('--dry-run');
  const refIdx = argv.indexOf('--ref');
  const ref = refIdx >= 0 ? argv[refIdx + 1] : 'HEAD';
  const repoIdx = argv.indexOf('--repo');
  const repoRoot = repoIdx >= 0 ? path.resolve(argv[repoIdx + 1]) : process.cwd();
  const help = argv.includes('--help') || argv.includes('-h');

  return { dryRun, ref, repoRoot, help };
}

async function main() {
  const { dryRun, ref, repoRoot, help } = parseArgs(process.argv.slice(2));

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
    return;
  }

  const refined = await refineCandidates(diffText(repoRoot, ref), candidates, allAcs);

  if (dryRun) {
    console.log('DRY RUN -- mapping only, no Kane verification executed (no credits spent).\n');
    console.log(render({ changedFiles: files, uncoveredFiles, candidates: refined, evidenceByAc: {}, notYetVerified: true }).text);
    return;
  }

  const acIds = refined.map((c) => c.ac);
  const { files: testFiles, unresolved } = resolveTestFilesForAcs(repoRoot, acIds);

  if (testFiles.length === 0) {
    console.log('No live Kane tests resolve for the affected ACs:', unresolved.join(', '));
    return;
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
}

main().catch((err) => {
  console.error('proofline error:', err.message);
  process.exit(1);
});
