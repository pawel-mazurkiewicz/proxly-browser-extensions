# Proxly Browser Extensions - Installation Guide

This guide provides detailed instructions for installing and configuring Proxly browser extensions on Chrome, Firefox, and Safari.

## Prerequisites

### System Requirements
- **macOS**: Version 10.15 (Catalina) or later
- **Proxly App**: Must be installed and running
- **Browsers**: Chrome 88+ (MV3), Firefox 109+ (MV2), Safari 14+

### Proxly App Setup
1. Ensure Proxly is installed from the Mac App Store or official website
2. Launch Proxly and complete initial setup
3. Verify Proxly is running in the menu bar
4. Test URL routing with a simple link to confirm Proxly is working

## Chrome Installation

### Method 1: Development Installation (Recommended for Beta)

1. **Build or Download**
   - Build from source using `npm run build:chrome`
   - Or download the latest packaged build if available

2. **Enable Developer Mode**
   - Open Chrome and navigate to `chrome://extensions/`
   - Toggle "Developer mode" in the top-right corner
   - You should see additional buttons appear

3. **Install Extension**
   - Click "Load unpacked"
   - Navigate to and select the built folder: `proxly-browser-extensions/build/chrome`
   - Click "Select Folder"

4. **Verify Installation**
   - The Proxly extension should appear in your extensions list
   - You should see the Proxly icon in your browser toolbar
   - Extension status should show "Active"

### Method 2: Chrome Web Store (Future Release)

*Chrome Web Store distribution is planned for future releases.*

### Chrome Configuration

1. **Access Settings**
   - Click the Proxly extension icon in the toolbar
   - Select "Options" from the dropdown

2. **Configure Link Handling**
   - Choose between "Right click only" or "Capture all external links"
   - Configure visual and audio feedback preferences
   - Test the connection to Proxly app

3. **Set Permissions**
   - Ensure the extension has permission to "Read and change all your data on all websites"
   - This is required for link detection and capture

## Firefox Installation

### Method 1: Development Installation

1. **Build or Download**
   - Build from source using `npm run build:firefox`
   - Or download the latest packaged build if available

2. **Temporary Installation**
   - Open Firefox and navigate to `about:debugging`
   - Click "This Firefox" in the left sidebar
   - Click "Load Temporary Add-on..."
   - Navigate to `proxly-browser-extensions/build/firefox` and select `manifest.json`

3. **Verify Installation**
   - Extension appears in the debugging page
   - Proxly icon visible in toolbar
   - Note: Temporary extensions are removed when Firefox restarts

### Method 2: Permanent Installation (Signed Extension)

1. **Download Signed Package**
   - Download the `.xpi` file from Proxly website
   - Firefox will prompt to install when you open the file

2. **Install from File**
   - Firefox → Add-ons and Themes
   - Click the gear icon → "Install Add-on From File..."
   - Select the downloaded `.xpi` file

### Method 3: Firefox Add-ons Store (Future Release)

*Mozilla Add-ons (AMO) distribution is planned for future releases.*

### Firefox Configuration

1. **Access Preferences**
   - Right-click the Proxly icon
   - Select "Preferences" or "Options"

2. **Configure Extension**
   - Set link handling mode preference
   - Enable/disable feedback options
   - Test Proxly app connectivity

### Notes for Temporary Loads
- When loaded via `about:debugging`, Firefox may show warnings related to `storage.sync`. This is expected during temporary loads.
- The extension manifest includes `browser_specific_settings.gecko.id`, and signed builds will not surface this warning.

## Safari Installation

Safari support is implemented as a Safari App Extension.

1. **Open the Xcode Project**
   - Open `proxly-browser-extensions/proxly-safari-extension/proxly-safari-extension.xcodeproj` in Xcode

2. **Build & Run**
   - Select the macOS App target
   - Press Run to build and launch the host app

3. **Enable the Extension in Safari**
   - Open Safari → Settings → Extensions
   - Enable the Proxly extension

## Configuration Options

### Link Handling Modes

#### Ricght Click Mode (Default)
- **How it works**: Links are captured only when you click right mouse button and select "Open with Proxly"
- **Best for**: Users who want selective link routing
- **Usage**: Right click on the link + "Open with Proxly"



#### All External Links Mode
- **How it works**: All links to external websites are automatically captured
- **Best for**: Users who want maximum automation
- **Usage**: External links automatically route through Proxly; same-domain navigation works normally

