'use strict';

// #918: editor가 커버리지 선언(강등·차단)을 내릴 수 있는 대상은 선정 캡슐에 실린 그룹뿐이다.
// editor는 같은 프롬프트에서 편집 계획(작성 안내용 입력)도 받는데, 그 항목의
// source_candidate_hash로 `article:<hash>` 키를 조립해 강등을 선언한 실측이 있다
// (2026-08-17 발행분 issue.json에 4건). 그 선언은 캡슐에 행이 없는 그룹을 가리키므로
// 정규화 단계에서 결정론적으로 떨어지고, 떨어진 사실은 진단으로 남아야 한다.

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  validateEditorOutputContract
} = require('../../editor/editor-output-contract');

const { buildGroupCoverageFixture } = require('../../../shared/test/helpers/editor-builders');

// buildGroupCoverageFixture는 선정 그룹 2개(group-a, group-b)에 group-a 섹션 1개만 렌더링한다.
// group-b를 캡슐 키로 강등하면 DEEP 커버리지 등식이 맞는다.
function demotion(articleGroupKey, reasonCode = 'duplicate_or_near_duplicate') {
  return {
    article_group_key: articleGroupKey,
    demotion_reason: 'Editor demoted this group in favor of the rendered representative.',
    reason_code: reasonCode
  };
}

test('캡슐 그룹키를 쓴 강등 선언은 그대로 통과한다', () => {
  const { editor, reporter } = buildGroupCoverageFixture();
  editor.explicitly_demoted_groups = [demotion('group-b')];

  const result = validateEditorOutputContract(editor, '2026-05-31', { reporter, publishMode: 'DEEP' });

  assert.deepEqual(result.explicitly_demoted_groups, [demotion('group-b')]);
  assert.equal(result.explicitly_demoted_group_count, 1);
  assert.deepEqual(result.explicitly_demoted_group_keys, ['group-b']);
  assert.equal(result.dropped_outside_selection_group_declaration_count, undefined);
  assert.equal(result.dropped_outside_selection_group_declarations, undefined);
});

test('편집 계획 hash로 조립한 강등 선언은 떨어지고 진단에 기록된다', () => {
  const { editor, reporter } = buildGroupCoverageFixture();
  // 'hash-2'는 편집 계획 항목의 source_candidate_hash다. editor가 여기에 접두어를 붙여
  // 만든 `article:hash-2`는 코드가 만들지 않는 키라 선정 캡슐에 존재하지 않는다.
  editor.explicitly_demoted_groups = [demotion('group-b'), demotion('article:hash-2', 'explicit_editor_hold')];

  const result = validateEditorOutputContract(editor, '2026-05-31', { reporter, publishMode: 'DEEP' });

  assert.deepEqual(result.explicitly_demoted_groups, [demotion('group-b')]);
  assert.equal(result.explicitly_demoted_group_count, 1);
  assert.equal(result.dropped_outside_selection_group_declaration_count, 1);
  assert.deepEqual(result.dropped_outside_selection_group_declarations, [{
    article_group_key: 'article:hash-2',
    declaration_type: 'explicitly_demoted',
    reason_code: 'explicit_editor_hold'
  }]);
});

test('선정 집합 밖 선언 제거는 CONTEXT 모드에서도 돈다', () => {
  const { editor, reporter } = buildGroupCoverageFixture();
  editor.explicitly_demoted_groups = [demotion('article:hash-2', 'explicit_editor_hold')];
  editor.hard_blocked_groups = [{
    article_group_key: 'article:hash-9',
    hard_block_reason: 'Editor blocked a group that has no capsule row.',
    reason_code: 'source_gap_risk'
  }];

  // CONTEXT/QUIET은 선정 그룹 커버리지 등식을 요구하지 않고 일찍 반환한다.
  // 제거가 그 반환 뒤에 있으면 CONTEXT 주간에 선언이 그대로 발행된다.
  const result = validateEditorOutputContract(editor, '2026-05-31', { reporter, publishMode: 'CONTEXT' });

  assert.deepEqual(result.explicitly_demoted_groups, []);
  assert.deepEqual(result.hard_blocked_groups, []);
  assert.equal(result.dropped_outside_selection_group_declaration_count, 2);
  assert.deepEqual(result.dropped_outside_selection_group_declarations, [
    {
      article_group_key: 'article:hash-2',
      declaration_type: 'explicitly_demoted',
      reason_code: 'explicit_editor_hold'
    },
    {
      article_group_key: 'article:hash-9',
      declaration_type: 'hard_blocked',
      reason_code: 'source_gap_risk'
    }
  ]);
});

test('재검증(repair/completion 재진입)은 같은 진단을 유지한다', () => {
  const { editor, reporter } = buildGroupCoverageFixture();
  editor.explicitly_demoted_groups = [demotion('group-b'), demotion('article:hash-2', 'explicit_editor_hold')];

  const first = validateEditorOutputContract(editor, '2026-05-31', { reporter, publishMode: 'DEEP' });
  const second = validateEditorOutputContract(first, '2026-05-31', { reporter, publishMode: 'DEEP' });

  assert.deepEqual(second.explicitly_demoted_groups, [demotion('group-b')]);
  assert.equal(second.dropped_outside_selection_group_declaration_count, 1);
  assert.deepEqual(
    second.dropped_outside_selection_group_declarations,
    first.dropped_outside_selection_group_declarations
  );
});
