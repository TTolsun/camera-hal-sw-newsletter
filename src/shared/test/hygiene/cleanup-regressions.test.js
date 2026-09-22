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
    'docs/NEWSROOM_WORKFLOW.md',
    'docs/GLOSSARY.md',
    'docs/evidence/SOURCE_AWARE_LINKED_EVIDENCE_CONTRACT.md'
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
    /articles\/content\/newsroom\/\d{4}-\d{2}-\d{2}/g,
    /articles\/content\/collected-news\/\d{4}-\d{2}-\d{2}/g,
    /articles\/newsletters\/\d{4}-\d{2}-\d{2}/g
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
  walk(path.join(REPO_ROOT, 'src', 'shared', 'test', 'fixtures'));
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

test('src does not require legacy scripts/lib shim modules', () => {
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
  // #262 src 재구성 완료 후 구현 코드는 모두 src/ 아래에 있습니다.
  for (const root of [path.join(REPO_ROOT, 'src')]) {
    if (fs.existsSync(root)) walk(root);
  }
  assert.deepEqual(issues, [], issues.join('\n'));
});

// #1090 T11 사후 정리로 비운 모듈입니다. 정리한 상태를 유지하기 위해 이 목록에만 단언합니다.
// src 전체로 넓히면 T11 범위를 벗어납니다(다른 모듈에는 아직 정리하지 않은 잔재가 남아 있습니다).
const CLEANUP_WATCHED_MODULES = [
  'src/generator/quality/newsletter-quality.js',
  'src/generator/reporter/public-article-contract.js'
];

// 아래 검출기들은 정규식이며 AST가 아닙니다. 이름이 주석이나 문자열 안에 나와도 사용으로 셉니다.
// 그래서 실제로 죽은 것을 놓칠 수는 있습니다. 반대 방향(살아 있는 이름을 위반으로 올리는 것)은
// rename·default·rest 형태의 destructuring까지 아래 단위 테스트로 집행해 막습니다.
function nameOccurrenceCount(text, name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return (text.match(new RegExp('\\b' + escaped + '\\b', 'g')) || []).length;
}

// `a`, `a: b`, `a = 1`, `a: b = 1` 중 실제 지역 바인딩 이름을 집습니다.
// 기본값을 먼저 떼야 기본값 안의 `:`가 rename으로 오인되지 않습니다.
// rest(`...rest`)는 개별 import 이름이 아니므로 빈 문자열을 돌려 검사에서 제외합니다.
function localBindingName(entry) {
  if (entry.startsWith('...')) return '';
  return entry.split('=')[0].split(':').pop().trim();
}

function unusedDestructuredImports(text, label) {
  const issues = [];
  const requireRe = /const\s*\{([^}]*)\}\s*=\s*require\(([^)]*)\);/g;
  let match;
  while ((match = requireRe.exec(text)) !== null) {
    const moduleRef = match[2].trim();
    const entries = match[1]
      .split(',')
      .map(part => part.trim())
      .filter(Boolean);
    for (const entry of entries) {
      const name = localBindingName(entry);
      if (!name) continue;
      if (nameOccurrenceCount(text, name) <= 1) {
        issues.push(`${label} imports unused name ${name} from ${moduleRef}`);
      }
    }
  }
  return issues;
}

function unreferencedTopLevelFunctions(text, label) {
  const issues = [];
  const declRe = /^function\s+([A-Za-z_$][\w$]*)\s*\(/gm;
  let match;
  while ((match = declRe.exec(text)) !== null) {
    const name = match[1];
    if (nameOccurrenceCount(text, name) <= 1) {
      issues.push(`${label} declares unreferenced function ${name}`);
    }
  }
  return issues;
}

test('the unused-import detector keeps renamed, defaulted and rest bindings', () => {
  const renamed = [
    "const { sourceKey: localName } = require('./m');",
    "console.log(localName);"
  ].join('\n');
  assert.deepEqual(unusedDestructuredImports(renamed, 'renamed.js'), []);

  const defaulted = [
    "const { other = 1 } = require('./n');",
    "console.log(other);"
  ].join('\n');
  assert.deepEqual(unusedDestructuredImports(defaulted, 'defaulted.js'), []);

  const renamedButUnused = "const { sourceKey: neverUsed } = require('./o');";
  assert.deepEqual(
    unusedDestructuredImports(renamedButUnused, 'unused.js'),
    ["unused.js imports unused name neverUsed from './o'"]
  );

  const withRest = [
    "const { keptName, ...remaining } = require('./p');",
    "console.log(keptName, remaining);"
  ].join('\n');
  assert.deepEqual(unusedDestructuredImports(withRest, 'rest.js'), []);
});

test('watched cleanup modules have no unused destructured imports', () => {
  const issues = [];
  for (const relPath of CLEANUP_WATCHED_MODULES) {
    issues.push(...unusedDestructuredImports(readRepoText(relPath), relPath));
  }
  assert.deepEqual(issues, [], issues.join('\n'));
});

test('watched cleanup modules have no unreferenced top-level functions', () => {
  const issues = [];
  for (const relPath of CLEANUP_WATCHED_MODULES) {
    issues.push(...unreferencedTopLevelFunctions(readRepoText(relPath), relPath));
  }
  assert.deepEqual(issues, [], issues.join('\n'));
});
