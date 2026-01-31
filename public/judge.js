const token = localStorage.getItem('token');

if (!token) {
  window.location.href = 'login.html';
}

// Global teams variable
let teams = [];

// Function to validate token
async function validateToken() {
  try {
    const response = await fetch('/api/judge/teams', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    return response.ok;
  } catch (error) {
    return false;
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  // First validate token
  const isValidToken = await validateToken();
  if (!isValidToken) {
    localStorage.clear();
    window.location.href = 'login.html';
    return;
  }

  try {
    // Get judge profile (name + hall)
    const profileResponse = await fetch('/api/auth/me', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (profileResponse.ok) {
      const profile = await profileResponse.json();
      document.getElementById('judge-name').textContent = profile.name;
    }
  } catch (error) {
    console.error('Error loading profile:', error);
  }

  try {
    // Get hall info
    const hallResponse = await fetch('/api/judge/teams', {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!hallResponse.ok) {
      // Handle authentication errors
      if (hallResponse.status === 401) {
        localStorage.clear();
        window.location.href = 'login.html';
        return;
      }

      const errorData = await hallResponse.json().catch(() => ({ message: 'Unknown error' }));
      throw new Error(errorData.message || 'Failed to load teams');
    }

    teams = await hallResponse.json();

    // Extract hall from first team (assuming all teams are from same hall)
    const hall = teams.length > 0 ? teams[0].hall || 'Unknown' : 'No teams assigned';
    document.getElementById('hall').textContent = hall;

    // Display teams
    const teamsContainer = document.getElementById('teams-container');
    const loadingDiv = document.getElementById('teams-loading');

    if (teams.length === 0) {
      loadingDiv.innerHTML = '<p style="text-align: center; color: var(--text-secondary);">No teams assigned to your hall yet.</p>';
    } else {
      loadingDiv.style.display = 'none';
      teamsContainer.style.display = 'grid';

      // Sort teams: non-evaluated first, then evaluated
      const sortedTeams = [...teams].sort((a, b) => {
        const aEvaluated = !!a.evaluated;
        const bEvaluated = !!b.evaluated;
        // Non-evaluated teams come first (false < true)
        if (aEvaluated !== bEvaluated) {
          return aEvaluated ? 1 : -1;
        }
        return 0;
      });

      sortedTeams.forEach(team => {
        const teamCard = document.createElement('div');
        const isSubmitted = !!team.submitted_at;
        const isEvaluated = !!team.evaluated;
        const isFinal = !!team.is_final;

        // Add different class for evaluated teams
        teamCard.className = isEvaluated ? 'judge-card judge-card-evaluated' : 'judge-card judge-card-pending';

        teamCard.innerHTML = `
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <h3 style="margin: 0;">
  الفريق رقم ${team.team_number ?? '-'}
</h3>
            ${isEvaluated
            ? '<span class="status-badge status-evaluated" title="This team has been evaluated by you">تم التقييم</span>'
            : '<span class="status-badge status-pending" title="You have not evaluated this team yet">لم يُقيَّم بعد</span>'
          }
          </div>
          <p><strong>Status:</strong> ${isSubmitted
            ? '<span style="color: var(--success-color);">Submitted</span>'
            : '<span style="color: var(--warning-color);">Pending</span>'
          }</p>
          ${isSubmitted
            ? `<p><strong>Submitted:</strong> ${new Date(team.submitted_at).toLocaleDateString()}</p>`
            : ''
          }
          ${team.clean_code_score !== null && team.clean_code_score !== undefined ? `<p><strong>Clean Code:</strong> ${team.clean_code_score}/100</p>` : ''}
         <button
  onclick="evaluateTeam(${team.id})"
  class="btn btn-block ${isEvaluated ? 'btn-secondary' : 'btn-success'}"
  style="margin-top: 15px;"
>
  ${isEvaluated ? 'View Evaluation' : 'Evaluate Team'}
</button>


        `;

        teamsContainer.appendChild(teamCard);
      });
    }
  } catch (error) {
    console.error('Error loading teams:', error);
    document.getElementById('teams-loading').innerHTML = `
      <div class="message error">Failed to load teams. Please check your connection and try again.</div>
    `;
  }
});

function evaluateTeam(teamId) {
  const team = teams.find(t => t.id === teamId);
  const mode = team.evaluated ? 'view' : 'edit';
  window.location.href = `evaluate-team.html?teamId=${teamId}&mode=${mode}`;
}


document.getElementById('logout').addEventListener('click', () => {
  localStorage.clear();
  window.location.href = 'login.html';
});