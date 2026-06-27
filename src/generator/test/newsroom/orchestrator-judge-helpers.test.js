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

test('deskAdvisoryIssues는 desk_* field issue를 모으고 비-desk advisory는 제외한다', () => {
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

test('desk_* 는 severity가 P1/P2여도 차단되지 않고 advisory로 모인다(코드 강제 비차단)', () => {
  const report = reportWith([
    { section_index: 1, field: 'desk_layer_distinction', severity: 'P1', reason: 'mislabeled severity' }
  ]);
  // field 이름이 advisory 여부를 결정한다 — severity가 P1이어도 차단 목록엔 들어가지 않는다.
  assert.equal(publicArticleJudgeBlockingIssues(report).length, 0);
  // 그리고 advisory로 모인다(silent drop 방지).
  assert.equal(deskAdvisoryIssues(report).length, 1);
});

test('publicArticleJudgeBlockingIssues는 desk P3를 차단 목록에 넣지 않는다(non-blocking 보증)', () => {
  const report = reportWith([
    { section_index: 1, field: 'desk_target_explanation', severity: 'P3', reason: 'no target' },
    { section_index: 1, field: 'desk_subject_attribution', severity: 'P3', reason: 'subject confusion' }
  ]);
  assert.equal(publicArticleJudgeBlockingIssues(report).length, 0);
});
