const assert = require('node:assert/strict');
const { execSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..', '..');

function readRepoText(relPath) {
  return fs.readFileSync(path.join(REPO_ROOT, relPath), 'utf8');
}

test('package.json scripts targets exist', () => {
  const pkg = JSON.parse(readRepoText('package.json'));
  const issues = [];
  for (const [name, cmd] of Object.entries(pkg.scripts || {})) {
    const matches = cmd.match(/(?:^|\s)scripts\/[^\s]+\.(?:js|cjs|mjs)/g) || [];
    for (const ref of matches) {
      const target = ref.trim();
      if (!fs.existsSync(path.join(REPO_ROOT, target))) {
        issues.push(`script "${name}" references missing file: ${target}`);
      }
    }
  }
  assert.deepEqual(issues, [], issues.join('\n'));
});

test('active docs reference existing scripts paths', () => {
  const activeDocs = [
    'README.md',
    'docs/newsroom-workflow.md',
    'docs/glossary.ko.md',
    'docs/evidence/source-aware-linked-evidence-contract.md'
  ];
  const issues = [];
  for (const docPath of activeDocs) {
    if (!fs.existsSync(path.join(REPO_ROOT, docPath))) continue;
    const text = readRepoText(docPath);
    const matches = text.match(/scripts\/[^\s`'"<>()\]]+\.(?:js|cjs|mjs)/g) || [];
    for (const ref of matches) {
      if (!fs.existsSync(path.join(REPO_ROOT, ref))) {
        issues.push(`${docPath} references missing file: ${ref}`);
      }
    }
  }
  assert.deepEqual(issues, [], issues.join('\n'));
});

test('tests/fixtures does not embed generated-artifact YYYY-MM-DD paths', () => {
  const datePatterns = [
    /content\/newsroom\/\d{4}-\d{2}-\d{2}/g,
    /content\/collected-news\/\d{4}-\d{2}-\d{2}/g,
    /newsletters\/\d{4}-\d{2}-\d{2}/g
  ];
  const issues = [];
  function walk(dir) {
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) { walk(full); continue; }
      if (!/\.(json|md|txt|html|xml)$/i.test(ent.name)) continue;
      const text = fs.readFileSync(full, 'utf8');
      for (const pat of datePatterns) {
        const m = text.match(pat);
        if (m) {
          issues.push(`${path.relative(REPO_ROOT, full)} contains generated-artifact path: ${m[0]}`);
        }
      }
    }
  }
  walk(path.join(REPO_ROOT, 'src', 'core', 'test', 'fixtures', 'fixtures'));
  assert.deepEqual(issues, [], issues.join('\n'));
});

test('repo root has no scratch/temp tracked files', () => {
  const banned = [/^plan.*\.md$/i, /^worklog.*\.md$/i, /^debug-.*\.js$/i, /\.tmp$/i, /\.bak$/i];
  const issues = [];
  const tracked = execSync('git ls-files', { cwd: REPO_ROOT, encoding: 'utf8' })
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0 && !line.includes('/'));
  for (const name of tracked) {
    if (banned.some(rx => rx.test(name))) {
      issues.push(`tracked scratch/temp file at repo root: ${name}`);
    }
  }
  assert.deepEqual(issues, [], issues.join('\n'));
});

test('scripts/newsroom does not require scripts/lib shim modules', () => {
  const issues = [];
  function walk(dir) {
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) { walk(full); continue; }
      if (!/\.(js|cjs|mjs)$/i.test(ent.name)) continue;
      const text = fs.readFileSync(full, 'utf8');
      const matches = text.match(/require\([^)]*['"]([^'"]*scripts\/lib\/[^'"]+)['"]\)/g) || [];
      for (const m of matches) {
        issues.push(`${path.relative(REPO_ROOT, full)} requires shim module: ${m}`);
      }
    }
  }
  // 구현 코드가 src 재구성(#262) 중에는 scripts/newsroom 과 src 양쪽에 있으므로 둘 다 검사합니다.
  for (const root of [path.join(REPO_ROOT, 'scripts', 'newsroom'), path.join(REPO_ROOT, 'src')]) {
    if (fs.existsSync(root)) walk(root);
  }
  assert.deepEqual(issues, [], issues.join('\n'));
});
