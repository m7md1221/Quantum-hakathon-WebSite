const token = localStorage.getItem('token');

if (!token) {
  goTo('login.html');
}

// Map hall letters to full names
function getHallName(hallLetter) {
  const hallNames = {
    'A': 'Intelligence',
    'B': 'Neural',
    'C': 'Qubit',
    'D': 'Quantum Core'
  };
  return hallNames[hallLetter] || `Hall ${hallLetter}`;
}

let resultsData = []; // Store results for export

document.addEventListener('DOMContentLoaded', async () => {
  try {
    const response = await fetch('/api/admin/results', {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    const results = await response.json();
    if (response.ok) {
      resultsData = results; // Store for export
      console.log('Results data with judges:', resultsData); // Debug: Check judges data
      const resultsList = document.getElementById('results');
      const loadingDiv = document.getElementById('results-loading');

      loadingDiv.style.display = 'none';
      resultsList.style.display = 'block';

      results.forEach((result, index) => {
        const li = document.createElement('li');
        li.className = index < 5 ? 'winner' : '';

        // Already on /100 scale
        const scoreOutOf100 = result.average_score ? parseFloat(result.average_score).toFixed(1) : 'N/A';
        console.log(results); // شوف إذا team_number رجع صح

        li.innerHTML = `
          <div class="rank" style="min-width: 50px; text-align: center;">
            <span style="display: inline-block; width: 28px; height: 28px; line-height: 28px; background: ${index < 3 ? '#d4af37' : 'var(--primary-color)'}; color: white; border-radius: 50%; font-size: 0.85rem; font-weight: 600;">${index + 1}</span>
          </div>
          <div style="flex: 1;">
    <strong class="team-number">الفريق رقم ${result.team_number}</strong><br>
    <span class="team-name">${result.name}</span>
            ${result.institution_name ? `<div style="margin-top: 4px; color: #666; font-size: 0.9rem;">${result.institution_name}</div>` : ''}
            <small style="color: var(--text-secondary);">${getHallName(result.hall)}</small>
          </div>
          <div class="score" style="font-size: 1.1rem;">${scoreOutOf100 !== 'N/A' ? scoreOutOf100 + '/100' : 'N/A'}</div>
        `;
        resultsList.appendChild(li);
      });

      // Enable export button
      document.getElementById('export-btn').disabled = false;
    } else {
      document.getElementById('results-loading').innerHTML = `
        <div class="message error">${results.message}</div>
      `;
    }
  } catch (error) {
    document.getElementById('results-loading').innerHTML = `
      <div class="message error">An error occurred while loading results</div>
    `;
    console.error('Error loading results:', error);
  }
});

// Export to CSV function
function exportToCSV() {
  if (resultsData.length === 0) {
    alert('No data to export');
    return;
  }

  console.log('Exporting data:', resultsData); // Debug
  console.log('First team judges:', resultsData[0]?.judges); // Debug

  // Find maximum number of judges for any team
  const maxJudges = Math.max(...resultsData.map(result => {
    const judges = result.judges || [];
    console.log('Team', result.team_number, 'judges:', judges); // Debug
    return judges.length;
  }));

  console.log('Max judges:', maxJudges); // Debug

  // Build dynamic headers for judges
  const judgeHeaders = [];
  for (let i = 1; i <= maxJudges; i++) {
    judgeHeaders.push(`الحاكم ${i}`);
  }

  const csvContent = [
    ['الترتيب', 'رقم الفريق', 'اسم الفريق', 'الجهة/المؤسسة', 'القاعة', 'المعدل (من 100)', ...judgeHeaders],
    ...resultsData.map((result, index) => {
      const judges = result.judges || [];
      const judgeColumns = [];
      for (let i = 0; i < maxJudges; i++) {
        const judgeName = judges[i] || '';
        console.log(`Team ${result.team_number}, Judge ${i}:`, judgeName); // Debug
        judgeColumns.push(judgeName);
      }
      return [
        index + 1,
        result.team_number,
        result.name || '',
        result.institution_name || '',
        getHallName(result.hall),
        result.average_score ? parseFloat(result.average_score).toFixed(1) : 'N/A',
        ...judgeColumns
      ];
    })
  ];

  console.log('CSV Content:', csvContent); // Debug

  const csvString = csvContent.map(row => row.map(field => `"${String(field).replace(/"/g, '""')}"`).join(',')).join('\n');

  const BOM = '\uFEFF';

  const blob = new Blob([BOM + csvString], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', `quantum-khakathon-results-${new Date().toISOString().split('T')[0]}.csv`);
  link.setAttribute('data-no-transition', 'true');
  link.setAttribute('rel', 'noopener');
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

// Add export button event listener
document.getElementById('export-btn').addEventListener('click', (event) => {
  event.preventDefault();
  event.stopPropagation();
  exportToCSV();
});