'use strict';

// Story Contract v2 본문 lint의 수리 레인 배선(#849, Refs #1090, 설계 4.6절).
//
// 설계가 정한 경로는 "lint 실패 → 블록 patch → 실패하면 강등"이다. 그러려면 lint 이슈가
// 품질 리포트의 감점으로 나와야 하는데, 배선 이전에는 editor 계약 검증이 같은 이슈로
// draft 전체를 semantic 실패로 던져서 그 경로 전체가 whole-draft 재작성으로 삼켜졌다.
// 이 파일이 레인의 네 마디를 한 번에 잠근다.
//
//   1. editor 계약은 수리 가능한 본문 lint로 draft를 죽이지 않는다(구조 실패는 그대로 죽인다).
//   2. 품질 리포트가 그 이슈를 reason_code를 단 blocking 감점으로 방출한다.
//   3. repair 정책이 그 reason_code를 repair-section으로 분류하고 블록 patch가 실제로 적용된다.
//   4. patch가 실패하면 원본 draft가 유지되고 그 기사만 강등된다.

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  buildNewsletterQualityReport,
  salvagePublishableSubset
} = require('../../quality/newsletter-quality');
const {
  buildFullSectionRepairPlan,
  deductionRepairPolicy
} = require('../../publish/orchestrator-repair-plan');
const {
  applyRepairPatchesAndValidate
} = require('../../publish/orchestrator-targeted-repair');
const {
  validatePublicArticleContract
} = require('../../editor/editor-output-contract');
const {
  validatePublicArticle
} = require('../../reporter/public-article-contract');
const {
  scopedCandidate,
  section
} = require('../../../shared/test/helpers/quality-builders');

const DATE = '2026-05-03';

const CLEAN_BODY = [
  '패치가 v10까지 온 이유는 센서 하나가 아니라 서브디바이스 계약이었다.',
  '',
  '리뷰어가 매번 되돌린 자리는 프레임 간격을 누가 정하느냐였다.'
].join('\n');

// 같은 문단이 두 번 실린 본문. lint가 body_markdown_duplicate_block을 2번 블록에 낸다.
const DUPLICATE_BLOCK_BODY = [
  '패치가 v10까지 온 이유는 센서 하나가 아니라 서브디바이스 계약이었다.',
  '',
  '리뷰어가 매번 되돌린 자리는 프레임 간격을 누가 정하느냐였다.',
  '',
  '패치가 v10까지 온 이유는 센서 하나가 아니라 서브디바이스 계약이었다.'
].join('\n');

function v2Section(headline, url, bodyMarkdown) {
  const base = section({ headline, url });
  return {
    ...base,
    public_article: {
      headline: base.headline,
      lead: `${base.headline}가 무엇을 확인하게 하는지 본다.`,
      body_markdown: bodyMarkdown,
      camera_hal_takeaway: '스트림·버퍼·메타데이터 검증 범위만 확인하면 됩니다.',
      reader_checkpoints: base.action_items,
      source_links: base.sources.map(item => ({
        title: item.title,
        url: item.url,
        source_role: 'primary'
      })),
      story_contract_version: 2,
      source_subtitle: 'Android Developers · 2026-05-01',
      editorial_story: {
        not_to_overclaim: 'source가 말하지 않는 HAL runtime 변경으로 확대하지 않습니다.',
        editor_take: '검증 대상은 source가 확인한 범위 안에서만 잡습니다.'
      },
      decision_metadata: {
        impact: 'Medium',
        scope: ['HAL'],
        action: ['Watch'],
        overclaim_risk: 'Low'
      }
    }
  };
}

const CLEAN_URL = 'https://example.com/clean';
const LINT_URL = 'https://example.com/lint';
const CLEAN_HEADLINE = 'CameraX 호환성 검증 기준이 바뀐 자리';
const LINT_HEADLINE = 'AOSP Camera 서브디바이스 계약이 걸린 자리';

function v2Draft() {
  return {
    public_contract_version: 'story-v2',
    generation_contract_version: 2,
    briefing: ['one', 'two', 'three'],
    sections: [
      v2Section(CLEAN_HEADLINE, CLEAN_URL, CLEAN_BODY),
      v2Section(LINT_HEADLINE, LINT_URL, DUPLICATE_BLOCK_BODY)
    ]
  };
}

function reporterFor() {
  return {
    candidates: [
      scopedCandidate(CLEAN_URL, 'direct_aosp_camera'),
      scopedCandidate(LINT_URL, 'direct_aosp_camera')
    ]
  };
}

function passingFactCheck() {
  return { status: 'PASS', must_fix: [], source_gaps: [], source_gap_count: 0, recommended_fixes: [] };
}

function reportFor(editor) {
  return buildNewsletterQualityReport(DATE, editor, reporterFor(), passingFactCheck(), {});
}

function storyBodyDeductionsOf(report) {
  return report.deductions.filter(item => item.category === 'story-body');
}

test('editor contract lets a repairable body lint issue through instead of failing the draft', () => {
  // 여기서 throw하면 감점도, 수리 계획도, 강등도 없다. draft 전체가 semantic repair로 간다.
  assert.doesNotThrow(() => validatePublicArticleContract(v2Draft(), { requireStoryContract: true }));
});

test('editor contract still fails the draft on a structural story failure', () => {
  const draft = v2Draft();
  delete draft.sections[1].public_article.body_markdown;

  assert.throws(
    () => validatePublicArticleContract(draft, { requireStoryContract: true }),
    error => {
      const types = (error.details && error.details.issues || []).map(item => item.type);
      assert.deepEqual(types, ['missing_body_markdown']);
      return true;
    }
  );
});

