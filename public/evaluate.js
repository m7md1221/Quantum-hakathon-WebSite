const token = localStorage.getItem('token');
const urlParams = new URLSearchParams(window.location.search);
const teamId = urlParams.get('teamId');

if (!token || !teamId) {
  window.location.href = 'login.html';
}
const mode = urlParams.get('mode'); // edit | view

// Get maximum score for a criterion based on its field name
function getMaxScore(fieldName) {
  switch (fieldName) {
    case 'problem_importance':
    case 'ai_quantum_use':
    case 'innovation':
    case 'social_impact':
      return 15; // Criteria with 15% weight
    case 'sdgs':
    case 'code_quality':
    case 'performance':
    case 'presentation':
      return 10; // Criteria with 10% weight
    default:
      return 10; // Default fallback
  }
}

// Ensure hidden inputs are synced/clamped from typed display inputs
function syncScoresFromDisplays() {
  const fields = [
    'problem_importance',
    'ai_quantum_use',
    'sdgs',
    'innovation',
    'social_impact',
    'performance',
    'presentation'
  ];

  fields.forEach((fieldName) => {
    const hiddenInput = document.getElementById(fieldName);
    const displayInput = document.getElementById(fieldName + '-display');
    if (!hiddenInput || !displayInput) return;

    const maxScore = getMaxScore(fieldName);
    let value = parseFloat(displayInput.value);

    // Treat empty/invalid as 0
    if (!Number.isFinite(value)) value = 0;

    // Clamp to [0, maxScore] and round to integer (your UI increments by 1)
    value = Math.round(Math.max(0, Math.min(value, maxScore)));

    displayInput.value = value;
    hiddenInput.value = value;

    if (typeof updateButtonStates === 'function') {
      updateButtonStates(fieldName, value);
    }
  });

  // Special handling for code_quality (auto-populated from Clean Code)
  const codeQualityDisplay = document.getElementById('code_quality-display');
  const codeQualityInput = document.getElementById('code_quality');
  if (codeQualityDisplay && codeQualityInput) {
    const displayText = codeQualityDisplay.textContent; // e.g., "7/10"
    const scoreValue = parseInt(displayText.split('/')[0]); // Extract "7"
    if (!isNaN(scoreValue)) {
      codeQualityInput.value = scoreValue;
    }
  }
}

// Helper function to update button states based on current score
function updateButtonStates(fieldName, score) {
  const minusBtn = document.querySelector(`.score-btn.minus[data-field="${fieldName}"]`);
  const plusBtn = document.querySelector(`.score-btn.plus[data-field="${fieldName}"]`);
  const maxScore = getMaxScore(fieldName);

  if (minusBtn) minusBtn.disabled = score <= 0;
  if (plusBtn) plusBtn.disabled = score >= maxScore;
}

