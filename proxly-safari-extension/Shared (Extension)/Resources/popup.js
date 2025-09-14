/**
 * Proxly Safari Extension Popup JavaScript
 * Handles the main toggle and settings in the extension popup
 * Ported from Chrome extension with Safari-specific adaptations
 */

class ProxlyPopup {
  constructor() {
    this.settings = {
      enabled: true,
      linkMode: 'all',
      visualFeedback: true,
      soundFeedback: false
    };
    this.accessibilityHelper = null;
    
    this.init();
  }

  async init() {
    console.log('Initializing Proxly Safari popup');
    
    try {
      // Initialize localization
      if (typeof LocalizationHelper !== 'undefined') {
        LocalizationHelper.initializePage();
      }
      
      // Initialize accessibility helper
      if (typeof AccessibilityHelper !== 'undefined') {
        this.accessibilityHelper = new AccessibilityHelper();
        this.setupAccessibility();
      }
      
      // Load current settings
      await this.loadSettings();
      
      // Setup event listeners
      this.setupEventListeners();
      
      // Check connection status
      this.checkConnectionStatus();
      
      // Update UI
      this.updateUI();
      
      console.log('Safari popup initialized successfully');
    } catch (error) {
      console.error('Failed to initialize popup:', error);
      this.showStatus('Failed to initialize', 'error');
    }
  }

  setupAccessibility() {
    if (!this.accessibilityHelper) return;
    
    // Apply system accessibility preferences
    this.accessibilityHelper.applyHighContrastSupport();
    this.accessibilityHelper.applyReducedMotionSupport();
  }

