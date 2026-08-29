# Proofline

**Kane proves a test passes. Proofline proves a specific product promise still holds after a specific code change — and tells you which promise is at risk.**

TestMu AI Kane CLI Hackathon entry.

---

## The problem

An AI coding agent changes your code. Your test suite is green. Ship it?

Green doesn't answer the question you actually have, which is: *"Which of the things I promised my users could this change have broken, and do I have real proof they still hold?"*

Kane answers "did this test pass." Nobody answers "which promise did this diff put at risk, and is the evidence strong enough to ship on." That's Proofline.

## What it does

```
git diff
   ↓  Proofline: which acceptance criteria does this change threaten?
affected ACs (ranked, with confidence)
   ↓  Kane's own @verifies markers: which tests cover those ACs?
exactly those tests — not the whole suite
   ↓  kane-cli testrun: real headless Chrome against the real app
sealed evidence pack
   ↓  Proofline: how strong is this evidence, per criterion?
SHIP / BLOCK / REVIEW REQUIRED  +  shareable HTML report
```

**Kane owns** requirement ingestion, test design, browser execution, and evidence.
**Proofline owns** the two things Kane has no concept of: *which requirements a code change endangers*, and *whether the resulting evidence is actually strong enough to ship on*.

## Why the second part matters

Kane can report an acceptance criterion as "proven" in cases where that claim is weaker than it sounds. Proofline never flattens those into a green check. Every criterion gets Kane's **raw signal** and Proofline's **interpretation**, side by side:

| Proofline state | What it means | Verdict impact |
|---|---|---|
| `machine_verified_clean` | An explicit runtime check targets *this exact AC*, on a clean run | can SHIP |
| `machine_verified_healed` | Same check passed — but Kane's adaptive-heal silently re-authored the run | REVIEW |
| `test_linked_only` | A test claims this AC and Kane counts it proven, but no independent assertion backs it | REVIEW |
| `agent_misstep` | The test couldn't complete (Kane: `broken`). **Not** evidence the product is broken | REVIEW |
| `product_bug` | The test completed and its assertion genuinely failed | BLOCK |
| `not_verified` | No live test verifies this AC at all | BLOCK |

Each of these was discovered by running this against real code, not designed on a whiteboard:

- **`test_linked_only`** exists because Kane's coverage counts all three ACs a test claims as "proven" when only one has a runtime assertion — and `--rollup strict` vs `lenient` produces *identical* numbers, so Kane's own dial doesn't separate them.
- **`machine_verified_healed`** exists because a healed run in this repo silently re-authored a test into checking optimistic UI state instead of persisted state — and **let a real regression through while reporting PASS**.
- **`agent_misstep`** exists because flattening a stuck test-agent into "product bug" would make the tool lie.

## Proof this works end-to-end

A real regression was committed to the app: `upgradeToPro()` returned `{plan:'pro'}` without persisting it. The API responded correctly, the UI showed success — only a fresh read revealed the account was still `free`.

| | Before fix | After fix |
|---|---|---|
| AC-1 *(persisted plan changes free→pro)* | 🔴 **PRODUCT BUG** — Kane: `functional_defect / major` | 🟢 **MACHINE VERIFIED**, clean run |

Proofline mapped the diff to AC-1 **first, with high confidence**, ran only the tests covering it, and classified the resulting real evidence. Both commits are in the history (`Intentional regression…` → `Fix upgrade persistence regression found by Kane`).

**No mock data exists anywhere in this project.** Every test fixture is a real sealed evidence pack from a real Kane run against real Chrome.

---

## Setup

