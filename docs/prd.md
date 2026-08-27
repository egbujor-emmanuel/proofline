# Product Requirements — Subscription Dashboard

## Overview

A small subscription-management web application. A user account has a plan,
either `free` or `pro`. Free accounts can upgrade to Pro. Pro accounts get
access to a Pro-only feature that Free accounts cannot use. The dashboard
must always reflect the account's true, persisted plan.

This is a real, running application — not a mock. All state changes are
persisted on the server and survive a page reload.

## R-01 — Subscription Upgrade

A Free account can upgrade to Pro, and the upgrade is permanently recorded.

- **AC-01.1**: After a successful upgrade request, the account's persisted
  plan equals `pro`. Querying the account after the request (a fresh fetch,
  not a cached value) confirms this.
- **AC-01.2**: Clicking the "Upgrade to Pro" button on the dashboard triggers
  the upgrade without a full page navigation, and the button's success
  confirmation appears in the same view.

## R-02 — Subscription State on Dashboard

The dashboard always displays the account's true current plan.

- **AC-02.1**: On page load, the dashboard displays the plan value currently
  persisted on the server ("Free" or "Pro") — not a hardcoded or stale
  default.
- **AC-02.2**: After an upgrade completes and the user returns to (or
  reloads) the dashboard, the plan indicator shows "Pro". The dashboard must
  not continue showing "Free" once the account has been upgraded.

## R-03 — Pro Feature Access

Pro accounts can access the Pro-only feature ("Advanced Reports").

- **AC-03.1**: When the account's plan is `pro`, the "Advanced Reports"
  section is visible and its content loads successfully on the dashboard.
- **AC-03.2**: Requesting the Pro-only API endpoint directly while the
  account's plan is `pro` returns a successful (200) response containing the
  feature's content.

## R-04 — Free User Restrictions

Free accounts cannot access the Pro-only feature.

- **AC-04.1**: When the account's plan is `free`, the "Advanced Reports"
  section is not accessible from the dashboard — it is replaced by an
  upgrade prompt, not the feature content.
- **AC-04.2**: Requesting the Pro-only API endpoint directly while the
  account's plan is `free` returns a rejected (403) response, not the
  feature's content.

## Out of scope

Real payment processing, authentication/OAuth, multi-user accounts, teams,
and billing infrastructure are explicitly out of scope for this
application. Upgrade is a direct state change with no payment step.

## Development & testing utility

A reset endpoint (`POST /api/reset`) returns the account to `free` so the
upgrade flow can be demonstrated repeatedly. This is test infrastructure,
not a user-facing product promise, and is not covered by an acceptance
criterion above.
