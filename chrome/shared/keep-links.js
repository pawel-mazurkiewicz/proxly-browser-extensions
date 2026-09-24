/**
 * "Keep links in this tab": the permission, the setting, how the popup and options page describe the
 * connector's state, and wiring their controls. `api` is `browser` in Firefox and `chrome` in Chrome.
 */

const ProxlyKeepLinks = (() => {
  const SETUP_URL = 'proxly://connect';
  const PERMISSION = { permissions: ['nativeMessaging'] };
  const OFF = { enabled: false, connected: false, connectorVersion: null, browser: null };

  /**
   * Turns the setting on or off and resolves to the resulting state. Turning it on asks for the
   * permission first: Firefox accepts permissions.request only straight from the user's click.
   */
  async function setEnabled(api, wanted) {
    if (!wanted) {
      await api.storage.sync.set({ keepLinksInTab: false });
      return false;
    }
    const granted = await api.permissions.request(PERMISSION);
    await api.storage.sync.set({ keepLinksInTab: granted });
    return granted;
  }

  /** The background's CONNECTOR_STATUS, or "off" when it cannot be reached. */
  async function status(api) {
    try {
      const reply = await api.runtime.sendMessage({ type: 'CONNECTOR_STATUS' });
      return reply && typeof reply.enabled === 'boolean' ? reply : OFF;
    } catch (_) {
      return OFF;
    }
  }

  /** Which message to show, and whether to offer "Set up in Proxly". */
  function describe(state) {
    if (!state.enabled) return { messageKey: 'keepLinksOff', showSetup: false };
    if (!state.connected) return { messageKey: 'keepLinksNeedsSetup', showSetup: true };
    return { messageKey: 'keepLinksReady', showSetup: false };
  }

  /** Opens Proxly's Browser Extensions settings, which sets up the connector. */
  async function openSetup(api) {
    await api.tabs.update({ url: SETUP_URL });
  }

  /**
   * Wires a page's toggle, status line and setup button, and shows the current state. `afterSetup`
   * runs once Proxly has been asked to set up; the popup closes itself there.
   */
  function attach({ api, toggle, statusLine, setupButton, getMessage, afterSetup = () => {} }) {
    const refresh = async () => {
      const state = await status(api);
      const { messageKey, showSetup } = describe(state);
      toggle.checked = state.enabled;
      statusLine.textContent = getMessage(messageKey);
      setupButton.style.display = showSetup ? '' : 'none';
    };
    toggle.addEventListener('change', async () => {
      try {
        toggle.checked = await setEnabled(api, toggle.checked);
      } catch (error) {
        console.warn('Keep links in this tab could not be changed:', error);
      }
      await refresh();
    });
    setupButton.addEventListener('click', async () => {
      try {
        await openSetup(api);
        afterSetup();
      } catch (error) {
        console.warn('Could not open Proxly to set up:', error);
      }
    });
    return refresh();
  }

  return { SETUP_URL, setEnabled, status, describe, openSetup, attach };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = ProxlyKeepLinks;
}
