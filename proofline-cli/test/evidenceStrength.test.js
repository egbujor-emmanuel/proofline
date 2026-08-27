// Exercises classify() against real, already-captured evidence packs from
// this project's own live Kane runs (see README section below each case for
// where each pack came from). No live Kane calls, no fabricated NDJSON or
// evidence -- every fixture path here is a real file already on disk from
// earlier validation. Run with: node test/evidenceStrength.test.js

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { classify, STATES } = require('../src/evidenceStrength');

const REPO_ROOT = path.resolve(__dirname, '..', '..');

function requireExists(p, label) {
  if (!fs.existsSync(p)) {
    throw new Error(`Fixture missing for "${label}": ${p}\nRe-run the relevant Phase 2/regression step to regenerate it, or update this path.`);
  }
  return p;
}

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

// --- Fixture 1: clean pass -----------------------------------------------
// From the very first fully-passing 7-step run of t-1, before the test was
// strengthened and before the regression existed. result.yaml for this pack
// has status: passed with NO flaky/adaptive_heal fields at all (confirmed
// by direct extraction).
const CLEAN_PACK = requireExists(
  path.join(REPO_ROOT, '.testmuai', 'evidence', '97af2b0c-9259-4988-83d9-3e842bc45fa7.evidence'),
  'clean pass'
);

test('clean pass -> machine_verified_clean for the checked AC', () => {
  const result = classify(REPO_ROOT, ['ac-1'], CLEAN_PACK, {
    'fresh-fetch-and-reload-show-the-upgraded-pro-plan_test.md': 'passed',
  });
  assert.strictEqual(result['ac-1'].state, STATES.MACHINE_VERIFIED_CLEAN);
  assert.strictEqual(result['ac-1'].kane.status, 'passed');
  assert.strictEqual(result['ac-1'].kane.flaky, false);
  assert.strictEqual(result['ac-1'].kane.adaptiveHealTriggered, false);
});

test('clean pass -> test_linked_only for an AC the test claims but does not directly assert', () => {
  const result = classify(REPO_ROOT, ['ac-2'], CLEAN_PACK, {
    'fresh-fetch-and-reload-show-the-upgraded-pro-plan_test.md': 'passed',
  });
  assert.strictEqual(result['ac-2'].state, STATES.TEST_LINKED_ONLY);
});

// --- Fixture 2: healed pass -----------------------------------------------
// From the first regression-detection attempt, before the test was
// strengthened. result.yaml shows flaky: true and adaptive_heal.triggered:
// true -- Kane silently re-authored the failing tail after a replay miss,
// and the healed assertion checked optimistic UI state instead of
// persisted state (confirmed by inspecting the actual actions.ndjson).
const HEALED_PACK = requireExists(
  path.join(REPO_ROOT, '.testmuai', 'evidence', '076865d2-ee4c-4424-bfac-62b41c5d8b95.evidence'),
  'healed pass'
);

test('healed pass -> machine_verified_healed, not clean, for the checked AC', () => {
  const result = classify(REPO_ROOT, ['ac-1'], HEALED_PACK, {
    'fresh-fetch-and-reload-show-the-upgraded-pro-plan_test.md': 'passed',
  });
  assert.strictEqual(result['ac-1'].state, STATES.MACHINE_VERIFIED_HEALED);
  assert.strictEqual(result['ac-1'].kane.flaky, true);
  assert.strictEqual(result['ac-1'].kane.adaptiveHealTriggered, true);
});

// --- Fixture 3: agent misstep ("broken") ----------------------------------
// From a real testrun invocation where both members came back "broken"
// (confirmed via direct result.yaml extraction), distinct from a genuine
// assertion failure.
const BROKEN_PACK = requireExists(
  path.join(REPO_ROOT, '.testmuai', 'evidence', 'f2ec2f4c-c21e-43b0-8145-2e965c63c582.evidence'),
  'agent misstep'
);

test('broken execution -> agent_misstep, never product_bug', () => {
  const result = classify(REPO_ROOT, ['ac-1', 'ac-5'], BROKEN_PACK, {
    'fresh-fetch-and-reload-show-the-upgraded-pro-plan_test.md': 'failed',
    'dashboard-upgrade-stays-in-place-and-shows-success-without_test.md': 'failed',
  });
  assert.strictEqual(result['ac-1'].state, STATES.AGENT_MISSTEP);
  assert.strictEqual(result['ac-5'].state, STATES.AGENT_MISSTEP);
  assert.strictEqual(result['ac-1'].kane.status, 'broken');
});

// --- Fixture 4: genuine product bug ----------------------------------------
// From the real strengthened-test regression catch: Step 7 actually failed
// (extracted_value "Current plan: Free" vs expected "pro"), with a real
// Kane bug-detection verdict (family: application_issue, category:
// functional_defect, severity: major).
const PRODUCT_BUG_PACK = requireExists(
  path.join(
    os.homedir(),
    '.testmuai',
    'kaneai',
    'sessions',
    'fe840bb1-6ccc-4acd-9ce6-c56659f75976',
    'evidence',
    'eca9dd62-eee3-48a5-9752-a0f86110434d.evidence'
  ),
  'product bug'
);

test('completed, genuinely failed assertion -> product_bug', () => {
  const result = classify(REPO_ROOT, ['ac-1'], PRODUCT_BUG_PACK, {
    'fresh-fetch-and-reload-show-the-upgraded-pro-plan_test.md': 'failed',
  });
  assert.strictEqual(result['ac-1'].state, STATES.PRODUCT_BUG);
  assert.strictEqual(result['ac-1'].kane.status, 'failed');
});

// --- No fixture needed: an AC with no covering test at all ----------------
test('no covering test -> not_verified (no evidence pack access needed)', () => {
  const result = classify(REPO_ROOT, ['ac-99-does-not-exist'], CLEAN_PACK, {});
  assert.strictEqual(result['ac-99-does-not-exist'].state, STATES.NOT_VERIFIED);
  assert.strictEqual(result['ac-99-does-not-exist'].kane, null);
});

// --- A genuinely unreadable evidence pack (real failure mode, not mocked) -
// A nonexistent path reproduces exactly what a corrupt/missing pack, or a
// non-Windows host missing PowerShell, would look like: findResultDetails
// must catch the failure and return status: null with an error message,
// not throw and crash the whole classify() call.
const MISSING_PACK = path.join(REPO_ROOT, '.testmuai', 'evidence', 'this-pack-does-not-exist.evidence');

test('unreadable evidence pack -> test_failure_unclassified, not a crash', () => {
  const result = classify(REPO_ROOT, ['ac-3'], MISSING_PACK, {
    'dashboard-upgrade-stays-in-place-and-shows-success-without_test.md': 'failed',
  });
  assert.strictEqual(result['ac-3'].state, STATES.TEST_FAILURE_UNCLASSIFIED);
  assert.strictEqual(result['ac-3'].kane.status, null);
  assert.ok(result['ac-3'].reason.includes('Could not read evidence pack'), 'reason should surface the real read failure');
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
