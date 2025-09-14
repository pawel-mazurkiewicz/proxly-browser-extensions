/**
 * Proxly Browser Extension - Background Service Worker (Manifest V3)
 * Handles context menu creation and URL forwarding to Proxly
 */

// Import shared configuration
try {
  importScripts('shared/constants.js');
} catch (error) {
  console.error('Failed to import constants:', error);
}

class ProxlyBackground {
  constructor() {
    this.menuItemId = 'proxly-open-url';
    this.settings = {
      linkMode: 'all', // Default to all links mode as requested
      enabled: true, // Extension enabled by default
      visualFeedback: true,
      soundFeedback: false
    };
    this.init();
  }

  async init() {
    console.log('Proxly background service worker initialized');
    
    // Load initial settings first
    await this.loadSettings();
    
    // Set up context menu
    await this.createContextMenu();
    
    // Set up event listeners
    this.setupEventListeners();
    
    // Update icon based on current settings
    await this.updateExtensionIcon(this.settings.enabled);
  }

  async createContextMenu() {
    try {
      // Remove existing menu items to avoid duplicates
      await chrome.contextMenus.removeAll();
      
      // Create context menu item
      chrome.contextMenus.create({
        id: this.menuItemId,
        title: chrome.i18n.getMessage('contextMenuTitle') || 'Open with Proxly',
        contexts: ['link'],
        documentUrlPatterns: ['http://*/*', 'https://*/*']
      });
      
      console.log('Context menu created successfully');
    } catch (error) {
      console.error('Failed to create context menu:', error);
    }
  }

