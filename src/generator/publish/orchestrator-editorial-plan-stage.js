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

const coverageReviewSchema = {
  type: 'OBJECT', properties: { reviews: { type: 'ARRAY', items: {
    type: 'OBJECT', properties: {
      url: { type: 'STRING' }, source_candidate_hash: { type: 'STRING' },
      coverage_decision: { type: 'STRING', enum: ['main_article', 'exclude'] },
      reason: { type: 'STRING' }
    }, required: ['url', 'source_candidate_hash', 'coverage_decision', 'reason']
  } } }, required: ['reviews']
};

function applyCoveragePolicyReview(report, review) {
  const proposed = report.editorial_plans.filter(item => item.coverage_decision === 'main_article');
  const key = item => `${item.url}|${item.source_candidate_hash}`;
  const expected = new Set(proposed.map(key));
  const decisions = new Map();
  for (const item of ensureArray(review?.reviews)) {
    if (!expected.has(key(item)) || decisions.has(key(item)) ||
      !['main_article', 'exclude'].includes(item.coverage_decision) || !stringOrEmpty(item.reason)) {
      throw new Error('Editorial policy review has invalid or duplicate source identity/decision');
    }
    decisions.set(key(item), item);
  }
  if (decisions.size !== expected.size) throw new Error('Editorial policy review omitted proposed main articles');
  return { ...report, editorial_plans: report.editorial_plans.map(item => {
    const decision = decisions.get(key(item));
    return decision ? { ...item, coverage_decision: decision.coverage_decision,
      policy_review_reason: decision.reason } : item;
  }) };
}

function normalizeEditorialPlanReport(value, date, capsules = []) {
  const hasDirectEvidence = item => ensureArray(capsules).some(capsule =>
    capsule.url === item?.url && capsule.source_candidate_hash === item?.source_candidate_hash &&
    Boolean(capsule.url && capsule.source_candidate_hash) &&
    ensureArray(capsule.allowed_claim_evidence).some(evidence => evidence.supports_direct_hal_contract === true));
  return {
    schema_version: Number(value?.schema_version || 1),
    date,
    stage: stringOrEmpty(value?.stage) || 'gemini-editorial-plan',
    editorial_plans: ensureArray(value?.editorial_plans).map(item => ({
      title: stringOrEmpty(item?.title),
      url: stringOrEmpty(item?.url),
      source_candidate_hash: stringOrEmpty(item?.source_candidate_hash),
      change_assessment: stringOrEmpty(item?.change_assessment),
      mechanical_only: item?.mechanical_only === true,
      // This is the LLM's editorial assessment, not a topic/keyword heuristic.
      coverage_decision: item?.mechanical_only === true ? 'exclude' : stringOrEmpty(item?.coverage_decision),
      impact_level: stringOrEmpty(item?.impact_level),
      // Editorial importance cannot manufacture a HAL contract boundary. Keep
      // the existing claim validator's evidence prerequisite at the plan handoff.
      direct_hal_impact: item?.direct_hal_impact === true && hasDirectEvidence(item),
      target_description: stringOrEmpty(item?.target_description),
      editorial_angle: stringOrEmpty(item?.editorial_angle),
      why_it_matters: stringOrEmpty(item?.why_it_matters),
      reader_takeaway: stringOrEmpty(item?.reader_takeaway),
      misunderstanding_risks: ensureArray(item?.misunderstanding_risks).map(stringOrEmpty).filter(Boolean),
      source_limitations: [
        ...ensureArray(item?.source_limitations).map(stringOrEmpty).filter(Boolean),
        ...(item?.direct_hal_impact === true && !hasDirectEvidence(item)
          ? ['제공된 원문 근거는 직접 HAL 인터페이스 계약 변경을 뒷받침하지 않습니다. 프레임워크·드라이버·도구 등 실제 변경 계층 안에서 설명하세요.'] : [])
      ],
      // v2 작성 안내(설계 4.3). 이 정규화는 고정 키 목록으로 item을 새로 만들기 때문에,
      // 여기 적지 않은 필드는 스키마와 프롬프트에 있어도 editor까지 가지 못한다.
      narrative_arc: stringOrEmpty(item?.narrative_arc),
      subheading_candidates: ensureArray(item?.subheading_candidates).map(stringOrEmpty).filter(Boolean)
    })).filter(item => item.source_candidate_hash || item.url || item.title)
  };
}

