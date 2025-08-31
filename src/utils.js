const fs = require('fs-extra');
const path = require('path');

class Logger {
    constructor(logFile = null) {
        this.logFile = logFile;
        if (this.logFile) {
            fs.ensureFileSync(this.logFile);
        }
    }

    log(level, message, ...args) {
        const timestamp = new Date().toISOString();
        const logMessage = `[${timestamp}] ${level.toUpperCase()}: ${message}`;
        
        if (args.length > 0) {
            console[level](logMessage, ...args);
        } else {
            console[level](logMessage);
        }
        
        if (this.logFile) {
            const fileMessage = `${logMessage}${args.length > 0 ? ' ' + JSON.stringify(args) : ''}\n`;
            fs.appendFileSync(this.logFile, fileMessage);
        }
    }

    info(message, ...args) {
        this.log('info', message, ...args);
    }

    warn(message, ...args) {
        this.log('warn', message, ...args);
    }

    error(message, ...args) {
        this.log('error', message, ...args);
    }

    debug(message, ...args) {
        this.log('debug', message, ...args);
    }
}

function createLogger(logFile = null) {
    const defaultLogFile = logFile || path.join(process.cwd(), 'logs', 'scraping.log');
    return new Logger(defaultLogFile);
}

function sanitizeFilename(filename) {
    // Remove or replace invalid characters
    return filename
        .replace(/[<>:"/\\|?*]/g, '_')
        .replace(/\s+/g, '_')
        .toLowerCase();
}

function normalizeURL(url) {
    try {
        const urlObj = new URL(url);
        return urlObj.href;
    } catch (e) {
        return url;
    }
}

function isValidURL(string) {
    try {
        new URL(string);
        return true;
    } catch (_) {
        return false;
    }
}

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
    
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

function generateRandomString(length = 10) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

function parseContentType(contentType) {
    const parts = contentType.split(';')[0].trim().toLowerCase();
    
    const mimeToExt = {
        'text/html': '.html',
        'text/css': '.css',
        'application/javascript': '.js',
        'text/javascript': '.js',
        'image/jpeg': '.jpg',
        'image/png': '.png',
        'image/gif': '.gif',
        'image/svg+xml': '.svg',
        'image/webp': '.webp',
        'font/woff': '.woff',
        'font/woff2': '.woff2',
        'font/ttf': '.ttf',
        'font/otf': '.otf',
        'application/font-woff': '.woff',
        'application/font-woff2': '.woff2'
    };
    
    return mimeToExt[parts] || '.bin';
}

function extractDomainFromURL(url) {
    try {
        const urlObj = new URL(url);
        return urlObj.hostname;
    } catch (e) {
        return null;
    }
}

function createProgressBar(total, width = 40) {
    return {
        current: 0,
        total: total,
        update: function(current) {
            this.current = current;
            const percent = Math.round((current / total) * 100);
            const filled = Math.round((current / total) * width);
            const empty = width - filled;
            
            const bar = '█'.repeat(filled) + '░'.repeat(empty);
            process.stdout.write(`\r[${bar}] ${percent}% (${current}/${total})`);
            
            if (current >= total) {
                process.stdout.write('\n');
            }
        }
    };
}

module.exports = {
    Logger,
    createLogger,
    sanitizeFilename,
    normalizeURL,
    isValidURL,
    delay,
    formatBytes,
    generateRandomString,
    parseContentType,
    extractDomainFromURL,
    createProgressBar
};
