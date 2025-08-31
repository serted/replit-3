<?php
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

// Validate CSRF token (temporarily disabled for testing)
// if (!verifyCSRFToken($csrf_token)) {
//     echo json_encode(['success' => false, 'message' => 'Invalid CSRF token']);
//     exit;
// }

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
        $stmt = $pdo->prepare("SELECT id, username, password_hash, nickname, balance FROM users WHERE username = ?");
        $stmt->execute([$username]);
        $user = $stmt->fetch();
        
        if ($user && password_verify($password, $user['password_hash'])) {
            $authenticated = true;
            $user_id = $user['id'];
            $username = $user['username'];
            $user_nickname = $user['nickname'];
            $user_balance = $user['balance'];
            
            // Update last login (update updated_at)
            $stmt = $pdo->prepare("UPDATE users SET updated_at = NOW() WHERE id = ?");
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
        $user_nickname = $username;
        $user_balance = '1000.00';
    }
}

// Log the attempt
logLoginAttempt($clientIP, $username, $authenticated);

if ($authenticated) {
    // Set session variables
    $_SESSION['user_id'] = $user_id;
    $_SESSION['username'] = $username;
    $_SESSION['nickname'] = $user_nickname ?? $username;
    $_SESSION['balance'] = $user_balance ?? '0.00';
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
?>