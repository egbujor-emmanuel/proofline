const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

/**
 * Detects the single most dangerous failure mode this tool has: verifying a
 * RUNNING app that does not contain the code being analyzed.
 *
 * Found in real use. A source file was edited to introduce a regression,
 * Proofline read that regression from disk and correctly identified the
 * criteria at risk -- but the dev server had been started before the edit,
 * so Node was still serving the previous version from memory. Kane tested
 * the old, working code and reported PASS, and Proofline reported the
 * criterion MACHINE VERIFIED. A broken app was declared proven.
 *
 * That is a false assurance of exactly the kind this product exists to
 * prevent, so it is checked before any verification run rather than left to
 * the user to remember.
 *
 * Approach: find the process listening on the app's port, read its start
 * time, and compare against the mtime of every changed source file. Any file
 * newer than the process means the server predates the edit. Best effort by
 * design -- if the port, process, or start time cannot be determined, that
 * is reported as "unknown" rather than guessed at, and the run is allowed to
 * continue with a caveat.
 */

function startUrlFor(repoRoot) {
  const varsFile = path.join(repoRoot, '.testmuai', 'variables', 'global.json');
  try {
    const vars = JSON.parse(fs.readFileSync(varsFile, 'utf-8'));
    const v = vars.start_url;
    return (v && (v.value || v)) || null;
  } catch {
    return null;
  }
}

function portFromUrl(url) {
  if (!url) return null;
  const m = String(url).match(/:(\d{2,5})(?:\/|$)/);
  return m ? Number(m[1]) : null;
}

/** Start time of the process listening on `port`, or null if undeterminable. */
function listenerStartTime(port) {
  if (process.platform !== 'win32') return null;
  const ps = `
    $c = Get-NetTCPConnection -LocalPort ${port} -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($c) {
      $p = Get-Process -Id $c.OwningProcess -ErrorAction SilentlyContinue
      if ($p) { $p.StartTime.ToUniversalTime().ToString("o") }
    }
  `;
  try {
    const out = execFileSync('powershell.exe', ['-NoProfile', '-Command', ps], {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 20000,
    }).trim();
    if (!out) return null;
    const t = new Date(out);
    return isNaN(t.getTime()) ? null : t;
  } catch {
    return null;
  }
}

/**
 * Returns { stale: boolean|null, reason, port, staleFiles }.
 * stale === null means it could not be determined.
 */
function checkAppFreshness(repoRoot, changedFiles) {
  const url = startUrlFor(repoRoot);
  const port = portFromUrl(url);

  if (!port) {
    return { stale: null, port: null, staleFiles: [], reason: 'no start_url with a port found in .testmuai/variables/global.json' };
  }

  const started = listenerStartTime(port);
  if (!started) {
    return { stale: null, port, staleFiles: [], reason: `could not determine the start time of the process listening on port ${port}` };
  }

  const staleFiles = [];
  for (const rel of changedFiles) {
    const abs = path.join(repoRoot, rel);
    try {
      const st = fs.statSync(abs);
      if (st.mtime > started) staleFiles.push(rel);
    } catch {
      // deleted file -- nothing running can be serving it either way
    }
  }

  return {
    stale: staleFiles.length > 0,
    port,
    staleFiles,
    startedAt: started,
    reason: staleFiles.length
      ? `the app on port ${port} started before ${staleFiles.length} of the changed file(s) were last modified`
      : `the app on port ${port} started after the most recent change`,
  };
}

module.exports = { checkAppFreshness };
