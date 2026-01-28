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

    // Parse data safely
    let data;
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      data = await response.json();
    } else {
      const text = await response.text();
      data = { message: 'Server error: ' + (text.substring(0, 50) || 'Unknown error') };
    }

    if (response.ok) {
      message.innerHTML = `<div class="message success">${data.message || 'Project uploaded successfully'}</div>`;
      setTimeout(() => { window.location.href = 'team-dashboard.html'; }, 2000);
    } else {
      const errorMsg = data.message || 'Upload failed';
      message.innerHTML = `<div class="message error">${typeof errorMsg === 'string' ? errorMsg : JSON.stringify(errorMsg)}</div>`;
    }
  } catch (error) {
    console.error('Upload catch error:', error);
    message.innerHTML = `<div class="message error">An error occurred during upload: ${error.message}</div>`;
  } finally {
    submitBtn.textContent = originalText;
    submitBtn.disabled = false;
  }
});