<?php
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
?>