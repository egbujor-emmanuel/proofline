# Proofline

"Kane proves a test passes. Proofline proves a specific product promise still
holds after a specific code change — and identifies which promise is at
risk."

## What this is

Given a code change, Proofline:

1. Maps changed files to the acceptance criteria they could affect
   (deterministic, config-driven — see `config/ac-map.json` — optionally
   refined by an LLM over the narrowed candidate set only, never the whole
   diff/repo).
2. Resolves which live Kane test(s) verify those ACs, using the real
   `@verifies ac-N` markers on the `*_test.md` files and Kane's own context
   graph — no separate AC/test database.
3. Runs exactly those tests via `kane-cli testrun run --from-context`.
4. Classifies each affected AC's evidence strength from the resulting sealed
   evidence pack: `machine_verified` (an explicit runtime check targets this
   exact AC), `test_linked_only` (a test claims to verify it, Kane's own
   coverage counts it as proven, but no independent assertion backs it —
   confirmed real via direct CLI investigation: strict vs lenient rollup does
   not distinguish this), `not_verified`, or `execution_error`.
5. Renders a SHIP / BLOCK / REVIEW REQUIRED decision — never a flattened
   binary, and never claims independent verification where Kane only
   established it through a test-linked/prose claim.

## Usage

```
cd proofline-cli
node bin/proofline.js --dry-run      # mapping only, zero Kane calls, zero credits
node bin/proofline.js                # runs targeted Kane verification for real
node bin/proofline.js --ref HEAD~1   # diff against a specific ref
```

`--dry-run` is the safe default to reach for first — it shows exactly which
ACs a change would put at risk before spending anything.

## Optional LLM refinement

Set `ANTHROPIC_API_KEY` to have the narrowed candidate set (never the full
diff or repo) refined for confidence/rationale. Without it, the tool is
fully functional using the deterministic rule-based mapping alone — it says
so explicitly rather than faking a score.
