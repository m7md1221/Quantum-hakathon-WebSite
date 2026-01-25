// Upload Project functionality

const API_BASE = 'http://localhost:3000/api';

if (document.getElementById('uploadForm')) {
    document.getElementById('uploadForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const fileInput = document.getElementById('projectFile');
        const file = fileInput.files[0];
        const uploadMessage = document.getElementById('uploadMessage');
        
        if (!file) {
            uploadMessage.textContent = 'Please select a file';
            uploadMessage.className = 'message error';
            return;
        }
        
        // Validate file type
        if (!file.name.toLowerCase().endsWith('.zip')) {
            uploadMessage.textContent = 'Only ZIP files are allowed';
            uploadMessage.className = 'message error';
            return;
        }
        
        // Validate file size (50MB)
        if (file.size > 50 * 1024 * 1024) {
            uploadMessage.textContent = 'File size must be less than 50MB';
            uploadMessage.className = 'message error';
            return;
        }
        
        const formData = new FormData();
        formData.append('project', file);
        
        try {
            uploadMessage.textContent = 'Uploading...';
            uploadMessage.className = 'message';
            uploadMessage.style.display = 'block';
            
            const token = getToken();
            const response = await fetch(`${API_BASE}/team/upload`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                body: formData
            });
            
            const data = await response.json();
            
            if (!response.ok) {
                if (response.status === 401) {
                    logout();
                    return;
                }
                uploadMessage.textContent = data.error || 'Upload failed';
                uploadMessage.className = 'message error';
                return;
            }
            
            uploadMessage.textContent = data.message || 'Project uploaded successfully!';
            uploadMessage.className = 'message success';
            
            // Clear file input
            fileInput.value = '';
            
            // Redirect to dashboard after 2 seconds
            setTimeout(() => {
                window.location.href = 'team-dashboard.html';
            }, 2000);
        } catch (error) {
            console.error('Upload error:', error);
            uploadMessage.textContent = 'Network error. Please try again.';
            uploadMessage.className = 'message error';
        }
    });
}
