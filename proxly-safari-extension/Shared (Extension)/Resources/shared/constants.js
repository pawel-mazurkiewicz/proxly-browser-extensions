/**
 * Cross-browser constants and configuration for Safari Web Extension
 * Adapted from Chrome extension with Safari-specific modifications
 */

const EXTENSION_CONFIG = {
  // Extension metadata
  NAME: 'Proxly Browser Extension',
  VERSION: '1.0.0',
  DESCRIPTION: 'Route web links through Proxly for intelligent browser selection',
  
  // Protocol configuration
  PROTOCOL_SCHEME: 'proxly',
  PROTOCOL_PREFIX: 'proxly://open/',
  
  // Settings keys
  SETTINGS_KEYS: {
    LINK_MODE: 'linkMode',
    ENABLED: 'enabled',
    VISUAL_FEEDBACK: 'visualFeedback',
    SOUND_FEEDBACK: 'soundFeedback'
  },
  
  // Link handling modes
  LINK_MODES: {
    ALL: 'all',
    CONTEXT: 'context'
  },
  
  // Browser detection - Safari Web Extension
  BROWSER_TYPE: 'safari',
  
  // API compatibility layer for Safari
  API: {
    // Runtime API - Safari uses browser namespace
    sendMessage: function(message) {
      if (typeof browser !== 'undefined' && browser.runtime) {
        return browser.runtime.sendMessage(message);
      }
      return Promise.reject(new Error('Runtime API not available'));
    },
    
    // Native messaging for Safari Web Extension Handler
    sendNativeMessage: function(message) {
      if (typeof browser !== 'undefined' && browser.runtime && browser.runtime.sendNativeMessage) {
        return browser.runtime.sendNativeMessage(null, message);
      }
      return Promise.reject(new Error('Native messaging not available'));
    },
    
    // Storage API - Safari uses promises natively
    getStorage: function(keys = null) {
      if (typeof browser !== 'undefined' && browser.storage) {
        return browser.storage.sync.get(keys);
      }
      return Promise.reject(new Error('Storage API not available'));
    },
    
    setStorage: function(items) {
      if (typeof browser !== 'undefined' && browser.storage) {
        return browser.storage.sync.set(items);
      }
      return Promise.reject(new Error('Storage API not available'));
    },
    
    // Tabs API - Safari compatible
    updateTab: function(tabId, updateProperties) {
      if (typeof browser !== 'undefined' && browser.tabs) {
        return browser.tabs.update(tabId, updateProperties);
      }
      return Promise.reject(new Error('Tabs API not available'));
    }
  },
  
  // Safari-specific manifest configuration
  generateManifest: function() {
    return {
      manifest_version: 3,
      name: this.NAME,
      description: this.DESCRIPTION,
      version: this.VERSION,
      icons: {
        48: 'images/icon-48.png',
        96: 'images/icon-96.png',
        128: 'images/icon-128.png',
        256: 'images/icon-256.png',
        512: 'images/icon-512.png'
      },
      default_locale: 'en',
      permissions: ['contextMenus', 'storage', 'activeTab', 'nativeMessaging'],
      host_permissions: ['<all_urls>'],
      background: {
        scripts: ['background.js'],
        type: 'module',
        persistent: false
      },
      content_scripts: [{
        matches: ['<all_urls>'],
        js: [
          'shared/constants.js',
          'shared/localization.js',
          'shared/accessibility.js',
          'shared/settings-manager.js',
          'content.js'
        ],
        run_at: 'document_idle'
      }],
      action: {
        default_popup: 'popup.html',
        default_icon: 'images/toolbar-icon.svg'
      },
      options_ui: {
        page: 'options/options.html',
        open_in_tab: true
      }
    };
  }
};

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = EXTENSION_CONFIG;
}