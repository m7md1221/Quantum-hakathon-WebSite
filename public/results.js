const token = localStorage.getItem('token');

if (!token) {
  window.location.href = 'login.html';
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
      const resultsList = document.getElementById('results');
      const loadingDiv = document.getElementById('results-loading');

      loadingDiv.style.display = 'none';
      resultsList.style.display = 'block';

      results.forEach((result, index) => {
        const li = document.createElement('li');
        li.className = index < 5 ? 'winner' : '';
        
        // Convert to /100 scale
        const scoreOutOf100 = result.average_score ? (parseFloat(result.average_score) * 10).toFixed(1) : 'N/A';
console.log(results); // شوف إذا team_number رجع صح

        li.innerHTML = `
          <div class="rank" style="min-width: 50px; text-align: center;">
            <span style="display: inline-block; width: 28px; height: 28px; line-height: 28px; background: ${index < 3 ? '#d4af37' : 'var(--primary-color)'}; color: white; border-radius: 50%; font-size: 0.85rem; font-weight: 600;">${index + 1}</span>
          </div>
          <div style="flex: 1;">
    <strong class="team-number">الفريق رقم ${result.team_number}</strong><br>
    <span class="team-name">${result.name}</span>
            <br>
            <small style="color: var(--text-secondary);">Hall ${result.hall}</small>
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

  const csvContent = [
    ['Rank', 'Team number', 'Hall', 'Average Score (out of 100)'],
    ...resultsData.map((result, index) => [
      index + 1,
      result.team_number,
      result.hall,
      result.average_score ? (parseFloat(result.average_score) * 10).toFixed(1) : 'N/A'
    ])
  ];

  const csvString = csvContent.map(row => row.map(field => `"${field}"`).join(',')).join('\n');

  const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', `quantum-khakathon-results-${new Date().toISOString().split('T')[0]}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// Add export button event listener
document.getElementById('export-btn').addEventListener('click', exportToCSV);