const assert = require('node:assert/strict');
const test = require('node:test');

const {
  editorialPlanSystemPrompt,
  reporterSystemPrompt,
  editorSystemPrompt,
  factCheckSystemPrompt,
  editorRepairPatchSystemPrompt,
  factCheckRepairSystemPrompt,
  editorCompletionSystemPrompt,
  factCheckCompletionSystemPrompt
} = require('../../publish/orchestrator-stage-prompts');
const { publishGateCriteriaText } = require('../../../shared/common/newsletter-policy');

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

test('editorSystemPrompt는 항상 plan 전제 voice(slim)를 쓰고, completion은 full voice를 쓴다', () => {
  // editorial-plan은 필수 단계이므로 editor는 항상 plan을 받는다 → voice는 plan-따르기(slim).
  const editor = editorSystemPrompt({ publishMode: 'NORMAL' });
  assert.doesNotMatch(editor, /Samsung, S\.LSI, Exynos/);
  assert.match(editor, /제공된 internal editorial plan이 각 기사의/);
  // completion은 plan을 받지 않으므로 voice는 full generic 가드레일이다.
  assert.match(editorCompletionSystemPrompt({ missingArticleCount: 1 }), /Samsung, S\.LSI, Exynos/);
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

test('writing and verification use original evidence without imposing one article template', () => {
  for (const prompt of [reporterSystemPrompt(), editorSystemPrompt({ publishMode: 'NORMAL' }),
    factCheckSystemPrompt(), factCheckRepairSystemPrompt(), editorRepairPatchSystemPrompt()]) {
    assert.match(prompt, /article_source_reading.documents/);
    assert.match(prompt, /고정 목차나 필수 필드가 아닙니다/);
    assert.match(prompt, /API 정의 diff/);
  }
  for (const prompt of [factCheckSystemPrompt(), factCheckRepairSystemPrompt()]) {
    assert.match(prompt, /핵심 변화·중요한 조건을 생략/);
    assert.match(prompt, /article_quality.publishable=false/);
  }
});

test('weekly editor uses mined Gerrit test evidence for up to two articles', () => {
  const editor = editorSystemPrompt({ publishMode: 'NORMAL', hasLockedSections: true });
  assert.match(reporterSystemPrompt(), /status가 MERGED이고 리비전의 전체 diff가 제공된 경우/);
  assert.match(reporterSystemPrompt(), /테스트 입력·상태.*테스트 이름과 evidence_id/);
  assert.match(editor, /Gerrit 메인 기사 최대 2건/);
  assert.match(editor, /후보가 한 건이면 한 건만 보강하고, 없으면 생략/);
  assert.match(editor, /그대로 유지하는 기사에 이미 들어간 심층 설명도 이 범위에 포함/);
  assert.match(editor, /테스트의 기대값을 실행 결과나 단말 검증으로 쓰지 마세요/);
  assert.match(editor, /API·테스트 식별자는 원문대로/);
  for (const prompt of [factCheckSystemPrompt(), factCheckRepairSystemPrompt(), factCheckCompletionSystemPrompt()]) {
    assert.match(prompt, /같은 리비전의 diff에서 해당 조건과 기대값을 대조/);
    assert.match(prompt, /기사 수나 형식 자체는 발행 판정에 쓰지 마세요/);
  }
});

test('omitted Gerrit diffs cannot turn merge status or test filenames into run results', () => {
  const writing = [editorialPlanSystemPrompt(), reporterSystemPrompt(), editorSystemPrompt(),
    editorRepairPatchSystemPrompt(), editorCompletionSystemPrompt()];
  const checking = [factCheckSystemPrompt(), factCheckRepairSystemPrompt(), factCheckCompletionSystemPrompt()];
  for (const prompt of [...writing, ...checking]) {
    assert.match(prompt, /diff_omitted=true.*truncated=false.*MERGED는 병합 상태만/);
  }
  for (const prompt of writing) {
    assert.match(prompt, /파일명이나 병합 상태로 테스트 이름·입력·기대값·실행 여부·통과\/실패를 추정하지/);
    assert.match(prompt, /같은 리비전.*결과를 명시한 실행 기록이나 출처의 보고를 evidence_id/);
  }
  for (const prompt of checking) {
    assert.match(prompt, /테스트도 통과했을 것.*must_fix\[\].*article_quality.publishable=false/);
    assert.match(prompt, /점검을 제안한 기사는 diff 생략만으로 차단하지/);
  }
});

test('editorSystemPrompt는 구성 상한을 editor의 보류 사유로 주지 않는다', () => {
  // 2026-10-26 실측: 보조 main 최대 1건을 editor 기준으로 주자 보조 기사 1건뿐인 구성에서 그 기사를 보류했다.
  const prompt = editorSystemPrompt({ publishMode: 'NORMAL' });
  assert.equal(prompt.includes(publishGateCriteriaText()), false);
  assert.doesNotMatch(prompt, /supporting main articles max/);
  assert.match(prompt, /상한을 이유로 selected group을 demote하거나 explicit_editor_hold로 보류하지 마세요/);
  // 금지 bucket은 상한이 아니라 자격 제외라 forbidden_bucket 강등 경로는 그대로 남는다.
  assert.match(prompt, /reason_code=duplicate_or_near_duplicate\|forbidden_bucket\|explicit_editor_hold/);
});
