# Proofline

TestMu AI Kane CLI hackathon entry. This repo currently contains the real
application Kane will verify, and its product requirements. Proofline's own
tooling (the diff -> affected-AC mapper and the release-decision layer) is
built in a later phase, on top of this baseline.

## Structure

- `docs/prd.md` — product requirements for the subscription app (R-01..R-04,
  with acceptance criteria), used as the source document for Kane's
  assurance context graph.
- `app/` — the real subscription-management application Kane verifies.

## Running the app

```
cd app
npm install
npm start
```

Then open http://localhost:4000.

## Persistence / reset

Account state is stored in `app/server/db/data.json` (created automatically,
gitignored). Use the "Reset to Free (dev/testing)" button on the dashboard,
or `POST http://localhost:4000/api/reset`, to return the account to `free`
so the upgrade flow can be demonstrated repeatedly.

## Primary flow

1. Load the dashboard — plan shows "Free", Advanced Reports section shows an
   upgrade prompt.
2. Click "Upgrade to Pro" — plan updates to "Pro" without a page reload.
3. Advanced Reports section now shows real content.
4. Reload the page — plan still shows "Pro" (persisted server-side, not
   client state).
