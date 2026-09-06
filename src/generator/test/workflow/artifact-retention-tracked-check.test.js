const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const {
  checkArtifactRetentionTracked,
  getTrackedContentPaths,
  mustNotBeTracked
} = require('../../../shared/tooling/validate/artifact-retention-tracked-check');
const {
  DEBUG_HEAVY,
  TRANSIENT_ATTEMPT,
  REVIEW_REQUIRED_COMPACT,
  buildReviewArtifactInventory,
  classifyArtifactPath,
  retentionCommitAllowlist
} = require('../../publish/review-artifact-inventory');

const repoRoot = path.join(__dirname, '..', '..', '..', '..');

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

// 워크플로 02는 articles/content/newsroom/ 을 통째로 git add 한다. 그래서 debug_heavy 등급
// 파일이 커밋되지 않는 유일한 이유는 .gitignore 다. 등급표에 debug_heavy 로 적어 두고 목록에서
// 빠뜨리면 그 파일은 첫 실행에서 커밋되고 곧바로 이 체크가 hard fail 한다(#1089: seed 리포트
// 두 건이 그 상태였다). 목록을 손으로 맞추는 대신 inventory 가 세는 것과 대조한다.
// 워크플로 01 이 articles/content/source-events/ 를 명시적으로 git add 하는데 이 검사는 그 경로를
// 훑지 않았다. 그동안 source-change-events.json 43건이 debug_heavy 등급인 채 추적되고 있었는데도
// 검사는 통과했다 — 훑지 않는 경로는 등급이 무엇이든 검사되지 않는다(#1101).
test('#1101: source-events 경로도 추적 검사 범위에 든다', () => {
  const trackedRoots = getTrackedContentPaths(repoRoot);
  const sourceEventPaths = trackedRoots.filter(relPath => relPath.startsWith('articles/content/source-events/'));
  // 전제부터 확인한다. 트리에 source-events 파일이 하나도 없으면 아래 단언은 빈 목록을 보고
  // 통과해 버려서, 범위가 다시 좁아져도 알아채지 못한다.
  assert.ok(sourceEventPaths.length > 0, 'tree must already track source-events artifacts');
});

// 짝인 .md 는 처음부터 review_required_compact 였는데 .json 만 debug_heavy 였다. 두 파일 다
// 워크플로 01 이 커밋하므로 .json 쪽 등급이 현실과 어긋난 쪽이었다(#1101).
test('#1101: source-change-events.json은 커밋되는 등급이라 위반이 아니다', () => {
  const relPath = 'articles/content/source-events/2026-08-31/source-change-events.json';
  const classification = classifyArtifactPath(relPath);
  assert.equal(classification.retention_grade, REVIEW_REQUIRED_COMPACT);
  assert.equal(mustNotBeTracked(classification), false);

  const result = makeCheck([relPath, 'articles/content/source-events/2026-08-31/source-change-events.md']);
  assert.equal(result.ok, true, JSON.stringify(result.violations));
});

test('#1089: inventory가 debug_heavy로 세는 newsroom 산출물은 전부 .gitignore가 막는다', () => {
  const inventory = buildReviewArtifactInventory({ date: '2026-09-07' });
  const heavyBasenames = [...new Set(inventory.review_artifacts
    .filter(artifact => artifact.retention_grade === DEBUG_HEAVY && artifact.path.includes('/newsroom/'))
    .map(artifact => artifact.path.split('/').pop()))];
  // 전제부터 확인한다. inventory 가 newsroom debug_heavy 를 하나도 안 세면 아래 비교는
  // 빈 목록끼리의 대조가 되어 무엇을 빠뜨려도 통과한다.
  assert.ok(heavyBasenames.length > 0, 'inventory must list newsroom debug_heavy artifacts');

  const gitignore = fs.readFileSync(path.join(repoRoot, '.gitignore'), 'utf8');
  const missing = heavyBasenames.filter(
    basename => !gitignore.includes(`articles/content/newsroom/**/${basename}`)
  );
  assert.deepEqual(missing, [], `.gitignore must cover every newsroom debug_heavy artifact: ${missing.join(', ')}`);
});
