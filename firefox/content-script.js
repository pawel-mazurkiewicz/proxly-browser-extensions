/**
 * Universal content script for all browsers
 * Handles link capture with accessibility support
 */

class ProxlyContentScript {
  constructor() {
    this.settings = {
      linkMode: 'all', // Default to capturing all links
      enabled: true, // Extension enabled by default
      visualFeedback: true,
      soundFeedback: false
    };
    this.accessibilityHelper = null;
    
    this.init();
  }

  async init() {
    try {
      console.log('🚀 Proxly content script starting initialization on:', window.location.href);
      
      // Wait for DOM to be ready
      if (document.readyState === 'loading') {
        console.log('⏳ Waiting for DOM to be ready...');
        await new Promise(resolve => {
          document.addEventListener('DOMContentLoaded', resolve);
        });
      }
      
      console.log('✅ DOM is ready, continuing initialization');
      
      // Initialize accessibility helper
      try {
        this.accessibilityHelper = new AccessibilityHelper();
        console.log('✅ Accessibility helper initialized');
      } catch (error) {
        console.warn('⚠️ Failed to initialize accessibility helper:', error);
        // Create a simple fallback
        this.accessibilityHelper = { 
          announce: () => {}, 
          applyHighContrastSupport: () => {},
          applyReducedMotionSupport: () => {}
        };
      }
      
      await this.loadSettings();
      this.setupEventListeners();
      this.setupSettingsListener();
      this.setupAccessibility();
      
      console.log('✅ Proxly content script fully initialized on:', window.location.href);
      console.log('📊 Final settings:', this.settings);
    } catch (error) {
      console.error('❌ Failed to initialize Proxly content script:', error);
    }
  }

  setupAccessibility() {
    // Apply system accessibility preferences
    this.accessibilityHelper.applyHighContrastSupport();
    this.accessibilityHelper.applyReducedMotionSupport();
  }

  async loadSettings() {
    try {
      console.log('🔄 Loading settings...');
      
      // Always try storage first (more reliable than service worker)
      const result = await chrome.storage.sync.get(null);
      this.settings = {
        linkMode: result.linkMode || 'all',
        enabled: result.enabled !== undefined ? result.enabled : true,
        visualFeedback: result.visualFeedback !== undefined ? result.visualFeedback : true,
        soundFeedback: result.soundFeedback || false
      };
      console.log('✅ Content script settings loaded from storage:', this.settings);
      
      // Optionally try to sync with background script (but don't fail if it doesn't work)
      try {
        const response = await this.sendMessageWithRetry({ type: 'GET_SETTINGS' });
        if (response && !response.error) {
          console.log('✅ Background script settings also available:', response);
          // Use background settings if they differ significantly
          if (response.enabled !== this.settings.enabled || response.linkMode !== this.settings.linkMode) {
            console.log('🔄 Using background settings as they differ from storage');
            this.settings = response;
          }
        }
      } catch (bgError) {
        console.warn('⚠️ Background script unavailable, using storage settings:', bgError.message);
      }
      
    } catch (error) {
      console.warn('❌ Failed to load settings from storage, using defaults:', error);
      // Use safe defaults
      this.settings = {
        linkMode: 'all',
        enabled: true,
        visualFeedback: true,
        soundFeedback: false
      };
    }
  }

