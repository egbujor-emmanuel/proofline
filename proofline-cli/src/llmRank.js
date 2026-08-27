const https = require('https');

/**
 * Reasoning step over the structurally-narrowed candidates, given the FULL
 * live AC corpus (not just the narrowed set) so it can also catch an AC the
 * deterministic term-overlap layer missed entirely -- structural overlap is
 * a recall aid, not a hard filter; the LLM is the actual judgment call.
 * Requires ANTHROPIC_API_KEY. If it is not set, this is a real no-op that
 * says so explicitly -- it does not fabricate a confidence score or
 * rationale, and does not add any AC the structural layer didn't already
 * find (an unrefined result understates risk rather than inventing it).
 */
async function refineCandidates(diffText, candidates, allAcs) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return candidates.map((c) => ({
      ...c,
      llm_refined: false,
      rationale: 'ANTHROPIC_API_KEY not set -- using structurally-narrowed candidate as-is, unrefined.',
    }));
  }

  const structuralAcIds = new Set(candidates.map((c) => c.ac));
  const prompt = [
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
    'Respond as JSON array: [{"ac": "ac-1", "confidence": "high", "rationale": "..."}]',
  ].join('\n');

  const body = JSON.stringify({
    model: 'claude-sonnet-5',
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }],
  });

  const responseText = await new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: 'api.anthropic.com',
        path: '/v1/messages',
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'content-length': Buffer.byteLength(body),
        },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => resolve(data));
      }
    );
    req.on('error', reject);
    req.write(body);
    req.end();
  });

  let parsed;
  try {
    const outer = JSON.parse(responseText);
    parsed = JSON.parse(outer.content[0].text);
  } catch (err) {
    return candidates.map((c) => ({
      ...c,
      llm_refined: false,
      rationale: `LLM call succeeded but response could not be parsed (${err.message}) -- using rule-based candidate as-is.`,
    }));
  }

  const byAc = new Map(parsed.map((p) => [p.ac, p]));

  const refinedExisting = candidates.map((c) => {
    const refined = byAc.get(c.ac);
    if (!refined) return { ...c, llm_refined: false, rationale: 'LLM did not return a ranking for this AC despite structural overlap -- kept, unrefined, rather than silently dropped.' };
    return { ...c, llm_refined: true, confidence: refined.confidence, rationale: refined.rationale };
  });

  // ACs the LLM found that the structural pass missed entirely -- added
  // with no `files` entries (they weren't structurally traced to a specific
  // changed file) but clearly marked as LLM-added, not structurally flagged,
  // so the mapping stays inspectable rather than silently expanding.
  const llmOnly = [...byAc.keys()]
    .filter((ac) => !structuralAcIds.has(ac))
    .map((ac) => ({
      ac,
      confidence: byAc.get(ac).confidence,
      rationale: `${byAc.get(ac).rationale} (LLM-identified; not structurally flagged by term overlap.)`,
      files: [],
      llm_refined: true,
      llm_only: true,
    }));

  return [...refinedExisting, ...llmOnly];
}

module.exports = { refineCandidates };
