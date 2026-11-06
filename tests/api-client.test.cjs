const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const ts = require('typescript');
const axios = require('axios');

function compile(file, requireModule, globals = {}) {
  const source = readFileSync(path.join(__dirname, '..', file), 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  });
  const exports = {};
  vm.runInNewContext(outputText, { exports, require: requireModule, process: { env: {} }, ...globals }, { filename: file });
  return exports;
}

const { toApiError } = compile('lib/api-errors.ts', require);
const { retryRead } = compile('lib/query-policy.ts', require);

test('only temporary read failures receive bounded retries', () => {
  for (const status of [0, 408, 429, 500, 502, 503, 504]) {
    assert.equal(retryRead(0, { status }), true);
    assert.equal(retryRead(1, { status }), true);
    assert.equal(retryRead(2, { status }), false);
  }
  for (const status of [400, 401, 403, 404, 409, 422, -1]) {
    assert.equal(retryRead(0, { status }), false);
  }
  assert.equal(retryRead(0, { code: 'ERR_CANCELED' }), false);
});

test('normalized API errors retain status and field validation when handled twice', () => {
  const error = toApiError({ response: { status: 422, data: { detail: [{ loc: ['body', 'email'], msg: 'Invalid email' }] } } });
  assert.equal(toApiError(error), error);
  assert.equal(error.fieldErrors.email[0], 'Invalid email');
  assert.equal(error.status, 422);
});

test('proxy HTML, empty error bodies, and timeouts produce useful messages', () => {
  for (const data of [null, '<html>Unavailable</html>']) {
    assert.match(toApiError({ response: { status: 503, data } }).message, /temporarily unavailable/);
  }
  assert.match(toApiError({ code: 'ECONNABORTED', request: {} }).message, /timed out/);
  assert.equal(toApiError(null).status, -1);
});

function harness(refresh) {
  const storage = new Map([['freightos_token', 'expired'], ['freightos_refresh_token', 'refresh']]);
  const window = { location: { protocol: 'https:', href: '' } };
  const document = { cookie: '' };
  const localStorage = {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value),
    removeItem: (key) => storage.delete(key),
  };
  let refreshCalls = 0;
  const module = compile('lib/api-client.ts', (name) => {
    if (name === 'axios') return { create: axios.create, post: async (...args) => { refreshCalls++; return refresh(...args); } };
    if (name === './api-errors') return { toApiError };
    if (name === './mock/mock-adapter') return { installMockAdapter() {} };
    throw new Error(`Unexpected import: ${name}`);
  }, { window, document, localStorage });
  module.api.defaults.adapter = async (config) => {
    const response = { status: 200, statusText: 'OK', data: { ok: true }, headers: {}, config };
    if (config.headers.Authorization !== 'Bearer fresh') {
      response.status = 401;
      throw new axios.AxiosError('Unauthorized', 'ERR_BAD_REQUEST', config, {}, response);
    }
    return response;
  };
  return { ...module, storage, window, document, refreshCalls: () => refreshCalls };
}

test('ordinary reads tolerate cold starts without extending write or explicit timeouts', async () => {
  const client = harness(async () => { throw new Error('Refresh should not run'); });
  const requests = [];
  client.api.defaults.adapter = async config => {
    requests.push({ method: config.method, timeout: config.timeout });
    return { status: 200, statusText: 'OK', data: {}, headers: {}, config };
  };
  await client.api.get('/freight/rfqs');
  await client.api.post('/freight/rfqs', {});
  await client.api.get('/freight/rfqs', { timeout: 5000 });
  assert.deepEqual(requests, [
    { method: 'get', timeout: 90000 }, { method: 'post', timeout: 30000 },
    { method: 'get', timeout: 5000 },
  ]);
});

test('obsolete filter requests can be canceled through the freight client', async () => {
  const client = harness(async () => { throw new Error('Refresh should not run'); });
  const freight = compile('lib/freight.ts', name => {
    if (name === './api-client') return { api: client.api };
    return require(name);
  }).freight;
  const controller = new AbortController();
  controller.abort();
  let attempts = 0;
  client.api.defaults.adapter = async () => { attempts++; return { data: {} }; };
  await assert.rejects(freight.get('/email-requests', { status: 'pending' }, controller.signal));
  assert.equal(attempts, 0);
});

