# Proofline

"Kane proves a test passes. Proofline proves a specific product promise still
holds after a specific code change — and identifies which promise is at
risk."

## What this is

Given a real code change in a real Git repository, Proofline:

1. Maps changed files to the acceptance criteria they could affect. This is
   **not** a hand-maintained per-project answer key — `src/acMap.js`
   extracts real structural signals from each changed file (route
   registrations, import targets, declared function names, filename tokens)
   and matches them against the actual text of every live AC in *that
   project's own* Kane context graph. The mechanism is the same regardless
   of which project it runs against; only the AC corpus it reasons over
   differs, because that corpus comes from the project's own PRD, already
   ingested through Kane's own assurance lifecycle (`context ingest` /
   `context extract` / `design tests`).
2. Optionally refines that structural candidate set with a real LLM call
   (`src/llmRank.js`, requires `ANTHROPIC_API_KEY`) given the diff and the
   **full** live AC list — not just the structurally-narrowed set, so it can
   also catch an AC the structural pass missed. Without a key, the tool
   still runs correctly on the structural signals alone and says so
   explicitly rather than faking a score.
3. Resolves which live Kane test(s) verify those ACs, using the real
   `@verifies ac-N` markers on the `*_test.md` files (`src/verifiesParser.js`)
   — no separate AC/test database. Runs exactly those tests via
   `kane-cli testrun run --match <basenames>` (`src/kane.js`) — `--match`
   selects by file path and was confirmed more reliable than
   `--from-context <logical-id>`, which broke after a test's logical id
   drifted during re-authoring.
4. Classifies each affected AC's evidence strength from the resulting sealed
   evidence pack (`src/evidenceStrength.js`), reading Kane's own raw signal
   (`src/evidencePack.js`) without mutating it:
   - `machine_verified_clean` — an explicit runtime check targets this exact
     AC, on a clean (non-flaky, non-healed) execution.
   - `machine_verified_healed` — same, but Kane's adaptive-heal silently
     re-authored the execution. Confirmed real and load-bearing: a healed
     re-authoring changed what one test actually checked (persisted state
     vs. optimistic UI state) and let a real regression through.
   - `test_linked_only` — a test claims to verify this AC and Kane's own
     coverage counts it as proven, but no independent assertion backs it
     (confirmed: strict vs. lenient coverage rollup does not distinguish
     this).
   - `not_verified` — no live test verifies this AC at all.
   - `product_bug` — the covering test completed and its assertion
     genuinely failed against the real running application.
   - `agent_misstep` — the covering test's run did not complete (Kane marks
     it "broken", not "failed") — not evidence the product is broken.
   - `test_failure_unclassified` — didn't pass, and the pack's status
     doesn't cleanly resolve to either of the above.
5. Renders a SHIP / BLOCK / REVIEW REQUIRED decision. SHIP requires every
   affected AC to be `machine_verified_clean`; a healed/flaky pass,
   test-linked-only evidence, an agent misstep, or missing evidence all fall
   back to REVIEW REQUIRED or BLOCK — never claims independent verification
   where Kane only established it through a weaker signal.

## Usage

```
cd proofline-cli
node bin/proofline.js --dry-run      # mapping only, zero Kane calls, zero credits
node bin/proofline.js                # runs targeted Kane verification for real
node bin/proofline.js --ref HEAD~1   # diff against a specific ref
```

`--dry-run` is the safe default to reach for first — it shows exactly which
ACs a change would put at risk before spending anything.

Requires the target project to already have a Kane context graph (i.e. its
PRD has been ingested and at least one use-case designed via
`kane-cli context`/`kane-cli design`) and live `*_test.md` files with
`@verifies` markers — Proofline verifies against a project's own existing
requirements corpus, it doesn't invent one.

## Optional LLM refinement

Set `ANTHROPIC_API_KEY` to have the structural candidate set reasoned over
against the full diff and the complete live AC list. Without it, the tool is
fully functional using the structural signal-matching alone — it says so
explicitly rather than faking a score.

## Tests

```
node test/evidenceStrength.test.js
```

Exercises the evidence classifier against real, already-captured evidence
packs from this project's own live Kane runs (clean pass, healed pass,
agent-misstep, and a genuine regression catch) — no fabricated fixtures, no
live Kane calls.
