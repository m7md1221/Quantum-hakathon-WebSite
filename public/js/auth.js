// Authentication utilities

const API_BASE = 'http://localhost:3000/api';

// Get token from localStorage
function getToken() {
    return localStorage.getItem('token');
}

// Get user from localStorage
function getUser() {
    const userStr = localStorage.getItem('user');
    return userStr ? JSON.parse(userStr) : null;
}

// Save auth data
function saveAuth(token, user) {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
}

// Clear auth data
function clearAuth() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
}

// Check if user is authenticated
function isAuthenticated() {
    return getToken() !== null;
}

// Get auth headers for API requests
function getAuthHeaders() {
    const token = getToken();
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
    };
}

// Redirect based on role
function redirectByRole(role) {
    switch(role) {
        case 'team':
            window.location.href = 'team-dashboard.html';
            break;
        case 'judge':
            window.location.href = 'judge-dashboard.html';
            break;
        case 'admin':
            window.location.href = 'admin-dashboard.html';
            break;
        default:
            window.location.href = 'login.html';
    }
}

// Logout function
function logout() {
    clearAuth();
    window.location.href = 'login.html';
}

// Check authentication on page load
function checkAuth() {
    if (!isAuthenticated() && !window.location.pathname.includes('login.html')) {
        window.location.href = 'login.html';
        return false;
    }
    return true;
}

// Display user info in navbar
function displayUserInfo() {
    const user = getUser();
    if (user) {
        const userNameEl = document.getElementById('userName');
        if (userNameEl) {
            userNameEl.textContent = user.name;
        }
        
        const userHallEl = document.getElementById('userHall');
        if (userHallEl && user.hall) {
            userHallEl.textContent = `Hall ${user.hall}`;
        }
    }
}

// Login form handler
if (document.getElementById('loginForm')) {
    document.getElementById('loginForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        const errorMessage = document.getElementById('errorMessage');
        
        try {
            const response = await fetch(`${API_BASE}/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email, password })
            });
            
            const data = await response.json();
            
            if (!response.ok) {
                errorMessage.textContent = data.error || 'Login failed';
                errorMessage.classList.add('show');
                return;
            }
            
            // Save auth data
            saveAuth(data.token, data.user);
            
            // Redirect based on role
            redirectByRole(data.user.role);
        } catch (error) {
            errorMessage.textContent = 'Network error. Please try again.';
            errorMessage.classList.add('show');
        }
    });
}

// Initialize on page load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        if (!window.location.pathname.includes('login.html')) {
            if (checkAuth()) {
                displayUserInfo();
            }
        }
    });
} else {
    if (!window.location.pathname.includes('login.html')) {
        if (checkAuth()) {
            displayUserInfo();
        }
    }
}
