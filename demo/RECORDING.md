# Recording the demo

Every timing below was measured on this machine, not estimated.

## The hard constraint

A full verified Proofline run takes **2–5 minutes** of real time, because
Kane drives a real browser. The two runs the demo needs total **6–10
minutes**. The submission cap is **3 minutes**.

So: **record the real runs, then compress the waiting in editing.** Put a
small `8×` label on screen while a run is spinning. That is standard for
tool demos and stays honest — the runs are real, only the dead air is cut.
Do not fake output.

Measured timings:

| Step | Real time |
|---|---|
| `demo/break.js` + restart server | ~5s |
| Proofline run that finds the bug → **BLOCK** | **4m 39s** |
| `demo/fix.js` + restart server | ~5s |
| First run after the fix (Kane re-authors → `HEALED`) | 7m 52s |
| Next run (settles clean → `MACHINE VERIFIED`) | 1m 51s |
| `--dry-run` (mapping only, no Kane) | 28s |

## Warm up before you record

The first run after a failure is the slow one, because Kane re-authors the
test it had to heal. Get that out of the way **before** recording:

```bash
cd proofline
node demo/fix.js                      # ensure the app is correct
cd app && npm start                   # leave running in its own terminal

# in a second terminal — run twice, discard both
cd proofline-cli
node bin/proofline.js --repo ..
node bin/proofline.js --repo ..       # AC-1 should read MACHINE VERIFIED (clean)
```

If the second run does not show a clean `MACHINE VERIFIED` on AC-1, run it
once more before recording.

## The take

Two terminals side by side: the app server on the left, your working
terminal on the right. Browser ready on a third window.

```bash
# 1. show the app working — upgrade to Pro, reload, still Pro
#    (http://localhost:4000)

# 2. break it, exactly as an agent might
node demo/break.js
#    restart the app server

# 3. ask what is at risk — fast, no Kane credits, good on camera
cd proofline-cli
node bin/proofline.js --repo .. --dry-run
#    ~28s. Narrate: it ranks AC-1 first, high confidence.

# 4. verify for real
node bin/proofline.js --repo .. --report ../proof-report.html
#    ~4m39s. COMPRESS THIS IN EDIT.
#    Lands on: AC-1/AC-2/AC-6 PRODUCT BUG, AC-3 still MACHINE VERIFIED,
#    VERDICT: BLOCK, exit code 1.

# 5. fix it
node ../demo/fix.js
#    restart the app server

# 6. re-verify
node bin/proofline.js --repo .. --report ../proof-report.html
#    COMPRESS. AC-1 flips to MACHINE VERIFIED.

# 7. open ../proof-report.html — the shareable artifact
```

## What to actually say

**The moment that sells it is step 4**, and specifically that **AC-3 stays
green**. A persistence bug broke the persistence promises and genuinely did
not touch the "no full page navigation" promise. Proofline is not failing
everything — it is discriminating. Say that out loud.

**Be straight about the ending.** The final verdict is `REVIEW REQUIRED`,
not `SHIP`, because AC-2, AC-4 and AC-6 are only *test-linked* — a test
claims them but no assertion independently targets them. That is not a
flaw in the demo, it is the product's whole argument: it will not call a
promise proven on evidence weaker than it looks. AC-1 going red → green is
the arc; the remaining ambers are the point.

If you would rather end on `SHIP`, the honest route is to design a test
whose assertion targets each remaining criterion — not to weaken the
verdict rules.

## If a run fails on camera

Kane's backend is intermittently flaky (`fetch failed`, lock-heartbeat
errors were seen repeatedly during development). If a run dies for
infrastructure reasons, just run it again — Proofline reports that class of
failure as `verification incomplete`, never as a product defect, which is
itself worth showing if it happens.
