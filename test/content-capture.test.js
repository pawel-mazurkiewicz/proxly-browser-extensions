/**
 * Tests for the content scripts' capture path: which links stay in the tab and which go to Proxly.
 * Runs the shipping chrome/ and firefox/ content scripts with a fake page and extension API.
 */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const quiet = { log() {}, warn() {}, error() {}, debug() {}, info() {} };
const tick = () => new Promise((resolve) => setImmediate(resolve));
const LINK = 'https://other.example/page';
const PROXLY_LINK = `proxly://open/${Buffer.from(LINK).toString('base64')}`;
const SETTINGS = { enabled: true, linkMode: 'all', visualFeedback: true, soundFeedback: false };

/** `decide(message)` is the background's answer to DECIDE_LINK and may return a promise. */
async function loadContentScript(browser, { keepLinksInTab = true, decide = () => ({ decision: 'passthrough' }) } = {}) {
  const sent = [];
  const storageListeners = [];
  const page = { assigned: [], proxly: [] };
  const location = {
    get href() { return 'https://docs.example.com/start'; },
    set href(url) { page.proxly.push(url); },
    assign(url) { page.assigned.push(url); }
  };
  const element = () => ({ style: {}, appendChild() {}, setAttribute() {}, parentNode: null });
  const document = {
    readyState: 'complete',
    baseURI: 'https://docs.example.com/start',
    addEventListener() {},
    querySelector: () => null,
    getElementById: () => null,
    createElement: element,
    head: element(),
    body: element()
  };
  const api = {
    runtime: {
      id: 'test-extension',
      sendMessage: async (message) => {
        sent.push(message);
        return message.type === 'DECIDE_LINK' ? decide(message) : { ...SETTINGS };
      },
      onMessage: { addListener() {} }
    },
    storage: {
      sync: { get: async () => ({ ...SETTINGS, keepLinksInTab }) },
      onChanged: { addListener: (fn) => storageListeners.push(fn) }
    },
    i18n: { getMessage: () => '' }
  };
  const context = vm.createContext({
    console: quiet, URL, setTimeout, clearTimeout, btoa, document, window: { location }, chrome: api, browser: api
  });
  for (const file of ['shared/localization.js', 'shared/click-intent.js', 'content-script.js']) {
    vm.runInContext(fs.readFileSync(path.join(ROOT, browser, file), 'utf8'), context);
  }
  // The script starts its own instance; the test drives a second one it can reach.
  const script = vm.runInContext('new ProxlyContentScript()', context);
  for (let i = 0; i < 5; i++) await tick();
  let feedback = 0;
  script.showCaptureFeedback = () => { feedback += 1; };
  return {
    script,
    context,
    page,
    storageListeners,
    feedback: () => feedback,
    decisions: () => sent.filter((message) => message.type === 'DECIDE_LINK')
  };
}

const anchor = (attrs = {}) => ({ getAttribute: (name) => (name in attrs ? attrs[name] : null) });
const plainClick = { button: 0, isTrusted: true };

