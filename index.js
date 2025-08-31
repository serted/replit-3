#!/usr/bin/env node

const fs = require('fs-extra');
const path = require('path');
const config = require('./config/config.js');
const Crawler = require('./src/crawler.js');
const AssetManager = require('./src/assetManager.js');
const PathRewriter = require('./src/pathRewriter.js');
const PHPGenerator = require('./src/phpGenerator.js');
const Validator = require('./src/validator.js');
const { createLogger } = require('./src/utils.js');

class WebsiteMirror {
    constructor() {
        this.logger = createLogger();
        this.crawler = new Crawler(config.target);
        this.assetManager = new AssetManager();
        this.pathRewriter = new PathRewriter();
        this.phpGenerator = new PHPGenerator();
        this.validator = new Validator();
        
        this.outputDir = path.join(__dirname, 'public_html');
        this.tempDir = path.join(__dirname, 'temp');
    }

    async initialize() {
        this.logger.info('Initializing website mirror...');
        
        // Create necessary directories
        await fs.ensureDir(this.outputDir);
        await fs.ensureDir(this.tempDir);
        await fs.ensureDir(path.join(this.outputDir, 'assets'));
        await fs.ensureDir(path.join(this.outputDir, 'css'));
        await fs.ensureDir(path.join(this.outputDir, 'js'));
        await fs.ensureDir(path.join(this.outputDir, 'images'));
        await fs.ensureDir(path.join(this.outputDir, 'fonts'));
        await fs.ensureDir(path.join(this.outputDir, 'auth'));
        
        this.logger.info('Directory structure created');
    }

    async run() {
        try {
            await this.initialize();
            
            // Step 1: Start crawler and authenticate
            this.logger.info('Starting browser and authentication...');
            await this.crawler.initialize();
            await this.crawler.authenticate(config.credentials.username, config.credentials.password);
            
            // Step 2: Discover all URLs
            this.logger.info('Discovering URLs...');
            const urls = await this.crawler.discoverUrls();
            this.logger.info(`Found ${urls.length} unique URLs to process`);
            
            // Step 3: Process each page
            this.logger.info('Processing pages...');
            const pageData = await this.crawler.processPages(urls);
            
            // Step 4: Download and organize assets
            this.logger.info('Downloading assets...');
            const assetMap = await this.assetManager.downloadAssets(pageData, this.outputDir);
            
            // Step 5: Rewrite paths in HTML files
            this.logger.info('Rewriting paths...');
            await this.pathRewriter.rewritePaths(pageData, assetMap, this.outputDir);
            
            // Step 6: Generate PHP authentication system
            this.logger.info('Generating PHP authentication system...');
            await this.phpGenerator.generateAuthSystem(this.outputDir);
            
            // Step 7: Save processed pages
            this.logger.info('Saving processed pages...');
            await this.savePages(pageData);
            
            // Step 8: Validate the mirror
            this.logger.info('Validating mirror...');
            const validationResults = await this.validator.validateMirror(this.outputDir);
            
            // Cleanup
            await this.crawler.cleanup();
            
            this.logger.info('Website mirror completed successfully!');
            this.printSummary(urls.length, validationResults);
            
        } catch (error) {
            this.logger.error('Error during mirroring process:', error);
            await this.crawler.cleanup();
            process.exit(1);
        }
    }

    async savePages(pageData) {
        for (const page of pageData) {
            let filePath;
            
            if (page.url === config.target.baseUrl || page.url === config.target.baseUrl + '/') {
                filePath = path.join(this.outputDir, 'index.html');
            } else {
                const urlPath = new URL(page.url).pathname;
                const cleanPath = urlPath.replace(/^\//, '').replace(/\/$/, '');
                
                if (cleanPath) {
                    const fileName = cleanPath.includes('.') ? cleanPath : `${cleanPath}.html`;
                    filePath = path.join(this.outputDir, fileName);
                } else {
                    filePath = path.join(this.outputDir, 'home.html');
                }
            }
            
            await fs.ensureDir(path.dirname(filePath));
            await fs.writeFile(filePath, page.html, 'utf8');
            this.logger.info(`Saved: ${filePath}`);
        }
    }

    printSummary(urlCount, validationResults) {
        console.log('\n' + '='.repeat(50));
        console.log('WEBSITE MIRROR SUMMARY');
        console.log('='.repeat(50));
        console.log(`📄 Pages processed: ${urlCount}`);
        console.log(`✅ Assets downloaded: ${validationResults.assetsFound}`);
        console.log(`🔧 Paths rewritten: ${validationResults.pathsRewritten}`);
        console.log(`🐘 PHP files generated: ${validationResults.phpFilesGenerated}`);
        console.log(`📁 Output directory: ${this.outputDir}`);
        console.log('\n✨ Your website mirror is ready for PHP hosting!');
        console.log('='.repeat(50));
    }
}

// Run the application
if (require.main === module) {
    const mirror = new WebsiteMirror();
    mirror.run().catch(console.error);
}

module.exports = WebsiteMirror;