  async loadSettings() {
    try {
      // Safari: Try browser.runtime.sendMessage first, fallback to storage
      const response = await browser.runtime.sendMessage({ type: 'GET_SETTINGS' });
      if (response && !response.error) {
        this.settings = response;
        console.log('Settings loaded from background script in popup:', this.settings);
      } else {
        // Fallback to direct storage access
        const result = await browser.storage.sync.get();
        this.settings = {
          enabled: result.enabled !== undefined ? result.enabled : true,
          linkMode: result.linkMode || 'all',
          visualFeedback: result.visualFeedback !== undefined ? result.visualFeedback : true,
          soundFeedback: result.soundFeedback || false
        };
        console.log('Settings loaded from storage in popup:', this.settings);
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
      // Use safe defaults
      this.settings = {
        enabled: true,
        linkMode: 'all',
        visualFeedback: true,
        soundFeedback: false
      };
    }
  }

  setupEventListeners() {
    // Main toggle switch
    const mainToggle = document.getElementById('main-toggle');
    if (mainToggle) {
      mainToggle.addEventListener('change', (event) => {
        this.handleMainToggle(event.target.checked);
      });
    }

    // Link mode radio buttons
    const modeRadios = document.querySelectorAll('input[name="linkMode"]');
    modeRadios.forEach(radio => {
      radio.addEventListener('change', (event) => {
        if (event.target.checked) {
          this.handleModeChange(event.target.value);
        }
      });
    });

    // Action buttons
    const openOptionsButton = document.getElementById('open-options');
    if (openOptionsButton) {
      openOptionsButton.addEventListener('click', () => {
        this.openOptionsPage();
      });
    }

    const testConnectionButton = document.getElementById('test-connection');
    if (testConnectionButton) {
      testConnectionButton.addEventListener('click', () => {
        this.testConnection();
      });
    }
  }

  async handleMainToggle(enabled) {
    try {
      console.log('🔄 Main toggle changed:', enabled);
      
      // Update local settings
      this.settings.enabled = enabled;
      
      // Save to storage immediately
      await browser.storage.sync.set(this.settings);
      console.log('💾 Toggle settings saved to storage:', this.settings);
      
      // Send toggle message to background script
      const response = await browser.runtime.sendMessage({
        type: 'TOGGLE_EXTENSION',
        enabled: enabled
      });
      console.log('📬 Toggle response:', response);
      
      if (response && response.enabled !== undefined) {
        this.settings.enabled = response.enabled;
        this.updateUI();
        this.announceToggleChange(response.enabled);
      }
      
      // Also broadcast settings change to all contexts
      await browser.runtime.sendMessage({
        type: 'SETTINGS_UPDATED',
        settings: this.settings
      });
      
    } catch (error) {
      console.error('❌ Failed to toggle extension:', error);
      this.showStatus('Failed to toggle extension', 'error');
    }
  }

  async handleModeChange(newMode) {
    try {
      console.log('🔄 Mode changed to:', newMode);
      
      // Update settings
      this.settings.linkMode = newMode;
      
      // Save complete settings to storage (not just the changed field)
      await browser.storage.sync.set(this.settings);
      console.log('💾 Settings saved to storage:', this.settings);
      
      // Send settings update to background script for broadcasting
      const response = await browser.runtime.sendMessage({
        type: 'SETTINGS_UPDATED',
        settings: this.settings
      });
      console.log('📬 Settings update response:', response);
      
      this.announceModeChange(newMode);
      
    } catch (error) {
      console.error('❌ Failed to change mode:', error);
      this.showStatus('Failed to change mode', 'error');
    }
  }

  updateUI() {
    // Update main toggle
    const mainToggle = document.getElementById('main-toggle');
    if (mainToggle) {
      mainToggle.checked = this.settings.enabled;
    }

    // Update status text
    const statusText = document.getElementById('status-text');
    if (statusText) {
      if (this.settings.enabled) {
        statusText.textContent = this.getMessage('statusEnabled', 'Enabled');
        statusText.className = 'status-text';
      } else {
        statusText.textContent = this.getMessage('statusDisabled', 'Disabled');
        statusText.className = 'status-text disabled';
      }
    }

    // Update mode selection
    const modeRadio = document.querySelector(`input[name="linkMode"][value="${this.settings.linkMode}"]`);
    if (modeRadio) {
      modeRadio.checked = true;
    }

    // Update opacity based on enabled state
    const modeSection = document.querySelector('.mode-section');
    const quickActions = document.querySelector('.quick-actions');
    
    if (modeSection) {
      modeSection.style.opacity = this.settings.enabled ? '1' : '0.6';
    }
    if (quickActions) {
      quickActions.style.opacity = this.settings.enabled ? '1' : '0.6';
    }
  }

  async checkConnectionStatus() {
    try {
      this.showStatus('Checking connection...', 'info');
      
      // Test connection by trying to get settings
      const response = await browser.runtime.sendMessage({ type: 'GET_SETTINGS' });
      
      if (response && !response.error) {
        this.showStatus('Connected to Proxly', 'success');
      } else {
        this.showStatus('Connection failed', 'error');
      }
      
    } catch (error) {
      console.error('Connection test failed:', error);
      this.showStatus('Connection error', 'error');
    }
  }

  async testConnection() {
    try {
      this.showStatus('Testing connection...', 'info');
      
      // Test with a sample URL
      const testUrl = 'https://example.com/test';
      const response = await browser.runtime.sendMessage({
        type: 'CAPTURE_LINK',
        url: testUrl,
        isTest: true
      });
      
      if (response && response.success) {
        this.showStatus('Connection successful', 'success');
      } else {
        this.showStatus('Connection failed', 'error');
      }
      
    } catch (error) {
      console.error('Connection test failed:', error);
      this.showStatus('Test failed', 'error');
    }
  }

  openOptionsPage() {
    try {
      browser.runtime.openOptionsPage();
      window.close(); // Close popup after opening options
    } catch (error) {
      console.error('Failed to open options page:', error);
    }
  }

  showStatus(message, type) {
    const statusIndicator = document.getElementById('connection-status');
    const statusIcon = document.getElementById('connection-icon');
    const statusMessage = document.getElementById('connection-message');
    
    if (statusIndicator && statusIcon && statusMessage) {
      // Update icon based on type
      switch (type) {
        case 'success':
          statusIcon.textContent = '✅';
          statusIndicator.className = 'status-indicator success';
          break;
        case 'error':
          statusIcon.textContent = '❌';
          statusIndicator.className = 'status-indicator error';
          break;
        default:
          statusIcon.textContent = '⏳';
          statusIndicator.className = 'status-indicator';
      }
      
      statusMessage.textContent = message;
    }
    
    // Auto-clear status after 3 seconds for non-error messages
    if (type !== 'error') {
      setTimeout(() => {
        this.showStatus('Ready', 'success');
      }, 3000);
    }
  }

  announceToggleChange(enabled) {
    const message = enabled ? 
      this.getMessage('extensionEnabled', 'Proxly extension enabled') :
      this.getMessage('extensionDisabled', 'Proxly extension disabled');
    
    this.announce(message);
  }

  announceModeChange(mode) {
    const modeNames = {
      'all': this.getMessage('modeAllLinks', 'Capture all external links'),
      'context': this.getMessage('modeContextOnly', 'Right-click menu only')
    };
    
    const message = this.getMessage('modeChangedTo', `Link handling changed to: ${modeNames[mode] || mode}`);
    this.announce(message);
  }

  announce(message) {
    if (this.accessibilityHelper) {
      this.accessibilityHelper.announce(message);
    }
    
    // Fallback announcement
    const announcements = document.getElementById('sr-announcements');
    if (announcements) {
      announcements.textContent = message;
    }
  }

  getMessage(key, fallback) {
    if (typeof LocalizationHelper !== 'undefined') {
      return LocalizationHelper.getMessage(key, fallback);
    }
    return fallback;
  }
}

// Initialize popup when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new ProxlyPopup();
});
