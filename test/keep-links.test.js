/**
 * Tests for shared/keep-links.js — the "Keep links in this tab" setting.
 */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const ProxlyKeepLinks = require(path.join(__dirname, '..', 'chrome', 'shared', 'keep-links.js'));

const CONNECTED = { enabled: true, connected: true, connectorVersion: 1, browser: 'com.google.Chrome' };

function fakeApi({ grant = true, reply = CONNECTED } = {}) {
  const calls = { requested: 0, stored: [], updated: [] };
  const api = {
    permissions: { request: async () => { calls.requested += 1; return grant; } },
    storage: { sync: { set: async (items) => { calls.stored.push(items); } } },
    runtime: { sendMessage: async () => { if (reply instanceof Error) throw reply; return reply; } },
    tabs: { update: async (props) => { calls.updated.push(props); } }
  };
  return { api, calls };
}

test('turning it on asks for the permission and stores the answer', async () => {
  const { api, calls } = fakeApi({ grant: true });
  assert.strictEqual(await ProxlyKeepLinks.setEnabled(api, true), true);
  assert.strictEqual(calls.requested, 1);
  assert.deepStrictEqual(calls.stored, [{ keepLinksInTab: true }]);
});

test('a declined permission leaves it off', async () => {
  const { api, calls } = fakeApi({ grant: false });
  assert.strictEqual(await ProxlyKeepLinks.setEnabled(api, true), false);
  assert.deepStrictEqual(calls.stored, [{ keepLinksInTab: false }]);
});

test('turning it off does not touch the permission', async () => {
  const { api, calls } = fakeApi();
  assert.strictEqual(await ProxlyKeepLinks.setEnabled(api, false), false);
  assert.strictEqual(calls.requested, 0);
  assert.deepStrictEqual(calls.stored, [{ keepLinksInTab: false }]);
});

test('the permission is requested before anything else is awaited', () => {
  const { api, calls } = fakeApi();
  ProxlyKeepLinks.setEnabled(api, true); // deliberately not awaited
  assert.strictEqual(calls.requested, 1);
});

test('status passes the background answer through, and is off when it cannot be reached', async () => {
  assert.deepStrictEqual(await ProxlyKeepLinks.status(fakeApi().api), CONNECTED);
  assert.strictEqual((await ProxlyKeepLinks.status(fakeApi({ reply: new Error('no background') }).api)).enabled, false);
  assert.strictEqual((await ProxlyKeepLinks.status(fakeApi({ reply: null }).api)).enabled, false);
});

test('the wording follows the state', () => {
  assert.deepStrictEqual(ProxlyKeepLinks.describe({ enabled: false, connected: false }), { messageKey: 'keepLinksOff', showSetup: false });
  assert.deepStrictEqual(ProxlyKeepLinks.describe({ enabled: true, connected: false }), { messageKey: 'keepLinksNeedsSetup', showSetup: true });
  assert.deepStrictEqual(ProxlyKeepLinks.describe(CONNECTED), { messageKey: 'keepLinksReady', showSetup: false });
});

test('setup opens proxly://connect', async () => {
  const { api, calls } = fakeApi();
  await ProxlyKeepLinks.openSetup(api);
  assert.deepStrictEqual(calls.updated, [{ url: 'proxly://connect' }]);
});

test('attach wires the toggle, status line and setup button', async () => {
  const listeners = {};
  const control = (name) => ({ checked: false, style: {}, textContent: '', addEventListener: (type, fn) => { listeners[name] = fn; } });
  const toggle = control('toggle');
  const statusLine = control('status');
  const setupButton = control('setup');
  const { api, calls } = fakeApi({ reply: { enabled: true, connected: false, connectorVersion: null, browser: null } });
  let closed = 0;

  await ProxlyKeepLinks.attach({ api, toggle, statusLine, setupButton, getMessage: (key) => key, afterSetup: () => { closed += 1; } });
  assert.strictEqual(toggle.checked, true);
  assert.strictEqual(statusLine.textContent, 'keepLinksNeedsSetup');
  assert.strictEqual(setupButton.style.display, '');

  await listeners.setup();
  assert.deepStrictEqual(calls.updated, [{ url: 'proxly://connect' }]);
  assert.strictEqual(closed, 1);
});

test('chrome and firefox ship identical keep-links modules', () => {
  const read = (browser) => fs.readFileSync(path.join(__dirname, '..', browser, 'shared', 'keep-links.js'), 'utf8');
  assert.strictEqual(read('firefox'), read('chrome'));
});
