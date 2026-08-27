const { execFileSync } = require('child_process');
const path = require('path');

function run(args, cwd) {
  return execFileSync('git', args, { cwd, encoding: 'utf-8' });
}

/**
 * Returns changed file paths (relative to repo root, forward-slash) between
 * `ref` and the working tree, including uncommitted and staged changes.
 */
function changedFiles(cwd, ref = 'HEAD') {
  const tracked = run(['diff', '--name-only', ref], cwd).trim();
  const untracked = run(['ls-files', '--others', '--exclude-standard'], cwd).trim();
  const files = new Set();
  for (const line of tracked.split('\n')) {
    if (line) files.add(line.trim());
  }
  for (const line of untracked.split('\n')) {
    if (line) files.add(line.trim());
  }
  return [...files].map((f) => f.split(path.sep).join('/'));
}

function diffText(cwd, ref = 'HEAD') {
  return run(['diff', ref], cwd);
}

module.exports = { changedFiles, diffText };
