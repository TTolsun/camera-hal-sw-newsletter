'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const { retentionCommitAllowlist } = require('../../../publish/review-artifact-inventory');
const { writeWeeklyNewsletterArtifacts } = require('../../../render/weekly-newsletter-output');

function tempRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'weekly-allowlist-'));
}

function draft() {
  return {
    date: '2026-06-04', title: 'Daily', summary: 's', briefing: ['a', 'b', 'c'],
    sections: [{
      category: 'Android Camera', headline: 'CameraX', what_changed: 'x', evidence_summary: 'e',
      confirmed_facts: ['f1', 'f2'], specificity_checks: ['v=1'], source_verification_notes: ['o'],
      camera_hal_checks: ['c1', 'c2'], action_items: ['a1', 'a2'],
      article_sections: { verified_facts: ['f1'], background_context: 'b', hal_driver_impact: 'p', action_items: ['a1'], team_share_points: 't' },
      public_article: { headline: 'CameraX', lead: 'lead', body_paragraphs: ['p1', 'p2'], camera_hal_takeaway: 'k', reader_checkpoints: ['c1', 'c2'],
        source_links: [{ title: 'Android', url: 'https://developer.android.com/jetpack/androidx/releases/camera#1.7.0', source_role: 'primary' }] },
      sources: [{ title: 'Android', url: 'https://developer.android.com/jetpack/androidx/releases/camera#1.7.0' }]
    }],
    action_items: ['a1'], references: [{ title: 'Android', url: 'https://developer.android.com/jetpack/androidx/releases/camera#1.7.0' }]
  };
}

test('retentionCommitAllowlist includes the weekly artifacts when they are present', async () => {
  const root = tempRoot();
  await writeWeeklyNewsletterArtifacts({ root, date: '2026-06-04', editor: draft() });
  const allow = retentionCommitAllowlist({ root, date: '2026-06-04', runContext: { publicOutputExpected: true } });
  assert.ok(allow.includes('articles/newsletters/2026-W23/index.html'), allow.join('\n'));
  assert.ok(allow.includes('articles/newsletters/2026-W23/newsletter.md'));
  assert.ok(allow.includes('articles/newsletters/2026-W23/issue.json'));
  assert.ok(allow.includes('articles/data/newsletters-weekly.json'));
});

test('retentionCommitAllowlist omits the weekly artifacts when they are absent', async () => {
  const root = tempRoot();
  const allow = retentionCommitAllowlist({ root, date: '2026-06-04', runContext: { publicOutputExpected: true } });
  assert.ok(!allow.some(p => p.startsWith('articles/newsletters/2026-W23/')), allow.join('\n'));
  assert.ok(!allow.includes('articles/data/newsletters-weekly.json'));
});

// #1189: 진단 전용 실행(generation status가 public_output_expected: false를 명시)의 PR에는 공개 페이지가
// 실리면 안 된다(.github/workflows/AGENTS.md). 생산자가 계약을 어겨 공개 경로를 써도 커밋 목록에서 빠지고,
// 뺀 경로는 보고되어야 한다. status가 없거나 true면 커밋 목록은 지금과 같아야 한다 — CLI는 runContext를
// 넘기지 않으므로 runContext 기본값(false)을 쓰면 정상 발행 PR에서 공개 파일이 빠진다.
const { retentionCommitPlan } = require('../../../publish/review-artifact-inventory');

const DAILY_DATE = '2026-06-04';
const PUBLIC_PAGE_PATHS = [
  `articles/newsletters/${DAILY_DATE}/index.html`,
  `articles/newsletters/${DAILY_DATE}/newsletter.md`,
  'articles/newsletters/2026-W23/index.html',
  'articles/newsletters/2026-W23/newsletter.md',
  'articles/newsletters/2026-W23/issue.json',
  'articles/data/newsletters-weekly.json',
  'articles/sitemap.xml'
];
// 진단 전용 실행에서도 정당하게 바뀌는 파일: reconciliation이 날짜 항목을 지우고 archive 상태를 기록한다.
const KEPT_PUBLIC_STATE_PATHS = [
  'articles/data/newsletters.json',
  'articles/content/audit/historical-archive-status.json'
];

function writeFile(root, relPath, content) {
  const filePath = path.join(root, ...relPath.split('/'));
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
}

async function rootWithPublicPages(status) {
  const root = tempRoot();
  await writeWeeklyNewsletterArtifacts({ root, date: DAILY_DATE, editor: draft() });
  writeFile(root, `articles/newsletters/${DAILY_DATE}/index.html`, '<html></html>\n');
  writeFile(root, `articles/newsletters/${DAILY_DATE}/newsletter.md`, '# Daily\n');
  writeFile(root, 'articles/data/newsletters.json', '[]\n');
  writeFile(root, 'articles/content/audit/historical-archive-status.json', '[]\n');
  writeFile(root, `articles/content/newsroom/${DAILY_DATE}/editor-draft.md`, '# Draft\n');
  if (status) {
    writeFile(root, `articles/content/newsroom/${DAILY_DATE}/generation-status.json`, `${JSON.stringify(status)}\n`);
  }
  for (const relPath of PUBLIC_PAGE_PATHS) {
    assert.ok(fs.existsSync(path.join(root, ...relPath.split('/'))), `fixture missing ${relPath}`);
  }
  return root;
}

