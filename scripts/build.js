#!/usr/bin/env node

/**
 * Cross-platform build script for Proxly browser extensions
 * Generates platform-specific packages for Chrome, Firefox, and Safari
 */

const fs = require('fs-extra');
const path = require('path');
const archiver = require('archiver');

class ExtensionBuilder {
  constructor() {
    this.projectRoot = path.resolve(__dirname, '..');
    this.buildDir = path.join(this.projectRoot, 'build');
    this.sourceDir = this.projectRoot;
    
    this.platforms = ['chrome', 'firefox'];
    
    // Load extension configuration
    this.config = this.loadConfig();
  }

  loadConfig() {
    const packagePath = path.join(this.projectRoot, 'package.json');
    if (fs.existsSync(packagePath)) {
      return require(packagePath);
    }
    
    return {
      name: 'Proxly Browser Extension',
      version: '1.0.0',
      description: 'Route web links through Proxly for intelligent browser selection'
    };
  }

  async build() {
    console.log('🚀 Building Proxly browser extensions...');
    console.log(`Version: ${this.config.version || '1.0.0'}`);
    
    // Clean build directory
    await this.cleanBuildDir();
    
    // Build for each platform
    for (const platform of this.platforms) {
      await this.buildPlatform(platform);
    }
    
    // Create distribution packages
    await this.createDistributionPackages();
    
    console.log('✅ Build completed successfully!');
    console.log(`📦 Output directory: ${this.buildDir}`);
  }

  async cleanBuildDir() {
    console.log('🧹 Cleaning build directory...');
    await fs.remove(this.buildDir);
    await fs.ensureDir(this.buildDir);
  }

  async buildPlatform(platform) {
    console.log(`📱 Building ${platform} extension...`);
    
    const platformBuildDir = path.join(this.buildDir, platform);
    await fs.ensureDir(platformBuildDir);
    
    // Copy shared files
    await this.copySharedFiles(platformBuildDir);
    
    // Copy platform-specific files
    await this.copyPlatformFiles(platform, platformBuildDir);
    
    // Generate manifest
    await this.generateManifest(platform, platformBuildDir);
    
    // Copy localization files
    await this.copyLocalizationFiles(platformBuildDir);
    
    // Copy icons (create placeholder if missing)
    await this.copyIcons(platformBuildDir);
    
    console.log(`✅ ${platform} extension built successfully`);
  }

  async copySharedFiles(destDir) {
    const sharedDir = path.join(this.sourceDir, 'shared');
    const sharedDestDir = path.join(destDir, 'shared');
    
    if (await fs.pathExists(sharedDir)) {
      await fs.copy(sharedDir, sharedDestDir);
      console.log('  📁 Copied shared files');
    }
  }

  async copyPlatformFiles(platform, destDir) {
    const platformDir = path.join(this.sourceDir, platform);
    
    if (await fs.pathExists(platformDir)) {
      const items = await fs.readdir(platformDir);
      
      for (const item of items) {
        const itemPath = path.join(platformDir, item);
        const stat = await fs.stat(itemPath);
        
        if (stat.isDirectory() || (stat.isFile() && item !== 'manifest.json')) {
          await fs.copy(itemPath, path.join(destDir, item));
        }
      }
      console.log(`  📁 Copied ${platform}-specific files`);
    }
  }

  async generateManifest(platform, destDir) {
    const manifest = this.createManifestForPlatform(platform);
    
    await fs.writeJSON(
      path.join(destDir, 'manifest.json'),
      manifest,
      { spaces: 2 }
    );
    
    console.log(`  📄 Generated ${platform} manifest`);
  }

