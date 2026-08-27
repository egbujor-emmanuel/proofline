const path = require('path');
const { allTests } = require('./verifiesParser');
const { listNodes, getTestByTitle } = require('./contextGraph');
const { findResultDetails } = require('./evidencePack');

const STATES = {
  MACHINE_VERIFIED_CLEAN: 'machine_verified_clean',
  MACHINE_VERIFIED_HEALED: 'machine_verified_healed',
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
 * produced). Every result carries both:
 *  - `kane`: Kane's own raw signal (status/flaky/adaptiveHealTriggered),
 *    never mutated -- so Proofline can always say "Kane reported X;
 *    Proofline classified it as Y because Z" rather than collapsing the two.
 *  - `state`: Proofline's own interpretation, one of:
 *
 *  - machine_verified_clean: this AC is the test's check.verified_against
 *    target, the test passed, AND the execution carries no flaky/
 *    adaptive-heal integrity warning. Confirmed via a real pack: a clean
 *    passing result.yaml has neither field present at all.
 *  - machine_verified_healed: same as above, but the execution WAS flaky or
 *    adaptively healed. Confirmed via a real pack (the first
 *    regression-detection attempt, before the test was strengthened): a
 *    passing run silently re-authored its own failing tail after a replay
 *    miss, and the healed assertion ended up checking the wrong thing
 *    (optimistic UI state instead of persisted state) -- it let a real
 *    regression through. `proven` from Kane must never be flattened into
 *    "independently machine verified" without this check.
 *  - test_linked_only: a live test @verifies this AC, the test passed, but
 *    this AC is NOT the test's check.verified_against target -- it rode on
 *    a different AC's runtime assertion (Kane confirmed: strict vs lenient
 *    rollup does not distinguish this; ac-1/ac-2/ac-6 all show identical
 *    proven counts under both).
 *  - not_verified: no live test verifies this AC at all.
 *  - product_bug: the covering test completed and its assertion genuinely
 *    failed against the real application (Kane's own result.yaml status:
 *    "failed", generally paired with a confirmed bug-detection verdict) --
 *    a real product defect, not a test/agent error.
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
  // Previously also called coverForPack() here unconditionally as a
  // "pack validity" side-effect check, but that result was never actually
  // read anywhere below -- dead code, and confirmed by a real test to be
  // the exact thing that crashed classify() on an unreadable pack (Kane's
  // own `cover` throws on a missing pack). Removed rather than defensively
  // wrapped: it served no function once removed, so there's nothing to
  // preserve.
  const results = {};

  for (const acId of candidateAcIds) {
    const verifyingTest = tests.find((t) => t.verifies.includes(acId));

    if (!verifyingTest) {
      results[acId] = {
        state: STATES.NOT_VERIFIED,
        reason: 'No live *_test.md file verifies this AC.',
        kane: null,
      };
      continue;
    }

    const testNode = getTestByTitle(repoRoot, nodes, verifyingTest.title);
    if (!testNode) {
      results[acId] = {
        state: STATES.NOT_VERIFIED,
        reason: `Test file claims to verify ${acId}, but its graph node could not be resolved (run "kane-cli context name --backfill" if a logical id drifted after re-authoring).`,
        kane: null,
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

    // Real per-test detail, confirmed by direct inspection of sealed
    // evidence packs -- see evidencePack.js for what each field means and
    // how it was confirmed. Fetched regardless of pass/fail: needed for the
    // clean/healed split on the pass side, and for the misstep/bug split on
    // the fail side.
    const detail = findResultDetails(evidencePackPath, verifyingTest.filePath);
    const kane = { status: detail.status, flaky: detail.flaky, adaptiveHealTriggered: detail.adaptiveHealTriggered };

    if (!testPassed) {
      // Never flatten these: an agent misstep is not evidence the product
      // is broken.
      if (kane.status === 'broken') {
        results[acId] = {
          state: STATES.AGENT_MISSTEP,
          reason: `Kane reported this execution as "broken" (the test-agent could not complete "${verifyingTest.title}"). REVIEW REQUIRED -- no product defect established.`,
          test: verifyingTest.title,
          kane,
        };
      } else if (kane.status === 'failed') {
        results[acId] = {
          state: STATES.PRODUCT_BUG,
          reason: `Kane reported this execution as "failed" -- test "${verifyingTest.title}" completed and its assertion failed against the real running application. This is a genuine product-behavior failure, not a test/agent error.`,
          test: verifyingTest.title,
          kane,
        };
      } else {
        results[acId] = {
          state: STATES.TEST_FAILURE_UNCLASSIFIED,
          reason: `Covering test "${verifyingTest.title}" did not pass (member status: ${memberStatus[fileBasename] || 'unknown'}, Kane pack status: ${kane.status || 'unreadable'}${detail.error ? ` -- ${detail.error}` : ''}), and this run's evidence pack does not clearly classify it as agent-misstep or product-bug. Treat as needing human review, not an automatic BLOCK.`,
          test: verifyingTest.title,
          kane,
        };
      }
      continue;
    }

    const checkedAc = testNode.check && testNode.check.verified_against;
    if (checkedAc !== acId) {
      results[acId] = {
        state: STATES.TEST_LINKED_ONLY,
        reason: `Test "${verifyingTest.title}" claims to verify this AC (@verifies ${verifyingTest.verifies.join(', ')}), but its explicit runtime check targets ${checkedAc || 'a different AC'} instead. Kane's own coverage counts this AC as "proven" alongside it -- confirmed identical under both strict and lenient rollup -- but there is no independent assertion for this specific AC.`,
        test: verifyingTest.title,
        kane,
      };
      continue;
    }

    if (kane.flaky || kane.adaptiveHealTriggered) {
      results[acId] = {
        state: STATES.MACHINE_VERIFIED_HEALED,
        reason: `Kane reported PASS for "${verifyingTest.title}"'s explicit runtime check (${testNode.check.kind}: ${testNode.check.operator} ${testNode.check.operand}) targeting this AC -- but the execution was flaky/adaptively healed (Kane silently re-authored the failing tail). Proofline requires review before treating this as clean verification: a healed re-authoring has been confirmed, on a real prior run, to change what a test actually checks.`,
        test: verifyingTest.title,
        kane,
      };
    } else {
      results[acId] = {
        state: STATES.MACHINE_VERIFIED_CLEAN,
        reason: `Kane reported PASS for "${verifyingTest.title}"'s explicit runtime check (${testNode.check.kind}: ${testNode.check.operator} ${testNode.check.operand}) targeting exactly this AC, on a clean (non-flaky, non-healed) execution.`,
        test: verifyingTest.title,
        kane,
      };
    }
  }

  return results;
}

module.exports = { classify, STATES };
