#!/usr/bin/env node
// Restores correct persistence - the fix Kane's evidence points to.
const fs = require('fs');
const path = require('path');

const file = path.resolve(__dirname, '..', 'app', 'server', 'services', 'subscriptionService.js');
const good = `function upgradeToPro() {
  const account = readAccount();
  account.plan = 'pro';
  return writeAccount(account);
}`;
const broken = `function upgradeToPro() {
  const account = readAccount();
  const upgraded = { ...account, plan: 'pro' };
  return upgraded;
}`;

const src = fs.readFileSync(file, 'utf-8');
if (src.includes(good)) {
  console.log('Already correct - upgrade persists.');
  process.exit(0);
}
if (!src.includes(broken)) {
  console.error('Could not find the expected broken body. Aborting rather than guessing.');
  process.exit(1);
}
fs.writeFileSync(file, src.replace(broken, good));
console.log('Fixed: upgradeToPro() persists via writeAccount() again.');
console.log('The app server picks this up automatically if you started it with: npm run dev');
