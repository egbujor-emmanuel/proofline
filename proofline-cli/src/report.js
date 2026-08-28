const { STATES } = require('./evidenceStrength');
const { decide } = require('./verdict');

/**
 * Writes a self-contained, shareable HTML evidence report -- the artifact a
 * developer attaches to a PR or keeps as an audit record. Terminal output
 * disappears into scrollback; a proof that cannot be shared or archived
 * undercuts the whole point of carrying a requirement to a ship decision.
 *
 * The layout is a ledger, and that is deliberate: every entry states the
 * PROMISE first (the acceptance criterion in the words the requirements
 * actually use), then sets Kane's raw observation beside Proofline's
 * judgment. That pairing is the product -- a reader must be able to see
 * "Kane reported passed, Proofline still will not call it proven, and here
 * is exactly why" rather than being handed one opaque verdict.
 *
 * Entries are ordered by the mapper's own ranking, so the criterion most at
 * risk from this change reads first. No external assets, no network calls,
 * no scripts -- the file opens anywhere, offline, years from now.
 */

const TONE = {
  [STATES.MACHINE_VERIFIED_CLEAN]: 'proven',
  [STATES.MACHINE_VERIFIED_HEALED]: 'caution',
  [STATES.TEST_LINKED_ONLY]: 'caution',
  [STATES.AGENT_MISSTEP]: 'caution',
  [STATES.TEST_FAILURE_UNCLASSIFIED]: 'caution',
  [STATES.NOT_VERIFIED]: 'broken',
  [STATES.PRODUCT_BUG]: 'broken',
  [STATES.UNAFFECTED]: 'neutral',
};

const LABEL = {
  [STATES.MACHINE_VERIFIED_CLEAN]: 'Proven',
  [STATES.MACHINE_VERIFIED_HEALED]: 'Proven on a healed run',
  [STATES.TEST_LINKED_ONLY]: 'Not independently asserted',
  [STATES.NOT_VERIFIED]: 'No evidence',
  [STATES.PRODUCT_BUG]: 'Requirement broken',
  [STATES.AGENT_MISSTEP]: 'Verification incomplete',
  [STATES.TEST_FAILURE_UNCLASSIFIED]: 'Unclassified failure',
  [STATES.UNAFFECTED]: 'Unaffected',
};

const VERDICT_TONE = { SHIP: 'proven', BLOCK: 'broken', 'REVIEW REQUIRED': 'caution' };

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function kaneObservation(kane) {
  if (!kane) return '<span class="none">no Kane execution for this criterion</span>';
  const flags = [];
  if (kane.flaky) flags.push('<span class="flag">flaky</span>');
  if (kane.adaptiveHealTriggered) flags.push('<span class="flag">adaptive&nbsp;heal</span>');
  return `<code class="status status-${esc(kane.status || 'unknown')}">${esc(kane.status || 'unreadable')}</code>${flags.join('')}`;
}