**Requirements:** Node 18+, Git, Chrome, and a [TestMu AI account](https://www.testmuai.com/register/).

```bash
# 1. Kane CLI
npm install -g @testmuai/kane-cli
kane-cli login --oauth          # or --username <u> --access-key <k>
kane-cli whoami                 # confirm authenticated

# 2. This repo
git clone <this-repo> && cd proofline

# 3. The app under test
cd app && npm install && npm run dev   # serves http://localhost:4000
```

Use `npm run dev`, not `npm start`. It restarts the server whenever the code
changes. With `npm start` you must restart it by hand after every edit, and
forgetting once means Kane tests code you are no longer running.

**Leave that terminal open** and confirm <http://localhost:4000> loads in a
browser before going further. If the app is not answering, Proofline refuses
to run rather than producing a meaningless result — but everything is
simpler if you check first.

Then, in a second terminal:

```bash
cd proofline-cli
node bin/proofline.js --help
```

**Optional but recommended** — the reasoning layer. Either works; the CLI is free with an existing Claude subscription:

```bash
npm install -g @anthropic-ai/claude-code && claude   # sign in once
# ...or set ANTHROPIC_API_KEY
```

Without either, Proofline still runs fully on its deterministic IDF-weighted mapper and says so explicitly rather than faking a score.

## See it catch a real bug

This is the exact sequence, verified end to end. Run it from
`proofline-cli`, with the app running in the other terminal.

```bash
# 1. Introduce a real regression: the upgrade endpoint returns success
#    but stops persisting. The API and the UI both still look correct.
node ../demo/break.js
```

Check it in the browser: click **Upgrade to Pro** (says Pro), press **F5**
— it says **Free**. That is the bug.

```bash
# 2. Which promises does this put at risk?
#    ~30s, no browser, no Kane credits spent.
node bin/proofline.js --repo .. --dry-run

# 3. Verify for real. Kane drives Chrome against the running app. 4-5 min.
node bin/proofline.js --repo .. --report ../proof-report.html
```

Expected — and note **AC-3 stays green**, because a persistence bug does
not break the "no full page navigation" promise:

```
AC-1  PRODUCT BUG -- REQUIREMENT BROKEN
AC-2  PRODUCT BUG -- REQUIREMENT BROKEN
AC-6  PRODUCT BUG -- REQUIREMENT BROKEN
AC-3  MACHINE VERIFIED
VERDICT: BLOCK
```

```bash
# 4. Commit the bad change, so the FIX becomes the next change to verify.
../demo/commit-bug.ps1        # Windows; elsewhere: git commit -am "bad change"

# 5. Fix it, and prove the promise holds again. 2-5 min.
node ../demo/fix.js
node bin/proofline.js --repo .. --report ../proof-report.html
```

`AC-1` returns to **MACHINE VERIFIED**. Open `proof-report.html` in any
browser — self-contained, works offline.

```bash
# Put everything back afterwards
../demo/reset-demo.ps1
```

**Why the final verdict is REVIEW REQUIRED rather than SHIP:** AC-2, AC-4
and AC-6 are only *test-linked* — a test claims them but no assertion
independently targets them. Proofline will not call those proven. That is
the product's argument, not a failure of the demo.

### If something goes wrong

| Message | Cause | Fix |
|---|---|---|
| `APP NOT RESPONDING` | app terminal died | restart `npm run dev` |
| `EADDRINUSE` | port 4000 already taken | `demo/free-port.ps1` |
| `STALE APP` | server running older code | restart the app terminal |
| `No changed files against HEAD` | nothing to analyse | run `demo/break.js` first |
| `TEST-AGENT ERROR` on everything | usually the app is down | confirm the browser loads |

Restore a known-good state at any time:

```bash
git reset --hard working-demo
```

### Guides

- `demo/FULL-GUIDE.md` — what every concept and result label means
- `demo/PRACTICE.md` — step-by-step walkthrough for a first run
- `demo/VIDEO-SCRIPT.md` — the 3-minute demo narration

## Tests

```bash
cd proofline-cli && npm test     # 18 tests, 3 suites
```

Every fixture is a real evidence pack produced by this project's own live Kane runs — a clean pass, a healed pass, an agent-misstep, and the genuine regression catch.

---

## Repository layout

| Path | What it is |
|---|---|
| `proofline-cli/` | **The product.** Mapper, evidence classifier, verdict engine, HTML report |
| `app/` | The real subscription app under test (Express + JSON persistence) |
| `docs/prd.md` | The real PRD — source document for Kane's requirements graph |
| `.context/` | Kane's requirements graph (committed so the repo is runnable — see below) |
| `.testmuai/tests/` | Real Kane `*_test.md` tests with `@verifies` markers |

**On committing `.context/`:** Kane's docs advise gitignoring it (single-writer, not git-mergeable). That's right for a team sharing a live graph, but wrong for a repo someone else must clone and run — without it there are no ACs to map a diff onto. It's committed deliberately. Don't run concurrent Kane context writes against a shared checkout.

## Known limitations

Stated plainly rather than discovered by a judge:

- **Evidence pack reading is Windows-only.** It shells out to PowerShell + .NET `ZipFile`. Failures degrade to `test_failure_unclassified` instead of crashing, but the classifier can't read packs on macOS/Linux yet.
- **One project validated.** The mapper has no repo-specific literals and derives everything from the target's own graph, but it's only been exercised against this app.
- **The target repo must already have a Kane context graph.** Proofline verifies against a project's existing requirements corpus; it doesn't invent one.
- **Kane's backend showed intermittent `fetch failed` / lock-heartbeat errors** across this build. Runs can fail for infrastructure reasons unrelated to your code — Proofline reports that as `agent_misstep`, never as a product defect.

## The app under test

A small subscription dashboard: an account is `free` or `pro`, can upgrade, and Pro-only "Advanced Reports" is gated on the persisted plan. Requirements R-01–R-04 with acceptance criteria are in [`docs/prd.md`](docs/prd.md). No real payments — upgrade is a direct state change, deliberately out of scope in the PRD.

Reset between runs with the dashboard's reset button or `POST /api/reset`.
