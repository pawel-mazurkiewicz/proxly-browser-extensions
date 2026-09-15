/**
 * Tests for the background's connector messages, run against the shipping chrome/ and firefox/
 * background scripts with a fake extension API.
 */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const quiet = { log() {}, warn() {}, error() {}, debug() {}, info() {} };
const tick = () => new Promise((resolve) => setImmediate(resolve));

function fakeApi({ keepLinksInTab = false, permission = false, decision = 'passthrough' } = {}) {
  const state = { keepLinksInTab, permission, ports: [], stored: [] };
  const listeners = { message: [], storage: [], permissionsAdded: [], permissionsRemoved: [] };
  const event = (list) => ({ addListener: (fn) => list.push(fn) });
  const noopEvent = { addListener() {} };
  const api = {
    runtime: {
      lastError: undefined,
      // shared/constants.js calls this at load time to detect the browser; both backgrounds load
      // that file (Chrome via importScripts, Firefox via manifest background.scripts).
      getURL: () => '',
      onMessage: event(listeners.message),
      onInstalled: noopEvent,
      openOptionsPage() {},
      connectNative() {
        const onMessage = [];
        const port = {
          closed: false,
          onMessage: event(onMessage),
          onDisconnect: noopEvent,
          postMessage(message) {
            const reply = message.type === 'hello'
              ? { v: 1, id: message.id, connectorVersion: 1, browser: 'com.google.Chrome' }
              : { v: 1, id: message.id, decision };
            Promise.resolve().then(() => onMessage.forEach((fn) => fn(reply)));
          },
          disconnect() { port.closed = true; }
        };
        state.ports.push(port);
        return port;
      }
    },
    storage: {
      sync: {
        get: async (defaults) => ({ ...(typeof defaults === 'object' && defaults ? defaults : {}), keepLinksInTab: state.keepLinksInTab }),
        set: async (data) => { state.stored.push(data); }
      },
      onChanged: event(listeners.storage)
    },
    permissions: {
      contains: async () => state.permission,
      onAdded: event(listeners.permissionsAdded),
      onRemoved: event(listeners.permissionsRemoved)
    },
    contextMenus: { onClicked: noopEvent, removeAll: async () => {}, create() {}, update() {} },
    action: { setBadgeText: async () => {}, setBadgeBackgroundColor: async () => {} },
    browserAction: { setBadgeText: async () => {}, setBadgeBackgroundColor: async () => {} },
    tabs: { update: async () => {}, query: async () => [], sendMessage: async () => {} },
    i18n: { getMessage: () => '' }
  };
  return { api, state, listeners };
}

async function loadBackground(browser, options, { skipTicks = false } = {}) {
  const fake = fakeApi(options);
  const context = {
    console: quiet,
    URL,
    // Unref the connector's real setTimeout calls (its 300s idle timer in particular) so they
    // never hold the Node test process open; clearTimeout stays Node's real one.
    setTimeout: (fn, ms) => {
      const timer = setTimeout(fn, ms);
      timer.unref();
      return timer;
    },
    clearTimeout,
    setImmediate,
    btoa,
    chrome: fake.api,
    browser: fake.api
  };
  context.globalThis = context;
  if (browser === 'chrome') {
    // Only Chrome's service worker has importScripts; Firefox lists its background scripts in the manifest.
    context.importScripts = (...files) =>
      files.forEach((file) => vm.runInContext(fs.readFileSync(path.join(ROOT, 'chrome', file), 'utf8'), context));
  }
  vm.createContext(context);
  if (browser === 'firefox') {
    for (const file of require(path.join(ROOT, 'firefox', 'manifest.json')).background.scripts) {
      vm.runInContext(fs.readFileSync(path.join(ROOT, 'firefox', file), 'utf8'), context);
    }
  } else {
    vm.runInContext(fs.readFileSync(path.join(ROOT, 'chrome', 'background.js'), 'utf8'), context);
  }
  if (!skipTicks) {
    for (let i = 0; i < 5; i++) await tick();
  }
  const send = (message) => new Promise((resolve) => fake.listeners.message[0](message, { tab: { id: 1 } }, resolve));
  return { ...fake, send };
}

