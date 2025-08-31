const fs = require('fs-extra');
const path = require('path');
const { createLogger } = require('./utils.js');

class PHPGenerator {
    constructor() {
        this.logger = createLogger();
    }

    async generateAuthSystem(outputDir) {
        this.logger.info('Generating PHP authentication system...');
        
        const authDir = path.join(outputDir, 'auth');
        await fs.ensureDir(authDir);
        
        // Generate all PHP files
        await this.generateConfigFile(authDir);
        await this.generateSessionHandler(authDir);
        await this.generateLoginProcessor(authDir);
        await this.generateRegisterProcessor(authDir);
        await this.generateLoginPage(authDir);
        await this.generateRegisterPage(authDir);
        await this.generateLogoutHandler(authDir);
        await this.generateHTAccessFile(outputDir);
        
        this.logger.info('PHP authentication system generated');
    }

    async generateConfigFile(authDir) {
        const config = `<?php
// Database configuration
define('DB_HOST', 'localhost');
define('DB_NAME', 'website_mirror');
define('DB_USER', 'root');
define('DB_PASS', '');

// Application configuration
define('SITE_URL', 'http://localhost');
define('SESSION_LIFETIME', 3600); // 1 hour
define('CSRF_TOKEN_LIFETIME', 1800); // 30 minutes

// Security settings
define('PASSWORD_MIN_LENGTH', 6);
define('MAX_LOGIN_ATTEMPTS', 5);
define('LOGIN_LOCKOUT_TIME', 300); // 5 minutes

// Default credentials (for testing)
define('DEFAULT_USERNAME', 'test228');
define('DEFAULT_PASSWORD', 'test228');

// Initialize database connection
function getDBConnection() {
    static $pdo = null;
    
    if ($pdo === null) {
        try {
            $dsn = "mysql:host=" . DB_HOST . ";dbname=" . DB_NAME . ";charset=utf8mb4";
            $options = [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES => false,
            ];
            
            $pdo = new PDO($dsn, DB_USER, DB_PASS, $options);
            
            // Create users table if it doesn't exist
            $pdo->exec("
                CREATE TABLE IF NOT EXISTS users (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    username VARCHAR(50) UNIQUE NOT NULL,
                    email VARCHAR(100) UNIQUE NOT NULL,
                    password VARCHAR(255) NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    last_login TIMESTAMP NULL,
                    is_active BOOLEAN DEFAULT TRUE
                )
            ");
            
            // Create login attempts table
            $pdo->exec("
                CREATE TABLE IF NOT EXISTS login_attempts (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    ip_address VARCHAR(45) NOT NULL,
                    username VARCHAR(50),
                    attempted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    success BOOLEAN DEFAULT FALSE
                )
            ");
            
            // Insert default user if not exists
            $stmt = $pdo->prepare("SELECT COUNT(*) FROM users WHERE username = ?");
            $stmt->execute([DEFAULT_USERNAME]);
            
            if ($stmt->fetchColumn() == 0) {
                $hashedPassword = password_hash(DEFAULT_PASSWORD, PASSWORD_DEFAULT);
                $stmt = $pdo->prepare("INSERT INTO users (username, email, password) VALUES (?, ?, ?)");
                $stmt->execute([DEFAULT_USERNAME, DEFAULT_USERNAME . '@example.com', $hashedPassword]);
            }
            
        } catch (PDOException $e) {
            // Fallback to file-based authentication if database is not available
            error_log("Database connection failed: " . $e->getMessage());
            return null;
        }
    }
    
    return $pdo;
}

// File-based authentication fallback
function authenticateWithFile($username, $password) {
    return ($username === DEFAULT_USERNAME && $password === DEFAULT_PASSWORD);
}

// Generate CSRF token
function generateCSRFToken() {
    if (!isset($_SESSION['csrf_token']) || 
        !isset($_SESSION['csrf_token_time']) || 
        (time() - $_SESSION['csrf_token_time']) > CSRF_TOKEN_LIFETIME) {
        
        $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
        $_SESSION['csrf_token_time'] = time();
    }
    
    return $_SESSION['csrf_token'];
}

// Verify CSRF token
function verifyCSRFToken($token) {
    return isset($_SESSION['csrf_token']) && 
           hash_equals($_SESSION['csrf_token'], $token) &&
           isset($_SESSION['csrf_token_time']) &&
           (time() - $_SESSION['csrf_token_time']) <= CSRF_TOKEN_LIFETIME;
}

// Check login attempts
function checkLoginAttempts($ip, $username = null) {
    $pdo = getDBConnection();
    if (!$pdo) return true; // Allow if database is not available
    
    $stmt = $pdo->prepare("
        SELECT COUNT(*) FROM login_attempts 
        WHERE ip_address = ? AND attempted_at > DATE_SUB(NOW(), INTERVAL ? SECOND) AND success = FALSE
    ");
    $stmt->execute([$ip, LOGIN_LOCKOUT_TIME]);
    
    return $stmt->fetchColumn() < MAX_LOGIN_ATTEMPTS;
}

// Log login attempt
function logLoginAttempt($ip, $username, $success) {
    $pdo = getDBConnection();
    if (!$pdo) return;
    
    $stmt = $pdo->prepare("INSERT INTO login_attempts (ip_address, username, success) VALUES (?, ?, ?)");
    $stmt->execute([$ip, $username, $success]);
}

// Get client IP address
function getClientIP() {
    if (!empty($_SERVER['HTTP_CLIENT_IP'])) {
        return $_SERVER['HTTP_CLIENT_IP'];
    } elseif (!empty($_SERVER['HTTP_X_FORWARDED_FOR'])) {
        return $_SERVER['HTTP_X_FORWARDED_FOR'];
    } else {
        return $_SERVER['REMOTE_ADDR'];
    }
}
?>`;
        
        await fs.writeFile(path.join(authDir, 'config.php'), config);
    }

