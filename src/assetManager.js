const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');
const { URL } = require('url');
const { createLogger } = require('./utils.js');

class AssetManager {
    constructor() {
        this.logger = createLogger();
        this.downloadedAssets = new Map();
        this.assetMap = new Map(); // Maps original URLs to local paths
    }

    async downloadAssets(pageData, outputDir) {
        this.logger.info('Starting asset download...');
        
        // Collect all unique assets
        const allAssets = this.collectAllAssets(pageData);
        
        // Download each asset type
        await this.downloadAssetsByType(allAssets.css, outputDir, 'css');
        await this.downloadAssetsByType(allAssets.js, outputDir, 'js');
        await this.downloadAssetsByType(allAssets.images, outputDir, 'images');
        await this.downloadAssetsByType(allAssets.fonts, outputDir, 'fonts');
        await this.downloadAssetsByType(allAssets.other, outputDir, 'assets');
        
        this.logger.info(`Downloaded ${this.downloadedAssets.size} unique assets`);
        return this.assetMap;
    }

    collectAllAssets(pageData) {
        const assets = {
            css: new Set(),
            js: new Set(),
            images: new Set(),
            fonts: new Set(),
            other: new Set()
        };

        pageData.forEach(page => {
            if (page.resources) {
                page.resources.css.forEach(url => assets.css.add(url));
                page.resources.js.forEach(url => assets.js.add(url));
                page.resources.images.forEach(url => assets.images.add(url));
                page.resources.fonts.forEach(url => assets.fonts.add(url));
                page.resources.other.forEach(url => assets.other.add(url));
            }
        });

        // Also extract assets from HTML content
        pageData.forEach(page => {
            this.extractAssetsFromHTML(page.html, assets);
        });

        return {
            css: Array.from(assets.css),
            js: Array.from(assets.js),
            images: Array.from(assets.images),
            fonts: Array.from(assets.fonts),
            other: Array.from(assets.other)
        };
    }

