// Story Contract v2 계약 코어(T2) — editor 출력 계약이 v2를 "수용"하는지 본다.
//
// 수용하지 못하면 v2 draft가 전부 repairable:false로 죽고, 이슈 레벨 stamp가 draft가
// 선언한 버전을 v1로 되돌려 혼합 패밀리를 만든다(PR #643 동형 버그).
// 이 PR 이후에도 producer는 v2를 만들지 않는다.

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  deterministicallyRepairEditorSchema,
  repairEditorOutputContract,
  validatePublicArticleContract
} = require('../../editor/editor-output-contract');
const {
  editorRequestsStoryContract
} = require('../../publish/orchestrator-editor-retry-contract');
const {
  section,
  storyPublicArticle,
  storyEditor,
  normalizeSection
} = require('../../../shared/test/helpers/editor-builders');

const DATE = '2026-05-08';

function v2Editor(overrides = {}) {
  return storyEditor({
    public_contract_version: 'story-v2',
    generation_contract_version: 2,
    sections: [section(1), section(2), section(3)].map(item => ({
      ...item,
      public_article: storyPublicArticle(item, { story_contract_version: 2 })
    })),
    ...overrides
  });
}

test('editor retry contract recognizes a v2 draft as opting into the story contract', () => {
  assert.equal(editorRequestsStoryContract({ public_contract_version: 'story-v2' }), true);
  assert.equal(editorRequestsStoryContract({ public_contract_version: 'story-v1' }), true);
  assert.equal(editorRequestsStoryContract({ public_contract_version: 'legacy' }), false);
});

test('public article contract reports the v2 body key when a v2 draft fails', () => {
  const draft = v2Editor();

  assert.throws(
    () => validatePublicArticleContract(draft, { requireStoryContract: true }),
    error => {
      assert.ok(error.details.expectedKeys.includes('body_markdown'));
      assert.equal(error.details.expectedKeys.includes('body_paragraphs'), false);
      return true;
    }
  );
});

test('public article contract keeps reporting the v1 body key for a v1 draft', () => {
  const draft = storyEditor({
    sections: [{ ...section(1), public_article: { headline: '' } }]
  });

  assert.throws(
    () => validatePublicArticleContract(draft, { requireStoryContract: true }),
    error => {
      assert.ok(error.details.expectedKeys.includes('body_paragraphs'));
      assert.equal(error.details.expectedKeys.includes('body_markdown'), false);
      return true;
    }
  );
});

test('deterministic editor repair does not reject a v2 draft as an unsupported marker', async () => {
  const draft = v2Editor();

  await assert.rejects(
    () => repairEditorOutputContract({
      value: draft,
      date: DATE,
      reporter: { candidates: [] },
      normalizeSection,
      requireStoryContract: true
    }),
    error => {
      const reasonCodes = error.deterministic_repair_failure_reason_codes || [];
      assert.equal(reasonCodes.includes('unsupported_public_contract_version'), false);
      assert.equal(reasonCodes.includes('unsupported_generation_contract_version'), false);
      assert.equal(reasonCodes.includes('unsupported_story_contract_version'), false);
      return true;
    }
  );
});

// 이슈 레벨 stamp가 draft 선언(v2)을 v1으로 되돌리면 섹션 마커는 2로 남아 혼합
// 패밀리가 된다. 결정론 수선은 clone에 쓰므로 입력이 아니라 반환된 editor에서 본다.
test('deterministic editor repair stamps the version the draft declared', () => {
  const repaired = deterministicallyRepairEditorSchema(
    v2Editor({ generation_contract_version: undefined }),
    { requireStoryContract: true }
  );

  assert.equal(repaired.editor.public_contract_version, 'story-v2');
  assert.equal(repaired.editor.generation_contract_version, 2);
});

test('deterministic editor repair still completes a v1 draft with the v1 stamp', () => {
  const repaired = deterministicallyRepairEditorSchema(
    storyEditor({ generation_contract_version: undefined }),
    { requireStoryContract: true }
  );

  assert.equal(repaired.editor.public_contract_version, 'story-v1');
  assert.equal(repaired.editor.generation_contract_version, 1);
});
