const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, 'data.json');
const DEFAULT_ACCOUNT = { plan: 'free' };

function ensureDataFile() {
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(DEFAULT_ACCOUNT, null, 2));
  }
}

function readAccount() {
  ensureDataFile();
  const raw = fs.readFileSync(DATA_FILE, 'utf-8');
  return JSON.parse(raw);
}

function writeAccount(account) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(account, null, 2));
  return account;
}

module.exports = { readAccount, writeAccount };
