const { pool } = require('../db');
const { parseRepoUrl, isRepoPublic, downloadEslintArtifact, downloadRepoZip } = require('../utils/github');
const { ESLint } = require('eslint');
const { HTMLHint } = require('htmlhint');
const stylelint = require('stylelint');
const fs = require('fs');
const path = require('path');

const GITHUB_TOKEN = process.env.GITHUB_TOKEN || null;

function calculateScoreFromCounts(errors, warnings) {
  let score = 100 - (errors * 5) - (warnings * 2);
  if (score < 0) score = 0;
  return score;
}

function summarizeEslint(report) {
  if (!report) return { errors: 0, warnings: 0 };

  // Support both eslint JSON output (array of files) and summary formats
  let errors = 0;
  let warnings = 0;

  if (Array.isArray(report)) {
    report.forEach(file => {
      errors += file.errorCount || 0;
      warnings += file.warningCount || 0;
    });
  } else if (typeof report === 'object') {
    if (report.errorCount !== undefined || report.warningCount !== undefined) {
      errors = report.errorCount || 0;
      warnings = report.warningCount || 0;
    } else if (report.totals) {
      errors = report.totals.errors || 0;
      warnings = report.totals.warnings || 0;
    }
  }

  return { errors, warnings };
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

function hasStylelintConfig(rootDir) {
  const configFiles = [
    '.stylelintrc',
    '.stylelintrc.json',
    '.stylelintrc.js',
    '.stylelintrc.cjs',
    '.stylelintrc.yaml',
    '.stylelintrc.yml',
    'stylelint.config.js',
    'stylelint.config.cjs'
  ];

  if (configFiles.some(file => fs.existsSync(path.join(rootDir, file)))) {
    return true;
  }

  const pkgPath = path.join(rootDir, 'package.json');
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      if (pkg.stylelint) return true;
    } catch (_) {
      return false;
    }
  }

  return false;
}

function walkFiles(dir, fileList = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const skipDirs = new Set(['node_modules', '.git', '.github', 'dist', 'build', 'coverage', '.next']);
      if (skipDirs.has(entry.name)) continue;
      walkFiles(fullPath, fileList);
    } else if (entry.isFile()) {
      fileList.push(fullPath);
    }
  }
  return fileList;
}

function collectFilesByType(rootDir) {
  const files = walkFiles(rootDir, []);
  const byType = {
    js: [],
    jsx: [],
    ts: [],
    tsx: [],
    html: [],
    css: [],
    other: []
  };

  const otherExts = new Set([
    '.py', '.java', '.go', '.rb', '.php', '.cs', '.cpp', '.c', '.h', '.hpp',
    '.kt', '.kts', '.swift', '.rs', '.scala', '.m', '.mm'
  ]);

  files.forEach(file => {
    const ext = path.extname(file).toLowerCase();
    if (ext === '.js') byType.js.push(file);
    else if (ext === '.jsx') byType.jsx.push(file);
    else if (ext === '.ts') byType.ts.push(file);
    else if (ext === '.tsx') byType.tsx.push(file);
    else if (ext === '.html' || ext === '.htm') byType.html.push(file);
    else if (ext === '.css') byType.css.push(file);
    else if (otherExts.has(ext)) byType.other.push(file);
  });

  return byType;
}

async function runLocalEslint(rootDir, files, hasConfig) {
  if (!files.length) return null;

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

  return eslint.lintFiles(files);
}

function runHtmlHint(files) {
  if (!files.length) return null;

  const rules = {
    'tagname-lowercase': true,
    'attr-lowercase': true,
    'attr-value-double-quotes': true,
    'tag-pair': true,
    'spec-char-escape': true,
    'id-unique': true,
    'src-not-empty': true,
    'doctype-html5': true
  };

  let errors = 0;
  let warnings = 0;

  files.forEach(file => {
    const content = fs.readFileSync(file, 'utf8');
    const messages = HTMLHint.verify(content, rules) || [];
    messages.forEach(msg => {
      if (msg.type === 'error') errors += 1;
      else warnings += 1;
    });
  });

  return { errors, warnings };
}

async function runStylelint(rootDir, files, hasConfig) {
  if (!files.length) return null;

  let errors = 0;
  let warnings = 0;

  for (const file of files) {
    const code = fs.readFileSync(file, 'utf8');
    const result = await stylelint.lint({
      code,
      codeFilename: file,
      config: hasConfig ? undefined : { extends: ['stylelint-config-standard'] }
    });

    const res = result.results && result.results[0];
    if (!res || !res.warnings) continue;
    res.warnings.forEach(w => {
      if (w.severity === 'error') errors += 1;
      else warnings += 1;
    });
  }

  return { errors, warnings };
}