  createManifestForPlatform(platform) {
    const baseManifest = {
      name: this.config.name || 'Proxly Browser Extension',
      description: this.config.description || 'Route web links through Proxly for intelligent browser selection',
      version: this.config.version || '1.0.0',
      icons: {
        16: 'icons/icon-16.png',
        48: 'icons/icon-48.png',
        128: 'icons/icon-128.png',
        256: 'icons/icon-256.png'
      },
      default_locale: 'en',
      permissions: ['contextMenus', 'storage'],
      host_permissions: ['<all_urls>'],
      content_scripts: [{
        matches: ['<all_urls>'],
        js: [
          'shared/constants.js',
          'shared/localization.js', 
          'shared/accessibility.js',
          'shared/settings-manager.js',
          'content-script.js'
        ],
        run_at: 'document_start'
      }],
      options_ui: {
        page: 'options/options.html',
        open_in_tab: true
      }
    };
    
    switch (platform) {
      case 'chrome':
        return {
          ...baseManifest,
          manifest_version: 3,
          background: {
            service_worker: 'background.js'
          },
          content_security_policy: {
            extension_pages: "script-src 'self'; object-src 'self'; frame-ancestors 'none';"
          }
        };
        
      case 'firefox':
        return {
          ...baseManifest,
          manifest_version: 2,
          background: {
            scripts: [
              'shared/constants.js',
              'shared/localization.js',
              'shared/settings-manager.js',
              'background.js'
            ],
            persistent: false
          },
          permissions: [...baseManifest.permissions, '<all_urls>'],
          browser_specific_settings: {
            gecko: {
              id: 'proxly-extension@proxly.app',
              strict_min_version: '79.0'
            }
          },
          options_ui: {
            ...baseManifest.options_ui,
            chrome_style: false
          }
        };
        
      default:
        throw new Error(`Unsupported platform: ${platform}`);
    }
  }

  async copyLocalizationFiles(destDir) {
    const localesDir = path.join(this.sourceDir, '_locales');
    const localesDestDir = path.join(destDir, '_locales');
    
    if (await fs.pathExists(localesDir)) {
      await fs.copy(localesDir, localesDestDir);
      console.log('  🌍 Copied localization files');
    }
  }

  async copyIcons(destDir) {
    const iconsDir = path.join(this.sourceDir, 'icons');
    const iconsDestDir = path.join(destDir, 'icons');
    
    if (await fs.pathExists(iconsDir)) {
      await fs.copy(iconsDir, iconsDestDir);
      console.log('  🎨 Copied icon files');
    } else {
      // Create placeholder icons
      await this.createPlaceholderIcons(iconsDestDir);
      console.log('  🎨 Created placeholder icons');
    }
  }

  async createPlaceholderIcons(iconsDir) {
    await fs.ensureDir(iconsDir);
    
    const sizes = [16, 48, 128, 256];
    const placeholderContent = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
    
    for (const size of sizes) {
      const iconPath = path.join(iconsDir, `icon-${size}.png`);
      await fs.writeFile(iconPath, Buffer.from(placeholderContent.split(',')[1], 'base64'));
    }
  }

  async createDistributionPackages() {
    console.log('📦 Creating distribution packages...');
    
    const distDir = path.join(this.buildDir, 'dist');
    await fs.ensureDir(distDir);
    
    for (const platform of this.platforms) {
      await this.packagePlatform(platform, distDir);
    }
  }

  async packagePlatform(platform, distDir) {
    const platformBuildDir = path.join(this.buildDir, platform);
    const packageName = `proxly-extension-${platform}-v${this.config.version || '1.0.0'}.zip`;
    const packagePath = path.join(distDir, packageName);
    
    return new Promise((resolve, reject) => {
      const output = fs.createWriteStream(packagePath);
      const archive = archiver('zip', { zlib: { level: 9 } });
      
      output.on('close', () => {
        console.log(`  📦 ${packageName} created (${archive.pointer()} bytes)`);
        resolve();
      });
      
      archive.on('error', reject);
      archive.pipe(output);
      
      archive.directory(platformBuildDir, false);
      archive.finalize();
    });
  }

  async validateBuild() {
    console.log('✅ Validating build...');
    
    for (const platform of this.platforms) {
      const platformDir = path.join(this.buildDir, platform);
      const manifestPath = path.join(platformDir, 'manifest.json');
      
      if (!await fs.pathExists(manifestPath)) {
        throw new Error(`Missing manifest for ${platform}`);
      }
      
      const manifest = await fs.readJSON(manifestPath);
      if (!manifest.name || !manifest.version) {
        throw new Error(`Invalid manifest for ${platform}`);
      }
    }
    
    console.log('✅ Build validation passed');
  }
}

// CLI handling
async function main() {
  const args = process.argv.slice(2);
  const platform = args[0];
  
  const builder = new ExtensionBuilder();
  
  try {
    if (platform && builder.platforms.includes(platform)) {
      // Build specific platform
      await builder.cleanBuildDir();
      await builder.buildPlatform(platform);
      await builder.packagePlatform(platform, path.join(builder.buildDir, 'dist'));
      console.log(`✅ ${platform} extension built successfully`);
    } else {
      // Build all platforms
      await builder.build();
      await builder.validateBuild();
    }
  } catch (error) {
    console.error('❌ Build failed:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = ExtensionBuilder;