# Proofline — detailed shooting script

Everything you do, everything you see, everything you say. In order.

**Target: 3:00.** Narration is written to be read at a normal pace. The two
long Kane runs are sped up in the edit — you record them in full and cut
the waiting.

---

# BEFORE YOU PRESS RECORD

## Prep checklist — do all of it

```powershell
# 1. Known-good state
git -C "C:\Users\Yoma Maroh\proofline" reset --hard working-demo

# 2. Free the port
cd "C:\Users\Yoma Maroh\proofline"
.\demo\free-port.ps1
```

**Terminal A** — start the app, then never touch this window:
```powershell
cd "C:\Users\Yoma Maroh\proofline\app"
npm run dev
```
Wait for `Subscription dashboard running at http://localhost:4000`.

**Browser** — open <http://localhost:4000> and confirm it loads. If it does
not, stop and fix that first; nothing else works.

**Terminal B** — where you will type everything:
```powershell
cd "C:\Users\Yoma Maroh\proofline\proofline-cli"
```

**Do one full practice run and throw it away.** The first verification
after a fix is slower and can report HEALED instead of clean. The second
settles. Record the second.

Then reset again before the real take:
```powershell
.\demo\reset-demo.ps1
```

## Screen setup

- Terminal font **16pt or larger** — judges watch this small
- Terminal B on the left (where you type), browser on the right
- Terminal A can be minimised once it is running
- Record the **whole screen** at 1920×1080 (OBS → Display Capture)
- Close Slack, email, notifications

---

# THE SCRIPT

---

## SHOT 1 · The problem — 0:00 to 0:22

**ON SCREEN:** The browser at `http://localhost:4000`. Nothing else.
Click **Upgrade to Pro**. The badge flips to **Pro**, Advanced Reports
appears. Press **F5**. Still Pro.

**SAY:**

> "An AI agent writes code for you now. It ships a change, your tests go
> green, and you ship it.
>
> But 'the tests passed' and 'the promise I made to my users still holds'
> are not the same claim. Nothing checks the second one.
>
> This is a subscription app. Upgrading works — and it survives a reload,
> so it was really saved."

---

## SHOT 2 · Break it — 0:22 to 0:45

**ON SCREEN:** Terminal B.

```powershell
node ..\demo\break.js
```

Then switch to the browser: refresh, click **Upgrade to Pro** → says
**Pro**. Press **F5** → says **Free**.

**SAY:**

> "Now I'll make the kind of change an agent actually makes. Two lines.
> The upgrade endpoint still returns success. The screen still says Pro.
>
> But watch — reload, and it's Free again. It never saved.
>
> The API is correct. The UI is correct. Only a fresh read from the server
> tells the truth. A green test suite would sail straight past this."

---

## SHOT 3 · What's at risk — 0:45 to 1:12

**ON SCREEN:** Terminal B.

```powershell
node bin/proofline.js --repo .. --dry-run
```

Let it run (~30s — trim to about 10s in the edit). Land on the ranked list.

**SAY:**

> "Proofline asks a different question: which promises to my users could
> this change have broken?
>
> These acceptance criteria aren't invented — they came out of my product
> requirements doc. Kane extracted them.
>
> It ranks AC-1 first, high confidence: *after a successful upgrade, the
> account's persisted plan changes from free to pro.* Then AC-2 and AC-6,
> also about persistence.
>
> Nothing has been tested yet. This costs nothing. It's telling me where
> to look."

---

## SHOT 4 · Verify for real — 1:12 to 1:55  ⚡ SPEED UP 8× IN EDIT

**ON SCREEN:** Terminal B.

```powershell
node bin/proofline.js --repo .. --report ..\proof-report.html
```

Takes 4–5 minutes. Overlay an **`8×`** badge while it spins. Land on the
verdict.

**SAY (while it runs):**

> "Now it verifies — but only the tests that cover those at-risk promises,
> not the whole suite. That's Kane, driving a real Chrome browser against
> the running app."

**SAY (on the result — the most important line in the video):**

