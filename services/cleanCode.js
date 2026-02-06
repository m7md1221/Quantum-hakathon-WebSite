const { pool } = require('../db');
const { parseRepoUrl, isRepoPublic, downloadEslintArtifact, downloadRepoZip } = require('../utils/github');
// Linting libraries removed: now using CodeFactor only
const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const os = require('os');

const GITHUB_TOKEN = process.env.GITHUB_TOKEN || null;
const MAX_SAMPLE_ITEMS = 50;
const WORKSPACE_ROOT = path.resolve(__dirname, '..');

const SCORE_WEIGHTS = {
  lint: 0.6,
  maintainability: 0.2,
  product: 0.1,
  performance: 0.1
};

function clampScore(value) {
  if (Number.isNaN(value) || value === null || value === undefined) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function calculateScoreFromCounts(errors, warnings) {
  const err = Number(errors || 0);
  const warn = Number(warnings || 0);
  let score = 100 - (err * 2) - (warn * 0.5);
  return clampScore(score);
}

function scoreFromLatencyMs(latencyMs) {
  const ms = Number(latencyMs);
  if (!Number.isFinite(ms)) return null;
  if (ms <= 200) return 100;
  if (ms <= 400) return 85;
  if (ms <= 800) return 70;
  if (ms <= 1200) return 55;
  if (ms <= 2000) return 40;
  return 25;
}

function readJsonIfExists(filePath) {
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (_) {
    return null;
  }
}

function findPerformanceReport(rootDir) {
  const candidates = [
    'performance_report.json',
    'performance.json',
    'benchmark.json',
    'benchmarks.json',
    'benchmark-results.json',
    'perf-report.json'
  ];

  for (const name of candidates) {
    const full = path.join(rootDir, name);
    if (fs.existsSync(full)) return full;
  }

  return null;
}

function getPerformanceScore(rootDir) {
  const reportPath = findPerformanceReport(rootDir);
  if (!reportPath) {
    return { score: null, source: null, details: null };
  }

  const data = readJsonIfExists(reportPath);
  if (!data) return { score: null, source: path.basename(reportPath), details: null };

  if (Number.isFinite(data.score)) {
    return { score: clampScore(data.score), source: path.basename(reportPath), details: data };
  }

  const p95 = data.p95_ms ?? data.p95 ?? data.latency_p95_ms ?? data.latencyP95;
  const avg = data.avg_ms ?? data.avg ?? data.latency_avg_ms ?? data.latencyAvg;
  const derived = scoreFromLatencyMs(p95 ?? avg);

  return {
    score: derived !== null ? clampScore(derived) : null,
    source: path.basename(reportPath),
    details: data
  };
}

function getRepoSignals(rootDir, filesByType) {
  let rootFiles = new Set();
  try {
    rootFiles = new Set(fs.readdirSync(rootDir));
  } catch (_) {
    rootFiles = new Set();
  }

  const hasReadme = Array.from(rootFiles).some(name => /^readme(\.|$)/i.test(name));
  const hasLicense = Array.from(rootFiles).some(name => /^license(\.|$)/i.test(name));
  const hasContributing = Array.from(rootFiles).some(name => /^contributing(\.|$)/i.test(name));
  const hasChangelog = Array.from(rootFiles).some(name => /^changelog(\.|$)/i.test(name));

  const hasDocsDir = ['docs', 'doc', 'documentation'].some(dir => fs.existsSync(path.join(rootDir, dir)));

  const hasCi = fs.existsSync(path.join(rootDir, '.github', 'workflows'))
    || fs.existsSync(path.join(rootDir, '.gitlab-ci.yml'))
    || fs.existsSync(path.join(rootDir, 'azure-pipelines.yml'))
    || fs.existsSync(path.join(rootDir, '.circleci', 'config.yml'))
    || fs.existsSync(path.join(rootDir, 'circle.yml'));

  const testDirs = ['test', 'tests', '__tests__', 'spec', 'specs'];
  const hasTestDir = testDirs.some(dir => fs.existsSync(path.join(rootDir, dir)));

  const allCodeFiles = [
    ...filesByType.js, ...filesByType.jsx, ...filesByType.ts, ...filesByType.tsx,
    ...filesByType.py, ...filesByType.java, ...filesByType.go, ...filesByType.php,
    ...filesByType.rb, ...filesByType.cs, ...filesByType.kotlin, ...filesByType.c,
    ...filesByType.cpp, ...filesByType.html, ...filesByType.css, ...filesByType.other
  ];

  const testFileRegex = /\.(test|spec)\.[^./]+$/i;
  const testFileCount = allCodeFiles.filter(file => testFileRegex.test(file)).length;

  return {
    hasReadme,
    hasLicense,
    hasContributing,
    hasChangelog,
    hasDocsDir,
    hasCi,
    hasTestDir,
    testFileCount
  };
}

function calculateProductScore(signals) {
  let score = 0;
  if (signals.hasReadme) score += 20;
  if (signals.hasLicense) score += 10;
  if (signals.hasContributing) score += 10;
  if (signals.hasChangelog) score += 10;
  if (signals.hasDocsDir) score += 10;
  if (signals.hasCi) score += 20;
  if (signals.hasTestDir || signals.testFileCount > 0) score += 20;
  return clampScore(score);
}

function calculateMaintainabilityScore(rootDir, filesByType) {
  const codeFiles = [
    ...filesByType.js, ...filesByType.jsx, ...filesByType.ts, ...filesByType.tsx,
    ...filesByType.py, ...filesByType.java, ...filesByType.go, ...filesByType.php,
    ...filesByType.rb, ...filesByType.cs, ...filesByType.kotlin, ...filesByType.c,
    ...filesByType.cpp, ...filesByType.html, ...filesByType.css, ...filesByType.other
  ];

  let totalLines = 0;
  let largeFiles = 0;
  let veryLargeFiles = 0;
  let todoCount = 0;

  codeFiles.forEach(file => {
    try {
      const content = fs.readFileSync(file, 'utf8');
      const lines = content.split(/\r?\n/).length;
      totalLines += lines;
      if (lines > 400) largeFiles += 1;
      if (lines > 800) veryLargeFiles += 1;
      const matches = content.match(/\b(TODO|FIXME|HACK)\b/g);
      if (matches) todoCount += matches.length;
    } catch (_) {
      // ignore unreadable files
    }
  });

  const fileCount = codeFiles.length || 1;
  const avgLines = totalLines / fileCount;
  const largeRatio = largeFiles / fileCount;
  const veryLargeRatio = veryLargeFiles / fileCount;

  let score = 100;
  score -= largeRatio * 30;
  score -= veryLargeRatio * 20;
  score -= Math.min(20, todoCount * 0.5);
  if (avgLines > 400) score -= Math.min(20, (avgLines - 400) / 20);

  return {
    score: clampScore(score),
    stats: { fileCount, totalLines, avgLines: Math.round(avgLines), largeFiles, veryLargeFiles, todoCount }
  };
}

function calculateCompositeScore(scores) {
  const available = [
    { key: 'lint', score: scores.lint, weight: SCORE_WEIGHTS.lint },
    { key: 'maintainability', score: scores.maintainability, weight: SCORE_WEIGHTS.maintainability },
    { key: 'product', score: scores.product, weight: SCORE_WEIGHTS.product },
    { key: 'performance', score: scores.performance, weight: SCORE_WEIGHTS.performance }
  ].filter(entry => Number.isFinite(entry.score));

  if (!available.length) return 0;

  const totalWeight = available.reduce((sum, entry) => sum + entry.weight, 0);
  const weighted = available.reduce((sum, entry) => sum + entry.score * entry.weight, 0);

  return clampScore(weighted / totalWeight);
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

function collectEslintSamples(report, limit = MAX_SAMPLE_ITEMS) {
  const samples = [];
  if (!report || !Array.isArray(report)) return samples;

  for (const file of report) {
    if (!file || !Array.isArray(file.messages)) continue;
    for (const msg of file.messages) {
      if (samples.length >= limit) return samples;
      samples.push({
        file: file.filePath ? path.basename(file.filePath) : undefined,
        ruleId: msg.ruleId || null,
        severity: msg.severity === 2 ? 'error' : 'warning',
        message: msg.message,
        line: msg.line,
        column: msg.column
      });
    }
  }

  return samples;
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

function isGeneratedDocFile(filePath) {
  const normalized = filePath.replace(/\\/g, '/').toLowerCase();
  const base = path.basename(normalized);

  if (
    normalized.includes('/apidocs/') ||
    normalized.includes('/javadoc/') ||
    normalized.includes('/docs/') ||
    normalized.includes('/doc/') ||
    normalized.includes('/documentation/') ||
    normalized.includes('/site/') ||
    normalized.includes('/reports/')
  ) {
    return true;
  }

  const javadocNames = new Set([
    'package-summary.html',
    'package-tree.html',
    'allclasses-index.html',
    'allpackages-index.html',
    'overview-summary.html',
    'overview-tree.html',
    'help-doc.html',
    'search.html',
    'index.html'
  ]);

  if (javadocNames.has(base)) return true;
  if (/^index-\d+\.html$/.test(base)) return true;
  if (base.endsWith('.java.html')) return true;

  const javadocAssets = new Set([
    'script.js',
    'search.js',
    'search-page.js',
    'jquery-ui.min.js',
    'jquery-3.7.1.min.js',
    'stylesheet.css',
    'dejavu.css',
    'prettify.css',
    'report.css'
  ]);

  if (javadocAssets.has(base)) return true;

  return false;
}

function isVendorAsset(filePath) {
  const normalized = filePath.replace(/\\/g, '/').toLowerCase();
  const base = path.basename(normalized);

  if (
    normalized.includes('/vendor/') ||
    normalized.includes('/vendors/') ||
    normalized.includes('/third_party/') ||
    normalized.includes('/third-party/') ||
    normalized.includes('/external/') ||
    normalized.includes('/lib/') ||
    normalized.includes('/libs/')
  ) {
    return true;
  }

  if (base.endsWith('.min.js') || base.endsWith('.min.css')) return true;

  const vendorPrefixes = [
    'jquery',
    'bootstrap',
    'popper',
    'chart',
    'fontawesome',
    'font-awesome',
    'prism',
    'highlight',
    'swagger',
    'swagger-ui',
    'codemirror'
  ];

  if (vendorPrefixes.some(prefix => base.startsWith(prefix))) return true;

  return false;
}

function isJavaDocDir(dirPath) {
  try {
    const markers = [
      'package-summary.html',
      'package-tree.html',
      'allclasses-index.html',
      'allpackages-index.html',
      'overview-summary.html',
      'overview-tree.html',
      'help-doc.html'
    ];

    return markers.some(marker => fs.existsSync(path.join(dirPath, marker)));
  } catch (_) {
    return false;
  }
}

function walkFiles(dir, fileList = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const skipDirs = new Set([
        'node_modules', '.git', '.github', 'dist', 'build', 'coverage', '.next',
        '.venv', 'venv', '__pycache__',
        'target', 'out', 'bin',
        'docs', 'doc', 'documentation', 'javadoc', 'site', 'reports',
        'vendor', 'vendors', 'third_party', 'third-party', 'external', 'lib', 'libs'
      ]);
      if (skipDirs.has(entry.name)) continue;
      if (isJavaDocDir(fullPath)) continue;
      walkFiles(fullPath, fileList);
    } else if (entry.isFile()) {
      // Skip generated docs/reports anywhere in path (e.g., target/site, docs, javadoc)
      const normalized = fullPath.replace(/\\/g, '/').toLowerCase();
      if (normalized.includes('/target/') || normalized.includes('/site/') || normalized.includes('/docs/') || normalized.includes('/doc/') || normalized.includes('/documentation/') || normalized.includes('/javadoc/') || normalized.includes('/reports/')) {
        continue;
      }
      if (isGeneratedDocFile(fullPath)) continue;
      if (isVendorAsset(fullPath)) continue;
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
    py: [],
    java: [],
    go: [],
    php: [],
    rb: [],
    cs: [],
    kotlin: [],
    c: [],
    cpp: [],
    csproj: [],
    sln: [],
    html: [],
    css: [],
    other: []
  };

  const otherExts = new Set([
    '.h', '.hpp',
    '.kt', '.kts', '.swift', '.rs', '.scala', '.m', '.mm'
  ]);

  files.forEach(file => {
    const ext = path.extname(file).toLowerCase();
    if (ext === '.js') byType.js.push(file);
    else if (ext === '.jsx') byType.jsx.push(file);
    else if (ext === '.ts') byType.ts.push(file);
    else if (ext === '.tsx') byType.tsx.push(file);
    else if (ext === '.py') byType.py.push(file);
    else if (ext === '.java') byType.java.push(file);
    else if (ext === '.go') byType.go.push(file);
    else if (ext === '.php') byType.php.push(file);
    else if (ext === '.rb') byType.rb.push(file);
    else if (ext === '.cs') byType.cs.push(file);
    else if (ext === '.kt' || ext === '.kts') byType.kotlin.push(file);
    else if (ext === '.c') byType.c.push(file);
    else if (ext === '.cpp' || ext === '.cc' || ext === '.cxx') byType.cpp.push(file);
    else if (ext === '.csproj') byType.csproj.push(file);
    else if (ext === '.sln') byType.sln.push(file);
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
  const samples = [];

  files.forEach(file => {
    const content = fs.readFileSync(file, 'utf8');
    const messages = HTMLHint.verify(content, rules) || [];
    messages.forEach(msg => {
      if (msg.type === 'error') errors += 1;
      else warnings += 1;

      if (samples.length < MAX_SAMPLE_ITEMS) {
        samples.push({
          file: path.basename(file),
          ruleId: msg.rule && msg.rule.id ? msg.rule.id : null,
          severity: msg.type || 'warning',
          message: msg.message,
          line: msg.line,
          column: msg.col
        });
      }
    });
  });

  return { errors, warnings, samples };
}

async function runStylelint(rootDir, files, hasConfig) {
  if (!files.length) return null;

  const fallbackConfig = {
    rules: {
      'block-no-empty': [true, { severity: 'warning' }],
      'color-no-invalid-hex': true,
      'declaration-block-no-duplicate-properties': [true, { severity: 'warning' }],
      'property-no-unknown': true,
      'selector-pseudo-class-no-unknown': [true, { ignorePseudoClasses: ['global', 'local'], severity: 'warning' }],
      'selector-pseudo-element-no-unknown': [true, { severity: 'warning' }],
      'selector-type-no-unknown': [true, { ignoreTypes: ['page'], severity: 'warning' }],
      'unit-no-unknown': true,
      'no-duplicate-selectors': [true, { severity: 'warning' }]
    }
  };

  let errors = 0;
  let warnings = 0;
  const samples = [];

  for (const file of files) {
    const code = fs.readFileSync(file, 'utf8');
    const result = await stylelint.lint({
      code,
      codeFilename: file,
      config: hasConfig ? undefined : fallbackConfig
    });

    const res = result.results && result.results[0];
    if (!res || !res.warnings) continue;
    res.warnings.forEach(w => {
      if (w.severity === 'error') errors += 1;
      else warnings += 1;

      if (samples.length < MAX_SAMPLE_ITEMS) {
        samples.push({
          file: path.basename(file),
          ruleId: w.rule || null,
          severity: w.severity || 'warning',
          message: w.text,
          line: w.line,
          column: w.column
        });
      }
    });
  }

  return { errors, warnings, samples };
}

function execFileAsync(command, args, options) {
  return new Promise((resolve, reject) => {
    execFile(command, args, options, (error, stdout, stderr) => {
      if (error) {
        return reject({ error, stdout: stdout || '', stderr: stderr || '' });
      }
      resolve({ stdout: stdout || '', stderr: stderr || '' });
    });
  });
}

function resolvePythonCmd(rootDir) {
  const candidates = [
    process.env.PYTHON,
    path.join(WORKSPACE_ROOT, '.venv', 'Scripts', 'python.exe'),
    path.join(WORKSPACE_ROOT, '.venv', 'bin', 'python'),
    path.join(rootDir, '.venv', 'Scripts', 'python.exe'),
    path.join(rootDir, '.venv', 'bin', 'python'),
    'python'
  ].filter(Boolean);

  for (const cmd of candidates) {
    try {
      if (cmd === 'python') return cmd;
      if (fs.existsSync(cmd)) return cmd;
    } catch (_) {
      continue;
    }
  }

  return 'python';
}

async function runPythonLint(rootDir, files) {
  if (!files.length) return null;

  const pythonCmd = resolvePythonCmd(rootDir);

  // Try Ruff first (fast & accurate). If not available, fallback to syntax checks.
  try {
    const { stdout } = await execFileAsync(
      pythonCmd,
      ['-m', 'ruff', 'check', '--output-format', 'json', ...files],
      { cwd: rootDir, timeout: 20000, maxBuffer: 5 * 1024 * 1024 }
    );

    const results = JSON.parse(stdout || '[]');
    const errors = Array.isArray(results) ? results.length : 0;
    const samples = Array.isArray(results)
      ? results.slice(0, MAX_SAMPLE_ITEMS).map(item => ({
          file: item.filename ? path.basename(item.filename) : undefined,
          ruleId: item.code || null,
          severity: 'error',
          message: item.message,
          line: item.location ? item.location.row : undefined,
          column: item.location ? item.location.column : undefined
        }))
      : [];
    return { errors, warnings: 0, tool: 'ruff', samples };
  } catch (ruffErr) {
    if (ruffErr.error && ruffErr.error.code === 'ENOENT') {
      return { skipped: true, reason: 'python-not-found' };
    }
    // Fallback: basic syntax validation using py_compile
    let errors = 0;
    for (const file of files) {
      try {
        await execFileAsync(
          pythonCmd,
          ['-m', 'py_compile', file],
          { cwd: rootDir, timeout: 15000 }
        );
      } catch (_) {
        if (_.error && _.error.code === 'ENOENT') {
          return { skipped: true, reason: 'python-not-found' };
        }
        errors += 1;
      }
    }
    return { errors, warnings: 0, tool: 'py_compile' };
  }
}

async function runJavaLint(rootDir, files) {
  if (!files.length) return null;

  const mainFiles = files.filter(file => {
    const normalized = file.replace(/\\/g, '/').toLowerCase();
    return !normalized.includes('/src/test/');
  });

  if (!mainFiles.length) return null;

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'javac-'));

  try {
    const { stderr } = await execFileAsync(
      'javac',
      ['-Xlint:all', '-d', tempDir, ...mainFiles],
      { cwd: rootDir, timeout: 20000, maxBuffer: 5 * 1024 * 1024 }
    );

    const warnings = (stderr.match(/\bwarning:/g) || []).length;
    const samples = stderr
      .split('\n')
      .filter(line => line.includes('warning:'))
      .slice(0, MAX_SAMPLE_ITEMS)
      .map(line => ({ severity: 'warning', message: line.trim() }));
    return { errors: 0, warnings, tool: 'javac', samples };
  } catch (err) {
    if (err.error && err.error.code === 'ENOENT') {
      console.log('⚠️ javac not available, skipping Java lint');
      return { skipped: true, reason: 'javac-not-found' };
    }

    const stderr = err.stderr || '';
    const errors = (stderr.match(/\berror:/g) || []).length || 1;
    const warnings = (stderr.match(/\bwarning:/g) || []).length;
    const samples = stderr
      .split('\n')
      .filter(line => line.includes('error:') || line.includes('warning:'))
      .slice(0, MAX_SAMPLE_ITEMS)
      .map(line => ({
        severity: line.includes('error:') ? 'error' : 'warning',
        message: line.trim()
      }));
    return { errors, warnings, tool: 'javac', samples };
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

async function runGoLint(rootDir, files) {
  if (!files.length) return null;

  try {
    const { stdout } = await execFileAsync(
      'golangci-lint',
      ['run', '--out-format', 'json'],
      { cwd: rootDir, timeout: 20000, maxBuffer: 5 * 1024 * 1024 }
    );

    const parsed = JSON.parse(stdout || '{}');
    const issues = Array.isArray(parsed) ? parsed : (parsed.Issues || []);
    const errors = issues.length;
    const samples = issues.slice(0, MAX_SAMPLE_ITEMS).map(item => ({
      file: item.Pos && item.Pos.Filename ? path.basename(item.Pos.Filename) : undefined,
      ruleId: item.FromLinter || null,
      severity: 'error',
      message: item.Text,
      line: item.Pos ? item.Pos.Line : undefined,
      column: item.Pos ? item.Pos.Column : undefined
    }));
    return { errors, warnings: 0, tool: 'golangci-lint', samples };
  } catch (err) {
    if (err.error && err.error.code === 'ENOENT') {
      return { skipped: true, reason: 'golangci-lint-not-found' };
    }

    // Fallback to go vet if go exists
    try {
      const { stderr } = await execFileAsync(
        'go',
        ['vet', './...'],
        { cwd: rootDir, timeout: 20000, maxBuffer: 5 * 1024 * 1024 }
      );
      const errors = (stderr.match(/\.go:\d+:/g) || []).length;
      const samples = stderr
        .split('\n')
        .filter(line => line.includes('.go:'))
        .slice(0, MAX_SAMPLE_ITEMS)
        .map(line => ({ severity: 'error', message: line.trim() }));
      return { errors, warnings: 0, tool: 'go-vet', samples };
    } catch (vetErr) {
      if (vetErr.error && vetErr.error.code === 'ENOENT') {
        return { skipped: true, reason: 'go-not-found' };
      }
      const stderr = vetErr.stderr || '';
      const errors = (stderr.match(/\.go:\d+:/g) || []).length || 1;
      const samples = stderr
        .split('\n')
        .filter(line => line.includes('.go:'))
        .slice(0, MAX_SAMPLE_ITEMS)
        .map(line => ({ severity: 'error', message: line.trim() }));
      return { errors, warnings: 0, tool: 'go-vet', samples };
    }
  }
}

async function runPhpLint(rootDir, files) {
  if (!files.length) return null;

  let errors = 0;
  const samples = [];

  for (const file of files) {
    try {
      await execFileAsync('php', ['-l', file], { cwd: rootDir, timeout: 15000 });
    } catch (err) {
      if (err.error && err.error.code === 'ENOENT') {
        return { skipped: true, reason: 'php-not-found' };
      }
      errors += 1;
      if (samples.length < MAX_SAMPLE_ITEMS) {
        const msg = (err.stderr || err.stdout || '').trim();
        samples.push({ file: path.basename(file), severity: 'error', message: msg || 'PHP parse error' });
      }
    }
  }

  return { errors, warnings: 0, tool: 'php-lint', samples };
}

async function runRubyLint(rootDir, files) {
  if (!files.length) return null;

  let errors = 0;
  const samples = [];

  for (const file of files) {
    try {
      await execFileAsync('ruby', ['-c', file], { cwd: rootDir, timeout: 15000 });
    } catch (err) {
      if (err.error && err.error.code === 'ENOENT') {
        return { skipped: true, reason: 'ruby-not-found' };
      }
      errors += 1;
      if (samples.length < MAX_SAMPLE_ITEMS) {
        const msg = (err.stderr || err.stdout || '').trim();
        samples.push({ file: path.basename(file), severity: 'error', message: msg || 'Ruby syntax error' });
      }
    }
  }

  return { errors, warnings: 0, tool: 'ruby-check', samples };
}

async function runCLint(rootDir, cFiles, cppFiles) {
  if (!cFiles.length && !cppFiles.length) return null;

  let errors = 0;
  const samples = [];

  if (cFiles.length) {
    for (const file of cFiles) {
      try {
        await execFileAsync('gcc', ['-fsyntax-only', file], { cwd: rootDir, timeout: 15000 });
      } catch (err) {
        if (err.error && err.error.code === 'ENOENT') {
          return { skipped: true, reason: 'gcc-not-found' };
        }
        errors += 1;
        if (samples.length < MAX_SAMPLE_ITEMS) {
          const msg = (err.stderr || '').trim();
          samples.push({ file: path.basename(file), severity: 'error', message: msg || 'C syntax error' });
        }
      }
    }
  }

  if (cppFiles.length) {
    for (const file of cppFiles) {
      try {
        await execFileAsync('g++', ['-fsyntax-only', file], { cwd: rootDir, timeout: 15000 });
      } catch (err) {
        if (err.error && err.error.code === 'ENOENT') {
          return { skipped: true, reason: 'gpp-not-found' };
        }
        errors += 1;
        if (samples.length < MAX_SAMPLE_ITEMS) {
          const msg = (err.stderr || '').trim();
          samples.push({ file: path.basename(file), severity: 'error', message: msg || 'C++ syntax error' });
        }
      }
    }
  }

  return { errors, warnings: 0, tool: 'gcc/g++-syntax', samples };
}

async function runKotlinLint(rootDir, files) {
  if (!files.length) return null;

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kotlinc-'));
  try {
    const { stderr } = await execFileAsync(
      'kotlinc',
      [...files, '-d', tempDir],
      { cwd: rootDir, timeout: 20000, maxBuffer: 5 * 1024 * 1024 }
    );
    const warnings = (stderr.match(/warning:/g) || []).length;
    const samples = stderr
      .split('\n')
      .filter(line => line.includes('warning:'))
      .slice(0, MAX_SAMPLE_ITEMS)
      .map(line => ({ severity: 'warning', message: line.trim() }));
    return { errors: 0, warnings, tool: 'kotlinc', samples };
  } catch (err) {
    if (err.error && err.error.code === 'ENOENT') {
      return { skipped: true, reason: 'kotlinc-not-found' };
    }
    const stderr = err.stderr || '';
    const errors = (stderr.match(/error:/g) || []).length || 1;
    const warnings = (stderr.match(/warning:/g) || []).length;
    const samples = stderr
      .split('\n')
      .filter(line => line.includes('error:') || line.includes('warning:'))
      .slice(0, MAX_SAMPLE_ITEMS)
      .map(line => ({
        severity: line.includes('error:') ? 'error' : 'warning',
        message: line.trim()
      }));
    return { errors, warnings, tool: 'kotlinc', samples };
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

async function runCSharpLint(rootDir, csFiles, slnFiles, csprojFiles) {
  if (!csFiles.length) return null;

  const target = slnFiles[0] || csprojFiles[0];
  if (!target) {
    return { skipped: true, reason: 'csproj-not-found' };
  }

  try {
    const { stderr } = await execFileAsync(
      'dotnet',
      ['build', target, '-nologo', '-v', 'minimal'],
      { cwd: rootDir, timeout: 20000, maxBuffer: 5 * 1024 * 1024 }
    );
    const errors = (stderr.match(/\berror\b/gi) || []).length;
    const warnings = (stderr.match(/\bwarning\b/gi) || []).length;
    const samples = stderr
      .split('\n')
      .filter(line => /\berror\b|\bwarning\b/i.test(line))
      .slice(0, MAX_SAMPLE_ITEMS)
      .map(line => ({
        severity: /\berror\b/i.test(line) ? 'error' : 'warning',
        message: line.trim()
      }));
    return { errors, warnings, tool: 'dotnet-build', samples };
  } catch (err) {
    if (err.error && err.error.code === 'ENOENT') {
      return { skipped: true, reason: 'dotnet-not-found' };
    }
    const stderr = err.stderr || '';
    const errors = (stderr.match(/\berror\b/gi) || []).length || 1;
    const warnings = (stderr.match(/\bwarning\b/gi) || []).length;
    const samples = stderr
      .split('\n')
      .filter(line => /\berror\b|\bwarning\b/i.test(line))
      .slice(0, MAX_SAMPLE_ITEMS)
      .map(line => ({
        severity: /\berror\b/i.test(line) ? 'error' : 'warning',
        message: line.trim()
      }));
    return { errors, warnings, tool: 'dotnet-build', samples };
  }
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
    if (filesByType.py.length > 0) {
      console.log('🐍 Python files:', filesByType.py.slice(0, 5).map(f => path.basename(f)).join(', '), filesByType.py.length > 5 ? `... (+${filesByType.py.length - 5} more)` : '');
    }
    if (filesByType.java.length > 0) {
      console.log('☕ Java files:', filesByType.java.slice(0, 5).map(f => path.basename(f)).join(', '), filesByType.java.length > 5 ? `... (+${filesByType.java.length - 5} more)` : '');
    }
    if (filesByType.go.length > 0) {
      console.log('🦫 Go files:', filesByType.go.slice(0, 5).map(f => path.basename(f)).join(', '), filesByType.go.length > 5 ? `... (+${filesByType.go.length - 5} more)` : '');
    }
    if (filesByType.php.length > 0) {
      console.log('🐘 PHP files:', filesByType.php.slice(0, 5).map(f => path.basename(f)).join(', '), filesByType.php.length > 5 ? `... (+${filesByType.php.length - 5} more)` : '');
    }
    if (filesByType.rb.length > 0) {
      console.log('💎 Ruby files:', filesByType.rb.slice(0, 5).map(f => path.basename(f)).join(', '), filesByType.rb.length > 5 ? `... (+${filesByType.rb.length - 5} more)` : '');
    }
    if (filesByType.cs.length > 0) {
      console.log('🧩 C# files:', filesByType.cs.slice(0, 5).map(f => path.basename(f)).join(', '), filesByType.cs.length > 5 ? `... (+${filesByType.cs.length - 5} more)` : '');
    }
    if (filesByType.kotlin.length > 0) {
      console.log('🟣 Kotlin files:', filesByType.kotlin.slice(0, 5).map(f => path.basename(f)).join(', '), filesByType.kotlin.length > 5 ? `... (+${filesByType.kotlin.length - 5} more)` : '');
    }
    if (filesByType.c.length > 0 || filesByType.cpp.length > 0) {
      console.log('🧱 C/C++ files:', [...filesByType.c, ...filesByType.cpp].slice(0, 5).map(f => path.basename(f)).join(', '), (filesByType.c.length + filesByType.cpp.length) > 5 ? `... (+${filesByType.c.length + filesByType.cpp.length - 5} more)` : '');
    }

    let eslintSummary = null;
    let eslintReport = null;
    let eslintSamples = [];

    if (eslintArtifactReport && allEslintFiles.length) {
      eslintReport = eslintArtifactReport;
      eslintSummary = summarizeEslint(eslintArtifactReport);
      eslintSamples = collectEslintSamples(eslintArtifactReport, MAX_SAMPLE_ITEMS);
      console.log('✅ Using GitHub Actions artifact');
    } else if (allEslintFiles.length) {
      console.log('🔄 Running local ESLint on server...');
      eslintReport = await runLocalEslint(rootDir, allEslintFiles, hasEslint);
      eslintSummary = summarizeEslint(eslintReport);
      eslintSamples = collectEslintSamples(eslintReport, MAX_SAMPLE_ITEMS);
    }

    const htmlSummary = runHtmlHint(filesByType.html);
    const cssSummary = await runStylelint(rootDir, filesByType.css, hasStylelint);
    const pythonSummary = await runPythonLint(rootDir, filesByType.py);
    const javaSummary = await runJavaLint(rootDir, filesByType.java);
    const goSummary = await runGoLint(rootDir, filesByType.go);
    const phpSummary = await runPhpLint(rootDir, filesByType.php);
    const rubySummary = await runRubyLint(rootDir, filesByType.rb);
    const cSummary = await runCLint(rootDir, filesByType.c, filesByType.cpp);
    const kotlinSummary = await runKotlinLint(rootDir, filesByType.kotlin);
    const csharpSummary = await runCSharpLint(rootDir, filesByType.cs, filesByType.sln, filesByType.csproj);

    const tooling = [];
    const notes = [];
    const evidence = {};

    const scoringBuckets = [];

    if (eslintSummary) {
      scoringBuckets.push({
        label: 'eslint',
        files: allEslintFiles.length,
        errors: eslintSummary.errors,
        warnings: eslintSummary.warnings,
        score: calculateScoreFromCounts(eslintSummary.errors, eslintSummary.warnings)
      });
      if (eslintSamples.length) evidence.eslint = eslintSamples;
    }

    if (htmlSummary) {
      scoringBuckets.push({
        label: 'htmlhint',
        files: filesByType.html.length,
        errors: htmlSummary.errors,
        warnings: htmlSummary.warnings,
        score: calculateScoreFromCounts(htmlSummary.errors, htmlSummary.warnings)
      });
      if (htmlSummary.samples && htmlSummary.samples.length) evidence.htmlhint = htmlSummary.samples;
    }

    if (cssSummary) {
      scoringBuckets.push({
        label: 'stylelint',
        files: filesByType.css.length,
        errors: cssSummary.errors,
        warnings: cssSummary.warnings,
        score: calculateScoreFromCounts(cssSummary.errors, cssSummary.warnings)
      });
      if (cssSummary.samples && cssSummary.samples.length) evidence.stylelint = cssSummary.samples;
    }

    if (pythonSummary && !pythonSummary.skipped) {
      scoringBuckets.push({
        label: `python-${pythonSummary.tool}`,
        files: filesByType.py.length,
        errors: pythonSummary.errors,
        warnings: pythonSummary.warnings,
        score: calculateScoreFromCounts(pythonSummary.errors, pythonSummary.warnings)
      });
      tooling.push({ language: 'python', tool: pythonSummary.tool, status: 'ok' });
      if (pythonSummary.tool === 'py_compile') {
        notes.push('Python lint used syntax-only fallback (py_compile).');
      }
      if (pythonSummary.samples && pythonSummary.samples.length) evidence.python = pythonSummary.samples;
    } else if (pythonSummary && pythonSummary.skipped) {
      tooling.push({ language: 'python', tool: 'python', status: 'missing' });
      notes.push('Python lint skipped: python not found on server.');
    }

    if (javaSummary && !javaSummary.skipped) {
      scoringBuckets.push({
        label: `java-${javaSummary.tool}`,
        files: filesByType.java.length,
        errors: javaSummary.errors,
        warnings: javaSummary.warnings,
        score: calculateScoreFromCounts(javaSummary.errors, javaSummary.warnings)
      });
      tooling.push({ language: 'java', tool: javaSummary.tool, status: 'ok' });
      if (javaSummary.samples && javaSummary.samples.length) evidence.java = javaSummary.samples;
    } else if (javaSummary && javaSummary.skipped) {
      tooling.push({ language: 'java', tool: 'javac', status: 'missing' });
      notes.push('Java lint skipped: javac not found on server.');
    }

    if (goSummary && !goSummary.skipped) {
      scoringBuckets.push({
        label: `go-${goSummary.tool}`,
        files: filesByType.go.length,
        errors: goSummary.errors,
        warnings: goSummary.warnings,
        score: calculateScoreFromCounts(goSummary.errors, goSummary.warnings)
      });
      tooling.push({ language: 'go', tool: goSummary.tool, status: 'ok' });
      if (goSummary.samples && goSummary.samples.length) evidence.go = goSummary.samples;
    } else if (goSummary && goSummary.skipped) {
      tooling.push({ language: 'go', tool: 'golangci-lint/go', status: 'missing' });
      notes.push('Go lint skipped: golangci-lint/go not found on server.');
    }

    if (phpSummary && !phpSummary.skipped) {
      scoringBuckets.push({
        label: `php-${phpSummary.tool}`,
        files: filesByType.php.length,
        errors: phpSummary.errors,
        warnings: phpSummary.warnings,
        score: calculateScoreFromCounts(phpSummary.errors, phpSummary.warnings)
      });
      tooling.push({ language: 'php', tool: phpSummary.tool, status: 'ok' });
      if (phpSummary.samples && phpSummary.samples.length) evidence.php = phpSummary.samples;
    } else if (phpSummary && phpSummary.skipped) {
      tooling.push({ language: 'php', tool: 'php', status: 'missing' });
      notes.push('PHP lint skipped: php not found on server.');
    }

    if (rubySummary && !rubySummary.skipped) {
      scoringBuckets.push({
        label: `ruby-${rubySummary.tool}`,
        files: filesByType.rb.length,
        errors: rubySummary.errors,
        warnings: rubySummary.warnings,
        score: calculateScoreFromCounts(rubySummary.errors, rubySummary.warnings)
      });
      tooling.push({ language: 'ruby', tool: rubySummary.tool, status: 'ok' });
      if (rubySummary.samples && rubySummary.samples.length) evidence.ruby = rubySummary.samples;
    } else if (rubySummary && rubySummary.skipped) {
      tooling.push({ language: 'ruby', tool: 'ruby', status: 'missing' });
      notes.push('Ruby lint skipped: ruby not found on server.');
    }

    if (cSummary && !cSummary.skipped) {
      scoringBuckets.push({
        label: `c-${cSummary.tool}`,
        files: filesByType.c.length + filesByType.cpp.length,
        errors: cSummary.errors,
        warnings: cSummary.warnings,
        score: calculateScoreFromCounts(cSummary.errors, cSummary.warnings)
      });
      tooling.push({ language: 'c/cpp', tool: cSummary.tool, status: 'ok' });
      if (cSummary.samples && cSummary.samples.length) evidence.c = cSummary.samples;
    } else if (cSummary && cSummary.skipped) {
      tooling.push({ language: 'c/cpp', tool: 'gcc/g++', status: 'missing' });
      notes.push('C/C++ lint skipped: gcc/g++ not found on server.');
    }

    if (kotlinSummary && !kotlinSummary.skipped) {
      scoringBuckets.push({
        label: `kotlin-${kotlinSummary.tool}`,
        files: filesByType.kotlin.length,
        errors: kotlinSummary.errors,
        warnings: kotlinSummary.warnings,
        score: calculateScoreFromCounts(kotlinSummary.errors, kotlinSummary.warnings)
      });
      tooling.push({ language: 'kotlin', tool: kotlinSummary.tool, status: 'ok' });
      if (kotlinSummary.samples && kotlinSummary.samples.length) evidence.kotlin = kotlinSummary.samples;
    } else if (kotlinSummary && kotlinSummary.skipped) {
      tooling.push({ language: 'kotlin', tool: 'kotlinc', status: 'missing' });
      notes.push('Kotlin lint skipped: kotlinc not found on server.');
    }

    if (csharpSummary && !csharpSummary.skipped) {
      scoringBuckets.push({
        label: `csharp-${csharpSummary.tool}`,
        files: filesByType.cs.length,
        errors: csharpSummary.errors,
        warnings: csharpSummary.warnings,
        score: calculateScoreFromCounts(csharpSummary.errors, csharpSummary.warnings)
      });
      tooling.push({ language: 'csharp', tool: csharpSummary.tool, status: 'ok' });
      if (csharpSummary.samples && csharpSummary.samples.length) evidence.csharp = csharpSummary.samples;
    } else if (csharpSummary && csharpSummary.skipped) {
      tooling.push({ language: 'csharp', tool: 'dotnet', status: 'missing' });
      if (csharpSummary.reason === 'csproj-not-found') {
        notes.push('C# lint skipped: no .sln or .csproj found.');
      } else {
        notes.push('C# lint skipped: dotnet not found on server.');
      }
    }

    let totalErrors = 0;
    let totalWarnings = 0;
    let lintScore = null;

    if (scoringBuckets.length) {
      totalErrors = scoringBuckets.reduce((sum, b) => sum + b.errors, 0);
      totalWarnings = scoringBuckets.reduce((sum, b) => sum + b.warnings, 0);
      lintScore = calculateScoreFromCounts(totalErrors, totalWarnings);
    }

    const repoSignals = getRepoSignals(rootDir, filesByType);
    const productScore = calculateProductScore(repoSignals);
    const maintainability = calculateMaintainabilityScore(rootDir, filesByType);
    const performance = getPerformanceScore(rootDir);

    if (performance.score === null) {
      notes.push('Performance score not computed: no performance report found.');
    }

    const combinedScore = calculateCompositeScore({
      lint: lintScore,
      maintainability: maintainability.score,
      product: productScore,
      performance: performance.score
    });

    const report = {
      summary: scoringBuckets,
      files: {
        js: filesByType.js.length,
        jsx: filesByType.jsx.length,
        ts: filesByType.ts.length,
        tsx: filesByType.tsx.length,
        py: filesByType.py.length,
        java: filesByType.java.length,
        go: filesByType.go.length,
        php: filesByType.php.length,
        rb: filesByType.rb.length,
        cs: filesByType.cs.length,
        kotlin: filesByType.kotlin.length,
        c: filesByType.c.length,
        cpp: filesByType.cpp.length,
        html: filesByType.html.length,
        css: filesByType.css.length,
        other: filesByType.other.length
      },
      tooling: tooling.length ? tooling : undefined,
      notes: notes.length ? notes : undefined,
      evidence: Object.keys(evidence).length ? evidence : undefined,
      metrics: {
        scores: {
          lint: lintScore,
          maintainability: maintainability.score,
          product: productScore,
          performance: performance.score,
          combined: combinedScore
        },
        weights: SCORE_WEIGHTS,
        maintainability: maintainability.stats,
        product: repoSignals,
        performance: performance.score !== null ? {
          source: performance.source,
          details: performance.details
        } : undefined
      },
      note: scoringBuckets.length
        ? null
        : 'No supported lintable files found; lint score omitted from composite.'
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

const axios = require('axios');

async function processRepoForTeam(teamId, repoUrl) {
  // Mark evaluation as pending
  await pool.query(
    `UPDATE projects SET clean_code_status = $1, last_evaluated_at = $2 WHERE team_id = $3`,
    ['pending', new Date(), teamId]
  );

  // Fetch CodeFactor grade
  let grade = null;
  let errorMsg = null;
  try {
    // CodeFactor API is unofficial; fallback to scraping
    const codefactorUrl = `https://www.codefactor.io/repository/github/${repoUrl.replace('https://github.com/', '')}`;
    const res = await axios.get(codefactorUrl);
    const html = res.data;
    // Try to extract from <h1>CodeFactor Rating X</h1>
    let match = html.match(/<h1[^>]*>\s*CodeFactor Rating\s*([A-E][+-]?)\s*<\/h1>/i);
    if (!match || !match[1]) {
      // fallback: try badge alt attribute
      match = html.match(/alt="Repository badge with ([A-E][a-zA-Z]+) rating"/i);
      if (match && match[1]) {
        // Convert badge text to grade (e.g. BMinus → B-)
        const badgeMap = {
          'APlus': 'A+', 'A': 'A', 'AMinus': 'A-',
          'BPlus': 'B+', 'B': 'B', 'BMinus': 'B-',
          'CPlus': 'C+', 'C': 'C', 'CMinus': 'C-',
          'DPlus': 'D+', 'D': 'D', 'DMinus': 'D-',
          'EPlus': 'E+', 'E': 'E'
        };
        grade = badgeMap[match[1]] || match[1];
      }
    } else {
      grade = match[1].toUpperCase();
    }
    if (!grade) {
      errorMsg = 'Could not extract CodeFactor grade.';
    }
  } catch (err) {
    errorMsg = 'CodeFactor fetch failed: ' + err.message;
  }


  // Map grade (with +/-) to score
  const gradeToScore = {
    'A+': 100,
    'A': 95,
    'A-': 88,
    'B+': 85,
    'B': 80,
    'B-': 78,
    'C+': 75,
    'C': 70,
    'C-': 68,
    'D+': 65,
    'D': 60,
    'D-': 58,
    'E+': 55,
    'E': 50
  };

  // Try to match grade with +/-
  let mappedScore = 0;
  if (grade) {
    const normalized = grade.trim().toUpperCase();
    mappedScore = gradeToScore[normalized] !== undefined ? gradeToScore[normalized] : 50;
  }
  const score = mappedScore;

  // Save evaluation results
  await pool.query(
    `UPDATE projects SET clean_code_score = $1, eslint_error_count = $2, eslint_warning_count = $3, clean_code_report = $4, clean_code_status = $5, clean_code_failure_reason = $6, last_evaluated_at = $7 WHERE team_id = $8`,
    [score, null, null, JSON.stringify({ codefactor_grade: grade, codefactor_score: score, error: errorMsg }), grade ? 'success' : 'failed', errorMsg, new Date(), teamId]
  );

  return { score, report: { codefactor_grade: grade, codefactor_score: score, error: errorMsg } };
}

module.exports = { processRepoForTeam, calculateScoreFromCounts };
