/**
 * Same-site determination for link capture.
 *
 * The extension must only intercept links that genuinely leave the current site. Comparing
 * origins (scheme + host + port) treats docs.example.com -> www.example.com, http -> https and
 * a port change as "external", which caused Proxly to hijack ordinary in-site navigation.
 *
 * Sites are compared by registrable domain (eTLD+1) instead, resolved through the Public Suffix
 * List so that co.uk, github.io and friends behave correctly.
 */

const ProxlySameSite = (() => {
  let ruleIndex = null;

  /** Builds the rule lookup on first use so pages with no link clicks never pay for it. */
  function getRules() {
    if (ruleIndex) {
      return ruleIndex;
    }

    const normal = new Set();
    const wildcard = new Set();
    const exception = new Set();

    const raw =
      typeof PROXLY_PUBLIC_SUFFIX_RULES !== 'undefined' ? PROXLY_PUBLIC_SUFFIX_RULES : '';

    for (const line of raw.split('\n')) {
      if (!line) {
        continue;
      }
      if (line.startsWith('!')) {
        exception.add(line.slice(1));
      } else if (line.startsWith('*.')) {
        wildcard.add(line.slice(2));
      } else {
        normal.add(line);
      }
    }

    ruleIndex = { normal, wildcard, exception };
    return ruleIndex;
  }

  function isIpAddress(hostname) {
    // IPv4, or bracketed/colon-bearing IPv6.
    return /^\d{1,3}(\.\d{1,3}){3}$/.test(hostname) || hostname.includes(':');
  }

  /**
   * Returns the registrable domain (eTLD+1) for a hostname, or the hostname itself when the
   * concept does not apply (IP addresses, single-label hosts such as "localhost").
   */
  function registrableDomain(hostname) {
    if (!hostname) {
      return '';
    }

    let host = hostname.toLowerCase();
    if (host.endsWith('.')) {
      host = host.slice(0, -1);
    }

    if (isIpAddress(host)) {
      return host;
    }

    const labels = host.split('.');
    if (labels.length < 2) {
      return host;
    }

    const { normal, wildcard, exception } = getRules();

    // Public Suffix List algorithm: an exception rule wins outright, otherwise the longest
    // matching rule applies. Only rules with a dot are bundled; for everything else the
    // implicit "*" rule leaves the public suffix at the final label, which the default below
    // already expresses.
    for (let index = 0; index < labels.length; index++) {
      const candidate = labels.slice(index).join('.');
      if (exception.has(candidate)) {
        // The matching label is removed from the suffix, so the candidate itself is registrable.
        return candidate;
      }
    }

    let suffixLabelCount = 1;
    for (let index = 0; index < labels.length; index++) {
      const candidate = labels.slice(index).join('.');
      const candidateLabelCount = labels.length - index;

      if (normal.has(candidate)) {
        suffixLabelCount = Math.max(suffixLabelCount, candidateLabelCount);
      }
      if (wildcard.has(candidate)) {
        // "*.foo" makes any single label under foo part of the suffix.
        suffixLabelCount = Math.max(suffixLabelCount, candidateLabelCount + 1);
      }
    }

    if (suffixLabelCount >= labels.length) {
      // The whole hostname is a public suffix; there is no registrable domain above it.
      return host;
    }

    return labels.slice(labels.length - suffixLabelCount - 1).join('.');
  }

  /**
   * True when a link should be treated as belonging to the same site as the page, and therefore
   * left alone. Scheme and port are deliberately ignored.
   */
  function isSameSite(linkHostname, pageHostname) {
    if (!linkHostname || !pageHostname) {
      return false;
    }

    const link = linkHostname.toLowerCase();
    const page = pageHostname.toLowerCase();

    if (link === page) {
      return true;
    }

    const pageDomain = registrableDomain(page);
    if (!pageDomain) {
      return false;
    }

    // The dot boundary stops "notexample.com" matching "example.com".
    return link === pageDomain || link.endsWith('.' + pageDomain);
  }

  return { registrableDomain, isSameSite };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = ProxlySameSite;
}
