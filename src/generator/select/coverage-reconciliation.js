'use strict';

// #724: LLM coverage 권한 wiring — 결정론 재조정.
//
// editorial-plan LLM은 후보별 coverage_decision(main_article/reference_only/exclude)과
// impact_level을 "제안"만 한다. 이 순수 함수가 그 제안을 받아 결정론 불변식을 강제해 최종
// main 집합을 만든다:
//   1. 제안 tier 매핑 (미채점 후보는 결정론 tier 유지)
//   2. 승급 자격 가드 — main은 결정론적으로 main-eligible한 후보만
//   3. cap clamp — mainArticleCount.max / supportingMainMaxAllowed / forbidden
//   4. 발행가능 floor backfill — LLM은 뉴스레터를 발행불가로 만들 수 없다
//
// hard blocker(source-binding/evidence/freshness/hard-fail)는 이 모듈 밖 결정론
// validator가 그대로 담당한다. 이 슬라이스는 main 집합만 다루며 reference_only와 exclude는
// 둘 다 "main 아님"으로 collapse한다(참고자료 섹션은 기존 결정론 로직 유지).
const { ensureArray } = require('../../shared/common/value-coercion');
const { articlePolicy } = require('../../shared/common/newsletter-policy');
const { candidateGroupKey } = require('../../shared/common/article-groups');

const COVERAGE_MAIN = 'main_article';
const IMPACT_RANK = { high: 3, medium: 2, low: 1 };

// #909: reason_code는 기계가 읽는 값이라 LLM 원문을 그대로 이어붙이면 안 된다.
// coverage_decision은 스키마상 자유 문자열이고(enum 없음) 프롬프트 문장만이 값을 제한하므로,
// 모르는 값은 `editorial_plan_unrecognized`로 접고 원문은 coverage_decision에 그대로 남긴다.
// #969: 이 집합은 프롬프트가 제시하는 등급 목록의 사본이다. 프롬프트에 없는 값이 여기 남아
// 있으면 모델 드리프트가 정상 판단으로 기록된다. short_mention은 렌더 경로가 없어 제거했다.
const KNOWN_COVERAGE_DECISIONS = new Set(['main_article', 'reference_only', 'exclude']);

function demotionReasonCode({ proposedMain, coverageDecision }) {
  // main 제안까지 갔다가 빠졌으면 원인은 cap이다. 편집 계획 등급이 무엇이었든 마찬가지다.
  if (proposedMain) return 'cap_clamp';
  if (!coverageDecision) return 'unknown';
  if (!KNOWN_COVERAGE_DECISIONS.has(coverageDecision)) return 'editorial_plan_unrecognized';
  return `editorial_plan_${coverageDecision}`;
}

function forbiddenBuckets() {
  return new Set(ensureArray(articlePolicy.forbiddenMainBuckets));
}

function supportingBuckets() {
  return new Set(ensureArray(articlePolicy.supportingMainBuckets));
}

// dedup·backfill·diff 로그에 쓰는 후보 안정 식별자. selected/reserve 후보는
// url_hash를 가지며 url로 폴백한다.
function candidateKey(candidate) {
  return String(candidate?.url_hash || candidate?.url || candidate?.title || '').trim();
}

// 후보 목록의 대표 그룹키를 입력 순서대로, 중복 없이 뽑는다.
function uniqueGroupKeys(candidates) {
  return [...new Set(ensureArray(candidates).map(candidateGroupKey).filter(Boolean))];
}

// 승급 가드: LLM은 결정론이 이미 main 자격을 준 후보만 main으로 올릴 수 있다.
function isDeterministicallyMainEligible(candidate) {
  if (!candidate) return false;
  if (candidate.main_article_source_allowed !== true) return false;
  if (candidate.main_article_score_eligible === false) return false;
  if (forbiddenBuckets().has(String(candidate.relevance_bucket || ''))) return false;
  return true;
}

// LLM 제안을 견고하게 조회한다 — url 우선(양쪽 다 보유), url_hash/candidate_id 폴백
// (editorial_plans는 source_candidate_hash를 echo, 후보는 url_hash를 가짐).
function buildCoverageLookup(editorialPlanReport) {
  const byUrl = new Map();
  const byHash = new Map();
  for (const plan of ensureArray(editorialPlanReport?.editorial_plans)) {
    const entry = {
      // trim 없이 두면 " main_article"이 COVERAGE_MAIN과 안 맞아 main 제안이 조용히 강등된다.
      coverage_decision: String(plan?.coverage_decision || '').trim(),
      impact_level: String(plan?.impact_level || '').trim()
    };
    const url = String(plan?.url || '').trim();
    const hash = String(plan?.source_candidate_hash || '').trim();
    if (url) byUrl.set(url, entry);
    if (hash) byHash.set(hash, entry);
  }
  return { byUrl, byHash };
}

