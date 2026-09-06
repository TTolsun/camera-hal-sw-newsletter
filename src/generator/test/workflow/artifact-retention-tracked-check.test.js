const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const {
  checkArtifactRetentionTracked,
  mustNotBeTracked
} = require('../../../shared/tooling/validate/artifact-retention-tracked-check');
const {
  DEBUG_HEAVY,
  TRANSIENT_ATTEMPT,
  REVIEW_REQUIRED_COMPACT,
  classifyArtifactPath,
  retentionCommitAllowlist
} = require('../../publish/review-artifact-inventory');

// Pass a fake tracked-paths list via _trackedPaths to avoid real git invocation in tests.
function makeCheck(trackedPaths) {
  return checkArtifactRetentionTracked({ _trackedPaths: trackedPaths });
}

test('mustNotBeTracked returns true for DEBUG_HEAVY debug_evidence file', () => {
  const classification = classifyArtifactPath('articles/content/newsroom/2026-05-05/shortlisted-candidates.json');
  assert.ok(classification, 'shortlisted-candidates.json must be classified');
  assert.equal(classification.retention_grade, DEBUG_HEAVY);
  assert.equal(mustNotBeTracked(classification), true);
});

test('mustNotBeTracked returns true for TRANSIENT_ATTEMPT attempt file', () => {
  const classification = classifyArtifactPath('articles/content/newsroom/2026-05-05/editor-draft-attempt-1.json');
  assert.ok(classification, 'attempt file must be classified');
  assert.equal(classification.retention_grade, TRANSIENT_ATTEMPT);
  assert.equal(mustNotBeTracked(classification), true);
});

test('mustNotBeTracked returns false for REVIEW_REQUIRED_COMPACT compact file', () => {
  const classification = classifyArtifactPath('articles/content/newsroom/2026-05-05/selection-report.md');
  assert.ok(classification, 'selection-report.md must be classified');
  assert.equal(classification.retention_grade, REVIEW_REQUIRED_COMPACT);
  assert.equal(mustNotBeTracked(classification), false);
});

// 심층 리포트는 뉴스레터 PR에 함께 커밋된다. 분류가 빠지거나 DEBUG_HEAVY로 돌아가면
// mustNotBeTracked가 true가 되어, 커밋된 리포트가 retention 위반으로 잡힌다.
test('deep-dive-report.json is classified REVIEW_REQUIRED_COMPACT and stays committable', () => {
  const classification = classifyArtifactPath('articles/content/newsroom/2026-05-05/deep-dive-report.json');
  assert.ok(classification, 'deep-dive-report.json must be classified');
  assert.equal(classification.retention_grade, REVIEW_REQUIRED_COMPACT);
  assert.equal(mustNotBeTracked(classification), false);
});

test('mustNotBeTracked returns false for unknown_artifacts group', () => {
  assert.equal(mustNotBeTracked({ retention_grade: DEBUG_HEAVY, group: 'unknown_artifacts' }), false);
  assert.equal(mustNotBeTracked({ retention_grade: TRANSIENT_ATTEMPT, group: 'unknown_artifacts' }), false);
});

test('recovery-prompt.md is classified DEBUG_HEAVY debug_evidence', () => {
  const classification = classifyArtifactPath('articles/content/newsroom/2026-05-05/recovery-prompt.md');
  assert.ok(classification, 'recovery-prompt.md must be classified');
  assert.equal(classification.retention_grade, DEBUG_HEAVY);
  assert.equal(classification.group, 'debug_evidence');
  assert.equal(mustNotBeTracked(classification), true);
});

test('check FLAGS a tracked DEBUG_HEAVY file (shortlisted-candidates.json)', () => {
  const result = makeCheck(['articles/content/newsroom/2026-05-05/shortlisted-candidates.json']);
  assert.equal(result.ok, false, 'should fail when DEBUG_HEAVY file is tracked');
  assert.equal(result.violations.length, 1);
  assert.equal(result.violations[0].path, 'articles/content/newsroom/2026-05-05/shortlisted-candidates.json');
  assert.equal(result.violations[0].grade, DEBUG_HEAVY);
});

test('check FLAGS a tracked TRANSIENT_ATTEMPT attempt file', () => {
  const result = makeCheck(['articles/content/newsroom/2026-05-05/reporter-candidates-attempt-1.json']);
  assert.equal(result.ok, false, 'should fail when TRANSIENT_ATTEMPT file is tracked');
  assert.equal(result.violations.length, 1);
  assert.equal(result.violations[0].grade, TRANSIENT_ATTEMPT);
});

