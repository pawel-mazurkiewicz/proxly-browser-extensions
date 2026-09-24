/**
 * Tests for shared/click-intent.js — which clicks may stay in the current tab.
 */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const ProxlyClickIntent = require(path.join(__dirname, '..', 'chrome', 'shared', 'click-intent.js'));
const { isPlainNavigation } = ProxlyClickIntent;

function anchor(attrs = {}) {
  return { getAttribute: (name) => (name in attrs ? attrs[name] : null) };
}

function page(baseTarget = null) {
  return {
    querySelector: (selector) =>
      selector === 'base[target]' && baseTarget ? { getAttribute: () => baseTarget } : null
  };
}

test('a plain primary click stays in the tab', () => {
  assert.strictEqual(isPlainNavigation(anchor(), { button: 0 }, page()), true);
});

test('keyboard activation has no button and stays in the tab', () => {
  assert.strictEqual(isPlainNavigation(anchor(), { key: 'Enter' }, page()), true);
});

test('any modifier key sends the link to Proxly', () => {
  for (const modifier of ['metaKey', 'ctrlKey', 'shiftKey', 'altKey']) {
    assert.strictEqual(isPlainNavigation(anchor(), { button: 0, [modifier]: true }, page()), false, modifier);
  }
});

test('a middle click sends the link to Proxly', () => {
  assert.strictEqual(isPlainNavigation(anchor(), { button: 1 }, page()), false);
});

test('targets that mean this tab stay; any other target does not', () => {
  for (const target of ['_self', '_top', '_parent', '_SELF', ' _self ']) {
    assert.strictEqual(isPlainNavigation(anchor({ target }), { button: 0 }, page()), true, target);
  }
  for (const target of ['_blank', 'popup']) {
    assert.strictEqual(isPlainNavigation(anchor({ target }), { button: 0 }, page()), false, target);
  }
});

test('<base target> applies when the link has no target of its own', () => {
  assert.strictEqual(isPlainNavigation(anchor(), { button: 0 }, page('_blank')), false);
  assert.strictEqual(isPlainNavigation(anchor({ target: '_self' }), { button: 0 }, page('_blank')), true);
});

test('chrome and firefox ship identical click-intent modules', () => {
  const read = (browser) => fs.readFileSync(path.join(__dirname, '..', browser, 'shared', 'click-intent.js'), 'utf8');
  assert.strictEqual(read('firefox'), read('chrome'));
});
