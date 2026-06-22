const assert = require('node:assert/strict');
const test = require('node:test');

const {
  reporterSystemPrompt,
  editorSystemPrompt,
  factCheckSystemPrompt,
  editorRepairPatchSystemPrompt,
  factCheckRepairSystemPrompt,
  editorCompletionSystemPrompt,
  factCheckCompletionSystemPrompt
} = require('../../publish/orchestrator-stage-prompts');

// 추출 전 main()의 인라인 시스템 프롬프트 배열을 빌더로 옮긴 것이다. 빌더의 책임은 단계별
// 시스템 프롬프트 문자열을 조립하는 것이며, 정적 문단(import한 prompt/policy 헬퍼)은
// 그대로, 실행 의존 값(locked 여부·retry contract·publishMode·catch-up·누락 기사 수)만
// 조건부로 들어간다. 동작 불변(joined 문자열 동일)은 .tmp 대조 스크립트로 별도 검증했고,
// 이 테스트는 각 빌더가 문자열을 내고 조건부 분기가 옳게 토글되는지 고정한다.

test('각 빌더는 단계 앵커 문구를 담은 비어있지 않은 문자열을 반환한다', () => {
  assert.match(reporterSystemPrompt(), /AI reporter/);
  assert.match(editorSystemPrompt({ publishMode: 'NORMAL' }), /AI editor/);
  assert.match(factCheckSystemPrompt(), /AI fact checker/);
  assert.match(editorRepairPatchSystemPrompt(), /AI repair editor/);
  assert.match(factCheckRepairSystemPrompt(), /repaired .* AI fact checker/);
  assert.match(editorCompletionSystemPrompt({ missingArticleCount: 2 }), /AI completion editor/);
  assert.match(factCheckCompletionSystemPrompt(), /completed .* AI fact checker/);
});

test('reporterSystemPrompt는 hasLockedSections로 중복 경고 줄을 토글한다', () => {
  assert.doesNotMatch(reporterSystemPrompt({ hasLockedSections: false }), /retry context에 있는 locked article/);
  assert.match(reporterSystemPrompt({ hasLockedSections: true }), /retry context에 있는 locked article/);
});

test('editorSystemPrompt는 editorRetryContract로 retry 계약 줄을 토글한다', () => {
  assert.doesNotMatch(editorSystemPrompt({ publishMode: 'NORMAL', editorRetryContract: null }), /Editor retry output contract/);
  const withContract = editorSystemPrompt({
    publishMode: 'NORMAL',
    editorRetryContract: { target_section_count: 4, locked_section_count: 2, replacement_required_count: 2 }
  });
  assert.match(withContract, /Editor retry output contract: sections가 정확히 4개/);
  assert.match(withContract, /locked section 2개를 변경 없이 포함하고, replacement\/new section 2개/);
});

test('editorSystemPrompt는 publishMode로 CONTEXT/QUIET 블록을 토글한다', () => {
  assert.match(editorSystemPrompt({ publishMode: 'CONTEXT' }), /이번 발행은 CONTEXT 모드입니다/);
  assert.doesNotMatch(editorSystemPrompt({ publishMode: 'CONTEXT' }), /이번 발행은 QUIET 모드입니다/);
  assert.match(editorSystemPrompt({ publishMode: 'QUIET' }), /이번 발행은 QUIET 모드입니다/);
  assert.doesNotMatch(editorSystemPrompt({ publishMode: 'NORMAL' }), /이번 발행은 (CONTEXT|QUIET) 모드/);
});

test('editorSystemPrompt는 hasCatchUpCoverage로 catch-up 줄을 토글한다', () => {
  assert.doesNotMatch(editorSystemPrompt({ publishMode: 'NORMAL', hasCatchUpCoverage: false }), /coverage_type=catch_up/);
  assert.match(editorSystemPrompt({ publishMode: 'NORMAL', hasCatchUpCoverage: true }), /coverage_type=catch_up/);
});

test('editorCompletionSystemPrompt는 missingArticleCount를 보간한다', () => {
  assert.match(editorCompletionSystemPrompt({ missingArticleCount: 3 }), /3개의 추가 main article section만 반환하세요/);
});

test('빌더 출력은 결정론적이다(같은 입력 같은 출력)', () => {
  assert.equal(factCheckSystemPrompt(), factCheckSystemPrompt());
  assert.equal(
    editorSystemPrompt({ publishMode: 'NORMAL', hasLockedSections: true }),
    editorSystemPrompt({ publishMode: 'NORMAL', hasLockedSections: true })
  );
});
