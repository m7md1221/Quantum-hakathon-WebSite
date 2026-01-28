const token = localStorage.getItem('token');

if (!token) {
  window.location.href = 'login.html';
}

document.addEventListener('DOMContentLoaded', async () => {
  await loadStats();
  await loadTeams();
  await loadJudges();

  // Refresh button
  document.getElementById('refresh-btn').addEventListener('click', async () => {
    await loadStats();
    await loadTeams();
    await loadJudges();
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

    // Clear container and ensure it's visible, but we won't use grid directly on it anymore
    // We will append hall sections to it.
    teamsContainer.style.display = 'block';
    teamsContainer.className = ''; // Remove grid class from main container
    teamsContainer.innerHTML = '';

    // Group teams by Hall
    const teamsByHall = { 'A': [], 'B': [], 'C': [], 'D': [] };

    teams.forEach(team => {
      const hall = team.hall || 'A'; // Default to A just in case
      if (teamsByHall[hall]) {
        teamsByHall[hall].push(team);
      }
    });

    // Create Accordion Sections
    ['A', 'B', 'C', 'D'].forEach(hall => {
      const hallTeams = teamsByHall[hall];
      const hallSection = document.createElement('div');
      hallSection.className = 'hall-section';

      // Calculate statistics for this hall
      const submittedCount = hallTeams.filter(t => t.submitted_at).length;
      const evaluatedCount = hallTeams.filter(t => parseInt(t.evaluation_count) > 0).length;

      // Header
      const header = document.createElement('div');
      header.className = 'hall-header';
      header.innerHTML = `
        <div class="hall-header-content">
          <div class="hall-title-section">
            <h3 class="hall-title">القاعة ${hall}</h3>
            <span class="hall-subtitle">Hall ${hall}</span>
          </div>
          <div class="hall-stats">
            <div class="hall-stat-item">
              <span class="hall-stat-number">${hallTeams.length}</span>
              <span class="hall-stat-label">فرق</span>
            </div>
            <div class="hall-stat-item">
              <span class="hall-stat-number">${submittedCount}</span>
              <span class="hall-stat-label">مقدمة</span>
            </div>
            <div class="hall-stat-item">
              <span class="hall-stat-number">${evaluatedCount}</span>
              <span class="hall-stat-label">مقيمة</span>
            </div>
          </div>
        </div>
        <div class="hall-toggle-section">
          <span class="hall-toggle-text">عرض الفرق</span>
          <span class="hall-toggle-icon">▶</span>
        </div>
      `;

      // Content Container
      const content = document.createElement('div');
      content.className = 'hall-content';

      // Create wrapper for grid
      const contentWrapper = document.createElement('div');
      contentWrapper.className = 'hall-teams-grid';

      // Render Cards
      if (hallTeams.length === 0) {
        contentWrapper.innerHTML = '<p class="hall-empty-message">لا توجد فرق في هذه القاعة</p>';
      } else {
        hallTeams.forEach((team) => {
          const globalIndex = teams.findIndex(t => t.id === team.id);
          const isWinner = globalIndex < 5 && parseFloat(team.average_score) > 0;

          const teamCard = createTeamCard(team, isWinner, globalIndex + 1);
          contentWrapper.appendChild(teamCard);
        });
      }

      content.appendChild(contentWrapper);

      // Event Listener for Toggle
      header.addEventListener('click', () => {
        const isOpen = content.classList.contains('open');

        // Close all others
        document.querySelectorAll('.hall-content').forEach(c => c.classList.remove('open'));
        document.querySelectorAll('.hall-header').forEach(h => h.classList.remove('active'));

        if (!isOpen) {
          content.classList.add('open');
          header.classList.add('active');
        }
      });

      hallSection.appendChild(header);
      hallSection.appendChild(content);
      teamsContainer.appendChild(hallSection);
    });

  } catch (error) {
    console.error('Error loading teams:', error);
    loadingDiv.innerHTML = '<p class="error">Failed to load teams. Please refresh.</p>';
  }
}

function createTeamCard(team, isWinner, rank) {
  const teamCard = document.createElement('div');
  teamCard.className = 'team-card';

  if (isWinner) {
    teamCard.style.borderLeft = '4px solid #d4af37';
    teamCard.style.background = 'linear-gradient(135deg, #fffef5 0%, #fff 100%)';
  }

  const avgScore = parseFloat(team.average_score) || 0;
  const evalCount = parseInt(team.evaluation_count) || 0;
  const avgScoreOutOf100 = avgScore.toFixed(1);

  const rankBadge = isWinner ? getRankBadge(rank) : '';

  teamCard.innerHTML = `
    ${rankBadge}
    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px;">
      <h3 style="margin: 0;">
  الفريق رقم ${team.team_number ?? '-'}
</h3>

    </div>
    <div style="font-size: 0.9rem; color: var(--text-secondary); margin-bottom: 12px;">
      <p style="margin: 4px 0;"><strong>Status:</strong> ${team.submitted_at ? '<span style="color: var(--success-color);">Submitted</span>' : '<span style="color: var(--warning-color);">Pending</span>'}</p>
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
  return teamCard;
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

async function loadJudges() {
  const loadingDiv = document.getElementById('judges-loading');
  const judgesContainer = document.getElementById('judges-container');

  try {
    const response = await fetch('/api/admin/judges', {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!response.ok) {
      if (response.status === 401) {
        localStorage.clear();
        window.location.href = 'login.html';
        return;
      }
      throw new Error('Failed to load judges');
    }

    const judges = await response.json();

    if (judges.length === 0) {
      loadingDiv.innerHTML = '<p style="text-align: center; color: var(--text-secondary);">No judges found.</p>';
      return;
    }

    loadingDiv.style.display = 'none';
    judgesContainer.style.display = 'block';
    judgesContainer.innerHTML = '';

    // Group judges by hall
    const judgesByHall = {};
    judges.forEach(judge => {
      if (!judgesByHall[judge.hall]) {
        judgesByHall[judge.hall] = [];
      }
      judgesByHall[judge.hall].push(judge);
    });

    Object.keys(judgesByHall).sort().forEach(hall => {
      const hallSection = document.createElement('div');
      hallSection.className = 'hall-section';

      // Header
      const header = document.createElement('div');
      header.className = 'hall-header';
      header.innerHTML = `
    <div class="hall-header-content">
      <div class="hall-title-section">
        <h3 class="hall-title">القاعة ${hall}</h3>
        <span class="hall-subtitle">Hall ${hall}</span>
      </div>
      <div class="hall-stats">
        <div class="hall-stat-item">
          <span class="hall-stat-number">${judgesByHall[hall].length}</span>
          <span class="hall-stat-label">حكام</span>
        </div>
      </div>
    </div>
    <div class="hall-toggle-section">
      <span class="hall-toggle-text">عرض الحكام</span>
      <span class="hall-toggle-icon">▶</span>
    </div>
  `;

      // Content
      const content = document.createElement('div');
      content.className = 'hall-content';

      const judgesGrid = document.createElement('div');
      judgesGrid.className = 'grid grid-3';
      judgesGrid.style.gap = '15px';

      judgesByHall[hall].forEach(judge => {
        const judgeCard = document.createElement('div');
        judgeCard.className = 'judge-card';
        judgeCard.style.padding = '20px';

        const deleteBtnId = `delete-btn-${judge.id}`;

        judgeCard.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px;">
        <div>
          <h3 style="margin:0;color:var(--primary-color);">${judge.name}</h3>
          <p style="margin:0;color:var(--text-secondary);font-size:0.85rem;">
            Hall ${judge.hall}
          </p>
        </div>
        <span class="status-badge ${judge.evaluation_count > 0 ? 'status-evaluated' : 'status-pending'}">
          ${judge.evaluation_count} تقييم
        </span>
      </div>

      ${judge.evaluation_count > 0
            ? `<button id="${deleteBtnId}" class="btn btn-block btn-danger">
              🗑️ حذف جميع التقييمات
            </button>`
            : `<button disabled class="btn btn-block btn-secondary">
              لا توجد تقييمات
            </button>`
          }
    `;

        if (judge.evaluation_count > 0) {
          judgeCard.querySelector(`#${deleteBtnId}`)
            .addEventListener('click', () => {
              deleteAllJudgeEvaluations(
                judge.id,
                judge.name,
                judge.evaluation_count
              );
            });
        }

        judgesGrid.appendChild(judgeCard);
      });

      content.appendChild(judgesGrid);

      // Toggle behavior (زي Teams)
      header.addEventListener('click', () => {
        const isOpen = content.classList.contains('open');

        document.querySelectorAll('#judges-container .hall-content')
          .forEach(c => c.classList.remove('open'));
        document.querySelectorAll('#judges-container .hall-header')
          .forEach(h => h.classList.remove('active'));

        if (!isOpen) {
          content.classList.add('open');
          header.classList.add('active');
        }
      });

      hallSection.appendChild(header);
      hallSection.appendChild(content);
      judgesContainer.appendChild(hallSection);
    });


  } catch (error) {
    console.error('Error loading judges:', error);
    loadingDiv.innerHTML = '<p class="error">Failed to load judges. Please refresh.</p>';
  }
}

