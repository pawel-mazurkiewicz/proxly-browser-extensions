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
  const state = { keepLinksInTab, ports: [] };
  const listeners = { message: [], storage: [] };
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
        set: async () => {}
      },
      onChanged: event(listeners.storage)
    },
    permissions: { contains: async () => permission },
    contextMenus: { onClicked: noopEvent, removeAll: async () => {}, create() {}, update() {} },
    action: { setBadgeText: async () => {}, setBadgeBackgroundColor: async () => {} },
    browserAction: { setBadgeText: async () => {}, setBadgeBackgroundColor: async () => {} },
    tabs: { update: async () => {}, query: async () => [], sendMessage: async () => {} },
    i18n: { getMessage: () => '' }
  };
  return { api, state, listeners };
}

async function loadBackground(browser, options) {
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
  for (let i = 0; i < 5; i++) await tick(); // Firefox registers its listeners after async setup.
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
      // Reset to Defaults clears storage, so the new value can be undefined rather than false.
      bg.listeners.storage.forEach((fn) => fn({ keepLinksInTab: { oldValue: true, newValue } }, 'sync'));
      assert.strictEqual(bg.state.ports[0].closed, true);
    });
  }
}
