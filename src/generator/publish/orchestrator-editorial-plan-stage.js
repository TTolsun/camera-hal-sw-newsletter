// #700: LLM editorial assessment & planning 단계.
//
// selected article capsule마다 내부 editorial plan(coverage/impact/추론/limitations)을 생성하는
// 전용 LLM 호출이다. 이 plan은 작성(editor)을 안내할 internal scaffolding이며 public article에
// 라벨로 render하지 않는다. 발행 hard blocker(source-binding/evidence/freshness/hard-fail)는
// deterministic validation layer가 그대로 담당하므로, 이 단계는 그 안전 봉투 안에서 편집 판단만
// 더한다.
//
// 동작: 항상 실행되는 필수 단계다(toggle 없음). LLM 호출이 실패하거나 사용할 plan이 하나도 없으면
// throw해서 editor 등 뒤 단계 비용을 들이기 전에 파이프라인을 멈춘다(best-effort graceful-degradation
// 폐기 — 비용 우선). 성공하면 항상 유효한 plan을 돌려 main()이 artifact를 기록하고 editor에 주입한다.
const { ensureArray } = require('../../shared/common/value-coercion');
const { stringOrEmpty } = require('./orchestrator-shared-helpers');
const { capsuleInputFromReport } = require('../select/article-capsules');
const { editorialPlanSchema } = require('../render/newsletter-schema');
const { editorialPlanSystemPrompt } = require('./orchestrator-stage-prompts');
const { callLlmJson } = require('./orchestrator-llm-instrumentation');

function normalizeEditorialPlanReport(value, date) {
  return {
    schema_version: Number(value?.schema_version || 1),
    date,
    stage: stringOrEmpty(value?.stage) || 'gemini-editorial-plan',
    editorial_plans: ensureArray(value?.editorial_plans).map(item => ({
      title: stringOrEmpty(item?.title),
      url: stringOrEmpty(item?.url),
      source_candidate_hash: stringOrEmpty(item?.source_candidate_hash),
      coverage_decision: stringOrEmpty(item?.coverage_decision),
      impact_level: stringOrEmpty(item?.impact_level),
      direct_hal_impact: item?.direct_hal_impact === true,
      target_description: stringOrEmpty(item?.target_description),
      editorial_angle: stringOrEmpty(item?.editorial_angle),
      why_it_matters: stringOrEmpty(item?.why_it_matters),
      reader_takeaway: stringOrEmpty(item?.reader_takeaway),
      misunderstanding_risks: ensureArray(item?.misunderstanding_risks).map(stringOrEmpty).filter(Boolean),
      source_limitations: ensureArray(item?.source_limitations).map(stringOrEmpty).filter(Boolean)
    })).filter(item => item.source_candidate_hash || item.url || item.title)
  };
}

// #724: coverage 권한 ON일 때만 editorial-plan이 reserve 포함 shortlisted view를 받아
// 승급 후보까지 등급을 매길 수 있다. OFF는 현행 selected view를 유지해 입력·비용·결과가
// 완전히 동일하다.
function editorialPlanCapsuleView(coverageAuthority) {
  return coverageAuthority === true ? 'shortlisted' : 'selected';
}

async function buildEditorialPlanReport({ date, articleCapsuleReport, commonContext, stage, coverageAuthority = false }) {
  const result = await callLlmJson(
    stage,
    editorialPlanSystemPrompt(),
    `${commonContext}\n\nSelected article capsule JSON:\n${JSON.stringify(capsuleInputFromReport(articleCapsuleReport, editorialPlanCapsuleView(coverageAuthority)), null, 2)}`,
    editorialPlanSchema
  );
  const normalized = normalizeEditorialPlanReport(result, date);
  if (normalized.editorial_plans.length === 0) {
    throw new Error('Editorial plan stage produced no usable editorial_plans');
  }
  return normalized;
}

// #700: editor에게 넘기는 plan에서 coverage 권한 신호(coverage_decision/impact_level)를 뺀다.
// 현재 슬라이스에서 "어떤 기사를 main으로 낼지"는 deterministic selection이 정하고 editor는 선택된
// 기사를 모두 렌더해야 한다(editor group-coverage 계약). plan의 coverage_decision을 editor가 보면
// 선택된 기사를 demote/병합하도록 유도해 그 계약과 충돌하므로, editor에는 framing 필드(target/
// angle/why/takeaway/misunderstanding_risks/source_limitations + direct_hal_impact)만 전달한다.
// coverage_decision/impact_level은 artifact(editorial-plan.json)에 그대로 남겨 review·후속
// coverage-authority 슬라이스에서 쓴다.
function editorFacingEditorialPlan(report) {
  if (!report || !Array.isArray(report.editorial_plans)) return report;
  return {
    ...report,
    editorial_plans: report.editorial_plans.map(({ coverage_decision, impact_level, ...framing }) => framing)
  };
}

module.exports = {
  normalizeEditorialPlanReport,
  buildEditorialPlanReport,
  editorialPlanCapsuleView,
  editorFacingEditorialPlan
};
