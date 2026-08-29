# The complete guide — what everything means, and the recording script

Two parts. **Part 1** explains every concept, so nothing on screen is a
mystery. **Part 2** is the recording flow, step by step, with what to say.

---

# PART 1 — What everything means

## What is an "AC"?

**AC = Acceptance Criterion.** A single, checkable promise your product
makes to its users.

They are not invented by Proofline. They come from **your own PRD**
(`docs/prd.md`), which Kane read and broke down into individual promises.
Yours are:

| AC | The promise, in plain words |
|---|---|
| **AC-1** | When someone upgrades, the account is **really saved as Pro** in storage |
| **AC-2** | Asking the server again afterwards returns **Pro**, not a stale cached `Free` |
| **AC-3** | Clicking "Upgrade to Pro" works **without the page navigating away** |
| **AC-4** | A **success confirmation appears** in the same view after upgrading |
| **AC-5** | Upgrading is a direct change with **no payment step** |
| **AC-6** | **Reloading the page** still shows Pro, read from the server |

AC-1, AC-2 and AC-6 are all about *persistence* — did it really save?
AC-3, AC-4 and AC-5 are about the *upgrade experience* — how it behaves
on screen.

That grouping is why the demo is convincing: the bug breaks persistence
and leaves the experience intact, and Proofline shows exactly that split.

## Who does what

**Kane** is the testing engine. It opens a real Chrome browser, clicks
real buttons on your real app, and reports what happened. It does not know
your source code exists.

**Proofline** is the decision layer. It reads your code change, decides
which promises that change endangers, asks Kane to test **only those**, and
then judges whether Kane's answer is strong enough to ship on.

The short version, and the line to say on camera:

> Kane proves a test passed. Proofline proves a promise still holds.

## The result labels

### 🟢 MACHINE VERIFIED
The strongest result. A test ran, it contains a check aimed at **this exact
promise**, that check passed, and the run was clean. Safe.

### 🔴 PRODUCT BUG — REQUIREMENT BROKEN
The test ran to completion and its check **failed against your real app**.
Your application genuinely violates this promise. This is the one that
produces BLOCK.

### 🟡 TEST-LINKED, NOT INDEPENDENTLY ASSERTED
The subtle one, and the reason this product exists.

A test says it covers three promises, but it only contains **one** real
check. So one promise is genuinely verified and the other two are riding
along on it. Kane's own coverage counts all three as "proven".

Proofline refuses to. It reports the one with a real check as verified and
marks the other two amber — *a test claims this, but nothing actually
checked it.*

> Worth knowing: Kane offers "strict" and "lenient" coverage modes. We ran
> both. They return identical numbers here, so this distinction does not
> exist upstream. Proofline adds it.

### 🟡 REVIEW REQUIRED — TEST-AGENT ERROR
The test **could not finish** — the browser agent got stuck or crashed.
Nothing was learned about your app.

Proofline deliberately does **not** call this a bug. A test that failed to
run is not evidence your product is broken. Reporting it as a defect would
be a lie.

### 🟡 MACHINE VERIFIED — HEALED
The check passed, but Kane silently rewrote the test mid-run to get there.

This is not theoretical. During this build, a healed run rewrote a test to
check the on-screen text instead of the saved data, reported PASS, and let
a real regression through. Proofline now refuses to treat a healed pass as
clean.

### 🔴 NOT VERIFIED
No live test covers this promise at all. Silence is not proof.

## The three verdicts

| Verdict | Meaning |
|---|---|
| **SHIP** | Every affected promise is cleanly machine verified |
| **BLOCK** | A promise is genuinely broken, or has no evidence at all |
| **REVIEW REQUIRED** | Evidence exists but is weaker than it looks — a human should decide |

### Why your demo ends on REVIEW REQUIRED, not SHIP

Because AC-2, AC-4 and AC-6 are only *test-linked*. Proofline will not
call a promise proven on evidence that weak.

**This is the point, not a shortcoming.** The story is AC-1 going red then
green. The remaining ambers are the product telling you the truth about how
good your test suite actually is.

To reach SHIP you would write a test whose check targets each remaining
promise directly — not weaken the rules.

---

# PART 2 — The recording flow

## Before you press record

```powershell
# 1. Confirm you are on the frozen working state
git -C "C:\Users\Yoma Maroh\proofline" status

# 2. If anything is broken, restore it
git -C "C:\Users\Yoma Maroh\proofline" reset --hard working-demo
```

Then do a full practice run and throw it away. The first run after a fix is
slower and can report HEALED instead of clean; the second settles.

**Two windows, side by side.** Terminal A on the left (the app), Terminal B
on the right (where you type). Browser on top when needed.

---

## SETUP — Terminal A

```powershell
cd "C:\Users\Yoma Maroh\proofline\app"
npm run dev
```

Wait for `Subscription dashboard running at http://localhost:4000`.

**What this does:** starts the app being tested. `npm run dev` restarts it
automatically whenever code changes, so you never touch this window again.

> ⚠️ If this window dies, everything else silently produces meaningless
> results. Proofline now checks and refuses to run, but keep an eye on it.

## SETUP — Terminal B

```powershell
cd "C:\Users\Yoma Maroh\proofline\proofline-cli"
```

---

## 🎬 0:00–0:18 — Show the app working

