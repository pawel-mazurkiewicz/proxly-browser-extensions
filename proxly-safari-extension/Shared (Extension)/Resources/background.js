/**
 * Proxly Safari Extension - Background Script
 * Handles context menu creation, URL forwarding, and native messaging
 * Ported from Chrome extension with Safari-specific adaptations
 */

// Note: Safari Web Extension - imports will be handled differently

class ProxlyBackground {
  constructor() {
    this.menuItemId = 'proxly-open-url';
    this.settings = {
      linkMode: 'all', // Default to all links mode
      enabled: true,   // Extension enabled by default
      visualFeedback: true,
      soundFeedback: false
    };
    
    // Setup event listeners immediately
    this.setupEventListeners();
    // Proceed with async initialization
    this.init();
  }

  async init() {
    console.log('Proxly Safari background script initialized');
    
    try {
      // Load initial settings
      await this.loadSettings();
      
      // Set up context menu
      await this.createContextMenu();
      
      // Update icon based on current settings
      await this.updateExtensionIcon(this.settings.enabled);
      
      console.log('Background script initialization complete');
    } catch (error) {
      console.error('Background script initialization failed:', error);
    }
  }

  async createContextMenu() {
    try {
      console.log('Creating context menu...');
      
      // Remove existing menu items to avoid duplicates
      try {
        await browser.contextMenus.removeAll();
        console.log('Cleared existing context menu items');
      } catch (clearError) {
        console.warn('Could not clear existing menu items:', clearError);
      }
      
      // Create context menu item with error handling
      const menuConfig = {
        id: this.menuItemId,
        title: 'Open with Proxly',
        contexts: ['link'],
        documentUrlPatterns: ['http://*/*', 'https://*/*']
      };
      
      // Try to use localized title
      try {
        const localizedTitle = browser.i18n.getMessage('contextMenuTitle');
        if (localizedTitle) {
          menuConfig.title = localizedTitle;
        }
      } catch (i18nError) {
        console.warn('Could not get localized context menu title:', i18nError);
      }
      
      console.log('Creating context menu with config:', menuConfig);
      
      const menuId = browser.contextMenus.create(menuConfig);
      console.log('Context menu created successfully with ID:', menuId);
      
      // Verify menu was created
      setTimeout(() => {
        this.verifyContextMenu();
      }, 500);
      
    } catch (error) {
      console.error('Failed to create context menu:', error);
      console.error('Error details:', error.message, error.stack);
    }
  }

  verifyContextMenu() {
    try {
      console.log('Context menu should now be available for links');
      console.log('Menu item ID:', this.menuItemId);
    } catch (error) {
      console.error('Error during context menu verification:', error);
    }
  }

