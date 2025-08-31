const puppeteer = require('puppeteer');
const { createLogger } = require('./utils.js');

class Crawler {
    constructor(targetConfig) {
        this.targetConfig = targetConfig;
        this.logger = createLogger();
        this.browser = null;
        this.page = null;
        this.visitedUrls = new Set();
        this.discoveredUrls = new Set();
    }

    async initialize() {
        this.logger.info('Launching browser...');
        this.browser = await puppeteer.launch({
            headless: true,
            executablePath: '/nix/store/qa9cnw4v5xkxyip6mb9kxqfq1z4x2dx1-chromium-138.0.7204.100/bin/chromium',
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote',
                '--disable-gpu',
                '--disable-web-security',
                '--disable-features=VizDisplayCompositor'
            ]
        });
        
        this.page = await this.browser.newPage();
        
        // Set viewport and user agent
        await this.page.setViewport({ width: 1920, height: 1080 });
        await this.page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
        
        // Enable request interception for monitoring
        await this.page.setRequestInterception(true);
        this.page.on('request', (request) => {
            request.continue();
        });
    }

    async authenticate(username, password) {
        this.logger.info('Authenticating...');
        
        try {
            await this.page.goto(this.targetConfig.baseUrl, { 
                waitUntil: 'networkidle2',
                timeout: 30000 
            });
            
            // Wait for page to load completely
            await this.page.waitForSelector('body', { timeout: 10000 });
            await new Promise(resolve => setTimeout(resolve, 3000));
            
            // Look for Element UI login form in header (loginBar class)
            const headerLoginExists = await this.page.$('.loginBar');
            
            if (headerLoginExists) {
                this.logger.info('Found header login form, attempting to authenticate...');
                await this.fillHeaderLoginForm(username, password);
            } else {
                this.logger.info('No header login found, checking for dedicated login page...');
                // Try to navigate to login page
                try {
                    await this.page.goto(this.targetConfig.baseUrl + '/login', { 
                        waitUntil: 'networkidle2',
                        timeout: 30000 
                    });
                    await this.fillLoginForm(username, password);
                } catch (loginPageError) {
                    this.logger.warn('No login page found either, continuing without authentication');
                }
            }
            
            this.logger.info('Authentication completed');
            
        } catch (error) {
            this.logger.warn('Authentication failed or not required:', error.message);
        }
    }

    async fillHeaderLoginForm(username, password) {
        try {
            // Wait for Element UI input fields in the header
            await this.page.waitForSelector('.loginBar .el-input__inner', { timeout: 10000 });
            
            // Get all input fields in the login bar
            const inputFields = await this.page.$$('.loginBar .el-input__inner');
            
            if (inputFields.length >= 2) {
                // First field is username (账号)
                const usernameField = inputFields[0];
                await usernameField.click();
                await usernameField.type(username);
                
                // Second field is password (密码)
                const passwordField = inputFields[1];
                await passwordField.click();
                await passwordField.type(password);
                
                // Wait a moment for form to update
                await new Promise(resolve => setTimeout(resolve, 1000));
                
                // Click login button (登录)
                const loginButton = await this.page.$('.loginBar .el-button--primary');
                if (loginButton) {
                    await loginButton.click();
                    
                    // Wait for potential navigation or page update
                    await new Promise(resolve => setTimeout(resolve, 3000));
                    
                    this.logger.info('Header login form submitted');
                } else {
                    this.logger.warn('Login button not found in header');
                }
            } else {
                this.logger.warn('Expected login input fields not found in header');
            }
        } catch (error) {
            this.logger.warn('Failed to fill header login form:', error.message);
        }
    }

    async fillLoginForm(username, password) {
        // Wait for login form
        await this.page.waitForSelector('input[type="password"]', { timeout: 10000 });
        
        // Find username/email field
        const usernameSelectors = [
            'input[type="text"][name*="user"]',
            'input[type="text"][name*="login"]',
            'input[type="email"]',
            'input[type="text"]:first-of-type'
        ];
        
        let usernameField = null;
        for (const selector of usernameSelectors) {
            usernameField = await this.page.$(selector);
            if (usernameField) break;
        }
        
        if (usernameField) {
            await usernameField.click();
            await usernameField.type(username);
        }
        
        // Fill password
        const passwordField = await this.page.$('input[type="password"]');
        if (passwordField) {
            await passwordField.click();
            await passwordField.type(password);
        }
        
        // Submit form
        const submitSelectors = [
            'button[type="submit"]',
            'input[type="submit"]',
            'button:contains("Login")',
            'button:contains("Sign in")'
        ];
        
        let submitButton = null;
        for (const selector of submitSelectors) {
            submitButton = await this.page.$(selector);
            if (submitButton) break;
        }
        
        if (submitButton) {
            await submitButton.click();
            await this.page.waitForNavigation({ waitUntil: 'networkidle2' });
        }
    }

    async discoverUrls() {
        this.logger.info('Starting URL discovery...');
        
        // Start with base URL
        this.discoveredUrls.add(this.targetConfig.baseUrl);
        
        // Discover URLs from main page
        await this.discoverUrlsFromPage(this.targetConfig.baseUrl);
        
        // Process discovered URLs to find more
        const urlsToProcess = Array.from(this.discoveredUrls);
        
        for (const url of urlsToProcess) {
            if (!this.visitedUrls.has(url)) {
                await this.discoverUrlsFromPage(url);
            }
        }
        
        const allUrls = Array.from(this.discoveredUrls);
        this.logger.info(`Discovered ${allUrls.length} unique URLs`);
        
        return allUrls;
    }

    async discoverUrlsFromPage(url) {
        if (this.visitedUrls.has(url)) {
            return;
        }
        
        try {
            this.logger.info(`Discovering URLs from: ${url}`);
            await this.page.goto(url, { 
                waitUntil: 'networkidle2',
                timeout: 30000 
            });
            
            this.visitedUrls.add(url);
            
            // Extract all links
            const links = await this.page.evaluate((baseUrl) => {
                const anchors = Array.from(document.querySelectorAll('a[href]'));
                const urls = anchors.map(a => {
                    try {
                        const href = a.getAttribute('href');
                        if (!href) return null;
                        
                        // Convert relative URLs to absolute
                        if (href.startsWith('/')) {
                            return new URL(href, baseUrl).href;
                        } else if (href.startsWith('http')) {
                            return href;
                        } else if (!href.startsWith('#') && !href.startsWith('mailto:') && !href.startsWith('tel:')) {
                            return new URL(href, window.location.href).href;
                        }
                        return null;
                    } catch (e) {
                        return null;
                    }
                }).filter(url => url !== null);
                
                return urls;
            }, this.targetConfig.baseUrl);
            
            // Filter URLs to same domain
            const baseHost = new URL(this.targetConfig.baseUrl).host;
            const sameOriginUrls = links.filter(link => {
                try {
                    const linkHost = new URL(link).host;
                    return linkHost === baseHost;
                } catch (e) {
                    return false;
                }
            });
            
            // Add to discovered URLs
            sameOriginUrls.forEach(url => {
                this.discoveredUrls.add(url);
            });
            
            this.logger.info(`Found ${sameOriginUrls.length} same-origin URLs on ${url}`);
            
        } catch (error) {
            this.logger.warn(`Failed to discover URLs from ${url}:`, error.message);
        }
    }

    async processPages(urls) {
        this.logger.info('Processing pages...');
        const pageData = [];
        
        for (let i = 0; i < urls.length; i++) {
            const url = urls[i];
            this.logger.info(`Processing page ${i + 1}/${urls.length}: ${url}`);
            
            try {
                await this.page.goto(url, { 
                    waitUntil: 'networkidle2',
                    timeout: 30000 
                });
                
                // Wait for dynamic content
                await this.page.waitForSelector('body', { timeout: 5000 }).catch(() => {});
                await new Promise(resolve => setTimeout(resolve, 2000));
                
                // Get page HTML
                const html = await this.page.content();
                
                // Get page resources
                const resources = await this.extractPageResources();
                
                pageData.push({
                    url: url,
                    html: html,
                    resources: resources,
                    title: await this.page.title()
                });
                
            } catch (error) {
                this.logger.warn(`Failed to process page ${url}:`, error.message);
            }
        }
        
        return pageData;
    }

    async extractPageResources() {
        return await this.page.evaluate(() => {
            const resources = {
                css: [],
                js: [],
                images: [],
                fonts: [],
                other: []
            };
            
            // CSS files
            document.querySelectorAll('link[rel="stylesheet"]').forEach(link => {
                if (link.href) resources.css.push(link.href);
            });
            
            // JavaScript files
            document.querySelectorAll('script[src]').forEach(script => {
                if (script.src) resources.js.push(script.src);
            });
            
            // Images
            document.querySelectorAll('img[src]').forEach(img => {
                if (img.src) resources.images.push(img.src);
            });
            
            // Background images from CSS
            const elements = document.querySelectorAll('*');
            elements.forEach(el => {
                const style = window.getComputedStyle(el);
                const bgImage = style.backgroundImage;
                if (bgImage && bgImage !== 'none') {
                    const match = bgImage.match(/url\(['"]?([^'"]+)['"]?\)/);
                    if (match) {
                        resources.images.push(match[1]);
                    }
                }
            });
            
            // Fonts (from CSS)
            Array.from(document.styleSheets).forEach(sheet => {
                try {
                    Array.from(sheet.cssRules || sheet.rules || []).forEach(rule => {
                        if (rule.style && rule.style.fontFamily) {
                            // This is a simplified approach - in reality we'd need to parse CSS more thoroughly
                        }
                    });
                } catch (e) {
                    // Cross-origin stylesheet access may be blocked
                }
            });
            
            return resources;
        });
    }

    async cleanup() {
        if (this.browser) {
            await this.browser.close();
            this.logger.info('Browser closed');
        }
    }
}

module.exports = Crawler;
