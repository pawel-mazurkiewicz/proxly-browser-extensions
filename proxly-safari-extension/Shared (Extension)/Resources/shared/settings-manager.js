/**
 * Settings management following Proxly's configuration patterns
 * Adapted for Safari Web Extension with browser namespace support
 */

class SettingsManager {
  constructor() {
    this.defaultSettings = {
      linkMode: 'all',           // 'all' or 'context' (updated from Chrome version)
      enabled: true,             // Extension enabled by default
      visualFeedback: true,      // Show visual feedback
      soundFeedback: false,      // Play sound feedback
      version: '1.0.0'
    };
  }

  /**
   * Load settings from storage - Safari compatible
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
   * Save settings to storage - Safari compatible
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
    
    // Validate link mode (updated for Safari)
    if (['all', 'context'].includes(settings.linkMode)) {
      validated.linkMode = settings.linkMode;
    }
    
    // Validate boolean flags
    validated.enabled = Boolean(settings.enabled);
    validated.visualFeedback = Boolean(settings.visualFeedback);
    validated.soundFeedback = Boolean(settings.soundFeedback);
    
    // Preserve version if provided
    if (settings.version) {
      validated.version = settings.version;
    }
    
    return validated;
  }

  /**
   * Get storage interface - Safari Web Extension compatible
   * @returns {Promise<Object>} Storage data
   */
  async getStorage() {
    try {
      // Safari Web Extension uses browser namespace
      if (typeof browser !== 'undefined' && browser.storage) {
        return await browser.storage.sync.get();
      }
      
      // Fallback to chrome namespace for compatibility
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
      }
      
      // Final fallback to localStorage for testing environments
      const data = localStorage.getItem('proxlySettings');
      return data ? JSON.parse(data) : {};
    } catch (error) {
      console.warn('Storage API not available, using fallback:', error);
      const data = localStorage.getItem('proxlySettings');
      return data ? JSON.parse(data) : {};
    }
  }

  /**
   * Set storage interface - Safari Web Extension compatible
   * @param {Object} settings - Settings to store
   * @returns {Promise<void>}
   */
  async setStorage(settings) {
    try {
      // Safari Web Extension uses browser namespace
      if (typeof browser !== 'undefined' && browser.storage) {
        return await browser.storage.sync.set(settings);
      }
      
      // Fallback to chrome namespace for compatibility
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
      }
      
      // Final fallback to localStorage for testing environments
      localStorage.setItem('proxlySettings', JSON.stringify(settings));
    } catch (error) {
      console.warn('Storage API not available, using fallback:', error);
      localStorage.setItem('proxlySettings', JSON.stringify(settings));
    }
  }

  /**
   * Notify all extension contexts of settings changes - Safari compatible
   * @param {Object} settings - Updated settings
   * @returns {Promise<void>}
   */
  async notifySettingsChange(settings) {
    try {
      // Safari Web Extension uses browser namespace
      if (typeof browser !== 'undefined' && browser.runtime) {
        await browser.runtime.sendMessage({
          type: 'SETTINGS_UPDATED',
          settings: settings
        });
        return;
      }
      
      // Fallback to chrome namespace
      if (typeof chrome !== 'undefined' && chrome.runtime) {
        await chrome.runtime.sendMessage({
          type: 'SETTINGS_UPDATED',
          settings: settings
        });
        return;
      }
    } catch (error) {
      console.warn('Failed to notify settings change:', error);
    }
  }

  /**
   * Listen for settings changes - Safari compatible
   * @param {Function} callback - Callback function to handle changes
   */
  onSettingsChange(callback) {
    try {
      // Safari Web Extension uses browser namespace
      if (typeof browser !== 'undefined' && browser.storage) {
        browser.storage.onChanged.addListener((changes, namespace) => {
          if (namespace === 'sync') {
            callback(changes);
          }
        });
        return;
      }
      
      // Fallback to chrome namespace
      if (typeof chrome !== 'undefined' && chrome.storage) {
        chrome.storage.onChanged.addListener((changes, namespace) => {
          if (namespace === 'sync') {
            callback(changes);
          }
        });
        return;
      }
    } catch (error) {
      console.warn('Failed to setup settings change listener:', error);
    }
  }

  /**
   * Get specific setting value - Safari compatible
   * @param {string} key - Setting key
   * @returns {Promise<any>} Setting value
   */
  async getSetting(key) {
    const settings = await this.loadSettings();
    return settings[key];
  }

  /**
   * Set specific setting value - Safari compatible
   * @param {string} key - Setting key
   * @param {any} value - Setting value
   * @returns {Promise<boolean>} Success status
   */
  async setSetting(key, value) {
    const settings = await this.loadSettings();
    settings[key] = value;
    return await this.saveSettings(settings);
  }

  /**
   * Export settings for backup - Safari compatible
   * @returns {Promise<string>} JSON string of settings
   */
  async exportSettings() {
    const settings = await this.loadSettings();
    return JSON.stringify(settings, null, 2);
  }

  /**
   * Import settings from backup - Safari compatible
   * @param {string} jsonString - JSON string of settings
   * @returns {Promise<boolean>} Success status
   */
  async importSettings(jsonString) {
    try {
      const settings = JSON.parse(jsonString);
      return await this.saveSettings(settings);
    } catch (error) {
      console.error('Failed to import settings:', error);
      return false;
    }
  }
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = SettingsManager;
}