'use strict';

// #1142: 주간 페이지의 콘텐츠 계약 레인. 변경된 주간 키(+이번 발행 주 키)만 hard fail이고,
// 나머지 과거 호는 warning-only로 남는다. strict 판정이 뒤집히면 과거 호 하나가 어긋났을 때
// 이후 모든 실행의 발행 검증이 막히거나, 반대로 이번 주 결함이 경고로 새어 나간다.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const {
  validateIndexedWeeklyNewsletters
} = require('../../validate/validate-public-newsletter');
const {
  tempRoot,
  writeJson,
  writeText
} = require('../../../shared/test/helpers/fs');

const WEEKLY_KEY = '2026-W37';
const REPO_ROOT = path.join(__dirname, '..', '..', '..', '..');

// 발행된 실제 주간호를 그대로 쓴다. 이 레인의 strict 승격 근거가 "발행본 전수가 이 검사를
// 통과한다"이므로, 픽스처가 그 사실 자체를 회귀로 잠근다. W37이 나중에 표적 패치되어 계약을
// 어기게 되면 이 테스트는 게이트 회귀가 아니라 픽스처 사유로 깨진다 — 그때는 통과하는 다른
// 발행 호로 WEEKLY_KEY를 교체한다.
function stageWeeklyIssue(root, { html } = {}) {
  const issueDir = path.join(root, 'articles', 'newsletters', WEEKLY_KEY);
  fs.mkdirSync(issueDir, { recursive: true });
  writeText(
    path.join(issueDir, 'newsletter.md'),
    fs.readFileSync(path.join(REPO_ROOT, 'articles', 'newsletters', WEEKLY_KEY, 'newsletter.md'), 'utf8')
  );
  const publishedHtml = fs.readFileSync(
    path.join(REPO_ROOT, 'articles', 'newsletters', WEEKLY_KEY, 'index.html'),
    'utf8'
  );
  writeText(path.join(issueDir, 'index.html'), html ? html(publishedHtml) : publishedHtml);
  writeJson(path.join(root, 'articles', 'data', 'newsletters-weekly.json'), [{
    weeklyKey: WEEKLY_KEY,
    date: '2026-09-07',
    title: `Camera HAL / SW Newsletter - ${WEEKLY_KEY}`,
    html: `newsletters/${WEEKLY_KEY}/index.html`,
    md: `newsletters/${WEEKLY_KEY}/newsletter.md`
  }]);
}

test('a published weekly page passes the weekly content-contract lane', () => {
  const root = tempRoot('weekly-lane-clean-');
  stageWeeklyIssue(root);

  const result = validateIndexedWeeklyNewsletters({
    rootDir: root,
    strictKeys: new Set([WEEKLY_KEY])
  });

  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.warnings, []);
});

test('a contract violation on a strict weekly key is a hard failure', () => {
  const root = tempRoot('weekly-lane-strict-');
  stageWeeklyIssue(root, {
    html: published => published.replace('</body>', '<p>Review-only quality gate output</p></body>')
  });

  const result = validateIndexedWeeklyNewsletters({
    rootDir: root,
    strictKeys: new Set([WEEKLY_KEY])
  });

  assert.ok(
    result.errors.some(error => error.startsWith(`weekly ${WEEKLY_KEY}:`)),
    `strict 주간 키의 위반은 error여야 한다. 실제: ${JSON.stringify(result)}`
  );
  assert.deepEqual(result.warnings, []);
});

test('the same violation on an unchanged historical weekly key stays warning-only', () => {
  const root = tempRoot('weekly-lane-historical-');
  stageWeeklyIssue(root, {
    html: published => published.replace('</body>', '<p>Review-only quality gate output</p></body>')
  });

  const result = validateIndexedWeeklyNewsletters({
    rootDir: root,
    strictKeys: new Set()
  });

  assert.deepEqual(result.errors, [], '변경되지 않은 과거 호는 hard fail이 아니어야 한다.');
  assert.ok(
    result.warnings.some(warning => warning.startsWith(`weekly ${WEEKLY_KEY}:`)),
    `과거 호 위반은 warning으로 남아야 한다. 실제: ${JSON.stringify(result)}`
  );
});

test('a missing weekly index is not a failure', () => {
  const root = tempRoot('weekly-lane-absent-');

  const result = validateIndexedWeeklyNewsletters({ rootDir: root, strictKeys: new Set() });

  assert.deepEqual(result, { errors: [], warnings: [] });
});

// 색인 엔트리와 실체 파일은 같은 발행 커밋에서 함께 생기므로, strict 키에서 엔트리만 있고
// 파일이 없는 것은 불일치다. 과거 호의 부재는 이 레인이 아니라 validate:site 층의 몫이다.
test('an indexed strict weekly entry with missing files is a hard failure', () => {
  const root = tempRoot('weekly-lane-missing-files-');
  writeJson(path.join(root, 'articles', 'data', 'newsletters-weekly.json'), [{
    weeklyKey: WEEKLY_KEY,
    date: '2026-09-07',
    html: `newsletters/${WEEKLY_KEY}/index.html`,
    md: `newsletters/${WEEKLY_KEY}/newsletter.md`
  }]);

  const strictResult = validateIndexedWeeklyNewsletters({
    rootDir: root,
    strictKeys: new Set([WEEKLY_KEY])
  });
  const historicalResult = validateIndexedWeeklyNewsletters({
    rootDir: root,
    strictKeys: new Set()
  });

  assert.ok(
    strictResult.errors.some(error => /files are missing/.test(error)),
    `strict 키의 파일 부재는 error여야 한다. 실제: ${JSON.stringify(strictResult)}`
  );
  assert.deepEqual(historicalResult, { errors: [], warnings: [] }, '과거 호의 부재는 이 레인에서 침묵 통과한다.');
});

// REQUIRE_PUBLIC_NEWSLETTER_CONTRACT=1은 일간 레인과 같은 의미의 명시적 escape hatch다 —
// 과거 호 위반도 hard fail로 승격된다.
test('REQUIRE_PUBLIC_NEWSLETTER_CONTRACT promotes historical weekly violations to errors', () => {
  const root = tempRoot('weekly-lane-require-all-');
  stageWeeklyIssue(root, {
    html: published => published.replace('</body>', '<p>Review-only quality gate output</p></body>')
  });

  const previous = process.env.REQUIRE_PUBLIC_NEWSLETTER_CONTRACT;
  process.env.REQUIRE_PUBLIC_NEWSLETTER_CONTRACT = '1';
  try {
    const result = validateIndexedWeeklyNewsletters({ rootDir: root, strictKeys: new Set() });
    assert.ok(
      result.errors.some(error => error.startsWith(`weekly ${WEEKLY_KEY}:`)),
      `requireAll이면 과거 호 위반도 error여야 한다. 실제: ${JSON.stringify(result)}`
    );
    assert.deepEqual(result.warnings, []);
  } finally {
    if (previous === undefined) delete process.env.REQUIRE_PUBLIC_NEWSLETTER_CONTRACT;
    else process.env.REQUIRE_PUBLIC_NEWSLETTER_CONTRACT = previous;
  }
});
