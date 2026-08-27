const { STATES } = require('./evidenceStrength');

const ICONS = {
  [STATES.MACHINE_VERIFIED]: '\u{1F7E2}', // green circle
  [STATES.TEST_LINKED_ONLY]: '\u{1F7E1}', // yellow circle
  [STATES.NOT_VERIFIED]: '\u{1F534}', // red circle
  [STATES.EXECUTION_ERROR]: '\u{1F534}',
  [STATES.UNAFFECTED]: '⚪', // white circle
};

const LABELS = {
  [STATES.MACHINE_VERIFIED]: 'MACHINE VERIFIED',
  [STATES.TEST_LINKED_ONLY]: 'TEST-LINKED, NOT INDEPENDENTLY ASSERTED',
  [STATES.NOT_VERIFIED]: 'NOT VERIFIED',
  [STATES.EXECUTION_ERROR]: 'EXECUTION ERROR',
  [STATES.UNAFFECTED]: 'UNAFFECTED',
};

function decide(evidenceByAc) {
  const states = Object.values(evidenceByAc).map((e) => e.state);
  if (states.includes(STATES.EXECUTION_ERROR)) {
    return { verdict: 'BLOCK', reason: 'At least one affected AC has an execution error -- verification did not complete cleanly.' };
  }
  if (states.includes(STATES.NOT_VERIFIED)) {
    return { verdict: 'BLOCK', reason: 'At least one affected AC has no qualifying evidence after this change.' };
  }
  if (states.includes(STATES.TEST_LINKED_ONLY)) {
    return { verdict: 'REVIEW REQUIRED', reason: 'At least one affected AC is only test-linked, not independently machine-asserted -- Kane\'s evidence for it is weaker than a direct check.' };
  }
  return { verdict: 'SHIP', reason: 'All affected ACs are machine verified.' };
}

function render({ changedFiles, uncoveredFiles, candidates, evidenceByAc, notYetVerified }) {
  const lines = [];
  lines.push('CHANGE DETECTED');
  lines.push('─'.repeat(50));
  lines.push('');
  for (const f of changedFiles) lines.push(f);
  lines.push('');

  if (candidates.length === 0) {
    lines.push('No affected acceptance criteria found for the changed files.');
  } else {
    lines.push(`${candidates.length} requirement(s) affected`);
    lines.push('');
    for (const c of candidates) {
      const ev = evidenceByAc[c.ac] || { state: null, reason: 'Not yet run -- dry run only' };
      const icon = ev.state ? ICONS[ev.state] : '\u{26AA}';
      const label = ev.state ? LABELS[ev.state] : 'PENDING VERIFICATION';
      lines.push(`${c.ac.toUpperCase()}   ${icon} ${label}`);
      lines.push(`          ${ev.reason}`);
      lines.push(`          changed by: ${c.files.map((f) => f.path).join(', ')}`);
      if (c.rationale) lines.push(`          mapper: ${c.rationale} (confidence: ${c.confidence})`);
      lines.push('');
    }
  }

  if (uncoveredFiles.length > 0) {
    lines.push('Files changed with no current AC coverage:');
    for (const f of uncoveredFiles) lines.push(`  ${f.path} -- ${f.reason}`);
    lines.push('');
  }

  lines.push('─'.repeat(50));
  if (notYetVerified) {
    lines.push('VERDICT: NOT YET VERIFIED (dry run -- no Kane execution performed)');
    lines.push('');
    lines.push('Run without --dry-run to execute targeted Kane verification and get a real SHIP/BLOCK/REVIEW decision.');
    return { text: lines.join('\n'), verdict: 'NOT_YET_VERIFIED', reason: 'dry run' };
  }

  const { verdict, reason } = decide(evidenceByAc);
  lines.push(`VERDICT: ${verdict}`);
  lines.push('');
  lines.push(`Reason: ${reason}`);

  return { text: lines.join('\n'), verdict, reason };
}

module.exports = { decide, render };
