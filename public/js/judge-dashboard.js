// Judge Dashboard functionality

const API_BASE = 'http://localhost:3000/api';

async function loadTeams() {
    try {
        const response = await fetch(`${API_BASE}/judge/teams`, {
            headers: getAuthHeaders()
        });
        
        if (!response.ok) {
            if (response.status === 401) {
                logout();
                return;
            }
            throw new Error('Failed to load teams');
        }
        
        const data = await response.json();
        displayTeams(data);
    } catch (error) {
        console.error('Error loading teams:', error);
        document.getElementById('teamsContainer').innerHTML = 
            '<p class="error-message">Error loading teams. Please refresh.</p>';
    }
}

function displayTeams(teams) {
    const container = document.getElementById('teamsContainer');
    const user = getUser();
    
    // Display hall name
    const hallNameEl = document.getElementById('hallName');
    if (hallNameEl && user) {
        hallNameEl.textContent = `Hall ${user.hall}`;
    }
    
    if (teams.length === 0) {
        container.innerHTML = '<p>No teams found in your hall.</p>';
        return;
    }
    
    container.innerHTML = teams.map(team => `
        <div class="team-card">
            <h3>${team.name}</h3>
            <p><strong>Email:</strong> ${team.email}</p>
            <p><strong>Submission Status:</strong> 
                ${team.has_submitted 
                    ? `<span class="badge badge-submitted">Submitted</span>` 
                    : `<span class="badge badge-pending">Not Submitted</span>`
                }
            </p>
            ${team.submitted_at ? `<p><strong>Submitted:</strong> ${new Date(team.submitted_at).toLocaleString()}</p>` : ''}
            <a href="evaluate-team.html?teamId=${team.id}&teamName=${encodeURIComponent(team.name)}" 
               class="btn btn-primary" style="margin-top: 10px;">
                Evaluate Team
            </a>
        </div>
    `).join('');
}

// Load teams on page load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadTeams);
} else {
    loadTeams();
}
