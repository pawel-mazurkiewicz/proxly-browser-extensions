/**
 * The "Keep links in this tab" messages exist in every locale, and Chrome and Firefox ship the same
 * messages.
 */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const KEYS = ['keepLinksTitle', 'keepLinksDescription', 'keepLinksOff', 'keepLinksReady', 'keepLinksNeedsSetup', 'keepLinksSetUp'];
const read = (browser, locale) => fs.readFileSync(path.join(ROOT, browser, '_locales', locale, 'messages.json'), 'utf8');

for (const locale of ['de', 'en', 'es', 'fr', 'pl']) {
  test(`${locale}: has the keep-links messages`, () => {
    const messages = JSON.parse(read('chrome', locale));
    for (const key of KEYS) {
      assert.ok(messages[key] && messages[key].message, key);
    }
  });

  test(`${locale}: chrome and firefox ship the same messages`, () => {
    assert.strictEqual(read('firefox', locale), read('chrome', locale));
  });
}
