const token = localStorage.getItem('token');
const urlParams = new URLSearchParams(window.location.search);
const teamId = urlParams.get('teamId');

if (!token || !teamId) {
  window.location.href = 'login.html';
}

document.addEventListener('DOMContentLoaded', async () => {
  try {
    const response = await fetch(`/api/admin/teams/${teamId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    const data = await response.json();

    if (response.ok) {
      displayTeamDetails(data);
    } else {
      document.getElementById('loading').innerHTML = `
        <div class="message error">❌ ${data.message}</div>
      `;
    }
  } catch (error) {
    document.getElementById('loading').innerHTML = `
      <div class="message error">❌ Failed to load team details</div>
    `;
    console.error('Error loading team details:', error);
  }
});

function displayTeamDetails(data) {
  const { team, evaluations, detailedScores } = data;

  // Hide loading, show content
  document.getElementById('loading').style.display = 'none';
  document.getElementById('team-info').style.display = 'block';

  // Team info
  document.getElementById('team-name').textContent = team.name;
  document.getElementById('team-hall').textContent = team.hall;
  document.getElementById('team-status').innerHTML = team.submitted_at 
    ? '<span style="color: var(--success-color); font-weight: 600;">Submitted</span>' 
    : '<span style="color: var(--warning-color); font-weight: 600;">Pending</span>';
  document.getElementById('submitted-at').textContent = team.submitted_at ? new Date(team.submitted_at).toLocaleString() : 'N/A';

  // Calculate average score (only from actual evaluations)
  const evaluatedScores = evaluations.filter(e => e.total_score !== null && e.evaluation_id !== null);
  const averageScore = evaluatedScores.length > 0
    ? ((evaluatedScores.reduce((sum, e) => sum + parseFloat(e.total_score), 0) / evaluatedScores.length) * 10).toFixed(1)
    : 'N/A';
  document.getElementById('average-score').textContent = averageScore !== 'N/A' ? `${averageScore}/100` : 'N/A';

  // Evaluations list
  const evaluationsList = document.getElementById('evaluations-list');
  evaluationsList.innerHTML = '';

  // Filter only judges who actually evaluated
  const actualEvaluations = evaluations.filter(e => e.evaluation_id !== null);
  
  if (actualEvaluations.length === 0) {
    evaluationsList.innerHTML = '<p>No evaluations yet.</p>';
  } else {
    actualEvaluations.forEach(eval => {
      const evalDiv = document.createElement('div');
      evalDiv.className = 'evaluation-item';
      // Convert to /100 scale
      const score = eval.total_score ? (parseFloat(eval.total_score) * 10).toFixed(1) : 'N/A';
      evalDiv.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 15px; border: 1px solid var(--border); border-radius: 8px; margin-bottom: 10px; background: var(--card-bg);">
          <div>
            <strong>${eval.judge_name}</strong>
            <br>
            <small style="color: var(--text-secondary);">Hall ${eval.judge_hall}</small>
          </div>
          <div style="display: flex; align-items: center; gap: 15px;">
            <div style="text-align: right;">
              <div style="font-size: 1.2rem; font-weight: bold; color: var(--success-color);">
                ${score !== 'N/A' ? score + '/100' : 'N/A'}
              </div>
            </div>
            <button 
              class="btn btn-danger delete-eval-btn" 
              style="padding: 8px 16px; font-size: 0.9rem;"
              data-evaluation-id="${eval.evaluation_id}"
              data-judge-name="${eval.judge_name}"
              data-team-id="${teamId}"
              title="حذف تقييم هذا الحكم">
              🗑️ حذف التقييم
            </button>
          </div>
        </div>
      `;
      evaluationsList.appendChild(evalDiv);
    });
    
    // Add event listeners to delete buttons
    document.querySelectorAll('.delete-eval-btn').forEach(btn => {
      btn.addEventListener('click', function() {
        const evaluationId = this.getAttribute('data-evaluation-id');
        const judgeName = this.getAttribute('data-judge-name');
        const teamId = this.getAttribute('data-team-id');
        deleteEvaluation(evaluationId, judgeName, teamId);
      });
    });
  }

  // Criteria breakdown
  const criteriaBreakdown = document.getElementById('criteria-breakdown');
  criteriaBreakdown.innerHTML = '';

  // Filter out null scores (from judges who haven't evaluated)
  const actualScores = detailedScores.filter(s => s.score !== null && s.criterion_name !== null);

  if (actualScores.length === 0) {
    criteriaBreakdown.innerHTML = '<p>No detailed scores available.</p>';
  } else {
    // Group by criterion
    const criteriaMap = {};
    actualScores.forEach(score => {
      if (!criteriaMap[score.criterion_name]) {
        criteriaMap[score.criterion_name] = [];
      }
      criteriaMap[score.criterion_name].push(score);
    });

    Object.entries(criteriaMap).forEach(([criterionName, scores]) => {
      const criterionDiv = document.createElement('div');
      criterionDiv.style.marginBottom = '20px';
      criterionDiv.innerHTML = `
        <h4 style="margin-bottom: 10px; color: var(--primary-color);">${criterionName}</h4>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 10px;">
          ${scores.map(score => `
            <div style="background: var(--background); padding: 10px; border-radius: 6px; border: 1px solid var(--border);">
              <div style="font-weight: 600;">${score.judge_name}</div>
              <div style="color: var(--success-color); font-weight: bold;">
                ${parseFloat(score.score).toFixed(1)}/10 (${score.weight}%)
              </div>
            </div>
          `).join('')}
        </div>
      `;
      criteriaBreakdown.appendChild(criterionDiv);
    });
  }
}

async function deleteEvaluation(evaluationId, judgeName, teamId) {
  if (!evaluationId || !judgeName) {
    alert('❌ معلومات غير صحيحة');
    return;
  }

  if (!confirm(`هل أنت متأكد من حذف تقييم الحكم "${judgeName}" من هذا الفريق؟\nسيتم إعادة حساب متوسط الفريق تلقائياً.`)) {
    return;
  }

  try {
    console.log('Deleting evaluation:', { evaluationId, judgeName, teamId });
    
    const response = await fetch(`/api/admin/evaluations/${evaluationId}`, {
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
      alert('✅ تم حذف التقييم بنجاح! سيتم تحديث الصفحة...');
      // Reload page to show updated data
      setTimeout(() => {
        window.location.reload();
      }, 500);
    } else {
      alert(`❌ خطأ (${response.status}): ${data.message || 'فشل حذف التقييم'}`);
    }
  } catch (error) {
    console.error('Error deleting evaluation:', error);
    alert(`❌ حدث خطأ أثناء حذف التقييم: ${error.message || 'يرجى المحاولة مرة أخرى'}`);
  }
}