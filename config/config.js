module.exports = {
    target: {
        baseUrl: 'https://pc.dfbiu.com',
        maxPages: 100,
        maxDepth: 3,
        timeout: 30000,
        retries: 3
    },
    
    credentials: {
        username: 'test228',
        password: 'test228'
    },
    
    crawler: {
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        viewport: {
            width: 1920,
            height: 1080
        },
        waitForNetworkIdle: 2000,
        screenshotOnError: true
    },
    
    assets: {
        maxFileSize: 50 * 1024 * 1024, // 50MB
        allowedExtensions: [
            '.css', '.js', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp',
            '.woff', '.woff2', '.ttf', '.otf', '.eot',
            '.ico', '.json', '.xml', '.txt'
        ],
        downloadTimeout: 30000,
        concurrentDownloads: 5
    },
    
    output: {
        directory: 'public_html',
        preserveStructure: true,
        minifyHTML: false,
        minifyCSS: false,
        minifyJS: false
    },
    
    validation: {
        checkBrokenLinks: true,
        validateAssets: true,
        reportMissingFiles: true
    },
    
    logging: {
        level: 'info',
        file: 'logs/scraping.log',
        maxFileSize: 10 * 1024 * 1024, // 10MB
        maxFiles: 5
    }
};