// Load team name and evaluation scores on page load
document.addEventListener('DOMContentLoaded', async () => {
  try {
    // Load team name
    const response = await fetch('/api/judge/teams', {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (response.ok) {
      const teams = await response.json();
      const team = teams.find(t => t.id == teamId);
      if (team) {
        document.getElementById('team-name').textContent = `Evaluating: ${team.name}`;

        // Populate team number if available
        if (team.team_number) {
          const numSpan = document.getElementById('team-number');
          const numContainer = document.getElementById('team-number-container');
          if (numSpan && numContainer) {
            numSpan.textContent = team.team_number;
            numContainer.style.display = 'block';
          }
        }

        // Handle GitHub button visibility and logic
        const githubBtn = document.getElementById('download-project-btn');
        if (team.submitted_at) {
          githubBtn.style.display = 'block';
          githubBtn.addEventListener('click', () => openProjectRepository());
          
          // Load Clean Code score
          loadCleanCodeScore();
        }
      }
    }

    // If in view mode, fetch and populate existing evaluation scores
    if (mode === 'view') {
      try {
        const evalResponse = await fetch(`/api/judge/team-evaluation?teamId=${teamId}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });

        if (evalResponse.ok) {
          const data = await evalResponse.json();
          const scores = data.scores || {};

          // Populate each input field with saved scores
          Object.keys(scores).forEach(criterionKey => {
            const input = document.getElementById(criterionKey);
            const display = document.getElementById(criterionKey + '-display');
            if (input) {
              input.value = scores[criterionKey];
              if (display) {
                display.value = scores[criterionKey];
              }
              // Update button states
              updateButtonStates(criterionKey, scores[criterionKey]);
            }
          });
        } else if (evalResponse.status === 404) {
          // Evaluation doesn't exist yet - this is normal for teams not yet evaluated
          const errorData = await evalResponse.json().catch(() => ({}));
          console.log('No evaluation found for this team:', errorData.message || 'Evaluation not found');
          // Leave inputs empty/disabled in view mode
        } else {
          const errorText = await evalResponse.text().catch(() => evalResponse.statusText);
          console.error('Error fetching evaluation:', evalResponse.status, errorText);
        }
      } catch (error) {
        console.error('Error loading evaluation scores:', error);
      }

      // Disable all inputs and hide submit button in view mode
      document.querySelectorAll('#evaluationForm input, #evaluationForm textarea').forEach(el => el.disabled = true);
      document.querySelectorAll('.score-btn').forEach(btn => btn.disabled = true);
      document.querySelectorAll('.score-display').forEach(input => input.disabled = true);
      const submitButton = document.querySelector('#evaluationForm button[type="submit"]');
      if (submitButton) {
        submitButton.style.display = 'none';
      }
    }
  } catch (error) {
    console.error('Error loading team info:', error);
  }
});
// Open confirmation modal with summary of all fields
function openConfirmModal() {
  // Make sure any typed values are committed before showing modal
  syncScoresFromDisplays();

  const fields = [
    { id: 'problem_importance', label: 'Problem & Importance' },
    { id: 'ai_quantum_use', label: 'AI/Quantum Use' },
    { id: 'sdgs', label: 'SDGs' },
    { id: 'innovation', label: 'Innovation' },
    { id: 'social_impact', label: 'Social Impact' },
    { id: 'code_quality', label: 'Code Quality' },
    { id: 'performance', label: 'Performance' },
    { id: 'presentation', label: 'Presentation' }
  ];

  let summaryHtml = '<div class="modal-summary">';

  fields.forEach(field => {
    const value = document.getElementById(field.id)?.value || 0;
    const maxScore = getMaxScore(field.id);
    summaryHtml += `<p>${field.label}: <span>${value} / ${maxScore}</span></p>`;
  });

  summaryHtml += '</div>';
  summaryHtml += `
    <div class="warning-text">
       <strong>Warning:</strong> Once you confirm, you cannot modify this evaluation.
    </div>
    <div class="modal-actions">
      <button onclick="confirmFinalEvaluation()" class="btn btn-success">Confirm Final</button>
      <button onclick="closeModal()" class="btn btn-secondary">Cancel</button>
    </div>
  `;

  document.getElementById('confirmBody').innerHTML = summaryHtml;
  document.getElementById('confirmModal').style.display = 'block';
}

// Confirm and submit final evaluation
async function confirmFinalEvaluation() {
  // Final safety sync before POST (handles cases where blur didn't fire)
  // This now includes special handling for code_quality
  syncScoresFromDisplays();

  const formData = new FormData(document.getElementById('evaluationForm'));
  const scores = {};
  for (let [key, value] of formData.entries()) {
    const n = parseFloat(value);
    scores[key] = Number.isFinite(n) ? n : 0;
  }

  const submitBtn = document.querySelector('.modal-actions .btn-success');
  const originalText = submitBtn.textContent;
  submitBtn.textContent = 'Submitting...';
  submitBtn.disabled = true;

  try {
    const response = await fetch('/api/judge/finalize-evaluation', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ teamId: parseInt(teamId), scores, is_final: true })
    });

    // تحقق من Content-Type قبل محاولة تحويله لـ JSON
    const contentType = response.headers.get('content-type');
    let data = {};
    if (contentType && contentType.includes('application/json')) {
      data = await response.json();
    } else {
      // لو السيرفر رجع HTML (مثلاً 401 أو 404)
      const text = await response.text();
      console.error('Server returned non-JSON response:', text);
      throw new Error('Server did not return valid JSON');
    }

    if (response.ok) {
      // نجاح → رجوع للدashboard
      window.location.href = 'judge-dashboard.html';
    } else {
      alert(data.message || 'Submission failed');
      submitBtn.textContent = originalText;
      submitBtn.disabled = false;
    }
  } catch (error) {
    console.error('Submission error:', error);
    alert(`An error occurred while submitting evaluation: ${error.message}`);
    submitBtn.textContent = originalText;
    submitBtn.disabled = false;
  }
}

function closeModal() {
  document.getElementById('confirmModal').style.display = 'none';
}


document.getElementById('evaluationForm').addEventListener('submit', (e) => {
  e.preventDefault();
  // Only show confirmation modal for new evaluations (not in view mode)
  if (mode !== 'view') {
    openConfirmModal();
  }
});

async function loadCleanCodeScore() {
  try {
    const response = await fetch(`/api/judge/projects/${teamId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!response.ok) {
      console.error('Failed to load clean code score');
      return;
    }

    const data = await response.json();
    
    // Update UI elements
    const scoreEl = document.getElementById('clean-code-score');
    const errorsEl = document.getElementById('clean-code-errors');
    const warningsEl = document.getElementById('clean-code-warnings');
    const statusEl = document.getElementById('clean-code-status');
    const messageEl = document.getElementById('clean-code-message');
    const codeQualityDisplay = document.getElementById('code_quality-display');
    const codeQualityInput = document.getElementById('code_quality');

    if (data.clean_code_score !== null && data.clean_code_score !== undefined) {
      scoreEl.textContent = data.clean_code_score + '/100';
      scoreEl.style.color = data.clean_code_score >= 70 ? '#059669' : data.clean_code_score >= 50 ? '#f59e0b' : '#dc2626';
      errorsEl.textContent = data.eslint_error_count ?? 0;
      warningsEl.textContent = data.eslint_warning_count ?? 0;
      statusEl.textContent = '✅ Evaluated';
      statusEl.style.color = '#059669';
      
      // Convert 100-point score to 10-point scale
      const scoreOutOf10 = Math.round((data.clean_code_score / 100) * 10);
      codeQualityDisplay.textContent = scoreOutOf10 + '/10';
      codeQualityInput.value = scoreOutOf10;
      
      if (data.last_evaluated_at) {
        const date = new Date(data.last_evaluated_at);
        messageEl.textContent = `Last evaluated: ${date.toLocaleString()}`;
        messageEl.style.display = 'block';
      }
    } else {
      scoreEl.textContent = 'N/A';
      scoreEl.style.color = '#6b7280';
      errorsEl.textContent = '-';
      warningsEl.textContent = '-';
      codeQualityDisplay.textContent = '0/10';
      codeQualityInput.value = 0;
      
      if (data.clean_code_status === 'pending') {
        statusEl.textContent = '⏳ Pending';
        statusEl.style.color = '#f59e0b';
        messageEl.textContent = 'Evaluation in progress...';
        messageEl.style.display = 'block';
      } else if (data.clean_code_status === 'failed') {
        statusEl.textContent = '❌ Failed';
        statusEl.style.color = '#dc2626';
        messageEl.textContent = data.clean_code_failure_reason || 'Evaluation failed';
        messageEl.style.display = 'block';
        messageEl.style.color = '#dc2626';
      } else {
        statusEl.textContent = '⏸️ Not Run';
        statusEl.style.color = '#6b7280';
        messageEl.textContent = 'No ESLint report found. Make sure GitHub Actions workflow is configured.';
        messageEl.style.display = 'block';
      }
    }
  } catch (error) {
    console.error('Error loading clean code score:', error);
  }
}

async function openProjectRepository() {
  const githubBtn = document.getElementById('download-project-btn');
  const originalText = githubBtn.innerHTML;

  try {
    githubBtn.innerHTML = '⌛ Loading...';
    githubBtn.disabled = true;

    const response = await fetch(`/api/judge/projects/${teamId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.message || 'Failed to get project URL');
    }

    const { github_url } = await response.json();

    if (!github_url) {
      throw new Error('Project URL not available');
    }

    // Open GitHub repository in a new tab
    window.open(github_url, '_blank');

  } catch (error) {
    console.error('Error opening project:', error);
    alert(`Failed to open project: ${error.message}`);
  } finally {
    githubBtn.innerHTML = originalText;
    githubBtn.disabled = false;
  }
}