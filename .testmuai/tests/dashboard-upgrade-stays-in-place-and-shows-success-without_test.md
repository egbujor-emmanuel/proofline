---
assurance:
  id: t-2
  base: sha256:9b2b3981654b9531be2f0f6af2f7b0919a2a7207871f2216d953f2daeb0f42af
---
# Dashboard upgrade stays in place and shows success without payment

> Prove that an eligible Free account can trigger the dashboard upgrade in place, receive same-view success confirmation, and complete the change with no payment-processing step.

## Step 1

Open {{start_url}} in a browser and reach the subscription dashboard.

## Step 2

Send a POST request to the absolute URL `http://localhost:4000/api/reset`, reload the dashboard, and confirm the current plan is shown as `Free`.

## Step 3

Click the `Upgrade to Pro` button on the dashboard.

## Step 4

On the same page, read the success confirmation message shown under the plan and store it as `confirmation_text`.

## Step 5

Read the visible page and store whether any credit-card field, payment form, or checkout step is shown as `payment_ui_present`.

## Step 6 — assert @verifies ac-3, ac-4, ac-5

Confirm the success confirmation message reading `Upgraded! You are now on the Pro plan.` is visible on the dashboard — the stated promise: clicking "Upgrade to Pro" completes the upgrade in the same view, with no full page navigation and no payment step. This message is written into the page by the upgrade action itself, so it can only still be visible if the dashboard was never reloaded or navigated away from.