for (const browser of ['chrome', 'firefox']) {
  test(`${browser}: a link Proxly would open here stays in the tab, without the indicator`, async () => {
    const cs = await loadContentScript(browser);
    await cs.script.captureLink(LINK, anchor(), plainClick);
    assert.deepStrictEqual(cs.page.assigned, [LINK]);
    assert.deepStrictEqual(cs.page.proxly, []);
    assert.strictEqual(cs.feedback(), 0);
  });

  test(`${browser}: a link Proxly would reroute goes to Proxly, with the indicator`, async () => {
    const cs = await loadContentScript(browser, { decide: () => ({ decision: 'reroute' }) });
    await cs.script.captureLink(LINK, anchor(), plainClick);
    assert.deepStrictEqual(cs.page.proxly, [PROXLY_LINK]);
    assert.deepStrictEqual(cs.page.assigned, []);
    assert.strictEqual(cs.feedback(), 1);
  });

  test(`${browser}: with the setting off, the background is not asked`, async () => {
    const cs = await loadContentScript(browser, { keepLinksInTab: false });
    await cs.script.captureLink(LINK, anchor(), plainClick);
    assert.strictEqual(cs.decisions().length, 0);
    assert.deepStrictEqual(cs.page.proxly, [PROXLY_LINK]);
  });

  test(`${browser}: modified clicks and new-window links go straight to Proxly`, async () => {
    const cs = await loadContentScript(browser);
    await cs.script.captureLink(LINK, anchor(), { button: 0, metaKey: true, isTrusted: true });
    await cs.script.captureLink(LINK, anchor({ target: '_blank' }), plainClick);
    assert.strictEqual(cs.decisions().length, 0);
    assert.strictEqual(cs.page.proxly.length, 2);
  });

  test(`${browser}: no answer in time sends the link to Proxly`, async () => {
    const cs = await loadContentScript(browser, { decide: () => new Promise(() => {}) });
    cs.script.decideTimeoutMs = 20;
    await cs.script.captureLink(LINK, anchor(), plainClick);
    assert.deepStrictEqual(cs.page.proxly, [PROXLY_LINK]);
    assert.deepStrictEqual(cs.page.assigned, []);
  });

  test(`${browser}: a failed request sends the link to Proxly`, async () => {
    const cs = await loadContentScript(browser, {
      decide: () => Promise.reject(new Error('Extension context invalidated.'))
    });
    await cs.script.captureLink(LINK, anchor(), plainClick);
    assert.deepStrictEqual(cs.page.proxly, [PROXLY_LINK]);
  });

  test(`${browser}: turning the setting on applies without reloading the page`, async () => {
    const cs = await loadContentScript(browser, { keepLinksInTab: false });
    cs.storageListeners.forEach((fn) => fn({ keepLinksInTab: { newValue: true } }, 'sync'));
    await cs.script.captureLink(LINK, anchor(), plainClick);
    assert.deepStrictEqual(cs.page.assigned, [LINK]);
  });

  test(`${browser}: an untrusted click sends the link to Proxly`, async () => {
    const cs = await loadContentScript(browser);
    await cs.script.captureLink(LINK, anchor(), { button: 0, isTrusted: false });
    assert.strictEqual(cs.decisions().length, 0);
    assert.deepStrictEqual(cs.page.proxly, [PROXLY_LINK]);
    assert.deepStrictEqual(cs.page.assigned, []);
  });

  test(`${browser}: a rel="noopener noreferrer" link sends the link to Proxly`, async () => {
    const cs = await loadContentScript(browser);
    await cs.script.captureLink(LINK, anchor({ rel: 'noopener noreferrer' }), plainClick);
    assert.strictEqual(cs.decisions().length, 0);
    assert.deepStrictEqual(cs.page.proxly, [PROXLY_LINK]);
    assert.deepStrictEqual(cs.page.assigned, []);
  });

  test(`${browser}: a link with referrerpolicy="no-referrer" sends the link to Proxly`, async () => {
    const cs = await loadContentScript(browser);
    await cs.script.captureLink(LINK, anchor({ referrerpolicy: 'no-referrer' }), plainClick);
    assert.strictEqual(cs.decisions().length, 0);
    assert.deepStrictEqual(cs.page.proxly, [PROXLY_LINK]);
    assert.deepStrictEqual(cs.page.assigned, []);
  });

  test(`${browser}: ProxlyClickIntent.isPlainNavigation throwing sends the link to Proxly`, async () => {
    const cs = await loadContentScript(browser);
    vm.runInContext(
      "ProxlyClickIntent.isPlainNavigation = () => { throw new Error('mis-packaged build'); };",
      cs.context
    );
    await cs.script.captureLink(LINK, anchor(), plainClick);
    assert.strictEqual(cs.decisions().length, 0);
    assert.deepStrictEqual(cs.page.proxly, [PROXLY_LINK]);
    assert.deepStrictEqual(cs.page.assigned, []);
  });
}
