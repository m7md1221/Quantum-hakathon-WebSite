// Admin Score Editing Functionality

const API_BASE = window.location.origin + '/api';
let allTeams = [];
let currentEditingScore = null;
let currentMaxScore = 10;
let selectedTeamId = null;

// Load all teams for the dropdown
async function loadTeamsForScoreEdit() {
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
    
    allTeams = await response.json();
    renderTeamsInModal();
  } catch (error) {
    console.error('Error loading teams:', error);
  }
}

// Render teams in modal
function renderTeamsInModal(filteredTeams = null) {
  const teamsToShow = filteredTeams || allTeams;
  const container = document.getElementById('teams-list-modal');
  
  // Update header with count
  const modalHeader = document.querySelector('#team-picker-modal h3');
  if (modalHeader) {
    const count = teamsToShow.length;
    const totalCount = allTeams.length;
    if (filteredTeams) {
      modalHeader.textContent = `اختر الفريق (${count} من ${totalCount})`;
    } else {
      modalHeader.textContent = `اختر الفريق (${totalCount} فريق)`;
    }
  }
  
  if (teamsToShow.length === 0) {
    container.innerHTML = '<div style="text-align: center; color: #6b7280; padding: 40px; font-size: 15px;">لا توجد فرق تطابق البحث</div>';
    return;
  }
  
  container.innerHTML = teamsToShow.map(team => `
    <div class="team-picker-card" data-team-id="${team.id}" style="background: white; border: 2px solid #e5e7eb; border-radius: 10px; padding: 15px; margin-bottom: 10px; cursor: pointer; transition: all 0.2s;" 
         onmouseover="this.style.borderColor='#667eea'; this.style.transform='translateY(-2px)'; this.style.boxShadow='0 4px 12px rgba(102,126,234,0.2)'" 
         onmouseout="this.style.borderColor='#e5e7eb'; this.style.transform='translateY(0)'; this.style.boxShadow='none'">
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <div style="flex: 1;">
          <div style="font-size: 18px; font-weight: 700; color: #667eea; margin-bottom: 5px;">فريق #${team.team_number}</div>
          <div style="font-size: 14px; color: #1f2937; margin-bottom: 3px;">${team.name}</div>
          <div style="font-size: 13px; color: #6b7280;">
            <span style="display: inline-block; background: #e0e7ff; color: #3730a3; padding: 2px 8px; border-radius: 12px; font-weight: 600;">Hall ${team.hall}</span>
          </div>
        </div>
        <svg width="24" height="24" fill="#667eea" viewBox="0 0 16 16">
          <path d="M4.646 1.646a.5.5 0 0 1 .708 0l6 6a.5.5 0 0 1 0 .708l-6 6a.5.5 0 0 1-.708-.708L10.293 8 4.646 2.354a.5.5 0 0 1 0-.708z"/>
        </svg>
      </div>
    </div>
  `).join('');
  
  // Add click handlers
  document.querySelectorAll('.team-picker-card').forEach(card => {
    card.addEventListener('click', () => {
      const teamId = card.dataset.teamId;
      selectTeam(teamId);
    });
  });
}

// Select team from modal
function selectTeam(teamId) {
  selectedTeamId = teamId;
  const team = allTeams.find(t => t.id == teamId);
  
  if (team) {
    document.getElementById('selected-team-display').textContent = `#${team.team_number} - ${team.name}`;
    document.getElementById('team-picker-modal').style.display = 'none';
    loadTeamEvaluations(teamId);
  }
}

// Modal controls
document.getElementById('open-team-picker')?.addEventListener('click', () => {
  document.getElementById('team-picker-modal').style.display = 'block';
  document.getElementById('team-search-modal').value = '';
  renderTeamsInModal();
  document.getElementById('team-search-modal').focus();
});

document.getElementById('close-team-picker')?.addEventListener('click', () => {
  document.getElementById('team-picker-modal').style.display = 'none';
});

// Close modal on background click
document.getElementById('team-picker-modal')?.addEventListener('click', (e) => {
  if (e.target.id === 'team-picker-modal') {
    document.getElementById('team-picker-modal').style.display = 'none';
  }
});

// Search functionality
document.getElementById('team-search-modal')?.addEventListener('input', (e) => {
  const searchTerm = e.target.value.toLowerCase().trim();
  
  if (!searchTerm) {
    renderTeamsInModal();
    return;
  }
  
  const filtered = allTeams.filter(team => {
    const teamNumber = String(team.team_number || '');
    const teamName = (team.name || '').toLowerCase();
    return teamNumber.includes(searchTerm) || teamName.includes(searchTerm);
  });
  
  renderTeamsInModal(filtered);
});

// Keyboard support (ESC to close)
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    const modal = document.getElementById('team-picker-modal');
    if (modal && modal.style.display === 'block') {
      modal.style.display = 'none';
    }
  }
});