test('retentionCommitPlan drops public pages and reports them when the run expects no public output', async () => {
  const root = await rootWithPublicPages({ date: DAILY_DATE, status: 'FAILED_REPAIR_REVIEWABLE', public_output_expected: false });

  const plan = retentionCommitPlan({ root, date: DAILY_DATE });

  for (const relPath of PUBLIC_PAGE_PATHS) {
    assert.ok(!plan.paths.includes(relPath), `${relPath} must not be committed:\n${plan.paths.join('\n')}`);
  }
  assert.deepEqual(plan.excludedPublicPaths, [...PUBLIC_PAGE_PATHS].sort());
  for (const relPath of KEPT_PUBLIC_STATE_PATHS) {
    assert.ok(plan.paths.includes(relPath), `${relPath} must stay committed`);
  }
  assert.ok(plan.paths.includes(`articles/content/newsroom/${DAILY_DATE}/generation-status.json`));
  assert.deepEqual(retentionCommitAllowlist({ root, date: DAILY_DATE }), plan.paths);
});

test('retentionCommitPlan keeps the commit list unchanged when public output is expected or unrecorded', async () => {
  for (const status of [
    { date: DAILY_DATE, status: 'PASS', public_output_expected: true },
    { date: DAILY_DATE, status: 'PASS' },
    null
  ]) {
    const root = await rootWithPublicPages(status);

    const plan = retentionCommitPlan({ root, date: DAILY_DATE });

    for (const relPath of [...PUBLIC_PAGE_PATHS, ...KEPT_PUBLIC_STATE_PATHS]) {
      assert.ok(plan.paths.includes(relPath), `${JSON.stringify(status)}: ${relPath} must be committed`);
    }
    assert.deepEqual(plan.excludedPublicPaths, [], JSON.stringify(status));
  }
});

const { execFileSync, spawnSync } = require('node:child_process');
const CLI_PATH = path.join(__dirname, '..', '..', '..', 'publish', 'print-retention-commit-allowlist.js');

function runCli(root) {
  const summaryPath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'allowlist-summary-')), 'summary.md');
  const result = spawnSync(process.execPath, [CLI_PATH, '--date', DAILY_DATE, '--root', root], {
    encoding: 'utf8',
    env: { ...process.env, GITHUB_STEP_SUMMARY: summaryPath }
  });
  assert.equal(result.status, 0, result.stderr);
  return {
    printed: result.stdout.trim().split(/\r?\n/),
    stderr: result.stderr,
    summary: fs.existsSync(summaryPath) ? fs.readFileSync(summaryPath, 'utf8') : ''
  };
}

// 주간 페이지·sitemap은 앞선 발행으로 main에 이미 있다. 진단 전용 실행이 건드리지 않았으면 빼기만 하고
// 경고하지 않는다. 경고는 HEAD와 달라진 공개 경로, 즉 계약을 어긴 생산자의 흔적만 가리킨다.
test('print-retention-commit-allowlist warns only about public pages the run changed', async () => {
  const root = await rootWithPublicPages({ date: DAILY_DATE, status: 'FAILED_REPAIR_REVIEWABLE', public_output_expected: false });
  fs.rmSync(path.join(root, 'articles', 'newsletters', DAILY_DATE), { recursive: true });
  execFileSync('git', ['init'], { cwd: root, stdio: 'ignore' });
  execFileSync('git', ['add', '--all'], { cwd: root, stdio: 'ignore' });
  execFileSync('git', ['-c', 'user.email=test@example.com', '-c', 'user.name=test', 'commit', '-m', 'published week'],
    { cwd: root, stdio: 'ignore' });

  const untouched = runCli(root);

  for (const relPath of PUBLIC_PAGE_PATHS) {
    assert.ok(!untouched.printed.includes(relPath), `stdout must not list ${relPath}`);
  }
  assert.doesNotMatch(untouched.stderr, /WARNING/);
  assert.equal(untouched.summary, '');

  // 생산자가 계약을 어겨 일간 페이지를 새로 쓰고 발행된 주간 페이지를 고친 경우.
  writeFile(root, `articles/newsletters/${DAILY_DATE}/index.html`, '<html></html>\n');
  writeFile(root, `articles/newsletters/${DAILY_DATE}/newsletter.md`, '# Daily\n');
  writeFile(root, 'articles/newsletters/2026-W23/newsletter.md', '# Rewritten weekly\n');
  const leaked = [
    `articles/newsletters/${DAILY_DATE}/index.html`,
    `articles/newsletters/${DAILY_DATE}/newsletter.md`,
    'articles/newsletters/2026-W23/newsletter.md'
  ];

  const changed = runCli(root);

  for (const relPath of PUBLIC_PAGE_PATHS) {
    assert.ok(!changed.printed.includes(relPath), `stdout must not list ${relPath}`);
    const expected = leaked.includes(relPath);
    assert.equal(changed.stderr.includes(relPath), expected, `stderr naming ${relPath}`);
    assert.equal(changed.summary.includes(relPath), expected, `summary naming ${relPath}`);
  }
  assert.match(changed.stderr, /find and fix that producer/);
});

test('print-retention-commit-allowlist reports every dropped page when git cannot compare', async () => {
  const root = await rootWithPublicPages({ date: DAILY_DATE, status: 'FAILED_REPAIR_REVIEWABLE', public_output_expected: false });

  const result = runCli(root);

  assert.match(result.stderr, /git could not tell whether they changed/);
  for (const relPath of PUBLIC_PAGE_PATHS) {
    assert.ok(!result.printed.includes(relPath), `stdout must not list ${relPath}`);
    assert.ok(result.stderr.includes(relPath), `stderr must name ${relPath}`);
    assert.ok(result.summary.includes(relPath), `summary must name ${relPath}`);
  }
});
