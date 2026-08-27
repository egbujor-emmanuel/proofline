#!/usr/bin/env node
const path = require('path');
const { changedFiles, diffText } = require('../src/git');
const { mapChangedFilesToCandidates } = require('../src/acMap');
const { refineCandidates } = require('../src/llmRank');
const { resolveTestFilesForAcs, runTargeted } = require('../src/kane');
const { classify } = require('../src/evidenceStrength');
const { render } = require('../src/verdict');

const REPO_ROOT = path.resolve(__dirname, '..', '..');

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const refIdx = args.indexOf('--ref');
  const ref = refIdx >= 0 ? args[refIdx + 1] : 'HEAD';

  const files = changedFiles(REPO_ROOT, ref);
  if (files.length === 0) {
    console.log('No changed files against ' + ref + '.');
    return;
  }

  const { candidates, uncoveredFiles, allAcs } = mapChangedFilesToCandidates(files, REPO_ROOT);

  if (candidates.length === 0) {
    console.log(render({ changedFiles: files, uncoveredFiles, candidates: [], evidenceByAc: {} }).text);
    return;
  }

  const refined = await refineCandidates(diffText(REPO_ROOT, ref), candidates, allAcs);

  if (dryRun) {
    console.log('DRY RUN -- mapping only, no Kane verification executed (no credits spent).\n');
    console.log(render({ changedFiles: files, uncoveredFiles, candidates: refined, evidenceByAc: {}, notYetVerified: true }).text);
    return;
  }

  const acIds = refined.map((c) => c.ac);
  const { files: testFiles, unresolved } = resolveTestFilesForAcs(REPO_ROOT, acIds);

  if (testFiles.length === 0) {
    console.log('No live Kane tests resolve for the affected ACs:', unresolved.join(', '));
    return;
  }

  console.log(`Running targeted Kane verification for: ${testFiles.map((f) => path.basename(f)).join(', ')}`);
  console.log('(NOTE: any test not yet authored/cached will consume real Kane credits.)\n');

  const { events, evidencePath, raw, memberStatus } = runTargeted(REPO_ROOT, testFiles);
  const runEnd = events.find((e) => e.type === 'run_end' || e.type === 'test_md_summary');

  console.log(`Evidence pack used: ${evidencePath || '(none)'}`);
  console.log(`Member status: ${JSON.stringify(memberStatus)}\n`);

  if (!evidencePath) {
    console.log('Targeted run finished but no evidence pack path could be recovered.');
    console.log('Last NDJSON event seen:', JSON.stringify(runEnd, null, 2));
    console.log('\nRaw tail of output for debugging:\n' + raw.slice(-1500));
    return;
  }

  const evidenceByAc = classify(REPO_ROOT, acIds, evidencePath, memberStatus);
  const report = render({ changedFiles: files, uncoveredFiles, candidates: refined, evidenceByAc });
  console.log(report.text);
}

main().catch((err) => {
  console.error('proofline error:', err.message);
  process.exit(1);
});
