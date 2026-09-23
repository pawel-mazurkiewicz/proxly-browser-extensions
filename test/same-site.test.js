/**
 * Tests for shared/same-site.js — registrable-domain based link capture decisions.
 *
 * Run with: npm test
 */

const test = require('node:test');
const assert = require('node:assert');
const path = require('path');

const SHARED = path.join(__dirname, '..', 'chrome', 'shared');

global.PROXLY_PUBLIC_SUFFIX_RULES = require(path.join(SHARED, 'public-suffix-data.js'));
const ProxlySameSite = require(path.join(SHARED, 'same-site.js'));

const { registrableDomain, isSameSite } = ProxlySameSite;

test('registrable domain — single-label suffixes', () => {
  assert.strictEqual(registrableDomain('example.com'), 'example.com');
  assert.strictEqual(registrableDomain('www.example.com'), 'example.com');
  assert.strictEqual(registrableDomain('a.b.c.example.com'), 'example.com');
  assert.strictEqual(registrableDomain('example.org'), 'example.org');
});

test('registrable domain — multi-label ICANN suffixes', () => {
  assert.strictEqual(registrableDomain('example.co.uk'), 'example.co.uk');
  assert.strictEqual(registrableDomain('www.example.co.uk'), 'example.co.uk');
  assert.strictEqual(registrableDomain('shop.example.com.au'), 'example.com.au');
  assert.strictEqual(registrableDomain('example.co.jp'), 'example.co.jp');
});

test('registrable domain — private suffixes are honoured', () => {
  // Two GitHub Pages sites are genuinely different sites.
  assert.strictEqual(registrableDomain('alice.github.io'), 'alice.github.io');
  assert.strictEqual(registrableDomain('bob.github.io'), 'bob.github.io');
});

test('registrable domain — internationalised suffixes match the punycode hostnames URL gives us', () => {
  // 公司.cn is a public suffix; new URL('https://a.公司.cn/').hostname is 'a.xn--55qx5d.cn'.
  assert.strictEqual(new URL('https://a.公司.cn/').hostname, 'a.xn--55qx5d.cn');
  assert.strictEqual(registrableDomain('a.xn--55qx5d.cn'), 'a.xn--55qx5d.cn');
  assert.strictEqual(registrableDomain('www.a.xn--55qx5d.cn'), 'a.xn--55qx5d.cn');
  assert.strictEqual(isSameSite('a.xn--55qx5d.cn', 'b.xn--55qx5d.cn'), false);
});

test('registrable domain — a bare public suffix has no registrable domain above it', () => {
  assert.strictEqual(registrableDomain('co.uk'), 'co.uk');
  assert.strictEqual(registrableDomain('com'), 'com');
});

test('registrable domain — hosts where the concept does not apply', () => {
  assert.strictEqual(registrableDomain('localhost'), 'localhost');
  assert.strictEqual(registrableDomain('127.0.0.1'), '127.0.0.1');
  assert.strictEqual(registrableDomain('192.168.1.10'), '192.168.1.10');
  assert.strictEqual(registrableDomain('::1'), '::1');
  assert.strictEqual(registrableDomain(''), '');
});

test('registrable domain — normalisation', () => {
  assert.strictEqual(registrableDomain('WWW.Example.COM'), 'example.com');
  assert.strictEqual(registrableDomain('www.example.com.'), 'example.com');
});

test('same-site — the defects from proxly-releases#5', () => {
  // Subdomain navigation must not be captured.
  assert.strictEqual(isSameSite('www.example.com', 'docs.example.com'), true);
  // Scheme and port are irrelevant; these compare hostnames only.
  assert.strictEqual(isSameSite('example.com', 'example.com'), true);
  // Genuinely different sites are still captured.
  assert.strictEqual(isSameSite('other.com', 'example.com'), false);
});

test('same-site — dot boundary prevents suffix confusion', () => {
  assert.strictEqual(isSameSite('notexample.com', 'example.com'), false);
  assert.strictEqual(isSameSite('example.com.evil.com', 'example.com'), false);
});

test('same-site — multi-label suffixes', () => {
  assert.strictEqual(isSameSite('www.example.co.uk', 'shop.example.co.uk'), true);
  assert.strictEqual(isSameSite('other.co.uk', 'example.co.uk'), false);
});

test('same-site — private suffixes separate neighbours', () => {
  assert.strictEqual(isSameSite('bob.github.io', 'alice.github.io'), false);
  assert.strictEqual(isSameSite('alice.github.io', 'alice.github.io'), true);
});

test('same-site — a page served from a public suffix is not the same site as sites under it', () => {
  assert.strictEqual(isSameSite('foo.github.io', 'github.io'), false);
  assert.strictEqual(isSameSite('github.io', 'foo.github.io'), false);
  assert.strictEqual(isSameSite('github.io', 'github.io'), true);
});

test('same-site — localhost and IP hosts', () => {
  assert.strictEqual(isSameSite('localhost', 'localhost'), true);
  assert.strictEqual(isSameSite('127.0.0.1', 'localhost'), false);
  assert.strictEqual(isSameSite('127.0.0.1', '127.0.0.1'), true);
});

test('same-site — missing hostnames are not treated as same-site', () => {
  assert.strictEqual(isSameSite('', 'example.com'), false);
  assert.strictEqual(isSameSite('example.com', ''), false);
});

test('all three extension trees ship identical shared modules', () => {
  const fs = require('fs');
  const trees = [
    path.join(__dirname, '..', 'chrome', 'shared'),
    path.join(__dirname, '..', 'firefox', 'shared'),
    path.join(
      __dirname,
      '..',
      'proxly-safari-extension',
      'Shared (Extension)',
      'Resources',
      'shared'
    )
  ];

  for (const moduleName of ['same-site.js', 'public-suffix-data.js']) {
    const contents = trees.map((tree) => fs.readFileSync(path.join(tree, moduleName), 'utf8'));
    assert.strictEqual(contents[1], contents[0], `${moduleName} differs between chrome and firefox`);
    assert.strictEqual(contents[2], contents[0], `${moduleName} differs between chrome and safari`);
  }
});
