const assert = require('node:assert/strict');
const test = require('node:test');

// 커버리지 회계의 권위 집합은 결정론 선정 집합 S 하나다. editor 출력은 신뢰할 수 없는 입력이므로
// S를 넓히지 못한다.
//
//   회계        S = (R∩S) ⊎ (D∩S) ⊎ (H∩S)
//   치명        R−S 가 비어 있지 않음 (선택되지 않은 소재로 기사를 만든 것)
//   진단 전용   D−S, H−S (이미 main에서 빠진 그룹에 대한 기록 — 발행 안전과 무관)
//
// 2026-08-17 실측이 이 계약의 근거다. 재조정이 5그룹을 1그룹으로 줄인 주에 editor가 남은 네 기사를
// `patch:uvcvideo_memory_safety` 같은 **지어낸 키**로 강등 선언했고, 옛 등식이 그것을 회계에 넣어
// selected 1 !== rendered 1 + demoted 4로 발행 전체가 diagnostics-only가 됐다. 키가 지어내진 것이라
// 어떤 매칭으로도 S와 이어지지 않는다 — 그래서 S 밖 기록은 세지 않고 진단으로만 남긴다.
//
// 픽스처는 이 파일 안에 최소 형태로 둔다(생성 artifact를 테스트 입력으로 끌어오지 않는다).

const { groupCoverageSummary } = require('../../../common/article-groups');

const SELECTED = 'article:https://developer.android.com/jetpack/androidx/releases/camera#1.7.0-alpha03';
const FABRICATED = [
  'patch:unbind_streaming_sensor',
  'patch:v4l2_isp_zero_size',
  'patch:uvcvideo_memory_safety',
  'patch:libcamera_software_isp_egl'
];

test('지어낸 강등 키는 회계에서 빠지고 진단으로만 남는다', () => {
  const summary = groupCoverageSummary({
    selectedGroupKeys: [SELECTED],
    renderedGroupKeys: [SELECTED],
    // 지어낸 키라 사유 코드도 없다 — S 밖이므로 사유 누락도 진단 전용이어야 한다.
    demotedGroups: FABRICATED.map(key => ({ article_group_key: key, demotion_reason: '', reason_code: '' }))
  });

  assert.equal(summary.ok, true);
  assert.equal(summary.selected_group_count, 1);
  assert.equal(summary.rendered_group_count, 1);
  assert.equal(summary.explicitly_demoted_group_count, 0);
  assert.equal(summary.explicitly_demoted_outside_selection_count, 4);
  assert.deepEqual(summary.explicitly_demoted_outside_selection_group_keys, FABRICATED);
  assert.deepEqual(summary.demotion_missing_reason_group_keys, []);
});

test('선택된 그룹이 어디에도 없으면 실패한다', () => {
  const summary = groupCoverageSummary({
    selectedGroupKeys: [SELECTED, 'group-b'],
    renderedGroupKeys: [SELECTED],
    demotedGroups: []
  });

  assert.equal(summary.ok, false);
  assert.deepEqual(summary.missing_group_keys, ['group-b']);
});

test('선택 집합 밖 소재를 기사로 렌더링하면 실패한다', () => {
  const summary = groupCoverageSummary({
    selectedGroupKeys: [SELECTED],
    renderedGroupKeys: [SELECTED, 'article:https://example.com/not-selected'],
    demotedGroups: []
  });

  assert.equal(summary.ok, false);
  assert.deepEqual(
    summary.rendered_outside_selection_group_keys,
    ['article:https://example.com/not-selected']
  );
  assert.equal(summary.rendered_group_count, 1);
});

test('선택된 그룹이 렌더와 강등에 동시에 들어가면 실패한다', () => {
  const summary = groupCoverageSummary({
    selectedGroupKeys: [SELECTED],
    renderedGroupKeys: [SELECTED],
    demotedGroups: [{ article_group_key: SELECTED, demotion_reason: 'duplicate', reason_code: 'duplicate_or_near_duplicate' }]
  });

  assert.equal(summary.ok, false);
  assert.deepEqual(summary.overlapping_group_keys, [SELECTED]);
});

test('선택된 그룹이 강등과 하드블록에 동시에 들어가면 실패한다', () => {
  const summary = groupCoverageSummary({
    selectedGroupKeys: [SELECTED],
    renderedGroupKeys: [],
    demotedGroups: [{ article_group_key: SELECTED, demotion_reason: 'editor hold', reason_code: 'explicit_editor_hold' }],
    hardBlockedGroups: [{ article_group_key: SELECTED, hard_block_reason: 'source gap', reason_code: 'source_gap_risk' }]
  });

  assert.equal(summary.ok, false);
  assert.deepEqual(summary.hard_blocked_demoted_overlap_group_keys, [SELECTED]);
});

test('같은 그룹을 두 번 렌더링하면 실패한다', () => {
  const summary = groupCoverageSummary({
    selectedGroupKeys: [SELECTED],
    renderedGroupKeys: [SELECTED, SELECTED],
    demotedGroups: []
  });

  assert.equal(summary.ok, false);
  assert.deepEqual(summary.duplicate_rendered_group_keys, [SELECTED]);
});

test('지어낸 하드블록 키도 회계에서 빠지고 진단으로만 남는다', () => {
  const summary = groupCoverageSummary({
    selectedGroupKeys: [SELECTED],
    renderedGroupKeys: [SELECTED],
    hardBlockedGroups: FABRICATED.map(key => ({ article_group_key: key, hard_block_reason: '', reason_code: '' }))
  });

  assert.equal(summary.ok, true);
  assert.equal(summary.hard_blocked_group_count, 0);
  assert.equal(summary.hard_blocked_outside_selection_count, 4);
  assert.deepEqual(summary.hard_blocked_outside_selection_group_keys, FABRICATED);
  assert.deepEqual(summary.hard_block_missing_reason_group_keys, []);
});
