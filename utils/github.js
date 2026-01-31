const axios = require('axios');
const AdmZip = require('adm-zip');
const fs = require('fs');
const path = require('path');
const os = require('os');

function parseRepoUrl(url) {
  try {
    const u = new URL(url.trim());
    const parts = u.pathname.replace(/^\//, '').split('/');
    if (parts.length < 2) return null;
    return { owner: parts[0], repo: parts[1] };
  } catch (e) {
    return null;
  }
}

async function isRepoPublic(owner, repo, token) {
  const headers = token ? { Authorization: `token ${token}` } : {};
  try {
    const res = await axios.get(`https://api.github.com/repos/${owner}/${repo}`, { headers, timeout: 5000 });
    return !res.data.private;
  } catch (err) {
    // If rate limit or other error, try without authentication as public repo may still be accessible
    if (err.response && err.response.status === 404) {
      return false;
    }
    // For rate limit or other errors, assume public repo is accessible
    console.log('GitHub API check failed, proceeding with assumption it is public');
    return true;
  }
}

async function downloadEslintArtifact(owner, repo, token) {
  // Get latest workflow runs
  const headers = { Accept: 'application/vnd.github+json' };
  if (token) headers.Authorization = `token ${token}`;
  
  console.log(`Downloading artifact with token: ${token ? 'YES' : 'NO'}`);
  
  try {
    // Get latest workflow runs
    const runsRes = await axios.get(
      `https://api.github.com/repos/${owner}/${repo}/actions/runs?per_page=10`,
      { headers, timeout: 10000 }
    );

    const runs = runsRes.data.workflow_runs || [];
    for (const run of runs) {
      try {
        // List artifacts for this run
        const artifactsRes = await axios.get(
          `https://api.github.com/repos/${owner}/${repo}/actions/runs/${run.id}/artifacts`,
          { headers, timeout: 10000 }
        );
        const artifacts = artifactsRes.data.artifacts || [];
        
        // Try to find artifact named eslint-report
        const artifact = artifacts.find(a => /eslint/i.test(a.name));
        if (!artifact) {
          console.log(`No eslint artifact found in run ${run.id}`);
          continue;
        }

        console.log(`Found artifact: ${artifact.name}, attempting download...`);

        // Try to download the artifact zip WITH token
        try {
          const dlHeaders = { Accept: 'application/vnd.github+json' };
          if (token) dlHeaders.Authorization = `token ${token}`;
          
          const zipRes = await axios.get(artifact.archive_download_url, {
            headers: dlHeaders,
            responseType: 'arraybuffer',
            timeout: 10000,
            maxRedirects: 5
          });

          console.log(`Downloaded artifact, size: ${zipRes.data.length} bytes`);

          const zip = new AdmZip(zipRes.data);
          const entries = zip.getEntries();
          
          for (const entry of entries) {
            if (/eslint.*\.json$/i.test(entry.entryName) || entry.entryName.endsWith('eslint-report.json')) {
              const content = entry.getData().toString('utf8');
              console.log(`Found ESLint report in: ${entry.entryName}`);
              return JSON.parse(content);
            }
          }
          
          // List what files are in the artifact
          console.log(`Artifact contains: ${entries.map(e => e.entryName).join(', ')}`);
        } catch (dlErr) {
          console.log(`Failed to download artifact ${artifact.name}: ${dlErr.message}`);
          continue;
        }
      } catch (e) {
        console.log(`Error processing run ${run.id}: ${e.message}`);
        continue;
      }
    }
  } catch (e) {
    console.log(`Failed to fetch workflow runs: ${e.message}`);
  }

  // No artifact found
  return null;
}

async function downloadRepoZip(owner, repo, token) {
  const headers = { Accept: 'application/vnd.github+json' };
  if (token) headers.Authorization = `token ${token}`;

  const zipRes = await axios.get(
    `https://api.github.com/repos/${owner}/${repo}/zipball`,
    {
      headers,
      responseType: 'arraybuffer',
      timeout: 20000,
      maxRedirects: 5
    }
  );

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'repo-'));
  const zip = new AdmZip(zipRes.data);
  zip.extractAllTo(tempDir, true);

  const entries = fs.readdirSync(tempDir, { withFileTypes: true });
  const rootDir = (entries.length === 1 && entries[0].isDirectory())
    ? path.join(tempDir, entries[0].name)
    : tempDir;

  return { tempDir, rootDir };
}

module.exports = {
  parseRepoUrl,
  isRepoPublic,
  downloadEslintArtifact,
  downloadRepoZip
};
