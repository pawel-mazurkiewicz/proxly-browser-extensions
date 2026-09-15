/**
 * Which clicks may stay in the current tab.
 *
 * Only an ordinary click that would navigate this tab may be left in place when Proxly would not
 * reroute it. Modified clicks, middle clicks and links aimed at another window already end up in a new
 * tab through Proxly, which is what the user asked for. Ported from the Safari extension in the proxly
 * repo (SafariExtension/Resources/content.js, isPlainNavigation).
 */

const ProxlyClickIntent = (() => {
  const SAME_TAB_TARGETS = ['', '_self', '_parent', '_top'];

  /**
   * @param {Element} anchor the clicked link
   * @param {MouseEvent|KeyboardEvent} event the click or key press
   * @param {Document} doc the page, consulted for <base target>
   */
  function isPlainNavigation(anchor, event, doc) {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return false;
    }
    if (typeof event.button === 'number' && event.button !== 0) {
      return false;
    }

    const base = doc && doc.querySelector ? doc.querySelector('base[target]') : null;
    const target = (anchor.getAttribute('target') || (base && base.getAttribute('target')) || '')
      .trim()
      .toLowerCase();
    // Content scripts run in the top frame only, where _parent and _top mean this tab.
    return SAME_TAB_TARGETS.includes(target);
  }

  return { isPlainNavigation };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = ProxlyClickIntent;
}
