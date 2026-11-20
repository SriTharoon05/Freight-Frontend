const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = require('node:module').stripTypeScriptTypes(fs.readFileSync(require('node:path').join(__dirname, '../src/domain.ts'), 'utf8')).replace(/^export /gm, '') + '\nexports.assertCurrent = assertCurrent; exports.optimistic = optimistic; exports.needsTracking = needsTracking;';
const moduleExports = {}; vm.runInNewContext(source, { exports: moduleExports, Error });
const { assertCurrent, optimistic, needsTracking } = moduleExports;
const task = { id: 'task', version: 4, brief_version: 2, kind: 'pickup', status: 'in_progress', tracking_session_id: 'session', tracking_status: 'active' };
test('queued progress preserves the server version sequence', () => {
  const updated = optimistic(task, 'progress'); assert.equal(updated.version, 5); assert.equal(updated.pending_sync, true);
  const completed = optimistic(updated, 'submit-completion'); assert.equal(completed.version, 6); assert.equal(completed.status, 'awaiting_verification');
});
test('revised or cancelled work cannot silently synchronize old instructions', () => {
  const payload = { body: { version: 4, brief_version: 2, captured_at: '2026-10-11T10:00:00Z' } };
  assert.doesNotThrow(() => assertCurrent(task, payload));
  assert.throws(() => assertCurrent({ ...task, brief_version: 3 }, payload), /instructions changed/);
  assert.throws(() => assertCurrent({ ...task, version: 5 }, payload), /instructions changed/);
  assert.throws(() => assertCurrent({ ...task, status: 'cancelled' }, payload), /closed/);
  assert.equal(payload.body.captured_at, '2026-10-11T10:00:00Z');
});
test('GPS only runs for active transport and stops at submission or revocation', () => {
  assert.equal(needsTracking(task), true);
  for (const change of [{ kind: 'customs_import' }, { status: 'awaiting_verification' }, { status: 'cancelled' }, { tracking_status: 'denied' }, { tracking_session_id: null }]) assert.equal(needsTracking({ ...task, ...change }), false);
});

test('a transport agent never shares their own GPS for an assigned driver', () => {
  assert.equal(needsTracking({ ...task, driver: { id: 'driver-assignment' } }), false);
});
