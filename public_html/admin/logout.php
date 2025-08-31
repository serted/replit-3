<?php
session_start();

// Clear admin session
unset($_SESSION['admin_id']);
unset($_SESSION['admin_username']);
unset($_SESSION['admin_role']);

// Destroy session
session_destroy();

// Redirect to login
header('Location: login.php');
exit;
?>