async function lintAllCode(owner, repo, token, eslintArtifactReport = null) {
  const { tempDir, rootDir } = await downloadRepoZip(owner, repo, token);
  try {
    const filesByType = collectFilesByType(rootDir);
    const hasEslint = hasEslintConfig(rootDir);
    const hasStylelint = hasStylelintConfig(rootDir);

    const jsFiles = [...filesByType.js, ...filesByType.jsx];
    const tsFiles = hasEslint ? [...filesByType.ts, ...filesByType.tsx] : [];
    const allEslintFiles = [...jsFiles, ...tsFiles];

    // Log files being analyzed
    console.log(`\n📊 Code Analysis Summary:`, {
      jsFiles: jsFiles.length,
      tsFiles: tsFiles.length,
      htmlFiles: filesByType.html.length,
      cssFiles: filesByType.css.length,
      otherFiles: filesByType.other.length,
      totalFiles: allEslintFiles.length + filesByType.html.length + filesByType.css.length
    });
    if (allEslintFiles.length > 0) {
      console.log('📝 JavaScript/TypeScript files:', allEslintFiles.slice(0, 5).map(f => path.basename(f)).join(', '), allEslintFiles.length > 5 ? `... (+${allEslintFiles.length - 5} more)` : '');
    }
    if (filesByType.html.length > 0) {
      console.log('📄 HTML files:', filesByType.html.map(f => path.basename(f)).join(', '));
    }
    if (filesByType.css.length > 0) {
      console.log('🎨 CSS files:', filesByType.css.map(f => path.basename(f)).join(', '));
    }

    let eslintSummary = null;
    let eslintReport = null;

    if (eslintArtifactReport && allEslintFiles.length) {
      eslintReport = eslintArtifactReport;
      eslintSummary = summarizeEslint(eslintArtifactReport);
      console.log('✅ Using GitHub Actions artifact');
    } else if (allEslintFiles.length) {
      console.log('🔄 Running local ESLint on server...');
      eslintReport = await runLocalEslint(rootDir, allEslintFiles, hasEslint);
      eslintSummary = summarizeEslint(eslintReport);
    }

    const htmlSummary = runHtmlHint(filesByType.html);
    const cssSummary = await runStylelint(rootDir, filesByType.css, hasStylelint);

    const scoringBuckets = [];

    if (eslintSummary) {
      scoringBuckets.push({
        label: 'eslint',
        files: allEslintFiles.length,
        errors: eslintSummary.errors,
        warnings: eslintSummary.warnings,
        score: calculateScoreFromCounts(eslintSummary.errors, eslintSummary.warnings)
      });
    }

    if (htmlSummary) {
      scoringBuckets.push({
        label: 'htmlhint',
        files: filesByType.html.length,
        errors: htmlSummary.errors,
        warnings: htmlSummary.warnings,
        score: calculateScoreFromCounts(htmlSummary.errors, htmlSummary.warnings)
      });
    }

    if (cssSummary) {
      scoringBuckets.push({
        label: 'stylelint',
        files: filesByType.css.length,
        errors: cssSummary.errors,
        warnings: cssSummary.warnings,
        score: calculateScoreFromCounts(cssSummary.errors, cssSummary.warnings)
      });
    }

    let combinedScore = 70;
    let totalErrors = 0;
    let totalWarnings = 0;

    if (scoringBuckets.length) {
      const totalWeight = scoringBuckets.reduce((sum, b) => sum + Math.max(1, b.files), 0);
      combinedScore = Math.round(
        scoringBuckets.reduce((sum, b) => sum + (b.score * Math.max(1, b.files)), 0) / totalWeight
      );
      totalErrors = scoringBuckets.reduce((sum, b) => sum + b.errors, 0);
      totalWarnings = scoringBuckets.reduce((sum, b) => sum + b.warnings, 0);
    }

    const report = {
      summary: scoringBuckets,
      files: {
        js: filesByType.js.length,
        jsx: filesByType.jsx.length,
        ts: filesByType.ts.length,
        tsx: filesByType.tsx.length,
        html: filesByType.html.length,
        css: filesByType.css.length,
        other: filesByType.other.length
      },
      note: scoringBuckets.length
        ? null
        : 'No supported lintable files found; default score applied.'
    };

    return {
      score: combinedScore,
      report,
      details: { errors: totalErrors, warnings: totalWarnings }
    };
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

  // Try to fetch eslint report artifact from GitHub Actions (optional boost)
  let eslintReport = await downloadEslintArtifact(owner, repo, GITHUB_TOKEN);

  // Run unified linting across supported languages, with safe fallbacks
  let lintResult;
  try {
    lintResult = await lintAllCode(owner, repo, GITHUB_TOKEN, eslintReport);
  } catch (err) {
    const reason = `Linting failed: ${err.message}`;
    await pool.query(
      `UPDATE projects SET clean_code_score = $1, eslint_error_count = $2, eslint_warning_count = $3, clean_code_report = $4, clean_code_status = $5, clean_code_failure_reason = $6, last_evaluated_at = $7 WHERE team_id = $8`,
      [null, 0, 0, JSON.stringify({ message: reason }), 'failed', reason, new Date(), teamId]
    );
    return { score: null, report: { message: reason } };
  }

  // Save evaluation results
  await pool.query(
    `UPDATE projects SET clean_code_score = $1, eslint_error_count = $2, eslint_warning_count = $3, clean_code_report = $4, clean_code_status = $5, clean_code_failure_reason = $6, last_evaluated_at = $7 WHERE team_id = $8`,
    [lintResult.score, lintResult.details.errors, lintResult.details.warnings, JSON.stringify(lintResult.report), 'success', null, new Date(), teamId]
  );

  return lintResult;
}

module.exports = { processRepoForTeam, calculateScoreFromCounts };
