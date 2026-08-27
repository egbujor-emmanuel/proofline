// Tests the reasoning layer's parsing and its degradation behavior when no
// model provider is available. The no-provider path is the real, current
// state of this environment (no ANTHROPIC_API_KEY, no claude CLI), so this
// exercises the actual code path in use -- not a mock.
// Run with: node test/llmRank.test.js

const assert = require('assert');
const { refineCandidates, parseResponse, buildPrompt } = require('../src/llmRank');
const { detectProvider } = require('../src/llmProvider');

let passed = 0;
let failed = 0;

function test(name, fn) {
  const done = () => {
    console.log(`  PASS  ${name}`);
    passed++;
  };
  try {
    const r = fn();
    if (r && typeof r.then === 'function') {
      return r.then(done).catch((err) => {
        console.log(`  FAIL  ${name}\n        ${err.message}`);
        failed++;
      });
    }
    done();
  } catch (err) {
    console.log(`  FAIL  ${name}`);
    console.log(`        ${err.message}`);
    failed++;
  }
  return Promise.resolve();
}

const ALL_ACS = [
  { id: 'ac-1', text: 'After a successful upgrade the persisted plan is pro.' },
  { id: 'ac-2', text: 'A fresh fetch returns pro, not a cached value.' },
];

async function run() {
  await test('parseResponse accepts a bare JSON array', () => {
    const out = parseResponse('[{"ac":"ac-1","confidence":"high","rationale":"x"}]');
    assert.strictEqual(out[0].ac, 'ac-1');
  });

  await test('parseResponse tolerates code fences and surrounding prose', () => {
    const out = parseResponse('Here you go:\n```json\n[{"ac":"ac-2","confidence":"low","rationale":"y"}]\n```\nHope that helps!');
    assert.strictEqual(out[0].ac, 'ac-2');
  });

  await test('parseResponse throws on a response with no array', () => {
    assert.throws(() => parseResponse('I could not determine this.'), /no JSON array/);
  });

  await test('buildPrompt includes every live AC, not just the narrowed set', () => {
    const prompt = buildPrompt('diff', new Set(['ac-1']), ALL_ACS);
    assert.ok(prompt.includes('ac-1'), 'narrowed AC present');
    assert.ok(prompt.includes('ac-2'), 'non-narrowed AC must also be offered to the model');
  });

  await test('no provider -> keeps deterministic ranking, marks it unrefined, invents nothing', async () => {
    const provider = detectProvider();
    if (provider.kind !== 'none') {
      console.log(`        (skipped: a provider IS available here -- ${provider.detail})`);
      return;
    }
    const candidates = [{ ac: 'ac-1', confidence: 'high', score: 3.3, files: [] }];
    const out = await refineCandidates('some diff', candidates, ALL_ACS);
    assert.strictEqual(out.length, 1, 'must not add ACs when no model ran');
    assert.strictEqual(out[0].ac, 'ac-1');
    assert.strictEqual(out[0].confidence, 'high', 'deterministic confidence must survive');
    assert.strictEqual(out[0].llm_refined, false);
    assert.ok(/No model provider available/.test(out[0].rationale), 'must say why it was not refined');
  });

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

run();
