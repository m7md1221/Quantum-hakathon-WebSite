const token = localStorage.getItem('token');

if (!token) {
  window.location.href = 'login.html';
}

document.addEventListener('DOMContentLoaded', async () => {
  try {
    const response = await fetch('/api/team/status', {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    const data = await response.json();
    if (response.ok) {
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
  } catch (error) {
    document.getElementById('status').innerHTML = `
      <div class="message error">An error occurred while loading status</div>
    `;
  }
});

document.getElementById('logout').addEventListener('click', () => {
  localStorage.clear();
  window.location.href = 'login.html';
});