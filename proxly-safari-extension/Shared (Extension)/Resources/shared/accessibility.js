/**
 * Accessibility utilities following WCAG 2.1 AA standards
 * Based on Proxly's comprehensive accessibility implementation patterns
 * Adapted for Safari Web Extension compatibility
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
      // Ensure body exists before appending
      if (document.body) {
        document.body.appendChild(element);
      } else {
        // Wait for DOM to be ready if body doesn't exist yet
        document.addEventListener('DOMContentLoaded', () => {
          if (!document.getElementById('proxly-sr-announcements')) {
            document.body.appendChild(element);
          }
        });
      }
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
    
    try {
      this.announceElement.setAttribute('aria-live', priority);
      this.announceElement.textContent = message;
      
      // Clear after announcement to allow repeated messages
      setTimeout(() => {
        if (this.announceElement) {
          this.announceElement.textContent = '';
        }
      }, 1000);
    } catch (error) {
      console.warn('Failed to announce message:', error);
    }
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
   * Safari-compatible implementation
   */
  applyHighContrastSupport() {
    try {
      // Safari supports prefers-contrast media query
      const mediaQuery = window.matchMedia('(prefers-contrast: more)');
      
      const updateContrast = (matches) => {
        if (document.body) {
          document.body.classList.toggle('high-contrast', matches);
        }
      };
      
      updateContrast(mediaQuery.matches);
      
      // Safari supports addEventListener on MediaQueryList
      if (mediaQuery.addEventListener) {
        mediaQuery.addEventListener('change', (e) => updateContrast(e.matches));
      } else {
        // Fallback for older Safari versions
        mediaQuery.addListener((e) => updateContrast(e.matches));
      }
    } catch (error) {
      console.warn('High contrast support not available:', error);
    }
  }

  /**
   * Apply reduced motion preferences
   * Safari-compatible implementation
   */
  applyReducedMotionSupport() {
    try {
      const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
      
      const updateMotion = (matches) => {
        if (document.body) {
          document.body.classList.toggle('reduce-motion', matches);
        }
      };
      
      updateMotion(mediaQuery.matches);
      
      // Safari supports addEventListener on MediaQueryList
      if (mediaQuery.addEventListener) {
        mediaQuery.addEventListener('change', (e) => updateMotion(e.matches));
      } else {
        // Fallback for older Safari versions
        mediaQuery.addListener((e) => updateMotion(e.matches));
      }
    } catch (error) {
      console.warn('Reduced motion support not available:', error);
    }
  }

  /**
   * Validate form accessibility
   * @param {HTMLFormElement} form - Form to validate
   * @returns {Array} Array of accessibility issues
   */
  validateFormAccessibility(form) {
    const issues = [];
    
    if (!form) return issues;
    
    try {
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
    } catch (error) {
      console.warn('Form accessibility validation failed:', error);
    }
    
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

  /**
   * Safari-specific accessibility enhancements
   */
  applySafariAccessibilityEnhancements() {
    // Safari-specific focus management
    document.addEventListener('focusin', (event) => {
      // Ensure focused elements are visible
      if (event.target && event.target.scrollIntoViewIfNeeded) {
        event.target.scrollIntoViewIfNeeded(false);
      } else if (event.target && event.target.scrollIntoView) {
        event.target.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    });
  }
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AccessibilityHelper;
}