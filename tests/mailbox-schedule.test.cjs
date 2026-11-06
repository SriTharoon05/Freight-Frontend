const assert = require('node:assert/strict');
const test = require('node:test');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

async function scheduleWith({ secret = 'synthetic-only-secret-123456789012345', url = 'https://test.onrender.com/api/v1/integrations/outlook/scheduled-sync', response = 202, timeout = false } = {}) {
  const previousSecret = process.env.MAILBOX_SYNC_SECRET;
  const previousUrl = process.env.MAILBOX_SYNC_URL;
  const previousFetch = global.fetch;
  const calls = [];
  process.env.MAILBOX_SYNC_SECRET = secret;
  process.env.MAILBOX_SYNC_URL = url;
  global.fetch = async (endpoint, options) => {
    calls.push({ endpoint: String(endpoint), options });
    if (timeout) throw new DOMException('Synthetic cold start', 'TimeoutError');
    return new Response(null, { status: response });
  };
  try {
    const module = await import(pathToFileURL(path.join(__dirname, '../netlify/functions/mailbox-sync.mjs')));
    return { result: await module.default(), calls, config: module.config };
  } finally {
    if (previousSecret === undefined) delete process.env.MAILBOX_SYNC_SECRET; else process.env.MAILBOX_SYNC_SECRET = previousSecret;
    if (previousUrl === undefined) delete process.env.MAILBOX_SYNC_URL; else process.env.MAILBOX_SYNC_URL = previousUrl;
    global.fetch = previousFetch;
  }
}

test('scheduler uses the server secret and the protected backend route', async () => {
  const { result, calls, config } = await scheduleWith();
  assert.equal(result.status, 202);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].options.method, 'POST');
  assert.equal(calls[0].options.headers['X-Mailbox-Sync-Secret'], 'synthetic-only-secret-123456789012345');
  assert.equal(calls[0].options.redirect, 'error');
  assert.equal(config.schedule, '*/5 * * * *');
});

test('missing configuration stays inactive and malformed endpoints fail before sending secrets', async () => {
  assert.equal((await scheduleWith({ secret: '', url: '' })).result.status, 204);
  await assert.rejects(scheduleWith({ url: 'http://test.onrender.com/api/v1/integrations/outlook/scheduled-sync' }), /HTTPS/);
  await assert.rejects(scheduleWith({ secret: 'too-short' }), /server secret/);
  await assert.rejects(scheduleWith({ url: 'https://test.onrender.com/wrong' }), /HTTPS/);
});

test('cold starts can resume on the next schedule and authentication errors remain failures', async () => {
  assert.equal((await scheduleWith({ timeout: true })).result.status, 202);
  await assert.rejects(scheduleWith({ response: 401 }), /schedule failed/);
});
