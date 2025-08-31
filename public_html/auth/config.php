<?php
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
?>