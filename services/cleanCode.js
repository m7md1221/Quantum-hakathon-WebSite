const { pool } = require('../db');
const { parseRepoUrl, isRepoPublic, downloadEslintArtifact, downloadRepoZip } = require('../utils/github');
const { ESLint } = require('eslint');
const fs = require('fs');
const path = require('path');

const GITHUB_TOKEN = process.env.GITHUB_TOKEN || null;

function calculateScoreFromEslint(report) {
  if (!report) return { score: null, details: null };

  // Support both eslint JSON output (array of files) and summary formats
  let errors = 0;
  let warnings = 0;

  if (Array.isArray(report)) {
    report.forEach(file => {
      errors += file.errorCount || 0;
      warnings += file.warningCount || 0;
    });
  } else if (typeof report === 'object') {
    // eslint --format json outputs array; some custom reports may have totals
    if (report.errorCount !== undefined || report.warningCount !== undefined) {
      errors = report.errorCount || 0;
      warnings = report.warningCount || 0;
    } else if (report.totals) {
      errors = report.totals.errors || 0;
      warnings = report.totals.warnings || 0;
    }
  }

  let score = 100 - (errors * 5) - (warnings * 2);
  if (score < 0) score = 0;

  return {
    score,
    details: { errors, warnings }
  };
}

function hasEslintConfig(rootDir) {
  const configFiles = [
    '.eslintrc',
    '.eslintrc.json',
    '.eslintrc.js',
    '.eslintrc.cjs',
    '.eslintrc.yaml',
    '.eslintrc.yml'
  ];

  if (configFiles.some(file => fs.existsSync(path.join(rootDir, file)))) {
    return true;
  }

  const pkgPath = path.join(rootDir, 'package.json');
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      if (pkg.eslintConfig) return true;
    } catch (_) {
      return false;
    }
  }

  return false;
}

async function runLocalEslint(owner, repo, token) {
  const { tempDir, rootDir } = await downloadRepoZip(owner, repo, token);
  try {
    const hasConfig = hasEslintConfig(rootDir);

    const eslint = new ESLint({
      cwd: rootDir,
      useEslintrc: true,
      errorOnUnmatchedPattern: false,
      overrideConfig: hasConfig ? undefined : {
        env: { browser: true, node: true, es2021: true },
        extends: ['eslint:recommended'],
        parserOptions: { ecmaVersion: 12, sourceType: 'module' },
        rules: {
          'no-unused-vars': 'error',
          'no-console': 'warn',
          'semi': ['error', 'always'],
          'quotes': ['warn', 'single']
        }
      }
    });

    const results = await eslint.lintFiles(['**/*.js']);
    return results;
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

async function processRepoForTeam(teamId, repoUrl) {
  const parsed = parseRepoUrl(repoUrl);
  if (!parsed) throw new Error('Invalid repository URL');

  const { owner, repo } = parsed;

  // Mark evaluation as pending
  await pool.query(
    `UPDATE projects SET clean_code_status = $1, last_evaluated_at = $2 WHERE team_id = $3`,
    ['pending', new Date(), teamId]
  );

  const publicRepo = await isRepoPublic(owner, repo, GITHUB_TOKEN);
  if (!publicRepo) {
    const reason = 'Repository is private or not accessible';
    await pool.query(
      `UPDATE projects SET clean_code_status = $1, clean_code_failure_reason = $2, last_evaluated_at = $3 WHERE team_id = $4`,
      ['failed', reason, new Date(), teamId]
    );
    throw new Error(reason);
  }

  // Try to fetch eslint report artifact from GitHub Actions
  let report = await downloadEslintArtifact(owner, repo, GITHUB_TOKEN);

  // Fallback: run ESLint locally on the server (no student workflow required)
  if (!report) {
    try {
      report = await runLocalEslint(owner, repo, GITHUB_TOKEN);
    } catch (err) {
      const reason = `Local ESLint failed: ${err.message}`;
      await pool.query(
        `UPDATE projects SET clean_code_score = $1, eslint_error_count = $2, eslint_warning_count = $3, clean_code_report = $4, clean_code_status = $5, clean_code_failure_reason = $6, last_evaluated_at = $7 WHERE team_id = $8`,
        [null, 0, 0, JSON.stringify({ message: reason }), 'failed', reason, new Date(), teamId]
      );
      return { score: null, report: { message: reason } };
    }
  }

  if (!report) {
    const reason = 'No ESLint report artifact found and local ESLint did not produce results';
    await pool.query(
      `UPDATE projects SET clean_code_score = $1, eslint_error_count = $2, eslint_warning_count = $3, clean_code_report = $4, clean_code_status = $5, clean_code_failure_reason = $6, last_evaluated_at = $7 WHERE team_id = $8`,
      [null, 0, 0, JSON.stringify({ message: reason }), 'failed', reason, new Date(), teamId]
    );
    return { score: null, report: { message: reason } };
  }

  const { score, details } = calculateScoreFromEslint(report);

  // Save evaluation results
  await pool.query(
    `UPDATE projects SET clean_code_score = $1, eslint_error_count = $2, eslint_warning_count = $3, clean_code_report = $4, clean_code_status = $5, clean_code_failure_reason = $6, last_evaluated_at = $7 WHERE team_id = $8`,
    [score, details.errors, details.warnings, JSON.stringify(report), 'success', null, new Date(), teamId]
  );

  return { score, report, details };
}

module.exports = { processRepoForTeam, calculateScoreFromEslint };
