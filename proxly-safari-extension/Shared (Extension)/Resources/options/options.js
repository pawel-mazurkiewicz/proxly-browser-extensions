/**
 * Proxly Extension Options Page JavaScript
 * Handles settings management with full accessibility support
 */

class ProxlyOptionsPage {
  constructor() {
    this.settingsManager = new SettingsManager();
    this.accessibilityHelper = new AccessibilityHelper();
    this.currentSettings = {};
    
    this.init();
  }

  async init() {
    console.log('Initializing Proxly options page');
    
    // Initialize localization
    LocalizationHelper.initializePage();
    
    // Setup accessibility
    this.setupAccessibility();
    
    // Load current settings
    await this.loadCurrentSettings();
    
    // Setup form handling
    this.setupFormHandling();
    
    // Setup UI interactions
    this.setupUIInteractions();
    
    // Check Proxly app status
    this.checkProxlyAppStatus();
    
    // Set extension version
    this.setExtensionVersion();
    
    console.log('Options page initialized successfully');
  }

  setupAccessibility() {
    // Apply system accessibility preferences
    this.accessibilityHelper.applyHighContrastSupport();
    this.accessibilityHelper.applyReducedMotionSupport();
    
    // Setup keyboard navigation for custom form elements
    const radioButtons = document.querySelectorAll('input[type="radio"]');
    radioButtons.forEach(radio => {
      this.accessibilityHelper.setupKeyboardNavigation(radio.parentElement, {
        activate: (event) => {
          radio.checked = true;
          radio.dispatchEvent(new Event('change'));
        }
      });
    });
    
    const checkboxes = document.querySelectorAll('input[type="checkbox"]');
    checkboxes.forEach(checkbox => {
      this.accessibilityHelper.setupKeyboardNavigation(checkbox.parentElement, {
        activate: (event) => {
          checkbox.checked = !checkbox.checked;
          checkbox.dispatchEvent(new Event('change'));
        }
      });
    });
  }

  async loadCurrentSettings() {
    try {
      this.currentSettings = await this.settingsManager.loadSettings();
      this.updateUI();
      console.log('Current settings loaded:', this.currentSettings);
    } catch (error) {
      console.error('Failed to load settings:', error);
      this.showStatus('Failed to load settings', 'error');
    }
  }

  updateUI() {
    // Update radio buttons for link mode
    const linkModeRadio = document.querySelector(`input[name="linkMode"][value="${this.currentSettings.linkMode}"]`);
    if (linkModeRadio) {
      linkModeRadio.checked = true;
    }
    
    // Update mode description
    this.updateModeDescription(this.currentSettings.linkMode);
    
    // Update checkboxes
    const visualFeedbackCheckbox = document.getElementById('visual-feedback');
    if (visualFeedbackCheckbox) {
      visualFeedbackCheckbox.checked = this.currentSettings.visualFeedback;
    }
    
    const soundFeedbackCheckbox = document.getElementById('sound-feedback');
    if (soundFeedbackCheckbox) {
      soundFeedbackCheckbox.checked = this.currentSettings.soundFeedback;
    }
  }

