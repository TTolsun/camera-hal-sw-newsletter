'use strict';

// #724: LLM coverage 권한 wiring — 결정론 재조정.
//
// editorial-plan LLM은 후보별 coverage_decision(main_article/short_mention/
// reference_only/exclude)과 impact_level을 "제안"만 한다. 이 순수 함수가 그 제안을
// 받아 결정론 불변식을 강제해 최종 main 집합을 만든다:
//   1. 제안 tier 매핑 (미채점 후보는 결정론 tier 유지)
//   2. 승급 자격 가드 — main은 결정론적으로 main-eligible한 후보만
//   3. cap clamp — mainArticleCount.max / supportingMainMaxAllowed / forbidden
//   4. 발행가능 floor backfill — LLM은 뉴스레터를 발행불가로 만들 수 없다
//
// hard blocker(source-binding/evidence/freshness/hard-fail)는 이 모듈 밖 결정론
// validator가 그대로 담당한다. 이 슬라이스는 main 집합만 다루며 short/reference/
// exclude는 전부 "main 아님"으로 collapse한다(참고자료 섹션은 기존 결정론 로직 유지).
const { ensureArray } = require('../../shared/common/value-coercion');
const { articlePolicy } = require('../../shared/common/newsletter-policy');

const COVERAGE_MAIN = 'main_article';
const IMPACT_RANK = { high: 3, medium: 2, low: 1 };

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
      coverage_decision: String(plan?.coverage_decision || ''),
      impact_level: String(plan?.impact_level || '')
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

// 결정론 재조정 진입점. enabled=false면 결정론 selected를 그대로(동일 참조) 반환한다.
function reconcileCoverage({ shortlistReport, editorialPlanReport, enabled } = {}) {
  const deterministicSelected = ensureArray(shortlistReport?.selected_articles);
  if (!enabled) {
    return { selected: deterministicSelected, diff: { enabled: false, changes: [] } };
  }

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
  for (const candidate of deterministicSelected) {
    if (!clampedKeys.has(candidateKey(candidate))) {
      changes.push({ key: candidateKey(candidate), action: 'demoted' });
    }
  }
  for (const candidate of clamped) {
    if (!deterministicKeys.has(candidateKey(candidate))) {
      changes.push({ key: candidateKey(candidate), action: 'promoted' });
    }
  }

  return {
    selected: clamped,
    diff: {
      enabled: true,
      deterministic_selected: [...deterministicKeys],
      reconciled_selected: clamped.map(candidateKey),
      changes
    }
  };
}

module.exports = {
  reconcileCoverage,
  isDeterministicallyMainEligible,
  candidateKey
};
