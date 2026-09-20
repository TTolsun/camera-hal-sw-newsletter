// Story Contract v2 T7(#850, Refs #1090) — 결정론 prose 합성의 v2 차단(demote 전환).
//
// v1 결정론 수선(completeStoryPublicArticle)은 story 필드가 결손이면 템플릿 문장
// (reader_scenario, 기본 not_to_overclaim, source_subtitle fallback, headline suffix)을
// 지어내 채웠다. v2 원칙은 fail/demote over fabricate다: 합성 대신 결손 섹션을 draft에서
// 제거(hard_blocked_groups 마킹)하고 잔여 섹션으로 draft를 유지하며, 최소 발행 기사 수
// 미달일 때만 draft 수준 실패로 승격한다. v1 재검증 경로는 버전 가드 뒤 그대로 존치한다.

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  deterministicallyRepairEditorSchema,
  repairEditorOutputContract
} = require('../../editor/editor-output-contract');
const {
  completeStoryPublicArticle
} = require('../../editor/editor-section-builders');
const {
  validatePublicArticle,
  NO_IMMEDIATE_ACTION_TEXT
} = require('../../reporter/public-article-contract');
const {
  PUBLIC_PROSE_PLACEHOLDER_PATTERNS
} = require('../../reporter/public-prose-leakage');
const { editorSystemPrompt } = require('../../publish/orchestrator-stage-prompts');
const {
  section,
  storyEditor,
  storyV2Editor,
  normalizeSection
} = require('../../../shared/test/helpers/editor-builders');

const DATE = '2026-05-08';
const V2_ISSUE = Object.freeze({
  public_contract_version: 'story-v2',
  generation_contract_version: 2
});

test('v2 completeStoryPublicArticle does not fabricate story prose fields', () => {
  const bare = section(1);
  delete bare.public_article.body_paragraphs;
  bare.public_article.body_markdown = '첫 문단이다.\n\n둘째 문단이다.';

  const completed = completeStoryPublicArticle(bare, { issue: V2_ISSUE, storyContractVersion: 2 });

  assert.equal(completed.story_contract_version, 2);
  // v1 합성이 지어내던 값들이 v2에서는 비어 있어야 한다(합성 금지).
  assert.equal(completed.source_subtitle, '');
  assert.equal(completed.editorial_story.not_to_overclaim, '');
  assert.equal(completed.editorial_story.editor_take, '');
  // v1 템플릿 문구가 어디에도 없어야 한다.
  const serialized = JSON.stringify(completed);
  assert.doesNotMatch(serialized, /현업 상황을 가정합니다/);
  assert.doesNotMatch(serialized, /source가 직접 말하지 않는 HAL runtime, driver branch/);
  // 본문은 v2 필드 그대로다.
  assert.match(completed.body_markdown, /첫 문단이다/);
  assert.equal(Object.prototype.hasOwnProperty.call(completed, 'body_paragraphs'), false);
});

test('v2 completeStoryPublicArticle does not append the headline repair suffix', () => {
  const bare = section(1);
  delete bare.public_article.body_paragraphs;
  bare.public_article.body_markdown = '첫 문단이다.\n\n둘째 문단이다.';
  // headline을 소스 제목과 동일하게 만들어 v1이라면 suffix가 붙는 상황을 만든다.
  bare.public_article.headline = bare.sources[0].title;

  const completed = completeStoryPublicArticle(bare, { issue: V2_ISSUE, storyContractVersion: 2 });

  assert.equal(completed.headline, bare.sources[0].title);
  assert.doesNotMatch(completed.headline, /검증 포인트|확인 범위|호환성 확인|검토 포인트/);
});

test('v1 completeStoryPublicArticle keeps the synthesis path unchanged behind the version guard', () => {
  const bare = section(1);
  bare.public_article.headline = bare.sources[0].title;

  const completed = completeStoryPublicArticle(bare);

  assert.equal(completed.story_contract_version, 1);
  // v1은 여전히 suffix·editorial_story 합성을 한다(영구 아티팩트 재검증 경로).
  assert.match(completed.headline, /: /);
  assert.ok(completed.editorial_story.reader_scenario.length > 0);
  assert.ok(completed.source_subtitle.length > 0);
});

