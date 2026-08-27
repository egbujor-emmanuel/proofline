---
assurance:
  id: t-1
  base: sha256:a3f148f12097942a583832fb614bd615f79273b55399bf3c296af18aabadb478
---
# Fresh fetch and reload show the upgraded Pro plan

> Prove that after a successful dashboard upgrade, a new account read and a page reload both reflect the persisted `pro` plan rather than stale client state.

## Step 1

Open {{start_url}} in a browser and reach the subscription dashboard.

## Step 2

Send a POST request to the absolute URL `http://localhost:4000/api/reset`, reload the dashboard, and confirm the current plan is shown as `Free`.

## Step 3

capture baseline: displayed dashboard plan value

## Step 4

Trigger the `Upgrade to Pro` action from the dashboard and wait until the same dashboard view shows the upgrade success confirmation.

## Step 5

Reload the dashboard page. After the reload finishes, read the displayed current plan value and store it as `fresh_plan`.

## Step 6

On the reloaded dashboard, store the displayed plan value as `reloaded_plan`.

## Step 7 — assert @verifies ac-1, ac-2, ac-6

Confirm state-transition check: pro (equals) — the stated promise: After a successful upgrade request, the account's persisted plan changes from `free` to `pro`. To verify this, reload the dashboard page from the server (a full page navigation/refresh, not the current in-page DOM state) and read the displayed plan from that freshly loaded page before asserting. Do not use the DOM state immediately after the upgrade response as evidence of persistence -- the upgrade response itself is not proof the server persisted the change.
