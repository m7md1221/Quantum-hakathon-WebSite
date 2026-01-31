// Admin Score Editing Functionality

const API_BASE = 'http://localhost:3000/api';
let allTeams = [];
let currentEditingScore = null;
let currentMaxScore = 10;

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
    populateTeamSelect();
  } catch (error) {
    console.error('Error loading teams:', error);
  }
}

function populateTeamSelect() {
  const select = document.getElementById('team-select-score');
  
  // Clear existing options except the first one
  while (select.options.length > 1) {
    select.remove(1);
  }
  
  allTeams.forEach(team => {
    const option = document.createElement('option');
    option.value = team.id;
    option.textContent = `#${team.team_number} - ${team.name} (Hall ${team.hall})`;
    select.appendChild(option);
  });
}

// Load evaluations for selected team
document.getElementById('team-select-score')?.addEventListener('change', async (e) => {
  const teamId = e.target.value;
  
  if (!teamId) {
    document.getElementById('team-scores-container').style.display = 'none';
    return;
  }
  
  await loadTeamEvaluations(teamId);
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

// Helper function to get auth headers (from auth.js or admin.js)
function getAuthHeaders() {
  const token = localStorage.getItem('token');
  return {
    'Authorization': `Bearer ${token}`
  };
}

// Load teams when page loads
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    loadTeamsForScoreEdit();
  });
} else {
  loadTeamsForScoreEdit();
}
