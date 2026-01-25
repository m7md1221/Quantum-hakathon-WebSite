// Evaluate Team functionality

const API_BASE = 'http://localhost:3000/api';

// Get team ID and name from URL parameters
function getUrlParams() {
    const params = new URLSearchParams(window.location.search);
    return {
        teamId: params.get('teamId'),
        teamName: params.get('teamName')
    };
}

function displayTeamInfo() {
    const { teamId, teamName } = getUrlParams();
    
    if (!teamId || !teamName) {
        document.getElementById('evaluateMessage').textContent = 'Invalid team information';
        document.getElementById('evaluateMessage').className = 'message error';
        return;
    }
    
    document.getElementById('teamName').textContent = `Evaluate: ${decodeURIComponent(teamName)}`;
}

if (document.getElementById('evaluateForm')) {
    document.getElementById('evaluateForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const { teamId } = getUrlParams();
        const score = parseInt(document.getElementById('score').value);
        const evaluateMessage = document.getElementById('evaluateMessage');
        
        if (!teamId) {
            evaluateMessage.textContent = 'Invalid team information';
            evaluateMessage.className = 'message error';
            return;
        }
        
        if (score < 0 || score > 100) {
            evaluateMessage.textContent = 'Score must be between 0 and 100';
            evaluateMessage.className = 'message error';
            return;
        }
        
        try {
            evaluateMessage.textContent = 'Submitting evaluation...';
            evaluateMessage.className = 'message';
            evaluateMessage.style.display = 'block';
            
            const response = await fetch(`${API_BASE}/judge/evaluate`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({ teamId: parseInt(teamId), score })
            });
            
            const data = await response.json();
            
            if (!response.ok) {
                if (response.status === 401) {
                    logout();
                    return;
                }
                evaluateMessage.textContent = data.error || 'Evaluation failed';
                evaluateMessage.className = 'message error';
                return;
            }
            
            evaluateMessage.textContent = data.message || 'Evaluation saved successfully!';
            evaluateMessage.className = 'message success';
            
            // Redirect to dashboard after 2 seconds
            setTimeout(() => {
                window.location.href = 'judge-dashboard.html';
            }, 2000);
        } catch (error) {
            console.error('Evaluate error:', error);
            evaluateMessage.textContent = 'Network error. Please try again.';
            evaluateMessage.className = 'message error';
        }
    });
}

// Display team info on page load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', displayTeamInfo);
} else {
    displayTeamInfo();
}
