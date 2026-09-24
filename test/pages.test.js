/**
 * Tests for the popup and options pages' "Keep links in this tab" wiring.
 */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const read = (...segments) => fs.readFileSync(path.join(ROOT, ...segments), 'utf8');

const REQUIRED_IDS = ['keep-links-toggle', 'keep-links-status', 'keep-links-setup'];

for (const browser of ['chrome', 'firefox']) {
  test(`${browser}: popup.html loads shared/keep-links.js before popup.js`, () => {
    const html = read(browser, 'popup.html');
    const keepLinksIndex = html.indexOf('<script src="shared/keep-links.js"></script>');
    const popupIndex = html.indexOf('<script src="popup.js"></script>');
    assert.ok(keepLinksIndex !== -1, 'popup.html should load shared/keep-links.js');
    assert.ok(popupIndex !== -1, 'popup.html should load popup.js');
    assert.ok(keepLinksIndex < popupIndex, 'shared/keep-links.js must load before popup.js');
  });

  test(`${browser}: options.html loads ../shared/keep-links.js before options.js`, () => {
    const html = read(browser, 'options', 'options.html');
    const keepLinksIndex = html.indexOf('<script src="../shared/keep-links.js"></script>');
    const optionsIndex = html.indexOf('<script src="options.js"></script>');
    assert.ok(keepLinksIndex !== -1, 'options.html should load ../shared/keep-links.js');
    assert.ok(optionsIndex !== -1, 'options.html should load options.js');
    assert.ok(keepLinksIndex < optionsIndex, '../shared/keep-links.js must load before options.js');
  });

  test(`${browser}: popup.html contains the keep-links controls`, () => {
    const html = read(browser, 'popup.html');
    for (const id of REQUIRED_IDS) {
      assert.ok(html.includes(`id="${id}"`), `popup.html should contain id="${id}"`);
    }
  });

  test(`${browser}: options.html contains the keep-links controls`, () => {
    const html = read(browser, 'options', 'options.html');
    for (const id of REQUIRED_IDS) {
      assert.ok(html.includes(`id="${id}"`), `options.html should contain id="${id}"`);
    }
  });
}
