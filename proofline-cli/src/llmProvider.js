const https = require('https');
const { execFileSync } = require('child_process');

/**
 * Resolves how (or whether) Proofline can reach a model, in priority order:
 *
 *  1. ANTHROPIC_API_KEY  -- direct API call, pay-per-token.
 *  2. `claude` CLI       -- Claude Code's own CLI, which authenticates with
 *                           an existing Claude subscription rather than API
 *                           credits. This exists so the reasoning layer is
 *                           usable without paid API access: the deterministic
 *                           IDF mapper already produces ranked, confidence-
 *                           scored candidates on its own, and this is a
 *                           refinement on top of it, never a requirement.
 *  3. none               -- honest no-op; callers must degrade gracefully
 *                           and say so rather than fabricate a score.
 *
 * Returns { kind: 'api'|'cli'|'none', detail }.
 */
function detectProvider() {
  if (process.env.ANTHROPIC_API_KEY) {
    return { kind: 'api', detail: 'ANTHROPIC_API_KEY' };
  }
  try {
    const cmd = process.platform === 'win32' ? 'claude.cmd' : 'claude';
    execFileSync(cmd, ['--version'], {
      encoding: 'utf-8',
      stdio: 'pipe',
      shell: process.platform === 'win32',
      timeout: 20000,
    });
    return { kind: 'cli', detail: 'claude CLI' };
  } catch {
    return { kind: 'none', detail: null };
  }
}

function callApi(prompt) {
  const body = JSON.stringify({
    model: 'claude-sonnet-5',
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }],
  });

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: 'api.anthropic.com',
        path: '/v1/messages',
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': process.env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
          'content-length': Buffer.byteLength(body),
        },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          try {
            resolve(JSON.parse(data).content[0].text);
          } catch (err) {
            reject(new Error(`unparseable API response: ${err.message}`));
          }
        });
      }
    );
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function callCli(prompt) {
  // `claude -p` runs a single non-interactive prompt and prints the reply.
  const cmd = process.platform === 'win32' ? 'claude.cmd' : 'claude';
  return execFileSync(cmd, ['-p', prompt], {
    encoding: 'utf-8',
    stdio: ['pipe', 'pipe', 'pipe'],
    shell: process.platform === 'win32',
    maxBuffer: 10 * 1024 * 1024,
    timeout: 120000,
  });
}

/**
 * Sends one prompt through whichever provider is available.
 * Returns { text, provider } or throws.
 */
async function complete(prompt) {
  const provider = detectProvider();
  if (provider.kind === 'none') {
    const err = new Error('no model provider available');
    err.code = 'NO_PROVIDER';
    throw err;
  }
  const text = provider.kind === 'api' ? await callApi(prompt) : callCli(prompt);
  return { text, provider: provider.detail };
}

module.exports = { detectProvider, complete };
