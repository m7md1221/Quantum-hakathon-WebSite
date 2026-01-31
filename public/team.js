const token = localStorage.getItem('token');

if (!token) {
  window.location.href = 'login.html';
}

let SUBMISSION_DEADLINE = '2026-02-15T23:59:59';

function isDeadlinePassed() {
  const deadline = new Date(SUBMISSION_DEADLINE);
  const now = new Date();
  return now > deadline;
}

function getTimeRemaining() {
  const deadline = new Date(SUBMISSION_DEADLINE);
  const now = new Date();
  const diff = deadline - now;
  
  if (diff <= 0) return null;
  
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  
  return { days, hours, minutes };
}

function formatDeadlineDate() {
  const deadline = new Date(SUBMISSION_DEADLINE);
  return deadline.toLocaleString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
}

function updateDeadlineDisplay() {
  const deadlineDisplay = document.getElementById('deadline-display');
  const statusText = document.getElementById('deadline-status-text');
  
  if (!deadlineDisplay) return;
  
  if (isDeadlinePassed()) {
    deadlineDisplay.textContent = formatDeadlineDate();
    deadlineDisplay.style.color = '#dc2626';
    statusText.innerHTML = '<strong>⚠️ Submission Period Has Ended</strong>';
    statusText.style.color = '#dc2626';
  } else {
    deadlineDisplay.textContent = formatDeadlineDate();
    deadlineDisplay.style.color = '#059669';
    
    const remaining = getTimeRemaining();
    if (remaining) {
      statusText.innerHTML = `<strong style="color: #059669;">✓ Time Remaining: ${remaining.days}d ${remaining.hours}h ${remaining.minutes}m</strong>`;
    }
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  try {
    const response = await fetch('/api/team/status', {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    const data = await response.json();
    if (response.ok) {
      // تحديث الـ deadline من الـ backend إذا توفر
      if (data.deadline) {
        SUBMISSION_DEADLINE = data.deadline;
      }
      
      const statusDiv = document.getElementById('status');
      statusDiv.innerHTML = `
        <div style="margin-bottom: 15px;">
          <strong>Hall:</strong> <span style="color: var(--primary-color); font-weight: 600;">${data.hall}</span>
        </div>
        <div style="margin-bottom: 15px;">
          <strong>Status:</strong>
          <span class="status-badge ${data.submitted ? 'status-submitted' : 'status-pending'}">
            ${data.submitted ? 'Submitted' : 'Not Submitted'}
          </span>
        </div>
        ${data.submittedAt ? `
          <div>
            <strong>Submitted At:</strong> ${new Date(data.submittedAt).toLocaleString()}
          </div>
        ` : ''}
      `;
    } else {
      document.getElementById('status').innerHTML = `
        <div class="message error">${data.message}</div>
      `;
    }
    
    updateDeadlineDisplay();
    
    if (isDeadlinePassed()) {
      const uploadBtn = document.querySelector('a[href="upload-project.html"]');
      if (uploadBtn) {
        uploadBtn.classList.add('btn-disabled');
        uploadBtn.style.pointerEvents = 'none';
        uploadBtn.style.opacity = '0.5';
        uploadBtn.title = 'Submission period has ended';
        uploadBtn.textContent = 'Upload Project (Closed)';
      }
    }
  } catch (error) {
    document.getElementById('status').innerHTML = `
      <div class="message error">An error occurred while loading status</div>
    `;
    updateDeadlineDisplay();
  }
});

document.getElementById('logout').addEventListener('click', () => {
  localStorage.clear();
  window.location.href = 'login.html';
});