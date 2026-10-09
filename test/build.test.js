/**
 * Tests for scripts/build.js — the release packages must ship each platform's own files.
 */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ExtensionBuilder = require('../scripts/build.js');

const ROOT = path.join(__dirname, '..');

function tempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'proxly-build-'));
}

for (const platform of ['chrome', 'firefox']) {
  test(`${platform} release builds keep the platform's own icons`, async (t) => {
    t.mock.method(console, 'log', () => {});
    const out = tempDir();
    try {
      await new ExtensionBuilder({ buildDir: out }).buildPlatform(platform);

      const sourceIcons = path.join(ROOT, platform, 'icons');
      const icons = fs.readdirSync(sourceIcons).filter((name) => name.endsWith('.png'));
      assert.ok(icons.length > 0, `${platform}/icons has no icons to compare`);
      for (const icon of icons) {
        const built = fs.readFileSync(path.join(out, platform, 'icons', icon));
        const source = fs.readFileSync(path.join(sourceIcons, icon));
        assert.ok(built.equals(source), `${platform}/icons/${icon} was replaced in the build`);
      }
    } finally {
      fs.rmSync(out, { recursive: true, force: true });
    }
  });
}

test('a build with an icon missing fails instead of shipping a placeholder', async (t) => {
  t.mock.method(console, 'log', () => {});
  const dir = tempDir();
  try {
    const source = path.join(dir, 'src');
    fs.cpSync(path.join(ROOT, 'firefox'), path.join(source, 'firefox'), { recursive: true });
    fs.rmSync(path.join(source, 'firefox', 'icons', 'icon-48.png'));

    const builder = new ExtensionBuilder({ sourceDir: source, buildDir: path.join(dir, 'build') });
    await assert.rejects(builder.buildPlatform('firefox'), /icons\/icon-48\.png/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
