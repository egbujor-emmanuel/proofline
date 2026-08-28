# Proofline — 3-minute demo script

Total: **3:00**. Narration is written to be read aloud at a normal pace
(~145 wpm). Timecodes assume Kane's two long runs are sped up in the edit
with an on-screen `8×` label.

Record at 1920×1080. Terminal font size 16pt or larger — judges watch small.

---

## 0:00 – 0:18 · The hook

**SCREEN:** Browser at `localhost:4000`. Click **Upgrade to Pro**. Badge
flips to Pro. Hit reload — still Pro.

> "This is a subscription app. Upgrading works, and it sticks after a reload.
> Now watch what happens when an AI agent touches the code that makes that
> true — and why a green test suite won't save you."

---

## 0:18 – 0:38 · Break it

**SCREEN:** Terminal. Run `node demo/break.js`. Then show the two lines it
changed. Then the API check the script prints:
`POST /api/upgrade -> pro` … `GET /api/account -> free`

> "Two lines. The upgrade still returns 'pro', the UI still says success —
> but nothing was ever saved. The endpoint answers correctly. The page looks
> right. Only a fresh read from the server tells the truth."

---

## 0:38 – 1:05 · What's at risk

**SCREEN:** `node bin/proofline.js --repo .. --dry-run`
Let it run (~30s, cut to ~12s). Land on the ranked AC list.

> "Proofline reads the diff and asks a different question: which promises to
> my users could this have broken? These acceptance criteria came out of my
> PRD — Kane extracted them. Proofline ranked AC-1 first, high confidence:
> 'after a successful upgrade, the persisted plan changes from free to pro.'
> It hasn't tested anything yet. It's telling me where to look."

---

## 1:05 – 1:45 · Verify for real  ⚡ SPEED UP

**SCREEN:** `node bin/proofline.js --repo .. --report ../proof-report.html`
Kane launches Chrome. **Overlay `8×` while it runs.** Land on the verdict.

> "Now it verifies — but only the tests covering those at-risk criteria, not
> the whole suite. That's real Chrome, driven by Kane, against the running
> app."
>
> *(on the result)*
>
> "BLOCK. AC-1, AC-2 and AC-6 are broken — Kane's own verdict calls it a
> major functional defect. But look at AC-3: still green. The 'no full page
> navigation' promise genuinely still holds. It isn't failing everything —
> it's telling me exactly which promises broke."

---

## 1:45 – 2:15 · Fix and re-verify  ⚡ SPEED UP

**SCREEN:** `node demo/fix.js`, then Proofline again. **Overlay `8×`.**
Land on AC-1 green.

> "I put the write back. Re-run — same criterion, same targeted check."
>
> *(on the result)*
>
> "AC-1 is machine verified. Not 'the tests passed' — that specific promise,
> proven, with evidence behind it."

---

## 2:15 – 2:45 · The part that matters

**SCREEN:** Open `proof-report.html`. Scroll to an amber criterion. Show
**Kane observed: passed** beside **Proofline concludes: not independently
asserted**.

> "But these three stayed amber, and this is the whole reason I built it.
> Kane reported 'passed' for them. Proofline still won't call them proven —
> because the test claims those criteria while its only real assertion
> targets a different one. Nothing actually checked them."
>
> "It also caught something worse during the build: Kane's self-healing
> silently rewrote a test to check the UI instead of the database, reported
> PASS, and let a real regression through. Proofline now flags that as
> 'proven on a healed run' and refuses to ship on it."

---

## 2:45 – 3:00 · Close

**SCREEN:** The report, then cut to the repo / live site URL on screen.

> "Kane proves a test passed. Proofline proves a promise still holds — and
> tells you when the evidence isn't good enough to trust. Everything here is
> a real run. There's no mock data in this project."

**END CARD:** `github.com/egbujor-emmanuel/proofline` ·
`egbujor-emmanuel.github.io/proofline`

---

## Cheat sheet

| Beat | Time | Must land |
|---|---|---|
| Hook | 0:18 | The app works |
| Break | 0:20 | API lies, DB doesn't |
| Dry run | 0:27 | AC-1 ranked first |
| **BLOCK** | 0:40 | **AC-3 stays green** ← the moment |
| Fix | 0:30 | AC-1 turns green |
| **Ambers** | 0:30 | **Kane says pass, Proofline says no** ← the differentiator |
| Close | 0:15 | URLs on screen |

**If you must cut:** trim the hook to 10s and the fix section to 20s. Never
cut the AC-3-stays-green beat or the amber beat — those are the two moments
that separate this from a demo of a passing test.

**Don't say** "Proofline replaces Kane" — it doesn't. Say "Kane executes and
proves; Proofline decides what's at risk and whether the proof is good enough."
