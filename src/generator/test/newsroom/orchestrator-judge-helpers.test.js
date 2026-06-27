const assert = require('node:assert/strict');
const test = require('node:test');

const {
  deskAdvisoryIssues,
  publicArticleJudgeBlockingIssues,
  DESK_ADVISORY_FIELDS
} = require('../../publish/orchestrator-judge-helpers');

// #725: desk-review 4축은 P3 advisory issue로 표현된다. deskAdvisoryIssues가 그 4축만
// 모으고, publicArticleJudgeBlockingIssues는 desk P3를 차단 목록에 넣지 않아야 한다(발행
// 안정성 보증 — desk 축은 절대 hard-block 하지 않는다).

function reportWith(issues) {
  return {
    section_count_expected: 1,
    section_count_actual: 1,
    overall_pass: true,
    sections: [{
      section_index: 1,
      headline: 'h1',
      public_article_pass: true,
      reader_checkpoints_pass: true,
      source_boundary_pass: true,
      public_prose_pass: true,
      issues
    }]
  };
}

test('DESK_ADVISORY_FIELDS는 desk 4축을 노출한다', () => {
  assert.deepEqual([...DESK_ADVISORY_FIELDS].sort(), [
    'desk_layer_distinction',
    'desk_source_limitations',
    'desk_subject_attribution',
    'desk_target_explanation'
  ]);
});

test('deskAdvisoryIssues는 desk_* 필드의 P3 issue만 모은다', () => {
  const report = reportWith([
    { section_index: 1, field: 'desk_target_explanation', severity: 'P3', reason: 'no target' },
    { section_index: 1, field: 'desk_source_limitations', severity: 'P3', reason: 'dropped limit' },
    { section_index: 1, field: 'public_article', severity: 'P3', reason: 'generic non-desk advisory' }
  ]);
  const desk = deskAdvisoryIssues(report);
  assert.equal(desk.length, 2);
  assert.deepEqual(
    desk.map(issue => issue.field).sort(),
    ['desk_source_limitations', 'desk_target_explanation']
  );
  // section_index/headline이 부착되어 보고에 쓸 수 있다.
  assert.equal(desk[0].section_index, 1);
  assert.equal(desk[0].headline, 'h1');
});

test('deskAdvisoryIssues는 desk_* 이지만 P1/P2인 issue는 제외한다(차단은 기존 경로가 처리)', () => {
  const report = reportWith([
    { section_index: 1, field: 'desk_layer_distinction', severity: 'P1', reason: 'escalated' }
  ]);
  assert.equal(deskAdvisoryIssues(report).length, 0);
});

test('publicArticleJudgeBlockingIssues는 desk P3를 차단 목록에 넣지 않는다(non-blocking 보증)', () => {
  const report = reportWith([
    { section_index: 1, field: 'desk_target_explanation', severity: 'P3', reason: 'no target' },
    { section_index: 1, field: 'desk_subject_attribution', severity: 'P3', reason: 'subject confusion' }
  ]);
  assert.equal(publicArticleJudgeBlockingIssues(report).length, 0);
});