**Do:** Browser at `http://localhost:4000`. Click **Upgrade to Pro** → shows
Pro. Press **F5** → still Pro.

**Say:**
> "This is a subscription app. Upgrading works, and it survives a reload —
> so it was really saved. Now watch what happens when an AI agent touches
> the code behind that."

---

## 🎬 0:18–0:38 — Break it

```powershell
node ..\demo\break.js
```

**What this does:** changes two lines so the upgrade endpoint still returns
success but never writes to storage. Exactly the kind of mistake an agent
makes — the code looks right.

**Do:** Wait 3 seconds. In the browser: refresh, click **Upgrade to Pro**
(says Pro), press **F5** → now says **Free**.

**Say:**
> "Two lines changed. The API still returns success, the screen still says
> Pro — but nothing was saved. Only a reload reveals it. A green test suite
> would not catch this."

---

## 🎬 0:38–1:05 — Ask what's at risk

```powershell
node bin/proofline.js --repo .. --dry-run
```

**What this does:** Proofline reads your code change and works out which
promises it endangers. `--dry-run` means think only — **no browser, no
credits spent.** Takes ~30 seconds.

**What you'll see:** AC-1, AC-2, AC-6 at **high** confidence; AC-3, AC-4 at
**low**.

**Say:**
> "Proofline reads the diff and asks which promises this could break. These
> criteria came out of my PRD — Kane extracted them. It ranks AC-1 first
> with high confidence: 'after upgrading, the persisted plan changes from
> free to pro.' Nothing has been tested yet. It's telling me where to look."

---

## 🎬 1:05–1:45 — Verify for real ⚡ SPEED UP 8× IN EDIT

```powershell
node bin/proofline.js --repo .. --report ..\proof-report.html
```

**What this does:** Proofline picks only the tests covering the at-risk
promises, hands them to Kane, Kane drives a real Chrome browser through
them, and Proofline grades the evidence that comes back. **4–5 minutes.**

**Expect:**
```
AC-1  🔴 PRODUCT BUG        AC-2  🔴 PRODUCT BUG
AC-6  🔴 PRODUCT BUG        AC-3  🟢 MACHINE VERIFIED
VERDICT: BLOCK
```

**Say:**
> "Now it verifies — only the tests covering those promises, not the whole
> suite. That's real Chrome against the running app."
>
> *(on the result — this is the most important line in the video)*
>
> "BLOCK. Three promises broken. **But look at AC-3 — still green.** The
> 'no page navigation' promise genuinely still holds. It isn't failing
> everything. It's telling me precisely which promises broke and which
> survived."

---

## 🎬 1:45–1:52 — Commit the bad change

```powershell
..\demo\commit-bug.ps1
```

**What this does:** commits the regression, so the **fix** becomes the next
change to verify. Proofline compares against your last commit, so without
this there would be nothing left to check.

**Say:** *(brief — or cut this in the edit)*
> "I'll commit the bad change, the way an agent would have."

---

## 🎬 1:52–2:15 — Fix and re-verify ⚡ SPEED UP 8×

```powershell
node ..\demo\fix.js
node bin/proofline.js --repo .. --report ..\proof-report.html
```

**Expect:** `AC-1 🟢 MACHINE VERIFIED`

**Say:**
> "I put the write back and re-run. Same promise, same targeted check."
>
> *(on the result)*
>
> "AC-1 is machine verified. Not 'the tests passed' — that specific promise,
> proven, with evidence behind it."

---

## 🎬 2:15–2:45 — The differentiator

```powershell
start ..\proof-report.html
```

**Do:** Scroll to an **amber** criterion. Show the two columns:
**Kane observed: passed** beside **Proofline concludes: not independently
asserted**.

**Say:**
> "But these stayed amber, and this is the whole reason I built it. Kane
> reported 'passed'. Proofline still won't call them proven — the test
> claims those promises while its only real check targets a different one.
> Nothing actually verified them."
>
> "It caught something worse during the build: Kane's self-healing silently
> rewrote a test to check the screen instead of the database, reported PASS,
> and let a real regression through. Proofline flags that as 'proven on a
> healed run' and refuses to ship on it."

---

## 🎬 2:45–3:00 — Close

**Say:**
> "Kane proves a test passed. Proofline proves a promise still holds — and
> tells you when the evidence isn't good enough to trust. Every run here is
> real. There is no mock data in this project."

**END CARD:**
`github.com/egbujor-emmanuel/proofline`
`egbujor-emmanuel.github.io/proofline`

---

## Cleanup after each take

```powershell
..\demo\reset-demo.ps1
```

## If something goes wrong

| Message | Meaning | Fix |
|---|---|---|
| `APP NOT RESPONDING` | Terminal A died | Restart `npm run dev` |
| `EADDRINUSE` | Port already taken | `..\demo\free-port.ps1` |
| `STALE APP` | Server running old code | Restart Terminal A |
| `No changed files` | Nothing to analyse | Run `break.js` first |
| `TEST-AGENT ERROR` everywhere | Usually the app is down | Check the browser loads |
| Everything is a mess | — | `git reset --hard working-demo` |

## Two beats you must not cut

1. **AC-3 staying green** while the others go red — proves it reasons
   rather than just failing everything.
2. **Kane says passed / Proofline says no** in the report — the entire
   argument for the product.

Trim the hook or the fix section if you need time. Never those two.
