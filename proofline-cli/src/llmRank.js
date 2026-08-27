const https = require('https');

/**
 * Optional refinement step, applied only to the deterministic candidate set
 * (never the whole diff/repo). Requires ANTHROPIC_API_KEY. If it is not set,
 * this is a real no-op that says so explicitly -- it does not fabricate a
 * confidence score or rationale on the LLM's behalf.
 */
async function refineCandidates(diffText, candidates, acTexts) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return candidates.map((c) => ({
      ...c,
      llm_refined: false,
      rationale: 'ANTHROPIC_API_KEY not set -- using rule-based candidate as-is, unrefined.',
    }));
  }

  const prompt = [
    'You are ranking which acceptance criteria a code change actually puts at risk.',
    'You are given ONLY the diff and the narrowed candidate ACs -- not the full repo or PRD.',
    'For each candidate AC, return confidence (high|medium|low) and a one-sentence rationale grounded in the diff.',
    'Do not invent ACs that are not in the candidate list.',
    '',
    'CANDIDATE ACS:',
    candidates.map((c) => `${c.ac}: ${acTexts[c.ac] || ''}`).join('\n'),
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
  return candidates.map((c) => {
    const refined = byAc.get(c.ac);
    if (!refined) return { ...c, llm_refined: false, rationale: 'LLM did not return a ranking for this AC.' };
    return { ...c, llm_refined: true, confidence: refined.confidence, rationale: refined.rationale };
  });
}

module.exports = { refineCandidates };
