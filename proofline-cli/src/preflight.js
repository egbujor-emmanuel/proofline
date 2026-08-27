const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

/**
 * Checks the things Proofline actually depends on before doing any real
 * work, so a misconfigured target repo fails with one clear sentence
 * instead of a raw stack trace three modules deep. Returns an array of
 * problem strings; empty means everything needed is present.
 */
function checkEnvironment(repoRoot) {
  const problems = [];

  try {
    execFileSync('git', ['rev-parse', '--is-inside-work-tree'], { cwd: repoRoot, encoding: 'utf-8', stdio: 'pipe' });
  } catch {
    problems.push(`"${repoRoot}" is not inside a git repository (or git is not on PATH). Proofline needs git to detect changed files.`);
  }

  try {
    execFileSync('kane-cli.cmd', ['--version'], { encoding: 'utf-8', stdio: 'pipe', shell: process.platform === 'win32' });
  } catch {
    try {
      execFileSync('kane-cli', ['--version'], { encoding: 'utf-8', stdio: 'pipe' });
    } catch {
      problems.push('kane-cli is not on PATH or failed to run. Install it with "npm install -g @testmuai/kane-cli" and confirm "kane-cli whoami" works.');
    }
  }

  if (!fs.existsSync(path.join(repoRoot, '.context'))) {
    problems.push(
      `No .context/ directory found under "${repoRoot}". Proofline needs this project's requirements already ingested into Kane's assurance graph -- run "kane-cli context ingest <prd.md>" and "kane-cli design tests --use-case <uc-id>" first.`
    );
  }

  const testsDir = path.join(repoRoot, '.testmuai', 'tests');
  if (!fs.existsSync(testsDir) || fs.readdirSync(testsDir).filter((f) => f.endsWith('_test.md')).length === 0) {
    problems.push(
      `No *_test.md files found under "${path.join('.testmuai', 'tests')}". Proofline needs at least one live Kane test with an @verifies marker to resolve AC coverage against.`
    );
  }

  return problems;
}

module.exports = { checkEnvironment };
