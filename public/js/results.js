// Results page functionality

const API_BASE = 'http://localhost:3000/api';

async function loadResults() {
    try {
        const response = await fetch(`${API_BASE}/admin/results`, {
            headers: getAuthHeaders()
        });
        
        if (!response.ok) {
            if (response.status === 401) {
                logout();
                return;
            }
            throw new Error('Failed to load results');
        }
        
        const data = await response.json();
        displayResults(data);
    } catch (error) {
        console.error('Error loading results:', error);
        document.getElementById('resultsContainer').innerHTML = 
            '<p class="error-message">Error loading results. Please refresh.</p>';
    }
}

function displayResults(teams) {
    const winnersContainer = document.getElementById('winnersContainer');
    const resultsContainer = document.getElementById('resultsContainer');
    
    if (teams.length === 0) {
        resultsContainer.innerHTML = '<p>No results available.</p>';
        return;
    }
    
    // Display top 5 winners
    const winners = teams.slice(0, 5);
    winnersContainer.innerHTML = winners.map((team, index) => `
        <div class="winner-card">
            <div style="display: flex; align-items: center; gap: 15px;">
                <div class="rank">#${index + 1}</div>
                <div style="flex: 1;">
                    <h3>${team.name}</h3>
                    <p><strong>Hall:</strong> ${team.hall}</p>
                    <p><strong>Email:</strong> ${team.email}</p>
                    <div class="score-info" style="margin-top: 10px;">
                        <span class="score-item total">Total: ${parseFloat(team.total_score).toFixed(1)}</span>
                        <span class="score-item average">Average: ${parseFloat(team.average_score).toFixed(2)}</span>
                        <span class="score-item">Evaluated by: ${team.evaluated_by} judges</span>
                    </div>
                </div>
            </div>
        </div>
    `).join('');
    
    // Display all teams ranked
    resultsContainer.innerHTML = teams.map((team, index) => {
        const isWinner = index < 5;
        return `
            <div class="result-card ${isWinner ? 'winner' : ''}">
                <div style="display: flex; align-items: center; gap: 15px; margin-bottom: 10px;">
                    <div style="font-size: 1.5em; font-weight: bold; color: #667eea; min-width: 50px;">
                        #${index + 1}
                    </div>
                    <div style="flex: 1;">
                        <h3>${team.name}</h3>
                        <p><strong>Hall:</strong> ${team.hall} | <strong>Email:</strong> ${team.email}</p>
                    </div>
                </div>
                <div class="score-info">
                    <span class="score-item total">Total Score: ${parseFloat(team.total_score).toFixed(1)}</span>
                    <span class="score-item average">Average Score: ${parseFloat(team.average_score).toFixed(2)}</span>
                    <span class="score-item">Evaluated by: ${team.evaluated_by} judges</span>
                </div>
                ${team.judgeScores && team.judgeScores.length > 0 ? `
                    <div class="judge-scores">
                        <strong>Judge Scores:</strong>
                        ${team.judgeScores.map(js => `
                            <div class="judge-score-item">
                                <span>${js.judge_name}</span>
                                <span><strong>${js.score}</strong></span>
                            </div>
                        `).join('')}
                    </div>
                ` : ''}
            </div>
        `;
    }).join('');
}

// Load results on page load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadResults);
} else {
    loadResults();
}