    extractAssetsFromHTML(html, assets) {
        // CSS links
        const cssMatches = html.match(/<link[^>]+href=["']([^"']+\.css[^"']*?)["'][^>]*>/gi) || [];
        cssMatches.forEach(match => {
            const hrefMatch = match.match(/href=["']([^"']+)["']/);
            if (hrefMatch) assets.css.add(hrefMatch[1]);
        });

        // JavaScript files
        const jsMatches = html.match(/<script[^>]+src=["']([^"']+\.js[^"']*?)["'][^>]*>/gi) || [];
        jsMatches.forEach(match => {
            const srcMatch = match.match(/src=["']([^"']+)["']/);
            if (srcMatch) assets.js.add(srcMatch[1]);
        });

        // Images
        const imgMatches = html.match(/<img[^>]+src=["']([^"']+)["'][^>]*>/gi) || [];
        imgMatches.forEach(match => {
            const srcMatch = match.match(/src=["']([^"']+)["']/);
            if (srcMatch) assets.images.add(srcMatch[1]);
        });

        // Background images from inline styles
        const bgMatches = html.match(/background-image:\s*url\(['"]?([^'"]+)['"]?\)/gi) || [];
        bgMatches.forEach(match => {
            const urlMatch = match.match(/url\(['"]?([^'"]+)['"]?\)/);
            if (urlMatch) assets.images.add(urlMatch[1]);
        });

        // Font files
        const fontMatches = html.match(/url\(['"]?([^'"]+\.(woff2?|ttf|otf|eot))['"]?\)/gi) || [];
        fontMatches.forEach(match => {
            const urlMatch = match.match(/url\(['"]?([^'"]+)['"]?\)/);
            if (urlMatch) assets.fonts.add(urlMatch[1]);
        });
    }

    async downloadAssetsByType(urls, outputDir, assetType) {
        const typeDir = path.join(outputDir, assetType);
        await fs.ensureDir(typeDir);

        for (const url of urls) {
            await this.downloadSingleAsset(url, typeDir, assetType);
        }
    }

    async downloadSingleAsset(assetUrl, typeDir, assetType) {
        if (this.downloadedAssets.has(assetUrl)) {
            return this.downloadedAssets.get(assetUrl);
        }

        try {
            // Handle relative URLs
            let fullUrl = assetUrl;
            if (assetUrl.startsWith('//')) {
                fullUrl = 'https:' + assetUrl;
            } else if (assetUrl.startsWith('/')) {
                // Need base URL - this should be passed in or configured
                fullUrl = 'https://pc.dfbiu.com' + assetUrl;
            }

            // Generate local filename
            const urlObj = new URL(fullUrl);
            let filename = path.basename(urlObj.pathname);
            
            // Handle URLs without file extensions
            if (!filename || !filename.includes('.')) {
                const ext = this.getFileExtension(assetType, fullUrl);
                filename = `asset_${Date.now()}_${Math.random().toString(36).substr(2, 9)}${ext}`;
            }

            // Ensure unique filename
            filename = this.ensureUniqueFilename(typeDir, filename);
            
            const localPath = path.join(typeDir, filename);
            const relativePath = path.join(assetType, filename);

            // Download the asset
            this.logger.info(`Downloading: ${fullUrl}`);
            
            const response = await axios({
                method: 'GET',
                url: fullUrl,
                responseType: 'stream',
                timeout: 30000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            });

            // Save to file
            const writer = fs.createWriteStream(localPath);
            response.data.pipe(writer);

            await new Promise((resolve, reject) => {
                writer.on('finish', resolve);
                writer.on('error', reject);
            });

            // Update maps
            this.downloadedAssets.set(assetUrl, relativePath);
            this.assetMap.set(assetUrl, relativePath);

            // Handle CSS files - download their dependencies
            if (assetType === 'css') {
                await this.processCSSFile(localPath, path.dirname(localPath));
            }

            this.logger.info(`Downloaded: ${filename}`);
            return relativePath;

        } catch (error) {
            this.logger.warn(`Failed to download ${assetUrl}:`, error.message);
            return null;
        }
    }

    async processCSSFile(cssPath, cssDir) {
        try {
            const cssContent = await fs.readFile(cssPath, 'utf8');
            let modifiedCSS = cssContent;

            // Find all url() references in CSS
            const urlMatches = cssContent.match(/url\(['"]?([^'"]+)['"]?\)/gi) || [];
            
            for (const match of urlMatches) {
                const urlMatch = match.match(/url\(['"]?([^'"]+)['"]?\)/);
                if (urlMatch) {
                    const assetUrl = urlMatch[1];
                    
                    // Determine asset type
                    let assetType = 'assets';
                    if (assetUrl.match(/\.(woff2?|ttf|otf|eot)$/i)) {
                        assetType = 'fonts';
                    } else if (assetUrl.match(/\.(png|jpe?g|gif|svg|webp)$/i)) {
                        assetType = 'images';
                    }

                    // Download the asset
                    const typeDir = path.join(path.dirname(cssDir), assetType);
                    await fs.ensureDir(typeDir);
                    
                    const localPath = await this.downloadSingleAsset(assetUrl, typeDir, assetType);
                    if (localPath) {
                        // Replace URL in CSS with relative path
                        const relativePath = path.relative(path.dirname(cssPath), path.join(path.dirname(cssDir), localPath));
                        modifiedCSS = modifiedCSS.replace(match, `url('${relativePath.replace(/\\/g, '/')}')`);
                    }
                }
            }

            // Save modified CSS
            if (modifiedCSS !== cssContent) {
                await fs.writeFile(cssPath, modifiedCSS, 'utf8');
            }

        } catch (error) {
            this.logger.warn(`Failed to process CSS file ${cssPath}:`, error.message);
        }
    }

    getFileExtension(assetType, url) {
        const extensions = {
            css: '.css',
            js: '.js',
            images: '.png',
            fonts: '.woff2',
            assets: '.bin'
        };
        
        return extensions[assetType] || '.bin';
    }

    ensureUniqueFilename(dir, filename) {
        let counter = 1;
        let uniqueFilename = filename;
        
        while (fs.existsSync(path.join(dir, uniqueFilename))) {
            const ext = path.extname(filename);
            const name = path.basename(filename, ext);
            uniqueFilename = `${name}_${counter}${ext}`;
            counter++;
        }
        
        return uniqueFilename;
    }
}

module.exports = AssetManager;
