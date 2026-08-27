const planValueEl = document.getElementById('plan-value');
const upgradeBtn = document.getElementById('upgrade-btn');
const upgradeMessageEl = document.getElementById('upgrade-message');
const proFeatureContentEl = document.getElementById('pro-feature-content');
const resetBtn = document.getElementById('reset-btn');

function renderPlan(plan) {
  planValueEl.textContent = plan === 'pro' ? 'Pro' : 'Free';
  planValueEl.className = 'plan-badge ' + (plan === 'pro' ? 'plan-pro' : 'plan-free');
  upgradeBtn.style.display = plan === 'pro' ? 'none' : 'inline-block';
}

async function loadProFeature() {
  const res = await fetch('/api/pro-feature');
  if (res.status === 403) {
    proFeatureContentEl.textContent = 'Upgrade to Pro to unlock Advanced Reports.';
    return;
  }
  const data = await res.json();
  proFeatureContentEl.textContent = data.body;
}

async function loadAccount() {
  const res = await fetch('/api/account');
  const account = await res.json();
  renderPlan(account.plan);
  await loadProFeature();
}

upgradeBtn.addEventListener('click', async () => {
  upgradeBtn.disabled = true;
  const res = await fetch('/api/upgrade', { method: 'POST' });
  const account = await res.json();
  renderPlan(account.plan);
  upgradeMessageEl.textContent = 'Upgraded! You are now on the Pro plan.';
  await loadProFeature();
  upgradeBtn.disabled = false;
});

resetBtn.addEventListener('click', async () => {
  await fetch('/api/reset', { method: 'POST' });
  upgradeMessageEl.textContent = '';
  await loadAccount();
});

loadAccount();
