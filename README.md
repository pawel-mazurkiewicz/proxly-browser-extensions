# Proxly Browser Extensions

Hey there! Welcome to the official repository for the Proxly browser extensions. This is where I build and maintain the extensions that connect your browser to the main Proxly application. I have decided to open source it, so people can browse through the code of these extensions and see for themselves that they're not doing anything nasty - given that they require _all_sites_ permissions to operate.

## What's Proxly?

Proxly is a desktop application that intelligently manages how you open web links. Think of it as a smart router for your URLs. Instead of every link opening in your default browser, Proxly lets you set up rules to open links in the right browser and profiles. It's designed to streamline your workflow, especially if you juggle multiple browsers for work, development, and personal use.

This repository contains the browser extensions, which are a crucial piece of the puzzle. They act as the bridge between your browser and the Proxly app.

## What Do These Extensions Do?

These extensions integrate Proxly's power directly into Chrome, Firefox, and Safari. Once installed, the extension can capture links you click and send them to the Proxly app for routing.

You can configure it in a couple of ways:
*   **Right Click Mode:** The extension also adds a handy "Open with Proxly" option to your right-click context menu. You decide exactly which link you want to route through Proxly.
*   **Capture All Mode:** Automatically send all external links to Proxly.

External links in this context means links that lead to any domain that is external to the one you're currently on.

## Supported Browsers

*   **Chromium-based browsers** - tested in Chrome, Brave, Comet
*   **Mozilla Firefox** - tested in Firefox, but it'll probably work in every other browser that support Firefox extensions
*   **Apple Safari** - built the Apple way™️ — Safari App Extension included

## Install from Stores

*   **Chrome Web Store**: [Proxly](https://chromewebstore.google.com/detail/ogdlghkmpodpjcjlpaibbanlhbfhpdij/)
*   **Firefox Add-ons (AMO)**: [Proxly](https://addons.mozilla.org/en-US/firefox/addon/proxly-extension/)

If you prefer building locally or testing development versions, see the Build section below and the [Installation Guide](./docs/INSTALLATION_GUIDE.md).

## Build

You can build for a specific browser or all at once. Outputs are placed in the `build/` directory.

```bash
# Build all extensions
npm run build

# Build only the Chrome extension
npm run build:chrome

# Build only the Firefox extension
npm run build:firefox
```

After building, follow the "Development Installation" steps in our [Installation Guide](./docs/INSTALLATION_GUIDE.md) to load the extension into your browser.


## How This Repository is Organized

The codebase is structured to share as much logic as possible while accommodating the differences between browser platforms.

*   `chrome/`: Contains the specific manifest and files for the Chrome extension.
*   `firefox/`: Contains the specific manifest and files for the Firefox extension.
*   `proxly-safari-extension/`: The Xcode project for the Safari extension.
*   `scripts/`: Build scripts

## Contributing

I'd love your help! If you've found a bug or have an idea for a new feature, please feel free to open an issue. If you want to contribute code, you can fork the repository, create a new branch for your feature or fix, and then submit a pull request.

---

Thanks for checking out the Proxly browser extensions!