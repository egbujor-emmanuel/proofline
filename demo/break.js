#!/usr/bin/env node
// Introduces the real persistence regression: upgradeToPro() stops calling
// writeAccount(), so POST /api/upgrade still answers {"plan":"pro"} while
// the account on disk stays "free".
const { swap, GOOD, BROKEN } = require('./patch');

if (swap(GOOD, BROKEN, 'Already broken - upgrade does not persist.') === 'changed') {
  console.log('Regression introduced: upgradeToPro() no longer persists the plan.');
  console.log('The app server picks this up automatically if you started it with: npm run dev');
}