function coverageFor(lookup, candidate) {
  const url = String(candidate?.url || '').trim();
  if (url && lookup.byUrl.has(url)) return lookup.byUrl.get(url);
  const hash = String(
    candidate?.url_hash || candidate?.source_candidate_hash || candidate?.candidate_id || ''
  ).trim();
  if (hash && lookup.byHash.has(hash)) return lookup.byHash.get(hash);
  return null;
}

function impactRank(entry) {
  return IMPACT_RANK[String(entry?.impact_level || '').toLowerCase()] || 0;
}

// cap clamp 순서: LLM impact desc → deterministic_score desc(재현가능 tiebreak).
function orderForClamp(items, entryFor) {
  return [...items].sort((a, b) => {
    const ir = impactRank(entryFor(b)) - impactRank(entryFor(a));
    if (ir !== 0) return ir;
    return Number(b.deterministic_score || 0) - Number(a.deterministic_score || 0);
  });
}

function applyCaps(proposedMain, entryFor) {
  // impact→score 순서는 cap 초과 시 "무엇을 떨굴지"만 정한다. emit 순서는 결정론 입력
  // 순서(proposedMain, editorial_priority 우선)를 보존해야 리드/본문 순서가 뒤집히지 않는다.
  const ordered = orderForClamp(proposedMain, entryFor);
  const supporting = supportingBuckets();
  const supportingMax = Number(articlePolicy.publishReadyComposition?.supportingMainMaxAllowed ?? 1);
  const mainMax = Number(articlePolicy.mainArticleCount?.max ?? 5);
  const survivors = new Set();
  let supportingCount = 0;
  for (const candidate of ordered) {
    if (survivors.size >= mainMax) break;
    const isSupporting = supporting.has(String(candidate.relevance_bucket || ''));
    if (isSupporting && supportingCount >= supportingMax) continue;
    if (isSupporting) supportingCount += 1;
    survivors.add(candidateKey(candidate));
  }
  return proposedMain.filter(candidate => survivors.has(candidateKey(candidate)));
}

