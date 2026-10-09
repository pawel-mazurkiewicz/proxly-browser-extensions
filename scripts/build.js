#!/usr/bin/env node

/**
 * Cross-platform build script for Proxly browser extensions
 * Generates platform-specific packages for Chrome, Firefox, and Safari
 */

const fs = require('fs-extra');
const path = require('path');
const archiver = require('archiver');

class ExtensionBuilder {
  constructor({ buildDir, sourceDir } = {}) {
    this.projectRoot = path.resolve(__dirname, '..');
    this.buildDir = buildDir || path.join(this.projectRoot, 'build');
    this.sourceDir = sourceDir || this.projectRoot;
    
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
    
    // Check that every icon the manifest names was copied
    await this.verifyIcons(platform, platformBuildDir);
    
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
    // The platform folder's manifest.json is the source of truth. A template here once drifted
    // from it and produced packages without the shared scripts and permissions they need.
    const manifest = await fs.readJSON(path.join(this.sourceDir, platform, 'manifest.json'));

    await fs.writeJSON(
      path.join(destDir, 'manifest.json'),
      manifest,
      { spaces: 2 }
    );

    console.log(`  📄 Copied ${platform} manifest (version ${manifest.version})`);
  }

  async copyLocalizationFiles(destDir) {
    const localesDir = path.join(this.sourceDir, '_locales');
    const localesDestDir = path.join(destDir, '_locales');
    
    if (await fs.pathExists(localesDir)) {
      await fs.copy(localesDir, localesDestDir);
      console.log('  🌍 Copied localization files');
    }
  }

  async verifyIcons(platform, destDir) {
    // The platform folder supplies the icons. This step once wrote 1×1 placeholders over them,
    // and the packages shipped blank icons, so a missing icon now fails the build instead.
    const manifest = await fs.readJSON(path.join(destDir, 'manifest.json'));
    const action = manifest.action || manifest.browser_action || {};
    const iconPaths = new Set(
      [manifest.icons, action.default_icon]
        .filter(Boolean)
        .flatMap((icons) => (typeof icons === 'string' ? [icons] : Object.values(icons)))
    );

    for (const iconPath of iconPaths) {
      if (!(await fs.pathExists(path.join(destDir, iconPath)))) {
        throw new Error(`Missing icon for ${platform}: ${iconPath}`);
      }
    }
    console.log(`  🎨 Checked ${iconPaths.size} icons`);
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
    const { version } = await fs.readJSON(path.join(platformBuildDir, 'manifest.json'));
    const packageName = `proxly-extension-${platform}-v${version}.zip`;
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