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
    'code_quality',
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

        // Handle download button visibility and logic
        const downloadBtn = document.getElementById('download-project-btn');
        if (team.submitted_at) {
          downloadBtn.style.display = 'block';
          downloadBtn.addEventListener('click', () => downloadProject());
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
    summaryHtml += `<p>${field.label}: <span>${value}</span></p>`;
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

async function downloadProject() {
  const downloadBtn = document.getElementById('download-project-btn');
  const originalText = downloadBtn.innerHTML;

  try {
    downloadBtn.innerHTML = '⌛ Preparing...';
    downloadBtn.disabled = true;

    const response = await fetch(`/api/judge/projects/${teamId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.message || 'Failed to generate download link');
    }

    const { signedUrl } = await response.json();

    // Trigger download using a hidden anchor tag for better cross-browser support
    const a = document.createElement('a');
    a.href = signedUrl;
    // Cloudinary signed URLs for raw files should automatically trigger download, 
    // but we can hint at it. The 'download' attribute might be ignored for cross-origin,
    // but the signed URL usually carries the correct headers.
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
    }, 100);

  } catch (error) {
    console.error('Download error:', error);
    alert(`Download failed: ${error.message}`);
  } finally {
    downloadBtn.innerHTML = originalText;
    downloadBtn.disabled = false;
  }
}