    async generateSessionHandler(authDir) {
        const session = `<?php
session_start();
require_once 'config.php';

header('Content-Type: application/json');

// Handle different request methods
$method = $_SERVER['REQUEST_METHOD'];

switch ($method) {
    case 'GET':
        // Return current session status
        $response = [
            'authenticated' => isset($_SESSION['user_id']),
            'username' => $_SESSION['username'] ?? null,
            'user_id' => $_SESSION['user_id'] ?? null,
            'csrf_token' => generateCSRFToken()
        ];
        break;
        
    case 'POST':
        // Handle session updates
        $input = json_decode(file_get_contents('php://input'), true);
        
        if (isset($input['action'])) {
            switch ($input['action']) {
                case 'refresh':
                    $_SESSION['last_activity'] = time();
                    $response = ['success' => true, 'message' => 'Session refreshed'];
                    break;
                    
                case 'destroy':
                    session_destroy();
                    $response = ['success' => true, 'message' => 'Session destroyed'];
                    break;
                    
                default:
                    $response = ['success' => false, 'message' => 'Invalid action'];
            }
        } else {
            $response = ['success' => false, 'message' => 'No action specified'];
        }
        break;
        
    default:
        $response = ['success' => false, 'message' => 'Method not allowed'];
        http_response_code(405);
}

// Check session timeout
if (isset($_SESSION['last_activity']) && 
    (time() - $_SESSION['last_activity']) > SESSION_LIFETIME) {
    session_destroy();
    $response['authenticated'] = false;
    $response['message'] = 'Session expired';
} else {
    $_SESSION['last_activity'] = time();
}

echo json_encode($response);
?>`;
        
        await fs.writeFile(path.join(authDir, 'session.php'), session);
    }

    async generateLoginProcessor(authDir) {
        const loginProcessor = `<?php
session_start();
require_once 'config.php';

header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed']);
    exit;
}

// Get client IP
$clientIP = getClientIP();

// Check for too many login attempts
if (!checkLoginAttempts($clientIP)) {
    http_response_code(429);
    echo json_encode([
        'success' => false, 
        'message' => 'Too many login attempts. Please try again later.'
    ]);
    exit;
}

// Get form data
$username = trim($_POST['username'] ?? $_POST['login'] ?? $_POST['email'] ?? '');
$password = $_POST['password'] ?? '';
$csrf_token = $_POST['csrf_token'] ?? '';

// Validate CSRF token
if (!verifyCSRFToken($csrf_token)) {
    echo json_encode(['success' => false, 'message' => 'Invalid CSRF token']);
    exit;
}

// Validate input
if (empty($username) || empty($password)) {
    echo json_encode(['success' => false, 'message' => 'Username and password are required']);
    exit;
}

$authenticated = false;
$user_id = null;
$user_email = null;

// Try database authentication first
$pdo = getDBConnection();
if ($pdo) {
    try {
        $stmt = $pdo->prepare("SELECT id, username, email, password FROM users WHERE username = ? OR email = ?");
        $stmt->execute([$username, $username]);
        $user = $stmt->fetch();
        
        if ($user && password_verify($password, $user['password'])) {
            $authenticated = true;
            $user_id = $user['id'];
            $username = $user['username'];
            $user_email = $user['email'];
            
            // Update last login
            $stmt = $pdo->prepare("UPDATE users SET last_login = NOW() WHERE id = ?");
            $stmt->execute([$user_id]);
        }
    } catch (PDOException $e) {
        error_log("Database authentication error: " . $e->getMessage());
    }
}

// Fallback to file-based authentication
if (!$authenticated) {
    $authenticated = authenticateWithFile($username, $password);
    if ($authenticated) {
        $user_id = 1; // Default user ID
        $user_email = $username . '@example.com';
    }
}

// Log the attempt
logLoginAttempt($clientIP, $username, $authenticated);

if ($authenticated) {
    // Set session variables
    $_SESSION['user_id'] = $user_id;
    $_SESSION['username'] = $username;
    $_SESSION['email'] = $user_email;
    $_SESSION['last_activity'] = time();
    $_SESSION['login_time'] = time();
    
    // Regenerate session ID for security
    session_regenerate_id(true);
    
    echo json_encode([
        'success' => true, 
        'message' => 'Login successful',
        'user' => [
            'id' => $user_id,
            'username' => $username,
            'email' => $user_email
        ]
    ]);
} else {
    echo json_encode(['success' => false, 'message' => 'Invalid username or password']);
}
?>`;
        
        await fs.writeFile(path.join(authDir, 'process_login.php'), loginProcessor);
    }

