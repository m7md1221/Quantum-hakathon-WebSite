// Centralized authentication utilities

/**
 * Get authentication headers with JWT token
 */
function getAuthHeaders() {
    const token = localStorage.getItem('token');
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
    };
}

/**
 * Logout user and redirect to login
 */
function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    localStorage.removeItem('hall');
    window.location.href = 'login.html';
}

/**
 * Check if user is authenticated
 */
function isAuthenticated() {
    return !!localStorage.getItem('token');
}

/**
 * Get current user role
 */
function getUserRole() {
    return localStorage.getItem('role');
}

/**
 * Get current user hall
 */
function getUserHall() {
    return localStorage.getItem('hall');
}

/**
 * Verify authentication on page load
 */
function ensureAuthenticated() {
    if (!isAuthenticated()) {
        window.location.href = 'login.html';
    }
}
