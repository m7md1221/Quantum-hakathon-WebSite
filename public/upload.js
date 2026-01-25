const token = localStorage.getItem('token');

if (!token) {
  window.location.href = 'login.html';
}

document.getElementById('uploadForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const fileInput = document.getElementById('project');
  const message = document.getElementById('message');

  const formData = new FormData();
  formData.append('project', fileInput.files[0]);

  // Show loading state
  const submitBtn = e.target.querySelector('button[type="submit"]');
  const originalText = submitBtn.textContent;
  submitBtn.textContent = 'Uploading...';
  submitBtn.disabled = true;

  try {
    const response = await fetch('/api/team/upload', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: formData
    });

    const data = await response.json();

    if (response.ok) {
      message.innerHTML = `<div class="message success">${data.message}</div>`;
      // Redirect after success
      setTimeout(() => {
        window.location.href = 'team-dashboard.html';
      }, 2000);
    } else {
      message.innerHTML = `<div class="message error">${data.message}</div>`;
    }
  } catch (error) {
    message.innerHTML = `<div class="message error">An error occurred during upload</div>`;
  } finally {
    submitBtn.textContent = originalText;
    submitBtn.disabled = false;
  }
});