  setupEventListeners() {
    // Simple link click handling without modifier keys

    // Link click handling
    document.addEventListener('click', (event) => {
      this.handleLinkClick(event);
    }, true);

    // Handle middle click for comprehensive coverage
    document.addEventListener('auxclick', (event) => {
      if (event.button === 1) { // Middle click
        this.handleLinkClick(event);
      }
    }, true);

    // Handle keyboard navigation on links
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' && event.target.tagName.toLowerCase() === 'a') {
        this.handleLinkClick(event);
      }
    }, true);
  }

  setupSettingsListener() {
    // Listen for runtime messages about settings changes
    try {
      chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.type === 'SETTINGS_UPDATED') {
          this.settings = message.settings;
          console.log('✅ Settings updated in content script:', this.settings);
          sendResponse({ received: true });
        }
        return true;
      });
      
      // Also listen for storage changes directly (more reliable)
      chrome.storage.onChanged.addListener((changes, namespace) => {
        if (namespace === 'sync') {
          console.log('🔄 Storage changes detected:', changes);
          
          // Update settings based on storage changes
          let settingsChanged = false;
          if (changes.enabled && changes.enabled.newValue !== this.settings.enabled) {
            this.settings.enabled = changes.enabled.newValue;
            settingsChanged = true;
          }
          if (changes.linkMode && changes.linkMode.newValue !== this.settings.linkMode) {
            this.settings.linkMode = changes.linkMode.newValue;
            settingsChanged = true;
          }
          if (changes.visualFeedback && changes.visualFeedback.newValue !== this.settings.visualFeedback) {
            this.settings.visualFeedback = changes.visualFeedback.newValue;
            settingsChanged = true;
          }
          if (changes.soundFeedback && changes.soundFeedback.newValue !== this.settings.soundFeedback) {
            this.settings.soundFeedback = changes.soundFeedback.newValue;
            settingsChanged = true;
          }
          
          if (settingsChanged) {
            console.log('✅ Settings updated from storage:', this.settings);
          }
        }
      });
    } catch (error) {
      console.warn('⚠️ Failed to setup settings listeners:', error);
    }
  }


  handleLinkClick(event) {
    const anchor = this.findLinkElement(event.target);
    if (!anchor || !this.shouldCaptureLink(anchor, event)) {
      return;
    }

    try {
      const url = new URL(anchor.href, document.baseURI).href;
      
      // Validate URL
      if (!this.isValidUrl(url)) {
        console.warn('Invalid URL detected:', url);
        return;
      }

      // Prevent default navigation
      event.preventDefault();
      event.stopPropagation();

      // Capture the link
      this.captureLink(url, anchor);
      
    } catch (error) {
      console.error('Error handling link click:', error);
      this.showError('errorInvalidUrl');
    }
  }

  findLinkElement(element) {
    let current = element;
    let depth = 0;
    const maxDepth = 5; // Prevent infinite loops
    
    while (current && current.parentNode && depth < maxDepth) {
      if (current.tagName && current.tagName.toLowerCase() === 'a') {
        return current;
      }
      current = current.parentNode;
      depth++;
    }
    
    return null;
  }

  shouldCaptureLink(anchor, event) {
    console.log('shouldCaptureLink called with:', {
      href: anchor.href,
      enabled: this.settings.enabled,
      linkMode: this.settings.linkMode,
      settings: this.settings
    });

    // Must have href attribute
    if (!anchor.hasAttribute('href')) {
      console.log('No href attribute, skipping');
      return false;
    }

    // Skip javascript: and mailto: links
    const href = anchor.href.toLowerCase();
    if (href.startsWith('javascript:') || href.startsWith('mailto:') || href.startsWith('tel:')) {
      console.log('Special protocol link, skipping:', href);
      return false;
    }

    // Skip if it's a same-page anchor link
    if (href.startsWith('#')) {
      console.log('Same-page anchor link, skipping');
      return false;
    }

    // Check if it's a download link
    if (anchor.hasAttribute('download')) {
      console.log('Download link, skipping');
      return false;
    }

    // Check if extension is enabled
    if (!this.settings.enabled) {
      console.log('Extension disabled, skipping');
      return false;
    }

    // Check mode-specific conditions  
    if (this.settings.linkMode === 'all') {
      // In 'all' mode, capture all external links
      try {
        const linkUrl = new URL(anchor.href, document.baseURI);
        const currentUrl = new URL(window.location.href);
        
        const isExternal = linkUrl.origin !== currentUrl.origin;
        console.log('All links mode - external link check:', {
          linkOrigin: linkUrl.origin,
          currentOrigin: currentUrl.origin,
          isExternal
        });
        
        // Only capture cross-origin links in 'all' mode to avoid breaking navigation
        return isExternal;
      } catch (error) {
        console.error('Error parsing URL:', error);
        return false;
      }
    } else if (this.settings.linkMode === 'context') {
      // In context mode, only capture via right-click menu
      console.log('Context mode - not capturing via click');
      return false;
    }

    console.log('No matching conditions, not capturing');
    return false;
  }

  isValidUrl(urlString) {
    try {
      const url = new URL(urlString);
      return ['http:', 'https:'].includes(url.protocol);
    } catch {
      return false;
    }
  }

  async captureLink(url, anchorElement) {
    try {
      console.log('Capturing link (direct):', url);
      // Provide feedback BEFORE any navigation
      this.showCaptureFeedback(anchorElement);
      // Navigate directly via proxly protocol without messaging background
      this.forwardToProxlyDirect(url);
    } catch (error) {
      console.error('Direct capture failed:', error);
      this.showError('errorProxlyNotRunning');
    }
  }

  async sendMessageWithRetry(message, maxRetries = 2) {
    for (let i = 0; i < maxRetries; i++) {
      try {
        const response = await chrome.runtime.sendMessage(message);
        return response;
      } catch (error) {
        console.warn(`Message attempt ${i + 1} failed:`, error.message);
        
        if (error.message.includes('Extension context invalidated')) {
          // Wait a bit and try again - sometimes the service worker restarts
          await new Promise(resolve => setTimeout(resolve, 100));
          continue;
        }
        
        // For other errors, don't retry
        throw error;
      }
    }
    
    // All retries failed
    throw new Error('All message attempts failed');
  }

  forwardToProxlyDirect(url) {
    try {
      // Create proxly:// URL directly (same logic as background script)
      const encodedUrl = btoa(url);
      const proxlyUrl = `proxly://open/${encodedUrl}`;
      
      console.log('Forwarding to Proxly directly:', url, '->', proxlyUrl);
      
      // Navigate to the proxly:// URL
      window.location.href = proxlyUrl;
      
    } catch (error) {
      console.error('Failed to create proxly URL:', error);
      throw error;
    }
  }

  showCaptureFeedback(element) {
    // Announce to screen readers
    this.accessibilityHelper.announce(
      LocalizationHelper.getMessage('accessibilityLinkCapture', 'Link will be opened with Proxly')
    );

    // Visual feedback
    if (this.settings.visualFeedback) {
      this.showVisualFeedback(element);
    }

    // Sound feedback
    if (this.settings.soundFeedback) {
      this.playCaptureFeedback();
    }
  }

  showVisualFeedback(element) {
    // Create a temporary visual indicator
    const indicator = document.createElement('div');
    indicator.className = 'proxly-capture-indicator';
    indicator.textContent = '→ Proxly';
    indicator.style.cssText = `
      position: fixed !important;
      top: 10px !important;
      right: 10px !important;
      background: #007AFF !important;
      color: white !important;
      padding: 8px 12px !important;
      border-radius: 4px !important;
      font-size: 12px !important;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
      z-index: 999999 !important;
      pointer-events: none !important;
      box-shadow: 0 2px 10px rgba(0,0,0,0.2) !important;
      animation: proxly-fade-in 0.2s ease-out, proxly-fade-out 0.2s ease-out 1.8s !important;
    `;

    // Add CSS animation
    if (!document.getElementById('proxly-capture-styles')) {
      const styles = document.createElement('style');
      styles.id = 'proxly-capture-styles';
      styles.textContent = `
        @keyframes proxly-fade-in {
          from { opacity: 0 !important; transform: translateY(-10px) !important; }
          to { opacity: 1 !important; transform: translateY(0) !important; }
        }
        @keyframes proxly-fade-out {
          from { opacity: 1 !important; transform: translateY(0) !important; }
          to { opacity: 0 !important; transform: translateY(-10px) !important; }
        }
        .reduce-motion .proxly-capture-indicator {
          animation: none !important;
          opacity: 1 !important;
        }
      `;
      document.head.appendChild(styles);
    }

    document.body.appendChild(indicator);

    // Remove after animation
    setTimeout(() => {
      if (indicator.parentNode) {
        indicator.parentNode.removeChild(indicator);
      }
    }, 2000);
  }

  playCaptureFeedback() {
    try {
      // Create a subtle audio feedback
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(600, audioContext.currentTime + 0.1);
      
      gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.1);
    } catch (error) {
      console.warn('Could not play capture feedback sound:', error);
    }
  }

  showError(messageKey) {
    const message = LocalizationHelper.getMessage(messageKey, 'An error occurred');
    this.accessibilityHelper.announce(message, 'assertive');
    
    // Show visual error feedback
    if (this.settings.visualFeedback) {
      const indicator = document.createElement('div');
      indicator.textContent = '⚠ Proxly Error';
      indicator.style.cssText = `
        position: fixed !important;
        top: 10px !important;
        right: 10px !important;
        background: #FF3B30 !important;
        color: white !important;
        padding: 8px 12px !important;
        border-radius: 4px !important;
        font-size: 12px !important;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
        z-index: 999999 !important;
        pointer-events: none !important;
        box-shadow: 0 2px 10px rgba(0,0,0,0.2) !important;
      `;
      
      document.body.appendChild(indicator);
      
      setTimeout(() => {
        if (indicator.parentNode) {
          indicator.parentNode.removeChild(indicator);
        }
      }, 3000);
    }
  }
}

// Initialize when script loads
new ProxlyContentScript();