test('v1 body paragraph shortage keeps failing the draft at the editor contract', () => {
  // v1 본문에는 블록 patch 주소가 없어서 수리 레인에 태울 수 없다. 같은 issue type이라도
  // v1 경로 판정은 바뀌지 않아야 한다.
  const base = section({ headline: 'CameraX 1.5 릴리스', url: CLEAN_URL });
  const draft = {
    briefing: ['one', 'two', 'three'],
    sections: [{
      ...base,
      public_article: { ...base.public_article, body_paragraphs: ['문단이 하나뿐이다.'] }
    }]
  };

  assert.throws(
    () => validatePublicArticleContract(draft),
    error => (error.details && error.details.issues || []).some(item =>
      item.type === 'insufficient_public_body_paragraphs' && item.key === 'body_paragraphs')
  );
});

test('the quality report emits the body lint issue as a blocking deduction with its reason_code', () => {
  const report = reportFor(v2Draft());
  const deductions = storyBodyDeductionsOf(report);

  assert.equal(deductions.length, 1);
  assert.equal(deductions[0].reason_code, 'body_markdown_duplicate_block');
  assert.equal(deductions[0].blocking, true);
  assert.equal(deductions[0].location, LINT_HEADLINE);
  assert.equal(report.status, 'NEEDS_FIX');
});

test('a clean v2 article gets no body deduction and stays publishable', () => {
  const draft = v2Draft();
  draft.sections = [draft.sections[0]];
  const report = reportFor(draft);

  assert.deepEqual(storyBodyDeductionsOf(report), []);
  assert.equal(report.article_results[0].status, 'PASS');
});

test('reason_code is what keeps the lane correct, because the reason text alone misclassifies it', () => {
  // deductionRepairPolicy는 reason_code가 비면 category와 reason 텍스트를 정규식으로 훑는다.
  // 그 폴백에서 duplicate_block은 중복 출처 분기에 걸려 기사 교체로 떨어진다.
  const deduction = storyBodyDeductionsOf(reportFor(v2Draft()))[0];

  assert.equal(deductionRepairPolicy(deduction).action, 'repair-section');
  assert.equal(
    deductionRepairPolicy({ category: deduction.category, reason: deduction.reason }).action,
    'replace-section'
  );
});

test('the repair plan routes the lint deduction to repair-section and carries the code to the model', () => {
  const draft = v2Draft();
  const report = reportFor(draft);
  const plan = buildFullSectionRepairPlan(draft, report, passingFactCheck(), []);

  assert.equal(plan.length, 1);
  assert.equal(plan[0].action, 'repair-section');
  assert.equal(plan[0].failure_type, 'body_markdown_duplicate_block');
  assert.equal(plan[0].allow_rewrite, true);
  assert.deepEqual(
    plan[0].deductions.map(item => item.reason_code),
    ['body_markdown_duplicate_block']
  );
});

test('a block patch on the flagged block clears the lint and survives the post-patch re-run', () => {
  const draft = v2Draft();
  const result = applyRepairPatchesAndValidate({
    editor: draft,
    patches: [{
      section_index: 1,
      op: 'replace',
      path: '/public_article/body_markdown/blocks/2',
      value: '마지막 문단은 앞 문단을 되풀이하지 않고 다음 확인 범위를 짚는다.'
    }],
    reporter: reporterFor(),
    date: DATE,
    validateEditor: value => value
  });

  assert.equal(result.ok, true);
  assert.match(result.editor.sections[1].public_article.body_markdown, /다음 확인 범위를 짚는다/);
  assert.deepEqual(
    validatePublicArticle(result.editor.sections[1], 1, { issue: result.editor })
      .filter(item => item.type === 'body_markdown_duplicate_block'),
    []
  );
  // 기사 정체성은 patch 경로에서 불변이다.
  assert.equal(result.editor.sections.length, 2);
  assert.equal(result.editor.sections[1].headline, LINT_HEADLINE);
});

test('a failed block patch keeps the base draft and demotes only the flagged article', () => {
  const draft = v2Draft();
  const failed = applyRepairPatchesAndValidate({
    editor: draft,
    patches: [{
      section_index: 1,
      op: 'replace',
      path: '/public_article/body_markdown/blocks/9',
      value: '범위 밖 블록을 가리키는 patch다.'
    }],
    reporter: reporterFor(),
    date: DATE,
    validateEditor: value => value
  });

  assert.equal(failed.ok, false);
  // 전체 필드 교체로 자동 폴백하지 않는다. 본문은 수리 전 그대로다.
  assert.equal(failed.editor.sections[1].public_article.body_markdown, DUPLICATE_BLOCK_BODY);

  // patch 실패 뒤 호출부가 타는 강등 경로. lint가 남은 기사만 떨어지고 나머지는 발행된다.
  const salvage = salvagePublishableSubset(DATE, draft, reporterFor(), passingFactCheck(), reportFor(draft), {});
  assert.ok(salvage, 'the clean article should still be publishable after the lint article is demoted');
  assert.equal(salvage.kept_section_count, 1);
  assert.deepEqual(salvage.editor.sections.map(item => item.headline), [CLEAN_HEADLINE]);
});

test('routing the lint issue away from the editor contract does not weaken the publish-time gate', () => {
  // validate-public-newsletter가 쓰는 같은 검증기다. 감점 레인으로 보냈다고 해서 발행
  // 직전 판정이 통과로 바뀌면, 수리도 강등도 실패한 본문이 그대로 실려 나간다.
  const draft = v2Draft();
  const issues = validatePublicArticle(draft.sections[1], 1, { issue: draft });

  assert.ok(issues.some(item => item.type === 'body_markdown_duplicate_block'));
});
