const token = localStorage.getItem('token');

if (!token) {
  window.location.href = 'login.html';
}

document.addEventListener('DOMContentLoaded', async () => {
  await loadStats();
  await loadTeams();

  // Refresh button
  document.getElementById('refresh-btn').addEventListener('click', async () => {
    await loadStats();
    await loadTeams();
  });

  // Logout button
  document.getElementById('logout').addEventListener('click', () => {
    localStorage.clear();
    window.location.href = 'login.html';
  });
});

async function loadStats() {
  try {
    const response = await fetch('/api/admin/stats', {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!response.ok) {
      if (response.status === 401) {
        localStorage.clear();
        window.location.href = 'login.html';
        return;
      }
      throw new Error('Failed to load stats');
    }

    const data = await response.json();
    displayStats(data);
  } catch (error) {
    console.error('Error loading stats:', error);
    document.getElementById('stats').innerHTML = '<p class="error">Failed to load statistics</p>';
  }
}

function displayStats(data) {
  const statsDiv = document.getElementById('stats');
  const { overall } = data;

  statsDiv.innerHTML = `
    <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px;">
      <div class="stat-item" style="text-align: center; padding: 15px; background: var(--background); border-radius: 8px;">
        <div style="font-size: 2.5rem; font-weight: 700; color: var(--primary-color);">${overall.total_teams || 0}</div>
        <div style="color: var(--text-secondary); font-size: 0.9rem; text-transform: uppercase; letter-spacing: 1px;">Total Teams</div>
      </div>
      <div class="stat-item" style="text-align: center; padding: 15px; background: var(--background); border-radius: 8px;">
        <div style="font-size: 2.5rem; font-weight: 700; color: var(--success-color);">${overall.submitted_teams || 0}</div>
        <div style="color: var(--text-secondary); font-size: 0.9rem; text-transform: uppercase; letter-spacing: 1px;">Submitted</div>
      </div>
      <div class="stat-item" style="text-align: center; padding: 15px; background: var(--background); border-radius: 8px;">
        <div style="font-size: 2.5rem; font-weight: 700; color: var(--warning-color);">${overall.evaluated_teams || 0}</div>
        <div style="color: var(--text-secondary); font-size: 0.9rem; text-transform: uppercase; letter-spacing: 1px;">Evaluated</div>
      </div>
      <div class="stat-item" style="text-align: center; padding: 15px; background: var(--background); border-radius: 8px;">
        <div style="font-size: 2.5rem; font-weight: 700; color: var(--info-color);">${overall.total_judges || 0}</div>
        <div style="color: var(--text-secondary); font-size: 0.9rem; text-transform: uppercase; letter-spacing: 1px;">Judges</div>
      </div>
    </div>
  `;

  // Detailed stats by hall
  const detailedStatsDiv = document.getElementById('detailed-stats');
  if (data.byHall && data.byHall.length > 0) {
    detailedStatsDiv.innerHTML = `
      <table style="width: 100%; border-collapse: collapse; font-size: 0.95rem;">
        <thead>
          <tr style="background: var(--background);">
            <th style="padding: 12px 15px; text-align: left; font-weight: 600; border-bottom: 2px solid var(--primary-color);">Hall</th>
            <th style="padding: 12px 15px; text-align: center; font-weight: 600; border-bottom: 2px solid var(--primary-color);">Teams</th>
            <th style="padding: 12px 15px; text-align: center; font-weight: 600; border-bottom: 2px solid var(--primary-color);">Submitted</th>
            <th style="padding: 12px 15px; text-align: center; font-weight: 600; border-bottom: 2px solid var(--primary-color);">Evaluated</th>
          </tr>
        </thead>
        <tbody>
          ${data.byHall.map(hall => `
            <tr style="border-bottom: 1px solid var(--border);">
              <td style="padding: 12px 15px; font-weight: 600;">Hall ${hall.hall}</td>
              <td style="padding: 12px 15px; text-align: center;">${hall.teams_count}</td>
              <td style="padding: 12px 15px; text-align: center;">${hall.submitted_count}</td>
              <td style="padding: 12px 15px; text-align: center;">${hall.evaluated_count}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  } else {
    detailedStatsDiv.innerHTML = '<p>No hall statistics available.</p>';
  }
}

async function loadTeams() {
  const loadingDiv = document.getElementById('teams-loading');
  const teamsContainer = document.getElementById('teams-container');

  try {
    const response = await fetch('/api/admin/teams', {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!response.ok) {
      if (response.status === 401) {
        localStorage.clear();
        window.location.href = 'login.html';
        return;
      }
      throw new Error('Failed to load teams');
    }

    const teams = await response.json();

    if (teams.length === 0) {
      loadingDiv.textContent = 'No teams found.';
      return;
    }

    loadingDiv.style.display = 'none';
    teamsContainer.style.display = 'grid';
    teamsContainer.innerHTML = '';

    // Teams are already sorted by average_score DESC from API
    // Mark top 5 as winners
    teams.forEach((team, index) => {
      const isWinner = index < 5 && parseFloat(team.average_score) > 0;
      const teamCard = document.createElement('div');
      teamCard.className = 'team-card';
      
      // Add winner styling
      if (isWinner) {
        teamCard.style.borderLeft = '4px solid #d4af37';
        teamCard.style.background = 'linear-gradient(135deg, #fffef5 0%, #fff 100%)';
      }

      const avgScore = parseFloat(team.average_score) || 0;
      const evalCount = parseInt(team.evaluation_count) || 0;
      
      // Convert to /100 scale
      const avgScoreOutOf100 = (avgScore * 10).toFixed(1);
      
      const rankBadge = isWinner ? getRankBadge(index + 1) : '';

      teamCard.innerHTML = `
        ${rankBadge}
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px;">
          <h3 style="margin: 0;">${team.name}</h3>
          <span style="background: var(--primary-color); color: white; padding: 2px 8px; border-radius: 4px; font-size: 0.8rem;">Hall ${team.hall}</span>
        </div>
        <div style="font-size: 0.9rem; color: var(--text-secondary); margin-bottom: 12px;">
          <p style="margin: 4px 0;"><strong>Status:</strong> ${team.submitted_at ? '<span style="color: var(--success-color);">Submitted</span>' : '<span style="color: var(--warning-color);">Pending</span>'}</p>
          ${team.submitted_at ? `<p style="margin: 4px 0;"><strong>Date:</strong> ${new Date(team.submitted_at).toLocaleDateString()}</p>` : ''}
          <p style="margin: 4px 0;"><strong>Evaluations:</strong> ${evalCount}</p>
        </div>
        <div style="padding: 12px; background: ${isWinner ? 'rgba(212, 175, 55, 0.1)' : 'var(--background)'}; border-radius: 6px; text-align: center;">
          <div style="font-size: 0.75rem; text-transform: uppercase; letter-spacing: 1px; color: var(--text-secondary); margin-bottom: 4px;">Average Score</div>
          <div style="font-size: 1.8rem; font-weight: 700; color: ${isWinner ? '#d4af37' : 'var(--primary-color)'};">${avgScoreOutOf100}<span style="font-size: 1rem; color: var(--text-secondary);">/100</span></div>
        </div>
        <a href="team-details.html?teamId=${team.id}" class="btn btn-block btn-secondary" style="margin-top: 12px;">
          View Details
        </a>
      `;
      teamsContainer.appendChild(teamCard);
    });
  } catch (error) {
    console.error('Error loading teams:', error);
    loadingDiv.innerHTML = '<p class="error">Failed to load teams. Please refresh.</p>';
  }
}

function getRankBadge(rank) {
  const badges = {
    1: { text: '1st', color: '#d4af37' },
    2: { text: '2nd', color: '#a8a8a8' },
    3: { text: '3rd', color: '#cd7f32' },
    4: { text: '4th', color: '#2563eb' },
    5: { text: '5th', color: '#2563eb' }
  };
  
  const badge = badges[rank];
  return `
    <div style="position: absolute; top: -8px; right: -8px; background: ${badge.color}; color: #fff; width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 0.75rem; box-shadow: 0 2px 8px rgba(0,0,0,0.15);">
      ${badge.text}
    </div>
  `;
}
