const { allTests } = require('./verifiesParser');
const { listNodes, getTestByTitle } = require('./contextGraph');
const { coverForPack } = require('./coverage');

const STATES = {
  MACHINE_VERIFIED: 'machine_verified',
  TEST_LINKED_ONLY: 'test_linked_only',
  NOT_VERIFIED: 'not_verified',
  UNAFFECTED: 'unaffected',
  EXECUTION_ERROR: 'execution_error',
};

/**
 * Classifies each candidate AC's evidence strength against one specific,
 * known evidence pack (the one Proofline's own targeted testrun just
 * produced). Distinguishes:
 *  - machine_verified: this AC is the test's check.verified_against target,
 *    and the pack shows the use-case's ACs passing.
 *  - test_linked_only: a live test @verifies this AC, the pack shows ACs
 *    passing, but this AC is NOT the test's check.verified_against target --
 *    it rode on a different AC's runtime assertion (Kane confirmed: strict
 *    vs lenient rollup does not distinguish this; ac-1/ac-2/ac-6 all show
 *    identical proven counts under both).
 *  - not_verified: no live test verifies this AC at all.
 *  - execution_error: the covering test's run did not pass (agent misstep or
 *    product bug -- this module does not itself distinguish those; that
 *    requires the run's own bug-detection verdict, captured live by whatever
 *    invoked the targeted testrun).
 */
function classify(repoRoot, candidateAcIds, evidencePackPath, memberStatus = {}) {
  const nodes = listNodes(repoRoot);
  const tests = allTests(repoRoot);
  // Kept as a secondary/supplementary signal (pack validity, use-case-level
  // completeness) -- NOT the primary pass/fail source. See note below.
  const pack = coverForPack(repoRoot, evidencePackPath);

  const results = {};

  for (const acId of candidateAcIds) {
    const verifyingTest = tests.find((t) => t.verifies.includes(acId));

    if (!verifyingTest) {
      results[acId] = {
        state: STATES.NOT_VERIFIED,
        reason: 'No live *_test.md file verifies this AC.',
      };
      continue;
    }

    const testNode = getTestByTitle(repoRoot, nodes, verifyingTest.title);
    if (!testNode) {
      results[acId] = {
        state: STATES.NOT_VERIFIED,
        reason: `Test file claims to verify ${acId}, but its graph node could not be resolved (run "kane-cli context name --backfill" if a logical id drifted after re-authoring).`,
      };
      continue;
    }

    // Per-TEST pass/fail (from testrun's own member-level events), not
    // per-use-case aggregate: `cover`'s depth.acs is aggregated across every
    // test in the AC's use-case, so it would incorrectly blame ac-1 (covered
    // only by a passing test) for a different, unrelated test's failure in
    // the same use-case. Confirmed necessary by a real run: t-1 passed,
    // t-2 failed, both roll up into the same use-case in `cover` output.
    const fileBasename = require('path').basename(verifyingTest.filePath);
    const testPassed = memberStatus[fileBasename] === 'passed';

    if (!testPassed) {
      results[acId] = {
        state: STATES.EXECUTION_ERROR,
        reason: `Covering test "${verifyingTest.title}" (${fileBasename}) did not pass in this run (status: ${memberStatus[fileBasename] || 'unknown'}). This module does not itself distinguish agent-misstep from product-bug -- check the run's own bug-detection verdict for that.`,
        test: verifyingTest.title,
      };
      continue;
    }

    const checkedAc = testNode.check && testNode.check.verified_against;
    if (checkedAc === acId) {
      results[acId] = {
        state: STATES.MACHINE_VERIFIED,
        reason: `Test "${verifyingTest.title}" has an explicit runtime check (${testNode.check.kind}: ${testNode.check.operator} ${testNode.check.operand}) targeting exactly this AC.`,
        test: verifyingTest.title,
      };
    } else {
      results[acId] = {
        state: STATES.TEST_LINKED_ONLY,
        reason: `Test "${verifyingTest.title}" claims to verify this AC (@verifies ${verifyingTest.verifies.join(', ')}), but its explicit runtime check targets ${checkedAc || 'a different AC'} instead. Kane's own coverage counts this AC as "proven" alongside it -- confirmed identical under both strict and lenient rollup -- but there is no independent assertion for this specific AC.`,
        test: verifyingTest.title,
      };
    }
  }

  return results;
}

module.exports = { classify, STATES };
