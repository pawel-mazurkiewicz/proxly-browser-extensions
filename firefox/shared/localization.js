/**
 * Localization utilities following Proxly's localization patterns
 * Provides consistent i18n support across all extension components
 */

class LocalizationHelper {
  /**
   * Get localized message with fallback
   * @param {string} messageKey - The message key
   * @param {string} fallback - Fallback text if key not found
   * @returns {string} Localized string
   */
  static getMessage(messageKey, fallback = '') {
    try {
      return chrome.i18n.getMessage(messageKey) || fallback;
    } catch (error) {
      console.warn(`Localization error for key: ${messageKey}`, error);
      return fallback;
    }
  }

  /**
   * Get localized message with substitutions
   * @param {string} messageKey - The message key
   * @param {Array} substitutions - Values to substitute
   * @returns {string} Localized string with substitutions
   */
  static getMessageWithSubstitutions(messageKey, substitutions) {
    try {
      return chrome.i18n.getMessage(messageKey, substitutions);
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
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = LocalizationHelper;
}