async function loadTeamEvaluations(teamId) {
  try {
    document.getElementById('team-scores-container').style.display = 'block';
    document.getElementById('scores-loading').style.display = 'block';
    document.getElementById('scores-content').innerHTML = '';
    
    const response = await fetch(`${API_BASE}/admin/team-evaluations/${teamId}`, {
      headers: getAuthHeaders()
    });
    
    if (!response.ok) throw new Error('Failed to load evaluations');
    
    const data = await response.json();
    document.getElementById('scores-loading').style.display = 'none';
    displayTeamScores(data);
  } catch (error) {
    console.error('Error loading team evaluations:', error);
    document.getElementById('scores-loading').innerHTML = `<p class="error-message">خطأ في تحميل التقييمات: ${error.message}</p>`;
  }
}

function displayTeamScores(data) {
  const container = document.getElementById('scores-content');
  const { team, evaluations } = data;
  
  if (evaluations.length === 0) {
    container.innerHTML = '<p>لا توجد تقييمات لهذا الفريق حالياً</p>';
    return;
  }
  
  let html = `<div style="background: #f9f9f9; padding: 15px; border-radius: 4px; margin-bottom: 20px;">
    <h3 style="margin-top: 0;">${team.name} (Hall ${team.hall})</h3>
    <p style="margin: 5px 0; color: #666;">رقم الفريق: ${team.team_number}</p>
  </div>`;
  
  evaluations.forEach(evaluation => {
    // Use the total_score from backend instead of calculating
    const totalScore = parseFloat(evaluation.total_score || 0);
    
    html += `<div style="border: 1px solid #ddd; border-radius: 4px; padding: 15px; margin-bottom: 15px;">
      <h4 style="margin-top: 0; color: #333;">حكم: ${evaluation.judge_name}</h4>
      <p style="color: #666; margin: 5px 0;">Hall: ${evaluation.judge_hall}</p>
      <div style="background: #f0f0f0; padding: 10px; border-radius: 3px; margin: 10px 0;">
        <strong>المجموع: ${totalScore.toFixed(2)}/100</strong>
      </div>
      <table style="width: 100%; border-collapse: collapse;">
        <thead>
          <tr style="background: #f5f5f5;">
            <th style="border: 1px solid #ddd; padding: 8px; text-align: right;">معيار التقييم</th>
            <th style="border: 1px solid #ddd; padding: 8px; text-align: center;">الدرجة</th>
            <th style="border: 1px solid #ddd; padding: 8px; text-align: center;">الوزن</th>
            <th style="border: 1px solid #ddd; padding: 8px; text-align: center;">الإجراء</th>
          </tr>
        </thead>
        <tbody>`;
    
    evaluation.scores.forEach(score => {
      const adminNote = score.admin_note ? `<br><small style="color: #999; font-style: italic;">${score.admin_note}</small>` : '';
      html += `<tr>
        <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">${score.criterion_name}</td>
        <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">
          <strong>${score.score || '-'}</strong>${adminNote}
        </td>
        <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">${score.weight}%</td>
        <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">
          <button class="btn btn-sm btn-primary" onclick="openEditModal(${score.score_id}, '${score.criterion_name}', ${score.score || 0}, '${score.admin_note || ''}', ${score.max_score || 10})">
            تعديل
          </button>
        </td>
      </tr>`;
    });
    
    html += `</tbody></table></div>`;
  });
  
  container.innerHTML = html;
}

function openEditModal(scoreId, criterionName, currentScore, adminNote, maxScore) {
  currentEditingScore = scoreId;
  currentMaxScore = parseFloat(maxScore);
  if (isNaN(currentMaxScore) || currentMaxScore <= 0) {
    currentMaxScore = 10;
  }

  document.getElementById('criterionName').value = criterionName;
  document.getElementById('newScore').value = currentScore;
  document.getElementById('adminNote').value = '';

  const scoreInput = document.getElementById('newScore');
  scoreInput.max = currentMaxScore;

  const scoreLabel = document.querySelector('label[for="newScore"]');
  if (scoreLabel) {
    scoreLabel.textContent = `الدرجة الجديدة (0-${currentMaxScore}):`;
  }

  document.getElementById('editScoreModal').style.display = 'flex';
}

function closeEditModal() {
  document.getElementById('editScoreModal').style.display = 'none';
  currentEditingScore = null;
}

document.getElementById('editScoreForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  if (!currentEditingScore) return;
  
  const newScore = parseFloat(document.getElementById('newScore').value);
  const adminNote = document.getElementById('adminNote').value.trim();
  
  if (isNaN(newScore) || newScore < 0 || newScore > currentMaxScore) {
    alert(`الدرجة يجب أن تكون بين 0 و ${currentMaxScore}`);
    return;
  }
  
  try {
    const response = await fetch(`${API_BASE}/admin/evaluation-scores/${currentEditingScore}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders()
      },
      body: JSON.stringify({
        score: newScore,
        adminNote: adminNote
      })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to update score');
    }
    
    const result = await response.json();
    alert('تم تحديث الدرجة بنجاح!');
    closeEditModal();
    
    // Refresh the page after 1 second
    setTimeout(() => {
      location.reload();
    }, 1000);
  } catch (error) {
    console.error('Error updating score:', error);
    alert(`خطأ في تحديث الدرجة: ${error.message}`);
  }
});

// Load teams when page loads
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    loadTeamsForScoreEdit();
  });
} else {
  loadTeamsForScoreEdit();
}
