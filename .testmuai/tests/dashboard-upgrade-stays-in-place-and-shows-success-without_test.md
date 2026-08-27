---
assurance:
  id: t-2
  base: sha256:f39cb294851d426247fcd5d624dfa80aa4814cbf46351618bb1fb02a118dfaef
---
# Dashboard upgrade stays in place and shows success without payment

> Prove that an eligible Free account can trigger the dashboard upgrade in place, receive same-view success confirmation, and complete the change with no payment-processing step.

## Step 1

Open {{start_url}} in a browser and reach the subscription dashboard.

## Step 2

Call `POST /api/reset` for the running application, reload the dashboard, confirm the current plan is shown as `Free`, and store the current page URL as `baseline_url`.

## Step 3

Prepare the browser network log for the upcoming upgrade action so any new top-level document or navigation request can be distinguished from ordinary in-page requests.

## Step 4

Trigger the `Upgrade to Pro` button on the dashboard and wait for the success confirmation to appear while the dashboard remains visible.

## Step 5

Review the post-upgrade page state: store the current page URL as `post_upgrade_url`, determine whether the action created any new top-level document or navigation request, and determine whether any payment-processing UI or payment step appeared.

## Step 6 — assert @verifies ac-3, ac-4, ac-5

Confirm 'full page navigation away from the dashboard during the upgrade action' does NOT appear (forbidden-presence) — the stated promise: Clicking the "Upgrade to Pro" button triggers the upgrade without a full page navigation.