async function deleteAllJudgeEvaluations(judgeId, judgeName, evaluationCount) {
  if (!judgeId || !judgeName) {
    alert('❌ معلومات غير صحيحة');
    return;
  }

  if (!confirm(`⚠️ تحذير: هل أنت متأكد من حذف جميع تقييمات الحكم "${judgeName}"؟\n\nسيتم حذف ${evaluationCount} تقييم من جميع الفرق.\nسيتم إعادة حساب متوسطات جميع الفرق تلقائياً.\n\nهذا الإجراء لا يمكن التراجع عنه!`)) {
    return;
  }

  try {
    console.log('Deleting all evaluations for judge:', { judgeId, judgeName, evaluationCount });

    const response = await fetch(`/api/admin/judges/${judgeId}/evaluations`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    console.log('Response status:', response.status);
    console.log('Response headers:', response.headers);

    let data;
    const contentType = response.headers.get('content-type');

    if (contentType && contentType.includes('application/json')) {
      try {
        data = await response.json();
        console.log('Response data:', data);
      } catch (e) {
        console.error('Error parsing JSON:', e);
        const text = await response.text();
        console.error('Response text:', text);
        data = { message: `Server error: ${text || 'Invalid response'}` };
      }
    } else {
      const text = await response.text();
      console.error('Non-JSON response:', text);
      data = { message: `Server returned: ${text || 'Unknown error'}` };
    }

    if (response.ok) {
      alert(`✅ تم حذف ${data.deletedCount || evaluationCount} تقييم بنجاح!\nسيتم تحديث الصفحة...`);
      // Reload all data
      await loadStats();
      await loadTeams();
      await loadJudges();
    } else {
      alert(`❌ خطأ (${response.status}): ${data.message || 'فشل حذف التقييمات'}`);
    }
  } catch (error) {
    console.error('Error deleting evaluations:', error);
    alert(`❌ حدث خطأ أثناء حذف التقييمات: ${error.message || 'يرجى المحاولة مرة أخرى'}`);
  }
}