test('v2 deterministic repair demotes a story-field-deficient section instead of failing the draft', () => {
  const draft = storyV2Editor();
  delete draft.sections[1].public_article.editorial_story;
  delete draft.sections[1].public_article.source_subtitle;

  const repaired = deterministicallyRepairEditorSchema(draft, { requireStoryContract: true });

  assert.ok(repaired.editor, 'draft should survive with the remaining sections');
  assert.deepEqual(repaired.reason_codes, []);
  assert.equal(repaired.editor.sections.length, 2);
  assert.equal(repaired.editor.sections.some(item => item.headline === 'Headline 2'), false);
  // demote된 그룹은 hard_blocked_groups로 기록돼 selected group coverage 계약이 유지된다.
  const blocked = repaired.editor.hard_blocked_groups || [];
  assert.equal(blocked.length, 1);
  assert.equal(blocked[0].reason_code, 'quality_hard_blocker');
  assert.equal(repaired.demoted_section_reason_codes.includes('empty_editorial_story_field'), true);
  assert.equal(repaired.demoted_section_signatures.length, 1);
});

test('v2 deterministic repair escalates to a draft-level failure below the minimum article count', () => {
  const draft = storyV2Editor();
  for (const item of draft.sections) {
    delete item.public_article.editorial_story;
  }

  const repaired = deterministicallyRepairEditorSchema(draft, { requireStoryContract: true });

  assert.equal(repaired.editor, null);
  assert.ok(repaired.reason_codes.includes('empty_editorial_story_field'));
});

test('v1 deterministic repair never demotes a section (v1 path unchanged)', () => {
  const draft = storyEditor();
  delete draft.sections[1].public_article.editorial_story;

  const repaired = deterministicallyRepairEditorSchema(draft, { requireStoryContract: true });

  assert.ok(repaired.editor);
  // v1은 demote 경로에 들어가지 않는다. 섹션 수·hard_blocked_groups 모두 무변이고,
  // 결손은 기존대로 재검증 실패 → LLM semantic repair 경로가 처리한다.
  assert.equal(repaired.editor.sections.length, 3);
  assert.equal(repaired.demoted_section_signatures, undefined);
  assert.deepEqual(repaired.editor.hard_blocked_groups || [], []);
});

test('repairEditorOutputContract resolves a v2 draft by demoting the deficient section (#850)', async () => {
  const draft = storyV2Editor();
  delete draft.sections[2].public_article.editorial_story;

  const result = await repairEditorOutputContract({
    value: draft,
    date: DATE,
    reporter: { candidates: [] },
    normalizeSection,
    requireStoryContract: true
  });

  assert.equal(result.repairSucceeded, true);
  assert.equal(result.deterministicRepair, true);
  assert.equal(result.editor.sections.length, 2);
  assert.equal(result.editor.sections.some(item => item.headline === 'Headline 3'), false);
});

test('v2 validation reports duplicate_headline when the headline equals a source title (#850)', () => {
  const draft = storyV2Editor();
  const target = draft.sections[0];
  target.public_article.headline = target.sources[0].title;

  const issues = validatePublicArticle(target, 0, { issue: V2_ISSUE, requireStoryContract: true });

  assert.ok(issues.some(issue => issue.type === 'duplicate_headline' && issue.key === 'headline'));
});

test('v1 validation does not use the duplicate_headline issue', () => {
  const draft = storyEditor();
  const target = draft.sections[0];
  target.public_article.headline = target.sources[0].title;

  const issues = validatePublicArticle(target, 0, {
    issue: { public_contract_version: 'story-v1', generation_contract_version: 1 },
    requireStoryContract: true
  });

  assert.equal(issues.some(issue => issue.type === 'duplicate_headline'), false);
});

test('deterministic fallback phrase detection stays as a permanent regression guard (#850)', () => {
  // 생성 경로는 제거된 상태가 정본이다. 탐지 상수가 사라지면 이 문구가 다시 발행
  // 본문에 실려도 아무 게이트가 잡지 못한다.
  assert.equal(NO_IMMEDIATE_ACTION_TEXT, '즉시 조치할 항목은 없습니다. 참고 동향으로만 공유합니다.');
  assert.ok(PUBLIC_PROSE_PLACEHOLDER_PATTERNS.length > 0);
  const producers = require('node:fs')
    .readFileSync(require.resolve('../../editor/editor-section-builders.js'), 'utf8');
  assert.doesNotMatch(producers, /즉시 조치할 항목은 없습니다/);
});

test('editor prompt treats background_context_static as reference-only, not copy-first (#850)', () => {
  const prompt = editorSystemPrompt({ publishMode: 'DEEP' });

  assert.match(prompt, /background_context_static을 참고자료로만 사용/);
  assert.match(prompt, /자기 문장으로 재작성/);
  assert.doesNotMatch(prompt, /background_context를 먼저 사용하세요/);
});
