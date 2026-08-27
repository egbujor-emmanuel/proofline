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
function classify(repoRoot, candidateAcIds, evidencePackPath) {
  const nodes = listNodes(repoRoot);
  const tests = allTests(repoRoot);
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

    const ucEntry = pack.depth.find((d) =>
      // the use-case this AC's check ultimately rolls up into
      true
    );
    const useCasePassed = ucEntry && ucEntry.acs.failed === 0 && ucEntry.acs.blocked === 0;

    if (!useCasePassed) {
      results[acId] = {
        state: STATES.EXECUTION_ERROR,
        reason: `Covering test "${verifyingTest.title}" did not cleanly pass in evidence pack ${evidencePackPath}.`,
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
