// Team Dashboard functionality

const API_BASE = window.location.origin + '/api';

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
        // Always show deadline extension message and enable upload button
        const deadlineStatusText = document.getElementById('deadline-status-text');
        if (deadlineStatusText) {
            deadlineStatusText.innerHTML = `⏰ تم تمديد الديدلاين ساعتين إضافيتين! الديدلاين الجديد: February 8, 2026 at 08:00 AM`;
            deadlineStatusText.style.color = '#059669';
            deadlineStatusText.style.fontWeight = '600';
        }
        const uploadBtn = document.getElementById('upload-btn');
        if (uploadBtn) {
            uploadBtn.classList.remove('btn-disabled');
            uploadBtn.classList.add('btn-success');
            uploadBtn.style.pointerEvents = 'auto';
            uploadBtn.style.opacity = '1';
        }
    } catch (error) {
        console.error('Error loading status:', error);
        document.getElementById('statusInfo').innerHTML = 
            '<p class="error-message">Error loading status. Please refresh.</p>';
    }
}

function displayStatus(status) {
    const statusInfo = document.getElementById('statusInfo');
    
    // تمديد الديدلاين ساعتين من الآن
    const deadlineMsg = `<div class="message info" style="color:#059669; font-weight:600; margin-bottom:8px;">⏰ Deadline extended! New deadline: February 8, 2026 at 08:00 AM</div>`;
    statusInfo.innerHTML = `
        <div class="status-item">
            <p><strong>Status:</strong> <span class="badge ${status.submitted ? 'badge-submitted' : 'badge-pending'}">${status.submitted ? 'Submitted' : 'Not Submitted'}</span></p>
            <p><strong>Hall:</strong> ${status.hall}</p>
            ${status.submitted ? `<p><strong>Submitted At:</strong> ${new Date(status.submittedAt).toLocaleString()}</p>` : '<p>Please submit your GitHub repository to complete submission.</p>'}
            ${deadlineMsg}
        </div>
    `;
    // فتح زر رفع المشروع دائماً
    const uploadBtn = document.getElementById('upload-btn');
    if (uploadBtn) {
        uploadBtn.classList.remove('btn-disabled');
        uploadBtn.classList.add('btn-success');
        uploadBtn.style.pointerEvents = 'auto';
        uploadBtn.style.opacity = '1';
    }
}

// Load status on page load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadStatus);
} else {
    loadStatus();
}
