/**
 * Cross-browser constants and configuration
 * Handles differences between Chrome, Firefox, and Safari extension APIs
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
    VISUAL_FEEDBACK: 'visualFeedback',
    SOUND_FEEDBACK: 'soundFeedback'
  },
  
  // Link handling modes
  LINK_MODES: {
    ALL: 'all',
    ALT_CLICK: 'alt'
  },
  
  // Browser detection
  BROWSER_TYPE: (function() {
    if (typeof chrome !== 'undefined') {
      if (chrome.runtime && chrome.runtime.getURL('').includes('moz-extension://')) {
        return 'firefox';
      } else if (chrome.runtime && chrome.runtime.getURL('').includes('safari-web-extension://')) {
        return 'safari';
      } else {
        return 'chrome';
      }
    }
    return 'unknown';
  })(),
  
  // API compatibility layer
  API: {
    // Runtime API
    sendMessage: function(message) {
      if (typeof chrome !== 'undefined' && chrome.runtime) {
        return new Promise((resolve, reject) => {
          chrome.runtime.sendMessage(message, (response) => {
            if (chrome.runtime.lastError) {
              reject(chrome.runtime.lastError);
            } else {
              resolve(response);
            }
          });
        });
      }
      return Promise.reject(new Error('Runtime API not available'));
    },
    
    // Storage API
    getStorage: function(keys = null) {
      if (typeof chrome !== 'undefined' && chrome.storage) {
        return new Promise((resolve, reject) => {
          chrome.storage.sync.get(keys, (result) => {
            if (chrome.runtime.lastError) {
              reject(chrome.runtime.lastError);
            } else {
              resolve(result);
            }
          });
        });
      }
      return Promise.reject(new Error('Storage API not available'));
    },
    
    setStorage: function(items) {
      if (typeof chrome !== 'undefined' && chrome.storage) {
        return new Promise((resolve, reject) => {
          chrome.storage.sync.set(items, () => {
            if (chrome.runtime.lastError) {
              reject(chrome.runtime.lastError);
            } else {
              resolve();
            }
          });
        });
      }
      return Promise.reject(new Error('Storage API not available'));
    },
    
    // Tabs API
    updateTab: function(tabId, updateProperties) {
      if (typeof chrome !== 'undefined' && chrome.tabs) {
        return new Promise((resolve, reject) => {
          chrome.tabs.update(tabId, updateProperties, (tab) => {
            if (chrome.runtime.lastError) {
              reject(chrome.runtime.lastError);
            } else {
              resolve(tab);
            }
          });
        });
      }
      return Promise.reject(new Error('Tabs API not available'));
    }
  },
  
  // Manifest generation for different browsers
  generateManifest: function(browserType) {
    const baseManifest = {
      name: this.NAME,
      description: this.DESCRIPTION,
      version: this.VERSION,
      icons: {
        16: 'icons/icon-16.png',
        48: 'icons/icon-48.png',
        128: 'icons/icon-128.png',
        256: 'icons/icon-256.png'
      },
      default_locale: 'en',
      permissions: ['contextMenus'],
      host_permissions: ['<all_urls>'],
      content_scripts: [{
        matches: ['<all_urls>'],
        js: ['shared/constants.js', 'shared/localization.js', 'shared/accessibility.js', 'content-script.js']
      }],
      options_ui: {
        page: 'options/options.html',
        open_in_tab: true
      }
    };
    
    switch (browserType) {
      case 'chrome':
        return {
          ...baseManifest,
          manifest_version: 3,
          background: {
            service_worker: 'background.js'
          }
        };
        
      case 'firefox':
        return {
          ...baseManifest,
          manifest_version: 2,
          background: {
            scripts: ['shared/constants.js', 'shared/localization.js', 'background.js'],
            persistent: false
          },
          permissions: ['contextMenus', '<all_urls>']
        };
        
      case 'safari':
        return {
          ...baseManifest,
          manifest_version: 2,
          background: {
            scripts: ['background.js'],
            persistent: false
          }
        };
        
      default:
        throw new Error(`Unsupported browser type: ${browserType}`);
    }
  }
};

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = EXTENSION_CONFIG;
}