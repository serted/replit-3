<?php
session_start();
require_once '../auth/config.php';

// Check if user is admin
if (!isset($_SESSION['admin_id'])) {
    header('Location: login.php');
    exit;
}

$pdo = getDBConnection();
$users = [];
$message = '';

if ($pdo) {
    try {
        // Get all users
        $stmt = $pdo->prepare("SELECT * FROM users ORDER BY created_at DESC");
        $stmt->execute();
        $users = $stmt->fetchAll();
        
        // Handle user updates
        if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['action'])) {
            switch ($_POST['action']) {
                case 'update_user':
                    $userId = $_POST['user_id'];
                    $nickname = $_POST['nickname'];
                    $balance = $_POST['balance'];
                    $status = $_POST['status'];
                    
                    $stmt = $pdo->prepare("UPDATE users SET nickname = ?, balance = ?, status = ?, updated_at = NOW() WHERE id = ?");
                    $stmt->execute([$nickname, $balance, $status, $userId]);
                    $message = "User updated successfully";
                    break;
                    
                case 'delete_user':
                    $userId = $_POST['user_id'];
                    $stmt = $pdo->prepare("DELETE FROM users WHERE id = ?");
                    $stmt->execute([$userId]);
                    $message = "User deleted successfully";
                    break;
            }
            
            // Refresh user list
            $stmt = $pdo->prepare("SELECT * FROM users ORDER BY created_at DESC");
            $stmt->execute();
            $users = $stmt->fetchAll();
        }
    } catch (PDOException $e) {
        $message = "Database error: " . $e->getMessage();
    }
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Admin Panel - User Management</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 20px;
            background-color: #f5f5f5;
        }
        
        .header {
            background: white;
            padding: 20px;
            margin-bottom: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        
        .container {
            background: white;
            padding: 30px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        
        table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
        }
        
        th, td {
            padding: 12px;
            text-align: left;
            border-bottom: 1px solid #ddd;
        }
        
        th {
            background-color: #f8f9fa;
            font-weight: bold;
        }
        
        .btn {
            padding: 8px 16px;
            margin: 2px;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            text-decoration: none;
            display: inline-block;
        }
        
        .btn-primary { background-color: #007bff; color: white; }
        .btn-danger { background-color: #dc3545; color: white; }
        .btn-success { background-color: #28a745; color: white; }
        
        .form-inline {
            display: flex;
            gap: 10px;
            align-items: center;
        }
        
        .form-inline input {
            padding: 6px;
            border: 1px solid #ddd;
            border-radius: 4px;
        }
        
        .message {
            padding: 10px;
            margin: 10px 0;
            border-radius: 4px;
            background-color: #d4edda;
            color: #155724;
            border: 1px solid #c3e6cb;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>Admin Panel - User Management</h1>
        <div>
            <span>Welcome, <?php echo htmlspecialchars($_SESSION['admin_username'] ?? 'Admin'); ?></span>
            <a href="logout.php" class="btn btn-danger">Logout</a>
        </div>
    </div>
    
    <div class="container">
        <?php if ($message): ?>
            <div class="message"><?php echo htmlspecialchars($message); ?></div>
        <?php endif; ?>
        
        <h2>Users (<?php echo count($users); ?>)</h2>
        
        <table>
            <thead>
                <tr>
                    <th>ID</th>
                    <th>Username</th>
                    <th>Nickname</th>
                    <th>Balance</th>
                    <th>Status</th>
                    <th>Created</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
                <?php foreach ($users as $user): ?>
                <tr>
                    <form method="POST" class="user-form">
                        <td><?php echo htmlspecialchars($user['id']); ?></td>
                        <td><?php echo htmlspecialchars($user['username']); ?></td>
                        <td>
                            <input type="text" name="nickname" value="<?php echo htmlspecialchars($user['nickname'] ?? ''); ?>" style="width: 100px;">
                        </td>
                        <td>
                            <input type="number" step="0.01" name="balance" value="<?php echo htmlspecialchars($user['balance']); ?>" style="width: 80px;">
                        </td>
                        <td>
                            <select name="status">
                                <option value="active" <?php echo $user['status'] === 'active' ? 'selected' : ''; ?>>Active</option>
                                <option value="inactive" <?php echo $user['status'] === 'inactive' ? 'selected' : ''; ?>>Inactive</option>
                                <option value="banned" <?php echo $user['status'] === 'banned' ? 'selected' : ''; ?>>Banned</option>
                            </select>
                        </td>
                        <td><?php echo htmlspecialchars($user['created_at']); ?></td>
                        <td>
                            <input type="hidden" name="action" value="update_user">
                            <input type="hidden" name="user_id" value="<?php echo $user['id']; ?>">
                            <button type="submit" class="btn btn-primary">Update</button>
                            <button type="submit" name="action" value="delete_user" class="btn btn-danger" 
                                    onclick="return confirm('Are you sure you want to delete this user?')">Delete</button>
                        </td>
                    </form>
                </tr>
                <?php endforeach; ?>
            </tbody>
        </table>
    </div>
</body>
</html>