// Exercises the structural diff -> AC mapper against this project's own
// real files and its real live Kane context graph. No fabricated ACs, no
// fixture files -- listAcs() reads the actual .context/ graph on disk.
// Run with: node test/acMap.test.js

const assert = require('assert');
const path = require('path');
const { mapChangedFilesToCandidates, extractSignals, buildIdf, tokenizeAcText } = require('../src/acMap');

const REPO_ROOT = path.resolve(__dirname, '..', '..');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  PASS  ${name}`);
    passed++;
  } catch (err) {
    console.log(`  FAIL  ${name}`);
    console.log(`        ${err.message}`);
    failed++;
  }
}

test('extractSignals pulls real route paths, requires, and identifiers', () => {
  const src = `
    const express = require('express');
    const subscriptionService = require('../services/subscriptionService');
    router.post('/upgrade', (req, res) => { res.json({ plan: 'pro' }); });
  `;
  const signals = extractSignals(src, 'app/server/routes/upgrade.js');
  assert.ok(signals.includes('upgrade'), 'filename + route token');
  assert.ok(signals.includes('subscription'), 'camelCase-split require target');
  assert.ok(signals.includes('post'), 'HTTP method');
  assert.ok(signals.includes('pro'), 'domain vocabulary from string literal');
});

test('extractSignals falls back to filename tokens when content is unreadable', () => {
  const signals = extractSignals(null, 'app/server/routes/upgrade.js');
  assert.ok(signals.includes('upgrade'));
});

test('buildIdf gives a term present in every AC exactly zero weight', () => {
  const idf = buildIdf([
    tokenizeAcText('upgrade the account'),
    tokenizeAcText('upgrade the dashboard'),
  ]);
  assert.strictEqual(idf.get('upgrade'), 0, 'term in all docs must not discriminate');
  assert.ok(idf.get('account') > 0, 'term in one doc of two must carry weight');
});

// --- Ground-truth check against the real regression -----------------------
// app/server/services/subscriptionService.js is the file the real,
// committed regression touched (upgradeToPro stopped persisting). The AC it
// actually violated is ac-1: "After a successful upgrade request, the
// account's persisted plan changes from `free` to `pro`." The mapper must
// rank that AC first, from the real graph, with no hardcoded mapping.
test('real regression file ranks the AC it actually broke first, with high confidence', () => {
  const { candidates } = mapChangedFilesToCandidates(
    ['app/server/services/subscriptionService.js'],
    REPO_ROOT
  );
  assert.ok(candidates.length > 0, 'expected at least one candidate AC');
  assert.strictEqual(candidates[0].ac, 'ac-1', `expected ac-1 ranked first, got ${candidates[0].ac}`);
  assert.strictEqual(candidates[0].confidence, 'high');
});

test('IDF weighting actually narrows the candidate set (precision, not just recall)', () => {
  const { candidates, allAcs } = mapChangedFilesToCandidates(
    ['app/server/services/subscriptionService.js'],
    REPO_ROOT
  );
  // A plain binary "any overlap counts" rule flagged every AC in the corpus
  // for this file. Weighted scoring must do strictly better than that.
  assert.ok(
    candidates.length < allAcs.length,
    `expected fewer candidates (${candidates.length}) than total live ACs (${allAcs.length})`
  );
});

test('a file unrelated to any requirement is reported uncovered, not force-matched', () => {
  const { uncoveredFiles } = mapChangedFilesToCandidates(['proofline-cli/src/verdict.js'], REPO_ROOT);
  assert.ok(
    uncoveredFiles.some((f) => f.path === 'proofline-cli/src/verdict.js'),
    'Proofline\'s own source should not map to the app-under-test\'s requirements'
  );
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
