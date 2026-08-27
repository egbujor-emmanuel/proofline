const { execFileSync } = require('child_process');

/**
 * Runs kane-cli reliably on Windows.
 *
 * Two real, confirmed-by-testing failure modes had to be worked around here,
 * not assumed:
 *  1. shell:true with an unquoted args array lets Node join arguments with
 *     bare spaces -- any path containing a space (this machine's "Yoma
 *     Maroh" home directory) silently splits into multiple arguments and
 *     the CLI sees garbage.
 *  2. Without shell:true, Windows refuses to spawn a .cmd shim at all
 *     (EINVAL) -- .cmd/.bat files are not directly executable via
 *     CreateProcess, only via cmd.exe.
 * The fix is shell:true with every argument manually double-quoted, so
 * cmd.exe parses spaces correctly instead of Node's naive join.
 */
function kaneExec(args, opts = {}) {
  const cmd = process.platform === 'win32' ? 'kane-cli.cmd' : 'kane-cli';
  const quoted = args.map((a) => `"${String(a).replace(/"/g, '\\"')}"`);
  return execFileSync(cmd, quoted, { encoding: 'utf-8', shell: true, ...opts });
}

module.exports = { kaneExec };