    async generateRegisterProcessor(authDir) {
        const registerProcessor = `<?php
session_start();
require_once 'config.php';

header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed']);
    exit;
}

// Get form data
$username = trim($_POST['username'] ?? '');
$email = trim($_POST['email'] ?? '');
$password = $_POST['password'] ?? '';
$confirm_password = $_POST['confirm_password'] ?? $_POST['password_confirm'] ?? '';
$csrf_token = $_POST['csrf_token'] ?? '';

// Validate CSRF token
if (!verifyCSRFToken($csrf_token)) {
    echo json_encode(['success' => false, 'message' => 'Invalid CSRF token']);
    exit;
}

// Validate input
$errors = [];

if (empty($username)) {
    $errors[] = 'Username is required';
} elseif (strlen($username) < 3) {
    $errors[] = 'Username must be at least 3 characters long';
}

if (empty($email)) {
    $errors[] = 'Email is required';
} elseif (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    $errors[] = 'Invalid email address';
}

if (empty($password)) {
    $errors[] = 'Password is required';
} elseif (strlen($password) < PASSWORD_MIN_LENGTH) {
    $errors[] = 'Password must be at least ' . PASSWORD_MIN_LENGTH . ' characters long';
}

if ($password !== $confirm_password) {
    $errors[] = 'Passwords do not match';
}

if (!empty($errors)) {
    echo json_encode(['success' => false, 'message' => implode(', ', $errors)]);
    exit;
}

// Try to register with database
$pdo = getDBConnection();
if ($pdo) {
    try {
        // Check if username or email already exists
        $stmt = $pdo->prepare("SELECT COUNT(*) FROM users WHERE username = ? OR email = ?");
        $stmt->execute([$username, $email]);
        
        if ($stmt->fetchColumn() > 0) {
            echo json_encode(['success' => false, 'message' => 'Username or email already exists']);
            exit;
        }
        
        // Hash password and insert user
        $hashedPassword = password_hash($password, PASSWORD_DEFAULT);
        $stmt = $pdo->prepare("INSERT INTO users (username, email, password) VALUES (?, ?, ?)");
        $stmt->execute([$username, $email, $hashedPassword]);
        
        $user_id = $pdo->lastInsertId();
        
        // Auto-login the user
        $_SESSION['user_id'] = $user_id;
        $_SESSION['username'] = $username;
        $_SESSION['email'] = $email;
        $_SESSION['last_activity'] = time();
        $_SESSION['login_time'] = time();
        
        session_regenerate_id(true);
        
        echo json_encode([
            'success' => true, 
            'message' => 'Registration successful',
            'user' => [
                'id' => $user_id,
                'username' => $username,
                'email' => $email
            ]
        ]);
        
    } catch (PDOException $e) {
        error_log("Registration error: " . $e->getMessage());
        echo json_encode(['success' => false, 'message' => 'Registration failed. Please try again.']);
    }
} else {
    // Database not available
    echo json_encode(['success' => false, 'message' => 'Registration is currently unavailable']);
}
?>`;
        
        await fs.writeFile(path.join(authDir, 'process_register.php'), registerProcessor);
    }