test('check FLAGS a tracked recovery-prompt.md (now DEBUG_HEAVY)', () => {
  const result = makeCheck(['articles/content/newsroom/2026-05-05/recovery-prompt.md']);
  assert.equal(result.ok, false, 'recovery-prompt.md must be flagged as violation');
  assert.equal(result.violations.length, 1);
  assert.equal(result.violations[0].grade, DEBUG_HEAVY);
});

test('check PASSES when only REVIEW_REQUIRED_COMPACT files are present', () => {
  const result = makeCheck([
    'articles/content/newsroom/2026-05-05/selection-report.md',
    'articles/content/newsroom/2026-05-05/quality-report.md',
    'articles/content/newsroom/2026-05-05/fact-check-report.md'
  ]);
  assert.equal(result.ok, true, 'should pass for REVIEW_REQUIRED_COMPACT-only files');
  assert.equal(result.violations.length, 0);
});

test('check PASSES when only PUBLIC_SOURCE_OF_TRUTH files are present', () => {
  const result = makeCheck([
    'articles/content/newsroom/2026-05-05/artifact-manifest.json'
  ]);
  // artifact-manifest.json is REVIEW_REQUIRED_COMPACT (explicit override in debugExactCatalog)
  assert.equal(result.ok, true);
  assert.equal(result.violations.length, 0);
});

test('check only WARNS (not fails) for unrecognized filename', () => {
  const result = makeCheck(['articles/content/newsroom/2026-05-05/some-unknown-file-xyz.json']);
  // unknown_artifacts never cause hard failure
  assert.equal(result.ok, true, 'unrecognized file must not cause failure');
  assert.ok(result.warnings.length > 0, 'unrecognized file should produce a warning');
});

// news-candidates.md는 workflow 01이 articles/content/newsroom/<date>/에 쓰지만, 01의 git add
// 목록에는 그 경로가 없다. 그래서 이 파일은 실제로 커밋되지 않고 14일짜리 Actions debug
// artifact로만 남는다. 등급표가 커밋 등급이라고 말하면 리뷰가 "표에 소스 행이 없다"를 결함
// 근거로 삼는 오판을 한다(#1062).
test('news-candidates.md is graded debug_heavy because workflow 01 never commits it', () => {
  const classification = classifyArtifactPath('articles/content/newsroom/2026-08-31/news-candidates.md');
  assert.ok(classification, 'news-candidates.md must be classified');
  assert.equal(classification.retention_grade, DEBUG_HEAVY);
  assert.equal(classification.group, 'debug_evidence');
  assert.equal(mustNotBeTracked(classification), true);
});

test('retentionCommitAllowlist omits news-candidates.md even when it is on disk', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'news-candidates-retention-'));
  const dateDir = path.join(root, 'articles', 'content', 'newsroom', '2026-08-31');
  fs.mkdirSync(dateDir, { recursive: true });
  fs.writeFileSync(path.join(dateDir, 'news-candidates.md'), '# 수집 후보\n', 'utf8');
  const allow = retentionCommitAllowlist({ root, date: '2026-08-31' });
  assert.ok(
    !allow.includes('articles/content/newsroom/2026-08-31/news-candidates.md'),
    allow.join('\n')
  );
});

// 데일리 시절에 커밋된 18건은 생성 산출물 보존 규칙에 따라 Git에 남긴다. 등급만 내리고
// 파일은 지우지 않으므로 그 날짜 구간은 위반으로 잡지 않는다.
test('check keeps the daily-era news-candidates.md files without flagging them', () => {
  const result = makeCheck(['articles/content/newsroom/2026-06-02/news-candidates.md']);
  assert.equal(result.ok, true, JSON.stringify(result.violations));
  assert.equal(result.violations.length, 0);
});

// 데일리 종료 이후 날짜로 새로 추적되면 등급과 실제 커밋 동작이 다시 어긋난 것이므로 잡는다.
test('check FLAGS a news-candidates.md tracked after the daily era', () => {
  const result = makeCheck(['articles/content/newsroom/2026-08-31/news-candidates.md']);
  assert.equal(result.ok, false, 'post-daily news-candidates.md must be flagged');
  assert.equal(result.violations.length, 1);
  assert.equal(result.violations[0].grade, DEBUG_HEAVY);
});