  setupEventListeners() {
    // Context menu click handler
    chrome.contextMenus.onClicked.addListener((info, tab) => {
      this.handleContextMenuClick(info, tab);
    });

    // Runtime message handler
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      this.handleRuntimeMessage(message, sender, sendResponse);
      return true; // Keep the message channel open for async response
    });

    // Extension installation/update handler
    chrome.runtime.onInstalled.addListener((details) => {
      this.handleInstallation(details);
    });

    // Storage change listener
    chrome.storage.onChanged.addListener((changes, namespace) => {
      this.handleStorageChange(changes, namespace);
    });
  }

  async handleContextMenuClick(info, tab) {
    if (info.menuItemId !== this.menuItemId || !info.linkUrl) {
      return;
    }

    try {
      console.log('Context menu clicked for URL:', info.linkUrl);
      
      // Validate URL
      if (!this.isValidUrl(info.linkUrl)) {
        console.warn('Invalid URL from context menu:', info.linkUrl);
        return;
      }

      // Forward to Proxly
      await this.forwardToProxly(info.linkUrl, tab);
      
    } catch (error) {
      console.error('Error handling context menu click:', error);
    }
  }

  async handleRuntimeMessage(message, sender, sendResponse) {
    try {
      switch (message.type) {
        case 'GET_SETTINGS':
          const settings = await this.loadSettings();
          sendResponse(settings);
          break;
          
        case 'CAPTURE_LINK':
          if (message.url && this.isValidUrl(message.url)) {
            // For test pings, acknowledge without navigating
            if (message.isTest) {
              sendResponse({ success: true, test: true });
              break;
            }
            // Respond first; then navigate
            sendResponse({ success: true });
            this.forwardToProxly(message.url, sender.tab).catch((err) => {
              console.error('Deferred forwardToProxly failed:', err);
            });
          } else {
            sendResponse({ success: false, error: 'Invalid URL' });
          }
          break;
          
        case 'SETTINGS_UPDATED':
          // Broadcast settings update to all content scripts
          this.broadcastSettingsUpdate(message.settings);
          sendResponse({ received: true });
          break;
          
        case 'TOGGLE_EXTENSION':
          const newState = !this.settings.enabled;
          this.settings.enabled = newState;
          await chrome.storage.sync.set({ enabled: newState });
          await this.updateExtensionIcon(newState);
          sendResponse({ enabled: newState });
          break;
          
        default:
          console.warn('Unknown message type:', message.type);
          sendResponse({ error: 'Unknown message type' });
      }
    } catch (error) {
      console.error('Error handling runtime message:', error);
      sendResponse({ error: error.message });
    }
  }

  async handleInstallation(details) {
    if (details.reason === 'install') {
      console.log('Extension installed');
      
      // Set default settings
      const defaultSettings = {
        linkMode: 'all', // Default to capturing all links as requested
        enabled: true, // Extension enabled by default
        visualFeedback: true,
        soundFeedback: false,
        version: '1.0.0'
      };
      
      try {
        await chrome.storage.sync.set(defaultSettings);
        console.log('Default settings saved');
      } catch (error) {
        console.error('Failed to save default settings:', error);
      }
      
      // Open options page on first install
      chrome.runtime.openOptionsPage();
      
    } else if (details.reason === 'update') {
      console.log('Extension updated from', details.previousVersion, 'to', chrome.runtime.getManifest().version);
    }
  }

  handleStorageChange(changes, namespace) {
    if (namespace === 'sync') {
      console.log('Settings changed:', changes);
      
      // Update context menu if needed
      if (changes.linkMode) {
        this.updateContextMenuVisibility(changes.linkMode.newValue);
      }
    }
  }

  async updateContextMenuVisibility(linkMode) {
    try {
      if (linkMode === 'all') {
        // In 'all' mode, context menu is less relevant but still available
        chrome.contextMenus.update(this.menuItemId, {
          title: chrome.i18n.getMessage('contextMenuTitleAll') || 'Open with Proxly (all links mode active)'
        });
      } else {
        // In 'alt' mode, context menu is the primary way to trigger
        chrome.contextMenus.update(this.menuItemId, {
          title: chrome.i18n.getMessage('contextMenuTitle') || 'Open with Proxly'
        });
      }
    } catch (error) {
      console.error('Failed to update context menu:', error);
    }
  }

  async loadSettings() {
    try {
      const result = await chrome.storage.sync.get(null);
      const settings = {
        linkMode: result.linkMode || 'all',
        enabled: result.enabled !== undefined ? result.enabled : true,
        visualFeedback: result.visualFeedback !== undefined ? result.visualFeedback : true,
        soundFeedback: result.soundFeedback || false,
        version: result.version || '1.0.0'
      };
      
      this.settings = settings;
      console.log('Settings loaded:', settings);
      return settings;
    } catch (error) {
      console.error('Failed to load settings:', error);
      return {
        linkMode: 'all',
        enabled: true,
        visualFeedback: true,
        soundFeedback: false,
        version: '1.0.0'
      };
    }
  }

  async forwardToProxly(url, tab) {
    try {
      // Encode URL for Proxly protocol
      const encodedUrl = btoa(url);
      const proxlyUrl = `proxly://open/${encodedUrl}`;
      
      console.log('Forwarding to Proxly:', url, '->', proxlyUrl);
      
      // Update the current tab to the Proxly URL
      await chrome.tabs.update(tab.id, { url: proxlyUrl });
      
      // Log successful capture
      console.log('URL successfully forwarded to Proxly');
      
    } catch (error) {
      console.error('Failed to forward URL to Proxly:', error);
      throw error;
    }
  }

  async broadcastSettingsUpdate(settings) {
    try {
      // Get all tabs
      const tabs = await chrome.tabs.query({});
      
      // Send settings update to all content scripts
      for (const tab of tabs) {
        try {
          await chrome.tabs.sendMessage(tab.id, {
            type: 'SETTINGS_UPDATED',
            settings: settings
          });
        } catch (error) {
          // Some tabs might not have the content script loaded
          console.debug('Could not send settings to tab:', tab.id);
        }
      }
    } catch (error) {
      console.error('Failed to broadcast settings update:', error);
    }
  }

  isValidUrl(urlString) {
    try {
      const url = new URL(urlString);
      return ['http:', 'https:'].includes(url.protocol);
    } catch {
      return false;
    }
  }

  async updateExtensionIcon(enabled) {
    try {
      // Update badge to show enabled/disabled status (Firefox MV2)
      await browser.browserAction.setBadgeText({
        text: enabled ? '' : 'OFF'
      });
      
      await browser.browserAction.setBadgeBackgroundColor({
        color: enabled ? '#4CAF50' : '#f44336'
      });
      
      console.log('Extension icon updated:', enabled ? 'enabled' : 'disabled');
    } catch (error) {
      console.error('Failed to update extension icon:', error);
    }
  }
}

// Initialize when service worker starts
const proxlyBackground = new ProxlyBackground();