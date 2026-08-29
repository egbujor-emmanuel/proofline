#!/usr/bin/env node
// Introduces the real persistence regression: upgradeToPro() stops calling
// writeAccount(), so POST /api/upgrade still answers {"plan":"pro"} while
// the account on disk stays "free".
const fs = require('fs');
const path = require('path');
const { swap, GOOD, BROKEN } = require('./patch');

/**
 * Reset the stored account to "free" first.
 *
 * Without this the regression is invisible: if an earlier successful upgrade
 * already persisted "pro", then reloading still shows Pro -- correctly, since
 * the account really is Pro -- and it looks like the bug failed to apply.
 * Confirmed in practice, mid-rehearsal.
 */
function resetAccountToFree() {
  const dataFile = path.resolve(__dirname, '..', 'app', 'server', 'db', 'data.json');
  try {
    fs.writeFileSync(dataFile, JSON.stringify({ plan: 'free' }, null, 2));
    return true;
  } catch {
    return false;
  }
}

if (swap(GOOD, BROKEN, 'Already broken - upgrade does not persist.') === 'changed') {
  console.log('Regression introduced: upgradeToPro() no longer persists the plan.');
  if (resetAccountToFree()) {
    console.log('Account reset to Free, so the bug is visible on the next upgrade.');
  }
  console.log('The app server picks this up automatically if you started it with: npm run dev');
} else {
  // Already broken -- still reset, so a rerun demonstrates cleanly.
  if (resetAccountToFree()) console.log('Account reset to Free.');
}
