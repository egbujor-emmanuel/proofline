#!/usr/bin/env node
// Restores correct persistence - the fix Kane's evidence points to.
const { swap, GOOD, BROKEN } = require('./patch');

if (swap(BROKEN, GOOD, 'Already correct - upgrade persists.') === 'changed') {
  console.log('Fixed: upgradeToPro() persists via writeAccount() again.');
  console.log('The app server picks this up automatically if you started it with: npm run dev');
}
