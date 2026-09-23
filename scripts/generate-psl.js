#!/usr/bin/env node

/**
 * Generates the bundled public suffix table used by shared/same-site.js.
 *
 * Only rules containing a dot are kept. This is not a truncation: the Public Suffix List
 * algorithm falls back to the implicit "*" rule when nothing matches, which makes every
 * single-label rule ("com", "org", "uk") produce exactly the same registrable domain as no
 * rule at all. Dropping them is therefore lossless, and it removes ~1,400 of ~10,200 rules.
 *
 * Usage:
 *   node scripts/generate-psl.js [path/to/public_suffix_list.dat]
 *
 * With no argument the list is downloaded from publicsuffix.org.
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const { domainToASCII } = require('url');

const PSL_URL = 'https://publicsuffix.org/list/public_suffix_list.dat';

const TARGETS = [
  'chrome/shared/public-suffix-data.js',
  'firefox/shared/public-suffix-data.js',
  'proxly-safari-extension/Shared (Extension)/Resources/shared/public-suffix-data.js'
];

function download(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        if (res.statusCode !== 200) {
          reject(new Error(`Unexpected status ${res.statusCode} from ${url}`));
          return;
        }
        let body = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => {
          body += chunk;
        });
        res.on('end', () => resolve(body));
      })
      .on('error', reject);
  });
}

function parseRules(raw) {
  return raw
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('//'))
    .filter((line) => line.includes('.'))
    .map(toAsciiRule);
}

// The list writes internationalised rules in Unicode ("公司.cn"), but URL.hostname is always
// punycode ("xn--55qx5d.cn"), so a Unicode rule would never match. Keep the "!" and "*." prefixes.
function toAsciiRule(rule) {
  const prefix = rule.startsWith('!') ? '!' : rule.startsWith('*.') ? '*.' : '';
  const ascii = domainToASCII(rule.slice(prefix.length));
  if (!ascii) {
    throw new Error(`Cannot convert public suffix rule to ASCII: ${rule}`);
  }
  return prefix + ascii;
}

function render(rules) {
  // Stored as one newline-delimited string rather than an array literal: it parses far faster
  // than thousands of individual string tokens, and same-site.js builds the lookup lazily on
  // first use so pages where nothing is clicked never pay for it.
  const payload = rules.join('\n');
  return `/**
 * GENERATED FILE - DO NOT EDIT.
 * Regenerate with: node scripts/generate-psl.js
 *
 * Public suffix rules containing a dot, derived from ${PSL_URL}.
 * Single-label rules are omitted because the Public Suffix List's implicit "*" fallback
 * already yields the same registrable domain for them.
 *
 * Rules: ${rules.length}
 */

const PROXLY_PUBLIC_SUFFIX_RULES = ${JSON.stringify(payload)};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = PROXLY_PUBLIC_SUFFIX_RULES;
}
`;
}

async function main() {
  const localPath = process.argv[2];
  const raw = localPath
    ? fs.readFileSync(localPath, 'utf8')
    : await download(PSL_URL);

  const rules = parseRules(raw);
  if (rules.length < 5000) {
    throw new Error(`Only ${rules.length} rules parsed; refusing to write a suspiciously small table`);
  }

  const contents = render(rules);
  const projectRoot = path.resolve(__dirname, '..');

  for (const target of TARGETS) {
    const fullPath = path.join(projectRoot, target);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, contents, 'utf8');
    console.log(`wrote ${target} (${rules.length} rules, ${contents.length} bytes)`);
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
