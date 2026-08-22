const assert = require('node:assert/strict');
const test = require('node:test');

const {
  changedArtifactDate
} = require('../../common/artifact-paths');
const {
  generatedTargetDatesFromInputs,
  strictTargetDatesFromInputs
} = require('../../../generator/reporter/validation-targets');

test('changed artifact date detection covers newsletter and newsroom artifacts', () => {
  assert.equal(changedArtifactDate('articles/newsletters/2026-05-07/newsletter.md'), '2026-05-07');
  assert.equal(changedArtifactDate('articles/content/newsroom/2026-05-07/quality-report.json'), '2026-05-07');
  assert.equal(changedArtifactDate('articles/content/collected-news/2026-05-07/candidates.json'), '2026-05-07');
  assert.equal(changedArtifactDate('articles/content/source-events/2026-05-07/source-change-events.json'), '2026-05-07');
  assert.equal(changedArtifactDate('docs/NEWSROOM_WORKFLOW.md'), '');
});

test('strict target dates combine changed artifacts and generated date file input', () => {
  const dates = strictTargetDatesFromInputs({
    changedFiles: [
      'articles/newsletters/2026-05-07/index.html',
      'articles/content/newsroom/2026-05-08/editor-draft.json',
      'articles/content/collected-news/2026-05-09/candidates.json',
      'articles/content/source-events/2026-05-11/source-change-events.md',
      'README.md'
    ],
    newsletterDate: '2026-05-10'
  });

  assert.deepEqual([...dates].sort(), [
    '2026-05-07',
    '2026-05-08',
    '2026-05-09',
    '2026-05-10',
    '2026-05-11'
  ]);
});

test('strict target dates ignore advisory image audit reports', () => {
  const dates = strictTargetDatesFromInputs({
    changedFiles: [
      'articles/content/newsroom/2026-05-07/image-audit-report.json',
      'articles/content/newsroom/2026-05-08/image-audit-report.md',
      'articles/content/newsroom/2026-05-09/editor-draft.json',
      'articles/newsletters/2026-05-10/index.html'
    ]
  });

  assert.deepEqual([...dates].sort(), [
    '2026-05-09',
    '2026-05-10'
  ]);
});

// 두 집합의 경계다. 검사에는 두 종류가 있고, 섞으면 한쪽이 다른 쪽을 끈다.
//
// - strictTargetDates: 커밋된 파일만 읽는 검사용. 과거 호를 고치는 변경도 사후에 만족시킬 수
//   있으므로, 이미 발행된 페이지를 수정해도 그 날짜가 계속 들어 있어야 한다.
// - generatedTargetDates: 생성 실행만 만들 수 있는 산출물을 요구하는 검사용. 그런 요구는 과거
//   호를 고치는 변경이 사후에 만족시킬 수 없으므로 빠져야 한다.
test('editing a published page stays a strict target but is not a generation target', () => {
  const changedEntries = [
    { status: 'M', path: 'articles/newsletters/2026-06-16/index.html' },
    { status: 'M', path: 'articles/newsletters/2026-06-16/newsletter.md' }
  ];

  assert.deepEqual(
    [...strictTargetDatesFromInputs({ changedFiles: changedEntries.map(entry => entry.path) })],
    ['2026-06-16'],
    '아카이브 수정도 커밋 파일만 읽는 검사는 계속 받아야 한다'
  );
  assert.deepEqual(
    [...generatedTargetDatesFromInputs({ changedEntries })],
    [],
    '아카이브 수정에 생성 실행 산출물을 요구하면 안 된다'
  );
});

test('a newly published issue and its newsroom artifacts are generation targets', () => {
  const dates = generatedTargetDatesFromInputs({
    changedEntries: [
      { status: 'A', path: 'articles/newsletters/2026-08-10/index.html' },
      { status: 'M', path: 'articles/newsletters/2026-08-17/index.html' },
      { status: 'M', path: 'articles/content/newsroom/2026-08-17/generation-status.json' }
    ]
  });

  assert.deepEqual([...dates].sort(), ['2026-08-10', '2026-08-17']);
});

// 감사 리포트는 과거 날짜에 일괄 backfill될 수 있어(#263) 생성 신호가 아니다. 두 집합 모두에서
// 같은 규칙이어야 한다.
test('an image audit report alone is not a generation target', () => {
  const dates = generatedTargetDatesFromInputs({
    changedEntries: [
      { status: 'M', path: 'articles/content/newsroom/2026-05-07/image-audit-report.json' },
      { status: 'A', path: 'articles/content/newsroom/2026-05-08/image-audit-report.md' }
    ]
  });

  assert.deepEqual([...dates], []);
});
