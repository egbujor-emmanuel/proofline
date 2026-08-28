#!/usr/bin/env node
// Introduces the real persistence regression into the app under test.
// upgradeToPro() stops calling writeAccount(), so POST /api/upgrade still
// answers {"plan":"pro"} while the account on disk stays "free".
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
if (src.includes(broken)) {
  console.log('Already broken - upgrade does not persist.');
  process.exit(0);
}
if (!src.includes(good)) {
  console.error('Could not find the expected upgradeToPro() body. Aborting rather than guessing.');
  process.exit(1);
}
fs.writeFileSync(file, src.replace(good, broken));
console.log('Regression introduced: upgradeToPro() no longer persists the plan.');
console.log('Restart the app server so it picks up the change.');