> "BLOCK. AC-1, AC-2, AC-6 — product bug. Kane's own verdict calls it a
> major functional defect.
>
> **But look at AC-3. Still green.**
>
> AC-3 is 'clicking upgrade doesn't navigate away from the page.' That
> promise genuinely still holds — the bug didn't touch it.
>
> It isn't failing everything because something broke. It's telling me
> precisely which promises broke, and which survived."

---

## SHOT 5 · Commit and fix — 1:55 to 2:20  ⚡ SPEED UP 8×

**ON SCREEN:** Terminal B.

```powershell
..\demo\commit-bug.ps1
node ..\demo\fix.js
node bin/proofline.js --repo .. --report ..\proof-report.html
```

Overlay **`8×`** on the verification again. Land on AC-1 green.

**SAY:**

> "I'll commit the bad change the way an agent would have, then put the
> write back and re-run. Same promise, same targeted check."

**SAY (on the result):**

> "AC-1 — machine verified. Not 'the tests passed.' That specific promise,
> proven, with evidence behind it."

---

## SHOT 6 · The part that matters — 2:20 to 2:50

**ON SCREEN:**

```powershell
start ..\proof-report.html
```

The report opens. Scroll to an **amber** criterion. Rest on the two
columns: **Kane observed → passed** beside **Proofline concludes → not
independently asserted**.

**SAY:**

> "But these stayed amber, and this is the whole reason I built it.
>
> Kane reported *passed* for them. Proofline still won't call them proven —
> because the test claims those promises while its only real assertion
> targets a different one. Nothing actually checked them.
>
> It caught something worse during the build. Kane's self-healing silently
> rewrote a test to check the screen instead of the database, reported
> PASS, and let a real regression through. Proofline now flags that as
> 'proven on a healed run' and refuses to ship on it."

---

## SHOT 7 · Close — 2:50 to 3:00

**ON SCREEN:** The report, then cut to an end card with both URLs.

**SAY:**

> "Kane proves a test passed. Proofline proves a promise still holds — and
> tells you when the evidence isn't good enough to trust.
>
> Every run in this video is real. There's no mock data in this project."

**END CARD:**
```
github.com/egbujor-emmanuel/proofline
egbujor-emmanuel.github.io/proofline
```

---

# TIMING

| Shot | Length | Running |
|---|---|---|
| 1 · The problem | 0:22 | 0:22 |
| 2 · Break it | 0:23 | 0:45 |
| 3 · What's at risk | 0:27 | 1:12 |
| 4 · Verify → BLOCK ⚡ | 0:43 | 1:55 |
| 5 · Fix → verified ⚡ | 0:25 | 2:20 |
| 6 · The differentiator | 0:30 | 2:50 |
| 7 · Close | 0:10 | 3:00 |

**If you run long, trim shots 1 and 5.**
**Never trim the AC-3 line in shot 4, or the amber columns in shot 6.**
Those two are the entire submission.

---

# THE FIVE THINGS THAT MUST LAND

1. The bug is **invisible** to the API and the UI — only persistence broke
2. Proofline finds AC-1 **before** running anything
3. **AC-3 stays green** — it discriminates, it doesn't panic
4. AC-1 goes **red → green** — the loop closes
5. **Kane says passed, Proofline says no** — the differentiator

---

# IF A TAKE GOES WRONG

| What you see | Do this |
|---|---|
| `APP NOT RESPONDING` | Terminal A died — restart `npm run dev`, take again |
| `EADDRINUSE` | `.\demo\free-port.ps1`, restart app |
| `TEST-AGENT ERROR` everywhere | App is probably down; check the browser loads |
| `No changed files` | You skipped `break.js` |
| Silent past ~10 min | `Ctrl+C`, run the same command again |
| Anything unrecoverable | `git reset --hard working-demo` and start over |

Kane's browser agent is genuinely variable. **Expect to need a few takes
for shot 4.** Keep the one where it says PRODUCT BUG.

Between every take:
```powershell
.\demo\reset-demo.ps1
```
