const { STATES } = require('./evidenceStrength');
const { decide } = require('./verdict');

/**
 * Writes a self-contained, shareable HTML evidence report -- the artifact a
 * developer attaches to a PR or keeps as an audit record. Terminal output
 * disappears into scrollback; a proof that cannot be shared or archived
 * undercuts the whole point of carrying a requirement to a ship decision.
 *
 * Deliberately shows Kane's RAW signal next to Proofline's interpretation
 * for every criterion, because that separation is the product: the reader
 * must be able to see "Kane reported PASS, Proofline still says review, and
 * here is exactly why" rather than being handed one opaque verdict.
 *
 * No external assets, no network calls -- the file opens anywhere, offline.
 */

const TONE = {
  [STATES.MACHINE_VERIFIED_CLEAN]: 'good',
  [STATES.MACHINE_VERIFIED_HEALED]: 'warn',
  [STATES.TEST_LINKED_ONLY]: 'warn',
  [STATES.AGENT_MISSTEP]: 'warn',
  [STATES.TEST_FAILURE_UNCLASSIFIED]: 'warn',
  [STATES.NOT_VERIFIED]: 'bad',
  [STATES.PRODUCT_BUG]: 'bad',
  [STATES.UNAFFECTED]: 'muted',
};

const LABEL = {
  [STATES.MACHINE_VERIFIED_CLEAN]: 'Machine verified',
  [STATES.MACHINE_VERIFIED_HEALED]: 'Machine verified — healed run',
  [STATES.TEST_LINKED_ONLY]: 'Test-linked, not independently asserted',
  [STATES.NOT_VERIFIED]: 'Not verified',
  [STATES.PRODUCT_BUG]: 'Product bug — requirement broken',
  [STATES.AGENT_MISSTEP]: 'Review required — test-agent error',
  [STATES.TEST_FAILURE_UNCLASSIFIED]: 'Review required — unclassified failure',
  [STATES.UNAFFECTED]: 'Unaffected',
};

const VERDICT_TONE = { SHIP: 'good', BLOCK: 'bad', 'REVIEW REQUIRED': 'warn' };

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function kaneSignalRow(kane) {
  if (!kane) return '<span class="muted">no Kane execution for this criterion</span>';
  const bits = [`status: <code>${esc(kane.status || 'unreadable')}</code>`];
  if (kane.flaky) bits.push('<code class="flag">flaky</code>');
  if (kane.adaptiveHealTriggered) bits.push('<code class="flag">adaptive_heal: triggered</code>');
  return bits.join(' &middot; ');
}

