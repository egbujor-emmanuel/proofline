---
test: ../fresh-fetch-and-reload-show-the-upgraded-pro-plan_test.md
status: passed
started: 2026-08-28T11:24:01.753Z
duration_s: 346
session_id: 7beea6d1-1361-40c1-80b1-7c9caa26a11f
---

# Fresh fetch and reload show the upgraded Pro plan — Result

## Step 1 ✓ passed (24.6s)
md5: 496fa140fd7ad1bd543655183d7fe709
Open {{start_url}} in a browser and reach the subscription dashboard.

## Step 2 ✓ passed (43.3s)
md5: 139a6a111d5a56c65e6d3d96ba9c351a
Send a POST request to the absolute URL `http://localhost:4000/api/reset`, reload the dashboard, and confirm the current plan is shown as `Free`.

## Step 3 ✓ passed (42.7s)
md5: 44375a21a14b3b54a950f28a4094c6cb
capture baseline: displayed dashboard plan value

## Step 4 ✓ passed (39.1s)
md5: e3e72332c21620c336463d7911cc6b9d
Trigger the `Upgrade to Pro` action from the dashboard and wait until the same dashboard view shows the upgrade success confirmation.

## Step 5 ✓ passed (58s)
md5: 1b8fac2936fd1f33b511b1b3e0900f2a
Reload the dashboard page. After the reload finishes, read the displayed current plan value and store it as `fresh_plan`.

## Step 6 ✓ passed (57.6s)
md5: 403881b488fed5a830a075ac34bbdf72
On the reloaded dashboard, store the displayed plan value as `reloaded_plan`.

## Step 7 — assert ✓ passed (54s)
md5: d0fed12063fb8e69b9ec5f684cf21d89
Confirm state-transition check: pro (equals) — the stated promise: After a successful upgrade request, the account's persisted plan changes from `free` to `pro`. To verify this, reload the dashboard page from the server (a full page navigation/refresh, not the current in-page DOM state) and read the displayed plan from that freshly loaded page before asserting. Do not use the DOM state immediately after the upgrade response as evidence of persistence -- the upgrade response itself is not proof the server persisted the change.
