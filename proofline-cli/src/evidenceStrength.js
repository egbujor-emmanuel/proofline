const path = require('path');
const { allTests } = require('./verifiesParser');
const { listNodes, getTestByTitle } = require('./contextGraph');
const { coverForPack } = require('./coverage');
const { findResultStatus } = require('./evidencePack');

const STATES = {
  MACHINE_VERIFIED: 'machine_verified',
  TEST_LINKED_ONLY: 'test_linked_only',
  NOT_VERIFIED: 'not_verified',
  UNAFFECTED: 'unaffected',
  PRODUCT_BUG: 'product_bug',
  AGENT_MISSTEP: 'agent_misstep',
  TEST_FAILURE_UNCLASSIFIED: 'test_failure_unclassified',
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
 *  - product_bug: the covering test completed and its assertion genuinely
 *    failed against the real application -- a confirmed product defect.
 *  - agent_misstep: the covering test's run did not complete (Kane's own
 *    evidence pack marks it "broken", not "failed") -- the test-agent
 *    couldn't act, which is NOT evidence the product is broken.
 *  - test_failure_unclassified: the test didn't pass and the pack's status
 *    doesn't cleanly resolve to either of the above -- treated as needing
 *    human review rather than an automatic BLOCK.
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
    const fileBasename = path.basename(verifyingTest.filePath);
    const testPassed = memberStatus[fileBasename] === 'passed';

    if (!testPassed) {
      // Real signal, confirmed by direct inspection of a sealed evidence
      // pack: result.yaml's own `status` field distinguishes "broken" (the
      // agent got stuck / couldn't act -- Kane's own nested run_summary
      // showed "AP determined agent is stuck, no viable actions remain")
      // from a genuine completed-but-failed assertion. Never flatten these:
      // an agent misstep is not evidence the product is broken.
      const packStatus = findResultStatus(evidencePackPath, verifyingTest.filePath);

      if (packStatus === 'broken') {
        results[acId] = {
          state: STATES.AGENT_MISSTEP,
          reason: `REVIEW REQUIRED -- Verification failed due to test-agent error (Kane could not complete "${verifyingTest.title}"). No product defect established.`,
          test: verifyingTest.title,
        };
      } else if (packStatus === 'failed') {
        results[acId] = {
          state: STATES.PRODUCT_BUG,
          reason: `Test "${verifyingTest.title}" completed and its assertion failed against the real running application. This is a genuine product-behavior failure, not a test/agent error.`,
          test: verifyingTest.title,
        };
      } else {
        results[acId] = {
          state: STATES.TEST_FAILURE_UNCLASSIFIED,
          reason: `Covering test "${verifyingTest.title}" did not pass (member status: ${memberStatus[fileBasename] || 'unknown'}, pack status: ${packStatus || 'unreadable'}), and this run's evidence pack does not clearly classify it as agent-misstep or product-bug. Treat as needing human review, not an automatic BLOCK.`,
          test: verifyingTest.title,
        };
      }
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
