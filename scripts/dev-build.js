#!/usr/bin/env node
/**
 * Development copies of the extensions, for loading unpacked.
 *
 * The Chrome copy gets a fixed `key`, so its ID is always eepmdmkccgcnfmkomcjnhpopnecgoiof — the
 * development ID Proxly's Debug builds admit in their native messaging host files. The published
 * manifests never contain `key`.
 *
 * Usage: npm run dev   (writes build/dev/chrome and build/dev/firefox)
 */

const fs = require('fs');
const path = require('path');

const DEV_KEY =
  'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEApigtGYY0t8f0BfpF9kUqRqtjoij5zQELfR6mo9Q9YAIiQId/0UQPCbocNIoVFj1inDsQi+zJFfhRFqkDijy7GSG7pvlvAojtYz/TJlCWF/mIJ3Tv69XcWEsTg4Z1vWWZzm/uohtBo5FzmDHuDdLPJmO5mJYqt2zka2oWOxkNXjGS6AA7eAkm5T4UcONM/FOW66vMNuyntMX18K2hPuKIlbwtFl0DJinhPiJ12PtWRWkzwbWIuSTT4FAYgk0Te6NwEVH665m6Z2C5YyZgJZWPyk5zQUWCkF+DQxPb17E+4D5FgAXwEAuBvOXkMw9icWro9XuUQ2nQUvz9NzIOyqiKtwIDAQAB';

const ROOT = path.join(__dirname, '..');

function copyTree(from, to) {
  fs.rmSync(to, { recursive: true, force: true });
  fs.cpSync(from, to, { recursive: true, filter: (source) => path.basename(source) !== '.DS_Store' });
}

function buildDev(outDir = path.join(ROOT, 'build', 'dev')) {
  copyTree(path.join(ROOT, 'chrome'), path.join(outDir, 'chrome'));
  copyTree(path.join(ROOT, 'firefox'), path.join(outDir, 'firefox'));

  const manifestPath = path.join(outDir, 'chrome', 'manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  manifest.key = DEV_KEY;
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  return outDir;
}

module.exports = { buildDev, DEV_KEY };

if (require.main === module) {
  const out = buildDev();
  console.log(`Development builds written to ${path.relative(ROOT, out)}/chrome and ${path.relative(ROOT, out)}/firefox`);
}