### Feedback Options

#### Visual Feedback
- **Enabled**: Shows a brief "→ Proxly" indicator when links are captured
- **Disabled**: No visual indication (still works silently)
- **Accessibility**: Respects reduced motion preferences

#### Sound Feedback
- **Enabled**: Plays a subtle sound when links are captured
- **Disabled**: Silent operation
- **Note**: Requires browser audio permissions

## Testing Installation

### Basic Functionality Test

1. **Test Context Menu**
   - Right-click any link
   - Select "Open with Proxly"
   - Verify link routes correctly

2. **Test Settings**
   - Open extension options
   - Click "Test Connection"
   - Should show "Connection test successful"

### Advanced Testing

1. **Mode Switching**
   - Switch between Right click and All Links modes
   - Test link behavior changes accordingly
   - Verify internal links still work normally in All Links mode

2. **Feedback Testing**
   - Enable visual feedback and click a link
   - Should see "→ Proxly" indicator
   - Enable sound feedback for audio confirmation

## Troubleshooting

### Extension Not Loading

#### Chrome
```
Error: "Manifest file is missing or unreadable"
```
- **Solution**: Ensure you're selecting the correct folder containing manifest.json
- **Check**: Folder should contain manifest.json, background.js, and other extension files

#### Firefox
```
Error: "Extension is invalid"
```
- **Solution**: Ensure you're selecting manifest.json file, not the folder
- **Check**: Manifest should be valid Firefox-compatible JSON

### Extension Loaded But Not Working

1. **Check Proxly App**
   - Verify Proxly is running (check menu bar)
   - Test Proxly directly with a URL: `open "proxly://open/aHR0cHM6Ly9leGFtcGxlLmNvbQ=="`

2. **Check Permissions**
   - Chrome: Extensions page → Proxly → "Details" → Ensure "Allow access to file URLs" is enabled if needed
   - Firefox: about:addons → Proxly → Permissions tab → Verify all permissions granted

3. **Check Browser Console**
   - Open Developer Tools (F12)
   - Check Console tab for error messages
   - Look for Proxly-related errors

### Links Not Being Captured

1. **Verify Mode Setting**
   - Check extension options
   - Ensure correct link handling mode is selected
   - Test both modes to confirm functionality

2. **Check Link Types**
   - Extension only works with http/https links
   - JavaScript links (`javascript:`) are not captured
   - Download links are not captured
   - Same-domain links are not captured in "All Links" mode

### No Connection to Proxly

1. **App Status**
   - Restart Proxly app
   - Check Activity Monitor to confirm Proxly is running
   - Verify Proxly responds to other URL routing

2. **Protocol Registration**
   - Open Terminal: `open "proxly://open/aHR0cHM6Ly9leGFtcGxlLmNvbQ=="`
   - Should open Proxly and process the URL
   - If not working, reinstall Proxly app

3. **Firewall/Security**
   - Check macOS Security & Privacy settings
   - Ensure Proxly has necessary permissions
   - Try temporarily disabling firewall to test

## Updating Extensions

### Chrome
1. Go to `chrome://extensions/`
2. Click the refresh icon next to Proxly extension
3. Or re-install using "Load unpacked" with new version

### Firefox
1. For temporary add-ons: Remove and re-install with new files
2. For permanent extensions: Firefox will auto-update signed versions

## Uninstalling Extensions

### Chrome
1. Navigate to `chrome://extensions/`
2. Find Proxly extension
3. Click "Remove" button
4. Confirm removal

### Firefox
1. Navigate to `about:addons`
2. Find Proxly extension
3. Click "..." menu → "Remove"
4. Confirm removal

## Getting Help

If you encounter issues not covered in this guide:

1. **Check Extension Console**
   - Open extension options page
   - Check browser developer tools for errors
   - Look for specific error messages

2. **Test Proxly App Directly**
   - Verify Proxly works independently
   - Check Proxly's own documentation and support

3. **Report Issues**
   - Include browser type and version
   - Include extension version
   - Include specific error messages
   - Describe steps to reproduce the issue

4. **Community Support**
   - Check Proxly documentation
   - Visit community forums or support channels
   - Search for similar issues online

## Security Notes

- Extensions only have access to necessary permissions
- No user data is collected or transmitted
- All settings stored locally in browser
- URL processing happens locally through Proxly app
- Extensions use secure communication with Proxly app

---

For the latest updates and additional support resources, visit the official Proxly website.