function buildReport({ repoRoot, ref, changedFiles, uncoveredFiles, candidates, evidenceByAc, evidencePath, dryRun, allAcs }) {
  const { verdict, reason } = dryRun
    ? { verdict: 'Not yet verified', reason: 'Mapping only — no Kane execution was performed for this report.' }
    : decide(evidenceByAc);
  const vTone = dryRun ? 'neutral' : VERDICT_TONE[verdict] || 'neutral';

  const acText = new Map((allAcs || []).map((a) => [a.id, a.text || '']));

  const entries = candidates
    .map((c) => {
      const ev = evidenceByAc[c.ac] || {};
      const tone = ev.state ? TONE[ev.state] || 'neutral' : 'neutral';
      const label = ev.state ? LABEL[ev.state] : 'Pending verification';
      const promise = acText.get(c.ac);
      const files = (c.files || [])
        .map((f) => `<li><code>${esc(f.path)}</code><span class="note">${esc(f.reason)}</span></li>`)
        .join('');

      return `
      <article class="entry ${tone}">
        <div class="entry-head">
          <span class="acid">${esc(c.ac)}</span>
          <span class="badge ${tone}">${esc(label)}</span>
          <span class="risk">at risk: <b>${esc(c.confidence || 'n/a')}</b>${c.llm_only ? ' <span class="note">model-identified</span>' : ''}</span>
        </div>

        ${promise ? `<p class="promise">${esc(promise)}</p>` : ''}

        <div class="cols">
          <div class="col">
            <h4>Kane observed</h4>
            <p>${kaneObservation(ev.kane)}</p>
          </div>
          <div class="col">
            <h4>Proofline concludes</h4>
            <p>${ev.reason ? esc(ev.reason) : '<span class="none">not yet evaluated</span>'}</p>
          </div>
        </div>

        ${c.rationale ? `<p class="rationale"><span class="k">Flagged because</span> ${esc(c.rationale)}</p>` : ''}
        ${files ? `<ul class="files">${files}</ul>` : ''}
      </article>`;
    })
    .join('');

  const uncovered = uncoveredFiles && uncoveredFiles.length
    ? `<section>
         <h2>Changed with no requirement coverage</h2>
         <ul class="files bare">${uncoveredFiles
           .map((f) => `<li><code>${esc(f.path)}</code><span class="note">${esc(f.reason)}</span></li>`)
           .join('')}</ul>
       </section>`
    : '';

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Proofline evidence report</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Serif:wght@500;600&display=swap">
<style>
  /* Light is the base palette. Dark is redefined twice on purpose: once for
     viewers on system-dark (who carry no data-theme stamp), guarded so an
     explicit light choice beats a dark OS, and once for an explicit
     data-theme="dark". Every colour lives in a token -- a colour declared
     only inside a media or [data-theme] block would never apply in the
     unstamped state, which is the classic unreadable-report bug. */
  :root{
    --bg:#eef1f5; --card:#ffffff; --ink:#10131a; --dim:#5a6273; --faint:#8a92a3;
    --line:#dde2ea; --rule:#c9d1dd;
    --accent:#2c4a7c;
    --proven:#0f6b47; --proven-bg:#e4f2ec; --proven-line:#9ccdb7;
    --caution:#8a5a00; --caution-bg:#fbf0da; --caution-line:#e0c48a;
    --broken:#a32a24; --broken-bg:#fbe9e7; --broken-line:#e3aaa5;
    --neutral:#5a6273; --neutral-bg:#e8ecf2; --neutral-line:#c9d1dd;
  }
  @media (prefers-color-scheme: dark){
    :root:not([data-theme="light"]){
      --bg:#0e1116; --card:#161a21; --ink:#e6e9ef; --dim:#9aa3b2; --faint:#6d7686;
      --line:#242a34; --rule:#333b47;
      --accent:#8fb0e0;
      --proven:#5fc79a; --proven-bg:#102a20; --proven-line:#265c45;
      --caution:#e2b264; --caution-bg:#2b2110; --caution-line:#5e4a1f;
      --broken:#ef8f88; --broken-bg:#2c1614; --broken-line:#63302c;
      --neutral:#9aa3b2; --neutral-bg:#1d222a; --neutral-line:#333b47;
    }
  }
  :root[data-theme="dark"]{
    --bg:#0e1116; --card:#161a21; --ink:#e6e9ef; --dim:#9aa3b2; --faint:#6d7686;
    --line:#242a34; --rule:#333b47;
    --accent:#8fb0e0;
    --proven:#5fc79a; --proven-bg:#102a20; --proven-line:#265c45;
    --caution:#e2b264; --caution-bg:#2b2110; --caution-line:#5e4a1f;
    --broken:#ef8f88; --broken-bg:#2c1614; --broken-line:#63302c;
    --neutral:#9aa3b2; --neutral-bg:#1d222a; --neutral-line:#333b47;
  }

  *{box-sizing:border-box}
  html{-webkit-text-size-adjust:100%}
  body{
    margin:0; background:var(--bg); color:var(--ink);
    font-family:"IBM Plex Sans",ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;
    font-size:15px; line-height:1.6;
  }
  .sheet{max-width:860px; margin:0 auto; padding:40px 22px 72px}

  .masthead{display:flex; align-items:baseline; gap:12px; flex-wrap:wrap;
    padding-bottom:14px; border-bottom:2px solid var(--rule); margin-bottom:26px}
  .masthead h1{
    font-family:"IBM Plex Serif",Georgia,serif; font-weight:600;
    font-size:21px; letter-spacing:-.01em; margin:0;
  }
  .masthead .strap{color:var(--dim); font-size:13px; margin:0}

  .verdict{
    border:1px solid var(--rule); border-left:5px solid var(--neutral);
    background:var(--card); border-radius:3px; padding:20px 22px; margin-bottom:34px;
  }
  .verdict .vlabel{
    font-family:"IBM Plex Mono",ui-monospace,monospace; font-size:11px;
    text-transform:uppercase; letter-spacing:.14em; color:var(--faint); margin:0 0 6px;
  }
  .verdict h2{
    font-family:"IBM Plex Serif",Georgia,serif; font-weight:600;
    font-size:30px; line-height:1.15; margin:0 0 8px; letter-spacing:-.02em;
    text-wrap:balance;
  }
  .verdict p{margin:0; font-size:14px; color:var(--dim); max-width:62ch}
  .verdict.proven{border-left-color:var(--proven)}  .verdict.proven h2{color:var(--proven)}
  .verdict.caution{border-left-color:var(--caution)} .verdict.caution h2{color:var(--caution)}
  .verdict.broken{border-left-color:var(--broken)}   .verdict.broken h2{color:var(--broken)}

  h2{
    font-family:"IBM Plex Mono",ui-monospace,monospace; font-size:11px;
    text-transform:uppercase; letter-spacing:.14em; color:var(--faint);
    margin:34px 0 12px; font-weight:500;
  }

  .entry{
    background:var(--card); border:1px solid var(--line);
    border-left:4px solid var(--neutral-line);
    border-radius:3px; padding:16px 18px; margin-bottom:10px;
  }
  .entry.proven{border-left-color:var(--proven)}
  .entry.caution{border-left-color:var(--caution)}
  .entry.broken{border-left-color:var(--broken)}

  .entry-head{display:flex; align-items:center; gap:10px; flex-wrap:wrap; margin-bottom:10px}
  .acid{
    font-family:"IBM Plex Mono",ui-monospace,monospace; font-weight:500;
    font-size:13px; letter-spacing:.04em; text-transform:uppercase; color:var(--accent);
  }
  .badge{
    font-size:11.5px; font-weight:600; padding:3px 10px; border-radius:2px;
    border:1px solid transparent;
  }
  .badge.proven{background:var(--proven-bg); color:var(--proven); border-color:var(--proven-line)}
  .badge.caution{background:var(--caution-bg); color:var(--caution); border-color:var(--caution-line)}
  .badge.broken{background:var(--broken-bg); color:var(--broken); border-color:var(--broken-line)}
  .badge.neutral{background:var(--neutral-bg); color:var(--neutral); border-color:var(--neutral-line)}
  .risk{
    margin-left:auto; font-family:"IBM Plex Mono",ui-monospace,monospace;
    font-size:11px; color:var(--faint); font-variant-numeric:tabular-nums;
  }
  .risk b{color:var(--dim); font-weight:500}

  .promise{
    font-family:"IBM Plex Serif",Georgia,serif; font-size:15.5px; line-height:1.5;
    margin:0 0 14px; padding-left:14px; border-left:2px solid var(--line);
    color:var(--ink); max-width:64ch;
  }

  .cols{display:grid; grid-template-columns:1fr 1fr; gap:18px; margin-bottom:4px}
  @media (max-width:620px){ .cols{grid-template-columns:1fr; gap:12px} }
  .col h4{
    font-family:"IBM Plex Mono",ui-monospace,monospace; font-size:10.5px; font-weight:500;
    text-transform:uppercase; letter-spacing:.12em; color:var(--faint);
    margin:0 0 5px; padding-bottom:5px; border-bottom:1px solid var(--line);
  }
  .col p{margin:0; font-size:13px; color:var(--dim); line-height:1.55}

  .status{
    font-family:"IBM Plex Mono",ui-monospace,monospace; font-size:12px;
    padding:2px 8px; border-radius:2px; background:var(--neutral-bg); color:var(--ink);
  }
  .status-passed{background:var(--proven-bg); color:var(--proven)}
  .status-failed{background:var(--broken-bg); color:var(--broken)}
  .status-broken{background:var(--caution-bg); color:var(--caution)}
  .flag{
    display:inline-block; margin-left:6px; font-family:"IBM Plex Mono",ui-monospace,monospace;
    font-size:10.5px; text-transform:uppercase; letter-spacing:.08em;
    color:var(--caution); border:1px solid var(--caution-line);
    background:var(--caution-bg); padding:1px 6px; border-radius:2px;
  }
  .none{color:var(--faint); font-style:italic}

  .rationale{
    margin:12px 0 0; padding-top:10px; border-top:1px solid var(--line);
    font-size:12.5px; color:var(--dim);
  }
  .rationale .k{
    font-family:"IBM Plex Mono",ui-monospace,monospace; font-size:10.5px;
    text-transform:uppercase; letter-spacing:.1em; color:var(--faint); margin-right:6px;
  }

  .files{list-style:none; margin:10px 0 0; padding:10px 0 0; border-top:1px solid var(--line)}
  .files.bare{border:0; padding-top:0; margin-top:0}
  .files li{font-size:12.5px; padding:3px 0; display:flex; gap:10px; flex-wrap:wrap; align-items:baseline}
  .files code{font-family:"IBM Plex Mono",ui-monospace,monospace; font-size:12px; color:var(--ink)}
  .note{color:var(--faint); font-size:11.5px}

  .colophon{
    margin-top:40px; padding-top:16px; border-top:2px solid var(--rule);
    font-size:12px; color:var(--faint);
  }
  .colophon dl{display:grid; grid-template-columns:auto 1fr; gap:4px 16px; margin:0 0 14px}
  .colophon dt{
    font-family:"IBM Plex Mono",ui-monospace,monospace; font-size:10.5px;
    text-transform:uppercase; letter-spacing:.1em;
  }
  .colophon dd{margin:0; font-family:"IBM Plex Mono",ui-monospace,monospace;
    font-size:11.5px; color:var(--dim); word-break:break-all}
  .colophon .thesis{margin:0; max-width:64ch; font-size:12.5px; line-height:1.6}
</style>
</head>
<body>
<div class="sheet">

  <header class="masthead">
    <h1>Proofline</h1>
    <p class="strap">evidence report</p>
  </header>

  <div class="verdict ${vTone}">
    <p class="vlabel">Ship decision</p>
    <h2>${esc(verdict)}</h2>
    <p>${esc(reason)}</p>
  </div>

  <h2>Requirements at risk from this change &mdash; ${candidates.length}</h2>
  ${entries || '<p class="none">No acceptance criteria were mapped to this change.</p>'}

  ${uncovered}

  <div class="colophon">
    <dl>
      <dt>Repository</dt><dd>${esc(repoRoot)}</dd>
      <dt>Compared to</dt><dd>${esc(ref)}</dd>
      <dt>Files changed</dt><dd>${changedFiles.length}</dd>
      ${evidencePath ? `<dt>Evidence pack</dt><dd>${esc(evidencePath)}</dd>` : ''}
      <dt>Generated</dt><dd>${esc(new Date().toISOString())}</dd>
    </dl>
    <p class="thesis">Kane executes the tests and produces the evidence. Proofline decides which
    requirements a code change puts at risk, and whether that evidence is strong enough to ship on.
    Where the two disagree, both are shown above rather than reconciled into a single number.</p>
  </div>

</div>
</body>
</html>`;
}

module.exports = { buildReport };
