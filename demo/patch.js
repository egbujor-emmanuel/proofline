// Shared apply/revert logic for the demo regression.
//
// Line endings are normalised before matching and the file's original style
// is restored on write. Git converts this file to CRLF on checkout under the
// default autocrlf setting on Windows, while these patterns are written with
// LF -- so a naive string compare fails with "could not find the expected
// body" even though the code is exactly right. That happened in real use.

const fs = require('fs');
const path = require('path');

const FILE = path.resolve(__dirname, '..', 'app', 'server', 'services', 'subscriptionService.js');

const GOOD = `function upgradeToPro() {
  const account = readAccount();
  account.plan = 'pro';
  return writeAccount(account);
}`;

const BROKEN = `function upgradeToPro() {
  const account = readAccount();
  const upgraded = { ...account, plan: 'pro' };
  return upgraded;
}`;

/** Applies `to`, expecting `from`. Returns 'changed' | 'already' | throws. */
function swap(from, to, alreadyMsg) {
  const raw = fs.readFileSync(FILE, 'utf-8');
  const usedCrlf = raw.includes('\r\n');
  const norm = raw.replace(/\r\n/g, '\n');

  if (norm.includes(to)) {
    console.log(alreadyMsg);
    return 'already';
  }
  if (!norm.includes(from)) {
    console.error('Could not find the expected upgradeToPro() body in:');
    console.error(`  ${FILE}`);
    console.error('Aborting rather than guessing. Restore it with:');
    console.error('  git -C "' + path.resolve(__dirname, '..') + '" checkout -- app/');
    process.exit(1);
  }

  const out = norm.replace(from, to);
  fs.writeFileSync(FILE, usedCrlf ? out.replace(/\n/g, '\r\n') : out);
  return 'changed';
}

module.exports = { swap, GOOD, BROKEN };
