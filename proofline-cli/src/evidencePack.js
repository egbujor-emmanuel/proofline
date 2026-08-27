const path = require('path');
const { execFileSync } = require('child_process');

/**
 * Reads the real per-test `status:` field out of a sealed .evidence pack
 * (confirmed real format: a zip containing tests/<dir>/result.yaml, where
 * status is one of "passed" | "broken" | presumably "failed" for a genuine
 * assertion failure -- "broken" was confirmed, by direct inspection of a
 * real pack, to be Kane's own signal for "the agent got stuck / couldn't
 * act" (result.yaml's nested run_summary showed reason: "AP determined
 * agent is stuck -- no viable actions remain"), distinct from a completed
 * run whose assertion actually failed.
 *
 * The pack's tests/<dir> name is a TRUNCATED slug of the test title plus an
 * 8-hex-char suffix. Matched by stripping the suffix and checking the
 * file's own slug starts with what remains -- confirmed against a real pack.
 *
 * Implementation note: the Git-Bash/MSYS `unzip` binary on this machine
 * mangles Windows paths (strips separators entirely) when invoked from a
 * cmd.exe context, which is what Node's shell:true uses -- confirmed by
 * direct testing, not assumed. .NET's ZipFile via PowerShell handles native
 * Windows paths correctly, so that's used here instead.
 */
function findResultStatus(evidencePackPath, testFilePath) {
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

  const output = execFileSync('powershell.exe', ['-NoProfile', '-Command', script], { encoding: 'utf-8' });
  const statusMatch = output.match(/^status:\s*(\S+)/m);
  return statusMatch ? statusMatch[1] : null;
}

module.exports = { findResultStatus };
