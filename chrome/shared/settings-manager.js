/**
 * Settings management following Proxly's configuration patterns
 * Handles storage, synchronization, and validation of extension settings
 */

class SettingsManager {
  constructor() {
    this.defaultSettings = {
      linkMode: 'alt',           // 'all' or 'alt'
      visualFeedback: true,      // Show visual feedback
      soundFeedback: false,      // Play sound feedback
      version: '1.0.0'
    };
  }

  /**
   * Load settings from storage
   * @returns {Promise<Object>} Current settings
   */
  async loadSettings() {
    try {
      const result = await this.getStorage();
      return { ...this.defaultSettings, ...result };
    } catch (error) {
      console.error('Failed to load settings:', error);
      return this.defaultSettings;
    }
  }

  /**
   * Save settings to storage
   * @param {Object} settings - Settings to save
   * @returns {Promise<boolean>} Success status
   */
  async saveSettings(settings) {
    try {
      // Validate settings before saving
      const validatedSettings = this.validateSettings(settings);
      await this.setStorage(validatedSettings);
      
      // Notify all contexts of settings change
      await this.notifySettingsChange(validatedSettings);
      return true;
    } catch (error) {
      console.error('Failed to save settings:', error);
      return false;
    }
  }

  /**
   * Reset settings to defaults
   * @returns {Promise<boolean>} Success status
   */
  async resetSettings() {
    return await this.saveSettings(this.defaultSettings);
  }

  /**
   * Validate settings object
   * @param {Object} settings - Settings to validate
   * @returns {Object} Validated settings
   */
  validateSettings(settings) {
    const validated = { ...this.defaultSettings };
    
    // Validate link mode
    if (['all', 'alt'].includes(settings.linkMode)) {
      validated.linkMode = settings.linkMode;
    }
    
    // Validate boolean flags
    validated.visualFeedback = Boolean(settings.visualFeedback);
    validated.soundFeedback = Boolean(settings.soundFeedback);
    
    return validated;
  }

  /**
   * Get storage interface (browser-specific)
   * @returns {Promise<Object>} Storage data
   */
  async getStorage() {
    if (typeof chrome !== 'undefined' && chrome.storage) {
      return new Promise((resolve, reject) => {
        chrome.storage.sync.get(null, (result) => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            resolve(result);
          }
        });
      });
    } else {
      // Fallback to localStorage for testing
      const data = localStorage.getItem('proxlySettings');
      return data ? JSON.parse(data) : {};
    }
  }

  /**
   * Set storage interface (browser-specific)
   * @param {Object} settings - Settings to store
   * @returns {Promise<void>}
   */
  async setStorage(settings) {
    if (typeof chrome !== 'undefined' && chrome.storage) {
      return new Promise((resolve, reject) => {
        chrome.storage.sync.set(settings, () => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            resolve();
          }
        });
      });
    } else {
      // Fallback to localStorage for testing
      localStorage.setItem('proxlySettings', JSON.stringify(settings));
    }
  }

  /**
   * Notify all extension contexts of settings changes
   * @param {Object} settings - Updated settings
   * @returns {Promise<void>}
   */
  async notifySettingsChange(settings) {
    if (typeof chrome !== 'undefined' && chrome.runtime) {
      try {
        await chrome.runtime.sendMessage({
          type: 'SETTINGS_UPDATED',
          settings: settings
        });
      } catch (error) {
        console.warn('Failed to notify settings change:', error);
      }
    }
  }

  /**
   * Listen for settings changes
   * @param {Function} callback - Callback function to handle changes
   */
  onSettingsChange(callback) {
    if (typeof chrome !== 'undefined' && chrome.storage) {
      chrome.storage.onChanged.addListener((changes, namespace) => {
        if (namespace === 'sync') {
          callback(changes);
        }
      });
    }
  }
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = SettingsManager;
}