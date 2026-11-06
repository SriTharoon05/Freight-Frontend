const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');

// Verify the browser's local date is submitted as the matching UTC instant.
process.env.TZ = 'Asia/Kolkata';

function compile(file, requireModule) {
  const { outputText } = ts.transpileModule(readFileSync(path.join(__dirname, '..', file), 'utf8'), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020,
      jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
    },
  });
  const exports = {};
  vm.runInNewContext(outputText, { exports, require: requireModule, Date }, { filename: file });
  return exports;
}

function screen({ rejectSave = false } = {}) {
  const mailbox = {
    id: 'inbox-one', address: 'inbox@example.com', enabled: true,
    sync_from: '2026-10-01T05:30:00.000Z', last_synced_at: null, last_error: null,
  };
  let data = { items: [mailbox], total: 1, page: 1, limit: 20, manual_mode: true };
  const states = [];
  const requests = [];
  let hook = 0;
  const api = {
    async patch(url, body) {
      requests.push({ url, body });
      if (rejectSave) throw { status: 409, message: 'Inbox is syncing. Wait for it to finish.' };
      return { data: { ...data.items[0], ...body, last_synced_at: null, last_error: null } };
    },
  };
  const freight = compile('lib/freight.ts', name => {
    if (name === './api-client') return { api };
    throw new Error(`Unexpected import: ${name}`);
  });
  const client = {
    async invalidateQueries() {},
    setQueriesData(_filter, update) { data = update(data); },
  };
  const helpers = Object.fromEntries(['Panel', 'Field', 'ErrorBanner'].map(name => [name, props => props.children]));
  const { MailboxSettings } = compile('components/freight/mailbox-settings.tsx', name => {
    if (name === 'react') return { ...React, useState(initial) {
      const index = hook++;
      if (!(index in states)) states[index] = typeof initial === 'function' ? initial() : initial;
      return [states[index], next => { states[index] = typeof next === 'function' ? next(states[index]) : next; }];
    } };
    if (name === '@tanstack/react-query') return { useQuery: () => ({ data }), useQueryClient: () => client };
    if (name === 'sonner') return { toast: { success() {} } };
    if (name === '@/lib/api-client') return { api };
    if (name === '@/lib/freight') return freight;
    if (name === './shared') return { ...helpers, inputClass: '', buttonClass: '', secondaryClass: '' };
    return require(name);
  });
  return {
    render() { hook = 0; return MailboxSettings(); },
    requests,
    savedStart: () => data.items[0].sync_from,
  };
}

function elements(tree) {
  if (!tree || typeof tree !== 'object') return [];
  if (Array.isArray(tree)) return tree.flatMap(elements);
  return [tree, ...elements(tree.props?.children)];
}

function input(tree, label) {
  return elements(tree).find(node => node.type === 'input' && node.props['aria-label'] === label);
}

function button(tree, label) {
  return elements(tree).find(node => node.type === 'button' && node.props.children === label);
}

function dateForm(tree) {
  return elements(tree).find(node => node.type === 'form' && input(node, 'Import date for inbox@example.com'));
}

test('connected inbox date uses the saved cutoff instead of the new-connection date', () => {
  const ui = screen();
  let tree = ui.render();
  assert.equal(input(tree, 'Import date for inbox@example.com').props.value, '2026-10-01T11:00');
  assert.equal(elements(tree).find(node => node.type === 'time').props.dateTime, ui.savedStart());
  input(tree, 'Initial import date for a new inbox').props.onChange({ target: { value: '2026-09-30T09:45' } });
  tree = ui.render();
  assert.equal(input(tree, 'Import date for inbox@example.com').props.value, '2026-10-01T11:00');
  assert.equal(ui.requests.length, 0);
});

test('changed date must be saved before sync and is submitted in the correct timezone', async () => {
  const ui = screen();
  let tree = ui.render();
  input(tree, 'Import date for inbox@example.com').props.onChange({ target: { value: '2026-09-30T09:45' } });
  tree = ui.render();
  assert.equal(button(tree, 'Sync inbox').props.disabled, true);
  assert.equal(button(tree, 'Save import date').props.disabled, false);
  dateForm(tree).props.onSubmit({ preventDefault() {} });
  await new Promise(setImmediate);
  assert.equal(ui.requests.length, 1);
  assert.equal(ui.requests[0].url, '/integrations/outlook/mailboxes/inbox-one');
  assert.equal(ui.requests[0].body.sync_from, '2026-09-30T04:15:00.000Z');
  tree = ui.render();
  assert.equal(ui.savedStart(), '2026-09-30T04:15:00.000Z');
  assert.equal(button(tree, 'Sync inbox').props.disabled, false);
  assert.equal(button(tree, 'Save import date').props.disabled, true);
});

test('failed date save retains the draft and never presents it as the saved cutoff', async () => {
  const ui = screen({ rejectSave: true });
  let tree = ui.render();
  input(tree, 'Import date for inbox@example.com').props.onChange({ target: { value: '2026-09-30T09:45' } });
  tree = ui.render();
  dateForm(tree).props.onSubmit({ preventDefault() {} });
  await new Promise(setImmediate);
  tree = ui.render();
  assert.equal(ui.savedStart(), '2026-10-01T05:30:00.000Z');
  assert.equal(input(tree, 'Import date for inbox@example.com').props.value, '2026-09-30T09:45');
  assert.equal(elements(tree).find(node => node.type === 'time').props.dateTime, ui.savedStart());
  assert.equal(button(tree, 'Sync inbox').props.disabled, true);
  assert.equal(button(tree, 'Save import date').props.disabled, false);
});
