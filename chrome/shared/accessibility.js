/**
 * Accessibility utilities following WCAG 2.1 AA standards
 * Based on Proxly's comprehensive accessibility implementation patterns
 */

class AccessibilityHelper {
  constructor() {
    this.announceElement = this.createAnnouncementElement();
  }

  /**
   * Create screen reader announcement element
   * @returns {HTMLElement} Live region for announcements
   */
  createAnnouncementElement() {
    let element = document.getElementById('proxly-sr-announcements');
    if (!element) {
      element = document.createElement('div');
      element.id = 'proxly-sr-announcements';
      element.setAttribute('aria-live', 'polite');
      element.setAttribute('aria-atomic', 'true');
      element.className = 'sr-only';
      element.style.cssText = `
        position: absolute !important;
        left: -10000px !important;
        width: 1px !important;
        height: 1px !important;
        overflow: hidden !important;
        clip: rect(1px, 1px, 1px, 1px) !important;
        white-space: nowrap !important;
      `;
      document.body.appendChild(element);
    }
    return element;
  }

  /**
   * Announce message to screen readers
   * @param {string} message - Message to announce
   * @param {string} priority - 'polite' or 'assertive'
   */
  announce(message, priority = 'polite') {
    if (!message) return;
    
    this.announceElement.setAttribute('aria-live', priority);
    this.announceElement.textContent = message;
    
    // Clear after announcement to allow repeated messages
    setTimeout(() => {
      this.announceElement.textContent = '';
    }, 1000);
  }

  /**
   * Apply focus management to element
   * @param {HTMLElement} element - Element to focus
   * @param {Object} options - Focus options
   */
  manageFocus(element, options = {}) {
    if (!element) return;
    
    const { preventScroll = false, delayed = false } = options;
    
    const focusElement = () => {
      try {
        if (!element.hasAttribute('tabindex')) {
          element.setAttribute('tabindex', '-1');
        }
        element.focus({ preventScroll });
      } catch (error) {
        console.warn('Failed to manage focus:', error);
      }
    };
    
    if (delayed) {
      setTimeout(focusElement, 100);
    } else {
      focusElement();
    }
  }

  /**
   * Setup keyboard navigation for element
   * @param {HTMLElement} element - Element to enhance
   * @param {Object} handlers - Keyboard event handlers
   */
  setupKeyboardNavigation(element, handlers = {}) {
    if (!element) return;
    
    element.addEventListener('keydown', (event) => {
      const { key, shiftKey, ctrlKey, metaKey } = event;
      
      // Standard navigation keys
      switch (key) {
        case 'Enter':
        case ' ': // Space
          if (handlers.activate) {
            event.preventDefault();
            handlers.activate(event);
          }
          break;
        case 'Escape':
          if (handlers.escape) {
            event.preventDefault();
            handlers.escape(event);
          }
          break;
        case 'ArrowUp':
          if (handlers.arrowUp) {
            event.preventDefault();
            handlers.arrowUp(event);
          }
          break;
        case 'ArrowDown':
          if (handlers.arrowDown) {
            event.preventDefault();
            handlers.arrowDown(event);
          }
          break;
        case 'Tab':
          if (handlers.tab) {
            handlers.tab(event, shiftKey);
          }
          break;
      }
      
      // Custom key handlers
      if (handlers.custom) {
        handlers.custom(event);
      }
    });
  }

  /**
   * Apply high contrast styles based on system preferences
   */
  applyHighContrastSupport() {
    const mediaQuery = window.matchMedia('(prefers-contrast: more)');
    
    const updateContrast = (matches) => {
      document.body.classList.toggle('high-contrast', matches);
    };
    
    updateContrast(mediaQuery.matches);
    mediaQuery.addEventListener('change', (e) => updateContrast(e.matches));
  }

  /**
   * Apply reduced motion preferences
   */
  applyReducedMotionSupport() {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    
    const updateMotion = (matches) => {
      document.body.classList.toggle('reduce-motion', matches);
    };
    
    updateMotion(mediaQuery.matches);
    mediaQuery.addEventListener('change', (e) => updateMotion(e.matches));
  }

  /**
   * Validate form accessibility
   * @param {HTMLFormElement} form - Form to validate
   * @returns {Array} Array of accessibility issues
   */
  validateFormAccessibility(form) {
    const issues = [];
    
    // Check form has accessible name
    if (!form.getAttribute('aria-label') && !form.getAttribute('aria-labelledby')) {
      issues.push('Form missing accessible name');
    }
    
    // Check inputs have labels
    const inputs = form.querySelectorAll('input, select, textarea');
    inputs.forEach((input, index) => {
      const hasLabel = input.id && form.querySelector(`label[for="${input.id}"]`);
      const hasAriaLabel = input.getAttribute('aria-label');
      const hasAriaLabelledBy = input.getAttribute('aria-labelledby');
      
      if (!hasLabel && !hasAriaLabel && !hasAriaLabelledBy) {
        issues.push(`Input at index ${index} missing accessible label`);
      }
    });
    
    return issues;
  }

  /**
   * Create accessible button
   * @param {Object} config - Button configuration
   * @returns {HTMLButtonElement} Configured button element
   */
  createAccessibleButton(config) {
    const { text, ariaLabel, ariaDescribedBy, onClick, className } = config;
    
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = text;
    
    if (className) button.className = className;
    if (ariaLabel) button.setAttribute('aria-label', ariaLabel);
    if (ariaDescribedBy) button.setAttribute('aria-describedby', ariaDescribedBy);
    
    if (onClick) {
      button.addEventListener('click', onClick);
      button.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onClick(event);
        }
      });
    }
    
    return button;
  }
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AccessibilityHelper;
}