for (const browser of ['chrome', 'firefox']) {
  test(`${browser}: with the setting off, links go to Proxly and the connector is not started`, async () => {
    const bg = await loadBackground(browser, { keepLinksInTab: false, permission: true });
    assert.deepStrictEqual({ ...(await bg.send({ type: 'DECIDE_LINK', url: 'https://x.test/' })) }, { decision: 'reroute' });
    assert.strictEqual(bg.state.ports.length, 0);
  });

  test(`${browser}: without the permission, links go to Proxly`, async () => {
    const bg = await loadBackground(browser, { keepLinksInTab: true, permission: false });
    assert.strictEqual((await bg.send({ type: 'DECIDE_LINK', url: 'https://x.test/' })).decision, 'reroute');
    assert.strictEqual(bg.state.ports.length, 0);
  });

  test(`${browser}: with both, the connector's answer is returned`, async () => {
    const bg = await loadBackground(browser, { keepLinksInTab: true, permission: true });
    assert.strictEqual((await bg.send({ type: 'DECIDE_LINK', url: 'https://x.test/' })).decision, 'passthrough');
  });

  test(`${browser}: non-web URLs go to Proxly`, async () => {
    const bg = await loadBackground(browser, { keepLinksInTab: true, permission: true });
    assert.strictEqual((await bg.send({ type: 'DECIDE_LINK', url: 'javascript:alert(1)' })).decision, 'reroute');
  });

  test(`${browser}: status reports the connector and the calling browser`, async () => {
    const bg = await loadBackground(browser, { keepLinksInTab: true, permission: true });
    assert.deepStrictEqual({ ...(await bg.send({ type: 'CONNECTOR_STATUS' })) }, {
      enabled: true, connected: true, connectorVersion: 1, browser: 'com.google.Chrome'
    });
  });

  for (const newValue of [false, undefined]) {
    test(`${browser}: the setting changing to ${newValue} closes the connection`, async () => {
      const bg = await loadBackground(browser, { keepLinksInTab: true, permission: true });
      await bg.send({ type: 'DECIDE_LINK', url: 'https://x.test/' });
      bg.state.keepLinksInTab = false;
      // Reset to Defaults writes the other defaults and leaves keepLinksInTab untouched; a cleared
      // value (e.g. after storage.sync.clear()) arrives as undefined rather than false.
      bg.listeners.storage.forEach((fn) => fn({ keepLinksInTab: { oldValue: true, newValue } }, 'sync'));
      assert.strictEqual(bg.state.ports[0].closed, true);
    });
  }

  test(`${browser}: revoking the permission closes the connection at the next request`, async () => {
    const bg = await loadBackground(browser, { keepLinksInTab: true, permission: true });
    await bg.send({ type: 'DECIDE_LINK', url: 'https://x.test/' });
    bg.state.permission = false;
    const result = await bg.send({ type: 'DECIDE_LINK', url: 'https://x.test/' });
    assert.strictEqual(result.decision, 'reroute');
    assert.strictEqual(bg.state.ports[0].closed, true);
  });

  test(`${browser}: a message sent right after the background loads is answered`, async () => {
    const bg = await loadBackground(browser, { keepLinksInTab: false, permission: true }, { skipTicks: true });
    const result = await bg.send({ type: 'DECIDE_LINK', url: 'https://x.test/' });
    assert.deepStrictEqual({ ...result }, { decision: 'reroute' });
  });

  test(`${browser}: granting nativeMessaging turns "Keep links in this tab" on`, async () => {
    const bg = await loadBackground(browser, {});
    await Promise.all(bg.listeners.permissionsAdded.map((fn) => fn({ permissions: ['nativeMessaging'] })));
    // Objects from the vm sandbox have a different Object prototype than object literals written
    // here, so deepStrictEqual needs each entry copied into this realm first.
    assert.deepStrictEqual(bg.state.stored.map((entry) => ({ ...entry })), [{ keepLinksInTab: true }]);
  });

  test(`${browser}: removing nativeMessaging turns "Keep links in this tab" off`, async () => {
    const bg = await loadBackground(browser, {});
    await Promise.all(bg.listeners.permissionsRemoved.map((fn) => fn({ permissions: ['nativeMessaging'] })));
    assert.deepStrictEqual(bg.state.stored.map((entry) => ({ ...entry })), [{ keepLinksInTab: false }]);
  });

  test(`${browser}: granting an unrelated permission leaves the setting alone`, async () => {
    const bg = await loadBackground(browser, {});
    await Promise.all(bg.listeners.permissionsAdded.map((fn) => fn({ permissions: ['tabs'] })));
    await Promise.all(bg.listeners.permissionsRemoved.map((fn) => fn({ permissions: ['tabs'] })));
    assert.deepStrictEqual(bg.state.stored, []);
  });
}
