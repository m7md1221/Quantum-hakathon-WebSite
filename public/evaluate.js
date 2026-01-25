const token = localStorage.getItem('token');
const urlParams = new URLSearchParams(window.location.search);
const teamId = urlParams.get('teamId');

if (!token || !teamId) {
  window.location.href = 'login.html';
}

// Load team name on page load
document.addEventListener('DOMContentLoaded', async () => {
  try {
    const response = await fetch('/api/judge/teams', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (response.ok) {
      const teams = await response.json();
      const team = teams.find(t => t.id == teamId);
      if (team) {
        document.getElementById('team-name').textContent = `Evaluating: ${team.name}`;
      }
    }
  } catch (error) {
    console.error('Error loading team info:', error);
  }
});

document.getElementById('evaluationForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const message = document.getElementById('message');
  const formData = new FormData(e.target);
  const scores = {};

  for (let [key, value] of formData.entries()) {
    scores[key] = parseFloat(value);
  }

  // Show loading state
  const submitBtn = e.target.querySelector('button[type="submit"]');
  const originalText = submitBtn.textContent;
  submitBtn.textContent = 'Submitting...';
  submitBtn.disabled = true;

  try {
    const response = await fetch('/api/judge/evaluate', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ teamId: parseInt(teamId), scores })
    });

    const data = await response.json();

    if (response.ok) {
      message.innerHTML = `<div class="message success">${data.message}</div>`;
      // Redirect after success
      setTimeout(() => {
        window.location.href = 'judge-dashboard.html';
      }, 2000);
    } else {
      message.innerHTML = `<div class="message error">${data.message}</div>`;
    }
  } catch (error) {
    message.innerHTML = `<div class="message error">An error occurred while submitting evaluation</div>`;
  } finally {
    submitBtn.textContent = originalText;
    submitBtn.disabled = false;
  }
});