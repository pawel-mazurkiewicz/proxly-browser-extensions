/**
 * Localization utilities following Proxly's localization patterns
 * Adapted for Safari Web Extension with browser namespace
 */

class LocalizationHelper {
  /**
   * Get localized message with fallback - Safari compatible
   * @param {string} messageKey - The message key
   * @param {string} fallback - Fallback text if key not found
   * @returns {string} Localized string
   */
  static getMessage(messageKey, fallback = '') {
    try {
      // Safari Web Extension uses browser.i18n
      if (typeof browser !== 'undefined' && browser.i18n) {
        return browser.i18n.getMessage(messageKey) || fallback;
      }
      // Fallback to chrome namespace for compatibility
      if (typeof chrome !== 'undefined' && chrome.i18n) {
        return chrome.i18n.getMessage(messageKey) || fallback;
      }
      return fallback;
    } catch (error) {
      console.warn(`Localization error for key: ${messageKey}`, error);
      return fallback;
    }
  }

  /**
   * Get localized message with substitutions - Safari compatible
   * @param {string} messageKey - The message key
   * @param {Array} substitutions - Values to substitute
   * @returns {string} Localized string with substitutions
   */
  static getMessageWithSubstitutions(messageKey, substitutions) {
    try {
      // Safari Web Extension uses browser.i18n
      if (typeof browser !== 'undefined' && browser.i18n) {
        return browser.i18n.getMessage(messageKey, substitutions);
      }
      // Fallback to chrome namespace for compatibility
      if (typeof chrome !== 'undefined' && chrome.i18n) {
        return chrome.i18n.getMessage(messageKey, substitutions);
      }
      return messageKey;
    } catch (error) {
      console.warn(`Localization error for key: ${messageKey}`, error);
      return messageKey;
    }
  }

  /**
   * Apply accessibility labels to elements
   * @param {HTMLElement} element - Target element
   * @param {Object} labels - Object containing label and hint keys
   */
  static applyAccessibilityLabels(element, labels) {
    if (labels.label) {
      element.setAttribute('aria-label', this.getMessage(labels.label));
    }
    if (labels.hint) {
      element.setAttribute('aria-describedby', `${element.id}-description`);
      
      // Create description element if it doesn't exist
      let description = document.getElementById(`${element.id}-description`);
      if (!description) {
        description = document.createElement('div');
        description.id = `${element.id}-description`;
        description.className = 'sr-only'; // Screen reader only
        description.textContent = this.getMessage(labels.hint);
        element.parentNode.insertBefore(description, element.nextSibling);
      }
    }
  }

  /**
   * Initialize localization for a page
   * Replaces placeholders with localized text
   */
  static initializePage() {
    // Replace text content for elements with data-i18n attribute
    const elements = document.querySelectorAll('[data-i18n]');
    elements.forEach(element => {
      const messageKey = element.getAttribute('data-i18n');
      const localizedText = this.getMessage(messageKey);
      if (localizedText) {
        element.textContent = localizedText;
      }
    });

    // Replace attributes with localization
    const attrElements = document.querySelectorAll('[data-i18n-attr]');
    attrElements.forEach(element => {
      const attrConfig = element.getAttribute('data-i18n-attr');
      const [attr, messageKey] = attrConfig.split(':');
      const localizedText = this.getMessage(messageKey);
      if (localizedText) {
        element.setAttribute(attr, localizedText);
      }
    });
  }

  /**
   * Get current UI locale - Safari compatible
   * @returns {string} Current locale
   */
  static getCurrentLocale() {
    try {
      if (typeof browser !== 'undefined' && browser.i18n) {
        return browser.i18n.getUILanguage();
      }
      if (typeof chrome !== 'undefined' && chrome.i18n) {
        return chrome.i18n.getUILanguage();
      }
      return navigator.language || 'en';
    } catch (error) {
      console.warn('Error getting current locale:', error);
      return 'en';
    }
  }
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = LocalizationHelper;
}