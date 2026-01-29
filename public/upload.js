const token = localStorage.getItem('token');

if (!token) {
  window.location.href = 'login.html';
}

// GitHub URL Validation
function validateGitHubUrl(url) {
  if (!url || typeof url !== 'string') return false;
  
  const trimmed = url.trim();
  
  // Must start with https://github.com/
  if (!trimmed.startsWith('https://github.com/')) return false;
  
  // Check if it's a valid URL
  try {
    const urlObj = new URL(trimmed);
    if (urlObj.hostname !== 'github.com') return false;
    if (urlObj.pathname.length <= 1) return false; // Must have owner/repo
    return true;
  } catch {
    return false;
  }
}

// Real-time validation
document.getElementById('github_url').addEventListener('input', (e) => {
  const url = e.target.value;
  const validationMessage = document.getElementById('validation-message');
  
  if (!url) {
    validationMessage.style.display = 'none';
    return;
  }
  
  if (!validateGitHubUrl(url)) {
    validationMessage.style.display = 'block';
    validationMessage.style.backgroundColor = '#fee2e2';
    validationMessage.style.color = '#dc2626';
    validationMessage.textContent = '❌ Invalid GitHub URL. Must start with https://github.com/';
  } else {
    validationMessage.style.display = 'block';
    validationMessage.style.backgroundColor = '#dcfce7';
    validationMessage.style.color = '#16a34a';
    validationMessage.textContent = '✅ Valid GitHub URL';
  }
});

// Form submission
document.getElementById('submitForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const githubUrl = document.getElementById('github_url').value;
  const message = document.getElementById('message');
  const submitBtn = e.target.querySelector('button[type="submit"]');
  const originalText = submitBtn.textContent;

  // Final validation
  if (!validateGitHubUrl(githubUrl)) {
    message.innerHTML = `<div class="message error">❌ Invalid GitHub URL. Must start with https://github.com/</div>`;
    return;
  }

  // Show loading state
  submitBtn.textContent = 'Submitting...';
  submitBtn.disabled = true;

  try {
    const response = await fetch('/api/team/submit', {
      method: 'POST',
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ github_url: githubUrl })
    });

    let data;
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      data = await response.json();
    } else {
      const text = await response.text();
      data = { message: 'Server error: ' + (text.substring(0, 50) || 'Unknown error') };
    }

    if (response.ok) {
      message.innerHTML = `<div class="message success">✅ ${data.message || 'Project submitted successfully'}</div>`;
      console.log('Project submission successful:', data);
      setTimeout(() => { 
        window.location.href = 'team-dashboard.html'; 
      }, 2000);
    } else {
      const errorMsg = data.message || 'Submission failed';
      message.innerHTML = `<div class="message error">❌ ${typeof errorMsg === 'string' ? errorMsg : JSON.stringify(errorMsg)}</div>`;
    }
  } catch (error) {
    console.error('Submission error:', error);
    message.innerHTML = `<div class="message error">❌ An error occurred: ${error.message}</div>`;
  } finally {
    submitBtn.textContent = originalText;
    submitBtn.disabled = false;
  }
});