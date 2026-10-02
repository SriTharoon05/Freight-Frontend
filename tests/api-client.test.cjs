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