// #724: coverage 권한은 항상 켜져 있으므로 editorial-plan은 언제나 reserve 포함 shortlisted
// view를 받아 승급 후보까지 등급을 매긴다.
async function buildEditorialPlanReport({ date, articleCapsuleReport, commonContext, stage }) {
  const result = await callLlmJson(
    stage,
    editorialPlanSystemPrompt(),
    `${commonContext}\n\nSelected article capsule JSON:\n${JSON.stringify(capsuleInputFromReport(articleCapsuleReport, 'shortlisted'), null, 2)}`,
    editorialPlanSchema
  );
  const normalized = normalizeEditorialPlanReport(result, date, articleCapsuleReport?.shortlisted_capsules || articleCapsuleReport?.selected_capsules);
  if (normalized.editorial_plans.length === 0) {
    throw new Error('Editorial plan stage produced no usable editorial_plans');
  }
  const proposed = normalized.editorial_plans.filter(item => item.coverage_decision === 'main_article');
  if (proposed.length === 0) return normalized;
  const review = await callLlmJson(stage, [
    '당신은 뉴스레터 편집 정책의 독립 검토자입니다. 첫 편집 계획의 주장과 선정은 검토 대상이지 사실 근거가 아닙니다.',
    '제안된 main 기사마다 원문 capsule만 보고 실제 변경 전후를 대조하여 main_article 유지 또는 exclude를 결정하세요. 모든 제안에 정확히 한 번 응답하세요.',
    '플랫폼 내부 타입·구문·래퍼 치환을 새로운 IPC 동작이나 소유권·수명·안전성 개선으로 해석하지 마세요. 타입을 명시적으로 바꿨다는 사실만 있고 전달 의미·호환성 변화의 원문 근거가 없으면 exclude입니다. 버퍼·펜스·FD를 다룬다는 사실과 다른 플랫폼 설계에 참고된다는 추측은 예외가 아닙니다.',
    '예: 기존에도 플랫폼 핸들을 전달했는데 handle을 handle<platform>으로 표기하고 대응 C++ 래퍼만 바꾸는 경우는 exclude입니다. 이미 지원하던 기능을 새로운 기능으로 읽지 마세요.',
    '조건부 mute와 강제 연결 종료의 차이는 실제 framework 동작입니다. ISP 파라미터 uAPI 구조와 소비 노드 문서화는 구체적 driver 계약 참고입니다. 코딩 에이전트의 지원 작업이 명시된 모델 발표는 독립 개발 도구 기사이며 카메라 전용 기능이나 HAL 변경이 없다는 이유로 제외하지 마세요.',
    'source gap, 날짜, claim의 발행 안전 검사는 이후 별도로 유지됩니다. 이 검토는 편집 가치와 원문에 없는 효과를 선정 이유로 삼았는지만 판단합니다.'
  ].join('\n'), JSON.stringify({ proposed_plans: proposed,
    capsules: (articleCapsuleReport?.shortlisted_capsules || articleCapsuleReport?.selected_capsules || [])
      .filter(capsule => proposed.some(item => item.url === capsule.url && item.source_candidate_hash === capsule.source_candidate_hash))
  }), coverageReviewSchema);
  return applyCoveragePolicyReview(normalized, review);
}

// #700: editor에게 넘기는 plan에서 coverage 권한 신호(coverage_decision/impact_level)를 뺀다.
// 현재 슬라이스에서 "어떤 기사를 main으로 낼지"는 deterministic selection이 정하고 editor는 선택된
// 기사를 모두 렌더해야 한다(editor group-coverage 계약). plan의 coverage_decision을 editor가 보면
// 선택된 기사를 demote/병합하도록 유도해 그 계약과 충돌하므로, editor에는 framing 필드(target/
// angle/why/takeaway/misunderstanding_risks/source_limitations + direct_hal_impact)만 전달한다.
// coverage_decision/impact_level은 artifact(editorial-plan.json)에 남겨 review가 읽는다.
// always-on coverage 재조정(coverage-reconciliation.js)이 실제로 소비하는 값은 coverage_decision
// 하나뿐이며(#1001: impact_level은 cap clamp 정렬에 쓰지 않는다), 그것도 결정론 불변식 안에서만
// main-set에 반영한다.
function editorFacingEditorialPlan(report) {
  if (!report || !Array.isArray(report.editorial_plans)) return report;
  return {
    ...report,
    editorial_plans: report.editorial_plans.map(({ coverage_decision, impact_level, ...framing }) => framing)
  };
}

module.exports = {
  normalizeEditorialPlanReport,
  applyCoveragePolicyReview,
  buildEditorialPlanReport,
  editorFacingEditorialPlan
};