    async generateLoginPage(authDir) {
        const loginPage = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Login - Website Mirror</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            max-width: 400px;
            margin: 50px auto;
            padding: 20px;
            background-color: #f5f5f5;
        }
        
        .login-form {
            background: white;
            padding: 30px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        
        .form-group {
            margin-bottom: 20px;
        }
        
        label {
            display: block;
            margin-bottom: 5px;
            font-weight: bold;
        }
        
        input[type="text"],
        input[type="password"] {
            width: 100%;
            padding: 10px;
            border: 1px solid #ddd;
            border-radius: 4px;
            box-sizing: border-box;
        }
        
        button {
            width: 100%;
            padding: 12px;
            background-color: #007bff;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 16px;
        }
        
        button:hover {
            background-color: #0056b3;
        }
        
        .message {
            padding: 10px;
            margin: 10px 0;
            border-radius: 4px;
            display: none;
        }
        
        .message.error {
            background-color: #f8d7da;
            color: #721c24;
            border: 1px solid #f5c6cb;
        }
        
        .message.success {
            background-color: #d4edda;
            color: #155724;
            border: 1px solid #c3e6cb;
        }
        
        .links {
            text-align: center;
            margin-top: 20px;
        }
        
        .links a {
            color: #007bff;
            text-decoration: none;
        }
        
        .links a:hover {
            text-decoration: underline;
        }
    </style>
</head>
<body>
    <div class="login-form">
        <h2>Login</h2>
        
        <div id="message" class="message"></div>
        
        <form id="loginForm">
            <div class="form-group">
                <label for="username">Username or Email:</label>
                <input type="text" id="username" name="username" required>
            </div>
            
            <div class="form-group">
                <label for="password">Password:</label>
                <input type="password" id="password" name="password" required>
            </div>
            
            <input type="hidden" name="csrf_token" value="<?php session_start(); require_once 'config.php'; echo generateCSRFToken(); ?>">
            
            <button type="submit">Login</button>
        </form>
        
        <div class="links">
            <a href="register.php">Create an account</a> |
            <a href="../index.html">Back to Home</a>
        </div>
    </div>

    <script>
        document.getElementById('loginForm').addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const messageDiv = document.getElementById('message');
            const formData = new FormData(this);
            
            try {
                const response = await fetch('process_login.php', {
                    method: 'POST',
                    body: formData
                });
                
                const result = await response.json();
                
                if (result.success) {
                    messageDiv.className = 'message success';
                    messageDiv.textContent = result.message;
                    messageDiv.style.display = 'block';
                    
                    // Redirect after successful login
                    setTimeout(() => {
                        window.location.href = '../index.html';
                    }, 1500);
                } else {
                    messageDiv.className = 'message error';
                    messageDiv.textContent = result.message;
                    messageDiv.style.display = 'block';
                }
            } catch (error) {
                messageDiv.className = 'message error';
                messageDiv.textContent = 'Login failed. Please try again.';
                messageDiv.style.display = 'block';
            }
        });
    </script>
