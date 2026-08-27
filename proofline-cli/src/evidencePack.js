const path = require('path');
const { execFileSync } = require('child_process');

/**
 * Reads the real per-test result out of a sealed .evidence pack (confirmed
 * real format via direct inspection: a zip containing tests/<dir>/
 * result.yaml). Returns { status, flaky, adaptiveHealTriggered }.
 *
 * status is one of "passed" | "broken" | "failed":
 *  - "broken" confirmed (via a real pack's nested run_summary) to be Kane's
 *    signal for "the agent got stuck / couldn't act" -- e.g. reason: "AP
 *    determined agent is stuck -- no viable actions remain".
 *  - "failed" confirmed (via a real regression catch) to mean the test
 *    completed and its assertion genuinely failed -- accompanied by a real
 *    Kane bug-detection verdict (family/category/severity), not just a flag.
 *
 * flaky / adaptiveHealTriggered: confirmed via a real pack (the very first
 * regression-detection attempt, before the test was strengthened) that a
 * PASSING run can still carry `flaky: true` and `adaptive_heal: {triggered:
 * true, outcome: healed, attempts: [...]}` -- Kane silently re-authored the
 * failing tail after a replay miss. That run's actual passing assertion
 * turned out to check the wrong thing (optimistic UI state, not persisted
 * state) precisely because of the heal. A clean pass (confirmed via a
 * separate real pack) carries neither field at all -- their absence, not a
 * false value, is what "clean" looks like on disk.
 *
 * The pack's tests/<dir> name is a TRUNCATED slug of the test title plus an
 * 8-hex-char suffix. Matched by stripping the suffix and checking the
 * file's own slug starts with what remains -- confirmed against real packs.
 *
 * Implementation note: the Git-Bash/MSYS `unzip` binary on this machine
 * mangles Windows paths (strips separators entirely) when invoked from a
 * cmd.exe context, which is what Node's shell:true uses -- confirmed by
 * direct testing, not assumed. .NET's ZipFile via PowerShell handles native
 * Windows paths correctly, so that's used here instead.
 */
function findResultDetails(evidencePackPath, testFilePath) {
  const fileSlug = path.basename(testFilePath).replace(/_test\.md$/, '');

  const script = `
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $zip = [System.IO.Compression.ZipFile]::OpenRead('${evidencePackPath.replace(/'/g, "''")}')
    $entry = $zip.Entries | Where-Object { $_.FullName -match '^tests/([^/]+)/result\\.yaml$' } | ForEach-Object {
      $dir = $_.FullName -replace '^tests/([^/]+)/result\\.yaml$', '$1'
      $prefix = $dir -replace '-[0-9a-f]{8}$', ''
      if ('${fileSlug.replace(/'/g, "''")}'.StartsWith($prefix)) { $_ }
    } | Select-Object -First 1
    if ($entry) {
      $reader = New-Object System.IO.StreamReader($entry.Open())
      $content = $reader.ReadToEnd()
      $reader.Close()
      Write-Output $content
    }
    $zip.Dispose()
  `;

  // Deliberately caught, not thrown: a pack-reading failure (PowerShell
  // unavailable, corrupt zip, unreadable path, non-Windows host) must not
  // crash the whole run. evidenceStrength.js already treats status: null as
  // "can't confirm agent-misstep or product-bug" and conservatively falls
  // back to test_failure_unclassified -- the correct behavior here too,
  // rather than a raw stack trace three modules away from where it happened.
  let output;
  try {
    output = execFileSync('powershell.exe', ['-NoProfile', '-Command', script], { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] });
  } catch (err) {
    return {
      status: null,
      flaky: false,
      adaptiveHealTriggered: false,
      error: `Could not read evidence pack "${evidencePackPath}": ${err.message}. This implementation reads .evidence packs via PowerShell + .NET ZipFile and currently requires Windows.`,
    };
  }

  const statusMatch = output.match(/^status:\s*(\S+)/m);
  const flakyMatch = output.match(/^flaky:\s*(\S+)/m);
  const adaptiveHealMatch = output.match(/^adaptive_heal:\s*\n\s+triggered:\s*(\S+)/m);

  if (!statusMatch) {
    return {
      status: null,
      flaky: false,
      adaptiveHealTriggered: false,
      error: `Evidence pack read but no matching tests/<dir>/result.yaml entry was found for test file "${testFilePath}" (looked for a directory name starting with its slug, "${fileSlug}"). The pack may use a different naming convention than the one confirmed against real packs so far.`,
      raw: output,
    };
  }

  return {
    status: statusMatch[1],
    flaky: flakyMatch ? flakyMatch[1] === 'true' : false,
    adaptiveHealTriggered: adaptiveHealMatch ? adaptiveHealMatch[1] === 'true' : false,
    raw: output,
  };
}

module.exports = { findResultDetails };
