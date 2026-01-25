// Team Dashboard functionality

const API_BASE = 'http://localhost:3000/api';

async function loadStatus() {
    try {
        const response = await fetch(`${API_BASE}/team/status`, {
            headers: getAuthHeaders()
        });
        
        if (!response.ok) {
            if (response.status === 401) {
                logout();
                return;
            }
            throw new Error('Failed to load status');
        }
        
        const data = await response.json();
        displayStatus(data);
    } catch (error) {
        console.error('Error loading status:', error);
        document.getElementById('statusInfo').innerHTML = 
            '<p class="error-message">Error loading status. Please refresh.</p>';
    }
}

function displayStatus(status) {
    const statusInfo = document.getElementById('statusInfo');
    
    if (status.submitted) {
        statusInfo.innerHTML = `
            <div class="status-item">
                <p><strong>Status:</strong> <span class="badge badge-submitted">Submitted</span></p>
                <p><strong>Hall:</strong> ${status.hall}</p>
                <p><strong>Submitted At:</strong> ${new Date(status.submittedAt).toLocaleString()}</p>
            </div>
        `;
    } else {
        statusInfo.innerHTML = `
            <div class="status-item">
                <p><strong>Status:</strong> <span class="badge badge-pending">Not Submitted</span></p>
                <p><strong>Hall:</strong> ${status.hall}</p>
                <p>Please upload your project ZIP file to complete submission.</p>
            </div>
        `;
    }
}

// Load status on page load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadStatus);
} else {
    loadStatus();
}
