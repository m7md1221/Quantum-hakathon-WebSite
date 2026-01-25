// Admin Dashboard functionality

const API_BASE = 'http://localhost:3000/api';

async function loadTeams() {
    try {
        const response = await fetch(`${API_BASE}/admin/teams`, {
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
    
    if (teams.length === 0) {
        container.innerHTML = '<p>No teams found.</p>';
        return;
    }
    
    // Group by hall
    const teamsByHall = {};
    teams.forEach(team => {
        if (!teamsByHall[team.hall]) {
            teamsByHall[team.hall] = [];
        }
        teamsByHall[team.hall].push(team);
    });
    
    let html = '';
    Object.keys(teamsByHall).sort().forEach(hall => {
        html += `<h3 style="margin-top: 20px; color: #667eea;">Hall ${hall}</h3>`;
        html += teamsByHall[hall].map(team => `
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
                <div class="score-info" style="margin-top: 10px;">
                    <span class="score-item">Evaluated by: ${team.evaluated_by} judges</span>
                    <span class="score-item total">Total Score: ${parseFloat(team.total_score).toFixed(1)}</span>
                    <span class="score-item average">Average Score: ${parseFloat(team.average_score).toFixed(2)}</span>
                </div>
            </div>
        `).join('');
    });
    
    container.innerHTML = html;
}

// Load teams on page load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadTeams);
} else {
    loadTeams();
}