// 결정론 재조정 진입점. 항상 실행된다(toggle 없음) — LLM coverage 제안을 받아 결정론
// 불변식(승급 자격 가드·cap clamp·발행 floor backfill)을 강제한 최종 main 집합을 돌려준다.
function reconcileCoverage({ shortlistReport, editorialPlanReport } = {}) {
  const deterministicSelected = ensureArray(shortlistReport?.selected_articles);
  const reserve = ensureArray(shortlistReport?.reserve_candidates);
  const lookup = buildCoverageLookup(editorialPlanReport);
  const entryFor = (candidate) => coverageFor(lookup, candidate);
  const deterministicKeys = new Set(deterministicSelected.map(candidateKey));
  const changes = [];

  // 1-2. 제안 main 집합 + 승급 가드.
  const proposedMain = [];
  const seen = new Set();
  for (const candidate of [...deterministicSelected, ...reserve]) {
    const key = candidateKey(candidate);
    if (seen.has(key)) continue;
    seen.add(key);
    const grade = entryFor(candidate)?.coverage_decision || '';
    const wasMain = deterministicKeys.has(key);
    const proposesMain = grade ? grade === COVERAGE_MAIN : wasMain;
    if (!proposesMain) continue;
    if (isDeterministicallyMainEligible(candidate) || wasMain) {
      proposedMain.push(candidate);
    } else {
      changes.push({ key, action: 'promotion_blocked_ineligible' });
    }
  }

  // 3. cap clamp.
  const proposedMainKeys = new Set(proposedMain.map(candidateKey));
  const clamped = applyCaps(proposedMain, entryFor);
  const clampedKeys = new Set(clamped.map(candidateKey));

  // 4. 발행가능 floor backfill. deterministicSelected는 이미 forbidden-free이고, 현재
  //    mainArticleCount.min===1·supportingMainMaxAllowed===1이라 최대 1건만 backfill돼 cap을
  //    깨지 않는다. min을 1보다 크게 올리면 backfill이 supporting cap을 넘길 수 있으므로 그때는
  //    backfill도 applyCaps와 동일한 keep-predicate를 거쳐야 한다.
  const mainMin = Number(articlePolicy.mainArticleCount?.min ?? 1);
  if (clamped.length < mainMin) {
    const backfill = deterministicSelected
      .filter(candidate => !clampedKeys.has(candidateKey(candidate)))
      .sort((a, b) => Number(b.deterministic_score || 0) - Number(a.deterministic_score || 0));
    for (const candidate of backfill) {
      if (clamped.length >= mainMin) break;
      clamped.push(candidate);
      clampedKeys.add(candidateKey(candidate));
      changes.push({ key: candidateKey(candidate), action: 'floor_backfill' });
    }
  }

  // 결정론 baseline 대비 강등/승급 기록.
  //
  // #909: 강등에는 원본 판단과 실제 전환 원인을 **따로** 남긴다. LLM이 main_article로 제안한
  // 후보도 cap clamp에 밀리면 강등되므로, 제안(coverage_decision)을 그대로 사유로 복사하면
  // "왜 빠졌나"에 답하지 못한다(reason_code=main_article 같은 무의미한 기록이 남는다).
  for (const candidate of deterministicSelected) {
    const key = candidateKey(candidate);
    if (clampedKeys.has(key)) continue;
    const coverageDecision = entryFor(candidate)?.coverage_decision || '';
    changes.push({
      key,
      article_group_key: candidateGroupKey(candidate),
      action: 'demoted',
      coverage_decision: coverageDecision,
      reason_code: demotionReasonCode({
        proposedMain: proposedMainKeys.has(key),
        coverageDecision
      })
    });
  }
  for (const candidate of clamped) {
    if (!deterministicKeys.has(candidateKey(candidate))) {
      changes.push({ key: candidateKey(candidate), action: 'promoted' });
    }
  }

  // #837: 재조정이 main 집합을 바꾸면 그 집합에서 파생된 요약도 같이 바뀌어야 한다.
  // 정본만 갈아끼우고 파생을 그대로 두면 generation-status의 coverage 등식
  // (selected === rendered + demoted + hardBlocked)이 재조정 前 좌변과 재조정 後
  // 우변을 섞어 계산해 정상 발행에도 group_coverage_ok=false를 찍는다.
  // 파생을 여기서 함께 내보내 호출부가 필드를 하나씩 대입하지 않게 한다.
  const deterministicGroupKeys = uniqueGroupKeys(deterministicSelected);
  const reconciledGroupKeys = uniqueGroupKeys(clamped);
  const reconciledGroupKeySet = new Set(reconciledGroupKeys);
  const deterministicGroupKeySet = new Set(deterministicGroupKeys);
  const demotedGroupKeys = deterministicGroupKeys.filter(key => !reconciledGroupKeySet.has(key));

  // #909: 리뷰가 읽는 정본은 그룹 단위다. candidate 단위 changes를 그대로 올리면 같은 그룹의
  // 후보 하나만 빠진 경우까지 "그룹 강등"으로 읽혀 진단이 왜곡된다. 그래서 그룹이 실제로
  // 사라진 경우(demotedGroupKeys)에만, 그 그룹에서 빠진 후보들의 사유를 모아 싣는다.
  const demotedChangesByGroup = new Map();
  for (const change of changes) {
    if (change.action !== 'demoted') continue;
    const groupKey = change.article_group_key;
    if (!groupKey) continue;
    if (!demotedChangesByGroup.has(groupKey)) demotedChangesByGroup.set(groupKey, []);
    demotedChangesByGroup.get(groupKey).push(change);
  }
  const demotedGroups = demotedGroupKeys.map(groupKey => ({
    article_group_key: groupKey,
    // 후보별 레코드를 그대로 싣는다. 사유·판단·후보를 각각 배열로 쪼개면 서로 독립적으로
    // dedup·필터링돼 짝이 어긋나고(빈 coverage_decision 하나면 인덱스가 밀린다), 길이가 우연히
    // 맞는 경우에는 뒤집힌 짝이 조용히 남는다. 단위는 그룹이되 짝은 후보 안에서 보존한다.
    demoted_candidates: (demotedChangesByGroup.get(groupKey) || []).map(change => ({
      candidate_key: change.key,
      coverage_decision: change.coverage_decision,
      reason_code: change.reason_code
    }))
  }));

  return {
    selected: clamped,
    // 재조정된 main 집합에서 파생되는 shortlistReport 요약 필드.
    selection_summary: {
      selected_article_count: clamped.length,
      selected_group_count: reconciledGroupKeys.length,
      selected_representative_group_keys: reconciledGroupKeys
    },
    diff: {
      deterministic_selected: [...deterministicKeys],
      reconciled_selected: clamped.map(candidateKey),
      changes,
      // 그룹 단위 provenance. changes[].key는 candidateKey(url_hash/url/title)라
      // 그룹키와 네임스페이스가 달라 그대로 쓰면 selected와 매칭되지 않는다. 또 같은
      // 그룹의 다른 후보가 살아남았으면 그룹이 강등된 게 아니므로 집합 차집합으로 센다.
      deterministic_selected_group_keys: deterministicGroupKeys,
      demoted_group_keys: demotedGroupKeys,
      demoted_groups: demotedGroups,
      promoted_group_keys: reconciledGroupKeys.filter(key => !deterministicGroupKeySet.has(key))
    }
  };
}

module.exports = {
  reconcileCoverage,
  isDeterministicallyMainEligible,
  candidateKey,
  // 테스트가 프롬프트 목록과 양방향으로 대조하려고 읽는다. 런타임 소비자는 없다.
  KNOWN_COVERAGE_DECISIONS
};
