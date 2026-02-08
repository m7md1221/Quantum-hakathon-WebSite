const token = localStorage.getItem('token');

if (!token) {
  goTo('login.html');
}

// Map hall letters to full names
function getHallName(hallLetter) {
  const hallNames = {
    'A': 'Intelligence',
    'B': 'Neural',
    'C': 'Qubit',
    'D': 'Quantum Core'
  };
  return hallNames[hallLetter] || `Hall ${hallLetter}`;
}

let SUBMISSION_DEADLINE = '2026-02-08T10:30:00';

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
    // Countdown timer logic
    function updateCountdown() {
      const timerDiv = document.getElementById('countdown-timer');
      if (!timerDiv) return;
      const deadline = new Date(SUBMISSION_DEADLINE);
      const now = new Date();
      const diff = deadline - now;
      if (diff <= 0) {
        timerDiv.textContent = '❌ Submission period has ended. No more uploads allowed.';
        timerDiv.style.color = '#dc2626';
        return;
      }
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);
      timerDiv.textContent = `Countdown: ${hours}h ${minutes}m ${seconds}s`;
    }
    updateCountdown();
    setInterval(updateCountdown, 1000);
  const deadlineDisplay = document.getElementById('deadline-display');
  const statusText = document.getElementById('deadline-status-text');
  
  if (!deadlineDisplay) return;
  deadlineDisplay.textContent = formatDeadlineDate();
  deadlineDisplay.style.color = '#059669';
  statusText.innerHTML = '<strong style="color:#059669;">⏰ The deadline has been extended by 4.5 more hours! New deadline: February 8, 2026 at 10:30 AM</strong>';
  statusText.style.color = '#059669';
}

function updateUploadButton(isSubmitted) {
  const uploadBtn = document.getElementById('upload-btn');
  if (!uploadBtn) return;
  
  const deadlinePassed = isDeadlinePassed();
  if (deadlinePassed) {
    // Disable upload button and show error message
    uploadBtn.classList.remove('btn-success');
    uploadBtn.classList.add('btn-disabled');
    uploadBtn.style.pointerEvents = 'none';
    uploadBtn.style.opacity = '0.5';
    uploadBtn.title = 'Submission period has ended';
    uploadBtn.textContent = '❌ Submission period has ended. No more uploads allowed.';
  } else if (isSubmitted) {
    uploadBtn.classList.remove('btn-success');
    uploadBtn.classList.add('btn-primary');
    uploadBtn.textContent = 'Edit Submission';
    uploadBtn.title = 'Update your project submission';
  } else {
    uploadBtn.classList.add('btn-success');
    uploadBtn.textContent = 'Upload Project';
    uploadBtn.title = 'Submit your project';
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  try {
    const response = await fetch('/api/team/status', {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    const data = await response.json();
    if (response.ok) {
      // Update team name and number in header
      const teamNameDisplay = document.getElementById('team-name-display');
      const teamSubtitle = document.getElementById('team-subtitle');
      if (teamNameDisplay && data.team_number) {
        teamNameDisplay.textContent = `Team #${data.team_number}`;
        if (data.name) {
          teamSubtitle.textContent = data.name;
        }
      }
      
      // تجاهل أي deadline من السيرفر، الديدلاين دائماً 6:00 AM
      
      const statusDiv = document.getElementById('status');
      statusDiv.innerHTML = `
        <div style="margin-bottom: 15px;">
          <strong>Hall:</strong> <span style="color: var(--primary-color); font-weight: 600;">${getHallName(data.hall)}</span>
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
      
      // تحديث زر الرفع
      updateUploadButton(data.submitted);
    } else {
      document.getElementById('status').innerHTML = `
        <div class="message error">${data.message}</div>
      `;
    }
    
    updateDeadlineDisplay();
  } catch (error) {
    document.getElementById('status').innerHTML = `
      <div class="message error">An error occurred while loading status</div>
    `;
    updateDeadlineDisplay();
  }
});

document.getElementById('logout').addEventListener('click', () => {
  localStorage.clear();
  goTo('login.html');
});