  setupEventListeners() {
    // Context menu click handler with enhanced logging
    browser.contextMenus.onClicked.addListener((info, tab) => {
      console.log('Context menu clicked:', info);
      console.log('Tab info:', tab);
      this.handleContextMenuClick(info, tab);
    });

    // Runtime message handler
    browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
      return this.handleRuntimeMessage(message, sender, sendResponse);
    });

    // Extension installation/update handler
    browser.runtime.onInstalled.addListener((details) => {
      this.handleInstallation(details);
    });

    // Storage change listener
    browser.storage.onChanged.addListener((changes, namespace) => {
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

      // Forward to Proxly via native messaging
      await this.forwardToProxly(info.linkUrl, tab);
      
    } catch (error) {
      console.error('Error handling context menu click:', error);
    }
  }

  async handleRuntimeMessage(message, sender, sendResponse) {
    try {
      console.log('Received message:', message);
      
      switch (message.type) {
        case 'GET_SETTINGS':
          const settings = await this.loadSettings();
          return Promise.resolve(settings);
          
        case 'CAPTURE_LINK':
          if (message.url && this.isValidUrl(message.url)) {
            // For test pings, acknowledge without navigating
            if (message.isTest) {
              return Promise.resolve({ success: true, test: true });
            }
            // Forward via native messaging for Safari
            await this.forwardToProxly(message.url, sender.tab);
            return Promise.resolve({ success: true });
          } else {
            return Promise.resolve({ success: false, error: 'Invalid URL' });
          }
          
        case 'SETTINGS_UPDATED':
          console.log('🔄 Received settings update in background:', message.settings);
          
          // Update local settings cache immediately
          this.settings = { ...this.settings, ...message.settings };
          console.log('💾 Background settings updated:', this.settings);
          
          // Update extension icon based on new enabled state
          if (message.settings.enabled !== undefined) {
            await this.updateExtensionIcon(message.settings.enabled);
          }
          
          // Update context menu visibility based on link mode
          if (message.settings.linkMode !== undefined) {
            await this.updateContextMenuVisibility(message.settings.linkMode);
          }
          
          // Broadcast settings update to all content scripts
          await this.broadcastSettingsUpdate(message.settings);
          return Promise.resolve({ received: true, updated: true });
          
        case 'TOGGLE_EXTENSION':
          const newState = message.enabled !== undefined ? message.enabled : !this.settings.enabled;
          this.settings.enabled = newState;
          await browser.storage.sync.set({ enabled: newState });
          await this.updateExtensionIcon(newState);
          return Promise.resolve({ enabled: newState });
          
        default:
          console.warn('Unknown message type:', message.type);
          return Promise.resolve({ error: 'Unknown message type' });
      }
    } catch (error) {
      console.error('Error handling runtime message:', error);
      return Promise.resolve({ error: error.message });
    }
  }

  async handleInstallation(details) {
    if (details.reason === 'install') {
      console.log('Extension installed');
      
      // Set default settings
      const defaultSettings = {
        linkMode: 'all', // Default to capturing all links
        enabled: true,   // Extension enabled by default
        visualFeedback: true,
        soundFeedback: false,
        version: '1.0.0'
      };
      
      try {
        await browser.storage.sync.set(defaultSettings);
        console.log('Default settings saved');
      } catch (error) {
        console.error('Failed to save default settings:', error);
      }
      
      // Ensure context menu exists after install
      try {
        await this.createContextMenu();
      } catch (e) {
        console.warn('Could not create context menu on install:', e);
      }
      
      // Open options page on first install
      browser.runtime.openOptionsPage();
      
    } else if (details.reason === 'update') {
      console.log('Extension updated from', details.previousVersion);
    }
  }

  handleStorageChange(changes, namespace) {
    if (namespace === 'sync') {
      console.log('🔄 Storage changes detected in background:', changes);
      
      let settingsChanged = false;
      
      // Update local settings cache
      if (changes.linkMode && changes.linkMode.newValue !== this.settings.linkMode) {
        console.log(`🔧 Link mode changed: ${this.settings.linkMode} → ${changes.linkMode.newValue}`);
        this.settings.linkMode = changes.linkMode.newValue;
        this.updateContextMenuVisibility(changes.linkMode.newValue);
        settingsChanged = true;
      }
      
      if (changes.enabled && changes.enabled.newValue !== this.settings.enabled) {
        console.log(`🔧 Enabled state changed: ${this.settings.enabled} → ${changes.enabled.newValue}`);
        this.settings.enabled = changes.enabled.newValue;
        this.updateExtensionIcon(changes.enabled.newValue);
        settingsChanged = true;
      }
      
      if (changes.visualFeedback && changes.visualFeedback.newValue !== this.settings.visualFeedback) {
        console.log(`🔧 Visual feedback changed: ${this.settings.visualFeedback} → ${changes.visualFeedback.newValue}`);
        this.settings.visualFeedback = changes.visualFeedback.newValue;
        settingsChanged = true;
      }
      
      if (changes.soundFeedback && changes.soundFeedback.newValue !== this.settings.soundFeedback) {
        console.log(`🔧 Sound feedback changed: ${this.settings.soundFeedback} → ${changes.soundFeedback.newValue}`);
        this.settings.soundFeedback = changes.soundFeedback.newValue;
        settingsChanged = true;
      }
      
      if (settingsChanged) {
        console.log('💾 Background settings updated from storage:', this.settings);
      }
    }
  }

  async updateContextMenuVisibility(linkMode) {
    try {
      if (linkMode === 'all') {
        // In 'all' mode, context menu is less relevant but still available
        browser.contextMenus.update(this.menuItemId, {
          title: browser.i18n.getMessage('contextMenuTitleAll') || 'Open with Proxly (all links mode active)'
        });
      } else {
        // In 'context' mode, context menu is the primary way to trigger
        browser.contextMenus.update(this.menuItemId, {
          title: browser.i18n.getMessage('contextMenuTitle') || 'Open with Proxly'
        });
      }
    } catch (error) {
      console.error('Failed to update context menu:', error);
    }
  }

  async loadSettings() {
    try {
      const result = await browser.storage.sync.get();
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
      console.log('🌐 Forwarding URL to native app:', url);
      console.log('📋 Tab info:', tab);
      
      // Safari Web Extension: use native messaging to communicate with Swift app
      const message = {
        type: 'FORWARD_URL',
        url: url,
        timestamp: Date.now()
      };
      
      console.log('📨 Sending message to native app:', message);
      
      // Send message to Safari Web Extension Handler
      const response = await browser.runtime.sendNativeMessage(null, message);
      console.log('📬 Native app response:', response);
      
      if (response && response.success) {
        console.log('✅ URL successfully forwarded to Proxly via native app');
        return response;
      } else {
        console.error('❌ Native app returned error:', response);
        throw new Error(`Native app failed: ${response?.error || 'Unknown error'}`);
      }
      
    } catch (error) {
      console.error('💥 Failed to forward URL to Proxly:', error);
      
      // Fallback: try direct protocol handling (may not work in Safari)
      try {
        console.log('🔄 Attempting fallback direct protocol navigation...');
        const encodedUrl = btoa(url);
        const proxlyUrl = `proxly://open/${encodedUrl}`;
        
        console.log('📎 Generated proxly URL:', proxlyUrl);
        
        if (tab && tab.id) {
          await browser.tabs.update(tab.id, { url: proxlyUrl });
          console.log('✅ Fallback: Direct protocol navigation attempted');
          return { success: true, method: 'direct' };
        } else {
          console.error('❌ No tab available for fallback navigation');
          throw new Error('No tab available for navigation');
        }
      } catch (fallbackError) {
        console.error('💥 Fallback also failed:', fallbackError);
        throw error;
      }
    }
  }

  async broadcastSettingsUpdate(settings) {
    try {
      console.log('📢 Broadcasting settings update to all tabs:', settings);
      
      // Get all tabs
      const tabs = await browser.tabs.query({});
      console.log(`📋 Found ${tabs.length} tabs to update`);
      
      let successCount = 0;
      let errorCount = 0;
      
      // Send settings update to all content scripts
      for (const tab of tabs) {
        try {
          await browser.tabs.sendMessage(tab.id, {
            type: 'SETTINGS_UPDATED',
            settings: settings
          });
          successCount++;
          console.debug(`✅ Settings sent to tab ${tab.id}`);
        } catch (error) {
          // Some tabs might not have the content script loaded
          errorCount++;
          console.debug(`⚠️ Could not send settings to tab ${tab.id}:`, error.message);
        }
      }
      
      console.log(`📊 Settings broadcast complete: ${successCount} success, ${errorCount} errors`);
    } catch (error) {
      console.error('💥 Failed to broadcast settings update:', error);
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
      // Update action badge to show enabled/disabled status
      await browser.action.setBadgeText({
        text: enabled ? '' : 'OFF'
      });
      
      await browser.action.setBadgeBackgroundColor({
        color: enabled ? '#4CAF50' : '#f44336'
      });
      
      console.log('Extension icon updated:', enabled ? 'enabled' : 'disabled');
    } catch (error) {
      console.error('Failed to update extension icon:', error);
    }
  }
}

// Initialize when background script loads
const proxlyBackground = new ProxlyBackground();
