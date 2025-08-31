# Website Mirror Tool

## Overview

This is a Node.js-based website mirroring tool that crawls protected websites, downloads all assets, and generates a complete static mirror with PHP authentication system. The tool uses Puppeteer for web crawling, handles authentication, downloads all website resources (CSS, JS, images, fonts), rewrites paths for local hosting, and creates a PHP-based authentication system for protecting the mirrored content.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Core Components

**Main Controller (`index.js`)**: Orchestrates the entire mirroring process through a `WebsiteMirror` class that coordinates all subsystems. Creates necessary directory structure and manages the workflow from crawling to validation.

**Web Crawler (`src/crawler.js`)**: Uses Puppeteer to automate browser interactions, handle authentication, and discover website content. Implements headless Chrome automation with request interception for monitoring network activity.

**Asset Management (`src/assetManager.js`)**: Downloads and organizes all website resources including CSS, JavaScript, images, and fonts. Maintains mapping between original URLs and local file paths for proper linking.

**Path Rewriting (`src/pathRewriter.js`)**: Uses Cheerio to parse HTML and rewrite all asset references to point to locally downloaded files. Ensures the mirrored site functions independently of the original.

**PHP Generation (`src/phpGenerator.js`)**: Creates a complete PHP authentication system with login/logout functionality, session management, and access control to protect the mirrored content.

**Validation System (`src/validator.js`)**: Verifies the integrity of the mirrored site by checking for missing files, broken links, and proper directory structure.

**Logging Utilities (`src/utils.js`)**: Provides structured logging with file output and filename sanitization utilities.

### Directory Structure

The tool creates a structured output in `public_html/`:
- `/assets/` - General downloadable resources
- `/css/` - Stylesheets
- `/js/` - JavaScript files  
- `/images/` - Image assets
- `/fonts/` - Font files
- `/auth/` - PHP authentication system

### Configuration Management

Centralized configuration in `config/config.js` defines:
- Target website settings (URL, crawling limits, timeouts)
- Authentication credentials
- Browser automation parameters
- Asset handling rules (file size limits, allowed extensions)
- Output formatting preferences
- Validation settings

### Authentication Strategy

The tool handles two types of authentication:
1. **Source Authentication**: Automated login to the original website using Puppeteer
2. **Mirror Protection**: Generated PHP authentication system to protect the mirrored content

### Error Handling & Resilience

Implements retry mechanisms, timeout handling, and comprehensive error logging. The validator ensures mirror completeness and reports any issues found during the process.

## External Dependencies

**Puppeteer**: Browser automation for crawling protected websites and handling JavaScript-rendered content

**Axios**: HTTP client for downloading assets and making web requests

**Cheerio**: Server-side jQuery implementation for HTML parsing and DOM manipulation

**fs-extra**: Enhanced file system operations with promise support and additional utilities

**Node.js Built-ins**: Path manipulation, URL parsing, and file system operations

**PHP Runtime**: Required for the generated authentication system (not included, must be available on target hosting environment)

**Web Server**: Apache/Nginx with PHP support needed to run the mirrored site with authentication