function buildReport({ repoRoot, ref, changedFiles, uncoveredFiles, candidates, evidenceByAc, evidencePath, dryRun }) {
  const { verdict, reason } = dryRun
    ? { verdict: 'NOT YET VERIFIED', reason: 'Dry run — mapping only, no Kane execution performed.' }
    : decide(evidenceByAc);
  const vTone = VERDICT_TONE[verdict] || 'muted';

  const rows = candidates
    .map((c) => {
      const ev = evidenceByAc[c.ac] || {};
      const state = ev.state;
      const tone = state ? TONE[state] || 'muted' : 'muted';
      const label = state ? LABEL[state] : 'Pending verification';
      const files = (c.files || []).map((f) => `<li><code>${esc(f.path)}</code><span class="why">${esc(f.reason)}</span></li>`).join('');
      return `
      <article class="ac ${tone}">
        <header>
          <h3>${esc(c.ac.toUpperCase())}</h3>
          <span class="pill ${tone}">${esc(label)}</span>
          <span class="conf">mapper confidence: <strong>${esc(c.confidence || 'n/a')}</strong>${c.llm_only ? ' <em>(model-identified)</em>' : ''}</span>
        </header>
        ${ev.reason ? `<p class="interp"><span class="tag">Proofline</span>${esc(ev.reason)}</p>` : ''}
        <p class="raw"><span class="tag">Kane (raw)</span>${kaneSignalRow(ev.kane)}</p>
        ${c.rationale ? `<p class="rationale"><span class="tag">Why flagged</span>${esc(c.rationale)}</p>` : ''}
        ${files ? `<ul class="files">${files}</ul>` : ''}
      </article>`;
    })
    .join('');

  const uncovered = uncoveredFiles.length
    ? `<section><h2>Changed files with no requirement coverage</h2><ul class="files">${uncoveredFiles
        .map((f) => `<li><code>${esc(f.path)}</code><span class="why">${esc(f.reason)}</span></li>`)
        .join('')}</ul></section>`
    : '';

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Proofline evidence report</title>
<style>
  :root{
    --bg:#f7f7f9; --card:#fff; --ink:#16161a; --dim:#5b5b66; --line:#e3e3e9;
    --good:#0f7b4f; --good-bg:#e6f5ee; --warn:#8a6100; --warn-bg:#fdf3dd;
    --bad:#a32020; --bad-bg:#fceaea; --muted:#5b5b66; --muted-bg:#eeeef2;
  }
  @media (prefers-color-scheme: dark){
    :root{
      --bg:#131317; --card:#1c1c21; --ink:#ececf1; --dim:#a0a0ad; --line:#2e2e37;
      --good:#5fd39b; --good-bg:#12301f; --warn:#e8bf6a; --warn-bg:#332711;
      --bad:#f08b8b; --bad-bg:#331717; --muted:#a0a0ad; --muted-bg:#26262e;
    }
  }
  *{box-sizing:border-box}
  body{margin:0;background:var(--bg);color:var(--ink);
    font:15px/1.55 ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;}
  .wrap{max-width:920px;margin:0 auto;padding:32px 20px 64px}
  h1{font-size:20px;margin:0 0 4px}
  .sub{color:var(--dim);font-size:13px;margin:0 0 24px}
  .verdict{border-radius:12px;padding:20px 22px;margin:0 0 28px;border:1px solid var(--line)}
  .verdict h2{margin:0 0 6px;font-size:26px;letter-spacing:-.01em}
  .verdict p{margin:0;font-size:14px}
  .verdict.good{background:var(--good-bg);border-color:var(--good)}
  .verdict.good h2{color:var(--good)}
  .verdict.warn{background:var(--warn-bg);border-color:var(--warn)}
  .verdict.warn h2{color:var(--warn)}
  .verdict.bad{background:var(--bad-bg);border-color:var(--bad)}
  .verdict.bad h2{color:var(--bad)}
  .verdict.muted{background:var(--muted-bg)}
  h2{font-size:13px;text-transform:uppercase;letter-spacing:.07em;color:var(--dim);margin:28px 0 10px}
  .ac{background:var(--card);border:1px solid var(--line);border-left-width:4px;
    border-radius:10px;padding:14px 16px;margin:0 0 12px}
  .ac.good{border-left-color:var(--good)} .ac.warn{border-left-color:var(--warn)}
  .ac.bad{border-left-color:var(--bad)}   .ac.muted{border-left-color:var(--muted)}
  .ac header{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:8px}
  .ac h3{margin:0;font-size:15px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace}
  .pill{font-size:12px;font-weight:600;padding:3px 9px;border-radius:99px}
  .pill.good{background:var(--good-bg);color:var(--good)}
  .pill.warn{background:var(--warn-bg);color:var(--warn)}
  .pill.bad{background:var(--bad-bg);color:var(--bad)}
  .pill.muted{background:var(--muted-bg);color:var(--muted)}
  .conf{margin-left:auto;font-size:12px;color:var(--dim)}
  .ac p{margin:6px 0;font-size:13.5px}
  .tag{display:inline-block;min-width:92px;font-size:11px;font-weight:700;
    text-transform:uppercase;letter-spacing:.05em;color:var(--dim);vertical-align:top}
  .raw code{background:var(--muted-bg);padding:1px 6px;border-radius:5px;font-size:12px}
  code.flag{color:var(--warn);font-weight:600}
  .rationale{color:var(--dim)}
  .files{list-style:none;margin:8px 0 0;padding:0;border-top:1px solid var(--line);padding-top:8px}
  .files li{font-size:12.5px;padding:2px 0}
  .files code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace}
  .why{color:var(--dim);margin-left:8px}
  .meta{border-top:1px solid var(--line);margin-top:32px;padding-top:14px;
    font-size:12px;color:var(--dim)}
  .meta div{margin:3px 0}
  .meta code{word-break:break-all}
  .muted{color:var(--dim)}
</style>
</head>
<body><div class="wrap">
  <h1>Proofline evidence report</h1>
  <p class="sub">Which product requirements this change puts at risk, and how strong the evidence is that they still hold.</p>

  <div class="verdict ${vTone}">
    <h2>${esc(verdict)}</h2>
    <p>${esc(reason)}</p>
  </div>

  <h2>Affected acceptance criteria (${candidates.length})</h2>
  ${rows || '<p class="muted">No acceptance criteria were mapped to this change.</p>'}

  ${uncovered}

  <div class="meta">
    <div><strong>Repository:</strong> <code>${esc(repoRoot)}</code></div>
    <div><strong>Compared against:</strong> <code>${esc(ref)}</code></div>
    <div><strong>Changed files:</strong> ${changedFiles.length}</div>
    ${evidencePath ? `<div><strong>Kane evidence pack:</strong> <code>${esc(evidencePath)}</code></div>` : ''}
    <div><strong>Generated:</strong> ${esc(new Date().toISOString())}</div>
    <div>Kane executes and produces evidence. Proofline decides which requirements a change threatens and whether that evidence is strong enough to ship on.</div>
  </div>
</div></body>
</html>`;
}

module.exports = { buildReport };
