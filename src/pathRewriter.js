const fs = require('fs-extra');
const path = require('path');
const cheerio = require('cheerio');
const { createLogger } = require('./utils.js');

class PathRewriter {
    constructor() {
        this.logger = createLogger();
    }

    async rewritePaths(pageData, assetMap, outputDir) {
        this.logger.info('Rewriting paths in HTML files...');
        
        for (const page of pageData) {
            try {
                const rewrittenHTML = await this.rewriteHTMLPaths(page.html, assetMap);
                page.html = rewrittenHTML;
                this.logger.info(`Paths rewritten for: ${page.url}`);
            } catch (error) {
                this.logger.warn(`Failed to rewrite paths for ${page.url}:`, error.message);
            }
        }
    }

    async rewriteHTMLPaths(html, assetMap) {
        const $ = cheerio.load(html, {
            decodeEntities: false,
            lowerCaseAttributeNames: false
        });

        // Rewrite CSS links
        $('link[rel="stylesheet"]').each((i, elem) => {
            const href = $(elem).attr('href');
            if (href && assetMap.has(href)) {
                $(elem).attr('href', assetMap.get(href));
            }
        });

        // Rewrite JavaScript sources
        $('script[src]').each((i, elem) => {
            const src = $(elem).attr('src');
            if (src && assetMap.has(src)) {
                $(elem).attr('src', assetMap.get(src));
            }
        });

        // Rewrite image sources
        $('img[src]').each((i, elem) => {
            const src = $(elem).attr('src');
            if (src && assetMap.has(src)) {
                $(elem).attr('src', assetMap.get(src));
            }
        });

        // Rewrite background images in style attributes
        $('[style*="background"]').each((i, elem) => {
            let style = $(elem).attr('style');
            if (style) {
                style = this.rewriteBackgroundImages(style, assetMap);
                $(elem).attr('style', style);
            }
        });

        // Rewrite form actions to use PHP scripts
        this.rewriteFormActions($);

        // Add authentication check script
        this.addAuthenticationCheck($);

        return $.html();
    }

    rewriteBackgroundImages(style, assetMap) {
        const urlRegex = /background-image:\s*url\(['"]?([^'"]+)['"]?\)/gi;
        
        return style.replace(urlRegex, (match, url) => {
            if (assetMap.has(url)) {
                return match.replace(url, assetMap.get(url));
            }
            return match;
        });
    }

    rewriteFormActions($) {
        // Rewrite login forms
        $('form').each((i, elem) => {
            const action = $(elem).attr('action');
            const method = $(elem).attr('method') || 'GET';
            
            // Check if this is a login form
            const hasPasswordField = $(elem).find('input[type="password"]').length > 0;
            const hasUsernameField = $(elem).find('input[name*="user"], input[name*="login"], input[type="email"]').length > 0;
            
            if (hasPasswordField && hasUsernameField) {
                $(elem).attr('action', 'auth/process_login.php');
                $(elem).attr('method', 'POST');
                
                // Add CSRF token field
                $(elem).append('<input type="hidden" name="csrf_token" value="<?php echo $_SESSION[\'csrf_token\'] ?? \'\'; ?>">');
            }
            
            // Check if this is a registration form
            const hasConfirmPassword = $(elem).find('input[name*="confirm"], input[name*="repeat"]').length > 0;
            if (hasPasswordField && hasConfirmPassword) {
                $(elem).attr('action', 'auth/process_register.php');
                $(elem).attr('method', 'POST');
            }
        });
    }

    addAuthenticationCheck($) {
        // Add authentication status check
        const authScript = `
        <script>
        // Check authentication status on page load
        document.addEventListener('DOMContentLoaded', function() {
            fetch('auth/session.php')
                .then(response => response.json())
                .then(data => {
                    if (data.authenticated) {
                        // User is authenticated, show protected content
                        document.body.classList.add('authenticated');
                        
                        // Update UI elements
                        const loginLinks = document.querySelectorAll('a[href*="login"]');
                        loginLinks.forEach(link => {
                            link.textContent = 'Logout';
                            link.href = 'auth/logout.php';
                        });
                        
                        // Show username if available
                        if (data.username) {
                            const userElements = document.querySelectorAll('.username, .user-name');
                            userElements.forEach(el => {
                                el.textContent = data.username;
                            });
                        }
                    } else {
                        // User is not authenticated
                        document.body.classList.add('not-authenticated');
                        
                        // Hide protected content
                        const protectedElements = document.querySelectorAll('.protected, .auth-required');
                        protectedElements.forEach(el => {
                            el.style.display = 'none';
                        });
                    }
                })
                .catch(error => {
                    console.warn('Authentication check failed:', error);
                });
        });
        </script>
        `;
        
        $('head').append(authScript);
        
        // Add CSS for authentication states
        const authCSS = `
        <style>
        .not-authenticated .protected,
        .not-authenticated .auth-required {
            display: none !important;
        }
        
        .authenticated .login-only {
            display: none !important;
        }
        
        .auth-message {
            padding: 10px;
            margin: 10px 0;
            border-radius: 4px;
            background-color: #f0f0f0;
            border: 1px solid #ccc;
        }
        
        .auth-message.error {
            background-color: #ffe6e6;
            border-color: #ff9999;
            color: #cc0000;
        }
        
        .auth-message.success {
            background-color: #e6ffe6;
            border-color: #99ff99;
            color: #006600;
        }
        </style>
        `;
        
        $('head').append(authCSS);
    }
}

module.exports = PathRewriter;
