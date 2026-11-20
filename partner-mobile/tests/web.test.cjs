const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { webcrypto } = require('node:crypto');
const { IDBFactory } = require('fake-indexeddb');
const { stripTypeScriptTypes } = require('node:module');
const babel = require('@babel/core');

function compile(file, globals = {}, requireModule = require) {
  const source = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
  const output = babel.transformSync(stripTypeScriptTypes(source, { mode: 'transform' }), {
    configFile: false, babelrc: false, plugins: ['@babel/plugin-transform-modules-commonjs'],
  }).code;
  const exports = {};
  vm.runInNewContext(output, { exports, require: requireModule, console, TextEncoder, TextDecoder, Uint8Array, URL, ...globals });
  return exports;
}

test('web offline work is encrypted, ordered, idempotent, retained on reload and cleared at sign-out', async () => {
  const indexedDB = new IDBFactory();
  const globals = { window: { isSecureContext: true, indexedDB }, indexedDB, crypto: webcrypto };
  const store = compile('src/store.web.ts', globals);
  await store.remember('owner', 'account-a');
  await store.remember('task:one', { id: 'one', briefing: 'Private shipment notes' });
  await store.enqueue('one', 'upload', { bytes: 'Private proof bytes' }, 'upload-id');
  await store.enqueue('one', 'action', { action: 'submit-completion' }, 'action-id');
  await store.enqueue('one', 'action', { action: 'changed duplicate' }, 'action-id');
  assert.deepEqual(Array.from(await store.pending(), item => item.id), ['upload-id', 'action-id']);
  assert.equal((await store.localTask('one')).briefing, 'Private shipment notes');
  const connection = await store.db();
  const read = (name, id) => new Promise((resolve, reject) => {
    const request = connection.transaction(name).objectStore(name).get(id);
    request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
  });
  const row = await read('cache', 'task:one');
  assert.equal(row.briefing, undefined);
  assert.ok(row.encrypted.byteLength > 0);
  const key = await read('keys', 'encryption');
  assert.equal(key.extractable, false);
  await assert.rejects(() => webcrypto.subtle.exportKey('raw', key));
  const reopened = compile('src/store.web.ts', globals);
  assert.equal(await reopened.cache('owner'), 'account-a');
  assert.equal((await reopened.pending()).length, 2);
  await reopened.fail('action-id', 'New instructions need review');
  assert.equal((await reopened.pending())[1].error, 'New instructions need review');
  await reopened.discardResource('one');
  assert.equal((await reopened.pending()).length, 0);
  await reopened.wipe();
  assert.equal(await reopened.cache('owner'), null);
  assert.equal(await reopened.localTask('one'), null);
  await reopened.remember('owner', 'account-b');
  assert.equal(await reopened.cache('owner'), 'account-b');
});

test('browser proof cannot fetch arbitrary remote URLs or accept unsupported file types', async () => {
  const store = compile('src/store.web.ts', { crypto: webcrypto });
  await assert.rejects(() => store.saveProof('one', 'https://private.example/document', 'photo', 'image/jpeg'), /local/);
  await assert.rejects(() => store.saveProof('one', 'blob:local', 'photo', 'text/html'), /JPEG/);
});

test('Google web callback exchanges only its one-time PKCE code and clears it', async () => {
  const values = new Map([['freight-partner-web-code', 'one-time-test-code']]);
  let options, exchanged;
  const auth = { exchangeCodeForSession: async code => { exchanged = code; return { error: null }; } };
  const storage = { getItem: key => values.get(key) ?? null, removeItem: key => values.delete(key) };
  const web = compile('src/auth.web.ts', { window: { sessionStorage: storage }, sessionStorage: storage }, name => {
    if (name === 'expo-constants') return { default: { expoConfig: { extra: { apiUrl: 'https://network.test', supabaseUrl: 'https://auth.test', supabaseAnonKey: 'public-test-key' } } } };
    if (name === '@supabase/supabase-js') return { createClient: (_url, _key, config) => { options = config; return { auth }; } };
    throw new Error(name);
  });
  await web.completeGoogleSignIn();
  assert.equal(exchanged, 'one-time-test-code');
  assert.equal(values.size, 0);
  assert.equal(options.auth.flowType, 'pkce');
  assert.equal(options.auth.detectSessionInUrl, false);
  assert.equal(options.auth.storageKey, 'freight-partner-web-google');
  values.set('freight-partner-web-error', 'Sign-in canceled');
  await assert.rejects(() => web.completeGoogleSignIn(), /canceled/);
  assert.equal(values.size, 0);
});

test('browser tracking never watches a delegated or completed trip and stops when hidden', async () => {
  let watched = 0, cleared = 0, visibilityChanged;
  const document = { visibilityState: 'visible', addEventListener: (_name, cb) => { visibilityChanged = cb; } };
  const task = { id: 'one', kind: 'pickup', status: 'in_progress', tracking_status: 'active', tracking_session_id: 'session-one' };
  const api = async () => task;
  const domain = compile('src/domain.ts');
  const tracking = compile('src/tracking.web.ts', {
    crypto: webcrypto,
    window: { isSecureContext: true, addEventListener() {} }, document,
    navigator: { permissions: { query: async () => ({ state: 'granted' }) }, geolocation: {
      watchPosition: () => ++watched, clearWatch: () => { cleared++; },
    } },
  }, name => name === './auth' ? { api } : name === './store' ? { enqueue: async () => {} } : name === './domain' ? domain : require(name));
  await tracking.track({ ...task, driver: { id: 'delegated-driver' } });
  assert.equal(watched, 0);
  await tracking.track(task);
  assert.equal(watched, 1);
  document.visibilityState = 'hidden'; visibilityChanged();
  assert.equal(cleared, 1);
  await tracking.track(task);
  assert.equal(watched, 1);
  document.visibilityState = 'visible';
  await tracking.track({ ...task, status: 'completed' });
  assert.equal(watched, 1);
});
