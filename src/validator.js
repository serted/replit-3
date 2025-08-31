const fs = require('fs-extra');
const path = require('path');
const { createLogger } = require('./utils.js');

class Validator {
    constructor() {
        this.logger = createLogger();
    }

    async validateMirror(outputDir) {
        this.logger.info('Validating website mirror...');
        
        const results = {
            pagesFound: 0,
            assetsFound: 0,
            pathsRewritten: 0,
            phpFilesGenerated: 0,
            errors: [],
            warnings: []
        };

        try {
            // Validate HTML pages
            await this.validateHTMLPages(outputDir, results);
            
            // Validate assets
            await this.validateAssets(outputDir, results);
            
            // Validate PHP files
            await this.validatePHPFiles(outputDir, results);
            
            // Validate directory structure
            await this.validateDirectoryStructure(outputDir, results);
            
            // Check for broken links
            await this.checkBrokenLinks(outputDir, results);
            
        } catch (error) {
            this.logger.error('Validation error:', error);
            results.errors.push(error.message);
        }

        this.logValidationResults(results);
        return results;
    }

    async validateHTMLPages(outputDir, results) {
        const htmlFiles = await this.findFiles(outputDir, '.html');
        results.pagesFound = htmlFiles.length;
        
        for (const htmlFile of htmlFiles) {
            try {
                const content = await fs.readFile(htmlFile, 'utf8');
                
                // Check for relative paths
                const relativePaths = content.match(/(?:href|src)=["'][^"']*\/[^"']*["']/g) || [];
                results.pathsRewritten += relativePaths.length;
                
                // Check for authentication scripts
                if (content.includes('auth/session.php')) {
                    this.logger.info(`Authentication check found in: ${htmlFile}`);
                }
                
                // Check for missing assets
                const assetRefs = this.extractAssetReferences(content);
                for (const assetRef of assetRefs) {
                    const assetPath = path.join(outputDir, assetRef);
                    if (!await fs.pathExists(assetPath)) {
                        results.warnings.push(`Missing asset: ${assetRef} in ${htmlFile}`);
                    }
                }
                
            } catch (error) {
                results.errors.push(`Failed to validate ${htmlFile}: ${error.message}`);
            }
        }
    }

    async validateAssets(outputDir, results) {
        const assetDirs = ['css', 'js', 'images', 'fonts', 'assets'];
        
        for (const assetDir of assetDirs) {
            const dirPath = path.join(outputDir, assetDir);
            if (await fs.pathExists(dirPath)) {
                const files = await this.getAllFiles(dirPath);
                results.assetsFound += files.length;
                
                for (const file of files) {
                    // Validate file size
                    const stats = await fs.stat(file);
                    if (stats.size === 0) {
                        results.warnings.push(`Empty asset file: ${file}`);
                    }
                }
            }
        }
    }

    async validatePHPFiles(outputDir, results) {
        const authDir = path.join(outputDir, 'auth');
        const requiredPHPFiles = [
            'config.php',
            'session.php',
            'process_login.php',
            'process_register.php',
            'login.php',
            'register.php',
            'logout.php'
        ];

        for (const phpFile of requiredPHPFiles) {
            const filePath = path.join(authDir, phpFile);
            if (await fs.pathExists(filePath)) {
                results.phpFilesGenerated++;
                
                // Basic PHP syntax validation
                const content = await fs.readFile(filePath, 'utf8');
                if (!content.startsWith('<?php')) {
                    results.warnings.push(`PHP file ${phpFile} doesn't start with <?php tag`);
                }
            } else {
                results.errors.push(`Missing required PHP file: ${phpFile}`);
            }
        }

        // Check .htaccess file
        const htaccessPath = path.join(outputDir, '.htaccess');
        if (await fs.pathExists(htaccessPath)) {
            results.phpFilesGenerated++;
        } else {
            results.warnings.push('Missing .htaccess file');
        }
    }

    async validateDirectoryStructure(outputDir, results) {
        const requiredDirs = ['auth', 'css', 'js', 'images', 'fonts'];
        
        for (const dir of requiredDirs) {
            const dirPath = path.join(outputDir, dir);
            if (!await fs.pathExists(dirPath)) {
                results.warnings.push(`Missing directory: ${dir}`);
            }
        }

        // Check for index file
        const indexFiles = ['index.html', 'index.php'];
        let hasIndex = false;
        
        for (const indexFile of indexFiles) {
            if (await fs.pathExists(path.join(outputDir, indexFile))) {
                hasIndex = true;
                break;
            }
        }
        
        if (!hasIndex) {
            results.errors.push('No index file found (index.html or index.php)');
        }
    }

    async checkBrokenLinks(outputDir, results) {
        const htmlFiles = await this.findFiles(outputDir, '.html');
        
        for (const htmlFile of htmlFiles) {
            try {
                const content = await fs.readFile(htmlFile, 'utf8');
                const links = this.extractLinks(content);
                
                for (const link of links) {
                    if (this.isLocalLink(link)) {
                        const linkPath = path.join(outputDir, link);
                        if (!await fs.pathExists(linkPath)) {
                            results.warnings.push(`Broken link: ${link} in ${htmlFile}`);
                        }
                    }
                }
                
            } catch (error) {
                results.errors.push(`Failed to check links in ${htmlFile}: ${error.message}`);
            }
        }
    }

    extractAssetReferences(html) {
        const refs = [];
        
        // CSS files
        const cssMatches = html.match(/href=["']([^"']+\.css[^"']*?)["']/gi) || [];
        cssMatches.forEach(match => {
            const href = match.match(/href=["']([^"']+)["']/)[1];
            if (!href.startsWith('http') && !href.startsWith('//')) {
                refs.push(href);
            }
        });
        
        // JavaScript files
        const jsMatches = html.match(/src=["']([^"']+\.js[^"']*?)["']/gi) || [];
        jsMatches.forEach(match => {
            const src = match.match(/src=["']([^"']+)["']/)[1];
            if (!src.startsWith('http') && !src.startsWith('//')) {
                refs.push(src);
            }
        });
        
        // Images
        const imgMatches = html.match(/src=["']([^"']+\.(png|jpe?g|gif|svg|webp)[^"']*?)["']/gi) || [];
        imgMatches.forEach(match => {
            const src = match.match(/src=["']([^"']+)["']/)[1];
            if (!src.startsWith('http') && !src.startsWith('//')) {
                refs.push(src);
            }
        });
        
        return refs;
    }

    extractLinks(html) {
        const links = [];
        const linkMatches = html.match(/href=["']([^"']+)["']/gi) || [];
        
        linkMatches.forEach(match => {
            const href = match.match(/href=["']([^"']+)["']/)[1];
            if (href && !href.startsWith('#') && !href.startsWith('mailto:') && !href.startsWith('tel:')) {
                links.push(href);
            }
        });
        
        return links;
    }

    isLocalLink(link) {
        return !link.startsWith('http://') && 
               !link.startsWith('https://') && 
               !link.startsWith('//');
    }

    async findFiles(dir, extension) {
        const files = [];
        const items = await fs.readdir(dir);
        
        for (const item of items) {
            const fullPath = path.join(dir, item);
            const stat = await fs.stat(fullPath);
            
            if (stat.isDirectory()) {
                const subFiles = await this.findFiles(fullPath, extension);
                files.push(...subFiles);
            } else if (path.extname(item) === extension) {
                files.push(fullPath);
            }
        }
        
        return files;
    }

    async getAllFiles(dir) {
        const files = [];
        const items = await fs.readdir(dir);
        
        for (const item of items) {
            const fullPath = path.join(dir, item);
            const stat = await fs.stat(fullPath);
            
            if (stat.isDirectory()) {
                const subFiles = await this.getAllFiles(fullPath);
                files.push(...subFiles);
            } else {
                files.push(fullPath);
            }
        }
        
        return files;
    }

    logValidationResults(results) {
        this.logger.info('Validation Results:');
        this.logger.info(`- Pages found: ${results.pagesFound}`);
        this.logger.info(`- Assets found: ${results.assetsFound}`);
        this.logger.info(`- Paths rewritten: ${results.pathsRewritten}`);
        this.logger.info(`- PHP files generated: ${results.phpFilesGenerated}`);
        
        if (results.warnings.length > 0) {
            this.logger.warn(`Warnings (${results.warnings.length}):`);
            results.warnings.forEach(warning => this.logger.warn(`  - ${warning}`));
        }
        
        if (results.errors.length > 0) {
            this.logger.error(`Errors (${results.errors.length}):`);
            results.errors.forEach(error => this.logger.error(`  - ${error}`));
        }
    }
}

module.exports = Validator;
