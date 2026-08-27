const { detectProvider, complete } = require('./llmProvider');

/**
 * Optional reasoning step over the structurally-narrowed candidates, given
 * the FULL live AC corpus (not just the narrowed set) so it can also catch
 * an AC the deterministic layer missed entirely.
 *
 * This is a REFINEMENT, never a requirement. src/acMap.js already produces
 * IDF-weighted, ranked, confidence-scored candidates with no model involved
 * -- validated against ground truth (it ranks the AC a real regression
 * actually broke first, with high confidence). When no provider is
 * available this degrades honestly: it keeps the deterministic ranking,
 * says exactly why it wasn't refined, and never fabricates a score or
 * invents an AC.
 *
 * Works with either ANTHROPIC_API_KEY or the `claude` CLI (which uses an
 * existing Claude subscription rather than paid API credits) -- see
 * llmProvider.js.
 */
function buildPrompt(diffText, structuralAcIds, allAcs) {
  return [
    'You are determining which acceptance criteria a real code change puts at risk.',
    'You are given the diff and the FULL list of live acceptance criteria for this project -- not a pre-filtered set.',
    `A structural term-overlap pass already flagged these as likely candidates: ${[...structuralAcIds].join(', ') || '(none)'}.`,
    'That pass is a recall aid, not ground truth -- it can both over- and under-flag. Use your own judgment on the actual diff content.',
    'For every AC the diff plausibly affects (whether or not it was structurally flagged), return confidence (high|medium|low) and a one-sentence rationale grounded in the diff.',
    'Do not include an AC the diff clearly does not touch.',
    '',
    'ALL LIVE ACCEPTANCE CRITERIA:',
    allAcs.map((a) => `${a.id}: ${a.text || ''}`).join('\n'),
    '',
    'DIFF:',
    diffText.slice(0, 8000),
    '',
    'Respond with ONLY a JSON array, no prose or code fences: [{"ac": "ac-1", "confidence": "high", "rationale": "..."}]',
  ].join('\n');
}

function parseResponse(text) {
  // Tolerate a fenced block or surrounding prose: take the first JSON array.
  const match = text.match(/\[[\s\S]*\]/);
  if (!match) throw new Error('no JSON array found in model response');
  return JSON.parse(match[0]);
}

function unrefined(candidates, why) {
  return candidates.map((c) => ({ ...c, llm_refined: false, rationale: why }));
}

async function refineCandidates(diffText, candidates, allAcs) {
  const provider = detectProvider();
  if (provider.kind === 'none') {
    return unrefined(
      candidates,
      'No model provider available (set ANTHROPIC_API_KEY, or install the `claude` CLI to use an existing Claude subscription) -- using the deterministic IDF-weighted ranking as-is.'
    );
  }

  const structuralAcIds = new Set(candidates.map((c) => c.ac));
  const prompt = buildPrompt(diffText, structuralAcIds, allAcs);

  let result;
  try {
    result = await complete(prompt);
  } catch (err) {
    return unrefined(candidates, `Model call via ${provider.detail} failed (${err.message}) -- using the deterministic IDF-weighted ranking as-is.`);
  }

  let parsed;
  try {
    parsed = parseResponse(result.text);
  } catch (err) {
    return unrefined(candidates, `Model responded via ${provider.detail} but the reply could not be parsed (${err.message}) -- using the deterministic IDF-weighted ranking as-is.`);
  }

  const byAc = new Map(parsed.filter((p) => p && p.ac).map((p) => [p.ac, p]));
  const validAcIds = new Set(allAcs.map((a) => a.id));

  const refinedExisting = candidates.map((c) => {
    const refined = byAc.get(c.ac);
    if (!refined) {
      return { ...c, llm_refined: false, rationale: `Structurally flagged, but ${result.provider} did not rank it -- kept, unrefined, rather than silently dropped.` };
    }
    return { ...c, llm_refined: true, confidence: refined.confidence || c.confidence, rationale: refined.rationale };
  });

  // ACs the model found that the structural pass missed. Filtered against
  // the real graph so a hallucinated id can never enter the pipeline.
  const llmOnly = [...byAc.keys()]
    .filter((ac) => !structuralAcIds.has(ac) && validAcIds.has(ac))
    .map((ac) => ({
      ac,
      confidence: byAc.get(ac).confidence || 'low',
      rationale: `${byAc.get(ac).rationale} (Identified by ${result.provider}; not structurally flagged by term overlap.)`,
      files: [],
      score: 0,
      llm_refined: true,
      llm_only: true,
    }));

  return [...refinedExisting, ...llmOnly];
}

module.exports = { refineCandidates, buildPrompt, parseResponse };