test('parallel expired requests share one refresh and retry with the new token', async () => {
  const client = harness(async (_, __, config) => {
    assert.equal(config.timeout, 90000);
    await new Promise((resolve) => setTimeout(resolve, 15));
    return { data: { access_token: 'fresh', refresh_token: 'rotated' } };
  });
  const responses = await Promise.all([client.api.get('/shipments'), client.api.get('/auth/me')]);
  assert.equal(responses.length, 2);
  assert.equal(client.refreshCalls(), 1);
  assert.equal(client.storage.get('freightos_token'), 'fresh');
  assert.equal(client.storage.get('freightos_refresh_token'), 'rotated');
  assert.match(client.document.cookie, /Secure/);
});

test('temporary refresh failure preserves the session so a later request can recover', async () => {
  let unavailable = true;
  const client = harness(async () => {
    if (unavailable) throw { response: { status: 503, data: null } };
    return { data: { access_token: 'fresh', refresh_token: 'rotated' } };
  });
  await assert.rejects(client.api.get('/shipments'), (error) => error.status === 503);
  assert.equal(client.storage.get('freightos_token'), 'expired');
  assert.equal(client.storage.get('freightos_refresh_token'), 'refresh');
  assert.equal(client.window.location.href, '');
  unavailable = false;
  assert.equal((await client.api.get('/shipments')).status, 200);
});

test('revoked refresh credentials clear both tokens and the route cookie', async () => {
  const client = harness(async () => { throw { response: { status: 401, data: { detail: 'Revoked' } } }; });
  await assert.rejects(client.api.get('/shipments'), (error) => error.status === 401);
  assert.equal(client.storage.size, 0);
  assert.match(client.document.cookie, /Max-Age=0/);
  assert.equal(client.window.location.href, '/login');
});

test('legacy paginated responses expose records to screens expecting items', async () => {
  const client = harness(async () => { throw new Error('Refresh should not run'); });
  client.api.defaults.adapter = async (config) => ({
    status: 200, statusText: 'OK', headers: {}, config,
    data: { data: [{ id: 'customer-one' }], total: 1, page: 1, limit: 20, pages: 1 },
  });
  const response = await client.api.get('/customers');
  assert.equal(response.data.items[0].id, 'customer-one');
  assert.equal(response.data.total, 1);
});

test('mailbox connection timeout tells users to check the result without replaying the POST', async () => {
  const client = harness(async () => { throw new Error('Refresh should not run'); });
  let requests = 0;
  client.api.defaults.adapter = async (config) => {
    requests++;
    throw new axios.AxiosError('timeout', 'ECONNABORTED', config, {});
  };
  await assert.rejects(
    client.api.post('/integrations/outlook/mailboxes', { address: 'inbox@example.com' }),
    (error) => error.status === 0 && /Refresh the inbox list/.test(error.message),
  );
  assert.equal(requests, 1);
  assert.equal(client.refreshCalls(), 0);
  assert.equal(client.storage.get('freightos_token'), 'expired');
});

test('reading the inbox list has the generic timeout message', () => {
  const error = toApiError({
    code: 'ETIMEDOUT',
    config: { method: 'get', url: '/integrations/outlook/mailboxes' },
  });
  assert.match(error.message, /request timed out/);
  assert.doesNotMatch(error.message, /already be connected|still be starting/);
});

test('actual Axios HTTP errors show the backend explanation despite their top-level status', () => {
  const config = { method: 'post', url: '/integrations/outlook/mailboxes' };
  const response = {
    status: 422, statusText: 'Unprocessable Entity', config, headers: {},
    data: { detail: 'Microsoft could not authorize this inbox.' },
  };
  const raw = new axios.AxiosError('Request failed with status code 422', 'ERR_BAD_REQUEST', config, {}, response);
  assert.equal(raw.status, 422);
  const error = toApiError(raw);
  assert.equal(error.message, response.data.detail);
  assert.equal(error.status, 422);
  assert.equal(toApiError(error), error);
});

test('actual Axios validation errors retain the rejected field and its explanation', () => {
  const config = { method: 'post', url: '/integrations/outlook/mailboxes' };
  const response = {
    status: 422, statusText: 'Unprocessable Entity', config, headers: {},
    data: { detail: [{ loc: ['body', 'sync_from'], msg: 'Import start cannot be in the future' }] },
  };
  const raw = new axios.AxiosError('Request failed with status code 422', 'ERR_BAD_REQUEST', config, {}, response);
  const error = toApiError(raw);
  assert.match(error.message, /sync_from: Import start cannot be in the future/);
  assert.equal(error.fieldErrors.sync_from[0], 'Import start cannot be in the future');
});
