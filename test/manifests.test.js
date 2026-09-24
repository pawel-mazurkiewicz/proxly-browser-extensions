/**
 * Tests for chrome/manifest.json and firefox/manifest.json.
 */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const manifest = (browser) => JSON.parse(fs.readFileSync(path.join(ROOT, browser, 'manifest.json'), 'utf8'));

for (const browser of ['chrome', 'firefox']) {
  test(`${browser}: nativeMessaging is optional only`, () => {
    const m = manifest(browser);
    assert.deepStrictEqual(m.optional_permissions, ['nativeMessaging']);
    assert.ok(!(m.permissions || []).includes('nativeMessaging'));
  });

  test(`${browser}: the published manifest has no key`, () => {
    assert.strictEqual(manifest(browser).key, undefined);
  });

  test(`${browser}: pages load the click-intent module before the content script`, () => {
    const scripts = manifest(browser).content_scripts[0].js;
    assert.ok(scripts.includes('shared/click-intent.js'));
    assert.ok(scripts.indexOf('shared/click-intent.js') < scripts.indexOf('content-script.js'));
  });

  test(`${browser}: every listed script exists`, () => {
    const m = manifest(browser);
    const listed = [
      ...m.content_scripts.flatMap((entry) => entry.js),
      ...(m.background.scripts || []),
      ...(m.background.service_worker ? [m.background.service_worker] : [])
    ];
    for (const file of listed) {
      assert.ok(fs.existsSync(path.join(ROOT, browser, file)), file);
    }
  });
}

test('firefox: the background loads the connector client before background.js', () => {
  const scripts = manifest('firefox').background.scripts;
  assert.ok(scripts.includes('shared/connector-client.js'));
  assert.ok(scripts.indexOf('shared/connector-client.js') < scripts.indexOf('background.js'));
});

test('both manifests carry the same version', () => {
  assert.strictEqual(manifest('chrome').version, manifest('firefox').version);
});