  setupFormHandling() {
    const form = document.getElementById('settings-form');
    if (!form) return;
    
    // Form submission
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      this.saveSettings();
    });
    
    // Real-time validation and feedback
    const inputs = form.querySelectorAll('input');
    inputs.forEach(input => {
      input.addEventListener('change', () => {
        this.validateForm();
      });
    });
    
    // Reset button
    const resetButton = document.querySelector('.reset-button');
    if (resetButton) {
      resetButton.addEventListener('click', () => {
        this.resetToDefaults();
      });
    }
    
    // Test button
    const testButton = document.querySelector('.test-button');
    if (testButton) {
      testButton.addEventListener('click', () => {
        this.testConnection();
      });
    }
  }

  setupUIInteractions() {
    // Mode selection feedback
    const modeRadios = document.querySelectorAll('input[name="linkMode"]');
    modeRadios.forEach(radio => {
      radio.addEventListener('change', () => {
        this.updateModeDescription(radio.value);
      });
    });
    
    // Checkbox feedback
    const checkboxes = document.querySelectorAll('input[type="checkbox"]');
    checkboxes.forEach(checkbox => {
      checkbox.addEventListener('change', () => {
        this.provideFeedbackForSetting(checkbox);
      });
    });
  }

  updateModeDescription(mode) {
    const descriptions = {
      'context': LocalizationHelper.getMessage('modeContextOnlyDescription', 
        'Use right-click "Open with Proxly" to capture links'),
      'all': LocalizationHelper.getMessage('modeAllLinksDescription', 
        'All external links (links to other websites) will be routed through Proxly automatically')
    };
    
    // Announce the mode change to screen readers
    const description = descriptions[mode] || '';
    if (description) {
      this.accessibilityHelper.announce(
        LocalizationHelper.getMessageWithSubstitutions('modeChanged', [description])
      );
    }
  }

  provideFeedbackForSetting(checkbox) {
    const feedbackMessages = {
      'visual-feedback': checkbox.checked 
        ? LocalizationHelper.getMessage('visualFeedbackEnabled', 'Visual feedback enabled')
        : LocalizationHelper.getMessage('visualFeedbackDisabled', 'Visual feedback disabled'),
      'sound-feedback': checkbox.checked
        ? LocalizationHelper.getMessage('soundFeedbackEnabled', 'Sound feedback enabled')
        : LocalizationHelper.getMessage('soundFeedbackDisabled', 'Sound feedback disabled')
    };
    
    const message = feedbackMessages[checkbox.id];
    if (message) {
      this.accessibilityHelper.announce(message);
    }
  }

  validateForm() {
    const form = document.getElementById('settings-form');
    if (!form) return true;
    
    // Check accessibility
    const issues = this.accessibilityHelper.validateFormAccessibility(form);
    if (issues.length > 0) {
      console.warn('Accessibility issues found:', issues);
    }
    
    // Check if at least one link mode is selected
    const linkMode = document.querySelector('input[name="linkMode"]:checked');
    if (!linkMode) {
      this.showStatus('Please select a link handling mode', 'error');
      return false;
    }
    
    return true;
  }

  async saveSettings() {
    if (!this.validateForm()) return;
    
    try {
      // Show saving indicator
      this.showStatus(LocalizationHelper.getMessage('savingSettings', 'Saving settings...'), 'info');
      
      // Gather form data
      const formData = new FormData(document.getElementById('settings-form'));
      const newSettings = {
        linkMode: formData.get('linkMode') || 'all',
        enabled: this.currentSettings.enabled !== undefined ? this.currentSettings.enabled : true,
        visualFeedback: document.getElementById('visual-feedback').checked,
        soundFeedback: document.getElementById('sound-feedback').checked,
        version: this.currentSettings.version
      };
      
      // Save settings
      const success = await this.settingsManager.saveSettings(newSettings);
      
      if (success) {
        this.currentSettings = newSettings;
        this.showStatus(LocalizationHelper.getMessage('settingsSaved', 'Settings saved successfully'), 'success');
        
        // Announce success to screen readers
        this.accessibilityHelper.announce(
          LocalizationHelper.getMessage('settingsSavedAnnouncement', 'Settings have been saved successfully')
        );
        
        console.log('Settings saved successfully:', newSettings);
      } else {
        throw new Error('Failed to save settings');
      }
      
    } catch (error) {
      console.error('Error saving settings:', error);
      this.showStatus(LocalizationHelper.getMessage('settingsSaveError', 'Failed to save settings'), 'error');
      
      this.accessibilityHelper.announce(
        LocalizationHelper.getMessage('settingsSaveErrorAnnouncement', 'Failed to save settings'), 
        'assertive'
      );
    }
  }

  async resetToDefaults() {
    try {
      // Show confirmation
      const confirmed = confirm(LocalizationHelper.getMessage('resetConfirmation', 
        'Are you sure you want to reset all settings to their default values?'));
      
      if (!confirmed) return;
      
      this.showStatus(LocalizationHelper.getMessage('resettingSettings', 'Resetting to defaults...'), 'info');
      
      const success = await this.settingsManager.resetSettings();
      
      if (success) {
        // Reload settings and update UI
        await this.loadCurrentSettings();
        this.showStatus(LocalizationHelper.getMessage('settingsReset', 'Settings reset to defaults'), 'success');
        
        this.accessibilityHelper.announce(
          LocalizationHelper.getMessage('settingsResetAnnouncement', 'Settings have been reset to default values')
        );
        
        console.log('Settings reset to defaults');
      } else {
        throw new Error('Failed to reset settings');
      }
      
    } catch (error) {
      console.error('Error resetting settings:', error);
      this.showStatus(LocalizationHelper.getMessage('settingsResetError', 'Failed to reset settings'), 'error');
    }
  }

  async testConnection() {
    try {
      this.showStatus(LocalizationHelper.getMessage('testingConnection', 'Testing connection to Proxly...'), 'info');
      
      // Test by attempting to send a message to background script
      const response = await browser.runtime.sendMessage({ type: 'GET_SETTINGS' });
      
      if (response) {
        // Try to test Proxly app connectivity by creating a test URL
        const testUrl = 'https://www.example.com/test';
        const testResponse = await browser.runtime.sendMessage({
          type: 'CAPTURE_LINK',
          url: testUrl,
          isTest: true
        });
        
        if (testResponse && testResponse.success) {
          this.showStatus(LocalizationHelper.getMessage('connectionSuccess', 'Connection test successful'), 'success');
          this.updateProxlyAppStatus(true);
        } else {
          this.showStatus(LocalizationHelper.getMessage('proxlyAppNotRunning', 
            'Proxly app is not running or not responding'), 'error');
          this.updateProxlyAppStatus(false);
        }
      } else {
        throw new Error('No response from extension background script');
      }
      
    } catch (error) {
      console.error('Connection test failed:', error);
      this.showStatus(LocalizationHelper.getMessage('connectionTestError', 'Connection test failed'), 'error');
      this.updateProxlyAppStatus(false);
    }
  }

  async checkProxlyAppStatus() {
    // Only check connection status on first setup or when explicitly requested
    try {
      const result = await browser.storage.local.get(['hasTestedConnection']);
      if (!result.hasTestedConnection) {
        setTimeout(() => {
          this.testConnection();
          browser.storage.local.set({ hasTestedConnection: true });
        }, 1000);
      } else {
        // Just show a neutral status without testing
        this.showStatus('Ready - click "Test Connection" to verify Proxly app', 'info');
      }
    } catch (error) {
      console.warn('Could not check test status:', error);
    }
  }

  updateProxlyAppStatus(isRunning) {
    const statusIcon = document.getElementById('app-status-icon');
    const statusText = document.getElementById('app-status-text');
    
    if (isRunning) {
      statusIcon.textContent = '✅';
      statusText.textContent = LocalizationHelper.getMessage('proxlyAppRunning', 'Proxly app is running');
    } else {
      statusIcon.textContent = '❌';
      statusText.textContent = LocalizationHelper.getMessage('proxlyAppNotRunning', 'Proxly app is not running or not responding');
    }
  }

  setExtensionVersion() {
    const versionElement = document.getElementById('extension-version');
    if (versionElement && browser.runtime && browser.runtime.getManifest) {
      const manifest = browser.runtime.getManifest();
      versionElement.textContent = manifest.version || '1.0.0';
    }
  }

  showStatus(message, type = 'info') {
    const statusDiv = document.getElementById('save-status');
    if (!statusDiv) return;
    
    // Clear existing classes
    statusDiv.className = `save-status ${type}`;
    statusDiv.textContent = message;
    
    // Show with animation
    statusDiv.classList.add('show');
    
    // Auto-hide after delay
    setTimeout(() => {
      statusDiv.classList.remove('show');
    }, type === 'error' ? 5000 : 3000);
  }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new ProxlyOptionsPage();
});