</body>
</html>`;
        
        await fs.writeFile(path.join(authDir, 'login.php'), loginPage);
    }

    async generateRegisterPage(authDir) {
        const registerPage = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Register - Website Mirror</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            max-width: 400px;
            margin: 50px auto;
            padding: 20px;
            background-color: #f5f5f5;
        }
        
        .register-form {
            background: white;
            padding: 30px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        
        .form-group {
            margin-bottom: 20px;
        }
        
        label {
            display: block;
            margin-bottom: 5px;
            font-weight: bold;
        }
        
        input[type="text"],
        input[type="email"],
        input[type="password"] {
            width: 100%;
            padding: 10px;
            border: 1px solid #ddd;
            border-radius: 4px;
            box-sizing: border-box;
        }
        
        button {
            width: 100%;
            padding: 12px;
            background-color: #28a745;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 16px;
        }
        
        button:hover {
            background-color: #218838;
        }
        
        .message {
            padding: 10px;
            margin: 10px 0;
            border-radius: 4px;
            display: none;
        }
        
        .message.error {
            background-color: #f8d7da;
            color: #721c24;
            border: 1px solid #f5c6cb;
        }
        
        .message.success {
            background-color: #d4edda;
            color: #155724;
            border: 1px solid #c3e6cb;
        }
        
        .links {
            text-align: center;
            margin-top: 20px;
        }
        
        .links a {
            color: #007bff;
            text-decoration: none;
        }
        
        .links a:hover {
            text-decoration: underline;
        }
    </style>
</head>
<body>
    <div class="register-form">
        <h2>Create Account</h2>
        
        <div id="message" class="message"></div>
        
        <form id="registerForm">
            <div class="form-group">
                <label for="username">Username:</label>
                <input type="text" id="username" name="username" required>
            </div>
            
            <div class="form-group">
                <label for="email">Email:</label>
                <input type="email" id="email" name="email" required>
            </div>
            
            <div class="form-group">
                <label for="password">Password:</label>
                <input type="password" id="password" name="password" required>
            </div>
            
            <div class="form-group">
                <label for="confirm_password">Confirm Password:</label>
                <input type="password" id="confirm_password" name="confirm_password" required>
            </div>
            
            <input type="hidden" name="csrf_token" value="<?php session_start(); require_once 'config.php'; echo generateCSRFToken(); ?>">
            
            <button type="submit">Create Account</button>
        </form>
        
        <div class="links">
            <a href="login.php">Already have an account?</a> |
            <a href="../index.html">Back to Home</a>
        </div>
    </div>

    <script>
        document.getElementById('registerForm').addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const messageDiv = document.getElementById('message');
            const formData = new FormData(this);
            
            try {
                const response = await fetch('process_register.php', {
                    method: 'POST',
                    body: formData
                });
                
                const result = await response.json();
                
                if (result.success) {
                    messageDiv.className = 'message success';
                    messageDiv.textContent = result.message;
                    messageDiv.style.display = 'block';
                    
                    // Redirect after successful registration
                    setTimeout(() => {
                        window.location.href = '../index.html';
                    }, 1500);
                } else {
                    messageDiv.className = 'message error';
                    messageDiv.textContent = result.message;
                    messageDiv.style.display = 'block';
                }
            } catch (error) {
                messageDiv.className = 'message error';
                messageDiv.textContent = 'Registration failed. Please try again.';
                messageDiv.style.display = 'block';
            }
        });
    </script>
</body>
</html>`;
        
        await fs.writeFile(path.join(authDir, 'register.php'), registerPage);
    }

    async generateLogoutHandler(authDir) {
        const logout = `<?php
session_start();

// Destroy session
session_destroy();

// Clear session cookie
if (ini_get("session.use_cookies")) {
    $params = session_get_cookie_params();
    setcookie(session_name(), '', time() - 42000,
        $params["path"], $params["domain"],
        $params["secure"], $params["httponly"]
    );
}

// Redirect to home page
header('Location: ../index.html');
exit;
?>`;
        
        await fs.writeFile(path.join(authDir, 'logout.php'), logout);
    }

    async generateHTAccessFile(outputDir) {
        const htaccess = `# Enable PHP
AddType application/x-httpd-php .php

# Enable mod_rewrite
RewriteEngine On

# Security headers
Header always set X-Content-Type-Options nosniff
Header always set X-Frame-Options DENY
Header always set X-XSS-Protection "1; mode=block"

# Hide PHP version
Header unset X-Powered-By

# Prevent access to sensitive files
<Files "*.log">
    Order allow,deny
    Deny from all
</Files>

<Files ".htaccess">
    Order allow,deny
    Deny from all
</Files>

# Custom error pages
ErrorDocument 404 /404.html
ErrorDocument 500 /500.html

# Cache static assets
<IfModule mod_expires.c>
    ExpiresActive On
    ExpiresByType text/css "access plus 1 month"
    ExpiresByType application/javascript "access plus 1 month"
    ExpiresByType image/png "access plus 1 month"
    ExpiresByType image/jpg "access plus 1 month"
    ExpiresByType image/jpeg "access plus 1 month"
    ExpiresByType image/gif "access plus 1 month"
    ExpiresByType image/svg+xml "access plus 1 month"
    ExpiresByType font/woff "access plus 1 month"
    ExpiresByType font/woff2 "access plus 1 month"
</IfModule>

# Compress files
<IfModule mod_deflate.c>
    AddOutputFilterByType DEFLATE text/plain
    AddOutputFilterByType DEFLATE text/html
    AddOutputFilterByType DEFLATE text/xml
    AddOutputFilterByType DEFLATE text/css
    AddOutputFilterByType DEFLATE application/xml
    AddOutputFilterByType DEFLATE application/xhtml+xml
    AddOutputFilterByType DEFLATE application/rss+xml
    AddOutputFilterByType DEFLATE application/javascript
    AddOutputFilterByType DEFLATE application/x-javascript
</IfModule>

# Directory browsing
Options -Indexes

# Follow symbolic links
Options +FollowSymLinks

# Default charset
AddDefaultCharset UTF-8`;
        
        await fs.writeFile(path.join(outputDir, '.htaccess'), htaccess);
    }
}

module.exports = PHPGenerator;
