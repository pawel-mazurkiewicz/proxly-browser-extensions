/**
 * Tests for scripts/dev-build.js — development copies with a pinned Chrome extension ID.
 */

const test = require('node:test');
const assert = require('node:assert');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { buildDev, DEV_KEY } = require('../scripts/dev-build.js');

/** Chrome's ID: the first 32 hex digits of SHA-256 over the DER key, with 0-f mapped to a-p. */
function extensionId(base64Key) {
  const hex = crypto.createHash('sha256').update(Buffer.from(base64Key, 'base64')).digest('hex').slice(0, 32);
  return hex.replace(/[0-9a-f]/g, (digit) => String.fromCharCode(97 + parseInt(digit, 16)));
}

test('the development key yields the ID Proxly Debug builds admit', () => {
  assert.strictEqual(extensionId(DEV_KEY), 'eepmdmkccgcnfmkomcjnhpopnecgoiof');
});

test('development copies pin the Chrome key and leave the published manifest alone', () => {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'proxly-dev-'));
  try {
    buildDev(out);
    const devManifest = JSON.parse(fs.readFileSync(path.join(out, 'chrome', 'manifest.json'), 'utf8'));
    const published = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'chrome', 'manifest.json'), 'utf8'));
    assert.strictEqual(devManifest.key, DEV_KEY);
    assert.strictEqual(published.key, undefined);
    assert.ok(fs.existsSync(path.join(out, 'firefox', 'manifest.json')));
  } finally {
    fs.rmSync(out, { recursive: true, force: true });
  }
});
