// #700: LLM editorial assessment & planning 단계.
//
// selected article capsule마다 내부 editorial plan(coverage/impact/추론/limitations)을 생성하는
// 전용 LLM 호출이다. 이 plan은 작성(editor)을 안내할 internal scaffolding이며 public article에
// 라벨로 render하지 않는다. 발행 hard blocker(source-binding/evidence/freshness/hard-fail)는
// deterministic validation layer가 그대로 담당하므로, 이 단계는 그 안전 봉투 안에서 편집 판단만
// 더한다.
//
// 안전: best-effort 단계다. config flag(NEWSROOM_EDITORIAL_PLAN_STAGE)로 gate하며 기본은 OFF다.
// 비활성/실패 시 null을 돌려 main()이 artifact 기록·editor 주입을 건너뛰게 한다(발행 무차단,
// 현재 발행 경로 byte-불변). buildBackgroundContextReport와 동일한 graceful-degradation 패턴.
const { ensureArray } = require('../../shared/common/value-coercion');
const { stringOrEmpty } = require('./orchestrator-shared-helpers');
const { capsuleInputFromReport } = require('../select/article-capsules');
const { editorialPlanSchema } = require('../render/newsletter-schema');
const { editorialPlanSystemPrompt } = require('./orchestrator-stage-prompts');
const { callLlmJson } = require('./orchestrator-llm-instrumentation');

function editorialPlanStageEnabled(env = process.env) {
  const value = String(env.NEWSROOM_EDITORIAL_PLAN_STAGE ?? '').trim();
  if (!value) return false;
  return /^(1|true|on|gemini|enabled?)$/i.test(value);
}

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

async function buildEditorialPlanReport({ date, articleCapsuleReport, commonContext, stage }) {
  if (!editorialPlanStageEnabled()) return null;
  try {
    const result = await callLlmJson(
      stage,
      editorialPlanSystemPrompt(),
      `${commonContext}\n\nSelected article capsule JSON:\n${JSON.stringify(capsuleInputFromReport(articleCapsuleReport, 'selected'), null, 2)}`,
      editorialPlanSchema
    );
    const normalized = normalizeEditorialPlanReport(result, date);
    if (normalized.editorial_plans.length > 0) return normalized;
  } catch (error) {
    console.warn(`Gemini editorial-plan stage failed; continuing without editorial plan: ${error.message}`);
  }
  return null;
}

module.exports = {
  editorialPlanStageEnabled,
  normalizeEditorialPlanReport,
  buildEditorialPlanReport
};
