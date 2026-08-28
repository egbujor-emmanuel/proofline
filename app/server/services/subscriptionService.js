const { readAccount, writeAccount } = require('../db/store');

const PRO_FEATURE_CONTENT = {
  title: 'Advanced Reports',
  body: 'Your Pro usage report for this month: 128 sessions, 42 exports.',
};

function getAccount() {
  return readAccount();
}

function isPro() {
  return readAccount().plan === 'pro';
}

function upgradeToPro() {
  const account = readAccount();
  const upgraded = { ...account, plan: 'pro' };
  return upgraded;
}

function resetToFree() {
  const account = readAccount();
  account.plan = 'free';
  return writeAccount(account);
}

function getProFeatureContent() {
  return PRO_FEATURE_CONTENT;
}

module.exports = {
  getAccount,
  isPro,
  upgradeToPro,
  resetToFree,
  getProFeatureContent,
};
