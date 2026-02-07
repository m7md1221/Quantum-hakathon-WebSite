const token = localStorage.getItem('token');
const urlParams = new URLSearchParams(window.location.search);
const teamId = urlParams.get('teamId');

if (!token || !teamId) {
  goTo('login.html');
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
    // تخزين بيانات الفريق في window ليتمكن loadCleanCodeEvidence من الوصول إليها
    window.lastTeamData = data;
  const { team, evaluations, detailedScores } = data;
  const project = data.team.github_repo_url ? {
    github_repo_url: data.team.github_repo_url,
    clean_code_score: data.team.clean_code_score,
    eslint_error_count: data.team.eslint_error_count,
    eslint_warning_count: data.team.eslint_warning_count,
    clean_code_status: data.team.clean_code_status,
    clean_code_failure_reason: data.team.clean_code_failure_reason,
    last_evaluated_at: data.team.last_evaluated_at
  } : null;

  // Hide loading, show content
  document.getElementById('loading').style.display = 'none';
  document.getElementById('team-info').style.display = 'block';

  // Team info
  document.getElementById('team-name').textContent = team.name;
  
  // Display institution name if available
  const institutionEl = document.getElementById('team-institution');
  console.log('🔍 Team object:', team);
  console.log('🔍 Institution element:', institutionEl);
  console.log('🔍 team.team_institution:', team.team_institution);
  if (institutionEl) {
    const institutionName = team.team_institution || team.institution_name || 'غير متوفر';
    console.log('🔍 Final institution name:', institutionName);
    institutionEl.textContent = institutionName;
  }

  if (team.team_number) {
    const numSpan = document.getElementById('team-num');
    const numContainer = document.getElementById('team-number-container');
    if (numSpan && numContainer) {
      numSpan.textContent = team.team_number;
      numContainer.style.display = 'block';
    }
  }

  document.getElementById('team-hall').textContent = team.hall;
  document.getElementById('team-status').innerHTML = team.submitted_at
    ? '<span style="color: var(--success-color); font-weight: 600;">Submitted</span>'
    : '<span style="color: var(--warning-color); font-weight: 600;">Pending</span>';
  document.getElementById('submitted-at').textContent = team.submitted_at ? new Date(team.submitted_at).toLocaleString() : 'N/A';

  // Project GitHub button only
  const downloadBtn = document.getElementById('download-btn');
  if (team.submitted_at) {
    downloadBtn.style.display = 'block';
    downloadBtn.onclick = () => openProjectRepository(team.id);
    setupRecalcButton(teamId);
    loadCleanCodeEvidence(teamId);
  } else {
    downloadBtn.style.display = 'none';
  }

  // Calculate average score (only from actual evaluations)
  const evaluatedScores = evaluations.filter(e => e.total_score !== null && e.evaluation_id !== null);
  const averageScore = evaluatedScores.length > 0
    ? (evaluatedScores.reduce((sum, e) => sum + parseFloat(e.total_score), 0) / evaluatedScores.length).toFixed(1)
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
    evaluations.filter(e => e.evaluation_id !== null).forEach(evaluation => {
      const evalDiv = document.createElement('div');
      evalDiv.className = 'evaluation-item';
      // Already on /100 scale from backend
      const score = evaluation.total_score ? parseFloat(evaluation.total_score).toFixed(1) : 'N/A';
      evalDiv.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 15px; border: 1px solid var(--border); border-radius: 8px; margin-bottom: 10px; background: var(--card-bg);">
          <div>
            <strong>${evaluation.judge_name}</strong>
            <br>
            <small style="color: var(--text-secondary);">Hall ${evaluation.judge_hall}</small>
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
              data-evaluation-id="${evaluation.evaluation_id}"
              data-judge-name="${evaluation.judge_name}"
              data-team-id="${teamId}"
              title="حذف تقييم هذا الحكم">
               حذف التقييم
            </button>
          </div>
        </div>
      `;
      evaluationsList.appendChild(evalDiv);
    });

    // Add event listeners to delete buttons
    document.querySelectorAll('.delete-eval-btn').forEach(btn => {
      btn.addEventListener('click', function () {
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
                ${parseFloat(score.score).toFixed(1)}/${parseFloat(score.max_score).toFixed(1)} (${score.weight}%)
              </div>
            </div>
          `).join('')}
        </div>
      `;
      criteriaBreakdown.appendChild(criterionDiv);
    });
  }
}

function setupRecalcButton(teamId) {
  const recalcBtn = document.getElementById('recalc-clean-code');
  const statusEl = document.getElementById('recalc-status');
  if (!recalcBtn) return;

  recalcBtn.onclick = async () => {
    recalcBtn.disabled = true;
    if (statusEl) statusEl.textContent = 'Recalculating...';

    try {
      const response = await fetch(`/api/admin/projects/${teamId}/clean-code`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to trigger re-evaluation');
      }

      if (statusEl) statusEl.textContent = 'Recalculation triggered. Checking status...';
      await pollCleanCodeStatus(teamId, statusEl);
    } catch (err) {
      console.error('Recalculate clean code failed:', err);
      if (statusEl) statusEl.textContent = `Failed: ${err.message}`;
    } finally {
      recalcBtn.disabled = false;
    }
  };
}

async function pollCleanCodeStatus(teamId, statusEl, attempts = 10) {
  for (let i = 0; i < attempts; i += 1) {
    try {
      const response = await fetch(`/api/admin/projects/${teamId}/clean-code`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to fetch status');
      }

      const result = await response.json();
      const status = result.clean_code_status || 'pending';

      if (statusEl) statusEl.textContent = `Status: ${status}`;

      if (status === 'success' || status === 'failed') {
        const cleanScoreEl = document.getElementById('clean-code-score');
        const cleanErrorsEl = document.getElementById('clean-errors');
        const cleanWarningsEl = document.getElementById('clean-warnings');

        if (cleanScoreEl) {
          cleanScoreEl.textContent = result.clean_code_score !== null && result.clean_code_score !== undefined
            ? result.clean_code_score + '/100'
            : 'N/A';
        }
        if (cleanErrorsEl) cleanErrorsEl.textContent = result.eslint_error_count ?? '-';
        if (cleanWarningsEl) cleanWarningsEl.textContent = result.eslint_warning_count ?? '-';

        await loadCleanCodeEvidence(teamId);
        return;
      }
    } catch (err) {
      if (statusEl) statusEl.textContent = `Status check failed: ${err.message}`;
      return;
    }

    await new Promise(resolve => setTimeout(resolve, 3000));
  }

  if (statusEl) statusEl.textContent = 'Status check timed out. Please refresh.';
}

async function loadCleanCodeEvidence(teamId) {
  const container = document.getElementById('clean-code-evidence');
  if (!container) return;

  try {
    const response = await fetch(`/api/admin/projects/${teamId}/clean-code`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || 'Failed to load clean code evidence');
    }

    const result = await response.json();
    // محاولة جلب github_repo_url من كائن الفريق إذا لم يكن موجودًا في النتيجة
    if (!result.github_repo_url) {
      // جلب بيانات الفريق من الصفحة (مخزنة في window.lastTeamData عند عرض التفاصيل)
      if (window.lastTeamData && window.lastTeamData.team && window.lastTeamData.team.github_repo_url) {
        result.github_repo_url = window.lastTeamData.team.github_repo_url;
      }
    }
    let report = result.clean_code_report;

    if (typeof report === 'string') {
      try {
        report = JSON.parse(report);
      } catch (_) {
        report = null;
      }
    }

    if (!report) {
      container.innerHTML = '<p>No report available.</p>';
      return;
    }

    // Show CodeFactor grade if present
    if (report.codefactor_grade) {
      // توليد رابط CodeFactor Issues
      let issuesBtnHtml = '';
      if (result.github_repo_url) {
        const repoPath = result.github_repo_url.replace('https://github.com/', '');
        issuesBtnHtml = `<button onclick="window.open('https://www.codefactor.io/repository/github/${repoPath}/issues','_blank')" class="btn btn-primary github-btn-custom" style="margin-top:10px;">View CodeFactor Issues</button>`;
      }
      container.innerHTML = `
        <div style="margin-bottom:12px; padding:10px; border-radius:8px; background: #f8fafc; border:1px solid #e6eef6;">
          <div style="font-weight:700; margin-bottom:6px;">CodeFactor Grade</div>
          <div style="font-size:1.2rem; color:#4f46e5; font-weight:700;">${report.codefactor_grade} → ${report.codefactor_score}/100</div>
            <div style="font-size:13px; color:#374151; margin-top:6px;">Grade extracted automatically from codefactor.io. Mapping: A+=100, A=95, A-=88, B+=85, B=80, B-=78, C+=75, C=70, C-=68, D+=65, D=60, D-=58, E+=55, E=50, F+=40, F=35, F-=30, G+=25, G=20, G-=15, H+=10, H=5, H-=0.</div>
          ${report.error ? `<div style='color:#dc2626; margin-top:8px;'>${report.error}</div>` : ''}
          ${issuesBtnHtml}
        </div>
      `;
      return;
    }

    const tooling = Array.isArray(report.tooling) ? report.tooling : [];
    const notes = Array.isArray(report.notes) ? report.notes : [];
    const metrics = report.metrics || null;

    let html = '';

    // Show metrics summary if present
    if (metrics && metrics.scores) {
      const s = metrics.scores;
      html += `
        <div style="margin-bottom:12px; padding:10px; border-radius:8px; background: #f8fafc; border:1px solid #e6eef6;">
          <div style="font-weight:700; margin-bottom:6px;">Metrics</div>
          <div style="display:flex; gap:12px; flex-wrap:wrap; font-size:13px;">
            <div><strong>Combined:</strong> ${s.combined ?? '-'} /100</div>
            <div><strong>Lint:</strong> ${s.lint ?? '-'} /100</div>
            <div><strong>Maintainability:</strong> ${s.maintainability ?? '-'} /100</div>
            <div><strong>Product:</strong> ${s.product ?? '-'} /100</div>
            <div><strong>Performance:</strong> ${s.performance ?? (s.performance === null ? 'N/A' : '-') } /100</div>
          </div>
        </div>
      `;

      // maintainability details
      if (metrics.maintainability) {
        const m = metrics.maintainability;
        html += `
          <div style="margin-bottom:12px;">
            <strong>Maintainability details:</strong>
            <div style="font-size:13px; color:#374151; margin-top:6px;">
              Files: ${m.fileCount}, Total lines: ${m.totalLines}, Avg lines: ${m.avgLines}, Large files: ${m.largeFiles}, Very large: ${m.veryLargeFiles}, TODOs: ${m.todoCount}
            </div>
          </div>
        `;
      }

      // product signals
      if (metrics.product) {
        const p = metrics.product;
        html += `
          <div style="margin-bottom:12px;">
            <strong>Product signals:</strong>
            <div style="font-size:13px; color:#374151; margin-top:6px;">
              README: ${p.hasReadme ? 'yes' : 'no'}, LICENSE: ${p.hasLicense ? 'yes' : 'no'}, CONTRIBUTING: ${p.hasContributing ? 'yes' : 'no'}, CHANGELOG: ${p.hasChangelog ? 'yes' : 'no'}, docs: ${p.hasDocsDir ? 'yes' : 'no'}, CI: ${p.hasCi ? 'yes' : 'no'}, tests: ${p.hasTestDir || p.testFileCount > 0 ? 'yes' : 'no'}
            </div>
          </div>
        `;
      }

      // performance details
      if (metrics.performance) {
        const perf = metrics.performance;
        html += `
          <div style="margin-bottom:12px;">
            <strong>Performance report:</strong>
            <div style="font-size:13px; color:#374151; margin-top:6px;">Source: ${perf.source || '-'}; details: <pre style="white-space:pre-wrap; font-size:12px;">${JSON.stringify(perf.details || {}, null, 2)}</pre></div>
          </div>
        `;
      }
    }

    if (tooling.length) {
      html += `
        <div style="margin-bottom: 12px;">
          <strong>Tools:</strong>
          <div style="margin-top: 6px; display: flex; flex-wrap: wrap; gap: 8px;">
            ${tooling.map(t => `<span style="background: #eef2f7; border: 1px solid #d7dce3; padding: 4px 8px; border-radius: 6px; font-size: 12px;">${t.language}: ${t.tool} (${t.status})</span>`).join('')}
          </div>
        </div>
      `;
    }

    if (notes.length) {
      html += `
        <div style="margin-bottom: 12px; color: #6b7280;">
          ${notes.map(n => `<div>• ${n}</div>`).join('')}
        </div>
      `;
    }

    html += `
      <div style="margin-bottom: 12px; display: flex; gap: 12px; align-items: center; font-size: 12px;">
        <span style="display: inline-flex; align-items: center; gap: 6px;"><span style="width: 10px; height: 10px; background: #dc2626; border-radius: 50%; display: inline-block;"></span>Error</span>
        <span style="display: inline-flex; align-items: center; gap: 6px;"><span style="width: 10px; height: 10px; background: #f59e0b; border-radius: 50%; display: inline-block;"></span>Warning</span>
      </div>
    `;

    const evidence = report.evidence || {};
    const sections = Object.entries(evidence);

    if (!sections.length) {
      html += '<p>No evidence available.</p>';
      container.innerHTML = html;
      return;
    }

    sections.forEach(([key, items]) => {
      const list = Array.isArray(items) ? items : [];
      const sortedList = [...list].sort((a, b) => {
        const aSev = (a.severity || '').toString().toLowerCase();
        const bSev = (b.severity || '').toString().toLowerCase();
        const rank = sev => (sev === 'error' ? 0 : sev === 'warning' ? 1 : 2);
        return rank(aSev) - rank(bSev);
      });
      html += `
        <div style="margin-bottom: 16px;">
          <h4 style="margin: 0 0 8px 0; color: var(--primary-color); text-transform: uppercase; font-size: 0.9rem;">${key}</h4>
          <div style="border: 1px solid var(--border); border-radius: 8px; padding: 10px; background: var(--card-bg); max-height: 260px; overflow: auto;">
            ${sortedList.length ? sortedList.map(item => {
              const sev = (item.severity || 'issue').toString().toLowerCase();
              const color = sev === 'error' ? '#dc2626' : sev === 'warning' ? '#f59e0b' : '#6b7280';
              const label = item.severity || 'issue';
              return `
                <div style="padding: 6px 0; border-bottom: 1px dashed #e5e7eb;">
                  <div style="font-size: 0.9rem; color: ${color};"><strong>${label}</strong> ${item.ruleId ? `• ${item.ruleId}` : ''}</div>
                  <div style="color: #374151;">${item.message || ''}</div>
                  <div style="color: #6b7280; font-size: 12px;">${item.file ? item.file : 'unknown'}${item.line ? `:${item.line}` : ''}${item.column ? `:${item.column}` : ''}</div>
                </div>
              `;
            }).join('') : '<div>No issues captured.</div>'}
          </div>
        </div>
      `;
    });

    container.innerHTML = html;
  } catch (err) {
    console.error('Error loading clean code evidence:', err);
    container.innerHTML = `<div class="message error">❌ ${err.message}</div>`;
  }
}

async function openProjectRepository(teamId) {
  console.log('Opening project repository for team ID:', teamId);
  const token = localStorage.getItem('token');
  try {
    const response = await fetch(`/api/admin/projects/${teamId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || 'Failed to get project URL');
    }

    const { github_url } = await response.json();

    if (!github_url) {
      throw new Error('Project URL not available');
    }

    // Open GitHub repository in a new tab
    window.open(github_url, '_blank');

  } catch (err) {
    console.error('Error opening project:', err);
    alert(err.message);
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